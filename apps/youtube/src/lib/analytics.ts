/**
 * Safe PostHog event capture that works without a direct posthog-js import.
 * PostHog is initialised by the PostHogProvider in packages/ui and exposes
 * a global `posthog` instance on `window.__ph`. We access it lazily so this
 * module has zero hard dependencies.
 */
export function capture(event: string, properties?: Record<string, unknown>): void {
  try {
    // posthog-js attaches itself to window when initialised via PostHogProvider
    const ph = (globalThis as Record<string, unknown>).posthog;
    if (ph && typeof (ph as { capture?: unknown }).capture === "function") {
      (ph as { capture: (e: string, p?: Record<string, unknown>) => void }).capture(event, properties);
    }
  } catch {
    // analytics should never break the app
  }
}
