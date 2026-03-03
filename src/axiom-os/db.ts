/**
 * 公理OS — SQLite データベース接続・スキーマ
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS persons (
  id               TEXT PRIMARY KEY,
  name_ja          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  period           TEXT NOT NULL,
  region           TEXT NOT NULL,
  domains          TEXT NOT NULL DEFAULT '[]',
  core_axiom       TEXT NOT NULL DEFAULT '',
  thought_keywords TEXT NOT NULL DEFAULT '[]',
  is_free          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS theories (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  axiom         TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
  constant_ref  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS axioms (
  id                   TEXT PRIMARY KEY,
  concept              TEXT NOT NULL,
  name_ja              TEXT NOT NULL,
  name_en              TEXT NOT NULL,
  tier                 TEXT NOT NULL DEFAULT 'foundation',
  category             TEXT NOT NULL DEFAULT 'philosophy',
  definition           TEXT NOT NULL,
  detailed_explanation TEXT NOT NULL DEFAULT '',
  related_concepts     TEXT NOT NULL DEFAULT '[]',
  tags                 TEXT NOT NULL DEFAULT '[]',
  is_free              INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memories (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL DEFAULT 'task_execution',
  timestamp  INTEGER NOT NULL,
  context    TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL,
  tags       TEXT NOT NULL DEFAULT '[]',
  outcome    TEXT NOT NULL DEFAULT 'success',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/**
 * SQLite データベース接続を開く。テーブルが存在しなければ自動作成。
 */
export function openDatabase(dbPath: string = ':memory:'): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

export const DEFAULT_DB_PATH = path.join(
  process.env.APPDATA || process.env.HOME || '.',
  '.rei-aios',
  'axiom-os.db',
);
