import csv
from collections import defaultdict

from app.core.config import DEMO_MANIFEST_PATH
from app.schemas.demo import DemoDocument, DemoHousehold, DemoHouseholdDetail


def _read_manifest() -> list[dict[str, str]]:
    with DEMO_MANIFEST_PATH.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def list_households() -> list[DemoHousehold]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in _read_manifest():
        grouped[row["household_id"]].append(row)

    return [
        DemoHousehold(
            household_id=household_id,
            display_name=rows[0]["demo_name"],
            scenario=rows[0]["scenario"],
            household_size=int(rows[0]["household_size"]),
            document_count=len(rows),
        )
        for household_id, rows in sorted(grouped.items())
    ]


def get_household(household_id: str) -> DemoHouseholdDetail | None:
    rows = [row for row in _read_manifest() if row["household_id"] == household_id]
    if not rows:
        return None
    first = rows[0]
    return DemoHouseholdDetail(
        household_id=household_id,
        display_name=first["demo_name"],
        scenario=first["scenario"],
        household_size=int(first["household_size"]),
        document_count=len(rows),
        documents=[
            DemoDocument(
                document_id=row["document_id"],
                document_type=row["document_type"],
                file_name=row["file_name"],
                rasterized=row["rasterized"].lower() == "true",
                contains_adversarial_text=row["contains_adversarial_text"].lower() == "true",
            )
            for row in rows
        ],
    )
