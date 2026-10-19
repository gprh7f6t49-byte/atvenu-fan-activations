import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

// Pilot uses SQLite (built into Node 22+) so the app runs with zero external services.
// All SQL lives in src/lib/*.ts — swapping to Postgres later means porting those queries.

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "activations.db");

const SCHEMA = `
-- A client account (e.g. a merch company). Tours and activations belong to one.
CREATE TABLE IF NOT EXISTS organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- platform_admin = atVenu staff (no organisation, sees everything);
-- org_admin / org_member = a client's users, limited to their organisation.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('platform_admin','org_admin','org_member')),
  organisation_id TEXT REFERENCES organisations(id) ON DELETE CASCADE,
  password_hash TEXT,
  password_version INTEGER NOT NULL DEFAULT 1,
  disabled INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- One-time links to set a password (invites and resets). Only a hash of the token is stored.
CREATE TABLE IF NOT EXISTS password_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('invite','reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

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

CREATE TABLE IF NOT EXISTS tours (
  id TEXT PRIMARY KEY,
  artist_name TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tour_dates (
  id TEXT PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  show_date TEXT NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude REAL,
  longitude REAL
);
CREATE INDEX IF NOT EXISTS tour_dates_tour ON tour_dates(tour_id, show_date);

-- PIN-protected self sign-up URLs (one per city) for crew / comp activations.
-- The PIN is a shared access code circulated with the link, so it is stored readable for admins.
CREATE TABLE IF NOT EXISTS signup_links (
  id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  label TEXT,
  pin TEXT NOT NULL,
  pin_version INTEGER NOT NULL DEFAULT 1,
  pass_scope TEXT NOT NULL DEFAULT 'city' CHECK (pass_scope IN ('city','tour')),
  expires_at TEXT,
  max_signups INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

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

// Columns added after the first pilot release. Applied on start-up so existing
// databases upgrade in place.
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  // fan = public opt-in page; crew = staff discount; comp = venue / management comps
  ["activations", "kind", "TEXT NOT NULL DEFAULT 'fan' CHECK (kind IN ('fan','crew','comp'))"],
  ["activations", "discount_type", "TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','amount'))"],
  ["activations", "discount_value", "REAL"],
  ["activations", "discount_currency", "TEXT"],
  // 1 = each code is good for one order (fans, comps); 0 = reusable all tour (crew)
  ["activations", "single_use", "INTEGER NOT NULL DEFAULT 1"],
  ["opt_ins", "role", "TEXT"],
  ["opt_ins", "recipient_group", "TEXT"],
  ["opt_ins", "organisation", "TEXT"],
  ["opt_ins", "issued_by_admin", "INTEGER NOT NULL DEFAULT 0"],
  ["opt_ins", "revoked_at", "TEXT"],
  ["redemptions", "discount_amount", "REAL"],
  // When set, the activation's dates come from the tour rather than its own shows.
  ["activations", "tour_id", "TEXT REFERENCES tours(id) ON DELETE SET NULL"],
  ["opt_ins", "signup_link_id", "TEXT REFERENCES signup_links(id) ON DELETE SET NULL"],
  // Per-pass validity, e.g. local crew whose pass only covers their city's dates.
  ["opt_ins", "valid_from", "TEXT"],
  ["opt_ins", "valid_until", "TEXT"],
  ["tours", "organisation_id", "TEXT REFERENCES organisations(id) ON DELETE CASCADE"],
  ["activations", "organisation_id", "TEXT REFERENCES organisations(id) ON DELETE CASCADE"],
];

export const DEFAULT_ORG_NAME = "atVenu Demo";

function migrate(conn: DatabaseSync) {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
  // Data from before client accounts existed moves into a default organisation.
  const orphans = conn
    .prepare("SELECT (SELECT COUNT(*) FROM tours WHERE organisation_id IS NULL) + (SELECT COUNT(*) FROM activations WHERE organisation_id IS NULL) AS n")
    .get() as { n: number };
  if (orphans.n > 0) {
    let org = conn.prepare("SELECT id FROM organisations WHERE name = ?").get(DEFAULT_ORG_NAME) as { id: string } | undefined;
    if (!org) {
      org = { id: randomUUID() };
      conn.prepare("INSERT INTO organisations (id, name) VALUES (?, ?)").run(org.id, DEFAULT_ORG_NAME);
    }
    conn.prepare("UPDATE tours SET organisation_id = ? WHERE organisation_id IS NULL").run(org.id);
    conn.prepare("UPDATE activations SET organisation_id = ? WHERE organisation_id IS NULL").run(org.id);
  }
}

const globalForDb = globalThis as unknown as { __activationsDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!globalForDb.__activationsDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    conn.exec(SCHEMA);
    migrate(conn);
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
