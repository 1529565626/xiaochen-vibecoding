import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

function getDataDir() {
  // release: ./data/ relative to CWD; dev: server/data/
  const candidates = [
    join(process.cwd(), 'data'),
    resolve(process.cwd(), '../data'),
  ];
  for (const p of candidates) {
    // 返回第一个可用的，优先在 release 模式创建
    return p;
  }
  return join(process.cwd(), 'data');
}

const DB_PATH = join(getDataDir(), 'uploads.db');

let db;

async function initDb() {
  const SQL = await initSqlJs();

  const dataDir = getDataDir();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS uploads (
      id          TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      target_path TEXT NOT NULL,
      total_size  INTEGER NOT NULL,
      chunk_size  INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL,
      status      TEXT DEFAULT 'uploading',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    )
  `);
  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

// sql.js compatible wrappers that mimic better-sqlite3's API

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

export { initDb, saveDb, closeDb, dbRun, dbGet, dbAll };
