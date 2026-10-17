"use client";

import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const LEGACY_BULLET_RE = /^(\s*)•\s+/gm;

const components: Components = {
  h1: ({ node: _node, ...props }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-bold text-foreground first:mt-0" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-bold text-foreground first:mt-0" {...props} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="mt-3 mb-1.5 text-[13px] font-bold text-foreground first:mt-0" {...props} />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4 className="mt-3 mb-1 text-xs font-bold text-foreground first:mt-0" {...props} />
  ),
  p: ({ node: _node, ...props }) => <p className="my-1.5 first:mt-0 last:mb-0" {...props} />,
  ul: ({ node: _node, ...props }) => (
    <ul className="my-1.5 list-disc space-y-1 pl-4 marker:text-purple-500" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-4 marker:font-semibold marker:text-purple-600" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="pl-0.5" {...props} />,
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="font-medium text-purple-700 underline underline-offset-2 hover:text-purple-900 dark:text-purple-300 dark:hover:text-purple-100"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="my-2 border-l-2 border-purple-500/50 pl-3 text-muted-foreground italic"
      {...props}
    />
  ),
  hr: () => <hr className="my-3 border-border" />,
  code: ({ node: _node, className, ...props }) => (
    <code
      className={`rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-purple-700 dark:text-purple-300 ${className ?? ""}`}
      {...props}
    />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      className="my-2 overflow-x-auto rounded-lg border bg-muted/60 p-2.5 font-mono text-[11px] leading-relaxed [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-foreground"
      {...props}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-2 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-[11px]" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <thead className="bg-muted/60" {...props} />,
  th: ({ node: _node, ...props }) => (
    <th className="border-b px-2 py-1.5 text-left font-semibold text-foreground" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-b px-2 py-1.5 align-top last:border-b-0" {...props} />
  ),
  img: ({ node: _node, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="my-2 max-h-72 w-auto max-w-full rounded-lg border object-contain"
      {...props}
    />
  ),
};

export function normalizeChatMarkdown(text: string): string {
  return text.replace(LEGACY_BULLET_RE, "$1- ");
}

export function toPlainPreview(text: string, maxLength: number): string {
  const plain = normalizeChatMarkdown(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(#{1,6}|>|-|\*|\d+\.)\s+/gm, "")
    .replace(/[*_`|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trimEnd()}…` : plain;
}

export const ChatMarkdown = memo(function ChatMarkdown({
  text,
}: Readonly<{ text: string }>) {
  return (
    <div className="min-w-0 break-words text-xs leading-relaxed text-foreground/90">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {normalizeChatMarkdown(text)}
      </Markdown>
    </div>
  );
});
