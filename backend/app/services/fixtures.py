from app.schemas.demo import DemoDocument, DemoHousehold, DemoHouseholdDetail
from app.services.public_demo import list_public_households, public_household


def list_households() -> list[DemoHousehold]:
    return [
        DemoHousehold(
            household_id=item["household_id"],
            display_name=item["display_name"],
            scenario=item["scenario"],
            household_size=item["household_size"],
            document_count=len(item["documents"]),
        )
        for item in list_public_households()
    ]


def get_household(household_id: str) -> DemoHouseholdDetail | None:
    item = public_household(household_id)
    if item is None:
        return None
    return DemoHouseholdDetail(
        household_id=item["household_id"],
        display_name=item["display_name"],
        scenario=item["scenario"],
        household_size=item["household_size"],
        document_count=len(item["documents"]),
        documents=[
            DemoDocument(
                document_id=document["document_id"],
                document_type=document["document_type"],
                file_name=document["file_name"],
                rasterized=document["rasterized"],
                contains_adversarial_text=document["contains_adversarial_text"],
            )
            for document in item["documents"]
        ],
    )
