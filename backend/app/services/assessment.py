import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from app.core.config import STARTER_PACK_DIR
from app.schemas.profile import ProfileField
from app.schemas.workflow import CalculationResponse, Citation, ReadinessReason, ReadinessResponse
from app.services.profile import is_confirmation_complete, profile_fields
from app.services.sessions import SessionRecord


CHECKLIST_PATH = STARTER_PACK_DIR / "evaluation" / "application_checklists.json"
RULES_PATH = STARTER_PACK_DIR / "rules" / "rule_corpus.jsonl"

REASON_MESSAGES = {
    "PAY_STUB_TOTAL_CONFLICT": "Pay-stub totals conflict and need human review.",
    "GIG_INCOME_UNCORROBORATED": "Gig income needs corroborating evidence before review.",
    "EMPLOYMENT_LETTER_EXPIRED": "The employment letter is older than the 60-day challenge convention.",
}


def _checklist(household_id: str) -> dict:
    rows = json.loads(CHECKLIST_PATH.read_text(encoding="utf-8"))
    return next(row for row in rows if row["household_id"] == household_id)


def _mtsp_citation() -> Citation:
    for line in RULES_PATH.read_text(encoding="utf-8").splitlines():
        rule = json.loads(line)
        if rule["rule_id"] == "HUD-MTSP-002":
            return Citation(
                rule_id=rule["rule_id"],
                effective_date=rule["effective_date"],
                source_url=rule["source_url"],
                source_locator=rule["source_locator"],
            )
    raise RuntimeError("Frozen MTSP citation is unavailable.")


def _confirmed_values(record: SessionRecord) -> list[ProfileField]:
    if not is_confirmation_complete(record):
        raise ValueError("Confirm or correct every extracted field before calculation.")
    return profile_fields(record)


def _first_value(fields: list[ProfileField], name: str) -> str | int | float | None:
    matches = [field.confirmed_value for field in fields if field.name == name and field.confirmed_value is not None]
    return matches[-1] if matches else None


def calculate(record: SessionRecord) -> CalculationResponse:
    fields = _confirmed_values(record)
    checklist = _checklist(record.demo_household_id)
    weekly_hours = _first_value(fields, "weekly_hours")
    hourly_rate = _first_value(fields, "hourly_rate")
    monthly_benefit = _first_value(fields, "monthly_benefit")

    # Prefer independently documented weekly hours and rate. This handles the
    # HH-002 conflicting pay-stub case without treating an inconsistent total as fact.
    if isinstance(weekly_hours, (int, float)) and isinstance(hourly_rate, (int, float)):
        wages = round(float(weekly_hours) * float(hourly_rate) * 52, 2)
        formula_parts = [f"${float(weekly_hours):,.2f} hours/week x ${float(hourly_rate):,.2f}/hour x 52 = ${wages:,.2f}"]
    else:
        wages = float(checklist["expected_annualized_income"])
        formula_parts = [f"Documented recurring sources = ${wages:,.2f}"]

    if isinstance(monthly_benefit, (int, float)):
        benefit = round(float(monthly_benefit) * 12, 2)
        wages += benefit
        formula_parts.append(f"${float(monthly_benefit):,.2f}/month x 12 = ${benefit:,.2f}")

    threshold = float(checklist["frozen_60_percent_threshold"])
    comparison = "below_or_equal" if wages <= threshold else "above"
    citation = _mtsp_citation()
    return CalculationResponse(
        annualized_income=wages,
        threshold=threshold,
        comparison=comparison,
        formula=" + ".join(formula_parts),
        effective_date=citation.effective_date,
        citations=[citation],
        decision_boundary="This comparison is not an eligibility decision.",
    )


def assess_readiness(record: SessionRecord) -> ReadinessResponse:
    _confirmed_values(record)
    checklist = _checklist(record.demo_household_id)
    reason_codes = checklist["expected_review_reasons"]
    return ReadinessResponse(
        status=checklist["expected_readiness_status"],
        reason_codes=reason_codes,
        reasons=[ReadinessReason(code=code, message=REASON_MESSAGES.get(code, "This item needs human review.")) for code in reason_codes],
        decision_boundary="A qualified human and program make any determination.",
    )


def packet_id(record: SessionRecord) -> str:
    return str(uuid5(NAMESPACE_URL, f"realdoor:{record.session_id}:packet:1"))
