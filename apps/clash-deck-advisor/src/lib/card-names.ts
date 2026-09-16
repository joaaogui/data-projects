/**
 * Card name matching.
 *
 * Models write "Log" where the API says "The Log", and "Mini Pekka" where the
 * API says "Mini P.E.K.K.A". Comparing on a normalized key keeps a correct
 * suggestion from being thrown away over punctuation.
 */
export function cardNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

export function buildCanonicalNameMap(names: string[]): Map<string, string> {
  return new Map(names.map((name) => [cardNameKey(name), name]));
}

export function canonicalizeName(
  name: string,
  canonicalNames: Map<string, string>,
): string {
  return canonicalNames.get(cardNameKey(name)) ?? name;
}
