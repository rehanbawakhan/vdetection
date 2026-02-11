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
      alert_type TEXT NOT NULL
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
  `);

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
  }

  return db;
}

function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}

module.exports = { initDb, getDb };
