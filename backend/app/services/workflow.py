from uuid import uuid5, NAMESPACE_URL

from app.core.config import SOURCE_DOCUMENTS_DIR
from app.schemas.document import EvidenceBox, ExtractedField, SessionDocument
from app.services.fixtures import get_household
from app.services.public_demo import public_household


ALLOWED_FIELDS = {
    "household_size",
    "gross_pay",
    "pay_frequency",
    "weekly_hours",
    "hourly_rate",
    "monthly_benefit",
    "benefit_frequency",
    "document_date",
    "pay_date",
    "pay_period_start",
    "pay_period_end",
    "gross_receipts",
    "platform_fees",
    "statement_month",
}


def load_demo_documents(household_id: str) -> list[SessionDocument]:
    household = get_household(household_id)
    if household is None:
        return []
    return [
        SessionDocument(
            document_id=document.document_id,
            document_type=document.document_type,
            file_name=document.file_name,
            rasterized=document.rasterized,
            contains_adversarial_text=document.contains_adversarial_text,
            status="loaded",
        )
        for document in household.documents
    ]


def extract_fixture_fields(household_id: str) -> list[ExtractedField]:
    """Returns only allowlisted fields and never treats document text as instructions."""
    household = get_household(household_id)
    if household is None:
        return []
    fixture = public_household(household_id)
    if fixture is None:
        return []
    extracted: list[ExtractedField] = []
    for index, (field_name, value) in enumerate(fixture["fields"]):
        if field_name not in ALLOWED_FIELDS:
            continue
        document = household.documents[index % len(household.documents)]
        extracted.append(
            ExtractedField(
                field_id=str(uuid5(NAMESPACE_URL, f"{household_id}:{document.document_id}:{field_name}")),
                name=field_name,
                value=value,
                confidence="high",
                state="extracted",
                evidence=[EvidenceBox(document_id=document.document_id, page=1, bbox=[72, 120 + index * 24, 360, 20], bbox_units="pdf_points")],
            )
        )
    return extracted


def source_document_path(file_name: str):
    """Resolves a supplied synthetic fixture only; arbitrary filesystem paths are never accepted."""
    path = (SOURCE_DOCUMENTS_DIR / file_name).resolve()
    if path.parent != SOURCE_DOCUMENTS_DIR.resolve() or not path.is_file():
        return None
    return path
