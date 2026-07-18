"""Original, fictional fixtures that are safe to deploy with the public demo.

These records are authored for RealDoor.  They do not contain organizer
materials, real-person information, or any housing-program determination.
"""

from __future__ import annotations

from copy import deepcopy


RULE_CITATION = {
    "rule_id": "REALDOOR-DEMO-2026-001",
    "effective_date": "2026-01-01",
    "source_url": "https://www.huduser.gov/portal/datasets/mtsp.html",
    "source_locator": "RealDoor fictional demonstration threshold; verify current program rules with a qualified reviewer.",
}


def _documents(household_id: str, types: list[str]) -> list[dict]:
    return [
        {
            "document_id": f"{household_id}-D{index:02d}",
            "document_type": document_type,
            "file_name": f"fictional_{household_id.lower()}_{document_type}.pdf",
            "rasterized": False,
            "contains_adversarial_text": False,
        }
        for index, document_type in enumerate(types, start=1)
    ]


# All names, amounts, document labels, and review states below are invented.
PUBLIC_HOUSEHOLDS = [
    {
        "household_id": "HH-001", "display_name": "Ari Example", "scenario": "regular_hourly",
        "household_size": 1, "threshold": 52000, "readiness": "READY_TO_REVIEW", "reasons": [],
        "documents": _documents("HH-001", ["application_summary", "pay_stub", "employment_letter"]),
        "fields": [("weekly_hours", 35), ("hourly_rate", 20), ("document_date", "2026-06-15")],
    },
    {
        "household_id": "HH-002", "display_name": "Blair Example", "scenario": "pay_variance",
        "household_size": 2, "threshold": 60000, "readiness": "NEEDS_REVIEW", "reasons": ["PAY_STUB_TOTAL_CONFLICT"],
        "documents": _documents("HH-002", ["application_summary", "pay_stub", "pay_stub", "employment_letter"]),
        "fields": [("weekly_hours", 36), ("hourly_rate", 22), ("document_date", "2026-06-20")],
    },
    {
        "household_id": "HH-003", "display_name": "Casey Example", "scenario": "benefits_plus_wages",
        "household_size": 3, "threshold": 68000, "readiness": "READY_TO_REVIEW", "reasons": [],
        "documents": _documents("HH-003", ["application_summary", "pay_stub", "benefit_letter"]),
        "fields": [("weekly_hours", 30), ("hourly_rate", 21), ("monthly_benefit", 450)],
    },
    {
        "household_id": "HH-004", "display_name": "Devon Example", "scenario": "gig_income",
        "household_size": 4, "threshold": 76000, "readiness": "NEEDS_REVIEW", "reasons": ["GIG_INCOME_UNCORROBORATED"],
        "documents": _documents("HH-004", ["application_summary", "pay_stub", "gig_statement"]),
        "fields": [("weekly_hours", 32), ("hourly_rate", 23), ("gross_receipts", 1200)],
    },
    {
        "household_id": "HH-005", "display_name": "Emery Example", "scenario": "dated_employment_letter",
        "household_size": 5, "threshold": 84000, "readiness": "NEEDS_REVIEW", "reasons": ["EMPLOYMENT_LETTER_EXPIRED"],
        "documents": _documents("HH-005", ["application_summary", "pay_stub", "employment_letter"]),
        "fields": [("weekly_hours", 38), ("hourly_rate", 24), ("document_date", "2025-11-01")],
    },
    {
        "household_id": "HH-006", "display_name": "Finley Example", "scenario": "near_threshold",
        "household_size": 6, "threshold": 92000, "readiness": "READY_TO_REVIEW", "reasons": [],
        "documents": _documents("HH-006", ["application_summary", "pay_stub", "benefit_letter"]),
        "fields": [("weekly_hours", 40), ("hourly_rate", 38), ("monthly_benefit", 250)],
    },
]


def list_public_households() -> list[dict]:
    return deepcopy(PUBLIC_HOUSEHOLDS)


def public_household(household_id: str) -> dict | None:
    return next((deepcopy(item) for item in PUBLIC_HOUSEHOLDS if item["household_id"] == household_id), None)
