import { parseListedFoods, sumListedFoods, totalListedFoods } from './foodEstimate';

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

// Whataburger Sweet & Spicy Bacon Burger, no bun, extra patty, no mustard,
// light onions, light sauce. Whataburger's calculator: 970 kcal, 68 P, 74 F, 6 C.
const whataburgerOrder = [
  { food: 'beef patty', count: 2, unit: 'each' },
  { food: 'cheese', count: 1, unit: 'each' },
  { food: 'bacon', count: 2, unit: 'strip' },
  { food: 'onion', count: 0.5, unit: 'each' },
  { food: 'sweet and spicy sauce', count: 0.5, unit: 'each' },
];

check('a unit the table lacks for that food counts as its default portion', () => {
  const strict = sumListedFoods(whataburgerOrder);
  const loose = sumListedFoods(
    whataburgerOrder.map((item) =>
      item.food === 'cheese' ? { ...item, unit: 'slice' } : item.food === 'bacon' ? { ...item, unit: 'each' } : item,
    ),
  );
  eq(loose, strict, '"slice" of cheese and "each" bacon are not dropped');
  ok(strict != null && strict.proteinG > 60 && strict.fatG > 55 && strict.carbsG < 8, 'close to the Whataburger reference');
});

check('foods the table does not know are named, not silently dropped', () => {
  const { macros, skipped } = totalListedFoods([
    ...whataburgerOrder,
    { food: 'jalapenos', count: 3, unit: 'each' },
    { food: 'monterey jack', count: 1, unit: 'slice' },
  ]);
  eq(skipped, ['jalapenos', 'monterey jack'], 'skipped names');
  eq(macros, sumListedFoods(whataburgerOrder), 'known foods still total');
  eq(totalListedFoods([{ food: 'jalapenos', count: 3, unit: 'each' }]), { macros: null, skipped: ['jalapenos'] }, 'nothing known');
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
