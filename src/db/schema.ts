// Schema: versioned migrations and initDb().
// Bump SCHEMA_VERSION and add a MIGRATIONS entry whenever the schema changes.
import { database } from './client';

/**
 * Schema version. Bump this and add an entry to MIGRATIONS whenever the
 * schema changes — initDb() applies every migration newer than the stored
 * PRAGMA user_version, in order.
 */
const SCHEMA_VERSION = 1;

/** version -> SQL statements to run when upgrading TO that version. */
const MIGRATIONS: Record<number, string[]> = {
  // 2: ['ALTER TABLE ... ADD COLUMN ...'],
};

/** ALTER TABLE ... ADD COLUMN, but only when the column isn't there yet. */
function addColumnIfMissing(table: string, column: string, definition: string): void {
  const cols = database().getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    database().execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Create tables on first launch and make sure the single profile row exists. */
export function initDb(): void {
  database().execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      diet_type TEXT NOT NULL DEFAULT 'carnivore',
      diet_nuances TEXT NOT NULL DEFAULT '',
      goals TEXT NOT NULL DEFAULT '',
      theme_mode TEXT NOT NULL DEFAULT 'system',
      track_weight INTEGER NOT NULL DEFAULT 0,
      starting_weight REAL,
      age INTEGER,
      sex TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      diet_start TEXT,
      dismissed_milestones TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS allergies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL DEFAULT '',
      times_per_day INTEGER NOT NULL DEFAULT 1,
      purpose TEXT NOT NULL DEFAULT '',
      as_needed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS supplements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL DEFAULT '',
      times_per_day INTEGER NOT NULL DEFAULT 1,
      purpose TEXT NOT NULL DEFAULT '',
      as_needed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      meal_type TEXT NOT NULL DEFAULT 'Meal',
      logged_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS med_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      taken_at TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS symptom_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      severity INTEGER NOT NULL DEFAULT 3,
      logged_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS supplement_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      supplement_id INTEGER,
      logged_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight REAL NOT NULL,
      logged_at TEXT NOT NULL
    );
  `);
  // Guarantee the single profile row (id = 1) exists.
  const existing = database().getFirstSync<{ id: number }>('SELECT id FROM profile WHERE id = 1');
  if (!existing) {
    database().runSync("INSERT INTO profile (id, diet_type, diet_nuances, goals) VALUES (1, 'carnivore', '', '')");
  }

  const stored = database().getFirstSync<{ v: number }>('PRAGMA user_version');
  const currentVersion = stored?.v ?? 0;
  if (currentVersion === 0) {
    // Databases created before versioning existed: bring every table up to the
    // v1 schema idempotently. Harmless on fresh installs (columns already there).
    addColumnIfMissing('medications', 'purpose', "TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing('supplements', 'purpose', "TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing('medications', 'as_needed', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing('supplements', 'as_needed', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing('profile', 'track_weight', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing('profile', 'starting_weight', 'REAL');
    addColumnIfMissing('med_logs', 'quantity', 'INTEGER NOT NULL DEFAULT 1');
    addColumnIfMissing('supplement_logs', 'quantity', 'INTEGER NOT NULL DEFAULT 1');
    addColumnIfMissing('profile', 'theme_mode', "TEXT NOT NULL DEFAULT 'system'");
    addColumnIfMissing('profile', 'age', 'INTEGER');
    addColumnIfMissing('profile', 'sex', "TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing('profile', 'bio', "TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing('profile', 'diet_start', 'TEXT');
    addColumnIfMissing('profile', 'dismissed_milestones', "TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing('supplement_logs', 'supplement_id', 'INTEGER');
    // Backfill supplement_id for logs saved before the tap-to-log picker existed.
    const legacySuppLogs = database().getAllSync<{ id: number; name: string }>(
      'SELECT id, name FROM supplement_logs WHERE supplement_id IS NULL',
    );
    for (const row of legacySuppLogs) {
      const match = database().getFirstSync<{ id: number }>(
        'SELECT id FROM supplements WHERE lower(trim(name)) = lower(trim(?))',
        [row.name],
      );
      if (match) {
        database().runSync('UPDATE supplement_logs SET supplement_id = ? WHERE id = ?', [match.id, row.id]);
      }
    }
  }
  // Apply any newer migrations in order, then stamp the version.
  for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
    for (const stmt of MIGRATIONS[v] ?? []) {
      database().execSync(stmt);
    }
  }
  database().execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
