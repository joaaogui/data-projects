"use client";

import { CITY_BADGE_INFO } from "@/components/portal/constants";
import type { PortalController } from "@/components/portal/use-portal-controller";

export function NeighborhoodsTab({ ctl }: { ctl: PortalController }) {
  const {
    activeTab,
    dynamicNeighborhoods,
    selectedCities,
    setActiveTab,
    setSelectedCities,
    setSelectedNeighborhoods,
  } = ctl;
  return (
    <>
      {/* TAB 2: DYNAMIC 20 NEIGHBORHOODS */}
      {activeTab === "neighborhoods" && (
        <section className="space-y-4">
          {/* Mobile / Compact Neighborhood Cards (< md) */}
          <div className="space-y-3 md:hidden">
            {dynamicNeighborhoods
              .filter(
                (n) =>
                  selectedCities.length === 0 ||
                  selectedCities.includes(n.cityCode),
              )
              .map((n) => {
                const rankDiff = n.overallPosition - n.dynamicOverallRank;
                return (
                  <article
                    key={`mob-${n.cityCode}:${n.neighborhood}`}
                    className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold">
                          #{n.dynamicOverallRank}
                          {rankDiff !== 0 && (
                            <span
                              className={`ml-1 text-[10px] ${
                                rankDiff > 0
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-rose-700 dark:text-rose-400"
                              }`}
                            >
                              ({rankDiff > 0 ? `+${rankDiff}` : rankDiff})
                            </span>
                          )}
                        </span>
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                            CITY_BADGE_INFO[n.cityCode].className
                          }`}
                        >
                          {CITY_BADGE_INFO[n.cityCode].ufLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCities([n.cityCode]);
                            setSelectedNeighborhoods([
                              `${n.cityCode}:${n.neighborhood}`,
                            ]);
                            setActiveTab("properties");
                          }}
                          className="text-sm font-bold text-primary hover:underline"
                        >
                          {n.neighborhood}
                        </button>
                      </div>
                      <span className="font-mono text-base font-bold text-primary">
                        {n.dynamicScore.toFixed(2)}/10
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1 rounded-lg bg-muted/50 p-2 text-center font-mono text-[10px]">
                      <div>
                        <span className="block text-muted-foreground">
                          Respiro
                        </span>
                        <strong className="text-xs">
                          {n.urbanBreathingScore.toFixed(1)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">
                          Logíst.
                        </span>
                        <strong className="text-xs">
                          {n.commuteLogisticsScore.toFixed(1)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">
                          Estoque
                        </span>
                        <strong className="text-xs">
                          {n.buildingStockFitScore.toFixed(1)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">
                          Orçam.
                        </span>
                        <strong className="text-xs">
                          {n.budgetFitScore.toFixed(1)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">
                          Segur.
                        </span>
                        <strong className="text-xs">
                          {n.safetyCarScore.toFixed(1)}
                        </strong>
                      </div>
                    </div>

                    <p className="text-xs font-medium text-foreground">
                      <span className="font-mono text-[11px] text-muted-foreground mr-1.5">
                        [{n.commuteTime}]
                      </span>
                      {n.shortRationale}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {n.detailedJustification.replace(
                        /^Nota\s+[\d.]+\/10\s*\([^)]*\):\s*/i,
                        "",
                      )}
                    </p>
                  </article>
                );
              })}
          </div>

          {/* Desktop Full Table (>= md) */}
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/50 text-[11px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Pos. Dinâmica</th>
                    <th className="px-3 py-3">Cidade</th>
                    <th className="px-3 py-3">Bairro</th>
                    <th className="px-3 py-3 text-right">Nota Dinâmica</th>
                    <th className="px-3 py-3 text-right">Respiro</th>
                    <th className="px-3 py-3 text-right">Logística</th>
                    <th className="px-3 py-3 text-right">Estoque</th>
                    <th className="px-3 py-3 text-right">Orçamento</th>
                    <th className="px-3 py-3 text-right">Carro/Seg.</th>
                    <th className="px-3 py-3">Tempo Nubank</th>
                    <th className="px-3 py-3">Justificativa Detalhada</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dynamicNeighborhoods
                    .filter(
                      (n) =>
                        selectedCities.length === 0 ||
                        selectedCities.includes(n.cityCode),
                    )
                    .map((n) => {
                      const rankDiff = n.overallPosition - n.dynamicOverallRank;
                      return (
                        <tr
                          key={`${n.cityCode}:${n.neighborhood}`}
                          className="hover:bg-muted/30 align-top"
                        >
                          <td className="px-3 py-3 font-mono font-bold whitespace-nowrap">
                            #{n.dynamicOverallRank}
                            {rankDiff !== 0 && (
                              <span
                                className={`ml-1.5 text-[10px] ${
                                  rankDiff > 0
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-rose-700 dark:text-rose-400"
                                }`}
                              >
                                ({rankDiff > 0 ? `+${rankDiff}` : rankDiff})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-semibold whitespace-nowrap">
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                                CITY_BADGE_INFO[n.cityCode].className
                              }`}
                            >
                              {CITY_BADGE_INFO[n.cityCode].ufLabel}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-bold whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCities([n.cityCode]);
                                setSelectedNeighborhoods([
                                  `${n.cityCode}:${n.neighborhood}`,
                                ]);
                                setActiveTab("properties");
                              }}
                              className="text-primary hover:underline"
                            >
                              {n.neighborhood}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-sm font-bold text-primary">
                            {n.dynamicScore.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.urbanBreathingScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.commuteLogisticsScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.buildingStockFitScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.budgetFitScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono">
                            {n.safetyCarScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap font-mono">
                            {n.commuteTime}
                          </td>
                          <td className="px-3 py-3 min-w-[340px] max-w-xl leading-relaxed text-muted-foreground space-y-1.5">
                            <p className="font-medium text-foreground">
                              {n.shortRationale}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {n.detailedJustification.replace(
                                /^Nota\s+[\d.]+\/10\s*\([^)]*\):\s*/i,
                                "",
                              )}
                            </p>
                            <details className="group rounded-lg border bg-background/60 p-2.5 text-[11px]">
                              <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                                Ver memória de cálculo e notas quebradas
                              </summary>
                              <p className="mt-1.5 leading-relaxed text-muted-foreground">
                                {n.dynamicJustification}
                              </p>
                            </details>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
