-- EVE Assist v1 — initial D1 schema.
-- Table/column shapes are pinned in ROADMAP.md's cross-module contract; do
-- not rename or restructure without updating every agent that depends on
-- them (src/db/store.mjs first).

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER UNIQUE NOT NULL,
  character_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE esi_tokens (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  access_token_sealed TEXT NOT NULL,
  refresh_token_sealed TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  scopes TEXT NOT NULL
);

CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  gemini_key_sealed TEXT,
  gemini_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash'
);

CREATE TABLE mcp_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

CREATE TABLE observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  params_json TEXT NOT NULL,
  status INTEGER NOT NULL,
  body_json TEXT NOT NULL,
  expires_at INTEGER,
  recorded_at INTEGER NOT NULL
);

CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
