// Strict number parsing for text inputs: plain parseInt/parseFloat silently
// accept junk like "12abc" (parsing the leading 12), which once logged a
// weight of 12 lbs from a typo. These return null unless the whole trimmed
// string is a plain number.

/** parseInt that rejects junk like "12abc" — digits only, or null. */
export function parseIntStrict(s: string): number | null {
  const t = s.trim();
  return /^\d+$/.test(t) ? parseInt(t, 10) : null;
}

/** parseFloat that rejects junk like "12abc" — a plain decimal, or null. */
export function parseFloatStrict(s: string): number | null {
  const t = s.trim();
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
}
