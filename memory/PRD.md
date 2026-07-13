# Sentinel AI - PRD

## Original Problem Statement
Build **Sentinel AI**, an enterprise-grade AI video analytics platform (like commercial
CCTV surveillance systems for factories, warehouses, airports, smart cities). Real-time
object detection (person, car, motorcycle, truck, bicycle, bus) + intrusion, crowd,
motion, abandoned object, fire, and smoke detection. Multi-page enterprise UI with
JWT auth, role-based access, live monitoring, camera management, event history,
reports (PDF), and AI settings.

## User Choices (from ask_human)
- Database: **MongoDB**
- AI Detection: **Hybrid** (real YOLOv8n for image/video uploads, simulated for live)
- Live camera source: **Browser webcam + RTSP config UI** (RTSP as UI-only)
- Auth: **JWT custom auth** with roles admin / operator / viewer
- Scope: Full UI + working detections + simulated live stream

## Architecture
- **Frontend**: React 19 + Tailwind + Recharts + shadcn/ui + Phosphor icons + Sonner
- **Backend**: FastAPI + Motor (MongoDB) + Ultralytics YOLOv8n + OpenCV + ReportLab
- **Auth**: JWT (httpOnly cookies + Bearer fallback) via `pyjwt` + `bcrypt`
- **DB Collections**: users, cameras, events, settings

## Implemented (2026-02)
### Backend
- JWT auth (login/register/logout/refresh/me), role checks
- Cameras CRUD (add/rename/toggle/reconnect/delete)
- Image upload → real YOLOv8n detection with annotated JPEG (base64)
- Video upload → frame-sampled YOLO detections with playback frames
- Fire/smoke color-heuristic detector layered on top of YOLO
- Live simulated frame endpoint (`/live/simulate/:cam`) — realistic bboxes per scene
- Events CRUD + search/filter/sort/delete/CSV export
- AI settings (confidence, IoU, classes, thresholds, resolution, frame skip)
- Dashboard stats (24h hourly, categories mix, person trend, FPS/CPU/inference telemetry)
- Reports summary + PDF download (daily / weekly / monthly)
- User management (admin only)
- Seed on startup: 3 users (admin, operator, viewer), 6 cameras, 120 realistic events

### Frontend (pages)
- **Login** – split-screen brand panel + quick-login buttons for demo roles
- **Dashboard** – 7 stat cards, hourly bar chart, category pie, trend line, recent alerts
- **Live Monitoring** – camera strip, live-feed with SVG bounding boxes, drawable
  restricted zones, image/video YOLO upload panel, video playback
- **Cameras** – grid with thumbnails, add form (webcam/rtsp/demo), rename/toggle/reconnect/delete
- **Detection History** – search + severity/type filters + sort + CSV export + delete
- **Reports** – period selector, event counts, breakdown chart, camera uptime, top incidents, PDF download
- **AI Settings** – sliders for all thresholds, class toggles, resolution buttons
- **User Management** – admin CRUD + role changes
- **Profile** – edit name / change password
- **About** – tech stack + feature summary

### Design system
- Outfit (display) + Manrope (body) + JetBrains Mono (data)
- Dark obsidian theme (#09090b) + volt blue (#2563EB) accent + red/amber/emerald semantics
- Glassmorphic sidebar/topnav, scan-line camera feed, pulse live-dot, staggered fade-ins

## Test Credentials (see /app/memory/test_credentials.md)
- admin@sentinel.ai / Admin@123
- operator@sentinel.ai / Operator@123
- viewer@sentinel.ai / Viewer@123

## Deferred / Backlog (P1/P2)
- WebSocket push instead of polling
- Actual RTSP ingest (out of scope for cloud preview)
- Trained fire/smoke model instead of color heuristic
- Multi-frame tracker (SORT/ByteTrack) for object counting continuity
- Per-camera intrusion zone persistence

## Next Action Items
- Run testing subagent, address any critical failures
