/** Pixel x for `at` inside [t0, t1], mapped onto [left, left + width]. */
export function xForTime(at: number, t0: number, t1: number, left: number, width: number): number {
  if (t1 === t0) return left + width / 2;
  return left + ((at - t0) / (t1 - t0)) * width;
}
