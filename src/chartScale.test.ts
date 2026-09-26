import { xForTime } from './chartScale';

function eq<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e}`); }
}

check('x is proportional to time, not index', () => {
  eq(xForTime(0, 0, 100, 0, 100), 0, 'start');
  eq(xForTime(90, 0, 100, 0, 100), 90, 'day 90 of 100 is near the right');
  eq(xForTime(50, 0, 100, 0, 100), 50, 'mid');
});

check('a single timestamp sits in the middle', () => {
  eq(xForTime(5, 5, 5, 0, 100), 50, 'one point');
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
