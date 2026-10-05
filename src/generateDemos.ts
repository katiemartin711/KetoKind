// Synthetic KetoKind backups, one per diet. Not real people.
// Run after compile: node dist-test/generateDemos.js
// Meals use the same portion table as the app, plus a few foods that table
// does not know (lamb, sweet potato, blueberries), so every food log has
// macros, a source, and the current favorite fields.

import fs from 'fs';
import path from 'path';
import { estimateMealMacros } from './foodEstimate';
import { finalizeMacros, type MacroGrams } from './macros';

type Diet = 'keto' | 'carnivore' | 'lion' | 'paleo';

interface Extra {
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

interface MealSpec {
  name: string;
  mealType: string;
  notes: string;
  extra?: Extra;
}

interface MacroFields {
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  net_carbs_g: number;
  calories: number;
  macro_source: 'estimated' | 'edited';
}

const END = new Date(Date.UTC(2026, 8, 26));
const DAYS = 90;

function dayDate(index: number): Date {
  const d = new Date(END);
  d.setUTCDate(END.getUTCDate() - (DAYS - 1 - index));
  return d;
}

function iso(index: number, hour: number, minute: number): string {
  const d = dayDate(index);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute, 0)).toISOString();
}

function macrosFor(name: string, notes: string, extra?: Extra): MacroFields {
  const est = estimateMealMacros(name, notes);
  if (!est && !extra) throw new Error(`No portion match for: ${name}`);
  const protein = (est?.proteinG ?? 0) + (extra?.protein ?? 0);
  const fat = (est?.fatG ?? 0) + (extra?.fat ?? 0);
  const carbs = (est?.carbsG ?? 0) + (extra?.carbs ?? 0);
  const fiber = (est?.fiberG ?? 0) + (extra?.fiber ?? 0);
  const calories = protein * 4 + carbs * 4 + fat * 9;
  const done = finalizeMacros(protein, fat, carbs, fiber, calories);
  if (!done) throw new Error(`Macros out of range for: ${name}`);
  return toFields(done, 'estimated');
}

function toFields(m: MacroGrams, source: 'estimated' | 'edited'): MacroFields {
  return {
    protein_g: m.proteinG,
    fat_g: m.fatG,
    carbs_g: m.carbsG,
    fiber_g: m.fiberG,
    net_carbs_g: m.netCarbsG,
    calories: m.calories ?? 0,
    macro_source: source,
  };
}

function edited(fields: MacroFields): MacroFields {
  const done = finalizeMacros(fields.protein_g + 2, fields.fat_g, fields.carbs_g, fields.fiber_g, fields.calories);
  if (!done) return fields;
  return toFields(done, 'edited');
}

function sev(high: boolean, index: number): number {
  if (!high) return 1;
  return index % 2 === 0 ? 4 : 3;
}

interface CatalogItem {
  id: number;
  name: string;
  dosage: string;
  times_per_day: number;
  purpose: string;
  as_needed: number;
}

interface Demo {
  diet: Diet;
  profile: Record<string, unknown>;
  allergies: { id: number; name: string }[];
  conditions: { id: number; name: string }[];
  medications: CatalogItem[];
  supplements: CatalogItem[];
  meals: (index: number) => MealSpec[];
  /** Local flags that drive symptom severity and whether a dose was logged. */
  day: (index: number) => {
    meds: number[];
    supps: { id: number; quantity: number }[];
    symptoms: { name: string; high: boolean; notes: string }[];
  };
  favorites: { label: string; meal: MealSpec }[];
  weight: { start: number; end: number };
}

const SWEET_POTATO: Extra = { protein: 2, fat: 0.1, carbs: 26, fiber: 4 };
const BLUEBERRIES: Extra = { protein: 1, fat: 0.3, carbs: 17, fiber: 4 };
const LAMB: Extra = { protein: 70, fat: 55, carbs: 0, fiber: 0 };

const DEMOS: Demo[] = [
  {
    diet: 'keto',
    profile: {
      name: 'Maya Chen',
      diet_nuances: 'Coffee with heavy cream. Vegetables at dinner a few nights a week. Dairy most days.',
      goals: 'Steady energy and fewer afternoon crashes.',
      track_weight: 1,
      starting_weight: 168.4,
      age: 34,
      sex: 'female',
      bio: 'Keto for about a year. Lifts three mornings a week.',
      diet_start: '2025-09-01',
    },
    allergies: [{ id: 1, name: 'Shellfish' }],
    conditions: [{ id: 1, name: 'Migraines' }],
    medications: [
      { id: 1, name: 'Cetirizine', dosage: '10 mg', times_per_day: 1, purpose: 'congestion', as_needed: 1 },
    ],
    supplements: [
      { id: 1, name: 'Vitamin D3', dosage: '5000 IU', times_per_day: 1, purpose: 'daily', as_needed: 0 },
      { id: 2, name: 'Magnesium glycinate', dosage: '200 mg', times_per_day: 1, purpose: 'headache', as_needed: 0 },
      { id: 3, name: 'Electrolyte mix', dosage: '1 scoop', times_per_day: 1, purpose: 'cramps', as_needed: 1 },
    ],
    meals: (i) => {
      const dairy = i % 3 !== 0;
      const highCarb = i % 5 === 0;
      const breakfast: MealSpec = dairy
        ? { name: '3 eggs, 2 oz cheddar, 1 tbsp butter', mealType: 'Breakfast', notes: 'Coffee with 2 tbsp heavy cream' }
        : { name: '3 eggs, 4 strips bacon', mealType: 'Breakfast', notes: 'Black coffee' };
      const dinner: MealSpec = highCarb
        ? { name: '8 oz salmon, 2 cups broccoli, 1 avocado, 1 tbsp olive oil', mealType: 'Dinner', notes: '' }
        : dairy
          ? { name: '12 oz ribeye, 1 tbsp butter', mealType: 'Dinner', notes: 'Grass-fed' }
          : { name: '12 oz ground beef', mealType: 'Dinner', notes: '' };
      const meals = [breakfast, dinner];
      if (i % 2 === 0) {
        meals.splice(1, 0, {
          name: highCarb ? '6 oz chicken breast, 1 cup spinach' : '8 oz chicken thigh',
          mealType: 'Lunch',
          notes: '',
        });
      }
      return meals;
    },
    day: (i) => {
      const dairy = i % 3 !== 0;
      const highCarb = i % 5 === 0;
      const magnesium = i % 4 !== 3;
      const electrolytes = i % 5 !== 4;
      const cetirizine = i % 7 === 0;
      return {
        meds: cetirizine ? [1] : [],
        supps: [
          { id: 1, quantity: 1 },
          ...(magnesium ? [{ id: 2, quantity: 1 }] : []),
          ...(electrolytes ? [{ id: 3, quantity: i % 2 === 0 ? 2 : 1 }] : []),
        ],
        symptoms: [
          { name: 'Bloating', high: dairy, notes: '' },
          { name: 'Headache', high: !magnesium, notes: '' },
          { name: 'Muscle cramps', high: !electrolytes, notes: '' },
          { name: 'Congestion', high: !cetirizine, notes: '' },
          { name: 'Low energy', high: highCarb, notes: highCarb ? 'Afternoon' : '' },
        ],
      };
    },
    favorites: [
      {
        label: 'Usual breakfast',
        meal: { name: '3 eggs, 2 oz cheddar, 1 tbsp butter', mealType: 'Breakfast', notes: 'Coffee with 2 tbsp heavy cream' },
      },
      { label: 'Steak night', meal: { name: '12 oz ribeye, 1 tbsp butter', mealType: 'Dinner', notes: 'Grass-fed' } },
      {
        label: '',
        meal: { name: '8 oz salmon, 2 cups broccoli, 1 avocado, 1 tbsp olive oil', mealType: 'Dinner', notes: '' },
      },
    ],
    weight: { start: 168.4, end: 157.2 },
  },
  {
    diet: 'carnivore',
    profile: {
      name: 'Jordan Hale',
      diet_nuances: 'Animal foods only. Cheese or butter a couple of days a week.',
      goals: 'Clear skin and fewer afternoon energy dips.',
      track_weight: 1,
      starting_weight: 214,
      age: 41,
      sex: 'male',
      bio: 'Carnivore for two years. Walks daily.',
      diet_start: '2024-06-15',
    },
    allergies: [],
    conditions: [{ id: 1, name: 'Eczema' }],
    medications: [
      { id: 1, name: 'Famotidine', dosage: '20 mg', times_per_day: 1, purpose: 'heartburn', as_needed: 1 },
    ],
    supplements: [
      { id: 1, name: 'Electrolyte mix', dosage: '1 scoop', times_per_day: 1, purpose: 'cramps', as_needed: 1 },
      { id: 2, name: 'Magnesium glycinate', dosage: '200 mg', times_per_day: 1, purpose: 'sleep', as_needed: 0 },
    ],
    meals: (i) => {
      const dairy = i % 3 === 0;
      const pork = i % 4 === 0;
      const breakfast: MealSpec = pork
        ? { name: '4 eggs, 4 strips bacon', mealType: 'Breakfast', notes: '' }
        : { name: '3 eggs, 2 sausages', mealType: 'Breakfast', notes: '' };
      const dinner: MealSpec = dairy
        ? { name: '14 oz ribeye, 1 tbsp butter, 2 oz cheddar', mealType: 'Dinner', notes: '' }
        : { name: '16 oz ribeye', mealType: 'Dinner', notes: 'Salt only' };
      const meals = [breakfast, dinner];
      if (i % 2 === 1) meals.splice(1, 0, { name: '8 oz salmon', mealType: 'Lunch', notes: '' });
      return meals;
    },
    day: (i) => {
      const dairy = i % 3 === 0;
      const pork = i % 4 === 0;
      const electrolytes = i % 5 !== 4;
      const magnesium = i % 6 !== 5;
      const famotidine = i % 3 === 0;
      return {
        meds: famotidine ? [1] : [],
        supps: [
          ...(electrolytes ? [{ id: 1, quantity: 1 }] : []),
          ...(magnesium ? [{ id: 2, quantity: 1 }] : []),
        ],
        symptoms: [
          { name: 'Bloating', high: dairy, notes: '' },
          { name: 'Eczema', high: dairy, notes: dairy ? 'Itchier tonight' : '' },
          { name: 'Heartburn', high: !famotidine, notes: pork ? 'After a fattier breakfast' : '' },
          { name: 'Muscle cramps', high: !electrolytes, notes: '' },
          { name: 'Fatigue', high: !magnesium, notes: '' },
        ],
      };
    },
    favorites: [
      { label: 'Eggs and bacon', meal: { name: '4 eggs, 4 strips bacon', mealType: 'Breakfast', notes: '' } },
      { label: 'Ribeye', meal: { name: '16 oz ribeye', mealType: 'Dinner', notes: 'Salt only' } },
      { label: '', meal: { name: '14 oz ribeye, 1 tbsp butter, 2 oz cheddar', mealType: 'Dinner', notes: '' } },
    ],
    weight: { start: 214, end: 201.6 },
  },
  {
    diet: 'lion',
    profile: {
      name: 'Sam Ortiz',
      diet_nuances: 'Ruminant meat, salt, and water. Eggs only on days that slip.',
      goals: 'Calmer skin and steady energy.',
      track_weight: 1,
      starting_weight: 146.2,
      age: 29,
      sex: 'female',
      bio: 'Lion diet since spring. No dairy.',
      diet_start: '2026-04-01',
    },
    allergies: [{ id: 1, name: 'Pollen' }],
    conditions: [],
    medications: [
      { id: 1, name: 'Cetirizine', dosage: '10 mg', times_per_day: 1, purpose: 'itchy skin', as_needed: 1 },
    ],
    supplements: [
      { id: 1, name: 'Electrolyte mix', dosage: '1 scoop', times_per_day: 1, purpose: 'cramps', as_needed: 1 },
      { id: 2, name: 'Magnesium glycinate', dosage: '200 mg', times_per_day: 1, purpose: 'sleep', as_needed: 0 },
    ],
    meals: (i) => {
      const eggs = i % 7 === 0;
      const lamb = i % 5 === 0;
      const breakfast: MealSpec = eggs
        ? { name: '3 eggs', mealType: 'Breakfast', notes: 'Off plan' }
        : { name: '10 oz ground beef', mealType: 'Breakfast', notes: 'Salt' };
      const dinner: MealSpec = lamb
        ? { name: '10 oz lamb chop', mealType: 'Dinner', notes: 'Salt and water', extra: LAMB }
        : { name: '14 oz ribeye', mealType: 'Dinner', notes: '' };
      return [breakfast, dinner];
    },
    day: (i) => {
      const eggs = i % 7 === 0;
      const electrolytes = i % 5 !== 4;
      const magnesium = i % 4 !== 3;
      const cetirizine = i % 6 === 0;
      return {
        meds: cetirizine ? [1] : [],
        supps: [
          ...(electrolytes ? [{ id: 1, quantity: 1 }] : []),
          ...(magnesium ? [{ id: 2, quantity: 1 }] : []),
        ],
        symptoms: [
          { name: 'Bloating', high: eggs, notes: eggs ? 'After eggs' : '' },
          { name: 'Itchy skin', high: eggs, notes: '' },
          { name: 'Muscle cramps', high: !electrolytes, notes: '' },
          { name: 'Fatigue', high: !magnesium, notes: '' },
          { name: 'Congestion', high: !cetirizine, notes: '' },
        ],
      };
    },
    favorites: [
      { label: 'Usual ribeye', meal: { name: '14 oz ribeye', mealType: 'Dinner', notes: '' } },
      { label: 'Beef breakfast', meal: { name: '10 oz ground beef', mealType: 'Breakfast', notes: 'Salt' } },
      { label: '', meal: { name: '10 oz lamb chop', mealType: 'Dinner', notes: 'Salt and water', extra: LAMB } },
    ],
    weight: { start: 146.2, end: 138.4 },
  },
  {
    diet: 'paleo',
    profile: {
      name: 'Alex Nguyen',
      diet_nuances: 'Meat, eggs, vegetables, fruit, and sweet potato. No dairy and no grains.',
      goals: 'Lift without an afternoon crash.',
      track_weight: 1,
      starting_weight: 188.5,
      age: 38,
      sex: 'male',
      bio: 'Paleo for three years. Trains in the evening.',
      diet_start: '2023-03-01',
    },
    allergies: [],
    conditions: [{ id: 1, name: 'Seasonal allergies' }],
    medications: [
      { id: 1, name: 'Loratadine', dosage: '10 mg', times_per_day: 1, purpose: 'congestion', as_needed: 1 },
    ],
    supplements: [
      { id: 1, name: 'Vitamin D3', dosage: '2000 IU', times_per_day: 1, purpose: 'daily', as_needed: 0 },
      { id: 2, name: 'Magnesium glycinate', dosage: '200 mg', times_per_day: 1, purpose: 'headache', as_needed: 0 },
      { id: 3, name: 'Fish oil', dosage: '1 capsule', times_per_day: 1, purpose: 'daily', as_needed: 0 },
    ],
    meals: (i) => {
      const starch = i % 3 === 0;
      const fruit = i % 2 === 0;
      const breakfast: MealSpec = fruit
        ? { name: '3 eggs, 1 avocado, 1 cup blueberries', mealType: 'Breakfast', notes: '', extra: BLUEBERRIES }
        : { name: '3 eggs, 4 strips bacon', mealType: 'Breakfast', notes: '' };
      const dinner: MealSpec = starch
        ? {
            name: '8 oz chicken thigh, 1 cup broccoli, 1 medium sweet potato',
            mealType: 'Dinner',
            notes: '',
            extra: SWEET_POTATO,
          }
        : { name: '8 oz salmon, 2 cups spinach, 1 tbsp olive oil', mealType: 'Dinner', notes: '' };
      const meals = [breakfast, dinner];
      if (i % 2 === 1) meals.splice(1, 0, { name: '6 oz steak, 1 cup broccoli', mealType: 'Lunch', notes: '' });
      return meals;
    },
    day: (i) => {
      const starch = i % 3 === 0;
      const fruit = i % 2 === 0;
      const magnesium = i % 5 !== 4;
      const loratadine = i % 6 === 0;
      return {
        meds: loratadine ? [1] : [],
        supps: [
          { id: 1, quantity: 1 },
          ...(magnesium ? [{ id: 2, quantity: 1 }] : []),
          { id: 3, quantity: 1 },
        ],
        symptoms: [
          { name: 'Afternoon crash', high: fruit || starch, notes: '' },
          { name: 'Bloating', high: starch, notes: '' },
          { name: 'Headache', high: !magnesium, notes: '' },
          { name: 'Congestion', high: !loratadine, notes: '' },
        ],
      };
    },
    favorites: [
      {
        label: 'Chicken and potato',
        meal: {
          name: '8 oz chicken thigh, 1 cup broccoli, 1 medium sweet potato',
          mealType: 'Dinner',
          notes: '',
          extra: SWEET_POTATO,
        },
      },
      {
        label: 'Eggs and berries',
        meal: { name: '3 eggs, 1 avocado, 1 cup blueberries', mealType: 'Breakfast', notes: '', extra: BLUEBERRIES },
      },
      { label: '', meal: { name: '8 oz salmon, 2 cups spinach, 1 tbsp olive oil', mealType: 'Dinner', notes: '' } },
    ],
    weight: { start: 188.5, end: 177.8 },
  },
];

function weightAt(index: number, start: number, end: number): number {
  const t = index / (DAYS - 1);
  const wobble = ((index * 3) % 5) - 2;
  return Math.round((start + (end - start) * t + wobble * 0.15) * 10) / 10;
}

export function buildDemo(demo: Demo): Record<string, unknown> {
  const foodLogs: Record<string, unknown>[] = [];
  const medLogs: Record<string, unknown>[] = [];
  const symptomLogs: Record<string, unknown>[] = [];
  const supplementLogs: Record<string, unknown>[] = [];
  const weightLogs: Record<string, unknown>[] = [];
  const medById = new Map(demo.medications.map((m) => [m.id, m]));
  const suppById = new Map(demo.supplements.map((s) => [s.id, s]));

  for (let i = 0; i < DAYS; i++) {
    const meals = demo.meals(i);
    meals.forEach((meal, mealIndex) => {
      const hour = meal.mealType === 'Breakfast' ? 14 : meal.mealType === 'Lunch' ? 18 : 21;
      let macros = macrosFor(meal.name, meal.notes, meal.extra);
      if (i === 40 && mealIndex === 0) macros = edited(macros);
      foodLogs.push({
        id: foodLogs.length + 1,
        name: meal.name,
        meal_type: meal.mealType,
        logged_at: iso(i, hour, mealIndex === 0 ? 5 : 20),
        notes: meal.notes,
        ...macros,
      });
    });

    const flags = demo.day(i);
    flags.meds.forEach((id) => {
      const med = medById.get(id);
      if (!med) throw new Error(`Missing medication ${id}`);
      medLogs.push({
        id: medLogs.length + 1,
        medication_id: id,
        name: med.name,
        taken_at: iso(i, 14, 30),
        quantity: 1,
      });
    });
    flags.supps.forEach((dose, n) => {
      const supp = suppById.get(dose.id);
      if (!supp) throw new Error(`Missing supplement ${dose.id}`);
      supplementLogs.push({
        id: supplementLogs.length + 1,
        name: supp.name,
        supplement_id: dose.id,
        logged_at: iso(i, 14, 40 + n),
        notes: '',
        quantity: dose.quantity,
      });
    });
    flags.symptoms.forEach((sym, n) => {
      symptomLogs.push({
        id: symptomLogs.length + 1,
        name: sym.name,
        severity: sev(sym.high, i),
        logged_at: iso(i, 16, n * 5),
        notes: sym.notes,
      });
    });
    if (i % 3 === 0) {
      weightLogs.push({
        id: weightLogs.length + 1,
        weight: weightAt(i, demo.weight.start, demo.weight.end),
        logged_at: iso(i, 13, 50),
      });
    }
  }

  const mealFavorites = demo.favorites.map((fav, index) => ({
    id: index + 1,
    name: fav.meal.name,
    label: fav.label,
    meal_type: fav.meal.mealType,
    notes: fav.meal.notes,
    ...macrosFor(fav.meal.name, fav.meal.notes, fav.meal.extra),
  }));

  return {
    version: 1,
    exportedAt: '2026-09-26T18:00:00.000Z',
    profile: {
      id: 1,
      name: demo.profile.name,
      diet_type: demo.diet,
      diet_nuances: demo.profile.diet_nuances,
      goals: demo.profile.goals,
      track_weight: demo.profile.track_weight,
      starting_weight: demo.profile.starting_weight,
      theme_mode: 'system',
      age: demo.profile.age,
      sex: demo.profile.sex,
      bio: demo.profile.bio,
      diet_start: demo.profile.diet_start,
      dismissed_milestones: '',
      reminder_settings: '',
      track_calories: 1,
      carbs_mode: 'net',
    },
    allergies: demo.allergies,
    conditions: demo.conditions,
    medications: demo.medications,
    supplements: demo.supplements,
    foodLogs,
    mealFavorites,
    medLogs,
    symptomLogs,
    supplementLogs,
    weightLogs,
  };
}

function writeDemos(): void {
  const dir = path.join(__dirname, '..', 'sample-data');
  fs.mkdirSync(dir, { recursive: true });
  for (const demo of DEMOS) {
    const file = path.join(dir, `ketokind-demo-${demo.diet}.json`);
    fs.writeFileSync(file, `${JSON.stringify(buildDemo(demo), null, 2)}\n`);
    console.log(`wrote ${file}`);
  }
}

if (require.main === module) writeDemos();
