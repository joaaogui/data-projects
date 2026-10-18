import {
  isNegativeSignalKey,
  isPositiveSignalKey,
  legacySignalKey,
  signalLabel,
  type NegativeSignalKey,
  type PositiveSignalKey,
} from "@data-projects/housing-contract";

/**
 * Modernity signals come from the scraper as contract keys; snapshots written before the keys
 * existed only carry the Portuguese labels, which are mapped back once per record.
 */
export interface SignalSource {
  positiveSignals?: readonly string[];
  negativeSignals?: readonly string[];
  positiveSignalKeys?: readonly PositiveSignalKey[];
  negativeSignalKeys?: readonly NegativeSignalKey[];
  constructionYear?: number | null;
}

export function positiveKeysFromLabels(labels: readonly string[]): PositiveSignalKey[] {
  const keys: PositiveSignalKey[] = [];
  for (const label of labels) {
    const key = legacySignalKey(label);
    if (key && isPositiveSignalKey(key)) keys.push(key);
  }
  return keys;
}

export function negativeKeysFromLabels(labels: readonly string[]): NegativeSignalKey[] {
  const keys: NegativeSignalKey[] = [];
  for (const label of labels) {
    const key = legacySignalKey(label);
    if (key && isNegativeSignalKey(key)) keys.push(key);
  }
  return keys;
}

const EMPTY: readonly never[] = [];
const positiveByLabels = new WeakMap<readonly string[], PositiveSignalKey[]>();
const negativeByLabels = new WeakMap<readonly string[], NegativeSignalKey[]>();

export function positiveSignalKeysOf(prop: SignalSource): readonly PositiveSignalKey[] {
  if (prop.positiveSignalKeys) return prop.positiveSignalKeys;
  const labels = prop.positiveSignals;
  if (!labels) return EMPTY;
  let keys = positiveByLabels.get(labels);
  if (!keys) {
    keys = positiveKeysFromLabels(labels);
    positiveByLabels.set(labels, keys);
  }
  return keys;
}

export function negativeSignalKeysOf(prop: SignalSource): readonly NegativeSignalKey[] {
  if (prop.negativeSignalKeys) return prop.negativeSignalKeys;
  const labels = prop.negativeSignals;
  if (!labels) return EMPTY;
  let keys = negativeByLabels.get(labels);
  if (!keys) {
    keys = negativeKeysFromLabels(labels);
    negativeByLabels.set(labels, keys);
  }
  return keys;
}

export function hasPositiveSignal(prop: SignalSource, ...keys: PositiveSignalKey[]): boolean {
  const own = positiveSignalKeysOf(prop);
  return keys.some((key) => own.includes(key));
}

export function hasNegativeSignal(prop: SignalSource, ...keys: NegativeSignalKey[]): boolean {
  const own = negativeSignalKeysOf(prop);
  return keys.some((key) => own.includes(key));
}

/** Fills whichever side is missing: keys from legacy labels, or display labels from keys. */
export function ensureSignalKeysAndLabels<T extends SignalSource>(prop: T): T {
  const mutable = prop as SignalSource;
  if (!mutable.positiveSignalKeys) mutable.positiveSignalKeys = positiveKeysFromLabels(prop.positiveSignals ?? []);
  if (!mutable.negativeSignalKeys) mutable.negativeSignalKeys = negativeKeysFromLabels(prop.negativeSignals ?? []);
  if (!mutable.positiveSignals) {
    mutable.positiveSignals = mutable.positiveSignalKeys.map((k) => signalLabel(k, prop.constructionYear));
  }
  if (!mutable.negativeSignals) {
    mutable.negativeSignals = mutable.negativeSignalKeys.map((k) => signalLabel(k, prop.constructionYear));
  }
  return prop;
}
