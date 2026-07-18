from datetime import datetime
from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    demo_household_id: str = Field(pattern=r"^HH-00[1-6]$")
    consent: bool


class CreateSessionResponse(BaseModel):
    session_id: str
    session_token: str
    expires_at: datetime
    next_action: str = "load_demo_documents"


class SessionProgress(BaseModel):
    session_id: str
    demo_household_id: str
    status: str
    created_at: datetime
    expires_at: datetime
    next_action: str
