import { createHash } from 'crypto';
import { IncrementalSha256, sha256Hex } from './llm/sha256';

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

function nodeHex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

check('sha256 of abc matches the known digest', () => {
  const abc = new Uint8Array([97, 98, 99]);
  eq(sha256Hex(abc), ABC, 'abc');
  eq(sha256Hex(new TextEncoder().encode('abc')), ABC, 'abc utf8');
  eq(sha256Hex(new Uint8Array(0)), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'empty');
});

check('chunked sha256 matches the one-shot digest', () => {
  const abc = new Uint8Array([97, 98, 99]);
  const byByte = new IncrementalSha256();
  byByte.update(abc.subarray(0, 1));
  byByte.update(abc.subarray(1, 2));
  byByte.update(abc.subarray(2));
  eq(byByte.digestHex(), ABC, 'abc one byte at a time');

  for (let n = 0; n <= 128; n++) {
    const buf = new Uint8Array(n);
    for (let i = 0; i < n; i++) buf[i] = (i * 17 + 3) & 0xff;
    const expected = nodeHex(buf);
    eq(sha256Hex(buf), expected, `len ${n}`);
    const chunked = new IncrementalSha256();
    let off = 0;
    const step = (n % 7) + 1;
    while (off < n) {
      chunked.update(buf.subarray(off, Math.min(n, off + step)));
      off += step;
    }
    eq(chunked.digestHex(), expected, `chunked len ${n}`);
  }
});

if (failed > 0) {
  console.error(`${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
