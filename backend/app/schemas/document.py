from pydantic import BaseModel


class EvidenceBox(BaseModel):
    document_id: str
    page: int
    bbox: list[float]
    bbox_units: str


class ExtractedField(BaseModel):
    field_id: str
    name: str
    value: str | int | float
    confidence: str
    state: str
    evidence: list[EvidenceBox]


class SessionDocument(BaseModel):
    document_id: str
    document_type: str
    file_name: str
    rasterized: bool
    contains_adversarial_text: bool
    status: str


class LoadDemoResponse(BaseModel):
    household_id: str
    documents: list[SessionDocument]
    next_action: str = "extract_documents"


class ExtractionResponse(BaseModel):
    fields: list[ExtractedField]
    next_action: str = "review_profile"
