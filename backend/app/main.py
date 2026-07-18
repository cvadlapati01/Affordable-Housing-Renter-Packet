from fastapi import FastAPI, Header, HTTPException, Response, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import ALLOWED_ORIGINS
from app.schemas.demo import DemoHousehold, DemoHouseholdDetail
from app.schemas.session import CreateSessionRequest, CreateSessionResponse, SessionProgress
from app.schemas.document import ExtractionResponse, LoadDemoResponse, SessionDocument
from app.schemas.profile import ConfirmFieldsRequest, CorrectFieldRequest, ProfileField, ProfileResponse
from app.schemas.workflow import CalculationResponse, PacketResponse, ReadinessResponse
from app.services.assessment import assess_readiness, calculate, packet_id
from app.services.fixtures import get_household, list_households
from app.services.profile import confirm_fields, correct_field, is_confirmation_complete, profile_fields
from app.services.sessions import SessionRecord, session_store
from app.services.workflow import extract_fixture_fields, load_demo_documents, source_document_path


app = FastAPI(title="RealDoor API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Session-Token"],
)


def require_session(session_id: str, token: str | None) -> SessionRecord:
    record = session_store.get(session_id, token or "")
    if record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")
    return record


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/demo-households", response_model=list[DemoHousehold])
def demo_households() -> list[DemoHousehold]:
    return list_households()


@app.get("/api/v1/demo-households/{household_id}/documents", response_model=DemoHouseholdDetail)
def demo_household_documents(household_id: str) -> DemoHouseholdDetail:
    household = get_household(household_id)
    if household is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo household not found.")
    return household


@app.post("/api/v1/sessions", response_model=CreateSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(request: CreateSessionRequest) -> CreateSessionResponse:
    if not request.consent:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Consent is required to start a session.")
    if get_household(request.demo_household_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo household not found.")
    record = session_store.create(request.demo_household_id)
    return CreateSessionResponse(
        session_id=record.session_id,
        session_token=record.token,
        expires_at=record.expires_at,
    )


@app.get("/api/v1/sessions/{session_id}", response_model=SessionProgress)
def get_session(session_id: str, x_session_token: str | None = Header(default=None)) -> SessionProgress:
    record = require_session(session_id, x_session_token)
    return SessionProgress(
        session_id=record.session_id,
        demo_household_id=record.demo_household_id,
        status=record.status,
        created_at=record.created_at,
        expires_at=record.expires_at,
        next_action="extract_documents" if record.demo_loaded else "load_demo_documents",
    )


@app.delete("/api/v1/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, x_session_token: str | None = Header(default=None)) -> Response:
    if not session_store.delete(session_id, x_session_token or ""):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/v1/sessions/{session_id}/documents/load-demo", response_model=LoadDemoResponse)
def load_demo(
    session_id: str,
    x_session_token: str | None = Header(default=None),
) -> LoadDemoResponse:
    record = require_session(session_id, x_session_token)
    documents = load_demo_documents(record.demo_household_id)
    record.demo_loaded = True
    return LoadDemoResponse(household_id=record.demo_household_id, documents=documents)


@app.get("/api/v1/sessions/{session_id}/documents", response_model=list[SessionDocument])
def session_documents(session_id: str, x_session_token: str | None = Header(default=None)) -> list[SessionDocument]:
    record = require_session(session_id, x_session_token)
    if not record.demo_loaded:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Load demo documents before viewing them.")
    return load_demo_documents(record.demo_household_id)


@app.get("/api/v1/sessions/{session_id}/documents/{document_id}/file")
def download_document(
    session_id: str,
    document_id: str,
    x_session_token: str | None = Header(default=None),
) -> FileResponse:
    record = require_session(session_id, x_session_token)
    household = get_household(record.demo_household_id)
    document = next((item for item in (household.documents if household else []) if item.document_id == document_id), None)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in this session.")
    path = source_document_path(document.file_name)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Synthetic document file is unavailable.")
    return FileResponse(path, media_type="application/pdf", filename=document.file_name)


@app.post("/api/v1/sessions/{session_id}/documents/extract", response_model=ExtractionResponse)
def extract_documents(session_id: str, x_session_token: str | None = Header(default=None)) -> ExtractionResponse:
    record = require_session(session_id, x_session_token)
    if not record.demo_loaded:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Load demo documents before extraction.")
    fields = extract_fixture_fields(record.demo_household_id)
    record.extracted_fields = [
        {
            "field_id": field.field_id,
            "name": field.name,
            "extracted_value": field.value,
            "confirmed_value": None,
            "confidence": field.confidence,
            "state": field.state,
            "correction_reason": None,
            "evidence": [evidence.model_dump() for evidence in field.evidence],
        }
        for field in fields
    ]
    return ExtractionResponse(fields=fields)


@app.get("/api/v1/sessions/{session_id}/profile", response_model=ProfileResponse)
def get_profile(session_id: str, x_session_token: str | None = Header(default=None)) -> ProfileResponse:
    record = require_session(session_id, x_session_token)
    try:
        fields = profile_fields(record)
        complete = is_confirmation_complete(record)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    return ProfileResponse(
        fields=fields,
        confirmation_complete=complete,
        next_action="calculate" if complete else "confirm_or_correct_fields",
    )


@app.patch("/api/v1/sessions/{session_id}/profile/fields/{field_id}", response_model=ProfileField)
def update_profile_field(
    session_id: str,
    field_id: str,
    request: CorrectFieldRequest,
    x_session_token: str | None = Header(default=None),
) -> ProfileField:
    record = require_session(session_id, x_session_token)
    try:
        field = correct_field(record, field_id, request.value, request.reason)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if field is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile field not found.")
    return field


@app.post("/api/v1/sessions/{session_id}/profile/confirm", response_model=list[ProfileField])
def confirm_profile_fields(
    session_id: str,
    request: ConfirmFieldsRequest,
    x_session_token: str | None = Header(default=None),
) -> list[ProfileField]:
    record = require_session(session_id, x_session_token)
    try:
        fields = confirm_fields(record, request.field_ids)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    if fields is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more profile fields were not found.")
    return fields


@app.post("/api/v1/sessions/{session_id}/calculation", response_model=CalculationResponse)
def calculate_income(session_id: str, x_session_token: str | None = Header(default=None)) -> CalculationResponse:
    record = require_session(session_id, x_session_token)
    try:
        return calculate(record)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@app.post("/api/v1/sessions/{session_id}/readiness/evaluate", response_model=ReadinessResponse)
def evaluate_readiness(session_id: str, x_session_token: str | None = Header(default=None)) -> ReadinessResponse:
    record = require_session(session_id, x_session_token)
    try:
        return assess_readiness(record)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@app.post("/api/v1/sessions/{session_id}/packets", response_model=PacketResponse)
def create_packet(session_id: str, x_session_token: str | None = Header(default=None)) -> PacketResponse:
    record = require_session(session_id, x_session_token)
    try:
        return PacketResponse(
            packet_id=packet_id(record),
            profile=profile_fields(record),
            calculation=calculate(record),
            readiness=assess_readiness(record),
            disclaimer="Prepared for qualified human review; not an eligibility determination.",
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
