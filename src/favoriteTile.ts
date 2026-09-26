/** Text shown on a favorite tile: the saved name, or a short preview of the meal. */
const PREVIEW_LENGTH = 24;

export function favoriteTileText(label: string, description: string): string {
  const name = label.trim();
  if (name) return name;
  const text = description.trim();
  if (text.length <= PREVIEW_LENGTH) return text;
  const cut = text.slice(0, PREVIEW_LENGTH);
  const space = cut.lastIndexOf(' ');
  const preview = (space > 8 ? cut.slice(0, space) : cut).trimEnd();
  return `${preview}…`;
}
