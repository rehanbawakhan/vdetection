# FaceWatch AI

FaceWatch AI is a full-stack face recognition web app with real-time webcam detection, wanted-person alerts, history tracking, and protected admin workflows.

## Stack

- Frontend: React 18, React Router, face-api.js
- Backend: Node.js, Express, JWT auth
- Database: SQLite (`backend/facewatch.db`)
- Notifications: Browser Notification API + optional Web Push (`web-push`)

## Model Weights (Included)

The required face-api model weights are already present in this repo under `frontend/public/models`.

- `ssd_mobilenetv1_model-weights_manifest.json`
- `ssd_mobilenetv1_model-shard1`
- `ssd_mobilenetv1_model-shard2`
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`
- `face_recognition_model-shard2`

The app loads models from `/models` in `frontend/src/components/CameraCapture.js`.

## TensorFlow / face-api Runtime

Scripts are loaded from CDN in `frontend/public/index.html`:

- `@tensorflow/tfjs-core@1.7.4`
- `@tensorflow/tfjs-converter@1.7.4`
- `@tensorflow/tfjs-backend-webgl@1.7.4`
- `face-api.js@0.22.2`

## Project Structure

```text
vdetection/
  backend/
    server.js
    db.js
    .env.example
    facewatch.db
  frontend/
    public/
      index.html
      sw.js
      models/
    src/
      components/
      context/
      pages/
      routes/
      App.js
      App.css
      api.js
  package.json
  README.md
```

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

```bash
npm run install:all
```

## Environment Variables

### Backend (`backend/.env`)

Create from example:

```bash
copy backend\\.env.example backend\\.env
```

Available variables:

- `PORT` (default `5000`)
- `JWT_SECRET`
- `ADMIN_USER` (default `admin`)
- `ADMIN_PASSWORD` (default `admin123`)
- `ADMIN_PIN` (default `1234`)
- `VAPID_PUBLIC_KEY` (optional)
- `VAPID_PRIVATE_KEY` (optional)
- `ALERT_EMAIL` (optional, for VAPID contact)

### Frontend (`frontend/.env`)

Create from example:

```bash
copy frontend\\.env.example frontend\\.env
```

Variables:

- `REACT_APP_API_URL` (default `http://localhost:5000`)

## Run

Terminal 1:

```bash
npm run start:backend
```

Terminal 2:

```bash
npm run start:frontend
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Health check: `GET http://localhost:5000/health`

## Default Admin Credentials

- Username: `admin`
- Password: `admin123`
- PIN: `1234`

Change these immediately via environment variables in production.

## Features

- Real-time webcam face detection and descriptor matching
- Bounding box + identity/confidence overlay
- Face library CRUD (name, encoding, image URL, wanted flag)
- Upload image and auto-extract encoding
- Wanted-person alert flow with throttling
- Alert banner, sound, and optional browser popup
- History logging with filters (name/date range)
- JWT login and PIN-protected routes
- Optional web push subscription and alert fanout

## API Summary

Auth:

- `POST /api/auth/login`
- `POST /api/auth/pin`

Faces:

- `GET /api/known-faces`
- `POST /api/known-faces`
- `PUT /api/known-faces/:id`
- `DELETE /api/known-faces/:id`
- `GET /api/public-faces`

History:

- `GET /api/history`
- `POST /api/history`
- `DELETE /api/history`

Alerts / Push:

- `POST /api/alert`
- `POST /api/subscribe`
- `GET /api/push-key`

Other:

- `GET /health`

## Database Tables

Created automatically by `backend/db.js`:

- `known_faces`
- `history`
- `alerts`
- `users`
- `push_subscriptions`

## Recognition Notes

- Match threshold default: `0.55` (adjustable in dashboard)
- Matching uses Euclidean distance on face descriptors
- Alert type used for wanted detections: `wanted_match`

## Troubleshooting

- Camera requires HTTPS except on localhost.
- If model load fails, verify files exist in `frontend/public/models`.
- If push notifications do not work, verify valid VAPID keys are configured.

Main Developer: rehan bawakhan
