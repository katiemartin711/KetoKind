// A described meal is totaled by the model from the whole text, not by a
// portion-table hit on one word inside that text.

import { NodeSqliteHandle } from './nodeSqliteAdapter';
import { __setDbForTests } from './db/client';
import { addFoodLog, getFoodLog } from './db/logs';
import { initDb } from './db/schema';
import { estimateSavedMeal } from './llm/tasks';

let passed = 0;
let failed = 0;

function ok(cond: boolean, label: string): void {
  if (!cond) throw new Error(`expected truthy: ${label}`);
}

function eq<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}

function setup(): NodeSqliteHandle {
  const handle = new NodeSqliteHandle();
  __setDbForTests(handle);
  initDb();
  return handle;
}

const described = 'Whataburger sweet and spicy bacon burger, no bun, no mustard, extra patty, light sauce';

async function modelReadsTheWholeDescription(): Promise<void> {
  const handle = setup();
  try {
    const id = addFoodLog(described, 'Lunch', 'lettuce wrap', new Date().toISOString());
    let seenUser = '';
    let seenSystem = '';
    const saved = await estimateSavedMeal(id, described, 'lettuce wrap', async (system, user) => {
      seenSystem = system;
      seenUser = user;
      return '{"protein_g":80,"fat_g":70,"carbs_g":20,"fiber_g":1,"calories":1000}';
    });
    eq(saved.stored, true, 'model result stored');
    eq(
      saved.raw,
      '{"protein_g":80,"fat_g":70,"carbs_g":20,"fiber_g":1,"calories":1000}',
      'raw reply is returned',
    );
    eq(seenUser, `${described}\nlettuce wrap`, 'prompt is the whole description');
    ok(seenSystem.includes('entire description'), 'instructions say to read all of it');
    const row = getFoodLog(id);
    eq(row?.protein_g, 80, 'protein comes from the model');
    eq(row?.fat_g, 70, 'fat comes from the model');
    eq(row?.carbs_g, 20, 'carbs come from the model');
    eq(row?.macro_source, 'estimated', 'source');
  } finally {
    handle.close();
  }
}

async function rejectedReplyIsStillReturned(): Promise<void> {
  const handle = setup();
  try {
    const id = addFoodLog(described, 'Dinner', '', new Date().toISOString());
    const raw = '{"protein_g":3,"fat_g":3.3,"carbs_g":0.1,"fiber_g":0,"calories":42.1}';
    const saved = await estimateSavedMeal(id, described, '', async () => raw);
    eq(saved.stored, false, 'a bacon-strip reply is not stored');
    eq(saved.raw, raw, 'raw reply is kept when it is rejected');
    const row = getFoodLog(id);
    eq(row?.protein_g, null, 'no macros written');
    const broken = await estimateSavedMeal(id, described, '', async () => {
      throw new Error('model stopped');
    });
    eq(broken.stored, false, 'a model error is not stored');
    eq(broken.raw, 'model stopped', 'the error text is the raw reply');
  } finally {
    handle.close();
  }
}

modelReadsTheWholeDescription()
  .then(() => rejectedReplyIsStillReturned())
  .then(() => {
    passed += 2;
    console.log(`${passed} passed`);
  })
  .catch((err: unknown) => {
    failed += 1;
    console.error(`FAIL: model reads the whole description\n  ${err instanceof Error ? err.message : err}`);
    console.error(`${failed} failed, ${passed} passed`);
    process.exit(1);
  });
