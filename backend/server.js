require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const webpush = require("web-push");
const { initDb, getDb } = require("./db");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "change_me_super_secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const ALERT_EMAIL = process.env.ALERT_EMAIL || "mailto:admin@example.com";

// Email Configuration
const ALERT_TO_EMAIL = process.env.ALERT_TO_EMAIL || "admin@example.com";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(ALERT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.use(
    "/api/auth",
    rateLimit({
        windowMs: 10 * 60 * 1000,
        max: 60
    })
);

function auth(req, res, next) {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "Missing token" });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }
}

app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    const user = await db.get("SELECT * FROM users WHERE username = ?", username);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ sub: user.id, username }, JWT_SECRET, { expiresIn: "8h" });
    return res.json({ token });
});

app.post("/api/auth/pin", auth, async (req, res) => {
    const { pin } = req.body;
    const db = getDb();
    const user = await db.get("SELECT * FROM users WHERE username = ?", req.user.username);
    const ok = await bcrypt.compare(String(pin || ""), user.pin_hash);
    if (!ok) return res.status(401).json({ message: "Invalid PIN" });
    return res.json({ ok: true });
});

app.get("/api/known-faces", auth, async (_req, res) => {
    const db = getDb();
    const data = await db.all("SELECT * FROM known_faces ORDER BY id DESC");
    res.json({ data });
});

app.get("/api/public-faces", async (_req, res) => {
    const db = getDb();
    const data = await db.all(
        "SELECT id, name, encoding, image_url, is_wanted FROM known_faces WHERE LOWER(name) = 'admin' LIMIT 1"
    );
    res.json({ data });
});

app.post("/api/known-faces", auth, async (req, res) => {
    const { name, encoding, image_url } = req.body;
    if (!name || !encoding) return res.status(400).json({ message: "name and encoding required" });

    let encoded;
    try {
        encoded = typeof encoding === "string" ? JSON.parse(encoding) : encoding;
        if (!Array.isArray(encoded)) throw new Error();
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
});

app.put("/api/known-faces/:id", auth, async (req, res) => {
    const { id } = req.params;
    const { name, encoding, image_url, is_wanted } = req.body;
    const db = getDb();
    const current = await db.get("SELECT * FROM known_faces WHERE id = ?", id);
    if (!current) return res.status(404).json({ message: "Face not found" });

    await db.run(
        "UPDATE known_faces SET name = ?, encoding = ?, image_url = ?, is_wanted = ? WHERE id = ?",
        name ?? current.name,
        encoding ? JSON.stringify(typeof encoding === "string" ? JSON.parse(encoding) : encoding) : current.encoding,
        image_url ?? current.image_url,
        is_wanted === undefined ? current.is_wanted : Number(is_wanted),
        id
    );

    res.json({ ok: true });
});

app.delete("/api/known-faces/:id", auth, async (req, res) => {
    const db = getDb();
    await db.run("DELETE FROM known_faces WHERE id = ?", req.params.id);
    res.json({ ok: true });
});

app.get("/api/history", auth, async (req, res) => {
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
});

app.post("/api/history", auth, async (req, res) => {
    const { name, image = "" } = req.body;
    if (!name) return res.status(400).json({ message: "name required" });
    const db = getDb();
    await db.run("INSERT INTO history (name, image, timestamp) VALUES (?, ?, datetime('now'))", name, image);
    return res.status(201).json({ ok: true });
});

app.delete("/api/history", auth, async (req, res) => {
    const db = getDb();
    await db.run("DELETE FROM history");
    res.json({ ok: true });
});

app.post("/api/subscribe", auth, async (req, res) => {
    const subscription = req.body.subscription;
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
});

app.get("/api/push-key", auth, async (_req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY || null });
});

app.post("/api/alert", auth, async (req, res) => {
    const { name, alert_type = "wanted_match", image = "" } = req.body;
    if (!name) return res.status(400).json({ message: "name required" });

    const db = getDb();
    await db.run("INSERT INTO alerts (name, alert_type, timestamp) VALUES (?, ?, datetime('now'))", name, alert_type);
    await db.run("INSERT INTO history (name, image, timestamp) VALUES (?, ?, datetime('now'))", name, image);

    // Send Email Alert
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        const isUnknown = name.toLowerCase() === "unknown";
        const subject = isUnknown ? `Security Alert: Unknown Person Detected` : `WANTED ALERT: ${name} Detected!`;
        const text = `${name} was detected by the system at ${new Date().toLocaleString()}. See attached image.`;

        const mailOptions = {
            from: `"FaceWatch Security" <${SMTP_USER}>`,
            to: ALERT_TO_EMAIL,
            subject: subject,
            text: text,
            attachments: image ? [{
                filename: `detection-${Date.now()}.jpg`,
                content: image.split("base64,")[1],
                encoding: 'base64'
            }] : []
        };

        transporter.sendMail(mailOptions).catch(err => console.error("Failed to send email alert:", err));
    }

    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const subs = await db.all("SELECT payload FROM push_subscriptions");
        const payload = JSON.stringify({
            title: "FaceWatch Alert",
            body: `${name} detected at ${new Date().toISOString()}`,
            type: alert_type
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

    return res.status(201).json({ ok: true });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

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
