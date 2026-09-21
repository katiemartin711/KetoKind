// Database connection for the KetoKind app.
// Owns the injectable DbHandle, the lazy expo-sqlite open, and the test hook.
import type * as SQLite from 'expo-sqlite';

/**
 * Minimal synchronous database surface this module needs. In production it is
 * implemented by expo-sqlite (see database() below); tests inject an
 * in-memory replacement via __setDbForTests().
 */
export interface DbHandle {
  getAllSync<T>(sql: string, params?: unknown[]): T[];
  getFirstSync<T>(sql: string, params?: unknown[]): T | null;
  runSync(sql: string, params?: unknown[]): void;
  execSync(sql: string): void;
  withTransactionSync(task: () => void): void;
}

let db: DbHandle | null = null;

/**
 * The live database handle, opened lazily on first use. Laziness — plus the
 * require() instead of a top-level import — keeps the native expo-sqlite
 * module out of Node test bundles: tests call __setDbForTests() before any
 * database access, so require('expo-sqlite') never runs there.
 *
 * Exported for the other modules under src/db/ (and the barrel re-export).
 */
export function database(): DbHandle {
  if (!db) {
    const sqlite = require('expo-sqlite') as typeof SQLite;
    // expo-sqlite's parameter typings require `params`; at runtime the
    // argument is optional (existing call sites omit it), matching DbHandle.
    db = sqlite.openDatabaseSync('ketokind.db') as unknown as DbHandle;
  }
  return db;
}

/**
 * Test-only: swap the database handle (e.g. an in-memory SQLite when running
 * under Node). Production code never calls this.
 */
export function __setDbForTests(handle: DbHandle): void {
  db = handle;
}

/**
 * Close the live handle (if the underlying driver supports it) and forget it,
 * so the next database() call re-opens. Required before deleting the database
 * file (expo-sqlite's deleteDatabaseSync): the file can't be removed while an
 * open handle points at it, and a stale handle would keep writing to the
 * deleted file afterwards.
 */
export function closeDatabase(): void {
  try {
    (db as unknown as { closeSync?: () => void } | null)?.closeSync?.();
  } finally {
    db = null;
  }
}
