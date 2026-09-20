import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchAutocomplete } from "./search-autocomplete";

interface Suggestion {
  id: number;
  name: string;
}

const suggestions: Suggestion[] = [
  { id: 1, name: "Radiohead" },
  { id: 2, name: "Radiohead Tribute" },
  { id: 3, name: "Radio Company" },
];

function renderSearch({
  onSelect = vi.fn(),
  onSubmit = vi.fn(),
  maxSuggestions = 8,
}: {
  onSelect?: (item: Suggestion) => void;
  onSubmit?: (value: string) => void;
  maxSuggestions?: number;
} = {}) {
  render(
    <SearchAutocomplete
      ariaLabel="Artist"
      debounceMs={0}
      minQueryLength={2}
      maxSuggestions={maxSuggestions}
      useSuggestions={({ enabled }) => ({
        data: enabled ? suggestions : [],
        isFetching: false,
      })}
      getSuggestionKey={(item) => item.id}
      getSuggestionValue={(item) => item.name}
      onSelect={onSelect}
      onSubmit={onSubmit}
    />,
  );

  const input = screen.getByRole("combobox", { name: "Artist" });
  const listboxId = input.getAttribute("aria-controls");
  const listbox = listboxId ? document.getElementById(listboxId) : null;
  if (!listbox) throw new Error("Combobox listbox was not rendered");

  return { input, listbox };
}

describe("SearchAutocomplete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a stable combobox-to-listbox accessibility relationship", () => {
    const { input, listbox } = renderSearch();

    expect(input.getAttribute("aria-haspopup")).toBe("listbox");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(listbox.hidden).toBe(true);
  });

  it("opens suggestions and reports the active option", async () => {
    const { input, listbox } = renderSearch();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ra" } });

    await waitFor(() => {
      expect(input.getAttribute("aria-expanded")).toBe("true");
    });

    expect(listbox.hidden).toBe(false);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(input.getAttribute("aria-activedescendant")).toBe(
      screen.getAllByRole("option")[0].id,
    );
  });

  it("selects suggestions with the keyboard", async () => {
    const onSelect = vi.fn();
    const { input } = renderSearch({ onSelect });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ra" } });
    await waitFor(() => {
      expect(input.getAttribute("aria-expanded")).toBe("true");
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(suggestions[1]);
    expect((input as HTMLInputElement).value).toBe("Radiohead Tribute");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("submits a trimmed free-text query", () => {
    const onSubmit = vi.fn();
    const { input } = renderSearch({ onSubmit });

    fireEvent.change(input, { target: { value: "  Björk  " } });
    fireEvent.submit(input.closest("form")!);

    expect(onSubmit).toHaveBeenCalledWith("Björk");
  });

  it("limits rendered suggestions", async () => {
    const { input } = renderSearch({ maxSuggestions: 2 });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ra" } });
    await waitFor(() => {
      expect(input.getAttribute("aria-expanded")).toBe("true");
    });

    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});
