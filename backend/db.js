const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcryptjs");

let db;

async function initDb(config) {
  db = await open({
    filename: path.join(__dirname, "facewatch.db"),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS known_faces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      encoding TEXT NOT NULL,
      image_url TEXT,
      is_wanted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      image TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      alert_type TEXT NOT NULL,
      confidence REAL DEFAULT NULL,
      detection_status TEXT DEFAULT 'unknown'
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      pin_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT UNIQUE NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      threshold REAL NOT NULL DEFAULT 0.55,
      sound_alert INTEGER NOT NULL DEFAULT 1,
      push_notifications INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migrate legacy databases without dropping data.
  const alertsColumns = await db.all("PRAGMA table_info(alerts)");
  const alertColumnNames = new Set(alertsColumns.map((column) => column.name));
  if (!alertColumnNames.has("confidence")) {
    await db.exec("ALTER TABLE alerts ADD COLUMN confidence REAL DEFAULT NULL");
  }
  if (!alertColumnNames.has("detection_status")) {
    await db.exec("ALTER TABLE alerts ADD COLUMN detection_status TEXT DEFAULT 'unknown'");
  }

  const user = await db.get("SELECT * FROM users WHERE username = ?", config.adminUser);
  if (!user) {
    const passwordHash = await bcrypt.hash(config.adminPassword, 10);
    const pinHash = await bcrypt.hash(config.adminPin, 10);
    await db.run(
      "INSERT INTO users (username, password_hash, pin_hash) VALUES (?, ?, ?)",
      config.adminUser,
      passwordHash,
      pinHash
    );
    const created = await db.get("SELECT id FROM users WHERE username = ?", config.adminUser);
    if (created) {
      await db.run(
        "INSERT OR IGNORE INTO user_settings (user_id, threshold, sound_alert, push_notifications) VALUES (?, ?, ?, ?)",
        created.id,
        0.55,
        1,
        1
      );
    }
  } else {
    const passwordMatches = await bcrypt.compare(config.adminPassword, user.password_hash);
    const pinMatches = await bcrypt.compare(String(config.adminPin), user.pin_hash);

    if (!passwordMatches || !pinMatches) {
      const nextPasswordHash = passwordMatches ? user.password_hash : await bcrypt.hash(config.adminPassword, 10);
      const nextPinHash = pinMatches ? user.pin_hash : await bcrypt.hash(String(config.adminPin), 10);

      await db.run(
        "UPDATE users SET password_hash = ?, pin_hash = ? WHERE id = ?",
        nextPasswordHash,
        nextPinHash,
        user.id
      );
    }

    await db.run(
      "INSERT OR IGNORE INTO user_settings (user_id, threshold, sound_alert, push_notifications) VALUES (?, ?, ?, ?)",
      user.id,
      0.55,
      1,
      1
    );
  }

  return db;
}

function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}

module.exports = { initDb, getDb };
