"use client";

import {
  CheckCircle2,
  Heart,
  Link2,
  Loader2,
  Radar,
  RefreshCw,
  Square,
} from "lucide-react";

import type { PortalController } from "@/components/portal/use-portal-controller";

export function ScrapePanel({ ctl }: { ctl: PortalController }) {
  const {
    cancelScrapeJob,
    customSearchUrl,
    favoriteKeys,
    filteredItems,
    isStartingScrape,
    postPropertyQuery,
    queryFavorites,
    queryFilters,
    scrapeCities,
    scrapeStatus,
    selectedNeighborhoods,
    setCustomSearchUrl,
    setScrapeCities,
    setShowScrapeDrawer,
    showScrapeDrawer,
    startScrapeJob,
    toggleScrapeCity,
    weights,
  } = ctl;
  return (
    <>
      {/* Painel de 1 Clique: Atualizar Anúncios (Scrape) & Verificador de Desativados */}
      {showScrapeDrawer && (
        <section className="rounded-xl border border-primary/30 bg-card p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" />
                Painel de Scrape e Atualização de Anúncios em Tempo Real
              </h2>
              <p className="text-xs text-muted-foreground">
                Busque novos apartamentos nos portais e verifique quais anúncios
                foram alugados/desativados. Anúncios que saíram do ar não são
                excluídos — ficam marcados como{" "}
                <strong className="text-rose-600 dark:text-rose-400">
                  Desativado / Alugado
                </strong>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowScrapeDrawer(false)}
              className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
            >
              Fechar
            </button>
          </div>

          {scrapeStatus.workerAvailable === false && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <strong>Modo Hospedado (Somente Leitura para Scrape):</strong> O
              worker local de scrape Playwright (`HOUSING_SCRAPER_DIR`) não
              está disponível neste ambiente serverless. Para disparar novos
              scrapes ao vivo, execute o portal localmente ou rode
              `scripts/scrape-sync-job.ts`.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* 1. Escopo de Praças e Bairros */}
            <div className="rounded-lg border bg-background/60 p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-foreground">
                  1. Escopo de Praças & Bairros
                </span>
                <button
                  type="button"
                  onClick={() => setScrapeCities(["BH", "RJ", "CP", "SP"])}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Selecionar todas
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["BH", "RJ", "CP", "SP"] as const).map((c) => {
                  const checked = scrapeCities.includes(c);
                  return (
                    <button
                      key={`scrape-city-${c}`}
                      type="button"
                      onClick={() => toggleScrapeCity(c)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        className="pointer-events-none h-3 w-3 accent-primary"
                      />
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {selectedNeighborhoods.length > 0 ? (
                  <>
                    Bairros filtrados ativos:{" "}
                    <strong className="text-foreground">
                      {selectedNeighborhoods.join(", ")}
                    </strong>
                  </>
                ) : (
                  "Todos os bairros-alvo configurados nas praças selecionadas."
                )}
              </p>
            </div>

            {/* 2. Ações Rápidas com 1 Clique */}
            <div className="rounded-lg border bg-background/60 p-3 space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-foreground">
                2. Sincronização com 1 Clique
              </span>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={
                    scrapeStatus.status === "running" || isStartingScrape
                  }
                  onClick={() =>
                    void startScrapeJob({
                      mode: "full_sync",
                      cities: scrapeCities,
                      neighborhoods: selectedNeighborhoods,
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-2xs transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>
                    Buscar Novos + Atualizar Desativados (
                    {scrapeCities.join(", ")})
                  </span>
                </button>

                <button
                  type="button"
                  disabled={
                    scrapeStatus.status === "running" || isStartingScrape
                  }
                  onClick={async () => {
                    let topActiveKeys: string[] = [];
                    try {
                      const data = await postPropertyQuery({
                        filters: queryFilters,
                        weights,
                        favorites: queryFavorites,
                        mode: "activeKeys",
                        limit: 25,
                      });
                      topActiveKeys = data.keys ?? [];
                    } catch {
                      topActiveKeys = filteredItems
                        .filter((p) => p.isActive !== false)
                        .slice(0, 25)
                        .map((p) => `${p.provider}:${p.id}`);
                    }
                    const keysToVerify = [
                      ...new Set([...favoriteKeys, ...topActiveKeys]),
                    ];
                    void startScrapeJob({
                      mode: "verify_only",
                      cities: scrapeCities,
                      keys: keysToVerify,
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-800 transition-colors hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-200"
                >
                  <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                  <span>
                    Verificar Favoritos ({favoriteKeys.length}) e Top Imóveis
                    (Rápido)
                  </span>
                </button>
              </div>
            </div>

            {/* 3. Adicionar Nova URL de Busca */}
            <div className="rounded-lg border bg-background/60 p-3 space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-foreground">
                3. Adicionar URL de Busca
              </span>
              <p className="text-[11px] text-muted-foreground">
                Cole uma URL de busca do QuintoAndar, Zap Imóveis, VivaReal,
                Netimóveis ou Imovelweb:
              </p>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="url"
                    value={customSearchUrl}
                    onChange={(e) => setCustomSearchUrl(e.target.value)}
                    placeholder="https://www.quintoandar.com.br/alugar/imovel/..."
                    className="w-full rounded-lg border bg-card pl-8 pr-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    !customSearchUrl.trim() ||
                    scrapeStatus.status === "running" ||
                    isStartingScrape
                  }
                  onClick={() =>
                    void startScrapeJob({
                      mode: "custom_url",
                      cities: scrapeCities,
                      customUrl: customSearchUrl.trim(),
                    })
                  }
                  className="shrink-0 rounded-lg border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50"
                >
                  Extrair URL
                </button>
              </div>
            </div>
          </div>

          {/* Barra de Progresso ao Vivo */}
          {scrapeStatus.status !== "idle" && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {scrapeStatus.status === "running" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-800 dark:text-amber-200">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Em execução
                    </span>
                  ) : scrapeStatus.status === "completed" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Concluído
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-800 dark:text-rose-200">
                      Interrompido / Falhou
                    </span>
                  )}
                  <span className="font-semibold text-foreground">
                    {scrapeStatus.phase ?? "Processando..."}
                  </span>
                  {scrapeStatus.currentSearchLabel && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      ({scrapeStatus.currentSearchLabel})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-800 dark:text-emerald-200">
                    +{scrapeStatus.newListingsAdded ?? 0} novos anúncios
                  </span>
                  <span className="rounded bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-800 dark:text-rose-200">
                    {scrapeStatus.deactivatedCount ?? 0} marcados como
                    desativados
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">
                    {scrapeStatus.verifiedCount ?? 0} verificados
                  </span>

                  {scrapeStatus.status === "running" && (
                    <button
                      type="button"
                      onClick={() => void cancelScrapeJob()}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 font-sans text-xs font-semibold text-rose-800 hover:bg-rose-500/25 dark:text-rose-200"
                    >
                      <Square className="h-3 w-3" />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {(() => {
                const completed = scrapeStatus.completedSteps ?? 0;
                const total = Math.max(1, scrapeStatus.totalSteps ?? 1);
                const pct =
                  scrapeStatus.status === "completed"
                    ? 100
                    : Math.min(98, Math.round((completed / total) * 100));
                return (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full transition-all duration-300 ${
                          scrapeStatus.status === "failed"
                            ? "bg-rose-500"
                            : scrapeStatus.status === "completed"
                              ? "bg-emerald-500"
                              : "bg-primary"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                      <span>
                        Etapa {completed} de {total} ({pct}%)
                      </span>
                      {scrapeStatus.updatedAt && (
                        <span>
                          Atualizado às{" "}
                          {new Date(scrapeStatus.updatedAt).toLocaleTimeString(
                            "pt-BR",
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {scrapeStatus.error && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {scrapeStatus.error}
                </p>
              )}

              {scrapeStatus.logs && scrapeStatus.logs.length > 0 && (
                <details className="rounded border bg-background/70 p-2 text-[11px]">
                  <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                    Logs ao vivo ({scrapeStatus.logs.length} linhas)
                  </summary>
                  <pre className="mt-1.5 max-h-40 overflow-y-auto font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {scrapeStatus.logs.slice(-30).join("\n")}
                  </pre>
                </details>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
