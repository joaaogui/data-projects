import { afterEach, describe, expect, it, vi } from "vitest";
import { processScoped } from "@/lib/process-cache";

describe("processScoped", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { __housingProcessState?: Map<string, object> })
      .__housingProcessState;
  });

  it("returns a fresh object per call outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    let calls = 0;
    const init = () => ({ n: ++calls });
    const a = processScoped("k1", init);
    const b = processScoped("k1", init);
    expect(a).not.toBe(b);
    expect(calls).toBe(2);
  });

  it("shares one instance per key in production and isolates different keys", () => {
    vi.stubEnv("NODE_ENV", "production");
    let calls = 0;
    const init = () => ({ n: ++calls });
    const a = processScoped("shared-a", init);
    const b = processScoped("shared-a", init);
    const c = processScoped("shared-b", init);
    expect(b).toBe(a);
    expect(c).not.toBe(a);
    expect(calls).toBe(2);
    // Mutations are visible through the shared handle.
    a.n = 99;
    expect(processScoped<{ n: number }>("shared-a", init).n).toBe(99);
  });
});
