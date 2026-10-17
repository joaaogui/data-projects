"use client";

import {
  FLOOR_FILTER_OPTIONS,
  SORT_BY_OPTIONS,
  PROPERTY_FEATURE_OPTIONS,
  deriveLegacyFurnishedFilter,
  type SortByOption,
} from "@/lib/property-filters";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
  Heart,
  Columns2,
  List,
  Map as MapIcon,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { CITY_LABELS } from "@/components/portal/constants";
import {
  ineligibleModeOf,
  ineligibleModePatch,
  type IneligibleMode,
} from "@/lib/filter-state";
import { HIDDEN_BY_DEFAULT_CITIES, HIDDEN_CITY_LABELS } from "@/lib/city-config";
import type { PortalController } from "@/components/portal/use-portal-controller";

export function FiltersPanel({ ctl }: { ctl: PortalController }) {
  const {
    activeAdvancedFilterCount,
    activeFilterPills,
    applyFilterPatch,
    applyPerfeitoFilterPreset,
    cityTop3ByCode,
    availableNeighborhoodOptions,
    copiedTop50Count,
    deactivatedFilter,
    deactivatedTotalCount,
    enabledHiddenCities,
    filteredTotal,
    floorFilters,
    handleCitySelect,
    handleCopyTop50ForAi,
    handleToggleHiddenCity,
    hideForSale,
    hideMegaCondo,
    ineligibleActiveCount,
    isPerfeitoPresetActive,
    listingDateFrom,
    listingDateTo,
    maxAreaM2,
    maxCommuteMinutes,
    maxListingAgeDays,
    maxTotalMonthly,
    minAreaM2,
    minListingAgeDays,
    minModernityScore,
    minScore,
    minTotalMonthly,
    modernityTiers,
    onlyFavorites,
    onlyIneligible,
    onlyNewEntries,
    onlySafeStreets,
    onlyTop20Neighborhoods,
    providerFilter,
    requiredFeatures,
    resetAllFilters,
    searchQuery,
    selectedBathrooms,
    selectedBedrooms,
    selectableCityList,
    selectedCities,
    selectedFurnitureTiers,
    selectedNeighborhoods,
    selectedParking,
    setDeactivatedFilter,
    setFloorFilters,
    setFurnishedFilter,
    setHideForSale,
    setHideMegaCondo,
    setListingDateFrom,
    setListingDateTo,
    setMaxAreaM2,
    setMaxCommuteMinutes,
    setMaxListingAgeDays,
    setMaxTotalMonthly,
    setMinAreaM2,
    setMinBathrooms,
    setMinBedrooms,
    setMinListingAgeDays,
    setMinModernityScore,
    setMinParking,
    setMinScore,
    setMinTotalMonthly,
    setModernityTiers,
    setOnlyFavorites,
    setOnlyNewEntries,
    setOnlySafeStreets,
    setOnlyTop20Neighborhoods,
    setProviderFilter,
    setRequiredFeatures,
    setSearchQuery,
    setSelectedBathrooms,
    setSelectedBedrooms,
    setSelectedFurnitureTiers,
    setSelectedNeighborhoods,
    setSelectedParking,
    setShowAdvancedFilters,
    setSortBy,
    setViewMode,
    setVisibleCount,
    showAdvancedFilters,
    showIneligible,
    sortBy,
    totalBasePoolCount,
    viewMode,
    visibleFavoriteCount,
  } = ctl;
  const ineligibleMode = ineligibleModeOf({ showIneligible, onlyIneligible });
  const setIneligibleMode = (mode: IneligibleMode) =>
    applyFilterPatch(ineligibleModePatch(mode));
  return (
    <>
      {/* 2-Level Ergonomic Filter System */}
      <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs space-y-2.5 sm:space-y-3">
        {/* LEVEL 1 — Primary Filter Strip (Always Visible) */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* City selector (multi-select): the only city control; hidden cities appear once enabled */}
          <div
            role="group"
            aria-label="Cidade"
            className="order-0 inline-flex items-center gap-0.5 rounded-lg border bg-background p-0.5 sm:order-1"
          >
            {(["ALL", ...selectableCityList] as const).map((city) => {
              const isSelected =
                city === "ALL"
                  ? selectedCities.length === 0
                  : selectedCities.includes(city);
              return (
                <button
                  key={`l1-city-${city}`}
                  type="button"
                  aria-pressed={isSelected}
                  title={
                    city === "ALL"
                      ? `Mostrar todas as ${selectableCityList.length} praças`
                      : `Alternar ${CITY_LABELS[city]} (permite selecionar mais de uma praça)`
                  }
                  onClick={() => handleCitySelect(city)}
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {city === "ALL" ? "Todas" : city}
                  {city !== "ALL" && cityTop3ByCode.get(city) && (
                    <span className="ml-1 font-mono text-[10px] font-medium opacity-70">
                      {cityTop3ByCode.get(city)!.top3Avg.toFixed(1)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Free Search (Full-width Row 1 on mobile, flex-1 inline on sm+) */}
          <div className="relative order-1 w-full sm:order-3 sm:flex-1 sm:min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(30);
              }}
              placeholder="Rua, bairro, condomínio, comodidade, ID..."
              className="w-full rounded-lg border bg-background pl-8 pr-7 py-1.5 sm:py-1 text-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mais Filtros Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            aria-expanded={showAdvancedFilters}
            className={`order-2 sm:order-6 inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-2.5 ${
              showAdvancedFilters || activeAdvancedFilterCount > 0
                ? "border-primary/50 bg-primary/10 text-primary"
                : "bg-background hover:bg-secondary"
            }`}
          >
            <Filter className="h-3.5 w-3.5 shrink-0" />
            <span className="lg:hidden">Filtros</span>
            <span className="hidden lg:inline">Mais Filtros</span>
            {activeAdvancedFilterCount > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
                {activeAdvancedFilterCount}
              </span>
            )}
            {showAdvancedFilters ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>

          {/* 1-Click Favoritos Filter Toggle */}
          <button
            type="button"
            onClick={() => {
              setOnlyFavorites((v) => !v);
              setVisibleCount(30);
            }}
            aria-pressed={onlyFavorites}
            aria-label={`Favoritos (${visibleFavoriteCount})`}
            title="Mostrar apenas seus imóveis favoritados (inclusive os que foram alugados/desativados)"
            className={`order-3 sm:order-2 inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-2.5 ${
              onlyFavorites
                ? "border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-200"
                : "bg-background text-foreground hover:bg-secondary"
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 shrink-0 ${
                onlyFavorites || visibleFavoriteCount > 0
                  ? "fill-rose-500 text-rose-500"
                  : "text-muted-foreground"
              }`}
            />
            <span>{visibleFavoriteCount}</span>
          </button>

          {/* 1-Click Perfeito Filter Preset Toggle */}
          <button
            type="button"
            onClick={applyPerfeitoFilterPreset}
            aria-pressed={isPerfeitoPresetActive}
            title={
              isPerfeitoPresetActive
                ? "Desligar Perfeito e voltar aos filtros anteriores"
                : "Troca os filtros por: Ar-condicionado · Andar alto/cobertura · ≤ R$ 4.500 · ≤ 25 min do escritório · Não mobiliado · Sem problemas de segurança (desligar restaura os anteriores)"
            }
            className={`order-3 sm:order-2 inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-2.5 ${
              isPerfeitoPresetActive
                ? "border-amber-500/60 bg-amber-500/15 text-amber-800 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-200"
                : "border-amber-500/40 bg-amber-500/5 text-foreground hover:bg-amber-500/15"
            }`}
          >
            <Sparkles
              className={`h-3.5 w-3.5 shrink-0 ${
                isPerfeitoPresetActive
                  ? "fill-amber-500 text-amber-500"
                  : "text-amber-500"
              }`}
            />
            <span>Perfeito</span>
          </button>


          {/* Sort By Selector */}
          <div className="relative order-4 sm:order-4 inline-flex min-w-0 flex-1 sm:flex-initial items-center gap-1 rounded-lg border bg-background px-1.5 py-1 text-xs sm:gap-1.5 sm:px-2.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground hidden sm:inline">
              Ordenar:
            </span>
            <span className="truncate font-semibold sm:hidden">
              {SORT_BY_OPTIONS.find((o) => o.value === sortBy)?.shortLabel ??
                "Nota ↓"}
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByOption)}
              aria-label="Ordenar imóveis"
              className="absolute inset-0 w-full cursor-pointer opacity-0 sm:static sm:w-auto sm:opacity-100 bg-transparent font-semibold focus:outline-hidden"
            >
              {SORT_BY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleCopyTop50ForAi()}
            disabled={filteredTotal === 0}
            aria-label={
              copiedTop50Count !== null
                ? `Copiado: ${copiedTop50Count} imóveis`
                : "Copiar Top 50 para IA"
            }
            title="Copiar resumo em Markdown do Top 50 filtrado para enviar a outra IA"
            className={`order-5 sm:order-5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              copiedTop50Count !== null
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {copiedTop50Count !== null ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {/* View Mode Toggle: On mobile (< md), compact Lista vs Mapa; on md+, Lista + Mapa (Split) | Só Lista | Só Mapa */}
          <div
            role="group"
            aria-label="Modo de visualização"
            className="order-5 sm:order-5 inline-flex shrink-0 items-center rounded-lg border bg-background p-0.5"
          >
            <button
              type="button"
              onClick={() => setViewMode("split")}
              title="Lista + Mapa lado a lado (Top 30)"
              className={`hidden md:inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                viewMode === "split"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span>Lista + Mapa</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="Exibir somente a lista de cards"
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 md:px-2 md:py-1 text-xs font-semibold transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="md:hidden">Lista</span>
              <span className="hidden md:inline">Só Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              title="Expandir o mapa interativo"
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 md:px-2 md:py-1 text-xs font-semibold transition-colors ${
                viewMode === "map"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span className="md:hidden">Mapa</span>
              <span className="hidden md:inline">Só Mapa</span>
            </button>
          </div>
        </div>

        {/* LEVEL 1B — Instant Quick Strips: Destaques & Comodidades · Valor Total (R$) · Área Útil (m²) · Tempo até o Escritório (min) (hidden by default on mobile until uncollapsed) */}
        <div
          className={`${
            showAdvancedFilters ? "grid" : "hidden lg:grid"
          } grid-cols-1 gap-2.5 lg:grid-cols-2 xl:grid-cols-4`}
        >
          {/* 1. Destaques & Comodidades Quick Filter */}
          <div className="rounded-lg border bg-background/60 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold uppercase tracking-wider text-foreground">
                Destaques & Comodidades
              </span>
              {requiredFeatures.length > 0 || onlySafeStreets ? (
                <button
                  type="button"
                  onClick={() => {
                    setRequiredFeatures([]);
                    setOnlySafeStreets(false);
                    setVisibleCount(30);
                  }}
                  className="font-mono font-semibold text-primary hover:underline"
                >
                  Limpar (
                  {requiredFeatures.length +
                    (onlySafeStreets &&
                    !requiredFeatures.includes("safe_street")
                      ? 1
                      : 0)}
                  )
                </button>
              ) : (
                <span className="font-mono font-semibold text-primary">
                  Qualquer
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {PROPERTY_FEATURE_OPTIONS.map((feat) => {
                const active =
                  requiredFeatures.includes(feat.key) ||
                  (feat.key === "safe_street" && onlySafeStreets);
                return (
                  <button
                    key={feat.key}
                    type="button"
                    onClick={() => {
                      if (feat.key === "safe_street") {
                        const isCurrentlyActive =
                          requiredFeatures.includes("safe_street") ||
                          onlySafeStreets;
                        if (isCurrentlyActive) {
                          setOnlySafeStreets(false);
                          setRequiredFeatures((prev) =>
                            prev.filter((f) => f !== "safe_street"),
                          );
                        } else {
                          setOnlySafeStreets(true);
                        }
                      } else {
                        setRequiredFeatures((prev) =>
                          prev.includes(feat.key)
                            ? prev.filter((f) => f !== feat.key)
                            : [...prev, feat.key],
                        );
                      }
                      setVisibleCount(30);
                    }}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {feat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Pacote Mensal (Valor Total R$) Quick Filter + Slider */}
          <div className="rounded-lg border bg-background/60 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold uppercase tracking-wider text-foreground">
                Valor Total Mensal (R$)
              </span>
              <span className="font-mono font-semibold text-primary">
                {maxTotalMonthly === null && minTotalMonthly === null
                  ? "Qualquer valor"
                  : minTotalMonthly !== null && maxTotalMonthly !== null
                    ? `R$ ${minTotalMonthly.toLocaleString("pt-BR")}–${maxTotalMonthly.toLocaleString("pt-BR")}`
                    : maxTotalMonthly !== null
                      ? `≤ R$ ${maxTotalMonthly.toLocaleString("pt-BR")}`
                      : `≥ R$ ${(minTotalMonthly ?? 0).toLocaleString("pt-BR")}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { label: "Qualquer", max: null },
                { label: "≤ 4.000", max: 4000 },
                { label: "≤ 4.500 (Ideal)", max: 4500 },
                { label: "≤ 5.000 (Teto)", max: 5000 },
                { label: "≤ 5.500", max: 5500 },
                { label: "≤ 6.500", max: 6500 },
              ].map((preset) => {
                const active =
                  maxTotalMonthly === preset.max &&
                  (preset.max !== null || minTotalMonthly === null);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      if (preset.max === null) {
                        setMinTotalMonthly(null);
                        setMaxTotalMonthly(null);
                      } else {
                        setMaxTotalMonthly(preset.max);
                      }
                      setVisibleCount(30);
                    }}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="range"
                min={1500}
                max={8000}
                step={100}
                aria-label="Teto máximo de valor mensal"
                value={maxTotalMonthly ?? 8000}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxTotalMonthly(val >= 8000 ? null : val);
                  setVisibleCount(30);
                }}
                className="h-1.5 flex-1 accent-primary"
              />
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <input
                  type="number"
                  min={1000}
                  max={15000}
                  step={100}
                  placeholder="Mín"
                  aria-label="Valor mensal mínimo"
                  value={minTotalMonthly ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setMinTotalMonthly(raw === "" ? null : Number(raw));
                    setVisibleCount(30);
                  }}
                  className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="number"
                  min={1500}
                  max={15000}
                  step={100}
                  placeholder="Máx"
                  aria-label="Valor mensal máximo"
                  value={maxTotalMonthly ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setMaxTotalMonthly(raw === "" ? null : Number(raw));
                    setVisibleCount(30);
                  }}
                  className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                />
              </div>
            </div>
          </div>

          {/* 3. Andar / Cobertura Quick Filter */}
          <div className="rounded-lg border bg-background/60 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold uppercase tracking-wider text-foreground">
                Andar / Cobertura
              </span>
              <span
                className="font-mono font-semibold text-primary truncate max-w-[180px]"
                title={
                  floorFilters.length === 0
                    ? "Qualquer andar"
                    : floorFilters
                        .map(
                          (ff) =>
                            FLOOR_FILTER_OPTIONS.find((o) => o.value === ff)
                              ?.shortLabel ?? ff,
                        )
                        .join(" + ")
                }
              >
                {floorFilters.length === 0
                  ? "Qualquer andar"
                  : floorFilters.length === 1
                    ? (FLOOR_FILTER_OPTIONS.find(
                        (o) => o.value === floorFilters[0],
                      )?.label ?? "Qualquer andar")
                    : floorFilters
                        .map(
                          (ff) =>
                            FLOOR_FILTER_OPTIONS.find((o) => o.value === ff)
                              ?.shortLabel ?? ff,
                        )
                        .join(" + ")}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {FLOOR_FILTER_OPTIONS.map((opt) => {
                const active =
                  opt.value === "ALL"
                    ? floorFilters.length === 0
                    : floorFilters.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (opt.value === "ALL") {
                        setFloorFilters([]);
                      } else {
                        setFloorFilters((prev) =>
                          prev.includes(opt.value)
                            ? prev.filter((item) => item !== opt.value)
                            : [...prev, opt.value],
                        );
                      }
                      setVisibleCount(30);
                    }}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Tempo até o Escritório (min) Quick Filter + Slider */}
          <div className="rounded-lg border bg-background/60 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold uppercase tracking-wider text-foreground">
                Tempo até o Escritório (min)
              </span>
              <span className="font-mono font-semibold text-primary">
                {maxCommuteMinutes === null
                  ? "Qualquer"
                  : `≤ ${maxCommuteMinutes} min`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { label: "Qualquer", max: null },
                { label: "≤ 10 min", max: 10 },
                { label: "≤ 15 min", max: 15 },
                { label: "≤ 20 min", max: 20 },
                { label: "≤ 25 min", max: 25 },
                { label: "≤ 30 min", max: 30 },
                { label: "≤ 40 min", max: 40 },
              ].map((preset) => {
                const active = maxCommuteMinutes === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setMaxCommuteMinutes(preset.max);
                      setVisibleCount(30);
                    }}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                aria-label="Tempo máximo até o escritório em minutos"
                value={maxCommuteMinutes ?? 60}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxCommuteMinutes(val >= 60 ? null : val);
                  setVisibleCount(30);
                }}
                className="h-1.5 flex-1 accent-primary"
              />
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <span className="text-muted-foreground">≤</span>
                <input
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  placeholder="min"
                  aria-label="Tempo máximo em minutos"
                  value={maxCommuteMinutes ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setMaxCommuteMinutes(raw === "" ? null : Number(raw));
                    setVisibleCount(30);
                  }}
                  className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                />
                <span className="text-muted-foreground">min</span>
              </div>
            </div>
          </div>
        </div>

        {/* LEVEL 2 — Comprehensive Filter Grid ("Basicamente de tudo") */}
        {showAdvancedFilters && (
          <div className="border-t pt-3 space-y-3">
            {/* Row A: Neighborhoods Multi-Select (Sorted by Rank/Score with Counts) */}
            <div className="rounded-lg border bg-background/40 p-2.5 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-foreground">
                    Bairros ({availableNeighborhoodOptions.length} disponíveis)
                  </span>
                  <label className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-[11px] font-semibold cursor-pointer hover:bg-secondary">
                    <input
                      type="checkbox"
                      checked={onlyTop20Neighborhoods}
                      onChange={(e) => {
                        setOnlyTop20Neighborhoods(e.target.checked);
                        setVisibleCount(30);
                      }}
                      className="accent-primary"
                    />
                    <span>Só bairros do ranking (Top Bairros)</span>
                  </label>
                </div>
                {selectedNeighborhoods.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedNeighborhoods([])}
                    className="text-primary hover:underline font-semibold"
                  >
                    Todos os bairros ({selectedNeighborhoods.length}{" "}
                    selecionado(s))
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNeighborhoods([]);
                    setVisibleCount(30);
                  }}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    selectedNeighborhoods.length === 0
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Todos
                </button>
                {availableNeighborhoodOptions.map((nb) => {
                  const qualifiedKey = `${nb.cityCode}:${nb.name}`;
                  const tokenToToggle =
                    selectedCities.length !== 1 ? qualifiedKey : nb.name;
                  const isSelected =
                    selectedNeighborhoods.includes(qualifiedKey) ||
                    (selectedCities.length === 1 &&
                      selectedNeighborhoods.includes(nb.name));
                  return (
                    <button
                      key={`${nb.cityCode}-${nb.name}`}
                      type="button"
                      onClick={() => {
                        setSelectedNeighborhoods((prev) =>
                          isSelected
                            ? prev.filter(
                                (item) =>
                                  item !== qualifiedKey &&
                                  (selectedCities.length !== 1 ||
                                    item !== nb.name),
                              )
                            : [...prev, tokenToToggle],
                        );
                        setVisibleCount(30);
                      }}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:bg-secondary"
                      }`}
                    >
                      {selectedCities.length !== 1 && (
                        <span className="font-mono text-[10px] opacity-75">
                          {nb.cityCode}
                        </span>
                      )}
                      <span>{nb.name}</span>
                      <span
                        className={`font-mono text-[10px] ${
                          isSelected
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        ({nb.count})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row B: Área Útil (m²), Rooms/Bathrooms/Parking, Modernity/Condition, Furniture & Platform */}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {/* Área Útil (m²) */}
              <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider">
                    Área Útil (m²)
                  </span>
                  <span className="font-mono text-primary font-semibold">
                    {minAreaM2 === null && maxAreaM2 === null
                      ? "Qualquer área"
                      : `${minAreaM2 ?? 0}–${maxAreaM2 ?? "∞"} m²`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Qualquer", min: null, max: null },
                    { label: "≥ 45 m²", min: 45, max: null },
                    { label: "50–72 m² (Ideal)", min: 50, max: 72 },
                    { label: "≥ 60 m²", min: 60, max: null },
                    { label: "≥ 75 m²", min: 75, max: null },
                  ].map((preset) => {
                    const active =
                      minAreaM2 === preset.min && maxAreaM2 === preset.max;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setMinAreaM2(preset.min);
                          setMaxAreaM2(preset.max);
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={2}
                    aria-label="Área útil mínima"
                    value={minAreaM2 ?? 20}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMinAreaM2(val <= 20 ? null : val);
                      setVisibleCount(30);
                    }}
                    className="h-1.5 flex-1 accent-primary"
                  />
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <input
                      type="number"
                      min={15}
                      max={300}
                      placeholder="Mín m²"
                      aria-label="Área útil mínima em m²"
                      value={minAreaM2 ?? ""}
                      onChange={(e) => {
                        setMinAreaM2(
                          e.target.value === "" ? null : Number(e.target.value),
                        );
                        setVisibleCount(30);
                      }}
                      className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                    />
                    <span className="text-muted-foreground">–</span>
                    <input
                      type="number"
                      min={20}
                      max={400}
                      placeholder="Máx m²"
                      aria-label="Área útil máxima em m²"
                      value={maxAreaM2 ?? ""}
                      onChange={(e) => {
                        setMaxAreaM2(
                          e.target.value === "" ? null : Number(e.target.value),
                        );
                        setVisibleCount(30);
                      }}
                      className="w-14 rounded border bg-card px-1.5 py-0.5 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Quartos, Banheiros & Vagas */}
              <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                <div className="space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-wider">
                    Quartos
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: "Qualquer", val: null },
                      { label: "1", val: 1 },
                      { label: "2", val: 2 },
                      { label: "3+", val: 3 },
                    ].map((opt) => {
                      const active =
                        opt.val === null
                          ? selectedBedrooms.length === 0
                          : selectedBedrooms.includes(opt.val);
                      return (
                        <button
                          key={`bed-${opt.label}`}
                          type="button"
                          onClick={() => {
                            setMinBedrooms(null);
                            if (opt.val === null) {
                              setSelectedBedrooms([]);
                            } else {
                              const v = opt.val;
                              setSelectedBedrooms((prev) =>
                                prev.includes(v)
                                  ? prev.filter((item) => item !== v)
                                  : [...prev, v].sort((a, b) => a - b),
                              );
                            }
                            setVisibleCount(30);
                          }}
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wider">
                      Banheiros
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: "Qualquer", val: null },
                        { label: "1", val: 1 },
                        { label: "2", val: 2 },
                        { label: "3+", val: 3 },
                      ].map((opt) => {
                        const active =
                          opt.val === null
                            ? selectedBathrooms.length === 0
                            : selectedBathrooms.includes(opt.val);
                        return (
                          <button
                            key={`bath-${opt.label}`}
                            type="button"
                            onClick={() => {
                              setMinBathrooms(null);
                              if (opt.val === null) {
                                setSelectedBathrooms([]);
                              } else {
                                const v = opt.val;
                                setSelectedBathrooms((prev) =>
                                  prev.includes(v)
                                    ? prev.filter((item) => item !== v)
                                    : [...prev, v].sort((a, b) => a - b),
                                );
                              }
                              setVisibleCount(30);
                            }}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wider">
                      Vagas
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: "Qualquer", val: null },
                        { label: "1 vaga", val: 1 },
                        { label: "2+ vagas", val: 2 },
                      ].map((opt) => {
                        const active =
                          opt.val === null
                            ? selectedParking.length === 0
                            : selectedParking.includes(opt.val);
                        return (
                          <button
                            key={`park-${opt.label}`}
                            type="button"
                            onClick={() => {
                              setMinParking(null);
                              if (opt.val === null) {
                                setSelectedParking([]);
                              } else {
                                const v = opt.val;
                                setSelectedParking((prev) =>
                                  prev.includes(v)
                                    ? prev.filter((item) => item !== v)
                                    : [...prev, v].sort((a, b) => a - b),
                                );
                              }
                              setVisibleCount(30);
                            }}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado de Conservação / Modernidade */}
              <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider">
                    Conservação & Modernidade
                  </span>
                  <span className="font-mono text-primary font-semibold">
                    {minModernityScore === null
                      ? "Qualquer"
                      : `≥ ${minModernityScore}/100`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      {
                        tier: "MODERN_OR_RENOVATED",
                        label: "Novo / Reformado",
                      },
                      {
                        tier: "WELL_MAINTAINED",
                        label: "Bem Conservado",
                      },
                      {
                        tier: "STANDARD",
                        label: "Padrão",
                      },
                      {
                        tier: "DATED",
                        label: "Antigo / Datado",
                      },
                    ] as const
                  ).map((item) => {
                    const active = modernityTiers.includes(item.tier);
                    return (
                      <button
                        key={item.tier}
                        type="button"
                        onClick={() => {
                          setModernityTiers((prev) =>
                            prev.includes(item.tier)
                              ? prev.filter((t) => t !== item.tier)
                              : [...prev, item.tier],
                          );
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={2}
                    aria-label="Score mínimo de modernidade"
                    value={minModernityScore ?? 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMinModernityScore(val <= 0 ? null : val);
                      setVisibleCount(30);
                    }}
                    className="h-1.5 flex-1 accent-primary"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Mín {minModernityScore ?? 0}/100
                  </span>
                </div>
              </div>

              {/* Mobília & Plataforma */}
              <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                <div className="space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-wider">
                    Mobília
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFurnitureTiers([]);
                        setFurnishedFilter("ALL");
                        setVisibleCount(30);
                      }}
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                        selectedFurnitureTiers.length === 0
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      Todos
                    </button>
                    {(
                      [
                        { val: "UNFURNISHED", label: "Não mobiliado" },
                        { val: "FULLY_FURNISHED", label: "Mobiliado" },
                      ] as const
                    ).map((opt) => {
                      const active = selectedFurnitureTiers.includes(opt.val);
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => {
                            setSelectedFurnitureTiers((prev) => {
                              const exists = prev.includes(opt.val);
                              const rawNext = exists
                                ? prev.filter((t) => t !== opt.val)
                                : [...prev, opt.val];
                              const next = rawNext.length >= 2 ? [] : rawNext;
                              setFurnishedFilter(
                                deriveLegacyFurnishedFilter(next),
                              );
                              return next;
                            });
                            setVisibleCount(30);
                          }}
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-wider">
                    Plataforma
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        { val: "ALL", label: "Todas" },
                        { val: "quintoandar", label: "QuintoAndar" },
                        { val: "zapimoveis", label: "Zap Imóveis" },
                        { val: "vivareal", label: "Viva Real" },
                        { val: "netimoveis", label: "Netimóveis" },
                        { val: "imovelweb", label: "Imovelweb" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          setProviderFilter(opt.val);
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          providerFilter === opt.val
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Row C: Pontuação (Nota / Score) + Data / Idade do Anúncio + Exclusões / Proteções Extras */}
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
              {/* Pontuação (Nota / Score) */}
              <div className="rounded-lg border bg-background/40 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-foreground">
                    Pontuação (Nota / Score)
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    {minScore === null ? "Qualquer nota" : `≥ ${minScore} pts`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Qualquer", val: null },
                    { label: "≥ 200 pts", val: 200 },
                    { label: "≥ 185 pts", val: 185 },
                    { label: "≥ 170 pts", val: 170 },
                    { label: "≥ 155 pts", val: 155 },
                    { label: "≥ 140 pts", val: 140 },
                  ].map((preset) => {
                    const active = minScore === preset.val;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setMinScore(preset.val);
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={0}
                    max={240}
                    step={1}
                    aria-label="Nota mínima do imóvel"
                    value={minScore ?? 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMinScore(val <= 0 ? null : val);
                      setVisibleCount(30);
                    }}
                    className="h-1.5 flex-1 accent-primary"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground w-14 text-right">
                    {minScore === null ? "0–240" : `${minScore}/240`}
                  </span>
                </div>
              </div>

              {/* Data / Idade do Anúncio */}
              <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-foreground">
                    Data / Idade do Anúncio
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    {minListingAgeDays === null &&
                    maxListingAgeDays === null &&
                    !listingDateFrom.trim() &&
                    !listingDateTo.trim()
                      ? "Qualquer data"
                      : minListingAgeDays !== null || maxListingAgeDays !== null
                        ? `${minListingAgeDays ?? 0}–${maxListingAgeDays ?? "∞"}d`
                        : `${listingDateFrom || "…"} → ${listingDateTo || "…"}`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Todos", min: null, max: null, clearDates: true },
                    { label: "≤ 7 dias", min: null, max: 7, clearDates: false },
                    {
                      label: "≤ 15 dias",
                      min: null,
                      max: 15,
                      clearDates: false,
                    },
                    {
                      label: "≤ 30 dias",
                      min: null,
                      max: 30,
                      clearDates: false,
                    },
                    {
                      label: "≤ 60 dias",
                      min: null,
                      max: 60,
                      clearDates: false,
                    },
                    {
                      label: "≤ 90 dias",
                      min: null,
                      max: 90,
                      clearDates: false,
                    },
                    {
                      label: "> 60 dias (Antigos p/ negociar)",
                      min: 61,
                      max: null,
                      clearDates: false,
                    },
                  ].map((preset) => {
                    const active =
                      minListingAgeDays === preset.min &&
                      maxListingAgeDays === preset.max &&
                      (!preset.clearDates ||
                        (!listingDateFrom.trim() && !listingDateTo.trim()));
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setMinListingAgeDays(preset.min);
                          setMaxListingAgeDays(preset.max);
                          if (preset.clearDates) {
                            setListingDateFrom("");
                            setListingDateTo("");
                          }
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-[10px]">
                  <div className="space-y-0.5">
                    <span className="block font-semibold text-muted-foreground">
                      Range de Idade (dias)
                    </span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        placeholder="Mín (dias)"
                        aria-label="Idade mínima do anúncio em dias"
                        value={minListingAgeDays ?? ""}
                        onChange={(e) => {
                          setMinListingAgeDays(
                            e.target.value === ""
                              ? null
                              : Math.max(0, Number(e.target.value)),
                          );
                          setVisibleCount(30);
                        }}
                        className="w-full rounded border bg-card px-1.5 py-0.5 text-right"
                      />
                      <span className="text-muted-foreground">–</span>
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        placeholder="Máx (dias)"
                        aria-label="Idade máxima do anúncio em dias"
                        value={maxListingAgeDays ?? ""}
                        onChange={(e) => {
                          setMaxListingAgeDays(
                            e.target.value === ""
                              ? null
                              : Math.max(0, Number(e.target.value)),
                          );
                          setVisibleCount(30);
                        }}
                        className="w-full rounded border bg-card px-1.5 py-0.5 text-right"
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="block font-semibold text-muted-foreground">
                      Range de Data (De / Até)
                    </span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="date"
                        aria-label="Data inicial de publicação do anúncio"
                        value={listingDateFrom}
                        onChange={(e) => {
                          setListingDateFrom(e.target.value);
                          setVisibleCount(30);
                        }}
                        className="w-full rounded border bg-card px-1 py-0.5 text-[10px]"
                      />
                      <span className="text-muted-foreground">→</span>
                      <input
                        type="date"
                        aria-label="Data final de publicação do anúncio"
                        value={listingDateTo}
                        onChange={(e) => {
                          setListingDateTo(e.target.value);
                          setVisibleCount(30);
                        }}
                        className="w-full rounded border bg-card px-1 py-0.5 text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Exclusões & Proteções Extras */}
              <div className="rounded-lg border bg-background/40 p-2.5 space-y-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider">
                  Exclusões & Opções Extras
                </span>
                <div className="space-y-1">
                  <span className="block text-[11px] font-semibold text-muted-foreground">
                    Status do Anúncio{" "}
                    {deactivatedTotalCount > 0
                      ? `(${deactivatedTotalCount} desativados)`
                      : ""}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        {
                          val: "ACTIVE_ONLY",
                          label: "Só Ativos (Padrão)",
                        },
                        {
                          val: "ALL",
                          label: "Incluir Desativados / Alugados",
                        },
                        {
                          val: "DEACTIVATED_ONLY",
                          label: "Só Desativados",
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => {
                          setDeactivatedFilter(opt.val);
                          setVisibleCount(30);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          deactivatedFilter === opt.val
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1 text-xs pt-0.5">
                  <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideMegaCondo}
                      onChange={(e) => {
                        setHideMegaCondo(e.target.checked);
                        setVisibleCount(30);
                      }}
                      className="accent-primary"
                    />
                    <span>Ocultar Megacondomínios</span>
                  </label>
                  <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideForSale}
                      onChange={(e) => {
                        setHideForSale(e.target.checked);
                        setVisibleCount(30);
                      }}
                      className="accent-primary"
                    />
                    <span>Ocultar também à venda</span>
                  </label>
                  <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyNewEntries}
                      onChange={(e) => {
                        setOnlyNewEntries(e.target.checked);
                        setVisibleCount(30);
                      }}
                      className="accent-primary"
                    />
                    <span>Só novas entradas</span>
                  </label>
                  <div className="space-y-1">
                    <span className="block text-[11px] font-semibold text-muted-foreground">
                      Retidos pelas barreiras ({ineligibleActiveCount}: área, vaga, elevador, tempo &gt; 50 min…)
                    </span>
                    <div role="radiogroup" aria-label="Retidos" className="inline-flex rounded-lg border bg-background p-0.5">
                      {(
                        [
                          { mode: "hide", label: "Ocultar" },
                          { mode: "include", label: "Incluir" },
                          { mode: "only", label: "Só retidos" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.mode}
                          type="button"
                          role="radio"
                          aria-checked={ineligibleMode === opt.mode}
                          onClick={() => setIneligibleMode(opt.mode)}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            ineligibleMode === opt.mode
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hidden-by-default cities: off unless switched on here */}
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-dashed bg-background/40 px-2.5 py-2 text-xs"
              data-testid="hidden-cities-section"
            >
              <span className="font-bold uppercase tracking-wider text-muted-foreground text-[11px]">
                Cidades ocultas
              </span>
              {HIDDEN_BY_DEFAULT_CITIES.map((city) => (
                <label
                  key={`hidden-city-${city}`}
                  className="inline-flex items-center gap-2 font-medium cursor-pointer"
                >
                  <input
                    type="checkbox"
                    role="switch"
                    data-testid={`toggle-hidden-city-${city}`}
                    checked={enabledHiddenCities.includes(city)}
                    onChange={() => handleToggleHiddenCity(city)}
                    className="accent-primary"
                  />
                  <span>{HIDDEN_CITY_LABELS[city]}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Status & Active Filter Pills Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">
              Exibindo{" "}
              <strong className="text-foreground">{filteredTotal}</strong> de{" "}
              <strong className="text-foreground">{totalBasePoolCount}</strong>{" "}
              imóveis
              {!showIneligible &&
                !onlyIneligible &&
                ineligibleActiveCount > 0 && (
                  <span className="ml-1 text-muted-foreground/80">
                    · {ineligibleActiveCount} filtrados pelas barreiras (
                    <button
                      type="button"
                      onClick={() => setIneligibleMode("only")}
                      className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      ver só retidos
                    </button>
                    )
                  </span>
                )}
            </span>

            {activeFilterPills.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={pill.onClear}
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
              >
                <span>{pill.label}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilterPills.length > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                Limpar tudo
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
