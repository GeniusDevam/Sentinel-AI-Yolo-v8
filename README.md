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

## Demo Accounts
On first start the backend creates an admin, an operator and a viewer account
from the `ADMIN_*`, `OPERATOR_*` and `VIEWER_*` settings in `backend/.env`.

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

## Running Locally

Backend (Python 3.11+ and a running MongoDB):

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

`backend/.env` needs `MONGO_URL`, `DB_NAME`, `JWT_SECRET` and the `ADMIN_EMAIL`/`ADMIN_PASSWORD`,
`OPERATOR_EMAIL`/`OPERATOR_PASSWORD` and `VIEWER_EMAIL`/`VIEWER_PASSWORD` pairs.
Optional: `CORS_ORIGINS`, `PRODUCTION`, `YOLO_MODEL`.

Frontend (Node 18+ and Yarn):

```bash
cd frontend
yarn install
echo REACT_APP_BACKEND_URL=http://localhost:8001 > .env
yarn start
```

The dashboard opens on http://localhost:3000 and calls the API under `/api`.
