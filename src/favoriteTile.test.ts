import { favoriteTileText } from './favoriteTile';

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
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

check('a saved name is shown as-is', () => {
  eq(favoriteTileText('  Usual breakfast  ', '6 eggs, 3 strips of thick cut bacon'), 'Usual breakfast', 'name');
});

check('without a name the description is shortened', () => {
  eq(favoriteTileText('', '6 eggs, 3 strips of thick cut bacon'), '6 eggs, 3 strips of…', 'preview');
  eq(favoriteTileText('   ', 'Ribeye'), 'Ribeye', 'short description stays whole');
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
