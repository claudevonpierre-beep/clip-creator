/**
 * db.js — SQLite database using Node v22+ built-in node:sqlite
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DATA_DIR: use env var for Railway persistent volume, otherwise local ./data
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DATABASE_URL || path.join(DATA_DIR, 'clips.db');

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE,
    name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    email TEXT,
    created_by INTEGER REFERENCES users(id),
    used_by INTEGER REFERENCES users(id),
    used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    show TEXT,
    episode_name TEXT,
    guest TEXT DEFAULT '',
    analysis_json TEXT,
    word_count INTEGER DEFAULT 0,
    share_token TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS thumbnail_edits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
    clip_id TEXT,
    quote_text TEXT DEFAULT '',
    producer_brief TEXT DEFAULT '',
    drive_link TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

try { db.exec("ALTER TABLE episodes ADD COLUMN transcript TEXT DEFAULT ''"); } catch(e) {}

export default db;
