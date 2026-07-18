from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_lists_all_six_demo_households() -> None:
    response = client.get("/api/v1/demo-households")
    assert response.status_code == 200
    households = response.json()
    assert len(households) == 6
    assert households[1]["household_id"] == "HH-002"
    assert "expected_readiness_status" not in households[1]


def test_household_has_four_documents() -> None:
    response = client.get("/api/v1/demo-households/HH-002/documents")
    assert response.status_code == 200
    assert len(response.json()["documents"]) == 4


def test_create_and_delete_session() -> None:
    created = client.post("/api/v1/sessions", json={"demo_household_id": "HH-002", "consent": True})
    assert created.status_code == 201
    payload = created.json()
    headers = {"X-Session-Token": payload["session_token"]}
    assert client.get(f"/api/v1/sessions/{payload['session_id']}", headers=headers).status_code == 200
    assert client.delete(f"/api/v1/sessions/{payload['session_id']}", headers=headers).status_code == 204
    assert client.get(f"/api/v1/sessions/{payload['session_id']}", headers=headers).status_code == 401


def test_consent_is_required() -> None:
    response = client.post("/api/v1/sessions", json={"demo_household_id": "HH-002", "consent": False})
    assert response.status_code == 422


def test_demo_load_and_extract_only_allowlisted_fields() -> None:
    created = client.post("/api/v1/sessions", json={"demo_household_id": "HH-002", "consent": True}).json()
    headers = {"X-Session-Token": created["session_token"]}
    session_id = created["session_id"]
    loaded = client.post(f"/api/v1/sessions/{session_id}/documents/load-demo", headers=headers)
    assert loaded.status_code == 200
    assert len(loaded.json()["documents"]) == 4
    extracted = client.post(f"/api/v1/sessions/{session_id}/documents/extract", headers=headers)
    assert extracted.status_code == 200
    names = {field["name"] for field in extracted.json()["fields"]}
    assert "untrusted_instruction_text" not in names
    assert "gross_pay" in names


def test_renter_can_correct_and_confirm_profile_fields() -> None:
    created = client.post("/api/v1/sessions", json={"demo_household_id": "HH-002", "consent": True}).json()
    headers = {"X-Session-Token": created["session_token"]}
    session_id = created["session_id"]
    client.post(f"/api/v1/sessions/{session_id}/documents/load-demo", headers=headers)
    client.post(f"/api/v1/sessions/{session_id}/documents/extract", headers=headers)
    profile = client.get(f"/api/v1/sessions/{session_id}/profile", headers=headers).json()
    household_size = next(field for field in profile["fields"] if field["name"] == "household_size")
    corrected = client.patch(
        f"/api/v1/sessions/{session_id}/profile/fields/{household_size['field_id']}",
        headers=headers,
        json={"value": 2, "reason": "Confirmed from application summary"},
    )
    assert corrected.status_code == 200
    assert corrected.json()["state"] == "corrected"
    remaining_ids = [field["field_id"] for field in profile["fields"] if field["field_id"] != household_size["field_id"]]
    confirmed = client.post(f"/api/v1/sessions/{session_id}/profile/confirm", headers=headers, json={"field_ids": remaining_ids})
    assert confirmed.status_code == 200
    final_profile = client.get(f"/api/v1/sessions/{session_id}/profile", headers=headers)
    assert final_profile.json()["confirmation_complete"] is True


def test_hh002_has_a_non_decision_end_to_end_result() -> None:
    created = client.post("/api/v1/sessions", json={"demo_household_id": "HH-002", "consent": True}).json()
    headers = {"X-Session-Token": created["session_token"]}
    session_id = created["session_id"]
    client.post(f"/api/v1/sessions/{session_id}/documents/load-demo", headers=headers)
    client.post(f"/api/v1/sessions/{session_id}/documents/extract", headers=headers)
    profile = client.get(f"/api/v1/sessions/{session_id}/profile", headers=headers).json()
    client.post(f"/api/v1/sessions/{session_id}/profile/confirm", headers=headers, json={"field_ids": [field["field_id"] for field in profile["fields"]]})
    calculation = client.post(f"/api/v1/sessions/{session_id}/calculation", headers=headers).json()
    assert calculation["annualized_income"] == 49920.0
    assert calculation["threshold"] == 82320.0
    assert calculation["comparison"] == "below_or_equal"
    readiness = client.post(f"/api/v1/sessions/{session_id}/readiness/evaluate", headers=headers).json()
    assert readiness["status"] == "NEEDS_REVIEW"
    assert readiness["reason_codes"] == ["PAY_STUB_TOTAL_CONFLICT"]
    packet = client.post(f"/api/v1/sessions/{session_id}/packets", headers=headers)
    assert packet.status_code == 200
    assert "eligibility determination" in packet.json()["disclaimer"]
