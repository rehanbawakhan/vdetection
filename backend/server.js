require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const webpush = require("web-push");
const nodemailer = require("nodemailer");
const { initDb, getDb } = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "change_me_super_secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const ALERT_EMAIL = process.env.ALERT_EMAIL || "mailto:admin@example.com";
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_NAME = "facewatch_token";
const FRONTEND_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const ALERT_TO_EMAIL = process.env.ALERT_TO_EMAIL || "admin@example.com";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: Number(SMTP_PORT) === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(ALERT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || FRONTEND_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin blocked"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "5mb" }));

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 60
  })
);

const alertRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many detection alerts. Slow down." }
});

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, pair) => {
    const [key, ...parts] = pair.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(parts.join("=") || "");
    return acc;
  }, {});
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim();
  }

  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME] || "";
}

function setAuthCookie(res, token) {
  const cookieParts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${8 * 60 * 60}`
  ];

  if (IS_PROD) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
}

function clearAuthCookie(res) {
  const cookieParts = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (IS_PROD) {
    cookieParts.push("Secure");
  }

  res.setHeader("Set-Cookie", cookieParts.join("; "));
}

function auth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ message: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function asBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function validateThreshold(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) return null;
  return parsed;
}


app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "username and password required" });
  }

  const db = getDb();
  const user = await db.get("SELECT * FROM users WHERE username = ?", username);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ sub: user.id, username }, JWT_SECRET, { expiresIn: "8h" });
  setAuthCookie(res, token);
  return res.json({ ok: true, username });
}));

app.post("/api/auth/face-login", asyncHandler(async (req, res) => {
  const username = String(req.body?.username || ADMIN_USER).trim();
  if (!username) return res.status(400).json({ message: "username required" });

  const db = getDb();
  const user = await db.get("SELECT id, username FROM users WHERE username = ?", username);
  if (!user) return res.status(401).json({ message: "User not found" });

  const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "8h" });
  setAuthCookie(res, token);
  return res.json({ ok: true, username: user.username });
}));

app.post("/api/auth/logout", auth, asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
}));

app.get("/api/auth/me", auth, asyncHandler(async (req, res) => {
  return res.json({ ok: true, username: req.user.username });
}));

app.post("/api/auth/pin", auth, asyncHandler(async (req, res) => {
  const { pin } = req.body || {};
  if (pin === undefined || pin === null || String(pin).trim() === "") {
    return res.status(400).json({ message: "pin required" });
  }

  const db = getDb();
  const user = await db.get("SELECT * FROM users WHERE username = ?", req.user.username);
  if (!user) return res.status(401).json({ message: "Invalid token" });

  const ok = await bcrypt.compare(String(pin), user.pin_hash);
  if (!ok) return res.status(401).json({ message: "Invalid PIN" });
  return res.json({ ok: true });
}));

app.get("/api/known-faces", auth, asyncHandler(async (_req, res) => {
  const db = getDb();
  const data = await db.all("SELECT * FROM known_faces ORDER BY id DESC");
  res.json({ data });
}));

app.get("/api/public-faces", asyncHandler(async (_req, res) => {
  const db = getDb();
  const data = await db.all(
    "SELECT id, name, encoding, image_url, is_wanted FROM known_faces WHERE LOWER(name) = 'admin' LIMIT 1"
  );
  res.json({ data });
}));

app.post("/api/known-faces", auth, asyncHandler(async (req, res) => {
  const { name, encoding, image_url } = req.body || {};
  if (!name || !encoding) return res.status(400).json({ message: "name and encoding required" });

  let encoded;
  try {
    encoded = typeof encoding === "string" ? JSON.parse(encoding) : encoding;
    if (!Array.isArray(encoded)) throw new Error("encoding must be an array");
  } catch {
    return res.status(400).json({ message: "encoding must be JSON array" });
  }

  const db = getDb();
  const result = await db.run(
    "INSERT INTO known_faces (name, encoding, image_url, is_wanted) VALUES (?, ?, ?, 0)",
    name,
    JSON.stringify(encoded),
    image_url || ""
  );

  res.status(201).json({ id: result.lastID });
}));

app.put("/api/known-faces/:id", auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, encoding, image_url, is_wanted } = req.body || {};
  const db = getDb();
  const current = await db.get("SELECT * FROM known_faces WHERE id = ?", id);
  if (!current) return res.status(404).json({ message: "Face not found" });

  let nextEncoding = current.encoding;
  if (encoding !== undefined) {
    try {
      const parsed = typeof encoding === "string" ? JSON.parse(encoding) : encoding;
      if (!Array.isArray(parsed)) throw new Error("encoding must be array");
      nextEncoding = JSON.stringify(parsed);
    } catch {
      return res.status(400).json({ message: "encoding must be JSON array" });
    }
  }

  await db.run(
    "UPDATE known_faces SET name = ?, encoding = ?, image_url = ?, is_wanted = ? WHERE id = ?",
    name ?? current.name,
    nextEncoding,
    image_url ?? current.image_url,
    is_wanted === undefined ? current.is_wanted : Number(Boolean(is_wanted)),
    id
  );

  res.json({ ok: true });
}));

app.delete("/api/known-faces/:id", auth, asyncHandler(async (req, res) => {
  const db = getDb();
  await db.run("DELETE FROM known_faces WHERE id = ?", req.params.id);
  res.json({ ok: true });
}));

app.get("/api/history", auth, asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, from, to } = req.query;
  const clauses = [];
  const args = [];

  if (name) {
    clauses.push("name LIKE ?");
    args.push(`%${name}%`);
  }
  if (from) {
    clauses.push("timestamp >= ?");
    args.push(`${from} 00:00:00`);
  }
  if (to) {
    clauses.push("timestamp <= ?");
    args.push(`${to} 23:59:59`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const data = await db.all(
    `SELECT id, name, image, REPLACE(timestamp, ' ', 'T') || 'Z' AS timestamp
     FROM history
     ${where}
     ORDER BY timestamp DESC
     LIMIT 300`,
    ...args
  );
  res.json({ data });
}));

app.post("/api/history", auth, asyncHandler(async (req, res) => {
  const { name, image = "" } = req.body || {};
  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ message: "name required" });
  }
  const db = getDb();
  await db.run("INSERT INTO history (name, image, timestamp) VALUES (?, ?, datetime('now'))", name, image);
  return res.status(201).json({
    ok: true,
    timestamp: new Date().toISOString()
  });
}));

app.delete("/api/history", auth, asyncHandler(async (_req, res) => {
  const db = getDb();
  await db.run("DELETE FROM history");
  res.json({ ok: true });
}));

app.post("/api/subscribe", auth, asyncHandler(async (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ message: "Invalid subscription" });
  }

  const db = getDb();
  await db.run(
    "INSERT OR REPLACE INTO push_subscriptions (endpoint, payload) VALUES (?, ?)",
    subscription.endpoint,
    JSON.stringify(subscription)
  );

  return res.json({ ok: true, publicKey: VAPID_PUBLIC_KEY });
}));

app.get("/api/push-key", auth, asyncHandler(async (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY || null });
}));

app.get("/api/settings", auth, asyncHandler(async (req, res) => {
  const db = getDb();
  const settings = await db.get(
    "SELECT threshold, sound_alert, push_notifications, updated_at FROM user_settings WHERE user_id = ?",
    req.user.sub
  );

  if (!settings) {
    const fallback = {
      threshold: 0.55,
      sound_alert: 1,
      push_notifications: 1,
      updated_at: new Date().toISOString()
    };
    return res.json({
      data: {
        threshold: fallback.threshold,
        sound: true,
        popup: true,
        updatedAt: fallback.updated_at
      }
    });
  }

  return res.json({
    data: {
      threshold: Number(settings.threshold),
      sound: Boolean(settings.sound_alert),
      popup: Boolean(settings.push_notifications),
      updatedAt: settings.updated_at
    }
  });
}));

app.post("/api/settings", auth, asyncHandler(async (req, res) => {
  const threshold = validateThreshold(req.body?.threshold);
  const sound = asBoolean(req.body?.sound, null);
  const popup = asBoolean(req.body?.popup, null);

  if (threshold === null || sound === null || popup === null) {
    return res.status(400).json({
      message: "Invalid settings body. threshold(0..1), sound(boolean), popup(boolean) are required."
    });
  }

  const db = getDb();
  await db.run(
    `INSERT INTO user_settings (user_id, threshold, sound_alert, push_notifications, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id)
     DO UPDATE SET
       threshold = excluded.threshold,
       sound_alert = excluded.sound_alert,
       push_notifications = excluded.push_notifications,
       updated_at = datetime('now')`,
    req.user.sub,
    threshold,
    sound ? 1 : 0,
    popup ? 1 : 0
  );

  return res.json({
    ok: true,
    data: {
      threshold,
      sound,
      popup,
      updatedAt: new Date().toISOString()
    }
  });
}));

app.get("/api/config", auth, asyncHandler(async (req, res) => {
  const db = getDb();
  const settings = await db.get(
    "SELECT threshold, sound_alert, push_notifications, updated_at FROM user_settings WHERE user_id = ?",
    req.user.sub
  );
  if (!settings) {
    return res.json({
      data: {
        threshold: 0.55,
        sound: true,
        popup: true,
        updatedAt: new Date().toISOString()
      }
    });
  }
  return res.json({
    data: {
      threshold: Number(settings.threshold),
      sound: Boolean(settings.sound_alert),
      popup: Boolean(settings.push_notifications),
      updatedAt: settings.updated_at
    }
  });
}));

app.post("/api/config", auth, asyncHandler(async (req, res) => {
  const threshold = validateThreshold(req.body?.threshold);
  const sound = asBoolean(req.body?.sound, null);
  const popup = asBoolean(req.body?.popup, null);

  if (threshold === null || sound === null || popup === null) {
    return res.status(400).json({
      message: "Invalid config body. threshold(0..1), sound(boolean), popup(boolean) are required."
    });
  }

  const db = getDb();
  await db.run(
    `INSERT INTO user_settings (user_id, threshold, sound_alert, push_notifications, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id)
     DO UPDATE SET
       threshold = excluded.threshold,
       sound_alert = excluded.sound_alert,
       push_notifications = excluded.push_notifications,
       updated_at = datetime('now')`,
    req.user.sub,
    threshold,
    sound ? 1 : 0,
    popup ? 1 : 0
  );

  return res.json({
    ok: true,
    data: {
      threshold,
      sound,
      popup,
      updatedAt: new Date().toISOString()
    }
  });
}));

app.post("/api/alert", auth, alertRateLimiter, asyncHandler(async (req, res) => {
  const { name, alert_type = "wanted_match", image = "", confidence, detection_status } = req.body || {};

  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ message: "name required" });
  }
  if (confidence !== undefined && (Number.isNaN(Number(confidence)) || Number(confidence) < 0 || Number(confidence) > 1)) {
    return res.status(400).json({ message: "confidence must be between 0 and 1" });
  }

  const resolvedStatus = typeof detection_status === "string" && detection_status.trim()
    ? detection_status.trim()
    : "unknown";
  const resolvedConfidence = confidence === undefined ? null : Number(confidence);

  const db = getDb();
  await db.run(
    "INSERT INTO alerts (name, alert_type, confidence, detection_status, timestamp) VALUES (?, ?, ?, ?, datetime('now'))",
    name,
    alert_type,
    resolvedConfidence,
    resolvedStatus
  );
  await db.run("INSERT INTO history (name, image, timestamp) VALUES (?, ?, datetime('now'))", name, image);

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const isUnknown = name.toLowerCase() === "unknown";
    const subject = isUnknown ? "Security Alert: Unknown Person Detected" : `WANTED ALERT: ${name} Detected!`;
    const text = `${name} was detected at ${new Date().toLocaleString()} with confidence ${
      resolvedConfidence === null ? "n/a" : `${Math.round(resolvedConfidence * 100)}%`
    }.`;

    const mailOptions = {
      from: `"FaceWatch Security" <${SMTP_USER}>`,
      to: ALERT_TO_EMAIL,
      subject,
      text,
      attachments: image ? [{
        filename: `detection-${Date.now()}.jpg`,
        content: image.split("base64,")[1],
        encoding: "base64"
      }] : []
    };

    transporter.sendMail(mailOptions).catch((err) => console.error("Failed to send email alert:", err));
  }

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    const subs = await db.all("SELECT payload FROM push_subscriptions");
    const payload = JSON.stringify({
      title: "FaceWatch Alert",
      body: `${name} detected at ${new Date().toISOString()}`,
      type: alert_type,
      confidence: resolvedConfidence,
      status: resolvedStatus
    });

    await Promise.all(
      subs.map(async (row) => {
        const sub = JSON.parse(row.payload);
        try {
          await webpush.sendNotification(sub, payload);
        } catch {
          // Keep system resilient when subscriptions expire.
        }
      })
    );
  }

  return res.status(201).json({
    ok: true,
    detection: {
      name,
      alertType: alert_type,
      confidence: resolvedConfidence,
      status: resolvedStatus,
      timestamp: new Date().toISOString()
    }
  });
}));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use((err, _req, res, _next) => {
  if (err && err.message === "CORS origin blocked") {
    return res.status(403).json({ message: "Origin not allowed" });
  }
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

initDb({
  adminUser: ADMIN_USER,
  adminPassword: ADMIN_PASSWORD,
  adminPin: ADMIN_PIN
})
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FaceWatch API listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB initialization failed", err);
    process.exit(1);
  });
