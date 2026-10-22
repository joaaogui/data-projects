"use client";

import { Chip } from "@/components/portal/filters/controls";
import { FilterSheet } from "@/components/portal/filters/sheet";
import { SheetViews, ViewsMenu } from "@/components/portal/filters/views";
import type { PortalController } from "@/components/portal/use-portal-controller";
import { PINNED_OPTIONS } from "@/lib/filter-options";
import { SORT_BY_OPTIONS, type SortByOption } from "@/lib/property-filters";
import {
  ArrowUpDown,
  Check,
  Clock,
  Columns2,
  Copy,
  Eye,
  Heart,
  List,
  Map as MapIcon,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  SquareParking,
  Sun,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

const PINNED_ICONS: Record<string, ReactNode> = {
  "price:4500": <Wallet className="h-3.5 w-3.5" />,
  "feat:ac": <Snowflake className="h-3.5 w-3.5" />,
  "floor:HIGH_OR_TOP": <TrendingUp className="h-3.5 w-3.5" />,
  "commute:25": <Clock className="h-3.5 w-3.5" />,
  "feat:free_view_sun": <Sun className="h-3.5 w-3.5" />,
  "feat:balcony": <Eye className="h-3.5 w-3.5" />,
  "feat:doorman_24h": <ShieldCheck className="h-3.5 w-3.5" />,
  "feat:free_parking": <SquareParking className="h-3.5 w-3.5" />,
};

function Divider({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`h-6 w-px shrink-0 bg-border ${className}`} />;
}

function SortSelect({ ctl }: { ctl: PortalController }) {
  const { sortBy, setSortBy } = ctl;
  return (
    <label className="relative inline-flex h-9 min-w-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs font-semibold sm:h-8 sm:shrink-0">
      <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{SORT_BY_OPTIONS.find((o) => o.value === sortBy)?.shortLabel ?? "Nota ↓"}</span>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortByOption)}
        aria-label="Ordenar imóveis"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {SORT_BY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ViewToggle({ ctl }: { ctl: PortalController }) {
  const { viewMode, setViewMode } = ctl;
  const options = [
    { value: "list" as const, label: "Só lista", icon: <List className="h-3.5 w-3.5" />, mobile: true },
    { value: "split" as const, label: "Lista + mapa", icon: <Columns2 className="h-3.5 w-3.5" />, mobile: false },
    { value: "map" as const, label: "Só mapa", icon: <MapIcon className="h-3.5 w-3.5" />, mobile: true },
  ];
  return (
    <div role="group" aria-label="Visualização" className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={viewMode === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => setViewMode(o.value)}
          className={`${o.mobile ? "inline-flex" : "hidden md:inline-flex"} h-8 w-9 items-center justify-center rounded-md transition-colors sm:h-7 sm:w-8 ${
            viewMode === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

function CitySelector({ ctl }: { ctl: PortalController }) {
  const { selectableCityList, selectedCities, handleCitySelect, cityTop3ByCode } = ctl;
  return (
    <div role="group" aria-label="Cidade" className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border bg-background p-0.5">
      {(["ALL", ...selectableCityList] as const).map((city) => {
        const selected = city === "ALL" ? selectedCities.length === 0 : selectedCities.includes(city);
        const info = city === "ALL" ? undefined : cityTop3ByCode.get(city);
        return (
          <button
            key={city}
            type="button"
            aria-pressed={selected}
            title={
              city === "ALL"
                ? "Todas as cidades"
                : `${info?.cityName ?? city}${info ? ` — top 3 bairros ${info.top3Avg.toFixed(2)} (${info.top3Names.join(", ")})` : ""} · clique para combinar cidades`
            }
            onClick={() => handleCitySelect(city)}
            className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors sm:h-7 ${
              selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {city === "ALL" ? "Todas" : city}
            {info && <span className="ml-1 font-mono text-[10px] font-medium opacity-70">{info.top3Avg.toFixed(1)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function FilterBar({ ctl }: { ctl: PortalController }) {
  const {
    activeAdvancedFilterCount,
    activeFilterPills,
    applyFilterPatch,
    applyPerfeitoFilterPreset,
    copiedTop50Count,
    filterState,
    filteredTotal,
    handleCopyTop50ForAi,
    ineligibleActiveCount,
    isPerfeitoPresetActive,
    onlyFavorites,
    onlyIneligible,
    optionCounts,
    resetAllFilters,
    searchQuery,
    setOnlyFavorites,
    setSearchQuery,
    setVisibleCount,
    showIneligible,
    totalBasePoolCount,
    visibleFavoriteCount,
  } = ctl;
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const copyButton = (
    <button
      type="button"
      onClick={() => void handleCopyTop50ForAi()}
      disabled={filteredTotal === 0}
      aria-label={copiedTop50Count !== null ? `Copiado: ${copiedTop50Count} imóveis` : "Copiar Top 50 para IA"}
      title="Copiar resumo em Markdown do Top 50 filtrado para enviar a outra IA"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8 ${
        copiedTop50Count !== null
          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
          : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {copiedTop50Count !== null ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );

  const perfeito = (
    <Chip
      size="bar"
      active={isPerfeitoPresetActive}
      onClick={applyPerfeitoFilterPreset}
      title={
        isPerfeitoPresetActive
          ? "Desligar Perfeito e voltar aos filtros anteriores"
          : "Troca os filtros por: ar-condicionado · andar alto · ≤ R$ 4.500 · ≤ 25 min · não mobiliado · rua segura (desligar restaura os anteriores)"
      }
      icon={<Sparkles className={`h-3.5 w-3.5 ${isPerfeitoPresetActive ? "fill-amber-500 text-amber-500" : "text-amber-500"}`} />}
      className="border-amber-500/50"
    >
      Perfeito
    </Chip>
  );

  const favorites = (
    <button
      type="button"
      aria-pressed={onlyFavorites}
      aria-label={`Favoritos (${visibleFavoriteCount})`}
      title="Só favoritos (inclui alugados/desativados)"
      onClick={() => {
        setOnlyFavorites((v) => !v);
        setVisibleCount(30);
      }}
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors sm:h-8 ${
        onlyFavorites ? "border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-200" : "bg-card hover:bg-secondary"
      }`}
    >
      <Heart className={`h-3.5 w-3.5 ${visibleFavoriteCount > 0 || onlyFavorites ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
      <span>{visibleFavoriteCount}</span>
    </button>
  );

  const hasPills = activeFilterPills.length > 0;

  return (
    <>
      <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-2.5 shadow-2xs sm:p-3" data-testid="filters-bar">
        {/* Row 1: where · what · how to see */}
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <CitySelector ctl={ctl} />
          <div className="relative order-last w-full sm:order-none sm:w-auto sm:min-w-[200px] sm:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(30);
              }}
              placeholder="Rua, bairro, condomínio, ID…"
              aria-label="Buscar imóveis"
              className="h-10 w-full rounded-lg border bg-background pl-8 pr-7 text-xs focus:outline-hidden focus:ring-2 focus:ring-primary sm:h-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpar busca"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <SortSelect ctl={ctl} />
            <ViewToggle ctl={ctl} />
            {copyButton}
          </div>
        </div>

        {/* Row 2: Filtros + pinned requirements (instant) + Perfeito / favoritos / visões */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
            aria-controls="filters-inline-panel"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 sm:h-8"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {activeAdvancedFilterCount > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-foreground px-1 font-mono text-[10px] font-bold text-primary">
                {activeAdvancedFilterCount}
              </span>
            )}
          </button>
          <Divider />
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label="Requisitos rápidos">
            {PINNED_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                size="bar"
                icon={PINNED_ICONS[opt.id]}
                active={opt.isActive(filterState)}
                count={optionCounts?.[opt.id]}
                onClick={() => applyFilterPatch(opt.toggle(filterState))}
              >
                {opt.label}
              </Chip>
            ))}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Divider />
            {perfeito}
            {favorites}
            <ViewsMenu ctl={ctl} />
          </div>
        </div>

        {sheetOpen && (
          <FilterSheet
            ctl={ctl}
            variant="inline"
            id="filters-inline-panel"
            onClose={closeSheet}
            header={(draft) => <SheetViews ctl={ctl} draft={draft} />}
          />
        )}

        {/* Mobile row: presets, sort and view */}
        <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
          {perfeito}
          {favorites}
          <ViewsMenu ctl={ctl} />
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <SortSelect ctl={ctl} />
            <ViewToggle ctl={ctl} />
          </div>
        </div>

        {/* Row 3: status + removable pills (only when something is active) */}
        {hasPills && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-muted-foreground" data-testid="results-status">
                <strong className="text-foreground">{filteredTotal.toLocaleString("pt-BR")}</strong> de{" "}
                {totalBasePoolCount.toLocaleString("pt-BR")}
                {!showIneligible && !onlyIneligible && ineligibleActiveCount > 0 && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => applyFilterPatch({ onlyIneligible: true, showIneligible: true })}
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      {ineligibleActiveCount} retidos
                    </button>
                  </>
                )}
              </span>
              {activeFilterPills.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={pill.onClear}
                  aria-label={`Remover filtro ${pill.label}`}
                  className="inline-flex min-h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-[11px] font-semibold text-primary hover:bg-primary/20"
                >
                  <span>{pill.label}</span>
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Limpar tudo
            </button>
          </div>
        )}
      </div>
    </>
  );
}

