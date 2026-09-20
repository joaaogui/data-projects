const UNSUPPORTED_REPLAY =
  /replay showed|you clustered|you placed|as seen in the match|troop placement/i;

/**
 * Rejects coaching text that names a card outside the decided decks or invents
 * a replay event the battle log does not contain.
 */
export function groundedClaims(input: {
  text: string;
  allowedCards: string[];
  knownCards: string[];
}): string[] {
  const problems: string[] = [];
  if (UNSUPPORTED_REPLAY.test(input.text)) {
    problems.push("Invented replay event");
  }

  let remaining = input.text;
  const known = [...input.knownCards].sort(
    (left, right) => right.length - left.length,
  );
  const allowed = new Set(input.allowedCards);

  for (const name of known) {
    if (!remaining.includes(name)) continue;
    if (!allowed.has(name)) problems.push(`Mentions absent card ${name}`);
    remaining = remaining.split(name).join(" ");
  }

  return problems;
}
