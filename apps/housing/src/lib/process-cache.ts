/**
 * Per-process state shared by every server bundle (pages and route handlers each get their own
 * module instances, which would otherwise parse the snapshot and extract features separately).
 * Development keeps it module-scoped so HMR picks up engine edits.
 */
export function processScoped<T extends object>(key: string, init: () => T): T {
  if (process.env.NODE_ENV !== "production") return init();
  const g = globalThis as { __housingProcessState?: Map<string, object> };
  g.__housingProcessState ??= new Map();
  let state = g.__housingProcessState.get(key);
  if (!state) {
    state = init();
    g.__housingProcessState.set(key, state);
  }
  return state as T;
}
