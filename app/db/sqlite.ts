import * as SQLite from "expo-sqlite";
import type {
  SQLiteBindParams,
  SQLiteDatabase,
  SQLiteRunResult,
} from "expo-sqlite";
import { applyMigrations } from "./migrations";

let database: SQLiteDatabase | null = null;

const ensureDatabase = (): SQLiteDatabase => {
  if (!database) {
    database = SQLite.openDatabaseSync("fragments.db");
    applyMigrations(database);
  }

  return database;
};

export const getDB = () => ensureDatabase();

export const queryAsync = async <T>(
  sql: string,
  params: SQLiteBindParams = []
) => {
  const db = ensureDatabase();
  return db.getAllAsync<T>(sql, params);
};

export const runAsync = (
  sql: string,
  params: SQLiteBindParams = []
): Promise<SQLiteRunResult> => {
  const db = ensureDatabase();
  return db.runAsync(sql, params);
};

export const withTransaction = async (task: () => Promise<void>) => {
  const db = ensureDatabase();
  await db.withTransactionAsync(task);
};
