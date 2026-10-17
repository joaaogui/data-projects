"use client";

import { Building2, GitCompare, MapPin } from "lucide-react";

import { CITY_LABELS } from "@/components/portal/constants";
import type { PortalController } from "@/components/portal/use-portal-controller";

export function CityToolbar({ ctl }: { ctl: PortalController }) {
  const {
    activeTab,
    cityTop3ByCode,
    comparedProperties,
    filteredTotal,
    handleCitySelect,
    selectableCityList,
    selectedCities,
    setActiveTab,
  } = ctl;
  return (
    <>
      {/* Compact Navigation & City Selector Toolbar */}
      <div className="flex flex-col gap-2 border-b pb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap sm:flex-wrap sm:gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("properties")}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
              activeTab === "properties"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="hidden sm:inline">Ranking de </span>Imóveis (
              {filteredTotal})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("neighborhoods")}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
              activeTab === "neighborhoods"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="hidden sm:inline">Ranking dos </span>20 Bairros
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
              activeTab === "compare"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <GitCompare className="h-3.5 w-3.5 shrink-0" />
            <span>Comparador ({comparedProperties.length}/4)</span>
          </button>
        </div>

        {/* Inline City Pills with Muted Top-3 Badge (hidden cities appear only when enabled) */}
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap sm:flex-wrap">
          {(["ALL", ...selectableCityList] as const).map((city) => {
            const cityInfo =
              city === "ALL" ? undefined : cityTop3ByCode.get(city);
            const isSelected =
              city === "ALL"
                ? selectedCities.length === 0
                : selectedCities.includes(city);
            return (
              <button
                key={city}
                type="button"
                aria-pressed={isSelected}
                title={
                  city === "ALL"
                    ? `${CITY_LABELS.ALL} (clique nas praças para selecionar mais de uma por vez)`
                    : city === "BSB"
                      ? "Águas Claras — Brasília (DF): Benchmark temporário para comparação com seu aluguel atual de R$ 3.400"
                      : `${CITY_LABELS[city]}${cityInfo ? ` — Top 3 bairros: ${cityInfo.top3Avg.toFixed(2)} (${cityInfo.top3Names.join(", ")})` : ""} · Clique para alternar seleção múltipla`
                }
                onClick={() => handleCitySelect(city)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors sm:px-2.5 ${
                  isSelected
                    ? city === "BSB"
                      ? "bg-amber-600 text-white"
                      : "bg-primary text-primary-foreground"
                    : city === "BSB"
                      ? "border border-amber-500/50 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200"
                      : "border bg-card hover:bg-secondary"
                }`}
              >
                <span>
                  {city === "ALL"
                    ? "Todas"
                    : city === "BSB"
                      ? "BSB (Ref)"
                      : city}
                </span>
                {cityInfo && (
                  <span
                    className={`font-mono text-[10px] font-normal ${
                      isSelected
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    · {cityInfo.top3Avg.toFixed(1)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
