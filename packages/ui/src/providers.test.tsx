import { createSuggestionsHook } from "@data-projects/shared";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { Providers } from "./providers";

const useSuggestions = createSuggestionsHook(
  "provider-integration",
  async () => ["result"],
  { minLength: 1 },
);

function QueryConsumer() {
  const query = useSuggestions({ query: "query" });
  return <span>{query.isPending ? "loading" : "ready"}</span>;
}

describe("Providers", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("provides one React Query context to shared-package hooks", () => {
    render(
      <Providers>
        <QueryConsumer />
      </Providers>,
    );

    expect(screen.getByText(/loading|ready/)).toBeTruthy();
  });
});
