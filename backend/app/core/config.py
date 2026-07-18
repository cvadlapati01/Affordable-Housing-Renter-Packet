import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
STARTER_PACK_DIR = PROJECT_DIR / "realdoor-hackathon-starter-pack"
DEMO_MANIFEST_PATH = BACKEND_DIR / "data" / "demo_documents.csv"
GOLD_DOCUMENTS_PATH = STARTER_PACK_DIR / "synthetic_documents" / "gold" / "document_gold.jsonl"
SOURCE_DOCUMENTS_DIR = STARTER_PACK_DIR / "synthetic_documents" / "documents"

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://id-preview--d08fe862-27c6-4ca7-aa20-a6498a06229f.lovable.app",
]


def _allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS")
    if not configured:
        return DEFAULT_ALLOWED_ORIGINS
    return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]


# Keep this an explicit allowlist. Never use a wildcard with session tokens.
ALLOWED_ORIGINS = _allowed_origins()
