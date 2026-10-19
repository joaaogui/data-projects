// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatMarkdown, normalizeChatMarkdown, toPlainPreview } from "./chat-markdown";

describe("ChatMarkdown", () => {
  it("renders paragraphs, emphasis and inline code", () => {
    const { container } = render(
      <ChatMarkdown text={"Olá **mundo** e `código` solto."} />,
    );
    expect(screen.getByText("mundo")).toBeTruthy();
    expect(container.querySelector("strong")?.textContent).toBe("mundo");
    expect(container.querySelector("code")?.textContent).toBe("código");
    expect(container.querySelector("p")?.textContent).toContain("Olá");
  });

  it("renders headings as h3/h4, lists, blockquote and hr", () => {
    const { container } = render(
      <ChatMarkdown
        text={
          "# Título\n\n#### Sub\n\n- um\n- dois\n\n1. primeiro\n2. segundo\n\n> citação\n\n---\n\nfim"
        }
      />,
    );
    expect(container.querySelector("h3")?.textContent).toContain("Título");
    expect(container.querySelector("h4")?.textContent).toContain("Sub");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.querySelector("blockquote")?.textContent).toContain(
      "citação",
    );
    expect(container.querySelector("hr")).toBeTruthy();
    expect(screen.getByText("fim")).toBeTruthy();
  });

  it("renders h2/h3 markdown headings", () => {
    const { container } = render(
      <ChatMarkdown text={"## Dois\n\n### Três"} />,
    );
    const headings = container.querySelectorAll("h3");
    expect(headings.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Dois")).toBeTruthy();
    expect(screen.getByText("Três")).toBeTruthy();
  });

  it("renders links opening in a new tab", () => {
    render(<ChatMarkdown text={"[Anúncio](https://example.com/imovel/1)"} />);
    const link = screen.getByRole("link", { name: "Anúncio" });
    expect(link.getAttribute("href")).toBe("https://example.com/imovel/1");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("renders fenced code blocks and GFM tables", () => {
    const { container } = render(
      <ChatMarkdown
        text={
          "```\nconst x = 1;\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |"
        }
      />,
    );
    expect(container.querySelector("pre")?.textContent).toContain(
      "const x = 1;",
    );
    expect(container.querySelector("table")).toBeTruthy();
    expect(container.querySelector("thead")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders images lazily with an empty-alt fallback", () => {
    const { container } = render(
      <ChatMarkdown text={"![foto](https://example.com/f.jpg)"} />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/f.jpg");
    expect(img?.getAttribute("alt")).toBe("foto");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });

  it("normalizes legacy bullet characters into markdown lists", () => {
    const { container } = render(
      <ChatMarkdown text={"• primeiro\n• segundo"} />,
    );
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(normalizeChatMarkdown("• item")).toBe("- item");
    expect(normalizeChatMarkdown("texto")).toBe("texto");
  });

  it("toPlainPreview strips markdown and truncates with an ellipsis", () => {
    expect(toPlainPreview("**negrito** e [link](https://x.com)", 100)).toBe(
      "negrito e link",
    );
    const long = toPlainPreview("a".repeat(50), 10);
    expect(long).toBe("aaaaaaaaaa…");
    expect(toPlainPreview("```\ncódigo\n```\nvisível", 100)).toBe("visível");
    expect(toPlainPreview("![img](https://x.com/i.jpg) legenda", 100)).toBe(
      "legenda",
    );
  });

  it("renders empty text without crashing", () => {
    const { container } = render(<ChatMarkdown text="" />);
    expect(container.firstChild).toBeTruthy();
  });
});
