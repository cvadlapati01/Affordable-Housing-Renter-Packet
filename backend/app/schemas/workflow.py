from pydantic import BaseModel

from app.schemas.profile import ProfileField


class Citation(BaseModel):
    rule_id: str
    effective_date: str
    source_url: str
    source_locator: str


class CalculationResponse(BaseModel):
    annualized_income: float
    threshold: float
    comparison: str
    formula: str
    effective_date: str
    citations: list[Citation]
    decision_boundary: str


class ReadinessReason(BaseModel):
    code: str
    message: str


class ReadinessResponse(BaseModel):
    status: str
    reason_codes: list[str]
    reasons: list[ReadinessReason]
    decision_boundary: str


class PacketResponse(BaseModel):
    packet_id: str
    profile: list[ProfileField]
    calculation: CalculationResponse
    readiness: ReadinessResponse
    disclaimer: str
