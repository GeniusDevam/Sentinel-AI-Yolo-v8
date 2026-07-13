# Sentinel AI

Enterprise-grade AI Video Analytics Platform — real-time object detection,
intrusion & crowd analytics, fire/smoke detection, multi-camera command center.

## Stack
- **Backend**: FastAPI · MongoDB (Motor) · Ultralytics YOLOv8n · OpenCV · ReportLab · JWT
- **Frontend**: React 19 · Tailwind · shadcn/ui · Recharts · Phosphor icons · Sonner

## Features
- Live monitoring with simulated detections + drawable restricted zones
- Real YOLOv8n inference on uploaded images and videos
- 6-class detection (person, car, motorcycle, truck, bicycle, bus) + fire/smoke heuristic
- Camera management (add / rename / enable / reconnect / delete)
- Detection history with search, filter, sort, CSV export
- Analytics dashboard with hourly detections, category mix, person-count trend
- Reports (daily / weekly / monthly) + PDF download
- AI settings (confidence, IoU, classes, thresholds, resolution, frame skip)
- Role-based auth (admin / operator / viewer)

## Test Accounts
See `memory/test_credentials.md`.

## Endpoints
Base: `/api`
- Auth: `POST /auth/login | /auth/register | /auth/logout | /auth/refresh` · `GET /auth/me`
- Cameras: `GET|POST /cameras` · `PATCH|DELETE /cameras/{id}` · `POST /cameras/{id}/reconnect`
- Detection: `POST /detect/image` · `POST /detect/video` · `GET /live/simulate/{camera_id}`
- Events: `GET|POST /events` · `DELETE /events/{id}` · `GET /events/export.csv`
- Settings: `GET|PUT /settings`
- Dashboard: `GET /dashboard/stats`
- Reports: `GET /reports/summary?period=` · `GET /reports/pdf?period=`
- Users (admin): `GET /users` · `PATCH|DELETE /users/{id}`

## Local Notes
- Backend runs on `0.0.0.0:8001` under supervisor.
- Frontend runs on `0.0.0.0:3000`.
- All requests are routed through Kubernetes ingress with `/api` prefix.
