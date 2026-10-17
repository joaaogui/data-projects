"use client";

import { ChatMarkdown } from "@/components/chat-markdown";
import { isAwaitingDetailedAnswer } from "@/lib/chat-text";
import {
  getThumbPhotoUrl,
  handleImgError,
} from "@/components/property-photo-showcase";
import type {
  EvaluatedProperty,
  PropertyQuestionItem,
  PropertyQuestionSnapshot,
} from "@/types/housing";
import {
  ArrowDown,
  Bot,
  Building2,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const GENERAL_THREAD_KEY = "general";
const SEEN_STORAGE_KEY = "housing-chat-seen-answers";
const MAX_SEEN_KEYS = 300;
const NEAR_BOTTOM_PX = 120;
const MAX_QUESTION_LENGTH = 1500;
const COLLAPSED_ANSWER_PX = 340;

export { isAwaitingDetailedAnswer };

export interface PropertyChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qaItems: PropertyQuestionItem[];
  /** `null` = all conversations, `"general"` = general thread, otherwise a property key. */
  activeThreadKey: string | null;
  pinnedProperty: EvaluatedProperty | null;
  onSelectThread: (threadKey: string | null) => void;
  onFocusProperty: (propertyKey: string) => void;
  onSubmitQuestion: (params: {
    question: string;
    property: EvaluatedProperty | null;
  }) => Promise<boolean | void>;
  onDeleteQuestion: (id: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
  isSubmitting: boolean;
  scrollTargetPropertyKey?: string | null;
  onConsumeScrollTarget?: () => void;
  filteredCount?: number;
}

interface ChatThread {
  key: string;
  label: string;
  thumbnailUrl: string | null;
  count: number;
  lastAt: string;
  unread: number;
}

const GENERAL_PROMPTS = [
  "Quais os melhores apês do ranking agora?",
  "Qual o melhor bairro de Campinas pra mim?",
  "Qual tem melhor relação nota vs aluguel?",
  "Compare os top imóveis filtrados na tela",
] as const;

function buildPropertyPrompts(property: EvaluatedProperty | null): string[] {
  const prompts: string[] = [];
  if (property && !property.eligible) prompts.push("Por que esse foi retido?");
  prompts.push("Essa área é segura?", "Qual o andar e é mobiliado?");
  if (!property?.cardTags.acLabel) prompts.push("Tem ar-condicionado mesmo?");
  prompts.push(
    "Quanto tempo até o escritório?",
    "Vale a pena comparado com Águas Claras?",
    "Por que recebeu essa nota?",
  );
  return prompts.slice(0, 6);
}

function formatCurrency(val: number): string {
  return `R$ ${Math.round(val).toLocaleString("pt-BR")}`;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return time;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `ontem ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}

function snapshotLabel(snap: PropertyQuestionSnapshot | undefined): string {
  if (!snap?.neighborhood) return "Imóvel";
  return snap.cityCode ? `${snap.neighborhood} (${snap.cityCode})` : snap.neighborhood;
}

function seenKeyOf(item: PropertyQuestionItem): string {
  return `${item.id}@${item.answeredAt ?? ""}`;
}

function readSeenKeys(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === "string"))
      : null;
  } catch {
    return null;
  }
}

function writeSeenKeys(keys: Set<string>): void {
  try {
    window.localStorage.setItem(
      SEEN_STORAGE_KEY,
      JSON.stringify([...keys].slice(-MAX_SEEN_KEYS)),
    );
  } catch {
    // storage unavailable (private mode)
  }
}

function useMobileViewport(enabled: boolean) {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setBox(null);
      return;
    }
    const vv = window.visualViewport;
    const update = () => {
      if (window.innerWidth >= 640 || !vv) {
        setBox(null);
        return;
      }
      setBox({ top: vv.offsetTop, height: vv.height });
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    const prevOverflow = document.body.style.overflow;
    if (window.innerWidth < 640) document.body.style.overflow = "hidden";
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.body.style.overflow = prevOverflow;
    };
  }, [enabled]);
  return box;
}

function CopyButton({ text }: Readonly<{ text: string }>) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copiar resposta"
      aria-label="Copiar resposta"
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function CollapsibleAnswer({
  text,
  defaultExpanded,
}: Readonly<{ text: string; defaultExpanded: boolean }>) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (el) setOverflows(el.scrollHeight > COLLAPSED_ANSWER_PX + 40);
  }, [text]);

  const collapsed = overflows && !expanded;
  return (
    <div>
      <div
        ref={contentRef}
        className={`relative ${collapsed ? "overflow-hidden" : ""}`}
        style={collapsed ? { maxHeight: COLLAPSED_ANSWER_PX } : undefined}
      >
        <ChatMarkdown text={text} />
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:underline dark:text-purple-300"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Mostrar menos" : "Mostrar resposta completa"}
        </button>
      )}
    </div>
  );
}

function AssistantAvatar({ detailed }: Readonly<{ detailed: boolean }>) {
  return (
    <div
      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
        detailed
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300"
      }`}
    >
      {detailed ? <Sparkles className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
    </div>
  );
}

function TypingBubble({ label }: Readonly<{ label: string }>) {
  return (
    <div className="flex items-start gap-2" role="status">
      <AssistantAvatar detailed={false} />
      <div className="rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500" />
          </span>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

interface MessageGroupProps {
  item: PropertyQuestionItem;
  highlighted: boolean;
  unread: boolean;
  showPropertyChip: boolean;
  awaitingDetailed: boolean;
  onDelete: (id: string) => void;
  onSelectThread: (key: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

function MessageGroup({
  item,
  highlighted,
  unread,
  showPropertyChip,
  awaitingDetailed,
  onDelete,
  onSelectThread,
  registerRef,
}: Readonly<MessageGroupProps>) {
  const snap = item.propertySnapshot;
  const isGeneral = item.propertyKey === GENERAL_THREAD_KEY || !snap?.neighborhood;
  const isDetailed = item.answerSource === "cursor_session";
  const isOptimistic = item.status === "pending" || !item.answer;
  const sourceLabel = isDetailed
    ? "Análise completa · sessão Cursor"
    : item.answerSource === "llm"
      ? "Resposta rápida · IA com dados do portal"
      : "Resposta instantânea · dados do portal";

  return (
    <div
      ref={(el) => registerRef(item.id, el)}
      className={`group/msg space-y-2 rounded-xl transition-colors duration-500 ${
        highlighted ? "-mx-2 bg-purple-500/8 p-2 ring-2 ring-purple-500/60" : ""
      }`}
    >
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-1">
          {showPropertyChip && (
            <button
              type="button"
              onClick={() => onSelectThread(item.propertyKey)}
              className="ml-auto flex max-w-full items-center gap-1 truncate rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-purple-500/50 hover:text-foreground"
              title="Abrir a conversa deste imóvel"
            >
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                {isGeneral ? "Geral" : `${snapshotLabel(snap)}${snap.street ? ` · ${snap.street}` : ""}`}
              </span>
            </button>
          )}
          <div className="rounded-2xl rounded-tr-sm bg-purple-600 px-3.5 py-2 text-white shadow-xs">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
              {item.question}
            </p>
          </div>
          <div className="flex items-center justify-end gap-1.5 pr-1 text-[10px] text-muted-foreground">
            <span>{formatTimestamp(item.createdAt)}</span>
            {!isOptimistic && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                title="Excluir pergunta e resposta"
                aria-label="Excluir pergunta e resposta"
                className="rounded p-0.5 opacity-60 hover:bg-rose-500/10 hover:text-rose-600 hover:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-60 sm:focus-visible:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isOptimistic ? (
        <TypingBubble label="Consultando os dados do imóvel…" />
      ) : (
        <div className="flex items-start gap-2">
          <AssistantAvatar detailed={isDetailed} />
          <div
            className={`min-w-0 flex-1 rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 shadow-2xs ${
              isDetailed ? "border-emerald-500/30" : ""
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                  isDetailed
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-purple-700 dark:text-purple-300"
                }`}
              >
                {sourceLabel}
                {unread && (
                  <span className="rounded-full bg-emerald-500 px-1.5 py-px text-[9px] font-bold text-white normal-case tracking-normal">
                    nova
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatTimestamp(item.answeredAt)}
              </span>
            </div>

            <CollapsibleAnswer text={item.answer!} defaultExpanded={isDetailed} />

            {isDetailed && item.instantAnswer && (
              <details className="mt-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-[11px]">
                <summary className="cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground">
                  Ver resposta instantânea original
                </summary>
                <div className="mt-2">
                  <ChatMarkdown text={item.instantAnswer} />
                </div>
              </details>
            )}

            {awaitingDetailed && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-200">
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                <span>
                  Analisando em detalhe na sessão do Cursor — a resposta completa
                  substitui esta aqui automaticamente.
                </span>
              </div>
            )}

            <div className="mt-1.5 flex justify-end">
              <CopyButton text={item.answer!} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PropertyChatDrawer({
  open,
  onOpenChange,
  qaItems,
  activeThreadKey,
  pinnedProperty,
  onSelectThread,
  onFocusProperty,
  onSubmitQuestion,
  onDeleteQuestion,
  onClearHistory,
  isSubmitting,
  scrollTargetPropertyKey,
  onConsumeScrollTarget,
  filteredCount = 0,
}: Readonly<PropertyChatDrawerProps>) {
  const [draft, setDraft] = useState("");
  const [submitError, setSubmitError] = useState<{
    message: string;
    question: string;
  } | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [seenKeys, setSeenKeys] = useState<Set<string> | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const nearBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  const mobileBox = useMobileViewport(open);

  const isPropertyThread =
    activeThreadKey !== null && activeThreadKey !== GENERAL_THREAD_KEY;

  const visibleItems = useMemo(
    () =>
      activeThreadKey === null
        ? qaItems
        : qaItems.filter((item) => item.propertyKey === activeThreadKey),
    [qaItems, activeThreadKey],
  );

  const contextSnapshot = useMemo(() => {
    if (!isPropertyThread) return null;
    return visibleItems.at(-1)?.propertySnapshot ?? null;
  }, [isPropertyThread, visibleItems]);

  const unreadIds = useMemo(() => {
    const ids = new Set<string>();
    if (!seenKeys) return ids;
    for (const item of qaItems) {
      if (item.answerSource === "cursor_session" && !seenKeys.has(seenKeyOf(item))) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [qaItems, seenKeys]);

  const awaitingCount = useMemo(
    () => qaItems.filter((i) => isAwaitingDetailedAnswer(i, nowMs)).length,
    [qaItems, nowMs],
  );

  const threads = useMemo<ChatThread[]>(() => {
    const map = new Map<string, ChatThread>();
    for (const item of qaItems) {
      const existing = map.get(item.propertyKey);
      const isGeneral = item.propertyKey === GENERAL_THREAD_KEY;
      const unread = unreadIds.has(item.id) ? 1 : 0;
      if (existing) {
        existing.count += 1;
        existing.unread += unread;
        if (item.createdAt > existing.lastAt) existing.lastAt = item.createdAt;
        if (!existing.thumbnailUrl && item.propertySnapshot?.thumbnailUrl) {
          existing.thumbnailUrl = item.propertySnapshot.thumbnailUrl;
        }
      } else {
        map.set(item.propertyKey, {
          key: item.propertyKey,
          label: isGeneral ? "Geral" : snapshotLabel(item.propertySnapshot),
          thumbnailUrl: isGeneral ? null : (item.propertySnapshot?.thumbnailUrl ?? null),
          count: 1,
          lastAt: item.createdAt,
          unread,
        });
      }
    }
    if (pinnedProperty) {
      const key = `${pinnedProperty.provider}:${pinnedProperty.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: `${pinnedProperty.neighborhood} (${pinnedProperty.cityCode})`,
          thumbnailUrl: pinnedProperty.samplePhotos[0]?.url ?? null,
          count: 0,
          lastAt: new Date(nowMs).toISOString(),
          unread: 0,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [qaItems, unreadIds, pinnedProperty, nowMs]);

  // On the very first visit, everything already answered counts as seen.
  useEffect(() => {
    if (seenKeys || qaItems.length === 0) return;
    const stored = readSeenKeys();
    if (stored) {
      setSeenKeys(stored);
      return;
    }
    const initial = new Set(qaItems.map(seenKeyOf));
    writeSeenKeys(initial);
    setSeenKeys(initial);
  }, [seenKeys, qaItems]);

  useEffect(() => {
    if (!open || !seenKeys) return;
    const fresh = visibleItems.filter(
      (i) => i.answerSource === "cursor_session" && !seenKeys.has(seenKeyOf(i)),
    );
    if (fresh.length === 0) return;
    const t = setTimeout(() => {
      const next = new Set(seenKeys);
      for (const i of fresh) next.add(seenKeyOf(i));
      writeSeenKeys(next);
      setSeenKeys(next);
    }, 2500);
    return () => clearTimeout(t);
  }, [open, visibleItems, seenKeys]);

  useEffect(() => {
    if (!open || awaitingCount === 0) return;
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [open, awaitingCount]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    nearBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    if (near) setShowJumpToLatest(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Jump to the newest message when opening or switching threads.
  useLayoutEffect(() => {
    if (!open || scrollTargetPropertyKey) return;
    scrollToBottom();
  }, [open, activeThreadKey, scrollTargetPropertyKey, scrollToBottom]);

  const lastVisible = visibleItems.at(-1);
  const contentSignature = `${visibleItems.length}:${lastVisible?.id ?? ""}:${lastVisible?.status ?? ""}:${(lastVisible?.answer ?? "").length}`;
  const prevSignatureRef = useRef(contentSignature);
  useLayoutEffect(() => {
    if (prevSignatureRef.current === contentSignature) return;
    prevSignatureRef.current = contentSignature;
    if (!open) return;
    if (forceScrollRef.current || nearBottomRef.current) {
      forceScrollRef.current = false;
      scrollToBottom("smooth");
    } else {
      setShowJumpToLatest(true);
    }
  }, [contentSignature, open, scrollToBottom]);

  // Consuming the target re-runs this effect, so the scroll and highlight
  // timers live in their own effects instead of this one's cleanup.
  useEffect(() => {
    if (!open || !scrollTargetPropertyKey) return;
    const lastTarget = qaItems
      .filter((i) => i.propertyKey === scrollTargetPropertyKey)
      .at(-1);
    onConsumeScrollTarget?.();
    if (lastTarget) setHighlightedId(lastTarget.id);
  }, [open, scrollTargetPropertyKey, qaItems, onConsumeScrollTarget]);

  useEffect(() => {
    if (!highlightedId) return;
    const scrollTimer = setTimeout(() => {
      messageRefs.current
        .get(highlightedId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    const clearTimer = setTimeout(() => setHighlightedId(null), 2400);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedId]);

  // Focus the composer on desktop only; on touch devices it would pop the keyboard over the history.
  useEffect(() => {
    if (!open) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [open, activeThreadKey]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) messageRefs.current.set(id, el);
    else messageRefs.current.delete(id);
  }, []);

  const handleDelete = useCallback(
    (id: string) => void onDeleteQuestion(id),
    [onDeleteQuestion],
  );

  const handleSend = useCallback(
    async (customQuestion?: string) => {
      const text = (customQuestion ?? draft).trim().slice(0, MAX_QUESTION_LENGTH);
      if (!text || isSubmitting) return;
      setSubmitError(null);
      setDraft("");
      forceScrollRef.current = true;
      try {
        const result = await onSubmitQuestion({ question: text, property: pinnedProperty });
        if (result === false) throw new Error("Não foi possível enviar sua pergunta.");
      } catch (err) {
        setDraft((current) => current || text);
        setSubmitError({
          message:
            err instanceof Error && err.message
              ? err.message
              : "Falha ao enviar a pergunta.",
          question: text,
        });
      }
    },
    [draft, isSubmitting, onSubmitQuestion, pinnedProperty],
  );

  const quickPrompts = isPropertyThread
    ? buildPropertyPrompts(pinnedProperty)
    : GENERAL_PROMPTS;
  const showOptimisticTyping =
    isSubmitting && !visibleItems.some((i) => i.status === "pending");
  const contextTitle = pinnedProperty
    ? `${pinnedProperty.neighborhood} (${pinnedProperty.cityCode})`
    : contextSnapshot
      ? snapshotLabel(contextSnapshot)
      : null;
  const contextStreet = pinnedProperty?.street ?? contextSnapshot?.street ?? "";
  const contextThumb =
    pinnedProperty?.samplePhotos[0]?.url ?? contextSnapshot?.thumbnailUrl ?? null;
  const contextUrl = pinnedProperty?.url ?? contextSnapshot?.url ?? "";
  const totalUnread = unreadIds.size;

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={`Abrir assistente de imóveis${totalUnread > 0 ? ` (${totalUnread} novas respostas)` : ""}`}
        className={`fixed right-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-30 inline-flex items-center gap-2 rounded-full bg-purple-600 p-3.5 text-xs font-bold text-white shadow-2xl transition-all duration-200 hover:bg-purple-700 sm:right-5 sm:px-4 sm:py-3 ${
          open ? "pointer-events-none translate-y-2 opacity-0" : "hover:scale-105"
        }`}
      >
        <span className="relative">
          <MessageSquare className="h-5 w-5 sm:h-4 sm:w-4" />
          {awaitingCount > 0 && totalUnread === 0 && (
            <span className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
          )}
        </span>
        <span className="hidden sm:inline">Assistente</span>
        {totalUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-background sm:static sm:ring-0">
            {totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] sm:hidden"
        />
      )}

      <aside
        aria-label="Assistente de imóveis"
        aria-hidden={!open}
        inert={!open}
        style={mobileBox ? { top: mobileBox.top, height: mobileBox.height } : undefined}
        className={`fixed inset-x-0 top-0 bottom-0 z-40 flex h-dvh flex-col bg-card shadow-2xl transition-transform duration-200 ease-out sm:inset-y-0 sm:left-auto sm:h-auto sm:w-[440px] sm:border-l lg:w-[500px] ${
          open ? "translate-x-0" : "pointer-events-none invisible translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-3 pt-[max(env(safe-area-inset-top),0.625rem)] pb-2.5 sm:px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-sm font-bold text-foreground">Assistente de imóveis</h2>
              <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
                ⌘J
              </kbd>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {awaitingCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {awaitingCount === 1
                    ? "1 análise detalhada em andamento"
                    : `${awaitingCount} análises detalhadas em andamento`}
                </span>
              ) : (
                "Resposta instantânea + análise detalhada da sessão Cursor"
              )}
            </p>
          </div>
          {qaItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirmClear) {
                  setConfirmClear(false);
                  void onClearHistory();
                } else {
                  setConfirmClear(true);
                }
              }}
              title="Apagar todo o histórico"
              className={`inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors ${
                confirmClear
                  ? "border-rose-500 bg-rose-500 text-white"
                  : "bg-background text-muted-foreground hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-600"
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmClear && <span>Apagar tudo?</span>}
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            title="Fechar (Esc)"
            aria-label="Fechar assistente"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Thread switcher */}
        <nav
          aria-label="Conversas"
          className="flex gap-1.5 overflow-x-auto border-b bg-muted/30 px-3 py-2 [scrollbar-width:none] sm:px-4"
        >
          <button
            type="button"
            onClick={() => onSelectThread(null)}
            aria-pressed={activeThreadKey === null}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              activeThreadKey === null
                ? "border-purple-600 bg-purple-600 text-white"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas
            <span className="opacity-70">{qaItems.length}</span>
            {totalUnread > 0 && activeThreadKey !== null && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
          </button>
          {!threads.some((t) => t.key === GENERAL_THREAD_KEY) && (
            <button
              type="button"
              onClick={() => onSelectThread(GENERAL_THREAD_KEY)}
              aria-pressed={activeThreadKey === GENERAL_THREAD_KEY}
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                activeThreadKey === GENERAL_THREAD_KEY
                  ? "border-purple-600 bg-purple-600 text-white"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Geral
            </button>
          )}
          {threads.map((thread) => {
            const active = activeThreadKey === thread.key;
            return (
              <button
                key={thread.key}
                type="button"
                onClick={() => onSelectThread(thread.key)}
                aria-pressed={active}
                title={thread.label}
                className={`inline-flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-purple-600 bg-purple-600 text-white"
                    : "bg-background text-muted-foreground hover:text-foreground"
                } ${thread.thumbnailUrl ? "" : "pl-2.5"}`}
              >
                {thread.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getThumbPhotoUrl(thread.thumbnailUrl)}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImgError(e, thread.thumbnailUrl!)}
                    alt=""
                    loading="lazy"
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                  />
                )}
                <span className="truncate">{thread.label}</span>
                {thread.count > 1 && <span className="opacity-70">{thread.count}</span>}
                {thread.unread > 0 && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Property context */}
        {isPropertyThread && contextTitle && activeThreadKey && (
          <div className="flex items-center gap-2.5 border-b px-3 py-2 sm:px-4">
            {contextThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getThumbPhotoUrl(contextThumb)}
                referrerPolicy="no-referrer"
                onError={(e) => handleImgError(e, contextThumb)}
                alt=""
                className="h-11 w-14 shrink-0 rounded-lg border object-cover"
              />
            ) : (
              <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <Building2 className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {pinnedProperty?.overallRank != null && (
                  <span className="rounded bg-purple-600 px-1.5 font-mono text-[10px] font-extrabold text-white">
                    #{pinnedProperty.overallRank}
                  </span>
                )}
                {pinnedProperty && !pinnedProperty.eligible && (
                  <span
                    className="rounded bg-rose-500/15 px-1.5 text-[10px] font-bold text-rose-700 dark:text-rose-300"
                    title={pinnedProperty.exclusionReason ?? undefined}
                  >
                    Retido
                  </span>
                )}
                <span className="truncate text-xs font-bold text-foreground">{contextTitle}</span>
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                {contextStreet && <>{contextStreet} · </>}
                {pinnedProperty ? (
                  <>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(pinnedProperty.totalMonthly)}
                    </span>
                    {` · ${pinnedProperty.areaM2} m² · `}
                    <span className="font-mono font-semibold text-purple-700 dark:text-purple-300">
                      {pinnedProperty.finalScore.toFixed(1)} pts
                    </span>
                  </>
                ) : contextSnapshot ? (
                  formatCurrency(contextSnapshot.totalMonthly)
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onFocusProperty(activeThreadKey)}
              title="Mostrar este imóvel na lista"
              aria-label="Mostrar este imóvel na lista"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <MapPin className="h-3.5 w-3.5" />
            </button>
            {contextUrl && (
              <a
                href={contextUrl}
                target="_blank"
                rel="noreferrer"
                title="Abrir anúncio original"
                aria-label="Abrir anúncio original"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            aria-live="polite"
            className="h-full space-y-5 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
          >
            {visibleItems.length === 0 && !showOptimisticTyping ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/12 text-purple-600 dark:text-purple-400">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="max-w-xs space-y-1">
                  <p className="text-sm font-bold text-foreground">
                    {isPropertyThread
                      ? `Pergunte sobre ${contextTitle ?? "este imóvel"}`
                      : activeThreadKey === GENERAL_THREAD_KEY
                        ? "Pergunte sobre o ranking geral"
                        : "Nenhuma conversa ainda"}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {isPropertyThread
                      ? "Segurança da rua, andar, mobília, ar-condicionado, por que foi retido, tempo até o escritório…"
                      : `Use "Perguntar" em um card para conversar sobre um imóvel específico, ou pergunte sobre os ${filteredCount > 0 ? `${filteredCount} imóveis filtrados` : "imóveis da tela"}.`}
                  </p>
                </div>
              </div>
            ) : (
              visibleItems.map((qa) => (
                <MessageGroup
                  key={qa.id}
                  item={qa}
                  highlighted={highlightedId === qa.id}
                  unread={unreadIds.has(qa.id)}
                  showPropertyChip={activeThreadKey === null}
                  awaitingDetailed={isAwaitingDetailedAnswer(qa, nowMs)}
                  onDelete={handleDelete}
                  onSelectThread={onSelectThread}
                  registerRef={registerRef}
                />
              ))
            )}
            {showOptimisticTyping && <TypingBubble label="Enviando…" />}
          </div>
          {showJumpToLatest && (
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-lg hover:bg-secondary"
            >
              <ArrowDown className="h-3 w-3" />
              Novas mensagens
            </button>
          )}
        </div>

        {/* Composer */}
        <div className="space-y-2 border-t bg-card px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-4">
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] sm:-mx-4 sm:px-4">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSend(prompt)}
                className="shrink-0 rounded-full border border-purple-500/25 bg-muted/50 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:border-purple-500/50 hover:bg-purple-500/10 hover:text-foreground disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {submitError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-300"
            >
              <span className="min-w-0">
                {submitError.message.replace(/[.!?]?$/, ".")} Seu texto foi mantido.
              </span>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  const q = submitError.question;
                  setDraft("");
                  void handleSend(q);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-500/40 bg-background px-2 py-0.5 font-semibold hover:bg-rose-500/10"
              >
                <RotateCcw className="h-3 w-3" />
                Tentar de novo
              </button>
            </div>
          )}

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              maxLength={MAX_QUESTION_LENGTH}
              enterKeyHint="send"
              aria-label="Mensagem"
              onChange={(e) => {
                setDraft(e.target.value);
                if (submitError) setSubmitError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={
                isPropertyThread && contextTitle
                  ? `Pergunte sobre ${contextTitle}…`
                  : "Pergunte sobre os imóveis da tela…"
              }
              className="max-h-[140px] min-h-[40px] flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-[13px] leading-snug focus:ring-2 focus:ring-purple-500 focus:outline-hidden sm:text-xs"
            />
            <button
              type="submit"
              disabled={!draft.trim() || isSubmitting}
              aria-label="Enviar mensagem"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs transition-colors hover:bg-purple-700 disabled:opacity-40"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
          <p className="hidden text-[10px] text-muted-foreground sm:block">
            Enter envia · Shift+Enter quebra linha
            {draft.length > MAX_QUESTION_LENGTH - 200 &&
              ` · ${draft.length}/${MAX_QUESTION_LENGTH}`}
          </p>
        </div>
      </aside>
    </>
  );
}
