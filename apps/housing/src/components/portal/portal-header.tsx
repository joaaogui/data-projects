"use client";

import { ThemeToggle } from "@data-projects/ui";
import {
  Radar,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import type { PortalController } from "@/components/portal/use-portal-controller";

export function PortalHeader({ ctl }: { ctl: PortalController }) {
  const {
    isRefreshing,
    meta,
    recentListingsCount,
    refreshDatasetFromServer,
    scrapeStatus,
    setShowScrapeDrawer,
    setShowSlidersDrawer,
    showScrapeDrawer,
    showSlidersDrawer,
  } = ctl;
  return (
    <>
      {/* Compact Top Header */}
      <header className="flex items-center justify-between gap-1 rounded-xl border bg-card px-2 py-2 shadow-xs sm:flex-wrap sm:gap-3 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#9333ea] via-[#820AD1] to-[#581c87] text-white shadow-sm ring-1 ring-purple-400/30 sm:h-9 sm:w-9">
            <svg
              viewBox="0 0 32 32"
              aria-hidden="true"
              className="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5"
            >
              <path
                d="M6.5 15.5A9.5 9.5 0 0 1 25.5 15.5"
                fill="none"
                stroke="#E9D5FF"
                strokeOpacity="0.5"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M7 16.5L12 14V25H7V16.5Z"
                fill="#D8B4FE"
                fillOpacity="0.85"
              />
              <path
                d="M11.5 11.5L16 7L20.5 11.5V25H11.5V11.5Z"
                fill="#FFFFFF"
              />
              <path
                d="M20.5 14.5L25 16.5V25H20.5V14.5Z"
                fill="#C084FC"
                fillOpacity="0.9"
              />
              <rect
                x="13.5"
                y="12.5"
                width="2"
                height="2"
                rx="0.5"
                fill="#6B21A8"
              />
              <rect
                x="16.5"
                y="12.5"
                width="2"
                height="2"
                rx="0.5"
                fill="#6B21A8"
              />
              <rect
                x="13.5"
                y="16"
                width="2"
                height="2"
                rx="0.5"
                fill="#6B21A8"
              />
              <rect
                x="16.5"
                y="16"
                width="2"
                height="2"
                rx="0.5"
                fill="#6B21A8"
              />
              <rect
                x="14.75"
                y="20"
                width="2.5"
                height="5"
                rx="0.75"
                fill="#581C87"
              />
              <circle cx="16" cy="5.25" r="1.5" fill="#FDE047" />
              <path
                d="M5.5 25H26.5"
                stroke="#FFFFFF"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 whitespace-nowrap sm:flex-wrap sm:gap-2">
              <h1 className="shrink-0 text-xs font-bold tracking-tight sm:text-lg">
                Housing
              </h1>
              <span className="hidden sm:inline-block rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                BH · CP · RJ
              </span>
              {meta.updatedAt && (
                <span
                  title={`Snapshot gerado em ${meta.updatedAt} (fonte: ${meta.source})`}
                  className="inline-flex min-w-0 items-center gap-1 overflow-hidden rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200 sm:gap-1.5 sm:px-2 sm:text-[10px]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="truncate sm:hidden" suppressHydrationWarning>
                    {meta.totalCount.toLocaleString("pt-BR")} apês
                    <span className="hidden min-[380px]:inline">
                      {" · "}
                      {new Date(meta.updatedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      })}
                    </span>
                  </span>
                  <span className="hidden sm:inline" suppressHydrationWarning>
                    Base:{" "}
                    {new Date(meta.updatedAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Sao_Paulo",
                    })}{" "}
                    · {meta.totalCount.toLocaleString("pt-BR")} imóveis
                    {recentListingsCount > 0 &&
                      ` (${recentListingsCount} novos)`}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Ranking dinâmico de imóveis e bairros avaliados em tempo real
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:flex-wrap sm:gap-1.5">
          <button
            type="button"
            onClick={() => setShowScrapeDrawer((v) => !v)}
            title="Atualizar Anúncios e Verificar Disponibilidade (Scrape)"
            aria-label="Atualizar Anúncios e Verificar Disponibilidade (Scrape)"
            aria-expanded={showScrapeDrawer}
            className={`inline-flex h-7 w-7 sm:w-auto sm:h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all sm:px-2.5 ${
              scrapeStatus.status === "running"
                ? "border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200 ring-2 ring-amber-500/30"
                : showScrapeDrawer
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {scrapeStatus.status === "running" ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radar className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {scrapeStatus.status === "running"
                ? "Atualizando Base..."
                : "Atualizar Anúncios"}
            </span>
            {scrapeStatus.status === "running" && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={refreshDatasetFromServer}
            disabled={isRefreshing}
            title="Recarregar dados do servidor"
            aria-label="Recarregar dados do servidor"
            className="hidden sm:inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>{isRefreshing ? "Sincronizando..." : "Recarregar"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSlidersDrawer((v) => !v)}
            title="Calibrador de Critérios e Pesos"
            aria-label="Calibrador de Critérios e Pesos"
            aria-pressed={showSlidersDrawer}
            className={`inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border transition-all ${
              showSlidersDrawer
                ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/40"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <ThemeToggle />
          <a
            href="https://joaog.space"
            title="Voltar para joaog.space"
            aria-label="Voltar para joaog.space"
            className="inline-flex h-7 w-7 sm:w-auto sm:h-8 shrink-0 items-center justify-center rounded-lg border bg-background text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-secondary sm:px-2.5"
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">← joaog.space</span>
          </a>
        </div>
      </header>
    </>
  );
}
