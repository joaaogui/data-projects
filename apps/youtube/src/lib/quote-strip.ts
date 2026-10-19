function isQuoteChar(ch: string): boolean {
  return ch === "`" || ch === '"' || ch === "'";
}

/**
 * Strips the maximal leading and trailing runs of backtick / double-quote /
 * single-quote characters from `value` (which the caller has already
 * trimmed) in a single linear scan. Equivalent to removing a leading
 * `[\`"']+` run and a trailing `[\`"']+` run with regexes.
 */
export function stripSurroundingQuotes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isQuoteChar(value[start])) start++;
  while (end > start && isQuoteChar(value[end - 1])) end--;
  return value.slice(start, end);
}
