#!/usr/bin/env node
// Discover and run every compiled *.test.js under dist-test/.
// Every file is preloaded with test/preload.js so __DEV__ is true before
// pro.js loads, and the React Native component tests get their mocks.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist-test');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.test.js')) out.push(full);
  }
  return out;
}

const tsc = spawnSync('npx', ['tsc', '-p', 'tsconfig.test.json'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const tests = walk(dist).sort();
if (tests.length === 0) {
  console.error('No *.test.js files found under dist-test/');
  process.exit(1);
}

let failed = 0;
for (const file of tests) {
  const rel = path.relative(root, file);
  const args = ['--require', './test/preload.js', file];
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAILED: ${rel}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} test file(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${tests.length} test file(s) passed`);
