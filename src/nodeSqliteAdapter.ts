// Test-only SQLite handle backed by node:sqlite (in-memory). Implements the
// DbHandle surface db.ts needs, so backup/restore tests run the REAL db.ts
// code paths against a real SQL engine under Node. Never imported by the app.

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { DbHandle } from './db';

export class NodeSqliteHandle implements DbHandle {
  private db = new DatabaseSync(':memory:');
  private failAtWrite: number | null = null;
  private writeCount = 0;

  /**
   * Test hook: throw on the nth subsequent runSync call (1-based), then
   * disarm. Lets rollback tests simulate an I/O failure mid-transaction.
   */
  armWriteFailure(at: number): void {
    this.failAtWrite = at;
    this.writeCount = 0;
  }

  getAllSync<T>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...(params as SQLInputValue[])) as T[];
  }

  getFirstSync<T>(sql: string, params: unknown[] = []): T | null {
    const row = this.db.prepare(sql).get(...(params as SQLInputValue[])) as T | undefined;
    return row ?? null;
  }

  runSync(sql: string, params: unknown[] = []): void {
    this.writeCount += 1;
    if (this.failAtWrite !== null && this.writeCount >= this.failAtWrite) {
      const at = this.failAtWrite;
      this.failAtWrite = null;
      throw new Error(`simulated write failure at write #${at}`);
    }
    this.db.prepare(sql).run(...(params as SQLInputValue[]));
  }

  execSync(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Mirrors expo-sqlite's withTransactionSync semantics (per the v57 docs:
   * "automatically commit/rollback based on the task result") — a throw
   * inside the task rolls everything back.
   */
  withTransactionSync(task: () => void): void {
    this.db.exec('BEGIN');
    try {
      task();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  close(): void {
    this.db.close();
  }
}
