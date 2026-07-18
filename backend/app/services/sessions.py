from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from uuid import uuid4


SESSION_TTL_HOURS = 4


@dataclass
class SessionRecord:
    session_id: str
    token: str
    demo_household_id: str
    created_at: datetime
    expires_at: datetime
    status: str = "active"
    demo_loaded: bool = False
    extracted_fields: list[dict] | None = None


class SessionStore:
    """In-memory store for Phase 1. It will be replaced by SQLite persistence."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionRecord] = {}

    def create(self, demo_household_id: str) -> SessionRecord:
        now = datetime.now(UTC)
        record = SessionRecord(
            session_id=str(uuid4()),
            token=token_urlsafe(32),
            demo_household_id=demo_household_id,
            created_at=now,
            expires_at=now + timedelta(hours=SESSION_TTL_HOURS),
        )
        self._sessions[record.session_id] = record
        return record

    def get(self, session_id: str, token: str) -> SessionRecord | None:
        record = self._sessions.get(session_id)
        if record is None or record.token != token or record.expires_at <= datetime.now(UTC):
            return None
        return record

    def delete(self, session_id: str, token: str) -> bool:
        if self.get(session_id, token) is None:
            return False
        del self._sessions[session_id]
        return True


session_store = SessionStore()
