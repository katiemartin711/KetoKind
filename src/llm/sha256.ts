// Incremental SHA-256. SDK 57 Crypto.digest takes one BufferSource and has no
// update method, so a multi-hundred-megabyte file cannot be hashed in one shot.
// digestHex() is lowercase hex, the same encoding as
// Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes).

const INITIAL_H = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/** One-shot lowercase SHA-256 hex of `bytes`. */
export function sha256Hex(bytes: Uint8Array): string {
  const hash = new IncrementalSha256();
  hash.update(bytes);
  return hash.digestHex();
}

/** SHA-256 that accepts the message in pieces. `digestHex()` is one-shot. */
export class IncrementalSha256 {
  private readonly h = new Uint32Array(INITIAL_H);
  private readonly w = new Uint32Array(64);
  private readonly block = new Uint8Array(64);
  private readonly blockView = new DataView(this.block.buffer);
  private readonly buf = new Uint8Array(64);
  private bufLen = 0;
  private bytes = 0;

  update(data: Uint8Array): void {
    if (data.length === 0) return;
    this.bytes += data.length;
    let offset = 0;
    if (this.bufLen > 0) {
      const take = Math.min(64 - this.bufLen, data.length);
      this.buf.set(data.subarray(0, take), this.bufLen);
      this.bufLen += take;
      offset = take;
      if (this.bufLen === 64) {
        this.compress(this.buf);
        this.bufLen = 0;
      }
    }
    while (offset + 64 <= data.length) {
      this.compress(data.subarray(offset, offset + 64));
      offset += 64;
    }
    if (offset < data.length) {
      const rest = data.subarray(offset);
      this.buf.set(rest, 0);
      this.bufLen = rest.length;
    }
  }

  digestHex(): string {
    const totalBytes = this.bytes;
    let padLen = (56 - (this.bufLen % 64) + 64) % 64;
    if (padLen === 0) padLen = 64;
    const pad = new Uint8Array(padLen + 8);
    pad[0] = 0x80;
    const bits = totalBytes * 8;
    const view = new DataView(pad.buffer);
    view.setUint32(padLen, Math.floor(bits / 0x100000000), false);
    view.setUint32(padLen + 4, bits % 0x100000000, false);
    this.update(pad);
    let hex = '';
    for (let i = 0; i < 8; i++) {
      const word = this.h[i] ?? 0;
      hex += ((word >>> 24) & 0xff).toString(16).padStart(2, '0');
      hex += ((word >>> 16) & 0xff).toString(16).padStart(2, '0');
      hex += ((word >>> 8) & 0xff).toString(16).padStart(2, '0');
      hex += (word & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
  }

  private compress(chunk: Uint8Array): void {
    this.block.set(chunk);
    const w = this.w;
    for (let i = 0; i < 16; i++) w[i] = this.blockView.getUint32(i * 4, false);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = (rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)) >>> 0;
      const s1 = (rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)) >>> 0;
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }
    let a = this.h[0] ?? 0;
    let b = this.h[1] ?? 0;
    let c = this.h[2] ?? 0;
    let d = this.h[3] ?? 0;
    let e = this.h[4] ?? 0;
    let f = this.h[5] ?? 0;
    let g = this.h[6] ?? 0;
    let h = this.h[7] ?? 0;
    for (let i = 0; i < 64; i++) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + s1 + ch + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    this.h[0] = ((this.h[0] ?? 0) + a) >>> 0;
    this.h[1] = ((this.h[1] ?? 0) + b) >>> 0;
    this.h[2] = ((this.h[2] ?? 0) + c) >>> 0;
    this.h[3] = ((this.h[3] ?? 0) + d) >>> 0;
    this.h[4] = ((this.h[4] ?? 0) + e) >>> 0;
    this.h[5] = ((this.h[5] ?? 0) + f) >>> 0;
    this.h[6] = ((this.h[6] ?? 0) + g) >>> 0;
    this.h[7] = ((this.h[7] ?? 0) + h) >>> 0;
  }
}
