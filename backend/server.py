"""Sentinel AI - FastAPI backend main entrypoint."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from auth_utils import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, sanitize_user, get_jwt_secret,
    JWT_ALGORITHM,
)
import jwt as pyjwt
from schemas import (
    RegisterIn, LoginIn, CameraIn, CameraPatch, SettingsIn, EventCreate, UserPatch
)
from detection_service import (
    run_detection_on_image, run_detection_on_video, simulate_frame_detections,
)

# ------------------------------ Setup ------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("sentinel")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Sentinel AI", version="1.0.0")
api = APIRouter(prefix="/api")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return sanitize_user(user)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _doc_out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = _iso(v)
    return doc


# ------------------------------ Auth ------------------------------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "name": payload.name,
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    user_id = str(res.inserted_id)
    at = create_access_token(user_id, email, payload.role)
    rt = create_refresh_token(user_id)
    set_auth_cookies(response, at, rt)
    doc["_id"] = res.inserted_id
    return {"user": sanitize_user(doc), "access_token": at}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    at = create_access_token(user_id, email, user["role"])
    rt = create_refresh_token(user_id)
    set_auth_cookies(response, at, rt)
    return {"user": sanitize_user(user), "access_token": at}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(request: Request):
    return await get_current_user(request)


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        at = create_access_token(str(user["_id"]), user["email"], user["role"])
        response.set_cookie("access_token", at, httponly=True, secure=False, samesite="lax", max_age=43200, path="/")
        return {"ok": True}
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


# ------------------------------ Cameras ------------------------------
@api.get("/cameras")
async def list_cameras(user: dict = Depends(get_current_user)):
    items = await db.cameras.find({}).sort("created_at", 1).to_list(500)
    return [_doc_out(x) for x in items]


@api.post("/cameras")
async def create_camera(payload: CameraIn, user: dict = Depends(get_current_user)):
    if user["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot create cameras")
    doc = payload.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    doc["status"] = "online" if doc["enabled"] else "offline"
    doc["uptime_pct"] = round(random.uniform(96.0, 99.9), 2)
    res = await db.cameras.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _doc_out(doc)


@api.patch("/cameras/{camera_id}")
async def update_camera(camera_id: str, payload: CameraPatch, user: dict = Depends(get_current_user)):
    if user["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot update cameras")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "enabled" in update:
        update["status"] = "online" if update["enabled"] else "offline"
    if not update:
        raise HTTPException(400, "Nothing to update")
    r = await db.cameras.update_one({"_id": ObjectId(camera_id)}, {"$set": update})
    if not r.matched_count:
        raise HTTPException(404, "Camera not found")
    doc = await db.cameras.find_one({"_id": ObjectId(camera_id)})
    return _doc_out(doc)


@api.delete("/cameras/{camera_id}")
async def delete_camera(camera_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete cameras")
    r = await db.cameras.delete_one({"_id": ObjectId(camera_id)})
    if not r.deleted_count:
        raise HTTPException(404, "Camera not found")
    return {"ok": True}


@api.post("/cameras/{camera_id}/reconnect")
async def reconnect_camera(camera_id: str, user: dict = Depends(get_current_user)):
    await db.cameras.update_one({"_id": ObjectId(camera_id)}, {"$set": {"status": "online", "enabled": True}})
    doc = await db.cameras.find_one({"_id": ObjectId(camera_id)})
    if not doc:
        raise HTTPException(404, "Camera not found")
    return _doc_out(doc)


# ------------------------------ Detection uploads ------------------------------
@api.post("/detect/image")
async def detect_image(
    file: UploadFile = File(...),
    confidence: float = Form(0.35),
    iou: float = Form(0.45),
    user: dict = Depends(get_current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    try:
        result = run_detection_on_image(content, conf=confidence, iou=iou)
    except Exception as e:
        raise HTTPException(400, f"Detection failed: {e}")

    # Log high-count events
    await _log_upload_events(result["detections"], user, f"Upload:{file.filename}")
    return result


@api.post("/detect/video")
async def detect_video(
    file: UploadFile = File(...),
    confidence: float = Form(0.35),
    iou: float = Form(0.45),
    max_frames: int = Form(20),
    user: dict = Depends(get_current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    try:
        result = run_detection_on_video(content, conf=confidence, iou=iou, max_frames=max_frames)
    except Exception as e:
        raise HTTPException(400, f"Detection failed: {e}")

    # Log aggregated event
    all_dets = []
    for f in result["frames"]:
        all_dets.extend(f["detections"])
    await _log_upload_events(all_dets, user, f"Video:{file.filename}")
    return result


async def _log_upload_events(detections: list, user: dict, source: str):
    settings = await get_settings_doc()
    counts = {}
    for d in detections:
        counts[d["class_name"]] = counts.get(d["class_name"], 0) + 1
    events = []
    now = datetime.now(timezone.utc)
    if counts.get("person", 0) > settings["max_people_threshold"]:
        events.append({
            "camera_name": source, "detection_type": "crowd_detection",
            "confidence": 0.9, "severity": "critical", "metadata": {"people": counts["person"]},
            "created_at": now,
        })
    for cls in ("fire", "smoke"):
        if counts.get(cls, 0):
            events.append({
                "camera_name": source, "detection_type": f"{cls}_detection",
                "confidence": 0.85, "severity": "critical", "metadata": {"count": counts[cls]},
                "created_at": now,
            })
    if counts:
        events.append({
            "camera_name": source, "detection_type": "object_detection",
            "confidence": 0.8, "severity": "info", "metadata": {"counts": counts},
            "created_at": now,
        })
    if events:
        await db.events.insert_many(events)


# ------------------------------ Live simulate ------------------------------
@api.get("/live/simulate/{camera_id}")
async def live_simulate(camera_id: str, user: dict = Depends(get_current_user)):
    cam = await db.cameras.find_one({"_id": ObjectId(camera_id)})
    if not cam:
        raise HTTPException(404, "Camera not found")
    scene = cam.get("scene", "warehouse")
    settings = await get_settings_doc()
    result = simulate_frame_detections(scene=scene)
    # Randomly generate events
    counts = result["counts"]
    now = datetime.now(timezone.utc)
    if counts.get("person", 0) > settings["max_people_threshold"]:
        await db.events.insert_one({
            "camera_id": camera_id, "camera_name": cam["name"],
            "detection_type": "crowd_detection", "confidence": 0.92, "severity": "critical",
            "metadata": {"people": counts["person"]}, "created_at": now,
        })
    # 5% chance of intrusion
    if counts.get("person", 0) and random.random() < 0.05:
        await db.events.insert_one({
            "camera_id": camera_id, "camera_name": cam["name"],
            "detection_type": "intrusion", "confidence": 0.88, "severity": "critical",
            "metadata": {"zone": "Restricted A"}, "created_at": now,
        })
    return result


# ------------------------------ Events ------------------------------
@api.get("/events")
async def list_events(
    q: Optional[str] = None,
    severity: Optional[str] = None,
    detection_type: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(get_current_user),
):
    query = {}
    if severity:
        query["severity"] = severity
    if detection_type:
        query["detection_type"] = detection_type
    if q:
        query["$or"] = [
            {"camera_name": {"$regex": q, "$options": "i"}},
            {"detection_type": {"$regex": q, "$options": "i"}},
        ]
    total = await db.events.count_documents(query)
    items = await db.events.find(query).sort("created_at", -1).skip(skip).limit(min(limit, 500)).to_list(500)
    return {"total": total, "items": [_doc_out(x) for x in items]}


@api.post("/events")
async def create_event(payload: EventCreate, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    res = await db.events.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _doc_out(doc)


@api.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "viewer":
        raise HTTPException(403, "Not allowed")
    r = await db.events.delete_one({"_id": ObjectId(event_id)})
    if not r.deleted_count:
        raise HTTPException(404, "Event not found")
    return {"ok": True}


@api.get("/events/export.csv")
async def export_events_csv(user: dict = Depends(get_current_user)):
    items = await db.events.find({}).sort("created_at", -1).limit(5000).to_list(5000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Timestamp", "Camera", "Detection Type", "Confidence", "Severity", "Metadata"])
    for e in items:
        writer.writerow([
            _iso(e["created_at"]) if isinstance(e.get("created_at"), datetime) else e.get("created_at"),
            e.get("camera_name", ""),
            e.get("detection_type", ""),
            e.get("confidence", ""),
            e.get("severity", ""),
            str(e.get("metadata", {})),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=events.csv"},
    )


# ------------------------------ Settings ------------------------------
async def get_settings_doc() -> dict:
    doc = await db.settings.find_one({"_id": "global"})
    if not doc:
        default = SettingsIn().model_dump()
        default["_id"] = "global"
        await db.settings.insert_one(default)
        doc = default
    return doc


@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await get_settings_doc()
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


@api.put("/settings")
async def update_settings(payload: SettingsIn, user: dict = Depends(get_current_user)):
    if user["role"] == "viewer":
        raise HTTPException(403, "Not allowed")
    doc = payload.model_dump()
    await db.settings.update_one({"_id": "global"}, {"$set": doc}, upsert=True)
    return doc


# ------------------------------ Dashboard stats ------------------------------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    total_today = await db.events.count_documents({"created_at": {"$gte": start_of_day}})
    active_alerts = await db.events.count_documents({"severity": "critical", "created_at": {"$gte": now - timedelta(hours=6)}})
    active_cameras = await db.cameras.count_documents({"enabled": True})
    total_cameras = await db.cameras.count_documents({})

    # Hourly buckets last 24h
    hourly = [0] * 24
    events_24 = await db.events.find({"created_at": {"$gte": now - timedelta(hours=24)}}).to_list(5000)
    for e in events_24:
        dt = e.get("created_at")
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
                e["created_at"] = dt
            diff_h = int((now - dt).total_seconds() // 3600)
            if 0 <= diff_h < 24:
                hourly[23 - diff_h] += 1

    # Categories
    categories: dict = {}
    for e in events_24:
        categories[e.get("detection_type", "other")] = categories.get(e.get("detection_type", "other"), 0) + 1

    # Person trend last 12 hours (from simulated crowd events)
    person_trend = []
    for i in range(12):
        bucket_end = now - timedelta(hours=i)
        bucket_start = bucket_end - timedelta(hours=1)
        cnt = sum(1 for e in events_24 if isinstance(e.get("created_at"), datetime) and bucket_start <= e["created_at"] < bucket_end and e.get("detection_type") in ("object_detection", "crowd_detection"))
        person_trend.append({"hour": bucket_end.strftime("%H:00"), "count": cnt})
    person_trend.reverse()

    # System health (simulated)
    fps = round(random.uniform(24.0, 32.0), 1)
    cpu = round(random.uniform(28.0, 62.0), 1)
    inference_ms = random.randint(22, 48)

    return {
        "total_detections_today": total_today,
        "active_alerts": active_alerts,
        "active_cameras": active_cameras,
        "total_cameras": total_cameras,
        "system_status": "operational",
        "fps": fps,
        "cpu_usage": cpu,
        "inference_ms": inference_ms,
        "hourly_detections": [{"hour": f"{h:02d}:00", "count": hourly[h]} for h in range(24)],
        "categories": [{"name": k, "value": v} for k, v in categories.items()],
        "person_trend": person_trend,
    }


# ------------------------------ Reports ------------------------------
@api.get("/reports/summary")
async def reports_summary(period: str = "daily", user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    if period == "weekly":
        start = now - timedelta(days=7)
    elif period == "monthly":
        start = now - timedelta(days=30)
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    events = await db.events.find({"created_at": {"$gte": start}}).to_list(10000)
    total = len(events)
    critical = sum(1 for e in events if e.get("severity") == "critical")
    warnings = sum(1 for e in events if e.get("severity") == "warning")
    by_type: dict = {}
    for e in events:
        by_type[e.get("detection_type", "other")] = by_type.get(e.get("detection_type", "other"), 0) + 1
    cameras = await db.cameras.find({}).to_list(500)
    uptime = [{"name": c["name"], "uptime": c.get("uptime_pct", 99.0), "status": c.get("status", "offline")} for c in cameras]
    top_incidents = sorted(by_type.items(), key=lambda x: -x[1])[:5]
    return {
        "period": period,
        "period_start": _iso(start),
        "total_events": total,
        "critical_alerts": critical,
        "warnings": warnings,
        "by_type": [{"name": k, "value": v} for k, v in by_type.items()],
        "top_incidents": [{"name": k, "value": v} for k, v in top_incidents],
        "camera_uptime": uptime,
    }


@api.get("/reports/pdf")
async def report_pdf(period: str = "daily", user: dict = Depends(get_current_user)):
    summary = await reports_summary(period=period, user=user)
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], textColor=colors.HexColor("#111827"))
    story = [
        Paragraph(f"Sentinel AI &mdash; {period.title()} Report", title_style),
        Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]),
        Spacer(1, 0.5 * cm),
        Paragraph(f"<b>Total events:</b> {summary['total_events']}", styles["Normal"]),
        Paragraph(f"<b>Critical alerts:</b> {summary['critical_alerts']}", styles["Normal"]),
        Paragraph(f"<b>Warnings:</b> {summary['warnings']}", styles["Normal"]),
        Spacer(1, 0.4 * cm),
        Paragraph("<b>Top incidents</b>", styles["Heading2"]),
    ]
    t = Table([["Type", "Count"]] + [[x["name"], str(x["value"])] for x in summary["top_incidents"]] or [["No data", ""]], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                           ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                           ("GRID", (0, 0), (-1, -1), 0.25, colors.grey)]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("<b>Camera uptime</b>", styles["Heading2"]))
    ct = Table([["Camera", "Status", "Uptime %"]] + [[c["name"], c["status"], f"{c['uptime']:.2f}"] for c in summary["camera_uptime"]] or [["No cameras", "", ""]], hAlign="LEFT")
    ct.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey)]))
    story.append(ct)
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=sentinel_{period}_report.pdf"})


# ------------------------------ Users ------------------------------
@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    items = await db.users.find({}).sort("created_at", 1).to_list(500)
    return [sanitize_user(u) for u in items]


@api.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserPatch, user: dict = Depends(get_current_user)):
    if user["role"] != "admin" and user["id"] != user_id:
        raise HTTPException(403, "Not allowed")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "password" in update:
        update["password_hash"] = hash_password(update.pop("password"))
    if "role" in update and user["role"] != "admin":
        update.pop("role", None)
    if not update:
        raise HTTPException(400, "Nothing to update")
    r = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    return sanitize_user(u)


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    if user["id"] == user_id:
        raise HTTPException(400, "Cannot delete yourself")
    r = await db.users.delete_one({"_id": ObjectId(user_id)})
    if not r.deleted_count:
        raise HTTPException(404, "User not found")
    return {"ok": True}


# ------------------------------ Seed & startup ------------------------------
async def seed_all():
    # Users
    default_users = [
        (os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "Administrator", "admin"),
        (os.environ["OPERATOR_EMAIL"], os.environ["OPERATOR_PASSWORD"], "Operator", "operator"),
        (os.environ["VIEWER_EMAIL"], os.environ["VIEWER_PASSWORD"], "Viewer", "viewer"),
    ]
    for email, pwd, name, role in default_users:
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "email": email, "name": name, "role": role,
                "password_hash": hash_password(pwd),
                "created_at": datetime.now(timezone.utc),
            })
        elif not verify_password(pwd, existing["password_hash"]):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pwd)}})

    # Cameras
    if await db.cameras.count_documents({}) == 0:
        seed_cams = [
            {"name": "Warehouse - Loading Dock", "location": "Facility A / Dock 1", "scene": "warehouse",
             "thumbnail_url": "https://images.pexels.com/photos/36122954/pexels-photo-36122954.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"},
            {"name": "Warehouse - Aisle 3", "location": "Facility A / Aisle 3", "scene": "warehouse",
             "thumbnail_url": "https://images.pexels.com/photos/30341205/pexels-photo-30341205.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"},
            {"name": "Traffic - Intersection Alpha", "location": "Downtown / 5th Ave", "scene": "traffic",
             "thumbnail_url": "https://images.pexels.com/photos/8913522/pexels-photo-8913522.jpeg"},
            {"name": "Traffic - Roundabout West", "location": "Ring Road / West", "scene": "traffic",
             "thumbnail_url": "https://images.pexels.com/photos/31531448/pexels-photo-31531448.jpeg"},
            {"name": "Factory - Assembly Line A", "location": "Plant 2 / Line A", "scene": "factory",
             "thumbnail_url": "https://images.pexels.com/photos/34718922/pexels-photo-34718922.jpeg"},
            {"name": "Factory - Floor General", "location": "Plant 2 / Main Floor", "scene": "factory",
             "thumbnail_url": "https://images.pexels.com/photos/34718930/pexels-photo-34718930.jpeg"},
        ]
        for c in seed_cams:
            c["source_type"] = "demo"
            c["stream_url"] = None
            c["enabled"] = True
            c["status"] = "online"
            c["uptime_pct"] = round(random.uniform(97.5, 99.9), 2)
            c["created_at"] = datetime.now(timezone.utc)
        await db.cameras.insert_many(seed_cams)

    # Events (seed a bunch across last 24h)
    if await db.events.count_documents({}) == 0:
        cams = await db.cameras.find({}).to_list(50)
        seed_events = []
        now = datetime.now(timezone.utc)
        types = [("object_detection", "info", 0.85), ("intrusion", "critical", 0.9),
                 ("crowd_detection", "warning", 0.8), ("motion_detection", "info", 0.7),
                 ("abandoned_object", "warning", 0.75), ("fire_detection", "critical", 0.92),
                 ("smoke_detection", "critical", 0.88)]
        for i in range(120):
            cam = random.choice(cams)
            t, sev, base_conf = random.choice(types)
            seed_events.append({
                "camera_id": str(cam["_id"]), "camera_name": cam["name"],
                "detection_type": t, "severity": sev,
                "confidence": round(random.uniform(base_conf - 0.1, base_conf + 0.08), 2),
                "metadata": {},
                "created_at": now - timedelta(minutes=random.randint(0, 24 * 60)),
            })
        await db.events.insert_many(seed_events)

    # Settings
    await get_settings_doc()


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.events.create_index("created_at")
        await db.cameras.create_index("name")
    except Exception as e:
        logger.warning("index setup: %s", e)
    await seed_all()
    logger.info("Sentinel AI backend started")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)


@app.get("/")
async def root():
    return {"service": "Sentinel AI", "version": "1.0.0", "status": "ok"}
