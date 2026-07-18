from app.schemas.profile import ProfileField
from app.services.sessions import SessionRecord


def _require_extraction(record: SessionRecord) -> list[dict]:
    if record.extracted_fields is None:
        raise ValueError("Extract documents before reviewing profile fields.")
    return record.extracted_fields


def profile_fields(record: SessionRecord) -> list[ProfileField]:
    return [ProfileField(**field) for field in _require_extraction(record)]


def correct_field(record: SessionRecord, field_id: str, value: str | int | float, reason: str) -> ProfileField | None:
    for field in _require_extraction(record):
        if field["field_id"] == field_id:
            field["confirmed_value"] = value
            field["correction_reason"] = reason
            field["state"] = "corrected"
            return ProfileField(**field)
    return None


def confirm_fields(record: SessionRecord, field_ids: list[str]) -> list[ProfileField] | None:
    fields = _require_extraction(record)
    matches = {field["field_id"]: field for field in fields}
    if any(field_id not in matches for field_id in field_ids):
        return None
    for field_id in field_ids:
        field = matches[field_id]
        if field["state"] == "extracted":
            field["confirmed_value"] = field["extracted_value"]
            field["state"] = "confirmed"
    return [ProfileField(**matches[field_id]) for field_id in field_ids]


def is_confirmation_complete(record: SessionRecord) -> bool:
    fields = _require_extraction(record)
    return bool(fields) and all(field["state"] in {"confirmed", "corrected"} for field in fields)
