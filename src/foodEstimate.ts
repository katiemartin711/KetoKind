// Portion-based macro estimate for common foods. Demo logs use this table.
// A saved meal is listed by the on-device model, then totaled here.

import { finalizeMacros, type MacroGrams } from './macros';

type Measure = 'each' | 'g' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'strip';

interface Food {
  aliases: string[];
  per: Measure;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  /** Grams in 1 of each measure this food can be counted in. */
  grams: Partial<Record<Measure, number>>;
}

// Typical USDA-style cooked values, rounded. Thick-cut bacon is one pan-fried
// slice (~16g). A large egg is ~50g.
const FOODS: Food[] = [
  { aliases: ['thick cut bacon', 'thick-cut bacon'], per: 'strip', protein: 4, fat: 8, carbs: 0, fiber: 0, grams: { strip: 16, g: 1, oz: 28.35 } },
  { aliases: ['bacon'], per: 'strip', protein: 3, fat: 3.3, carbs: 0.1, fiber: 0, grams: { strip: 8, g: 1, oz: 28.35 } },
  { aliases: ['egg'], per: 'each', protein: 6.3, fat: 5, carbs: 0.4, fiber: 0, grams: { each: 50, g: 1, oz: 28.35 } },
  { aliases: ['butter'], per: 'tbsp', protein: 0.1, fat: 11.5, carbs: 0, fiber: 0, grams: { tbsp: 14.2, tsp: 4.7, cup: 227, g: 1, oz: 28.35 } },
  { aliases: ['olive oil'], per: 'tbsp', protein: 0, fat: 14, carbs: 0, fiber: 0, grams: { tbsp: 13.5, tsp: 4.5, cup: 216, g: 1, oz: 28.35 } },
  { aliases: ['avocado oil'], per: 'tbsp', protein: 0, fat: 14, carbs: 0, fiber: 0, grams: { tbsp: 14, tsp: 4.7, cup: 218, g: 1, oz: 28.35 } },
  { aliases: ['coconut oil'], per: 'tbsp', protein: 0, fat: 13.5, carbs: 0, fiber: 0, grams: { tbsp: 13.6, tsp: 4.5, cup: 218, g: 1, oz: 28.35 } },
  { aliases: ['avocado'], per: 'each', protein: 3, fat: 21, carbs: 12, fiber: 10, grams: { each: 150, g: 1, oz: 28.35 } },
  { aliases: ['cheddar'], per: 'oz', protein: 7, fat: 9.4, carbs: 0.4, fiber: 0, grams: { oz: 28.35, g: 1 } },
  { aliases: ['mozzarella'], per: 'oz', protein: 6.3, fat: 6.3, carbs: 0.7, fiber: 0, grams: { oz: 28.35, g: 1 } },
  { aliases: ['cream cheese'], per: 'tbsp', protein: 1.1, fat: 5, carbs: 0.8, fiber: 0, grams: { tbsp: 14.5, oz: 28.35, g: 1 } },
  { aliases: ['heavy cream', 'heavy whipping cream'], per: 'tbsp', protein: 0.4, fat: 5.4, carbs: 0.4, fiber: 0, grams: { tbsp: 15, tsp: 5, cup: 238, g: 1 } },
  { aliases: ['ground beef'], per: 'oz', protein: 6.5, fat: 5.6, carbs: 0, fiber: 0, grams: { oz: 28.35, g: 1 } },
  { aliases: ['beef patty', 'hamburger patty', 'patty'], per: 'each', protein: 26, fat: 22.4, carbs: 0, fiber: 0, grams: { each: 113, oz: 28.35, g: 1 } },
  { aliases: ['cheese'], per: 'each', protein: 7, fat: 9.4, carbs: 0.4, fiber: 0, grams: { each: 28.35, oz: 28.35, g: 1 } },
  { aliases: ['hamburger bun', 'burger bun', 'bun'], per: 'each', protein: 4, fat: 2.5, carbs: 26, fiber: 1, grams: { each: 50, g: 1, oz: 28.35 } },
  { aliases: ['sauce'], per: 'each', protein: 0.2, fat: 5, carbs: 4, fiber: 0, grams: { each: 15, tbsp: 15, g: 1 } },
  { aliases: ['onion'], per: 'each', protein: 0.3, fat: 0, carbs: 2, fiber: 0.4, grams: { each: 25, g: 1, oz: 28.35 } },
  { aliases: ['mustard'], per: 'each', protein: 0.2, fat: 0.2, carbs: 0.5, fiber: 0, grams: { each: 5, tsp: 5, tbsp: 15, g: 1 } },
  { aliases: ['ranch dressing', 'ranch'], per: 'each', protein: 0.4, fat: 10, carbs: 1, fiber: 0, grams: { each: 30, tbsp: 15, g: 1 } },
  { aliases: ['ribeye'], per: 'oz', protein: 7, fat: 8, carbs: 0, fiber: 0, grams: { oz: 28.35, g: 1 } },
  { aliases: ['steak'], per: 'oz', protein: 7, fat: 6, carbs: 0, fiber: 0, grams: { oz: 28.35, g: 1 } },
  { aliases: ['chicken thigh'], per: 'oz', protein: 6.2, fat: 3.5, carbs: 0, fiber: 0, grams: { oz: 28.35, g: 1 } },
  { aliases: ['chicken breast'], per: 'oz', protein: 8, fat: 1, carbs: 0, fiber: 0, grams: { oz: 28.35, g: 1 } },
  { aliases: ['salmon'], per: 'oz', protein: 6.5, fat: 3.8, carbs: 0, fiber: 0, grams: { oz: 28.35, g: 1 } },
  { aliases: ['sausage'], per: 'each', protein: 7, fat: 16, carbs: 1, fiber: 0, grams: { each: 75, g: 1, oz: 28.35 } },
  { aliases: ['spinach'], per: 'cup', protein: 0.9, fat: 0.1, carbs: 1.1, fiber: 0.7, grams: { cup: 30, g: 1, oz: 28.35 } },
  { aliases: ['broccoli'], per: 'cup', protein: 2.5, fat: 0.3, carbs: 6, fiber: 2.4, grams: { cup: 91, g: 1, oz: 28.35 } },
];

const UNIT_WORDS: Record<string, Measure> = {
  cup: 'cup',
  cups: 'cup',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsp: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsp: 'tsp',
  ounce: 'oz',
  ounces: 'oz',
  oz: 'oz',
  gram: 'g',
  grams: 'g',
  g: 'g',
  strip: 'strip',
  strips: 'strip',
  slice: 'strip',
  slices: 'strip',
  piece: 'strip',
  pieces: 'strip',
  each: 'each',
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[½]/g, '1/2')
    .replace(/[⅓]/g, '1/3')
    .replace(/[¼]/g, '1/4')
    .replace(/[¾]/g, '3/4')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseQty(token: string): number | null {
  const mixed = token.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return whole + Number(mixed[2]) / den;
  }
  const frac = token.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (den === 0) return null;
    return Number(frac[1]) / den;
  }
  const n = Number(token);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function segmentsOf(text: string): string[] {
  return normalize(text)
    .replace(/\s+(?:and|with)\s+/g, ',')
    .split(/[,;\n+]|\s+&\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchFood(phrase: string): Food | null {
  let best: { food: Food; len: number } | null = null;
  for (const food of FOODS) {
    for (const alias of food.aliases) {
      const a = normalize(alias);
      const re = new RegExp(`(?:^|\\s)${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?:\\s|$)`);
      if (re.test(phrase) && (best == null || a.length > best.len)) best = { food, len: a.length };
    }
  }
  return best?.food ?? null;
}

function scale(food: Food, qty: number, unit: Measure | null): { protein: number; fat: number; carbs: number; fiber: number } | null {
  // A unit this food is not measured in ("slice" of cheese, "each" bacon)
  // counts as its default portion rather than dropping the food.
  const use = unit != null && food.grams[unit] != null ? unit : food.per;
  const gramsEach = food.grams[use];
  const gramsBasis = food.grams[food.per];
  if (gramsEach == null || gramsBasis == null || gramsBasis === 0) return null;
  const factor = (qty * gramsEach) / gramsBasis;
  return {
    protein: food.protein * factor,
    fat: food.fat * factor,
    carbs: food.carbs * factor,
    fiber: food.fiber * factor,
  };
}

function parseSegment(segment: string): { protein: number; fat: number; carbs: number; fiber: number } | null {
  const sized = segment.replace(/^(?:\d|\s|\/|\.)+\s+(?:large|medium|small|big)\s+/, (m) => m.replace(/\s+(?:large|medium|small|big)\s+/, ' '));
  const m = sized.match(
    /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*(?:(cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|grams?|g|strips?|slices?|pieces?|each)\s+)?(?:of\s+)?(.+)$/,
  );
  let qty = 1;
  let unit: Measure | null = null;
  let phrase = sized;
  if (m) {
    const parsed = parseQty(m[1]);
    if (parsed == null) return null;
    qty = parsed;
    unit = m[2] ? UNIT_WORDS[m[2]] ?? null : null;
    phrase = m[3];
  }
  const food = matchFood(phrase);
  if (!food) return null;
  return scale(food, qty, unit);
}

/** Sum standard portions for foods this table knows. Null when none match. */
export function estimateMealMacros(name: string, notes: string): MacroGrams | null {
  const text = notes.trim() ? `${name} ${notes}` : name;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let fiber = 0;
  let hits = 0;
  for (const segment of segmentsOf(text)) {
    const part = parseSegment(segment);
    if (!part) continue;
    hits += 1;
    protein += part.protein;
    fat += part.fat;
    carbs += part.carbs;
    fiber += part.fiber;
  }
  if (hits === 0) return null;
  const calories = protein * 4 + carbs * 4 + fat * 9;
  return finalizeMacros(protein, fat, carbs, fiber, calories);
}

export interface ListedFood {
  food: string;
  count: number;
  unit: string;
}

interface ListedHit {
  food: Food;
  phrase: string;
  count: number;
  unit: Measure | null;
}

function aliasPattern(alias: string): RegExp {
  const escaped = normalize(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}s?(?:\\s|$)`);
}

function phraseHasAlias(phrase: string, food: Food): boolean {
  const text = normalize(phrase);
  return food.aliases.some((alias) => aliasPattern(alias).test(text));
}

function hitsOverlap(a: ListedHit, b: ListedHit): boolean {
  if (a.food === b.food) return true;
  return phraseHasAlias(a.phrase, b.food) || phraseHasAlias(b.phrase, a.food);
}

function listedUnit(raw: string): Measure | null {
  const token = normalize(raw);
  if (token === '') return null;
  return UNIT_WORDS[token] ?? null;
}

/** Turn a model food list into numbers. Fractions like 1/3 are accepted. */
export function parseListedFoods(text: string): ListedFood[] | null {
  const repaired = text.replace(/:\s*(\d+)\s*\/\s*(\d+)/g, (_match, whole: string, den: string) => {
    const bottom = Number(den);
    if (!bottom) return `: ${whole}/${den}`;
    return `: ${Number(whole) / bottom}`;
  });
  const start = repaired.indexOf('{');
  const end = repaired.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(repaired.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || !('items' in parsed)) return null;
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const listed: ListedFood[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as { food?: unknown; count?: unknown; unit?: unknown };
    const food = typeof row.food === 'string' ? row.food.trim() : '';
    const count = typeof row.count === 'number' ? row.count : Number(row.count);
    const unit = typeof row.unit === 'string' ? row.unit.trim() : '';
    if (!food || !Number.isFinite(count) || count <= 0 || count > 100) continue;
    listed.push({ food, count, unit });
  }
  return listed.length > 0 ? listed : null;
}

function chooseHit(group: ListedHit[]): ListedHit {
  const food = group.reduce((best, hit) => {
    const bestLen = best.food.aliases.reduce((n, alias) => Math.max(n, alias.length), 0);
    const hitLen = hit.food.aliases.reduce((n, alias) => Math.max(n, alias.length), 0);
    return hitLen > bestLen ? hit : best;
  }).food;
  const measured = group.reduce((best, hit) => {
    const bestSpecific = (best.unit ?? best.food.per) === 'each' ? 0 : 1;
    const hitSpecific = (hit.unit ?? hit.food.per) === 'each' ? 0 : 1;
    if (hitSpecific !== bestSpecific) return hitSpecific > bestSpecific ? hit : best;
    return hit.count > best.count ? hit : best;
  });
  return { ...measured, food };
}

export interface ListedFoodsTotal {
  macros: MacroGrams | null;
  /** Food names the table does not know. Their macros are missing from the total. */
  skipped: string[];
}

/** Add the model's food list with this table. Unknown names are skipped. */
export function sumListedFoods(items: ListedFood[]): MacroGrams | null {
  return totalListedFoods(items).macros;
}

/** Same as sumListedFoods, also naming the foods that were not counted. */
export function totalListedFoods(items: ListedFood[]): ListedFoodsTotal {
  const hits: ListedHit[] = [];
  const skipped: string[] = [];
  for (const item of items) {
    const food = matchFood(normalize(item.food));
    if (!food) {
      skipped.push(item.food);
      continue;
    }
    hits.push({ food, phrase: item.food, count: item.count, unit: listedUnit(item.unit) });
  }
  if (hits.length === 0) return { macros: null, skipped };
  const parent = hits.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]];
      cursor = parent[cursor];
    }
    return cursor;
  };
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      if (hitsOverlap(hits[i], hits[j])) parent[find(i)] = find(j);
    }
  }
  const buckets = new Map<number, ListedHit[]>();
  hits.forEach((hit, index) => {
    const root = find(index);
    const list = buckets.get(root) ?? [];
    list.push(hit);
    buckets.set(root, list);
  });
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let fiber = 0;
  let matched = 0;
  for (const group of buckets.values()) {
    const chosen = chooseHit(group);
    const part = scale(chosen.food, chosen.count, chosen.unit);
    if (!part) continue;
    matched += 1;
    protein += part.protein;
    fat += part.fat;
    carbs += part.carbs;
    fiber += part.fiber;
  }
  if (matched === 0) return { macros: null, skipped };
  return { macros: finalizeMacros(protein, fat, carbs, fiber, protein * 4 + carbs * 4 + fat * 9), skipped };
}
