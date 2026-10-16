"use client";

import type {
  EvaluatedProperty,
  PropertyQuestionItem,
} from "@/types/moradia";
import {
  Bot,
  Building2,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface PropertyChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qaItems: PropertyQuestionItem[];
  pinnedProperty: EvaluatedProperty | null;
  onClearPinnedProperty: () => void;
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

const PINNED_QUICK_PROMPTS = [
  "Qual o andar real?",
  "É mobiliado pelas fotos?",
  "Vale agendar visita?",
  "Por que recebeu essa nota?",
] as const;

const GENERAL_QUICK_PROMPTS = [
  "Quais os melhores apês no topo do ranking?",
  "Qual tem melhor relação nota vs aluguel?",
  "Algum andar alto sem mobília se destaca?",
  "Compare os top imóveis filtrados na tela",
] as const;

function formatCurrency(val: number): string {
  return `R$ ${Math.round(val).toLocaleString("pt-BR")}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function renderFormattedInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    const key = `inl-${idx}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-purple-700 dark:text-purple-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderAssistantMessage(text: string): React.ReactNode {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-foreground">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        const key = `ln-${idx}`;
        if (!line) {
          return <div key={key} className="h-1" />;
        }
        if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.slice(2).trim();
          return (
            <div key={key} className="flex items-start gap-1.5 pl-1">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500/80" />
              <div className="flex-1">{renderFormattedInline(content)}</div>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const numMatch = /^(\d+\.)\s+(.*)$/.exec(line);
          return (
            <div key={key} className="flex items-start gap-1.5 pl-1">
              <span className="shrink-0 font-mono text-[11px] font-bold text-purple-600 dark:text-purple-400">
                {numMatch?.[1]}
              </span>
              <div className="flex-1">
                {renderFormattedInline(numMatch?.[2] ?? line)}
              </div>
            </div>
          );
        }
        return <p key={key}>{renderFormattedInline(line)}</p>;
      })}
    </div>
  );
}

export function PropertyChatDrawer({
  open,
  onOpenChange,
  qaItems,
  pinnedProperty,
  onClearPinnedProperty,
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [filterPinnedOnly, setFilterPinnedOnly] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const pinnedKey = useMemo(
    () =>
      pinnedProperty ? `${pinnedProperty.provider}:${pinnedProperty.id}` : null,
    [pinnedProperty],
  );

  const pendingCount = useMemo(
    () => qaItems.filter((i) => i.status === "pending").length,
    [qaItems],
  );

  const visibleItems = useMemo(() => {
    if (filterPinnedOnly && pinnedKey) {
      return qaItems.filter((item) => item.propertyKey === pinnedKey);
    }
    return qaItems;
  }, [qaItems, filterPinnedOnly, pinnedKey]);

  // Reset filterPinnedOnly if pinnedProperty is cleared
  useEffect(() => {
    if (!pinnedKey) {
      setFilterPinnedOnly(false);
    }
  }, [pinnedKey]);

  // Keyboard shortcut Cmd/Ctrl + J or Escape
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

  const lastItem = qaItems.at(-1);
  const lastItemSignature = lastItem
    ? `${lastItem.id}:${lastItem.status}:${lastItem.answeredAt ?? ""}:${(lastItem.answer ?? "").length}`
    : "";
  const prevAutoScrollRef = useRef<{
    open: boolean;
    length: number;
    lastSignature: string;
  }>({
    open: false,
    length: qaItems.length,
    lastSignature: lastItemSignature,
  });

  // Scroll to a targeted property's message when requested from a card badge
  useEffect(() => {
    if (!open || !scrollTargetPropertyKey) return;
    const targetItems = qaItems.filter(
      (i) => i.propertyKey === scrollTargetPropertyKey,
    );
    const lastTarget = targetItems.at(-1);
    if (lastTarget) {
      setHighlightedId(lastTarget.id);
      const scrollTimer = setTimeout(() => {
        const el = messageRefs.current.get(lastTarget.id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        onConsumeScrollTarget?.();
      }, 120);
      const clearTimer = setTimeout(() => setHighlightedId(null), 2600);
      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
    onConsumeScrollTarget?.();
  }, [open, scrollTargetPropertyKey, qaItems, onConsumeScrollTarget]);

  // Auto-scroll to bottom only when drawer opens, items.length increases, or the last item's status/answer changes
  useEffect(() => {
    const prev = prevAutoScrollRef.current;
    const justOpened = open && !prev.open;
    const lengthIncreased = qaItems.length > prev.length;
    const lastChanged =
      qaItems.length > 0 && lastItemSignature !== prev.lastSignature;

    prevAutoScrollRef.current = {
      open,
      length: qaItems.length,
      lastSignature: lastItemSignature,
    };

    if (!open || scrollTargetPropertyKey) return;
    if (!justOpened && !lengthIncreased && !lastChanged) return;

    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [open, qaItems.length, lastItemSignature, scrollTargetPropertyKey]);

  // Focus textarea when drawer opens or pinned property changes
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 120);
    return () => clearTimeout(t);
  }, [open, pinnedKey]);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleSend = useCallback(
    async (customQuestion?: string) => {
      const text = (customQuestion ?? draft).trim();
      if (!text || isSubmitting) return;
      setSubmitError(null);
      try {
        const result = await onSubmitQuestion({
          question: text,
          property: pinnedProperty,
        });
        if (result === false) {
          setSubmitError(
            "Não foi possível enviar sua pergunta. Tente novamente.",
          );
          return;
        }
        if (!customQuestion) {
          setDraft("");
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
        }
      } catch (err) {
        setSubmitError(
          err instanceof Error && err.message
            ? err.message
            : "Falha ao enviar pergunta. Seu texto foi preservado.",
        );
      }
    },
    [draft, isSubmitting, onSubmitQuestion, pinnedProperty],
  );

  const quickPrompts = pinnedProperty
    ? PINNED_QUICK_PROMPTS
    : GENERAL_QUICK_PROMPTS;

  return (
    <>
      {/* Floating Chat Bubble Button (Bottom-Right) */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Abrir Chat & Consultor da Sessão"
        className={`fixed bottom-5 right-5 z-30 inline-flex items-center gap-2.5 rounded-full border px-4 py-3 text-xs font-bold shadow-2xl transition-all duration-200 ${
          open
            ? "pointer-events-none translate-y-2 opacity-0"
            : "border-purple-400/40 bg-purple-600 text-white hover:scale-105 hover:bg-purple-700"
        }`}
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        </div>
        <span>Chat Imóveis</span>
        {qaItems.length > 0 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[11px] font-extrabold text-white">
            {qaItems.length}
          </span>
        )}
      </button>

      {/* Backdrop on mobile */}
      {open && (
        <div
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] sm:hidden"
        />
      )}

      {/* Slide-Over Chat Sidebar / Drawer */}
      <aside
        aria-label="Chat & Consultor da Sessão"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-card shadow-2xl transition-transform duration-200 ease-out sm:w-[420px] lg:w-[460px] ${
          open
            ? "translate-x-0"
            : "pointer-events-none invisible translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-sm font-bold text-foreground">
                    Chat & Consultor da Sessão
                  </h2>
                  <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">
                    ⌘J
                  </kbd>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Conectado à sessão
                  </span>
                  <span>·</span>
                  <span>
                    {qaItems.length}{" "}
                    {qaItems.length === 1 ? "mensagem" : "mensagens"}
                  </span>
                  {pendingCount > 0 && (
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">
                      ({pendingCount} analisando)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {pinnedKey && qaItems.some((i) => i.propertyKey === pinnedKey) && (
              <button
                type="button"
                onClick={() => setFilterPinnedOnly((prev) => !prev)}
                title="Filtrar apenas mensagens do imóvel fixado"
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  filterPinnedOnly
                    ? "border-purple-500 bg-purple-500/15 text-purple-800 dark:text-purple-200"
                    : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {filterPinnedOnly ? "Só fixado" : "Todos"}
              </button>
            )}
            {qaItems.length > 0 && (
              <button
                type="button"
                onClick={() => void onClearHistory()}
                title="Limpar histórico de conversa"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              title="Fechar Chat (Esc)"
              aria-label="Fechar Chat"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Message Timeline */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50"
        >
          {visibleItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-4 py-8 space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/12 text-purple-600 dark:text-purple-400">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-bold text-foreground">
                  Tire dúvidas ou reporte ajustes sem sair da lista
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clique em <strong>Perguntar</strong> em qualquer card para
                  anexar o imóvel, consultar andar, mobília, detalhes do anúncio
                  ou pedir ajustes de nota direto para a sessão do Cursor.
                </p>
              </div>
            </div>
          ) : (
            visibleItems.map((qa) => {
              const snap = qa.propertySnapshot;
              const isGeneral =
                qa.propertyKey === "general" || !snap?.neighborhood;
              const isHighlighted = highlightedId === qa.id;

              return (
                <div
                  key={qa.id}
                  ref={(el) => {
                    if (el) {
                      messageRefs.current.set(qa.id, el);
                    } else {
                      messageRefs.current.delete(qa.id);
                    }
                  }}
                  className={`space-y-2.5 rounded-xl transition-all duration-300 ${
                    isHighlighted
                      ? "ring-2 ring-purple-500 bg-purple-500/5 p-2 -mx-2"
                      : ""
                  }`}
                >
                  {/* User Bubble (Right-Aligned, Primary Purple Fill) */}
                  <div className="flex justify-end">
                    <div className="max-w-[90%] rounded-2xl rounded-tr-xs bg-purple-600 px-3.5 py-2.5 text-white shadow-xs space-y-2">
                      {/* Clickable Mini-Card Chip of Attached Property */}
                      {!isGeneral && (
                        <div className="flex items-center justify-between gap-1.5 rounded-lg bg-black/20 px-2.5 py-1.5 text-[11px] backdrop-blur-xs">
                          <button
                            type="button"
                            onClick={() => onFocusProperty(qa.propertyKey)}
                            title="Focar e rolar até este imóvel na lista"
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-semibold text-purple-100 hover:text-white hover:underline"
                          >
                            <MapPin className="h-3 w-3 shrink-0 text-purple-200" />
                            <span className="truncate">
                              {snap.overallRank ? `#${snap.overallRank} · ` : ""}
                              {snap.neighborhood}
                              {snap.street ? ` — ${snap.street}` : ""} ·{" "}
                              {formatCurrency(snap.totalMonthly)}
                            </span>
                          </button>
                          {snap.url && (
                            <a
                              href={snap.url}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir anúncio original"
                              className="shrink-0 text-purple-200 hover:text-white"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">
                        {qa.question}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] text-purple-200/90">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-2.5 w-2.5" />
                          <span>Você · {formatTime(qa.createdAt)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void onDeleteQuestion(qa.id)}
                          title="Excluir mensagem"
                          className="rounded p-0.5 text-purple-200/80 hover:bg-white/15 hover:text-white"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Assistant Bubble (Left-Aligned, Card/Secondary Surface with Avatar) */}
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-xs border bg-card px-3.5 py-2.5 shadow-2xs space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                          {qa.answerSource === "cursor_session"
                            ? "Agente Cursor (Sessão Ativa)"
                            : qa.answerSource === "llm"
                              ? "Consultor IA + Sessão Cursor"
                              : "Consultor Moradia (Dados + Sessão)"}
                        </span>
                        {qa.answeredAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(qa.answeredAt)}
                          </span>
                        )}
                      </div>

                      {qa.status === "pending" || !qa.answer ? (
                        <div className="flex items-center gap-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 animate-pulse">
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                          <span>
                            Analisando imóvel e consultando a sessão...
                          </span>
                        </div>
                      ) : (
                        renderAssistantMessage(qa.answer)
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isSubmitting && (
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-2xl rounded-tl-xs border bg-card px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-medium text-purple-700 dark:text-purple-300 animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>Analisando imóvel e consultando a sessão...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pinned Property Context Bar + Quick Prompts + Input Footer */}
        <div className="border-t bg-card p-3 space-y-2.5">
          {/* Pinned Property Context Bar */}
          {pinnedProperty ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-purple-500/35 bg-purple-500/10 p-2 dark:border-purple-400/30 dark:bg-purple-950/30">
              <button
                type="button"
                onClick={() =>
                  onFocusProperty(
                    `${pinnedProperty.provider}:${pinnedProperty.id}`,
                  )
                }
                title="Rolar até este imóvel na lista"
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                {pinnedProperty.samplePhotos[0]?.url ? (
                  <img
                    src={pinnedProperty.samplePhotos[0].url}
                    alt={pinnedProperty.title}
                    className="h-10 w-12 shrink-0 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {pinnedProperty.overallRank !== null && (
                      <span className="rounded bg-purple-600 px-1.5 py-0.2 font-mono text-[10px] font-extrabold text-white">
                        #{pinnedProperty.overallRank}
                      </span>
                    )}
                    <span className="truncate text-xs font-bold text-foreground">
                      {pinnedProperty.neighborhood} ({pinnedProperty.cityCode}) —{" "}
                      {pinnedProperty.street}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {formatCurrency(pinnedProperty.totalMonthly)}/mês
                    </span>
                    <span>·</span>
                    <span>{pinnedProperty.areaM2} m²</span>
                    <span>·</span>
                    <span className="font-mono font-semibold text-purple-700 dark:text-purple-300">
                      {pinnedProperty.finalScore.toFixed(1)} pts
                    </span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={onClearPinnedProperty}
                title="Desanexar imóvel para fazer pergunta geral"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-purple-500/30 bg-background px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-purple-500 hover:text-foreground"
              >
                <X className="h-3 w-3" />
                <span>Desanexar imóvel</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                <span className="truncate font-medium">
                  Contexto Geral (Top imóveis filtrados na tela
                  {filteredCount > 0 ? `: ${filteredCount}` : ""})
                </span>
              </div>
              <span className="shrink-0 text-[10px] opacity-80">
                Clique em &ldquo;Perguntar&rdquo; num card p/ fixar
              </span>
            </div>
          )}

          {/* Quick 1-Click Prompt Pills */}
          <div className="flex flex-wrap gap-1">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSend(prompt)}
                className="rounded-full border border-purple-500/25 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-purple-500/50 hover:bg-purple-500/10 hover:text-foreground disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {submitError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-300"
            >
              {submitError}
            </div>
          )}

          {/* Multi-line Auto-Expanding Textarea + Send Button */}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              disabled={isSubmitting}
              onChange={(e) => {
                setDraft(e.target.value);
                if (submitError) setSubmitError(null);
                adjustTextareaHeight();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={
                pinnedProperty
                  ? `Pergunte sobre ${pinnedProperty.neighborhood} (${pinnedProperty.street}) ou reporte ajuste...`
                  : "Pergunte sobre os imóveis da tela ou peça um ajuste..."
              }
              className="max-h-[120px] min-h-[38px] flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-xs leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            />
            <button
              type="button"
              disabled={!draft.trim() || isSubmitting}
              onClick={() => void handleSend()}
              aria-label="Enviar mensagem"
              className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
