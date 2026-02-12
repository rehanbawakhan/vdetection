# FaceWatch AI

FaceWatch AI is a full-stack face recognition dashboard with:
- live camera recognition
- face library management
- face login
- wanted-person alerting (email + optional web push)
- history tracking

## Stack
- Frontend: React 18, React Router, `face-api.js`
- Backend: Node.js, Express, JWT auth (HTTP-only cookie)
- Database: SQLite (`backend/facewatch.db`)
- Email alerts: `nodemailer`
- Push alerts: `web-push` (optional)

## Requirements
- Node.js 18+
- npm 9+

## Project Structure
```text
vdetection/
  backend/
    server.js
    db.js
    facewatch.db
    .env
    .env.example
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
      api.js
  package.json
  README.md
```

## 1. Install Dependencies
From project root:
```bash
npm run install:all
```

## 2. Configure Environment Files
Create and edit:
- `backend/.env`
- `frontend/.env` (optional if default API URL is fine)

### Backend `.env` Example
Use this as a complete template:
```env
PORT=5000
JWT_SECRET=change_me_super_secret

ADMIN_USER=admin
ADMIN_PASSWORD=change_me_admin_password
ADMIN_PIN=1234

# CORS (comma-separated if multiple)
CORS_ORIGINS=http://localhost:3000

# Email alert destination
ALERT_TO_EMAIL=you@example.com

# Nodemailer SMTP config
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=your_16_char_gmail_app_password

# Optional push notifications
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
ALERT_EMAIL=mailto:your-email@example.com
```

### Frontend `.env` Example
```env
REACT_APP_API_URL=http://localhost:5000
```

## 3. Configure Nodemailer (Gmail SMTP)
If you want email alerts for wanted detections, set Gmail SMTP values in `backend/.env`.

### Create `SMTP_PASS` (Gmail App Password)
1. Open your Google account security settings.
2. Enable 2-Step Verification for the Gmail account used as `SMTP_USER`.
3. Open App Passwords.
4. Create a new app password (Mail / custom name like `FaceWatch`).
5. Copy the generated 16-character password.
6. Put that value in `SMTP_PASS` (no spaces).

Use:
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=<your gmail>`
- `SMTP_PASS=<app password>`
- `ALERT_TO_EMAIL=<recipient email>`

## 4. Start the Website
Run in two terminals from project root.

Terminal 1:
```bash
npm run start:backend
```

Terminal 2:
```bash
npm run start:frontend
```

Open:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5000/health`

## 5. First Login
Use values from `backend/.env`:
- Username = `ADMIN_USER`
- Password = `ADMIN_PASSWORD`
- PIN = `ADMIN_PIN`

## 6. Add Face for Face Login
1. Login with username/password.
2. Go to Library.
3. Add face with `name=admin`.
4. Save encoding.
5. Logout, then use Face Login.

## 7. Alert Behavior (Current)
- Wanted match: sends alert to backend (`/api/alert`) and can trigger email/push.
- Known non-wanted match: no alert sent.
- Unknown: no alert sent.

## API Overview

### Auth
- `POST /api/auth/login`
- `POST /api/auth/face-login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/pin`

### Faces
- `GET /api/known-faces`
- `POST /api/known-faces`
- `PUT /api/known-faces/:id`
- `DELETE /api/known-faces/:id`
- `GET /api/public-faces`

### History
- `GET /api/history`
- `POST /api/history`
- `DELETE /api/history`

### Alerts / Push
- `POST /api/alert`
- `POST /api/subscribe`
- `GET /api/push-key`

### Settings
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/config`
- `POST /api/config`

## Troubleshooting
- Camera requires HTTPS except on localhost.
- If face models fail to load, verify files exist under `frontend/public/models`.
- If email is not sent:
  - confirm `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
  - confirm `ALERT_TO_EMAIL`
  - check backend terminal logs for nodemailer errors
- If login fails after changing `.env`, restart backend.

Main Developer: rehan bawakhan
