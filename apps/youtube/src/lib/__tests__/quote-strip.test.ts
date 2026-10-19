import { describe, expect, it } from "vitest";
import { stripSurroundingQuotes } from "../quote-strip";

describe("stripSurroundingQuotes", () => {
  it.each([
    ['"hello"', "hello"],
    ["'hello'", "hello"],
    ["`hello`", "hello"],
    ["``regex``", "regex"],
    ['"""hello"""', "hello"],
    ["'''hello'''", "hello"],
    ["```hello```", "hello"],
  ])("strips a surrounding run of the same quote char: %s", (input, expected) => {
    expect(stripSurroundingQuotes(input)).toBe(expected);
  });

  it("strips a maximal mixed leading and trailing run", () => {
    expect(stripSurroundingQuotes("`\"'hello'\"`")).toBe("hello");
    expect(stripSurroundingQuotes("''``\"\"hello\"\"``''")).toBe("hello");
    expect(stripSurroundingQuotes("`'\"abc\"'`")).toBe("abc");
  });

  it("strips only a leading run when there is no trailing run", () => {
    expect(stripSurroundingQuotes('"hello')).toBe("hello");
    expect(stripSurroundingQuotes("``hello")).toBe("hello");
  });

  it("strips only a trailing run when there is no leading run", () => {
    expect(stripSurroundingQuotes('hello"')).toBe("hello");
    expect(stripSurroundingQuotes("hello''")).toBe("hello");
  });

  it("preserves inner quotes", () => {
    expect(stripSurroundingQuotes('"a"b"')).toBe('a"b');
    expect(stripSurroundingQuotes("'don't'")).toBe("don't");
    expect(stripSurroundingQuotes("don't")).toBe("don't");
    expect(stripSurroundingQuotes('a "b" c')).toBe('a "b" c');
    expect(stripSurroundingQuotes("`a`b`c`")).toBe("a`b`c");
  });

  it("returns an empty string for an all-quote string", () => {
    expect(stripSurroundingQuotes("'''")).toBe("");
    expect(stripSurroundingQuotes('"""')).toBe("");
    expect(stripSurroundingQuotes("```")).toBe("");
    expect(stripSurroundingQuotes("`\"'")).toBe("");
    expect(stripSurroundingQuotes('"')).toBe("");
  });

  it("returns an empty string for an empty string", () => {
    expect(stripSurroundingQuotes("")).toBe("");
  });

  it("leaves a string without surrounding quotes unchanged", () => {
    expect(stripSurroundingQuotes("hello")).toBe("hello");
    expect(stripSurroundingQuotes("(a|b)")).toBe("(a|b)");
  });
});
