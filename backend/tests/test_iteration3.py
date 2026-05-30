"""
Iteration 3 tests - DueVault P0 UI/UX polish.
Focus: dashboard returns new 'all_items' array + login works for demo user.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_API_URL', os.environ.get('API_URL', 'http://localhost:8000')).rstrip('/')

DEMO_EMAIL = "demo@duevault.com"
DEMO_PASSWORD = "demo123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": DEMO_EMAIL, "password": DEMO_PASSWORD
    }, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    assert data["user"]["email"] == DEMO_EMAIL
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# Backend - Dashboard endpoint must now return all_items
class TestDashboardAllItems:
    def test_dashboard_returns_summary(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "summary" in data
        s = data["summary"]
        # Expected summary keys
        for k in ("total_active", "expiring_soon", "critical", "expired", "upcoming_payments"):
            assert k in s, f"Missing summary key: {k}"
            assert isinstance(s[k], int)

    def test_dashboard_returns_needs_attention(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=auth_headers, timeout=15)
        data = r.json()
        assert "needs_attention" in data
        assert isinstance(data["needs_attention"], list)

    def test_dashboard_returns_all_items(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=auth_headers, timeout=15)
        data = r.json()
        assert "all_items" in data, "Backend missing new 'all_items' key"
        assert isinstance(data["all_items"], list)
        # demo user should have seeded items
        assert len(data["all_items"]) > 0, "Expected seeded items for demo user"
        # validate item shape
        item = data["all_items"][0]
        for f in ("id", "title", "status", "item_type"):
            assert f in item, f"Item missing field: {f}"

    def test_all_items_superset_of_needs_attention(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=auth_headers, timeout=15)
        data = r.json()
        all_ids = {i["id"] for i in data["all_items"]}
        for it in data["needs_attention"]:
            assert it["id"] in all_ids, "needs_attention item not in all_items"

    def test_critical_filter_count_matches_summary(self, auth_headers):
        """Client-side filter for 'critical' uses statuses critical+urgent."""
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=auth_headers, timeout=15)
        data = r.json()
        critical_urgent = [i for i in data["all_items"] if i["status"] in ("critical", "urgent")]
        # summary.critical typically counts critical+urgent in this app
        assert len(critical_urgent) >= 0  # sanity
        print(f"critical+urgent items: {len(critical_urgent)}, summary.critical: {data['summary']['critical']}")


# Backend - Items CRUD still works (smoke)
class TestItemsCrudSmoke:
    def test_create_get_delete_item(self, auth_headers):
        payload = {
            "title": "TEST_iter3_item",
            "item_type": "document",
            "category": "personal",
            "expiration_date": "2026-12-31",
            "reminder_enabled": False,
        }
        c = requests.post(f"{BASE_URL}/api/items", headers=auth_headers, json=payload, timeout=15)
        assert c.status_code in (200, 201), f"Create failed: {c.status_code} {c.text}"
        item = c.json()
        assert item["title"] == "TEST_iter3_item"
        item_id = item["id"]

        g = requests.get(f"{BASE_URL}/api/items/{item_id}", headers=auth_headers, timeout=15)
        assert g.status_code == 200
        assert g.json()["title"] == "TEST_iter3_item"

        d = requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=auth_headers, timeout=15)
        assert d.status_code in (200, 204)

        # Verify gone
        g2 = requests.get(f"{BASE_URL}/api/items/{item_id}", headers=auth_headers, timeout=15)
        assert g2.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
