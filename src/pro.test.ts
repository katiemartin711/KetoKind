// Pro entitlement tests: flag persistence, the v3 migration, delete-all
// reset, and the (simulated) purchase helpers in src/pro.ts.
// Runs the REAL db code against an in-memory SQLite (node:sqlite) via the
// injectable DbHandle. Run with: npm test

import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { __setDbForTests, database } from './db/client';
import { deleteAllData, getProStatus, saveProfile, setProStatus } from './db/profile';
import { initDb } from './db/schema';
import {
  grantPro,
  isProUser,
  requestPurchase,
  restorePurchase,
  revokePro,
} from './pro';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`);
  }
}

async function checkAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`);
  }
}

function eq<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}

/** Fresh in-memory database with the real schema, installed as db's handle. */
function setup(): void {
  const handle = new NodeSqliteHandle();
  __setDbForTests(handle);
  initDb();
}

check('pro flag defaults to false on a fresh database', () => {
  setup();
  eq(getProStatus(), false, 'getProStatus fresh');
  eq(isProUser(), false, 'isProUser fresh');
});

check('pro flag round-trips through set/get', () => {
  setup();
  setProStatus(true);
  eq(getProStatus(), true, 'after set true');
  setProStatus(false);
  eq(getProStatus(), false, 'after set false');
});

check('v3 migration adds is_pro with default 0 to a pre-v3 profile', () => {
  setup();
  saveProfile('keto', '', '', null, '', 'bio text', null, 'Katie');
  // Simulate a database created before v3: drop the column, rewind the version.
  database().execSync('ALTER TABLE profile DROP COLUMN is_pro');
  database().execSync('PRAGMA user_version = 2');
  initDb(); // re-running initDb applies migration 3
  const cols = database().getAllSync<{ name: string; dflt_value: string | null }>(
    'PRAGMA table_info(profile)',
  );
  const col = cols.find((c) => c.name === 'is_pro');
  if (!col) throw new Error('is_pro column missing after migration');
  eq(col.dflt_value, '0', 'is_pro default');
  eq(getProStatus(), false, 'existing profiles are not grandfathered into Pro');
  // The pre-existing profile data survives the migration.
  const row = database().getFirstSync<{ name: string; bio: string }>(
    'SELECT name, bio FROM profile WHERE id = 1',
  );
  eq(row?.name, 'Katie', 'name preserved');
  eq(row?.bio, 'bio text', 'bio preserved');
});

check('v3 migration preserves an already-set is_pro (idempotent)', () => {
  setup();
  setProStatus(true);
  database().execSync('ALTER TABLE profile DROP COLUMN is_pro');
  // Re-add the column by hand with the flag set, as if a newer client wrote it.
  database().execSync('ALTER TABLE profile ADD COLUMN is_pro INTEGER NOT NULL DEFAULT 0');
  database().execSync('UPDATE profile SET is_pro = 1 WHERE id = 1');
  database().execSync('PRAGMA user_version = 2');
  initDb(); // addColumnIfMissing must skip the existing column
  eq(getProStatus(), true, 'existing Pro flag preserved');
});

check('delete-all resets the Pro flag', () => {
  setup();
  setProStatus(true);
  deleteAllData();
  eq(getProStatus(), false, 'is_pro after deleteAllData');
});

check('grantPro/revokePro flip the entitlement', () => {
  setup();
  grantPro();
  eq(isProUser(), true, 'after grantPro');
  revokePro();
  eq(isProUser(), false, 'after revokePro');
});

async function main(): Promise<void> {
  await checkAsync('requestPurchase (test mode) grants Pro', async () => {
    setup();
    revokePro();
    const result = await requestPurchase();
    eq(result, 'purchased', 'purchase result');
    eq(isProUser(), true, 'pro after simulated purchase');
  });

  await checkAsync('restorePurchase finds nothing when free, confirms when Pro', async () => {
    setup();
    eq(await restorePurchase(), false, 'restore while free');
    grantPro();
    eq(await restorePurchase(), true, 'restore while Pro');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} test(s) failed`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
