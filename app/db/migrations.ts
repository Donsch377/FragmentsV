import type { SQLiteDatabase } from "expo-sqlite";

const STATEMENTS: string[] = [
  `PRAGMA journal_mode = 'wal';`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY
  );`,
  `CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    PRIMARY KEY (group_id, user_id)
  );`,
  `CREATE TABLE IF NOT EXISTS fragments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    group_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS fragment_items (
    id TEXT PRIMARY KEY,
    fragment_id TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT,
    base_qty REAL NOT NULL DEFAULT 0,
    base_unit TEXT NOT NULL,
    display_qty REAL,
    display_unit TEXT,
    notes TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS user_prefs (
    user_id TEXT PRIMARY KEY,
    likes TEXT,
    dislikes TEXT,
    allergies TEXT,
    nutrition_prefs TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    fragment_id TEXT NOT NULL,
    summary TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS recipe_steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    text TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_fragments_user ON fragments(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_fragments_group ON fragments(group_id);`,
  `CREATE INDEX IF NOT EXISTS idx_items_fragment ON fragment_items(fragment_id);`,
  `CREATE INDEX IF NOT EXISTS idx_items_barcode ON fragment_items(barcode);`,
];

export const applyMigrations = (db: SQLiteDatabase) => {
  // Enable FKs and run statements. Use a safe fallback if a transaction fails.
  try {
    db.execSync("PRAGMA foreign_keys = ON;");
    db.withTransactionSync(() => {
      STATEMENTS.forEach((sql) => db.execSync(sql));
    });
  } catch (e) {
    // Fallback: run sequentially outside transaction to maximize compatibility
    try {
      STATEMENTS.forEach((sql) => db.execSync(sql));
    } catch (inner) {
      // Surface a concise error; repos will log context
      throw inner;
    }
  }
};
