"""Tests for 4 new features: Profile/Settings, Scheduler, Search, File Upload"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_API_URL', os.environ.get('API_URL', '')).rstrip('/')

@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@duevault.com", "password": "demo123"})
    assert r.status_code == 200
    return r.json()["token"]

@pytest.fixture(scope="module")
def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s

# ── Profile / Settings ────────────────────────────────────────────────────────

def test_get_me(auth):
    r = auth.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    data = r.json()
    assert "full_name" in data
    assert data["email"] == "demo@duevault.com"
    print(f"PASS: /auth/me → {data['full_name']}")

def test_update_profile(auth):
    r = auth.put(f"{BASE_URL}/api/auth/profile", json={"full_name": "Alex Morgan", "notification_email": "demo@duevault.com"})
    assert r.status_code == 200
    data = r.json()
    assert data["full_name"] == "Alex Morgan"
    print("PASS: PUT /auth/profile → 200")

def test_change_password(auth, token):
    # Change to new password
    r = auth.put(f"{BASE_URL}/api/auth/change-password", json={"old_password": "demo123", "new_password": "demo123new"})
    assert r.status_code == 200
    print("PASS: change-password → 200")
    # Change back
    r2 = auth.put(f"{BASE_URL}/api/auth/change-password", json={"old_password": "demo123new", "new_password": "demo123"})
    assert r2.status_code == 200
    print("PASS: change-password back → 200")

def test_change_password_wrong_old(auth):
    r = auth.put(f"{BASE_URL}/api/auth/change-password", json={"old_password": "wrongpass", "new_password": "newpass123"})
    assert r.status_code == 400
    print("PASS: wrong old password → 400")

# ── Scheduler status ──────────────────────────────────────────────────────────

def test_scheduler_status(auth):
    r = auth.get(f"{BASE_URL}/api/scheduler/status")
    assert r.status_code == 200
    data = r.json()
    assert data["active"] == True
    assert "email_configured" in data
    assert "next_run" in data
    print(f"PASS: scheduler/status → active={data['active']}, email={data['email_configured']}, next_run={data['next_run']}")

# ── Global Search ─────────────────────────────────────────────────────────────

def test_search_bmw(auth):
    r = auth.get(f"{BASE_URL}/api/search?q=BMW")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data and "vehicles" in data
    total = len(data["items"]) + len(data["vehicles"])
    assert total > 0
    # Should find BMW vehicle
    v_names = [v["name"] for v in data["vehicles"]]
    print(f"PASS: search BMW → {len(data['items'])} items, {len(data['vehicles'])} vehicles: {v_names}")

def test_search_passport(auth):
    r = auth.get(f"{BASE_URL}/api/search?q=passport")
    assert r.status_code == 200
    data = r.json()
    titles = [i["title"] for i in data["items"]]
    assert any("Passport" in t for t in titles)
    print(f"PASS: search passport → {titles}")

def test_search_dacia(auth):
    r = auth.get(f"{BASE_URL}/api/search?q=dacia")
    assert r.status_code == 200
    data = r.json()
    total = len(data["items"]) + len(data["vehicles"])
    assert total > 0
    print(f"PASS: search dacia → {len(data['items'])} items, {len(data['vehicles'])} vehicles")

def test_search_short_query(auth):
    r = auth.get(f"{BASE_URL}/api/search?q=a")
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == [] and data["vehicles"] == []
    print("PASS: short query returns empty")

# ── File Upload / Download ─────────────────────────────────────────────────────

def get_first_item_id(auth):
    r = auth.get(f"{BASE_URL}/api/items")
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    return items[0]["id"]

def test_file_upload(auth):
    iid = get_first_item_id(auth)
    # Create a small PNG in memory (1x1 pixel PNG)
    import io
    png = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
           b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
           b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
           b'\xd8N\x00\x00\x00\x00IEND\xaeB`\x82')
    files = {"file": ("test_doc.png", io.BytesIO(png), "image/png")}
    headers = {"Authorization": f"Bearer {auth.headers['Authorization'].split(' ')[1]}"}
    r = requests.post(f"{BASE_URL}/api/items/{iid}/upload", files=files, headers=headers)
    if r.status_code == 503:
        pytest.skip("File storage not configured")
    assert r.status_code == 200
    data = r.json()
    assert "file_path" in data
    print(f"PASS: file upload → {data['file_path']}")
    return iid

def test_file_download(auth):
    iid = get_first_item_id(auth)
    # Upload first
    import io
    png = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
           b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
           b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
           b'\xd8N\x00\x00\x00\x00IEND\xaeB`\x82')
    files = {"file": ("test_doc.png", io.BytesIO(png), "image/png")}
    headers = {"Authorization": f"Bearer {auth.headers['Authorization'].split(' ')[1]}"}
    up = requests.post(f"{BASE_URL}/api/items/{iid}/upload", files=files, headers=headers)
    if up.status_code == 503:
        pytest.skip("File storage not configured")
    assert up.status_code == 200

    r = auth.get(f"{BASE_URL}/api/items/{iid}/file")
    assert r.status_code == 200
    assert len(r.content) > 0
    print(f"PASS: file download → {len(r.content)} bytes, ct={r.headers.get('content-type')}")

def test_file_remove(auth):
    iid = get_first_item_id(auth)
    r = auth.delete(f"{BASE_URL}/api/items/{iid}/file")
    assert r.status_code == 200
    print("PASS: file remove → 200")
    # Verify file gone
    r2 = auth.get(f"{BASE_URL}/api/items/{iid}/file")
    assert r2.status_code == 404
    print("PASS: file gone after remove → 404")

def test_file_upload_invalid_type(auth):
    iid = get_first_item_id(auth)
    import io
    files = {"file": ("malware.exe", io.BytesIO(b"bad content"), "application/octet-stream")}
    headers = {"Authorization": f"Bearer {auth.headers['Authorization'].split(' ')[1]}"}
    r = requests.post(f"{BASE_URL}/api/items/{iid}/upload", files=files, headers=headers)
    if r.status_code == 503:
        pytest.skip("Storage not configured")
    assert r.status_code == 400
    print("PASS: invalid file type → 400")
