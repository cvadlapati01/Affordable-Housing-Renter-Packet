from pydantic import BaseModel, Field


class DemoDocument(BaseModel):
    document_id: str
    document_type: str
    file_name: str
    rasterized: bool
    contains_adversarial_text: bool


class DemoHousehold(BaseModel):
    household_id: str
    display_name: str
    scenario: str
    household_size: int = Field(ge=1, le=8)
    document_count: int


class DemoHouseholdDetail(DemoHousehold):
    documents: list[DemoDocument]
