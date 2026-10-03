import { parseListedFoods, sumListedFoods } from './foodEstimate';

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

function eq<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}

function ok(cond: boolean, label: string): void {
  if (!cond) throw new Error(`expected truthy: ${label}`);
}

const burgerReply = `{
  "items": [
    {"food": "beef patty", "count": 2, "unit": "each"},
    {"food": "cheese", "count": 1, "unit": "each"},
    {"food": "bacon", "count": 1, "unit": "strip"},
    {"food": "extra patty", "count": 1, "unit": "each"},
    {"food": "onion", "count": 2, "unit": "each"},
    {"food": "sauce", "count": 0.5, "unit": "each"}
  ]
}`;

check('a repeated patty is counted once at the higher number', () => {
  const items = parseListedFoods(burgerReply);
  ok(items != null, 'parsed');
  const meal = items ? sumListedFoods(items) : null;
  ok(meal != null && meal.proteinG > 55 && meal.proteinG < 70, 'two patties plus cheese and bacon');
  ok(meal != null && meal.carbsG < 12, 'no bun in the list');
  ok(meal != null && meal.fatG > 50, 'fat from the patties');
});

check('a fraction cup and a measured steak survive the model text', () => {
  const eggs = parseListedFoods(
    '{"items":[{"food":"egg","count":6,"unit":"each"},{"food":"bacon","count":3,"unit":"strip"},{"food":"butter","count":1/3,"unit":"cup"}]}',
  );
  const eggMeal = eggs ? sumListedFoods(eggs) : null;
  ok(eggMeal != null && eggMeal.proteinG > 40 && eggMeal.fatG > 90, 'eggs, bacon, and a third cup of butter');
  const steak = parseListedFoods(
    '{"items":[{"food":"ribeye steak","count":1,"unit":"each"},{"food":"steak","count":1,"unit":"each"},{"food":"steak","count":12,"unit":"ounce"}]}',
  );
  const steakMeal = steak ? sumListedFoods(steak) : null;
  ok(steakMeal != null && steakMeal.proteinG > 70 && steakMeal.proteinG < 100, '12 ounces of ribeye');
  eq(parseListedFoods('{"protein_g":3,"fat_g":3.3}'), null, 'a macro object is not a food list');
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
