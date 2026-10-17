import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

// Pilot uses SQLite (built into Node 22+) so the app runs with zero external services.
// All SQL lives in src/lib/*.ts — swapping to Postgres later means porting those queries.

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "activations.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS activations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  artist_name TEXT NOT NULL,
  tour_name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  offer_headline TEXT NOT NULL,
  offer_terms TEXT,
  promoter_name TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0B0B0C',
  accent_color TEXT NOT NULL DEFAULT '#E8C547',
  text_color TEXT NOT NULL DEFAULT '#FFFFFF',
  hero_image_url TEXT,
  privacy_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','ended')),
  pass_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS shows (
  id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  show_date TEXT NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude REAL,
  longitude REAL
);
CREATE INDEX IF NOT EXISTS shows_activation ON shows(activation_id, show_date);

CREATE TABLE IF NOT EXISTS fans (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  first_name TEXT,
  last_name TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('codes','redemptions')),
  filename TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','assigned','redeemed')),
  import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
  assigned_at TEXT,
  redeemed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (activation_id, code)
);
CREATE INDEX IF NOT EXISTS promo_codes_pool ON promo_codes(activation_id, status);

CREATE TABLE IF NOT EXISTS opt_ins (
  id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  fan_id TEXT NOT NULL REFERENCES fans(id) ON DELETE CASCADE,
  promo_code_id TEXT NOT NULL UNIQUE REFERENCES promo_codes(id),
  pass_token TEXT NOT NULL UNIQUE,
  consent_artist INTEGER NOT NULL DEFAULT 0,
  consent_promoter INTEGER NOT NULL DEFAULT 0,
  consent_atvenu INTEGER NOT NULL DEFAULT 0,
  consent_snapshot TEXT NOT NULL,
  source TEXT,
  ip TEXT,
  user_agent TEXT,
  apple_pass_at TEXT,
  google_pass_at TEXT,
  email_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (activation_id, fan_id)
);

CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  promo_code_id TEXT REFERENCES promo_codes(id),
  order_ref TEXT NOT NULL,
  order_total REAL,
  currency TEXT,
  item_count INTEGER,
  redeemed_at TEXT,
  venue TEXT,
  city TEXT,
  import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (activation_id, code, order_ref)
);
CREATE INDEX IF NOT EXISTS redemptions_code ON redemptions(activation_id, code);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  opt_in_id TEXT REFERENCES opt_ins(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','logged','failed')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

const globalForDb = globalThis as unknown as { __activationsDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!globalForDb.__activationsDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    conn.exec(SCHEMA);
    globalForDb.__activationsDb = conn;
  }
  return globalForDb.__activationsDb;
}

/** Runs fn inside a write transaction; rolls back on throw. */
export function tx<T>(fn: (conn: DatabaseSync) => T): T {
  const conn = db();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(conn);
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

export const newId = () => randomUUID();
export const newToken = () => randomBytes(18).toString("base64url");
export const nowIso = () => new Date().toISOString();
