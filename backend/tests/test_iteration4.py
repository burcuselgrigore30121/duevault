"""Iteration 4 backend tests - Dashboard contract + test-reminder endpoint."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_API_URL", os.environ.get("API_URL", "http://localhost:8000")).rstrip("/")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "demo@duevault.com", "password": "demo123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_dashboard_contract(headers):
    """/api/dashboard returns summary, needs_attention, all_items."""
    r = requests.get(f"{BASE_URL}/api/dashboard", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "summary" in data
    assert "needs_attention" in data
    assert "all_items" in data
    s = data["summary"]
    # All 5 segment keys must exist
    for k in ["total_active", "expiring_soon", "critical", "expired", "upcoming_payments"]:
        assert k in s, f"Missing summary key: {k}"
        assert isinstance(s[k], int)
    assert isinstance(data["all_items"], list)


def test_items_returned_have_required_fields(headers):
    r = requests.get(f"{BASE_URL}/api/dashboard", headers=headers)
    items = r.json()["all_items"]
    assert len(items) > 0, "Demo seed should contain items"
    sample = items[0]
    for f in ["id", "title", "status", "item_type", "days_remaining"]:
        assert f in sample, f"Missing field {f} in item"


def test_email_test_reminder_request_contract(headers):
    """POST /api/email/test-reminder accepts {item_id, recipient_email}.
    If RESEND_API_KEY is not configured -> 503. Otherwise success or 500 (provider err)."""
    d = requests.get(f"{BASE_URL}/api/dashboard", headers=headers).json()
    item_id = d["all_items"][0]["id"]

    r = requests.post(f"{BASE_URL}/api/email/test-reminder",
                      headers=headers,
                      json={"item_id": item_id, "recipient_email": "demo@duevault.com"})
    # Must NOT be 422 (validation error) - schema must be accepted
    assert r.status_code != 422, f"Schema mismatch: {r.text}"
    assert r.status_code in (200, 500, 503), f"Unexpected status: {r.status_code} {r.text}"


def test_email_test_reminder_bad_item(headers):
    """Unknown item_id should yield 404 (or 503 if email not configured)."""
    r = requests.post(f"{BASE_URL}/api/email/test-reminder",
                      headers=headers,
                      json={"item_id": "non-existent-xyz", "recipient_email": "x@y.com"})
    # 503 (no key) is checked first in code → both acceptable.
    assert r.status_code in (404, 503), r.text


def test_item_delete_then_404(headers):
    """Create -> delete -> GET returns 404 (used by dashboard delete action)."""
    create = requests.post(f"{BASE_URL}/api/items", headers=headers, json={
        "title": "TEST_iter4_delete",
        "item_type": "subscription",
        "category": "other",
        "expiration_date": "2099-01-01",
    })
    assert create.status_code in (200, 201), create.text
    item_id = create.json()["id"]

    d = requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=headers)
    assert d.status_code in (200, 204), d.text

    g = requests.get(f"{BASE_URL}/api/items/{item_id}", headers=headers)
    assert g.status_code == 404


def test_email_status(headers):
    r = requests.get(f"{BASE_URL}/api/email/status", headers=headers)
    assert r.status_code == 200
    assert "configured" in r.json()
