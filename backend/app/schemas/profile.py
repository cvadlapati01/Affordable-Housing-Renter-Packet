from pydantic import BaseModel, Field

from app.schemas.document import EvidenceBox


class ProfileField(BaseModel):
    field_id: str
    name: str
    extracted_value: str | int | float
    confirmed_value: str | int | float | None
    confidence: str
    state: str
    correction_reason: str | None = None
    evidence: list[EvidenceBox]


class ProfileResponse(BaseModel):
    fields: list[ProfileField]
    confirmation_complete: bool
    next_action: str


class CorrectFieldRequest(BaseModel):
    value: str | int | float
    reason: str = Field(min_length=3, max_length=280)


class ConfirmFieldsRequest(BaseModel):
    field_ids: list[str] = Field(min_length=1)
