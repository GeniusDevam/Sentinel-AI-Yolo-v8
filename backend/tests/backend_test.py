"""Sentinel AI backend regression test suite.

Runs against the public BASE_URL from REACT_APP_BACKEND_URL. Tests cover:
- Auth (login for admin/operator/viewer, /me, cookie + Bearer, 401 without token)
- Cameras CRUD + role restrictions (viewer 403, operator can't delete)
- Events (list, search, severity/type filter, delete, CSV export)
- Dashboard stats, Reports summary + PDF
- Settings GET/PUT
- Users list/patch/delete (admin-only)
- Detection uploads (image real YOLO, live simulate)
"""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://threat-detect-hub-12.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@sentinel.ai", "Admin@123")
OPERATOR = ("operator@sentinel.ai", "Operator@123")
VIEWER = ("viewer@sentinel.ai", "Viewer@123")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    body = r.json()
    return body["access_token"], body["user"], r.cookies


@pytest.fixture(scope="session")
def admin_token():
    tok, _, _ = _login(*ADMIN)
    return tok


@pytest.fixture(scope="session")
def operator_token():
    tok, _, _ = _login(*OPERATOR)
    return tok


@pytest.fixture(scope="session")
def viewer_token():
    tok, _, _ = _login(*VIEWER)
    return tok


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------- Auth ----------------------------
class TestAuth:
    def test_login_admin(self):
        tok, user, _ = _login(*ADMIN)
        assert user["role"] == "admin"
        assert user["email"] == ADMIN[0]
        assert isinstance(tok, str) and len(tok) > 20

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me_bearer(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN[0]

    def test_me_cookie(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=10)
        cookies = r.cookies
        r2 = requests.get(f"{API}/auth/me", cookies=cookies, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["role"] == "admin"

    def test_me_no_token_401(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# ---------------------------- Cameras ----------------------------
class TestCameras:
    def test_list_seeded(self, admin_token):
        r = requests.get(f"{API}/cameras", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 6

    def test_create_patch_reconnect_delete_admin(self, admin_token):
        # CREATE
        payload = {"name": "TEST_Camera_1", "location": "TEST_LOC", "source_type": "demo", "scene": "warehouse", "enabled": True}
        r = requests.post(f"{API}/cameras", json=payload, headers=_h(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        cam = r.json()
        cid = cam["id"]
        assert cam["name"] == "TEST_Camera_1"

        # PATCH rename + disable
        r = requests.patch(f"{API}/cameras/{cid}", json={"name": "TEST_Camera_1_ren", "enabled": False}, headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Camera_1_ren"
        assert r.json()["status"] == "offline"

        # Reconnect
        r = requests.post(f"{API}/cameras/{cid}/reconnect", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "online"

        # DELETE
        r = requests.delete(f"{API}/cameras/{cid}", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200

    def test_viewer_cannot_write(self, viewer_token):
        r = requests.post(f"{API}/cameras",
                          json={"name": "TEST_x", "location": "L", "source_type": "demo", "scene": "warehouse", "enabled": True},
                          headers=_h(viewer_token), timeout=10)
        assert r.status_code == 403

    def test_operator_can_create_but_not_delete(self, operator_token, admin_token):
        r = requests.post(f"{API}/cameras",
                          json={"name": "TEST_op_cam", "location": "L", "source_type": "demo", "scene": "warehouse", "enabled": True},
                          headers=_h(operator_token), timeout=10)
        assert r.status_code == 200
        cid = r.json()["id"]

        r = requests.delete(f"{API}/cameras/{cid}", headers=_h(operator_token), timeout=10)
        assert r.status_code == 403

        # admin cleanup
        requests.delete(f"{API}/cameras/{cid}", headers=_h(admin_token), timeout=10)


# ---------------------------- Events ----------------------------
class TestEvents:
    def test_list_events(self, admin_token):
        r = requests.get(f"{API}/events?limit=200", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and "total" in body
        assert body["total"] >= 100

    def test_search_and_filter(self, admin_token):
        r = requests.get(f"{API}/events?q=traffic", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        for it in items:
            hay = (it.get("camera_name", "") + it.get("detection_type", "")).lower()
            assert "traffic" in hay

        r = requests.get(f"{API}/events?severity=critical", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["severity"] == "critical"

    def test_delete_event(self, admin_token):
        # Create then delete
        r = requests.post(f"{API}/events",
                          json={"camera_id": None, "camera_name": "TEST_cam", "detection_type": "object_detection",
                                "confidence": 0.8, "severity": "info", "metadata": {}},
                          headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        eid = r.json()["id"]
        r = requests.delete(f"{API}/events/{eid}", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200

    def test_export_csv(self, admin_token):
        r = requests.get(f"{API}/events/export.csv", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert b"Timestamp" in r.content[:200]


# ---------------------------- Dashboard/Reports ----------------------------
class TestDashboardReports:
    def test_dashboard_stats(self, admin_token):
        r = requests.get(f"{API}/dashboard/stats", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_detections_today", "active_alerts", "active_cameras", "fps", "cpu_usage",
                  "inference_ms", "hourly_detections", "categories", "person_trend"]:
            assert k in d
        assert len(d["hourly_detections"]) == 24

    def test_reports_summary(self, admin_token):
        for p in ("daily", "weekly", "monthly"):
            r = requests.get(f"{API}/reports/summary?period={p}", headers=_h(admin_token), timeout=10)
            assert r.status_code == 200
            b = r.json()
            assert b["period"] == p
            assert "total_events" in b
            assert "camera_uptime" in b

    def test_report_pdf(self, admin_token):
        r = requests.get(f"{API}/reports/pdf?period=daily", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"


# ---------------------------- Settings ----------------------------
class TestSettings:
    def test_get_and_put(self, admin_token):
        r = requests.get(f"{API}/settings", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        current = r.json()
        # PUT with same schema
        payload = {
            "confidence_threshold": 0.42, "iou_threshold": 0.5, "max_people_threshold": 8,
            "alarm_volume": 70, "frame_skip": 2, "abandoned_object_seconds": 30,
            "detection_classes": ["person", "car"], "processing_resolution": "720p",
        }
        r = requests.put(f"{API}/settings", json=payload, headers=_h(admin_token), timeout=10)
        assert r.status_code == 200, r.text
        got = r.json()
        assert abs(got["confidence_threshold"] - 0.42) < 1e-6
        assert got["processing_resolution"] == "720p"

    def test_viewer_cannot_put(self, viewer_token):
        r = requests.put(f"{API}/settings",
                         json={"confidence_threshold": 0.5, "iou_threshold": 0.5, "max_people_threshold": 5,
                               "alarm_volume": 50, "frame_skip": 1, "abandoned_object_seconds": 20,
                               "detection_classes": ["person"], "processing_resolution": "720p"},
                         headers=_h(viewer_token), timeout=10)
        assert r.status_code == 403


# ---------------------------- Users ----------------------------
class TestUsers:
    def test_admin_list_users(self, admin_token):
        r = requests.get(f"{API}/users", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        emails = {u["email"] for u in users}
        assert {ADMIN[0], OPERATOR[0], VIEWER[0]}.issubset(emails)

    def test_viewer_cannot_list(self, viewer_token):
        r = requests.get(f"{API}/users", headers=_h(viewer_token), timeout=10)
        assert r.status_code == 403

    def test_admin_create_patch_delete_user(self, admin_token):
        # Register creates a user (also logs them in - side effect)
        email = f"TEST_user_{int(time.time())}@sentinel.ai"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TempPass@123", "name": "TEST User", "role": "viewer"
        }, timeout=10)
        assert r.status_code == 200
        uid = r.json()["user"]["id"]

        # Admin patch role
        r = requests.patch(f"{API}/users/{uid}", json={"role": "operator"}, headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "operator"

        # Admin delete
        r = requests.delete(f"{API}/users/{uid}", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200


# ---------------------------- Detection ----------------------------
class TestDetection:
    def _make_jpg(self):
        # Simple 100x100 solid image via PIL
        try:
            from PIL import Image
        except Exception:
            pytest.skip("Pillow not available")
        img = Image.new("RGB", (100, 100), color=(100, 120, 140))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        return buf

    def test_detect_image(self, admin_token):
        buf = self._make_jpg()
        r = requests.post(
            f"{API}/detect/image",
            files={"file": ("test.jpg", buf.getvalue(), "image/jpeg")},
            data={"confidence": "0.35", "iou": "0.45"},
            headers=_h(admin_token),
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "annotated_image" in body
        assert "detections" in body

    def test_live_simulate(self, admin_token):
        cams = requests.get(f"{API}/cameras", headers=_h(admin_token), timeout=10).json()
        assert cams
        cid = cams[0]["id"]
        r = requests.get(f"{API}/live/simulate/{cid}", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "detections" in body
        assert "counts" in body
