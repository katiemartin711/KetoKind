// Filter previously logged symptom names for the Log tab autocomplete.
// Case-insensitive substring match; exact matches are hidden (already typed).

const DEFAULT_LIMIT = 8;

/**
 * Names to offer as chips under the symptom field. `names` should already be
 * deduped and ordered (most recent first). Empty query → top N; otherwise
 * names that contain the query, excluding an exact match.
 */
export function filterSymptomSuggestions(
  names: string[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): string[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? names.filter((n) => {
        const lower = n.toLowerCase();
        return lower.includes(q) && lower !== q;
      })
    : names;
  return filtered.slice(0, limit);
}
