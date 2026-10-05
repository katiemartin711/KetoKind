import { formatModelReplyLine, modelReplyVisible } from './llm/replyLog';

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

check('model reply line is the raw text, and hidden unless the preview flag is on', () => {
  const raw = '{"protein_g":80,"fat_g":70,"carbs_g":20,"fiber_g":1,"calories":1000}';
  eq(formatModelReplyLine(raw, true), `Qwen: ${raw}`, 'stored reply');
  eq(formatModelReplyLine(raw, false), `Qwen (not saved): ${raw}`, 'rejected reply');
  eq(formatModelReplyLine('  ', false), 'Qwen (not saved): (empty reply)', 'blank reply');
  eq(formatModelReplyLine(raw, true, ['jalapenos']), `Qwen: ${raw}\nNot in table: jalapenos`, 'skipped foods named');
  eq(modelReplyVisible(undefined), false, 'production build hides the line');
  eq(modelReplyVisible('1'), true, 'preview flag shows the line');
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
