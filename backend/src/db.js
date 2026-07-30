import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The database file lives in backend/data/waste.db and is git-ignored (*.db),
// so a fresh clone always starts with a clean, freshly seeded database.
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '..', 'data', 'waste.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

// WAL keeps reads fast while scans are being written during a live demo.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Tables are created here, in the same module that opens the connection, on
 * purpose. Route modules prepare their statements at import time, and ES
 * modules finish all imports before any importing file's own code runs — so a
 * separate init() called from server.js would run too late and every route
 * would throw "no such table" against an empty database. Creating them here
 * means importing `db` at all guarantees a schema-ready database.
 *
 * Unit convention: every confidence value in this app — both the stored scan
 * confidences and the threshold setting — is a FRACTION between 0 and 1.
 * The UI multiplies by 100 for display. Nothing stores percentages.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,
    color        TEXT    NOT NULL,
    disposal_tip TEXT    NOT NULL DEFAULT '',
    impact_text  TEXT    NOT NULL DEFAULT '',
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'string',
    label      TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Maps a keyword found in the classifier's output label to a category.
  -- The model says "water bottle"; the keyword "bottle" routes it to
  -- Recyclable. Editable in admin, so a wrong guess is fixable live.
  CREATE TABLE IF NOT EXISTS label_map (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword     TEXT    NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- The label column holds the item name and stays the display field everywhere.
  -- The remaining columns carry what Gemini returns per item, which is the whole
  -- reason for v2: a real name, what the thing is made of, and disposal steps
  -- written for THAT object rather than boilerplate for its bin.
  CREATE TABLE IF NOT EXISTS scans (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id          INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    label                TEXT    NOT NULL DEFAULT '',
    item_description     TEXT    NOT NULL DEFAULT '',
    material             TEXT    NOT NULL DEFAULT '',
    disposal_instructions TEXT   NOT NULL DEFAULT '',
    environmental_note   TEXT    NOT NULL DEFAULT '',
    engine               TEXT    NOT NULL DEFAULT 'gemini',
    confidence           REAL    NOT NULL,
    source               TEXT    NOT NULL CHECK (source IN ('live', 'snap', 'sample')),
    created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scans_created  ON scans(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_scans_category ON scans(category_id);
  CREATE INDEX IF NOT EXISTS idx_label_keyword  ON label_map(keyword);
`);

/**
 * Adds any column the running code expects but an older database file lacks.
 *
 * A v1 database copied across, or one created before these columns existed,
 * would otherwise throw "no such column" on the first scan. SQLite has no
 * "ADD COLUMN IF NOT EXISTS", so the current columns are read first.
 */
function ensureScanColumns() {
  const existing = new Set(db.prepare('PRAGMA table_info(scans)').all().map((c) => c.name));
  const wanted = [
    ['item_description', "TEXT NOT NULL DEFAULT ''"],
    ['material', "TEXT NOT NULL DEFAULT ''"],
    ['disposal_instructions', "TEXT NOT NULL DEFAULT ''"],
    ['environmental_note', "TEXT NOT NULL DEFAULT ''"],
    ['engine', "TEXT NOT NULL DEFAULT 'gemini'"]
  ];

  for (const [name, definition] of wanted) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE scans ADD COLUMN ${name} ${definition}`);
      console.log(`[db] added missing scans.${name}`);
    }
  }
}

ensureScanColumns();

export { DB_PATH };
