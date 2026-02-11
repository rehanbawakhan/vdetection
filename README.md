# FaceWatch AI - Full-Face Recognition Web App

Fullstack project with:
- React frontend (CRA-compatible structure)
- Node.js + Express backend
- SQLite database
- Real-time webcam face detection/recognition with `face-api.js`
- Neon/dark animated dashboard, alerts, history, settings, PIN verify

## 1. Project Structure

```text
vdetection/
  frontend/
    public/
      index.html
      models/              <- put face-api models here
    src/
      components/
      context/
      pages/
      routes/
      App.js
      App.css
      api.js
      index.js
    package.json
  backend/
    db.js
    server.js
    package.json
    .env.example
  package.json
  .gitignore
```

## 2. Setup

### Prerequisites
- Node.js 18+
- npm 9+

### Install all dependencies
```bash
npm run install:all
```

### Configure backend env
```bash
copy backend\\.env.example backend\\.env
```
Update values in `backend/.env`:
- `JWT_SECRET`
- `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_PIN`
- Optional push keys: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `ALERT_EMAIL`

Optional frontend env:
```bash
copy frontend\\.env.example frontend\\.env
```

### Download face-api.js models
Create folder:
- `frontend/public/models`

Download model files for:
- `ssd_mobilenetv1`
- `face_landmark_68`
- `face_recognition`

(Weights and manifest files from official `face-api.js` model assets.)
The app loads `face-api.js` and TensorFlow JS via CDN script tags in `frontend/public/index.html`.

## 3. Run

Terminal 1:
```bash
npm run start:backend
```

Terminal 2:
```bash
npm run start:frontend
```

Frontend: `http://localhost:3000`
Backend: `http://localhost:5000`

Default login:
- Username: `admin`
- Password: `admin123`
- PIN: `1234`

## 4. Features Implemented

### Frontend
- React Router screens: Dashboard, Library, Settings, Login
- `CameraCapture` with WebRTC
- `face-api.js` live detection loop
- Face embedding match against DB encodings
- Bounding box + name + confidence label overlay
- Red glowing animated alert banner for wanted matches
- Sidebar panels:
  - Face library summary
  - History logs
- Library CRUD UI:
  - Add face (name + image + encoding)
  - Upload image and auto-extract encoding
  - Toggle wanted flag
  - Delete face
- Settings:
  - Alert sound toggle
  - Browser popup toggle
  - PIN verification
  - Threshold slider
- Auth:
  - Username/password login
  - Face login option (matches `Admin` face)
- Animated neon dark UI:
  - Radar scan effect
  - Pulse alerts
  - Loading bars
  - Glow transitions

### Backend
- Express API in `backend/server.js`
- Security:
  - `helmet`
  - rate limit on auth routes
  - JWT auth middleware
- Endpoints:
  - `GET /api/known-faces`
  - `POST /api/known-faces`
  - `PUT /api/known-faces/:id`
  - `DELETE /api/known-faces/:id`
  - `GET /api/history`
  - `POST /api/history`
  - `POST /api/alert`
  - `POST /api/subscribe`
  - `POST /api/auth/login`
  - `POST /api/auth/pin`
- Push notification integration using `web-push` for alert fanout

## 5. Database Schema

Initialized automatically in `backend/db.js`.

```sql
CREATE TABLE known_faces(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  encoding TEXT NOT NULL,
  image_url TEXT,
  is_wanted INTEGER DEFAULT 0
);

CREATE TABLE history(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE alerts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  alert_type TEXT NOT NULL
);
```

## 6. How To Add / Train Faces

1. Open **Library** page.
2. Add:
   - `name`
   - `image_url` (URL/base64) or upload a file
   - `encoding` (auto-filled from upload or manual JSON)
3. Save.
4. Toggle wanted status if needed.

Notes:
- Recognition compares live descriptor vs saved descriptor using Euclidean distance.
- Match triggers when `distance <= threshold` (default `0.55`).

## 7. Alert + Notification Flow

When a wanted face is detected:
1. Frontend shows animated red alert and optional sound.
2. Browser Notification API popup is fired (if granted).
3. Frontend posts to `POST /api/alert`.
4. Backend stores `alerts` + `history` and sends web-push notifications (if VAPID is configured).

## 8. PostgreSQL Option

Current implementation uses SQLite for fast local setup.
To use PostgreSQL, replace `backend/db.js` with a `pg` client implementation and keep the same schema/tables and endpoint contracts.
