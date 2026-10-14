'use strict';

/**
 * Veritabani baglantisi ve sema.
 *
 * Node'un yerlesik node:sqlite modulu kullanilir; harici native derleme
 * gerektirmez. Veritabani dosyasi data/nexus.db altinda tutulur.
 */

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, 'nexus.db');

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT    NOT NULL,
  full_name       TEXT    NOT NULL,
  role            TEXT    NOT NULL DEFAULT 'user',
  is_blocked      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  price_kurus   INTEGER NOT NULL,
  duration_days INTEGER,
  tagline       TEXT    NOT NULL DEFAULT '',
  features      TEXT    NOT NULL DEFAULT '[]',
  badge         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT    NOT NULL UNIQUE,
  game           TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  summary        TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  features       TEXT    NOT NULL DEFAULT '[]',
  compatibility  TEXT    NOT NULL DEFAULT '',
  price_kurus    INTEGER NOT NULL DEFAULT 0,
  image_key      TEXT    NOT NULL DEFAULT 'default',
  is_active      INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no          TEXT    NOT NULL UNIQUE,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id           INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  plan_name         TEXT    NOT NULL,
  amount_kurus      INTEGER NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'pending',
  payment_provider  TEXT,
  payment_ref       TEXT,
  period_start      TEXT,
  period_end        TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id      INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  plan_name    TEXT    NOT NULL,
  order_id     INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  starts_at    TEXT    NOT NULL,
  ends_at      TEXT,
  is_lifetime  INTEGER NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'active',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'genel',
  status      TEXT    NOT NULL DEFAULT 'open',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS support_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_staff   INTEGER NOT NULL DEFAULT 0,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_member_user   ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_user   ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_message_tick  ON support_messages(ticket_id);
`;

db.exec(SCHEMA);

/* ---------------------------------------------------------------- helpers */

const CACHE = new Map();

/** Tek satir dondurur ya da undefined. */
function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}

/** Tum satirlari dondurur. */
function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

/** Yazma islemi; { changes, lastInsertRowid } dondurur. */
function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

/** Birden fazla yazmayi atomik calistirir. */
function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* yut */ }
    throw err;
  }
}

module.exports = { db, get, all, run, tx, DB_PATH, CACHE };
