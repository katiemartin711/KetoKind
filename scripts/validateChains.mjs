#!/usr/bin/env node
// Checks every src/data/chains/*.json against the shape in README.md.
// Usage: node scripts/validateChains.mjs [file ...]   (no args = all files)

import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'data', 'chains');
const files = process.argv.length > 2
  ? process.argv.slice(2)
  : fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));

const UNITS = new Set(['each', 'slice', 'strip', 'ounce', 'cup', 'tablespoon', 'teaspoon', 'piece', 'scoop']);
const MACROS = ['protein', 'fat', 'carbs', 'fiber', 'calories'];

let problems = 0;
let items = 0;
let builds = 0;

function fail(file, msg) {
  problems += 1;
  console.error(`${path.basename(file)}: ${msg}`);
}

function checkMacros(file, label, m) {
  if (!m || typeof m !== 'object') return fail(file, `${label}: macros missing`);
  for (const k of MACROS) {
    if (typeof m[k] !== 'number' || !Number.isFinite(m[k]) || m[k] < 0) fail(file, `${label}: ${k} must be a number >= 0`);
  }
  if (m.fiber > m.carbs + 0.5) fail(file, `${label}: fiber ${m.fiber} exceeds carbs ${m.carbs}`);
  const computed = m.protein * 4 + m.carbs * 4 + m.fat * 9;
  if (m.calories > 60 && Math.abs(computed - m.calories) / m.calories > 0.2) {
    fail(file, `${label}: calories ${m.calories} vs 4/4/9 estimate ${computed.toFixed(0)} differ by >20%`);
  }
}

for (const file of files) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(file, `not valid JSON: ${e.message}`);
    continue;
  }
  if (typeof data.chain !== 'string' || !data.chain) fail(file, 'chain name missing');
  if (!Array.isArray(data.aliases) || data.aliases.length === 0) fail(file, 'aliases missing');
  else for (const a of data.aliases) if (a !== a.toLowerCase()) fail(file, `alias "${a}" must be lowercase`);
  if (typeof data.source !== 'string' || !/^https?:\/\//.test(data.source)) fail(file, 'source must be a URL');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.retrieved))) fail(file, 'retrieved must be YYYY-MM-DD');

  const components = data.components ?? {};
  if (typeof components !== 'object' || Array.isArray(components)) fail(file, 'components must be an object');
  for (const [name, c] of Object.entries(components)) {
    if (name !== name.toLowerCase()) fail(file, `component "${name}" must be lowercase`);
    if (!UNITS.has(c.unit)) fail(file, `component "${name}": unit "${c.unit}" not in ${[...UNITS].join('/')}`);
    checkMacros(file, `component "${name}"`, c);
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    fail(file, 'items missing');
    continue;
  }
  const seen = new Set();
  for (const it of data.items) {
    items += 1;
    const label = `item "${it.name}"`;
    if (typeof it.name !== 'string' || !it.name) fail(file, 'item without a name');
    if (seen.has(it.name?.toLowerCase())) fail(file, `${label}: duplicate name`);
    seen.add(it.name?.toLowerCase());
    if (!Array.isArray(it.aliases) || it.aliases.length === 0) fail(file, `${label}: aliases missing`);
    else for (const a of it.aliases) if (a !== a.toLowerCase()) fail(file, `${label}: alias "${a}" must be lowercase`);
    checkMacros(file, label, it.macros);
    if (it.build == null) continue;
    builds += 1;
    if (!Array.isArray(it.build) || it.build.length === 0) {
      fail(file, `${label}: build must be a non-empty array`);
      continue;
    }
    const sum = { protein: 0, fat: 0, carbs: 0 };
    let complete = true;
    for (const b of it.build) {
      const c = components[b.component];
      if (!c) {
        fail(file, `${label}: build uses unknown component "${b.component}"`);
        complete = false;
        continue;
      }
      if (typeof b.count !== 'number' || !(b.count > 0)) fail(file, `${label}: "${b.component}" count must be > 0`);
      for (const k of Object.keys(sum)) sum[k] += (c[k] ?? 0) * (b.count ?? 0);
    }
    if (complete && it.macros) {
      for (const k of Object.keys(sum)) {
        const pub = it.macros[k];
        if (pub > 5 && Math.abs(sum[k] - pub) / pub > 0.15) {
          fail(file, `${label}: build ${k} ${sum[k].toFixed(1)}g vs published ${pub}g differ by >15%`);
        }
      }
    }
  }
}

console.log(`${files.length} file(s), ${items} items, ${builds} builds, ${problems} problem(s)`);
process.exit(problems > 0 ? 1 : 0);
