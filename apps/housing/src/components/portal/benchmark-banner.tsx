"use client";

import { X } from "lucide-react";

import type { PortalController } from "@/components/portal/use-portal-controller";

export function BenchmarkBanner({ ctl }: { ctl: PortalController }) {
  const {
    benchmarkPanelCollapsed,
    bsbBenchmarkStats,
    enableBsbBenchmark,
    handleToggleBsbBenchmark,
    maxTotalMonthly,
    selectedCities,
    setBenchmarkPanelCollapsed,
    setMaxTotalMonthly,
    setOnlyTop20Neighborhoods,
    setSelectedCities,
    setSelectedNeighborhoods,
    setVisibleCount,
  } = ctl;
  return (
    <>
      {/* Collapsible BSB Benchmark Comparison Banner (Only visible when Benchmark Mode is toggled ON) */}
      {enableBsbBenchmark && (
        <div
          data-testid="bsb-benchmark-banner"
          className="rounded-xl border-2 border-amber-500/45 bg-gradient-to-br from-amber-500/10 via-card to-purple-500/5 p-3 sm:p-4 shadow-xs space-y-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-900 dark:text-amber-100">
                  ⚖️ MODO BENCHMARK TEMPORÁRIO (OPT-IN)
                </span>
                <h2 className="text-xs sm:text-sm font-bold text-foreground">
                  Seu Aluguel Atual em Águas Claras (R$ 3.400/mês) vs. Mercado
                  Aberto Hoje ({bsbBenchmarkStats.totalScrapedBsb} anúncios
                  raspados em Águas Claras)
                </h2>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Comparação na mesma régua de pontuação (40–95 m², 1+ vaga,
                modernidade e lazer). Quando desativado, Águas Claras sai 100%
                do ranking.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBenchmarkPanelCollapsed((v) => !v)}
                className="rounded-md border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {benchmarkPanelCollapsed ? "Expandir dados" : "Recolher"}
              </button>
              <button
                type="button"
                onClick={handleToggleBsbBenchmark}
                className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-500/20 dark:text-rose-200"
              >
                <X className="h-3 w-3" />
                <span>Desativar Benchmark</span>
              </button>
            </div>
          </div>

          {!benchmarkPanelCollapsed && (
            <>
              {/* Key Findings Grid: Why R$ 3.400 feels so different from open-market listings today */}
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                <div className="rounded-lg border border-amber-500/30 bg-background/85 p-3 space-y-1">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    1. Seu Contrato Vigente vs. Águas Claras Hoje
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-base font-bold text-foreground">
                      R$ 3.400
                    </span>
                    <span className="text-xs text-muted-foreground">
                      seu pacote hoje vs.{" "}
                      <strong className="font-mono text-amber-700 dark:text-amber-300">
                        R${" "}
                        {bsbBenchmarkStats.bsbModernMedianMonthly.toLocaleString(
                          "pt-BR",
                        )}
                      </strong>{" "}
                      (mediana moderna hoje em BSB)
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Para novos inquilinos entrando hoje em Águas Claras, o
                    pacote mediano de um apê moderno (48–75 m², 1+ vaga) já
                    subiu para{" "}
                    <strong>
                      R${" "}
                      {bsbBenchmarkStats.bsbModernMedianMonthly.toLocaleString(
                        "pt-BR",
                      )}
                      /mês
                    </strong>{" "}
                    (
                    {bsbBenchmarkStats.contractGapReais > 0
                      ? `+R$ ${bsbBenchmarkStats.contractGapReais.toLocaleString("pt-BR")}/mês ou +${bsbBenchmarkStats.contractGapPct}% acima do seu contrato`
                      : "em linha com seu contrato"}
                    ).
                  </p>
                </div>

                <div className="rounded-lg border bg-background/85 p-3 space-y-1">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    2. O Que R$ 3.400 Compra Hoje em Águas Claras?
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs">
                    <span>
                      ≤ R$ 3.400:{" "}
                      <strong className="text-sm text-foreground">
                        {bsbBenchmarkStats.countUpTo3400}
                      </strong>{" "}
                      apês ({bsbBenchmarkStats.countModernUpTo3400} modernos)
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span>
                      ≤ R$ 4.000:{" "}
                      <strong className="text-sm text-foreground">
                        {bsbBenchmarkStats.countUpTo4000}
                      </strong>
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span>
                      ≤ R$ 4.500:{" "}
                      <strong className="text-sm text-foreground">
                        {bsbBenchmarkStats.countUpTo4500}
                      </strong>
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Dos {bsbBenchmarkStats.totalEligibleBsb} imóveis
                    qualificados hoje em Águas Claras, apenas{" "}
                    <strong>{bsbBenchmarkStats.countUpTo3400}</strong> saem até
                    R$ 3.400 (quase todos de 1 quarto/43–50 m²). Os condomínios
                    clube de 2 quartos (55–70 m²) hoje pedem{" "}
                    <strong>R$ 3.900 a R$ 4.900/mês</strong> em novos anúncios.
                  </p>
                </div>

                <div className="rounded-lg border bg-background/85 p-3 space-y-1.5">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    3. Comparativo Direto (Mesmo Padrão Residencial: Sem Mobília
                    · 48–75 m²)
                  </span>
                  <div className="space-y-1 font-mono text-[11px]">
                    {bsbBenchmarkStats.cityComparisons.map((c) => (
                      <div
                        key={c.code}
                        className={`flex items-center justify-between rounded px-1.5 py-0.5 ${
                          c.code === "BSB"
                            ? "bg-amber-500/15 font-bold text-amber-900 dark:text-amber-100"
                            : "bg-muted/50 text-foreground"
                        }`}
                      >
                        <span className="font-sans text-[11px] font-semibold">
                          {c.label}
                        </span>
                        <span>
                          {c.medianMonthly !== null &&
                          c.medianPm2 !== null &&
                          c.medianScore !== null
                            ? `R$ ${c.medianMonthly.toLocaleString("pt-BR")} · R$ ${c.medianPm2}/m² · ${c.medianScore.toFixed(1)} pts`
                            : "Sem amostra"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick 1-Click Benchmark Filter Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                  Testar na lista:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCities(["BSB"]);
                    setSelectedNeighborhoods([]);
                    setOnlyTop20Neighborhoods(false);
                    setMaxTotalMonthly(null);
                    setVisibleCount(30);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    selectedCities.length === 1 &&
                    selectedCities[0] === "BSB" &&
                    maxTotalMonthly === null
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "bg-background hover:bg-secondary"
                  }`}
                >
                  Ver só Águas Claras ({bsbBenchmarkStats.totalEligibleBsb}{" "}
                  apês)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCities(["BSB"]);
                    setSelectedNeighborhoods([]);
                    setOnlyTop20Neighborhoods(false);
                    setMaxTotalMonthly(3600);
                    setVisibleCount(30);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    selectedCities.length === 1 &&
                    selectedCities[0] === "BSB" &&
                    maxTotalMonthly === 3600
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "bg-background hover:bg-secondary"
                  }`}
                >
                  O que R$ 3.400–3.600 paga hoje em Águas Claras
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCities(["BSB", "BH"]);
                    setSelectedNeighborhoods([]);
                    setOnlyTop20Neighborhoods(true);
                    setMaxTotalMonthly(null);
                    setVisibleCount(30);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    selectedCities.length === 2 &&
                    selectedCities.includes("BSB") &&
                    selectedCities.includes("BH") &&
                    maxTotalMonthly === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-secondary"
                  }`}
                >
                  Comparar Águas Claras + BH (Top Bairros)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCities(["BSB", "BH", "CP"]);
                    setSelectedNeighborhoods([]);
                    setOnlyTop20Neighborhoods(true);
                    setMaxTotalMonthly(4200);
                    setVisibleCount(30);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    selectedCities.length === 3 &&
                    selectedCities.includes("BSB") &&
                    maxTotalMonthly === 4200
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-secondary"
                  }`}
                >
                  Até R$ 4.200: Águas Claras vs. BH vs. Campinas
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
