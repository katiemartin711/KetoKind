// Food keyword matching for Trends food × symptom patterns.
//
// Meal logs are plain English text ("ribeye with butter and salt"), so
// matching is a case-insensitive whole-word search over each day's meal
// text, with one optional trailing "s". A keyword that names a FOOD_GROUPS
// entry expands to that group's foods (typing "dairy" matches days
// mentioning cheese, cream, butter, …); anything else is a plain keyword.
// Hits are skipped when the 24 characters before the term end with "no",
// "not", or "without" plus whitespace, when the term is immediately
// followed by "-free",
// or when the term sits inside a lookalike phrase such as "peanut butter".
//
// Pure functions, no db access, no React: the screen feeds in a
// day → meal-texts map from src/db/trends.ts getMealDayMap(), so this is
// trivially unit-testable (see src/foodGroups.test.ts).
//
// Copy discipline (App Store safety): this module only partitions days into
// "mentions X" vs. "doesn't mention X" sets. It says nothing about whether
// a food causes, improves, or worsens anything.

/**
 * Curated food groups for carnivore/keto eating. Key = group name a user
 * might type; value = match terms. Kept tight and carnivore-focused —
 * this is a convenience expansion, not a nutrition database.
 */
export const FOOD_GROUPS: Record<string, string[]> = {
  dairy: ['cheese', 'cream', 'butter', 'milk', 'yogurt', 'kefir', 'ghee'],
  eggs: ['egg'],
  beef: ['beef', 'steak', 'ribeye', 'brisket', 'chuck', 'sirloin', 'tri-tip', 'short rib'],
  pork: ['pork', 'bacon', 'ham', 'sausage', 'pork chop', 'pork belly', 'carnitas', 'prosciutto'],
  poultry: ['chicken', 'turkey', 'duck'],
  fish: ['fish', 'salmon', 'tuna', 'sardine', 'cod', 'halibut', 'mackerel', 'trout'],
  seafood: ['shrimp', 'crab', 'lobster', 'oyster', 'scallop', 'clam'],
  lamb: ['lamb'],
  'organ meats': ['liver', 'heart', 'kidney', 'organ meat', 'sweetbread'],
};

/**
 * Expand a normalized (trimmed, lowercased) keyword to a group's match
 * terms, or null when it names no group. Forgiving about plurals:
 * "egg" and "organ meat" find the "eggs" / "organ meats" groups.
 */
export function expandFoodKeyword(normalizedKeyword: string): string[] | null {
  const direct = FOOD_GROUPS[normalizedKeyword];
  if (direct) return direct;
  const plural = FOOD_GROUPS[`${normalizedKeyword}s`];
  if (plural) return plural;
  return null;
}

export interface FoodMatch {
  /** What the keyword expanded to: the group's terms, or the keyword itself. */
  matchedFoods: string[];
  /** Local days (YYYY-MM-DD) where any meal text mentioned any matched food. */
  daysWith: Set<string>;
  /** True when the keyword matched a group name (vs. a plain keyword). */
  isGroup: boolean;
}

const LOOKALIKES = [
  'peanut butter',
  'almond milk',
  'coconut milk',
  'oat milk',
  'kidney bean',
  'oyster mushroom',
  'artichoke heart',
];

function insideLookalike(haystack: string, matchIndex: number, term: string): boolean {
  const from = Math.max(0, matchIndex - 24);
  const to = Math.min(haystack.length, matchIndex + term.length + 24);
  const window = haystack.slice(from, to);
  return LOOKALIKES.some((phrase) => {
    if (!phrase.includes(term)) return false;
    const termAt = phrase.indexOf(term);
    let rel = window.indexOf(phrase);
    while (rel !== -1) {
      if (matchIndex === from + rel + termAt) return true;
      rel = window.indexOf(phrase, rel + 1);
    }
    return false;
  });
}

/**
 * Case-insensitive whole-word search. An optional trailing "s" counts as
 * the same term. A hit is rejected when the 24 characters before it end
 * with "no", "not", or "without" plus whitespace, when the term is
 * immediately followed by "-free", or when that hit sits inside a
 * lookalike phrase. A later plain mention on the same day still counts.
 */
export function mentionsFoodTerm(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${escaped}s?(?=[^a-z0-9]|$)`, 'gi');
  const text = haystack.toLowerCase();
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    const boundaryLen = match[1]?.length ?? 0;
    const termStart = start + boundaryLen;
    const before = text.slice(Math.max(0, termStart - 24), termStart);
    if (/\b(no|not|without)\s+$/.test(before)) continue;
    const after = text.slice(start + match[0].length);
    if (after.startsWith('-free')) continue;
    if (insideLookalike(text, termStart, term)) continue;
    return true;
  }
  return false;
}

/**
 * Partition days by whether any of the day's meal texts mention the
 * keyword. Group names expand to their foods (a day matches when it
 * mentions ANY of them); anything else is a plain case-insensitive
 * word search. Empty keyword matches nothing.
 */
export function matchFoodDays(
  keyword: string,
  mealLogsByDay: Map<string, string[]>,
): FoodMatch {
  const norm = keyword.trim().toLowerCase();
  if (!norm) return { matchedFoods: [], daysWith: new Set<string>(), isGroup: false };
  const groupTerms = expandFoodKeyword(norm);
  const matchedFoods = groupTerms ?? [norm];
  const daysWith = new Set<string>();
  for (const [day, texts] of mealLogsByDay) {
    const haystack = texts.join('\n').toLowerCase();
    if (matchedFoods.some((t) => mentionsFoodTerm(haystack, t))) daysWith.add(day);
  }
  return { matchedFoods, daysWith, isGroup: groupTerms !== null };
}
