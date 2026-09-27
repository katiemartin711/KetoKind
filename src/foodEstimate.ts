// Portion-based macro estimate for common foods. A 0.5B model will happily
// answer "6 eggs and bacon" with about 1g of protein, so known foods are
// totaled from standard portions before the model is asked.

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

const DISH_WORD = /\b(?:cheeseburgers?|burgers?|sandwiches?|tacos?|wraps?)\b/;

function matchFood(phrase: string): Food | null {
  let best: { food: Food; len: number } | null = null;
  for (const food of FOODS) {
    for (const alias of food.aliases) {
      const a = normalize(alias);
      const re = new RegExp(`(?:^|\\s)${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?:\\s|$)`);
      // "bacon" inside "bacon burger" is one word of a dish, not a strip of bacon.
      if (DISH_WORD.test(phrase) && !DISH_WORD.test(a)) continue;
      if (re.test(phrase) && (best == null || a.length > best.len)) best = { food, len: a.length };
    }
  }
  return best?.food ?? null;
}

function scale(food: Food, qty: number, unit: Measure | null): { protein: number; fat: number; carbs: number; fiber: number } | null {
  const use = unit ?? food.per;
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

type Grams = { protein: number; fat: number; carbs: number; fiber: number };

// Sweet & Spicy Bacon Burger on a 5" bun, as listed by the restaurant:
// about 60g protein, 62g fat, 69g carbs, 3g fiber. That build is two beef
// patties, bacon, cheese, sauce, mustard, and the bun.
const SWEET_SPICY_BACON_BURGER: Grams = { protein: 60, fat: 62, carbs: 69, fiber: 3 };

// The 5" bun those listings include. "No bun" takes this back off.
const BURGER_BUN: Grams = { protein: 5, fat: 4, carbs: 30, fiber: 2 };

function foodByAlias(alias: string): Food {
  const food = FOODS.find((item) => item.aliases.includes(alias));
  if (!food) throw new Error(`missing portion for ${alias}`);
  return food;
}

function portion(alias: string, qty: number, unit: Measure): Grams {
  const scaled = scale(foodByAlias(alias), qty, unit);
  if (!scaled) throw new Error(`cannot scale ${alias}`);
  return scaled;
}

function shift(base: Grams, delta: Grams, sign: 1 | -1): Grams {
  return {
    protein: Math.max(0, base.protein + sign * delta.protein),
    fat: Math.max(0, base.fat + sign * delta.fat),
    carbs: Math.max(0, base.carbs + sign * delta.carbs),
    fiber: Math.max(0, base.fiber + sign * delta.fiber),
  };
}

function macrosFrom(parts: Grams): MacroGrams | null {
  const calories = parts.protein * 4 + parts.carbs * 4 + parts.fat * 9;
  return finalizeMacros(parts.protein, parts.fat, parts.carbs, parts.fiber, calories);
}

function leftOff(text: string, item: string): boolean {
  return new RegExp(`\\b(?:no|without|hold(?:\\s+the)?)\\s+(?:the\\s+)?${item}\\b`).test(text) || (item === 'buns?' && /\bbunless\b|\blettuce wrap\b/.test(text));
}

/** A burger described as a dish, not as one ingredient the table already knows. */
function estimateBurger(text: string): MacroGrams | null {
  const n = normalize(text);
  const named = /sweet and spicy bacon burger/.test(n);
  const generic = /\b(?:cheese)?burgers?\b/.test(n) || /\bpatt(?:y|ies)\b/.test(n);
  if (!named && !generic) return null;

  if (!named) {
    let patties = /\b(?:cheese)?burgers?\b/.test(n) ? 1 : 0;
    if (/\b(?:double|two)\b/.test(n)) patties = Math.max(patties, 2);
    if (/\btriple\b/.test(n)) patties = Math.max(patties, 3);
    const counted = n.match(/(\d+)\s+patt(?:y|ies)/);
    if (counted) patties = Math.max(patties, Number(counted[1]));
    if (patties === 0) patties = 1;
    if (/\bextra\s+patt/.test(n) || /\bextra\s+meat\b/.test(n)) patties += 1;
    let parts = portion('ground beef', 4 * patties, 'oz');
    if (/\bbacon\b/.test(n) && !leftOff(n, 'bacon')) parts = shift(parts, portion('bacon', 2, 'strip'), 1);
    if ((/\bcheese\b/.test(n) || /\bcheeseburgers?\b/.test(n)) && !leftOff(n, 'cheese')) {
      parts = shift(parts, portion('cheddar', 1, 'oz'), 1);
    }
    if (!leftOff(n, 'buns?')) parts = shift(parts, BURGER_BUN, 1);
    if (!leftOff(n, 'sauce')) {
      const sauceCarbs = /\blight\s+sauce\b/.test(n) ? 6 : /\bsauce\b/.test(n) ? 12 : 0;
      parts = shift(parts, { protein: 0, fat: 0, carbs: sauceCarbs, fiber: 0 }, 1);
    }
    return macrosFrom(parts);
  }

  let parts: Grams = { ...SWEET_SPICY_BACON_BURGER };
  if (/\bextra\s+patt/.test(n) || /\bextra\s+meat\b/.test(n)) parts = shift(parts, portion('ground beef', 4, 'oz'), 1);
  if (leftOff(n, 'buns?')) parts = shift(parts, BURGER_BUN, -1);
  if (leftOff(n, 'mustard')) parts = shift(parts, { protein: 0, fat: 0, carbs: 1, fiber: 0 }, -1);
  if (leftOff(n, 'sauce')) parts = shift(parts, { protein: 0, fat: 1, carbs: 15, fiber: 0 }, -1);
  else if (/\blight\s+sauce\b/.test(n)) parts = shift(parts, { protein: 0, fat: 1, carbs: 8, fiber: 0 }, -1);
  return macrosFrom(parts);
}

function sidePortions(text: string): Grams {
  let parts: Grams = { protein: 0, fat: 0, carbs: 0, fiber: 0 };
  for (const segment of segmentsOf(text)) {
    if (/\b(?:whataburger|burgers?|patt(?:y|ies)|buns?|sauce|mustard)\b/.test(segment)) continue;
    const part = parseSegment(segment);
    if (!part) continue;
    parts = shift(parts, part, 1);
  }
  return parts;
}

/** Sum standard portions for foods this table knows. Null when none match. */
export function estimateMealMacros(name: string, notes: string): MacroGrams | null {
  const text = notes.trim() ? `${name} ${notes}` : name;
  const burger = estimateBurger(text);
  if (burger) {
    const sides = sidePortions(text);
    if (sides.protein === 0 && sides.fat === 0 && sides.carbs === 0) return burger;
    return macrosFrom(
      shift(
        { protein: burger.proteinG, fat: burger.fatG, carbs: burger.carbsG, fiber: burger.fiberG },
        sides,
        1,
      ),
    );
  }
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
