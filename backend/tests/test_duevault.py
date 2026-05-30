"""DueVault backend API tests - auth, vehicles, items, dashboard, renewals"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_API_URL', os.environ.get('API_URL', '')).rstrip('/')

@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@duevault.com", "password": "demo123"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}

# --- Auth Tests ---
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@duevault.com", "password": "demo123"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == "demo@duevault.com"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@duevault.com", "password": "wrong"})
        assert r.status_code == 401

    def test_register_duplicate(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"full_name": "Test", "email": "demo@duevault.com", "password": "test123"})
        assert r.status_code == 400

    def test_me(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "demo@duevault.com"

    def test_me_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

# --- Vehicles ---
class TestVehicles:
    def test_list_vehicles(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers)
        assert r.status_code == 200
        vehicles = r.json()
        assert isinstance(vehicles, list)
        brands = [v["brand"] for v in vehicles]
        assert "BMW" in brands
        assert "Dacia" in brands

    def test_create_and_delete_vehicle(self, auth_headers):
        payload = {"name": "TEST_Car", "brand": "Toyota", "model": "Corolla", "license_plate": "TEST-001", "notes": "test"}
        r = requests.post(f"{BASE_URL}/api/vehicles", json=payload, headers=auth_headers)
        assert r.status_code == 200
        vid = r.json()["id"]
        # verify
        r2 = requests.get(f"{BASE_URL}/api/vehicles/{vid}", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["brand"] == "Toyota"
        # delete
        r3 = requests.delete(f"{BASE_URL}/api/vehicles/{vid}", headers=auth_headers)
        assert r3.status_code == 200
        # verify deleted
        r4 = requests.get(f"{BASE_URL}/api/vehicles/{vid}", headers=auth_headers)
        assert r4.status_code == 404

# --- Items ---
class TestItems:
    def test_list_items(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 13
        # check enriched fields
        assert "status" in items[0]
        assert "days_remaining" in items[0]

    def test_create_and_delete_item(self, auth_headers):
        payload = {
            "title": "TEST_Item", "item_type": "personal_document", "category": "passport",
            "expiration_date": "2026-12-31"
        }
        r = requests.post(f"{BASE_URL}/api/items", json=payload, headers=auth_headers)
        assert r.status_code == 200
        iid = r.json()["id"]
        # verify
        r2 = requests.get(f"{BASE_URL}/api/items/{iid}", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["title"] == "TEST_Item"
        # delete
        r3 = requests.delete(f"{BASE_URL}/api/items/{iid}", headers=auth_headers)
        assert r3.status_code == 200
        r4 = requests.get(f"{BASE_URL}/api/items/{iid}", headers=auth_headers)
        assert r4.status_code == 404

    def test_filter_items_by_type(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/items?item_type=payment", headers=auth_headers)
        assert r.status_code == 200
        for item in r.json():
            assert item["item_type"] == "payment"

# --- Dashboard ---
class TestDashboard:
    def test_dashboard(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "summary" in data
        assert "needs_attention" in data
        s = data["summary"]
        assert "total_active" in s
        assert "expiring_soon" in s
        assert "critical" in s
        assert "expired" in s

# --- Renewals ---
class TestRenewals:
    def test_renew_item(self, auth_headers):
        # get any item
        items = requests.get(f"{BASE_URL}/api/items", headers=auth_headers).json()
        iid = items[0]["id"]
        r = requests.post(f"{BASE_URL}/api/items/{iid}/renew",
                          json={"new_expiration_date": "2027-01-01", "notes": "test renewal"},
                          headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["new_expiration_date"] == "2027-01-01"

    def test_get_renewals(self, auth_headers):
        items = requests.get(f"{BASE_URL}/api/items", headers=auth_headers).json()
        iid = items[0]["id"]
        r = requests.get(f"{BASE_URL}/api/items/{iid}/renewals", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

# --- Email status ---
class TestEmail:
    def test_email_status(self):
        r = requests.get(f"{BASE_URL}/api/email/status")
        assert r.status_code == 200
        assert "configured" in r.json()
