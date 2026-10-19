import type { PropertyQuestionItem } from "@/types/housing";

const LEGACY_BULLET_RE = /^([^\S\r\n\u2028\u2029]*)•\s+/gm;
const DETAILED_ANSWER_WAIT_MS = 30 * 60_000;

export function normalizeChatMarkdown(text: string): string {
  return text.replace(LEGACY_BULLET_RE, "$1- ");
}

export function toPlainPreview(text: string, maxLength: number): string {
  const plain = normalizeChatMarkdown(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[(?=([^\]]+))\1\]\([^)]*\)/g, "$1")
    .replace(/^[^\S\r\n\u2028\u2029]*(#{1,6}|>|-|\*|\d+\.)\s+/gm, "")
    .replace(/[*_`|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength
    ? `${plain.slice(0, maxLength).trimEnd()}…`
    : plain;
}

export function isAwaitingDetailedAnswer(
  item: PropertyQuestionItem,
  nowMs: number = Date.now(),
): boolean {
  if (item.awaitingDetailedAnswer !== true) return false;
  if (item.answerSource === "cursor_session") return false;
  const created = Date.parse(item.createdAt);
  return Number.isFinite(created) && nowMs - created < DETAILED_ANSWER_WAIT_MS;
}
