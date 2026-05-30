from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Query, UploadFile, File, Response
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os, uuid, bcrypt, jwt, logging, asyncio, requests, html
import re

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class _DeleteResult:
    def __init__(self, deleted_count=0):
        self.deleted_count = deleted_count

class _UpdateResult:
    def __init__(self, matched_count=0):
        self.matched_count = matched_count

class _MemoryCursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, field, direction):
        self.docs.sort(key=lambda d: d.get(field) or "", reverse=direction < 0)
        return self

    def limit(self, count):
        self.docs = self.docs[:count]
        return self

    async def to_list(self, count):
        return [dict(d) for d in self.docs[:count]]

class _MemoryCollection:
    def __init__(self):
        self.docs = []

    async def create_index(self, *args, **kwargs):
        return None

    def _match_value(self, value, expected):
        if isinstance(expected, dict):
            if "$regex" in expected:
                flags = re.I if expected.get("$options") == "i" else 0
                return re.search(expected["$regex"], str(value or ""), flags) is not None
            if "$exists" in expected or "$ne" in expected or "$gte" in expected:
                if "$exists" in expected and (value is not None) != expected["$exists"]:
                    return False
                if "$ne" in expected and value == expected["$ne"]:
                    return False
                if "$gte" in expected and not (value is not None and value >= expected["$gte"]):
                    return False
                return True
        return value == expected

    def _matches(self, doc, query):
        for key, expected in (query or {}).items():
            if key == "$or":
                if not any(self._matches(doc, part) for part in expected):
                    return False
            elif not self._match_value(doc.get(key), expected):
                return False
        return True

    def _project(self, doc, projection):
        result = dict(doc)
        if projection:
            for key, include in projection.items():
                if include == 0:
                    result.pop(key, None)
        return result

    async def find_one(self, query, projection=None):
        for doc in self.docs:
            if self._matches(doc, query):
                return self._project(doc, projection)
        return None

    def find(self, query=None, projection=None):
        return _MemoryCursor([self._project(doc, projection) for doc in self.docs if self._matches(doc, query or {})])

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return None

    async def insert_many(self, docs):
        self.docs.extend(dict(doc) for doc in docs)
        return None

    async def update_one(self, query, update):
        for doc in self.docs:
            if self._matches(doc, query):
                doc.update(update.get("$set", {}))
                return _UpdateResult(1)
        return _UpdateResult(0)

    async def delete_one(self, query):
        for index, doc in enumerate(self.docs):
            if self._matches(doc, query):
                del self.docs[index]
                return _DeleteResult(1)
        return _DeleteResult(0)

class _MemoryDB:
    def __init__(self):
        self.users = _MemoryCollection()
        self.vehicles = _MemoryCollection()
        self.items = _MemoryCollection()
        self.renewals = _MemoryCollection()
        self.notification_logs = _MemoryCollection()

USE_MEMORY_DB = os.environ.get("USE_MEMORY_DB", "false").lower() == "true"
NODE_ENV = os.environ.get("NODE_ENV", "development").lower()
mongo_url = os.environ.get('MONGO_URL')
if not USE_MEMORY_DB and not mongo_url:
    if NODE_ENV == "production":
        raise RuntimeError("MONGO_URL must be set when USE_MEMORY_DB=false in production.")
    mongo_url = 'mongodb://localhost:27017'
client = None if USE_MEMORY_DB else AsyncIOMotorClient(mongo_url)
db = _MemoryDB() if USE_MEMORY_DB else client[os.environ.get('DB_NAME', 'duevault_db')]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    if NODE_ENV == "production":
        raise RuntimeError("JWT_SECRET must be set in production.")
    JWT_SECRET = "duevault-local-development-secret"
    logger.warning("JWT_SECRET is not set; using a development-only fallback secret.")
JWT_ALGORITHM = "HS256"

APP_NAME = "duevault"
STORAGE_URL = os.environ.get("DUEVAULT_STORAGE_URL", "")
_storage_key = None
_storage_ready = False

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error")
    detail = "Internal server error" if NODE_ENV == "production" else str(exc)
    return JSONResponse(status_code=500, content={"detail": detail})

def _split_env_list(value: str) -> list[str]:
    return [part.strip().rstrip("/") for part in (value or "").split(",") if part.strip()]

def _cors_origins() -> list[str]:
    configured = _split_env_list(os.environ.get("CORS_ORIGINS", ""))
    frontend_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")
    if NODE_ENV == "production":
        return [frontend_url] if frontend_url else []
    return configured or [origin for origin in [
        "http://localhost:5173",
        "http://localhost:3000",
        frontend_url,
    ] if origin]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Password & JWT ───────────────────────────────────────────────────────────
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()

def verify_password(pwd: str, hashed: str) -> bool:
    return bcrypt.checkpw(pwd.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email,
                       "exp": datetime.now(timezone.utc) + timedelta(days=30), "type": "access"},
                      JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

# ─── Status calculation ───────────────────────────────────────────────────────
def calc_status(exp_date: Optional[str], due_date: Optional[str]) -> dict:
    target = exp_date or due_date
    if not target:
        return {"status": "safe", "days_remaining": None}
    try:
        d = datetime.fromisoformat(target)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        days = (d - datetime.now(timezone.utc)).days
        if days < 0:        s = "expired"
        elif days <= 3:     s = "critical"
        elif days <= 10:    s = "urgent"
        elif days <= 30:    s = "warning"
        else:               s = "safe"
        return {"status": s, "days_remaining": days}
    except Exception:
        return {"status": "safe", "days_remaining": None}

def enrich(item: dict) -> dict:
    return {**item, **calc_status(item.get("expiration_date"), item.get("due_date"))}

# ─── Object Storage ───────────────────────────────────────────────────────────
def init_storage() -> Optional[str]:
    global _storage_key, _storage_ready
    if _storage_ready:
        return _storage_key
    key = os.environ.get("DUEVAULT_STORAGE_KEY")
    if not key or not STORAGE_URL:
        logger.warning("Object storage is not configured; file uploads disabled")
        _storage_ready = True
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"storage_key": key}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        _storage_ready = True
        logger.info("Object storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        _storage_ready = True
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    skey = init_storage()
    if not skey:
        raise HTTPException(503, "File storage not available")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": skey, "Content-Type": content_type},
                     data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def get_object(path: str) -> tuple:
    skey = init_storage()
    if not skey:
        raise HTTPException(503, "File storage not available")
    r = requests.get(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": skey}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
              "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
              "txt": "text/plain", "csv": "text/csv"}

def sanitize_filename(filename: str) -> str:
    base = os.path.basename(filename or "upload")
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._")
    return cleaned[:120] or "upload"

# ─── Pydantic models ──────────────────────────────────────────────────────────
class RegisterReq(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class LoginReq(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class ProfileUpdateReq(BaseModel):
    full_name: str
    notification_email: Optional[str] = None

class PasswordChangeReq(BaseModel):
    old_password: str
    new_password: str

class VehicleReq(BaseModel):
    name: str
    brand: str
    model: str
    license_plate: str
    notes: Optional[str] = None

class ItemReq(BaseModel):
    title: str
    item_type: str
    category: str
    vehicle_id: Optional[str] = None
    vehicle_name: Optional[str] = None
    license_plate: Optional[str] = None
    issue_date: Optional[str] = None
    expiration_date: Optional[str] = None
    due_date: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "RON"
    recurrence: Optional[str] = None
    custom_message: Optional[str] = None
    reminder_intervals: List[int] = [30, 10, 3]
    reminder_email: Optional[str] = None
    notes: Optional[str] = None

class RenewalReq(BaseModel):
    previous_expiration_date: Optional[str] = None
    new_expiration_date: str
    notes: Optional[str] = None

class EmailReq(BaseModel):
    item_id: str
    recipient_email: str

# ─── Auth endpoints ───────────────────────────────────────────────────────────
@api_router.post("/auth/register")
async def register(data: RegisterReq):
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid, "email": data.email.lower(), "full_name": data.full_name,
        "password_hash": hash_password(data.password), "role": "user",
        "notification_email": data.email.lower(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    token = create_token(uid, data.email.lower())
    return {"token": token, "user": {"id": uid, "email": data.email.lower(), "full_name": data.full_name, "role": "user"}}

@api_router.post("/auth/login")
async def login(data: LoginReq):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "full_name": user["full_name"], "role": user.get("role", "user"), "notification_email": user.get("notification_email", "")}}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout():
    return {"message": "Logged out"}

@api_router.put("/auth/profile")
async def update_profile(data: ProfileUpdateReq, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"full_name": data.full_name, "notification_email": data.notification_email,
                  "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated

@api_router.put("/auth/change-password")
async def change_password(data: PasswordChangeReq, user: dict = Depends(get_current_user)):
    full_user = await db.users.find_one({"id": user["id"]})
    if not full_user or not verify_password(data.old_password, full_user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(data.new_password)}})
    return {"message": "Password changed successfully"}

# ─── Vehicles ────────────────────────────────────────────────────────────────
@api_router.get("/vehicles")
async def list_vehicles(user: dict = Depends(get_current_user)):
    return await db.vehicles.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)

@api_router.post("/vehicles")
async def create_vehicle(data: VehicleReq, user: dict = Depends(get_current_user)):
    vid = str(uuid.uuid4())
    doc = {"id": vid, "user_id": user["id"], **data.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.vehicles.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/vehicles/{vid}")
async def get_vehicle(vid: str, user: dict = Depends(get_current_user)):
    v = await db.vehicles.find_one({"id": vid, "user_id": user["id"]}, {"_id": 0})
    if not v: raise HTTPException(404, "Vehicle not found")
    return v

@api_router.put("/vehicles/{vid}")
async def update_vehicle(vid: str, data: VehicleReq, user: dict = Depends(get_current_user)):
    r = await db.vehicles.update_one({"id": vid, "user_id": user["id"]},
                                     {"$set": {**data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}})
    if r.matched_count == 0: raise HTTPException(404, "Vehicle not found")
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})

@api_router.delete("/vehicles/{vid}")
async def delete_vehicle(vid: str, user: dict = Depends(get_current_user)):
    r = await db.vehicles.delete_one({"id": vid, "user_id": user["id"]})
    if r.deleted_count == 0: raise HTTPException(404, "Vehicle not found")
    return {"message": "Deleted"}

# ─── Items ────────────────────────────────────────────────────────────────────
@api_router.get("/items")
async def list_items(user: dict = Depends(get_current_user),
                     item_type: Optional[str] = Query(None),
                     vehicle_id: Optional[str] = Query(None)):
    q = {"user_id": user["id"]}
    if item_type: q["item_type"] = item_type
    if vehicle_id: q["vehicle_id"] = vehicle_id
    items = await db.items.find(q, {"_id": 0}).to_list(500)
    return [enrich(i) for i in items]

@api_router.post("/items")
async def create_item(data: ItemReq, user: dict = Depends(get_current_user)):
    iid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": iid, "user_id": user["id"], **data.model_dump(),
           "file_path": None, "file_name": None, "created_at": now, "updated_at": now}
    await db.items.insert_one(doc)
    doc.pop("_id", None)
    return enrich(doc)

@api_router.get("/items/{iid}")
async def get_item(iid: str, user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0})
    if not item: raise HTTPException(404, "Item not found")
    return enrich(item)

@api_router.put("/items/{iid}")
async def update_item(iid: str, data: ItemReq, user: dict = Depends(get_current_user)):
    r = await db.items.update_one(
        {"id": iid, "user_id": user["id"]},
        {"$set": {**data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if r.matched_count == 0: raise HTTPException(404, "Item not found")
    item = await db.items.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0})
    return enrich(item)

@api_router.delete("/items/{iid}")
async def delete_item(iid: str, user: dict = Depends(get_current_user)):
    r = await db.items.delete_one({"id": iid, "user_id": user["id"]})
    if r.deleted_count == 0: raise HTTPException(404, "Item not found")
    return {"message": "Deleted"}

# ─── File upload / download ───────────────────────────────────────────────────
@api_router.post("/items/{iid}/upload")
async def upload_file(iid: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": iid, "user_id": user["id"]})
    if not item: raise HTTPException(404, "Item not found")
    if not init_storage():
        raise HTTPException(503, "File storage not configured")

    safe_filename = sanitize_filename(file.filename)
    ext = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else "bin"
    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")

    # Validate type
    allowed = {"jpg", "jpeg", "png", "webp", "gif", "pdf"}
    if ext not in allowed:
        raise HTTPException(400, f"File type .{ext} not allowed. Use: {', '.join(allowed)}")

    path = f"{APP_NAME}/uploads/{user['id']}/{iid}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10 MB)")

    result = await asyncio.to_thread(put_object, path, data, content_type)
    await db.items.update_one({"id": iid, "user_id": user["id"]},
                              {"$set": {"file_path": result["path"], "file_name": safe_filename,
                                        "file_content_type": content_type,
                                        "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"file_path": result["path"], "file_name": safe_filename}

@api_router.get("/items/{iid}/file")
async def download_file(iid: str, user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0})
    if not item or not item.get("file_path"):
        raise HTTPException(404, "No file attached")
    content, ct = await asyncio.to_thread(get_object, item["file_path"])
    return Response(content=content, media_type=item.get("file_content_type", ct),
                    headers={"Content-Disposition": f'inline; filename="{item.get("file_name","file")}"'})

@api_router.delete("/items/{iid}/file")
async def remove_file(iid: str, user: dict = Depends(get_current_user)):
    r = await db.items.update_one({"id": iid, "user_id": user["id"]},
                                  {"$set": {"file_path": None, "file_name": None, "file_content_type": None}})
    if r.matched_count == 0: raise HTTPException(404, "Item not found")
    return {"message": "File removed"}

# ─── Renewals ────────────────────────────────────────────────────────────────
@api_router.get("/items/{iid}/renewals")
async def get_renewals(iid: str, user: dict = Depends(get_current_user)):
    return await db.renewals.find({"item_id": iid, "user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.post("/items/{iid}/renew")
async def renew_item(iid: str, data: RenewalReq, user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": iid, "user_id": user["id"]})
    if not item: raise HTTPException(404, "Item not found")
    prev = data.previous_expiration_date or item.get("expiration_date") or item.get("due_date") or ""
    rid = str(uuid.uuid4())
    renewal = {"id": rid, "item_id": iid, "user_id": user["id"],
               "previous_expiration_date": prev, "new_expiration_date": data.new_expiration_date,
               "notes": data.notes, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.renewals.insert_one(renewal)
    renewal.pop("_id", None)
    field = "expiration_date" if item.get("expiration_date") else "due_date"
    await db.items.update_one({"id": iid, "user_id": user["id"]},
                              {"$set": {field: data.new_expiration_date,
                                        "updated_at": datetime.now(timezone.utc).isoformat()}})
    return renewal

# ─── Dashboard ───────────────────────────────────────────────────────────────
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    items = await db.items.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    enriched = [enrich(i) for i in items]
    status_order = {"critical": 0, "urgent": 1, "warning": 2, "expired": 3, "safe": 4}
    needs_attn = sorted(
        [i for i in enriched if i["status"] != "safe"],
        key=lambda x: (status_order.get(x["status"], 5), x.get("days_remaining") or 999)
    )[:12]
    return {
        "summary": {
            "total_active": len([i for i in enriched if i["status"] != "expired"]),
            "expiring_soon": len([i for i in enriched if i["status"] in ["warning", "urgent", "critical"]]),
            "critical": len([i for i in enriched if i["status"] in ["critical", "urgent"]]),
            "expired": len([i for i in enriched if i["status"] == "expired"]),
            "upcoming_payments": len([i for i in enriched if i["item_type"] == "payment" and i["status"] != "expired"])
        },
        "needs_attention": needs_attn,
        "all_items": sorted(
            enriched,
            key=lambda x: (status_order.get(x["status"], 5), x.get("days_remaining") if x.get("days_remaining") is not None else 9999)
        )
    }

# ─── Global Search ───────────────────────────────────────────────────────────
@api_router.get("/search")
async def search(q: str = Query(""), user: dict = Depends(get_current_user)):
    q = q.strip()
    if len(q) < 2:
        return {"items": [], "vehicles": []}
    regex = {"$regex": q, "$options": "i"}
    items_q = {"user_id": user["id"], "$or": [
        {"title": regex}, {"category": regex}, {"notes": regex},
        {"custom_message": regex}, {"vehicle_name": regex}, {"license_plate": regex}
    ]}
    vehicles_q = {"user_id": user["id"], "$or": [
        {"name": regex}, {"brand": regex}, {"model": regex}, {"license_plate": regex}
    ]}
    items_raw, vehicles_raw = await asyncio.gather(
        db.items.find(items_q, {"_id": 0}).limit(20).to_list(20),
        db.vehicles.find(vehicles_q, {"_id": 0}).limit(10).to_list(10)
    )
    return {"items": [enrich(i) for i in items_raw], "vehicles": vehicles_raw}

# ─── Scheduler status ────────────────────────────────────────────────────────
@api_router.get("/scheduler/status")
async def scheduler_status(user: dict = Depends(get_current_user)):
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    job = _scheduler.get_job("email_reminders") if _scheduler else None
    return {
        "active": _scheduler is not None and _scheduler.running,
        "next_run": job.next_run_time.isoformat() if job and job.next_run_time else None,
        "email_configured": bool(os.environ.get("RESEND_API_KEY"))
    }

# ─── Email ───────────────────────────────────────────────────────────────────
def _build_email_html(item: dict, enriched: dict) -> str:
    days = enriched.get("days_remaining", "N/A")
    status = enriched.get("status", "safe")
    target = html.escape(str(item.get("expiration_date") or item.get("due_date") or "N/A"))
    title = html.escape(str(item.get("title", "Untitled")))
    category = html.escape(str(item.get('category','N/A')).replace('_',' ').title())
    custom_message = html.escape(str(item.get("custom_message", "")))
    colors = {"critical": "#EF4444", "urgent": "#F97316", "warning": "#F59E0B", "expired": "#9CA3AF", "safe": "#10B981"}
    c = colors.get(status, "#64748B")
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;">
      <div style="background:linear-gradient(135deg,#3B82F6,#8B5CF6,#06B6D4);padding:24px;border-radius:16px;margin-bottom:20px;">
        <h1 style="color:white;margin:0;font-size:22px;font-weight:700;">DueVault Reminder</h1>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;">A deadline requires your attention</p>
      </div>
      <div style="background:white;padding:24px;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <h2 style="color:#0F172A;margin:0 0 16px;font-size:20px;">{title}</h2>
        <p style="color:#64748B;margin:0 0 8px;font-size:14px;"><strong>Category:</strong> {category}</p>
        <p style="color:#64748B;margin:0 0 8px;font-size:14px;"><strong>Due / Expiry:</strong> {target}</p>
        <p style="color:#64748B;margin:0 0 8px;font-size:14px;"><strong>Days remaining:</strong> <strong style="color:{c}">{days}</strong></p>
        <p style="color:#64748B;margin:0 0 8px;font-size:14px;"><strong>Status:</strong> <span style="color:{c};font-weight:700;text-transform:uppercase;">{status}</span></p>
        {f'<p style="padding:12px;background:#f8fafc;border-radius:8px;color:#64748B;font-size:14px;">{custom_message}</p>' if item.get("custom_message") else ""}
      </div>
      <p style="color:#94A3B8;font-size:12px;text-align:center;margin-top:16px;">Sent by DueVault · Your deadline management companion</p>
    </div>"""

async def _send_email(recipient: str, subject: str, html: str, api_key: str):
    import resend as resend_lib
    resend_lib.api_key = api_key
    params = {"from": os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
              "to": [recipient], "subject": subject, "html": html}
    return await asyncio.to_thread(resend_lib.Emails.send, params)

@api_router.post("/email/test-reminder")
async def test_email(data: EmailReq, user: dict = Depends(get_current_user)):
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise HTTPException(503, "Email service is not configured. Missing RESEND_API_KEY.")
    item = await db.items.find_one({"id": data.item_id, "user_id": user["id"]}, {"_id": 0})
    if not item: raise HTTPException(404, "Item not found")
    enriched = enrich(item)
    try:
        result = await _send_email(data.recipient_email,
                                   f"DueVault: {item['title']} — {enriched.get('days_remaining','?')} days remaining",
                                   _build_email_html(item, enriched), api_key)
        return {"status": "success", "message": f"Reminder sent to {data.recipient_email}", "email_id": result.get("id")}
    except Exception as e:
        logger.error(f"Email failed: {e}")
        raise HTTPException(502, "Email provider rejected the request. Check Resend configuration and sender verification.")

@api_router.get("/email/status")
async def email_status(user: dict = Depends(get_current_user)):
    return {"configured": bool(os.environ.get("RESEND_API_KEY")),
            "sender": os.environ.get("RESEND_FROM_EMAIL") if os.environ.get("RESEND_API_KEY") else None}

# ─── Automatic email reminders (cron) ────────────────────────────────────────
async def check_and_send_reminders():
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return
    logger.info("Running scheduled reminder check...")
    try:
        import resend as resend_lib
        resend_lib.api_key = api_key
        now = datetime.now(timezone.utc)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

        items = await db.items.find(
            {"reminder_email": {"$exists": True, "$ne": None, "$ne": ""}},
            {"_id": 0}
        ).to_list(10000)

        sent_count = 0
        for item in items:
            enriched = enrich(item)
            days = enriched.get("days_remaining")
            if days is None:
                continue
            for interval in (item.get("reminder_intervals") or []):
                if days != interval:
                    continue
                # Check if already sent today
                existing = await db.notification_logs.find_one({
                    "item_id": item["id"], "days_interval": interval,
                    "sent_at": {"$gte": today}
                })
                if existing:
                    continue
                recipient = item["reminder_email"]
                try:
                    await _send_email(
                        recipient,
                        f"DueVault Reminder: {item['title']} — {days} days remaining",
                        _build_email_html(item, enriched), api_key
                    )
                    await db.notification_logs.insert_one({
                        "id": str(uuid.uuid4()), "item_id": item["id"],
                        "user_id": item["user_id"], "days_interval": interval,
                        "recipient_email": recipient, "sent_at": now.isoformat()
                    })
                    sent_count += 1
                    logger.info(f"Auto-reminder sent: {item['title']} → {recipient} ({interval}d)")
                except Exception as e:
                    logger.error(f"Auto-reminder failed for {item['title']}: {e}")
        logger.info(f"Reminder check done. Sent: {sent_count}")
    except Exception as e:
        logger.error(f"Scheduler error: {e}")

# ─── Seed data ────────────────────────────────────────────────────────────────
async def seed():
    seed_demo_data = os.environ.get("SEED_DEMO_DATA", "true" if NODE_ENV != "production" else "false").lower() == "true"
    if not seed_demo_data:
        logger.info("Skipping demo seed data")
        return
    if await db.users.find_one({"email": "demo@duevault.com"}):
        return
    logger.info("Seeding sample data...")
    now = datetime.now(timezone.utc)
    uid = str(uuid.uuid4())
    await db.users.insert_many([
        {"id": uid, "email": "demo@duevault.com", "full_name": "Alex Morgan",
         "password_hash": hash_password("demo123"), "role": "user",
         "notification_email": "demo@duevault.com", "created_at": now.isoformat()},
        {"id": str(uuid.uuid4()), "email": "admin@duevault.com", "full_name": "Admin",
         "password_hash": hash_password("admin123"), "role": "admin",
         "notification_email": "admin@duevault.com", "created_at": now.isoformat()}
    ])
    bmw_id, dacia_id = str(uuid.uuid4()), str(uuid.uuid4())
    await db.vehicles.insert_many([
        {"id": bmw_id, "user_id": uid, "name": "My Car", "brand": "BMW", "model": "320d",
         "license_plate": "CJ 12 ABC", "notes": "Automatic, 2020, diesel", "created_at": now.isoformat()},
        {"id": dacia_id, "user_id": uid, "name": "Family Car", "brand": "Dacia", "model": "Logan",
         "license_plate": "SM 45 XYZ", "notes": "Manual, 2018, petrol", "created_at": now.isoformat()}
    ])
    def d(days): return (now + timedelta(days=days)).strftime("%Y-%m-%d")
    seeds = [
        {"title": "RCA Insurance", "item_type": "vehicle_doc", "category": "rca",
         "vehicle_id": bmw_id, "vehicle_name": "BMW 320d", "license_plate": "CJ 12 ABC",
         "issue_date": d(-347), "expiration_date": d(18), "reminder_intervals": [30, 10, 3], "reminder_email": "demo@duevault.com"},
        {"title": "ITP Inspection", "item_type": "vehicle_doc", "category": "itp",
         "vehicle_id": dacia_id, "vehicle_name": "Dacia Logan", "license_plate": "SM 45 XYZ",
         "expiration_date": d(3), "reminder_intervals": [30, 10, 3], "reminder_email": "demo@duevault.com"},
        {"title": "Bank Installment", "item_type": "payment", "category": "bank_installment",
         "due_date": d(5), "amount": 650.0, "currency": "RON", "recurrence": "monthly", "reminder_intervals": [10, 3]},
        {"title": "Netflix Subscription", "item_type": "payment", "category": "subscription",
         "due_date": d(12), "amount": 42.0, "currency": "RON", "recurrence": "monthly", "reminder_intervals": [3]},
        {"title": "Passport", "item_type": "personal_document", "category": "passport",
         "issue_date": d(-1095), "expiration_date": d(42), "reminder_intervals": [30, 10, 3]},
        {"title": "Driver License", "item_type": "personal_document", "category": "driver_license",
         "issue_date": d(-730), "expiration_date": d(180), "reminder_intervals": [30, 10]},
        {"title": "Home Insurance", "item_type": "warranty", "category": "home_insurance",
         "expiration_date": d(-5), "reminder_intervals": [30, 10, 3]},
        {"title": "Electricity Bill", "item_type": "payment", "category": "utility",
         "due_date": d(2), "amount": 185.0, "currency": "RON", "recurrence": "monthly", "reminder_intervals": [10, 3]},
        {"title": "CASCO Insurance", "item_type": "vehicle_doc", "category": "casco",
         "vehicle_id": bmw_id, "vehicle_name": "BMW 320d", "license_plate": "CJ 12 ABC",
         "issue_date": d(-357), "expiration_date": d(8), "amount": 1200.0, "currency": "RON", "reminder_intervals": [30, 10, 3]},
        {"title": "Tire Change Reminder", "item_type": "vehicle_doc", "category": "tire_change",
         "vehicle_id": dacia_id, "vehicle_name": "Dacia Logan", "license_plate": "SM 45 XYZ",
         "due_date": d(25), "custom_message": "Switch to summer tires", "reminder_intervals": [10, 3]},
        {"title": "Laptop Warranty", "item_type": "warranty", "category": "electronics_warranty",
         "issue_date": d(-365), "expiration_date": d(365), "reminder_intervals": [30], "notes": "MacBook Pro M3"},
        {"title": "Internet Subscription", "item_type": "payment", "category": "subscription",
         "due_date": d(30), "amount": 55.0, "currency": "RON", "recurrence": "monthly", "reminder_intervals": [3]},
        {"title": "National ID Card", "item_type": "personal_document", "category": "national_id",
         "issue_date": d(-1460), "expiration_date": d(730), "reminder_intervals": [30, 10]},
        {"title": "Vignette", "item_type": "vehicle_doc", "category": "vignette",
         "vehicle_id": bmw_id, "vehicle_name": "BMW 320d", "license_plate": "CJ 12 ABC",
         "issue_date": d(-30), "expiration_date": d(335), "amount": 28.0, "currency": "RON", "reminder_intervals": [30]},
    ]
    defaults = {"vehicle_id": None, "vehicle_name": None, "license_plate": None, "issue_date": None,
                "expiration_date": None, "due_date": None, "amount": None, "currency": "RON",
                "recurrence": None, "custom_message": None, "reminder_intervals": [30, 10, 3],
                "reminder_email": None, "notes": None, "file_path": None, "file_name": None, "file_content_type": None}
    docs = [{**defaults, "id": str(uuid.uuid4()), "user_id": uid,
             "created_at": now.isoformat(), "updated_at": now.isoformat(), **s} for s in seeds]
    await db.items.insert_many(docs)
    logger.info("Seed complete.")

# ─── Startup / Shutdown ───────────────────────────────────────────────────────
_scheduler = None

@app.on_event("startup")
async def startup():
    global _scheduler
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id")
    await db.vehicles.create_index([("user_id", 1)])
    await db.items.create_index([("user_id", 1), ("item_type", 1)])
    await db.renewals.create_index("item_id")
    await db.notification_logs.create_index([("item_id", 1), ("days_interval", 1), ("sent_at", 1)])
    await seed()

    # Storage (non-blocking)
    asyncio.create_task(asyncio.to_thread(init_storage))

    # APScheduler — run reminder check every hour
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        _scheduler = AsyncIOScheduler(timezone="UTC")
        _scheduler.add_job(check_and_send_reminders, "interval", hours=1,
                           id="email_reminders", replace_existing=True)
        _scheduler.start()
        logger.info("Scheduler started — reminders will run every hour")
    except Exception as e:
        logger.error(f"Scheduler failed to start: {e}")

    if os.environ.get("SEED_DEMO_DATA", "true" if NODE_ENV != "production" else "false").lower() == "true":
        memory_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "memory"))
        os.makedirs(memory_dir, exist_ok=True)
        with open(os.path.join(memory_dir, "test_credentials.md"), "w") as f:
            f.write("# DueVault Test Credentials\n\n## Demo User\n- Email: demo@duevault.com\n- Password: demo123\n\n## Admin\n- Email: admin@duevault.com\n- Password: admin123\n\n## Key Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- GET /api/auth/me\n- PUT /api/auth/profile\n- PUT /api/auth/change-password\n- GET /api/dashboard\n- GET /api/search?q=query\n- GET /api/vehicles\n- GET /api/items\n- POST /api/items/{id}/upload\n- GET /api/items/{id}/file\n- GET /api/scheduler/status\n")

@app.on_event("shutdown")
async def shutdown():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    if client:
        client.close()

app.include_router(api_router)
