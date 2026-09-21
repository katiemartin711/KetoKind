// Guiding principles for the AI coach prompt, adapted per diet type.
// The base list is written for keto/carnivore; each diet overrides only the
// principles that don't apply to it, so the exported prompt never contradicts
// the user's chosen way of eating (e.g. "dairy is optional" must not appear
// for Lion Diet or strict paleo).

import type { DietType } from './types';

const BASE_PRINCIPLES: string[] = [
  'Fatty red meat is the foundation — beef, lamb, pork; nose-to-tail when possible. Eat the meat you can afford.',
  'Fat is fuel, never the culprit — never blame dietary fat for stalls or gain. Eat fatty cuts, butter, and tallow freely.',
  'No sugar, no grains, no seed oils, no processed food.',
  'Eat when hungry, stop when comfortably full — no calorie counting or portion micromanaging.',
  'Salt food to taste; electrolytes matter, especially during adaptation.',
  'For women: adequate fat supports hormone production — cholesterol builds estrogen, progesterone, and testosterone. Low-fat dieting can disrupt cycles, fertility, mood, and thyroid.',
  "Don't chronically undereat — aggressive restriction and excessive fasting backfire, especially for women.",
  'Dairy is optional and a common stall culprit — cutting back is a reasonable first lever when weight loss stalls.',
  'BBBe (beef, butter, bacon, eggs) works as a simple reset baseline.',
  'Metabolic healing comes before fat loss — insulin resistance reverses first, and multi-week stalls are normal.',
];

/** 0-based index -> replacement principle, per diet. Keto/carnivore use the base list. */
const PRINCIPLE_OVERRIDES: Record<DietType, Record<number, string>> = {
  keto: {},
  carnivore: {},
  lion: {
    0: 'Ruminant meat — beef, lamb, goat — is the foundation; nose-to-tail when possible. Eat the meat you can afford.',
    1: 'Fat is fuel, never the culprit — never blame dietary fat for stalls or gain. Eat fatty cuts and tallow freely.',
    7: 'No dairy at all — the Lion Diet excludes all dairy, including butter and cheese.',
    8: 'When in doubt, simplify back to the basics: ruminant meat, salt, and water.',
  },
  paleo: {
    0: 'Quality animal protein is the foundation — meat, fish, and eggs; nose-to-tail when possible. Eat what you can afford.',
    1: 'Favor natural fats, but carbs from whole foods (tubers, fruit) are fine — if fat loss stalls, look at starch and fruit portions before blaming fat.',
    2: 'No grains, no legumes, no seed oils, no processed food. Fruit is allowed; keep added sugars and natural sweeteners minimal.',
    7: 'No dairy — strict paleo excludes all dairy, including butter and cheese.',
    8: 'A simple meat-and-vegetables reset works as a baseline.',
  },
};

/** The 10 guiding principles for the given diet, in order. */
export function dietPrinciples(diet: DietType): string[] {
  const overrides = PRINCIPLE_OVERRIDES[diet];
  return BASE_PRINCIPLES.map((principle, i) => overrides[i] ?? principle);
}
