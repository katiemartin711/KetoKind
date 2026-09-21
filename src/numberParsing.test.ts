// Tests for src/numberParsing.ts — the strict parsers used by weight and
// profile numeric fields. The whole point is rejecting strings the sloppy
// Number()/parseInt() builtins accept (e.g. "12abc", "0x10", "1e3").
// Run with: npm test

import { parseIntStrict, parseFloatStrict } from './numberParsing';

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

check('parseIntStrict accepts plain integers', () => {
  eq(parseIntStrict('32'), 32, 'simple');
  eq(parseIntStrict(' 32 '), 32, 'surrounding whitespace');
  eq(parseIntStrict('0'), 0, 'zero');
  eq(parseIntStrict('007'), 7, 'leading zeros');
});

check('parseIntStrict rejects non-canonical input', () => {
  eq(parseIntStrict(''), null, 'empty');
  eq(parseIntStrict('   '), null, 'blank');
  eq(parseIntStrict('12abc'), null, 'trailing letters');
  eq(parseIntStrict('abc12'), null, 'leading letters');
  eq(parseIntStrict('12.5'), null, 'decimal');
  eq(parseIntStrict('+7'), null, 'explicit plus');
  eq(parseIntStrict('-3'), null, 'negative');
  eq(parseIntStrict('1e3'), null, 'exponent');
  eq(parseIntStrict('0x10'), null, 'hex');
  eq(parseIntStrict('1,000'), null, 'thousands separator');
  eq(parseIntStrict('3 2'), null, 'inner space');
  eq(parseIntStrict('NaN'), null, 'NaN');
  eq(parseIntStrict('Infinity'), null, 'Infinity');
});

check('parseFloatStrict accepts plain decimals', () => {
  eq(parseFloatStrict('165.5'), 165.5, 'decimal');
  eq(parseFloatStrict(' 165 '), 165, 'integer with whitespace');
  eq(parseFloatStrict('0.75'), 0.75, 'fraction');
});

check('parseFloatStrict rejects non-canonical input', () => {
  eq(parseFloatStrict(''), null, 'empty');
  eq(parseFloatStrict('12abc'), null, 'trailing letters');
  eq(parseFloatStrict('.5'), null, 'leading dot');
  eq(parseFloatStrict('5.'), null, 'trailing dot');
  eq(parseFloatStrict('-2.25'), null, 'negative');
  eq(parseFloatStrict('+0.75'), null, 'explicit plus');
  eq(parseFloatStrict('1e3'), null, 'exponent');
  eq(parseFloatStrict('0x10'), null, 'hex');
  eq(parseFloatStrict('1,000.5'), null, 'thousands separator');
  eq(parseFloatStrict('1.2.3'), null, 'double dot');
  eq(parseFloatStrict('NaN'), null, 'NaN');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
