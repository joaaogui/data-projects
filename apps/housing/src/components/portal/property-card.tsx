"use client";

import { memo, type Dispatch, type SetStateAction } from "react";

import { toPlainPreview } from "@/lib/chat-text";
import {
  getThumbPhotoUrl,
  handleImgError,
  PropertyCardPhotoShowcase,
} from "@/components/property-photo-showcase";
import { categorizePropertyFeatures } from "@/lib/scoring-engine";
import type { EvaluatedProperty } from "@/types/housing";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitCompare,
  Heart,
  Images,
  MapPin,
  MessageSquarePlus,
  Sparkles,
} from "lucide-react";

import {
  CITY_BADGE_INFO,
  FLOOR_RARITY_BADGES,
  getProviderStyle,
  MODERNITY_TIER_BADGES,
} from "@/components/portal/constants";

import type { PropertyCardDTO } from "@/lib/property-query";
import type { PropertyQuestionItem, SamplePhoto } from "@/types/housing";

export interface PropertyCardProps {
  prop: PropertyCardDTO;
  cardIdx: number;
  isExpanded: boolean;
  isMapHighlighted: boolean;
  isNearViewport: boolean;
  isSelectedOnMap: boolean;
  isPinnedInChat: boolean;
  inCompare: boolean;
  isFav: boolean;
  viewMode: "split" | "list" | "map";
  extraPhotos: SamplePhoto[] | undefined;
  extraDescription: string | undefined;
  qaList: PropertyQuestionItem[];
  setExpandedId: Dispatch<SetStateAction<string | null>>;
  setHoveredPropertyKey: Dispatch<SetStateAction<string | null>>;
  setSelectedMapPropertyKey: Dispatch<SetStateAction<string | null>>;
  setViewMode: Dispatch<SetStateAction<"split" | "list" | "map">>;
  setGalleryState: Dispatch<
    SetStateAction<{ property: EvaluatedProperty; initialIndex: number } | null>
  >;
  toggleCompare: (key: string) => void;
  toggleFavorite: (key: string) => void;
  openChatForProperty: (key: string, scrollToMessages?: boolean) => void;
}

export const PropertyCard = memo(function PropertyCard({
  prop,
  cardIdx,
  isExpanded,
  isMapHighlighted,
  isNearViewport,
  isSelectedOnMap,
  isPinnedInChat,
  inCompare,
  isFav,
  viewMode,
  extraPhotos,
  extraDescription,
  qaList,
  setExpandedId,
  setHoveredPropertyKey,
  setSelectedMapPropertyKey,
  setViewMode,
  setGalleryState,
  toggleCompare,
  toggleFavorite,
  openChatForProperty,
}: PropertyCardProps) {
  const key = `${prop.provider}:${prop.id}`;
  const safeCardDomId = `property-card-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  if (!isNearViewport) {
    return (
      <article
        key={key}
        id={safeCardDomId}
        data-card-index={cardIdx}
        onClick={() => setExpandedId(key)}
        style={{
          minHeight: viewMode === "split" ? "236px" : "248px",
        }}
        className="flex cursor-pointer items-center justify-between rounded-xl border bg-card/60 px-4 py-3 text-xs text-muted-foreground transition-colors hover:border-primary/40"
      >
        <span className="truncate font-semibold text-foreground">
          #{prop.overallRank ?? "—"} · {prop.neighborhood} ({prop.cityCode}) —{" "}
          {prop.street}
          {prop.streetNumber ? `, ${prop.streetNumber}` : ""}
        </span>
        <span className="shrink-0 font-mono font-bold text-primary">
          {prop.finalScore.toFixed(1)} pts · R${" "}
          {prop.totalMonthly.toLocaleString("pt-BR")}/mês
        </span>
      </article>
    );
  }

  const isDeactivated = prop.isActive === false;
  const fullPhotos =
    extraPhotos && extraPhotos!.length > prop.samplePhotos.length
      ? extraPhotos!
      : prop.samplePhotos;
  const totalGalleryCount = Math.max(
    fullPhotos.length,
    prop.photosCount || fullPhotos.length,
  );
  const propWithPhotos: EvaluatedProperty =
    fullPhotos !== prop.samplePhotos
      ? {
          ...prop,
          samplePhotos: fullPhotos,
          photosCount: totalGalleryCount,
          shortJustification: prop.shortJustification,
          narrativeJustification: prop.narrativeJustification,
          detailedJustification: prop.detailedJustification,
        }
      : prop;
  const tierBadge =
    MODERNITY_TIER_BADGES[prop.modernityTier] ??
    MODERNITY_TIER_BADGES.STANDARD!;
  const providerStyle = getProviderStyle(prop.provider);

  return (
    <article
      key={key}
      id={safeCardDomId}
      data-card-index={cardIdx}
      onMouseEnter={() => setHoveredPropertyKey(key)}
      onMouseLeave={() =>
        setHoveredPropertyKey((prev) => (prev === key ? null : prev))
      }
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-card-stop-expand="true"]')) {
          return;
        }
        setExpandedId(isExpanded ? null : key);
      }}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "0 248px",
      }}
      className={`cursor-pointer rounded-xl border bg-card transition-all hover:border-primary/40 ${
        isMapHighlighted
          ? "border-primary ring-2 ring-primary/35 shadow-md"
          : isDeactivated
            ? "opacity-75 border-rose-500/35"
            : !prop.eligible
              ? "opacity-65 border-dashed"
              : "shadow-2xs"
      }`}
    >
      <div className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:flex-row md:items-start">
        {/* Prominent Photo Showcase (Bento Mosaic / Split / Cover + Lightbox Trigger) */}
        <PropertyCardPhotoShowcase
          property={propWithPhotos}
          compact={viewMode === "split"}
          isFavorite={isFav}
          onToggleFavorite={() => toggleFavorite(key)}
          onOpenGallery={(initialIndex) =>
            setGalleryState({
              property: propWithPhotos,
              initialIndex,
            })
          }
        />

        {/* Main Details */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                  CITY_BADGE_INFO[prop.cityCode].className
                }`}
              >
                {CITY_BADGE_INFO[prop.cityCode].ufLabel}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                #{prop.cityRank ?? "—"} em {prop.cityCode}
                {prop.commuteLabel
                  ? ` · ${prop.commuteLabel} do Nu`
                  : prop.commuteMinutes !== undefined &&
                      prop.commuteMinutes !== null
                    ? ` · ${prop.commuteMinutes} min do Nu`
                    : ""}
                {prop.listingAgeLabel ? (
                  <span
                    title={
                      prop.firstPublicationAgeLabel
                        ? `Republicado; primeira publicação ${prop.firstPublicationAgeLabel.toLowerCase()}`
                        : undefined
                    }
                  >
                    {` · 🕒 ${prop.listingAgeLabel}`}
                    {prop.firstPublicationAgeLabel ? " (republicado)" : ""}
                  </span>
                ) : null}
              </span>
              {isDeactivated && (
                <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/50 bg-rose-500/15 px-2 py-0.5 text-[11px] sm:px-2.5 sm:text-xs font-bold text-rose-800 dark:text-rose-200">
                  <span>Desativado / Alugado</span>
                  {prop.deactivatedAt && (
                    <span className="font-mono text-[10px] font-normal opacity-90">
                      (
                      {new Date(prop.deactivatedAt).toLocaleDateString("pt-BR")}
                      )
                    </span>
                  )}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-md border px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-medium ${tierBadge.className}`}
              >
                <span
                  aria-hidden="true"
                  className={`text-[10px] leading-none ${tierBadge.dotClassName}`}
                >
                  ●
                </span>
                <span className="sm:hidden">{tierBadge.shortLabel}</span>
                <span className="hidden sm:inline">{tierBadge.label}</span>
                <span className="font-mono text-[10px] sm:text-[11px] text-muted-foreground">
                  <span className="sm:hidden">({prop.modernityScore})</span>
                  <span className="hidden sm:inline">
                    ({prop.modernityScore}/100)
                  </span>
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(key);
              }}
              aria-label={
                isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              title={isFav ? "Remover dos favoritos" : "Salvar nos favoritos"}
              className={`hidden sm:inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors ${
                isFav
                  ? "border-rose-500/40 bg-rose-500/12 text-rose-600 dark:text-rose-300"
                  : "bg-background text-muted-foreground hover:bg-secondary hover:text-rose-500"
              }`}
            >
              <Heart
                className={`h-3.5 w-3.5 ${
                  isFav ? "fill-rose-500 text-rose-500" : ""
                }`}
              />
              <span>{isFav ? "Favorito" : "Favoritar"}</span>
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3 sm:gap-y-1.5">
            <div className="min-w-0 sm:min-w-[180px] sm:flex-1">
              <h3 className="text-sm sm:text-base font-bold leading-snug">
                {prop.neighborhood} — {prop.street}
                {prop.streetNumber ? `, ${prop.streetNumber}` : ""}
              </h3>
              <p className="text-xs text-muted-foreground">
                {prop.condominiumName ? (
                  <>
                    <span className="sm:hidden">{prop.condominiumName} · </span>
                    <span className="hidden sm:inline">
                      Condomínio {prop.condominiumName} ·{" "}
                    </span>
                  </>
                ) : null}
                {prop.areaM2} m² ·{" "}
                <span className="sm:hidden">
                  {prop.bedrooms}q{prop.suites > 0 ? ` (${prop.suites}s)` : ""}{" "}
                  · {prop.bathrooms}b · {prop.parkingSpaces}v · Mob:{" "}
                  {prop.furnitureTier === "FULLY_FURNISHED"
                    ? "Sim"
                    : prop.furnitureTier === "SEMI_FURNISHED"
                      ? "Semi"
                      : "Não"}
                </span>
                <span className="hidden sm:inline">
                  {prop.bedrooms} quarto(s)
                  {prop.suites > 0 ? ` (${prop.suites} suíte)` : ""} ·{" "}
                  {prop.bathrooms} banheiro(s) · {prop.parkingSpaces} vaga(s) ·
                  Mobiliado:{" "}
                  {prop.furnitureTier === "FULLY_FURNISHED"
                    ? "Sim"
                    : prop.furnitureTier === "SEMI_FURNISHED"
                      ? "Semi (Eletros)"
                      : "Não"}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 sm:block sm:max-w-full sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:text-right">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:justify-end">
                <span className="font-mono text-base sm:text-lg font-bold text-primary">
                  {prop.finalScore.toFixed(1)} pts
                </span>
                <span className="font-mono text-sm sm:text-base font-bold">
                  R$ {prop.totalMonthly.toLocaleString("pt-BR")}/mês
                </span>
              </div>
              <p className="w-full sm:w-auto text-[10.5px] sm:text-[11px] text-muted-foreground font-mono">
                Alug R$ {prop.rent.toLocaleString("pt-BR")} + Cond R${" "}
                {prop.condoFee.toLocaleString("pt-BR")} + IPTU R${" "}
                {prop.iptu.toLocaleString("pt-BR")}
                {prop.listedIptu !== undefined && (
                  <span
                    title={`Estimado em ~R$ 2,50/m²; portal informa R$ ${prop.listedIptu.toLocaleString("pt-BR")}`}
                  >
                    {" "}
                    (est.)
                  </span>
                )}
              </p>
            </div>
          </div>

          {!prop.eligible && prop.exclusionReason && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/12 px-2.5 py-1.5 text-xs font-medium text-rose-800 dark:border-rose-400/35 dark:bg-rose-950/35 dark:text-rose-200">
              <span className="mr-1 font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                Retido pelas barreiras:
              </span>
              <span>{prop.exclusionReason}</span>
            </div>
          )}

          {/* Focused Key Tags: Fortnite Floor Rarity Badge + Green & Red Pills */}
          <div className="flex flex-wrap gap-1.5 pt-0.5 text-xs font-semibold">
            {prop.cardTags.floorTag ? (
              <span
                className={`rounded-md border px-2.5 py-0.5 ${
                  FLOOR_RARITY_BADGES[prop.cardTags.floorTag.rarity].className
                }`}
              >
                {prop.cardTags.floorTag.label}
              </span>
            ) : (
              <span className="rounded-md border border-dashed border-muted-foreground/35 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Andar não informado
              </span>
            )}
            {prop.cardTags.greenTags.map((tag) => (
              <span
                key={`green-${tag}`}
                className="rounded-md border border-emerald-600/30 bg-emerald-500/12 px-2.5 py-0.5 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200"
              >
                {tag}
              </span>
            ))}
            {prop.cardTags.warningTags.map((tag) => (
              <span
                key={`warn-${tag}`}
                className="rounded-md border border-amber-600/30 bg-amber-500/12 px-2.5 py-0.5 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200"
              >
                {tag}
              </span>
            ))}
            {prop.cardTags.redTags.map((tag) => (
              <span
                key={`red-${tag}`}
                className="rounded-md border border-rose-600/30 bg-rose-500/12 px-2.5 py-0.5 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-200"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Complementary Non-Redundant Highlights (Prós & Ressalvas) — collapsed when map is open unless card is expanded */}
          {(viewMode === "list" || isExpanded) &&
            (() => {
              const text = prop.shortJustification.trim();
              let prosText = text;
              let consText = "";

              if (text.includes("\n")) {
                const [firstLine, ...restLines] = text.split("\n");
                prosText = (firstLine ?? "").trim();
                consText = restLines
                  .join(" ")
                  .trim()
                  .replace(/^(?:Por outro lado|Em contrapartida),/i, "")
                  .trimStart();
              } else {
                const legacyIdx = text.search(
                  /(?:Por outro lado|Em contrapartida),/,
                );
                if (legacyIdx > 0) {
                  prosText = text.slice(0, legacyIdx).trim();
                  consText = text
                    .slice(legacyIdx)
                    .trim()
                    .replace(/^(?:Por outro lado|Em contrapartida),/i, "")
                    .trimStart();
                } else {
                  // Find sentence boundary after the em-dash (—) so abbreviations like "próx." never split the sentence
                  const dashPos = text.indexOf("—");
                  const dotAfterDash =
                    dashPos !== -1 ? text.indexOf(". ", dashPos) : -1;
                  if (dotAfterDash !== -1) {
                    prosText = text.slice(0, dotAfterDash + 1).trim();
                    consText = text.slice(dotAfterDash + 2).trim();
                  }
                }
              }

              if (consText) {
                consText = consText.charAt(0).toUpperCase() + consText.slice(1);
              }

              if (!consText) {
                return (
                  <p className="text-xs leading-relaxed text-muted-foreground pt-0.5">
                    {prosText}
                  </p>
                );
              }

              return (
                <div className="space-y-1 pt-0.5 text-xs leading-relaxed">
                  <p className="text-muted-foreground">
                    <span className="mr-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                      Prós:
                    </span>
                    {prosText}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="mr-1.5 font-semibold text-rose-700 dark:text-rose-400">
                      Ressalvas:
                    </span>
                    {consText}
                  </p>
                </div>
              );
            })()}

          {/* Action Row */}
          <div className="flex flex-col gap-1.5 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompare(key);
                }}
                className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 ${
                  inCompare
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-secondary"
                }`}
              >
                <GitCompare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {inCompare ? "Comparando" : "Comparar"}
                </span>
              </button>
              {fullPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGalleryState({
                      property: propWithPhotos,
                      initialIndex: 0,
                    });
                  }}
                  className="hidden sm:inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-secondary"
                >
                  <Images className="h-3.5 w-3.5 text-primary" />
                  Galeria ({totalGalleryCount})
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (viewMode === "list") {
                    setViewMode("split");
                  }
                  setSelectedMapPropertyKey(key);
                }}
                title="Localizar e destacar este imóvel no mapa interativo"
                className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 ${
                  isSelectedOnMap
                    ? "border-primary bg-primary/15 text-primary font-semibold"
                    : "bg-background hover:bg-secondary"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Mapa</span>
              </button>
              {(() => {
                const cardQaList = qaList;
                const hasPending = cardQaList.some(
                  (q) => q.status === "pending",
                );
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openChatForProperty(key, cardQaList.length > 0);
                    }}
                    title="Fixar este imóvel no Chat & Consultor da Sessão"
                    className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors sm:px-2.5 ${
                      isPinnedInChat || cardQaList.length > 0
                        ? "border-purple-500/40 bg-purple-500/12 text-purple-800 dark:border-purple-400/40 dark:bg-purple-500/20 dark:text-purple-200"
                        : "bg-background hover:bg-secondary"
                    }`}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                    <span className="truncate">Perguntar</span>
                    {hasPending && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-purple-500 animate-pulse" />
                    )}
                  </button>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-2">
              <a
                href={prop.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 sm:px-3 sm:py-1 text-xs font-semibold transition-colors ${providerStyle.cardClassName}`}
              >
                <span className="truncate">Abrir no {providerStyle.label}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedId(isExpanded ? null : key);
                }}
                className="inline-flex items-center justify-center gap-1 rounded-md border bg-background px-2.5 py-1.5 sm:py-1 text-xs font-semibold hover:bg-secondary"
              >
                {isExpanded ? (
                  <>
                    <span>Menos</span>
                    <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Detalhes</span>
                    <span className="hidden sm:inline">Detalhes & Fotos</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Compact Chat Thread Badge on Card */}
          {(() => {
            const cardQaList = qaList;
            if (cardQaList.length === 0) return null;
            const lastQa = cardQaList.at(-1);

            return (
              <div
                data-card-stop-expand="true"
                className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-purple-500/30 bg-purple-500/8 px-2.5 py-1.5 text-xs dark:border-purple-400/25 dark:bg-purple-950/25"
              >
                <button
                  type="button"
                  onClick={() => openChatForProperty(key, true)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-purple-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white shadow-2xs hover:bg-purple-700">
                    💬 Ver {cardQaList.length} msg no Chat
                  </span>
                  {lastQa && (
                    <span className="truncate text-[11px] text-muted-foreground">
                      <strong className="text-foreground">
                        {lastQa.question}
                      </strong>
                      {lastQa.answer
                        ? ` — ${toPlainPreview(lastQa.answer, 90)}`
                        : " (Analisando...)"}
                    </span>
                  )}
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Expanded Drawer: Score Breakdown + Detailed Justification + Photo Gallery */}
      {isExpanded && (
        <div
          data-card-stop-expand="true"
          className="cursor-default border-t bg-muted/30 p-4 space-y-4"
        >
          <div className="rounded-lg border bg-card p-3.5 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Análise & Trade-offs da Escolha
            </h4>
            <p className="text-xs leading-relaxed text-foreground">
              {prop.narrativeJustification || "Carregando análise completa…"}
            </p>
            <details className="group rounded-lg border bg-background/60 p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                Ver memória de cálculo e notas quebradas
              </summary>
              <div className="mt-2.5 space-y-2">
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Bairro: +{prop.breakdown.neighborhoodPoints}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Modernidade: +{prop.breakdown.modernityPoints}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Nuances:{" "}
                    {prop.breakdown.nuancesPoints >= 0
                      ? `+${prop.breakdown.nuancesPoints}`
                      : prop.breakdown.nuancesPoints}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Orçamento:{" "}
                    {prop.breakdown.budgetPoints >= 0
                      ? `+${prop.breakdown.budgetPoints}`
                      : prop.breakdown.budgetPoints}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Mobília:{" "}
                    {prop.breakdown.furniturePoints >= 0
                      ? `+${prop.breakdown.furniturePoints}`
                      : prop.breakdown.furniturePoints}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Planta:{" "}
                    {prop.breakdown.areaPoints >= 0
                      ? `+${prop.breakdown.areaPoints}`
                      : prop.breakdown.areaPoints}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Garagem:{" "}
                    {prop.breakdown.parkingPoints >= 0
                      ? `+${prop.breakdown.parkingPoints}`
                      : prop.breakdown.parkingPoints}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Segurança Rua:{" "}
                    {prop.breakdown.safetyPoints >= 0
                      ? `+${prop.breakdown.safetyPoints}`
                      : prop.breakdown.safetyPoints}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Logística:{" "}
                    {prop.breakdown.commutePoints >= 0
                      ? `+${prop.breakdown.commutePoints}`
                      : prop.breakdown.commutePoints}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5">
                    Ajuste Praça:{" "}
                    {prop.breakdown.cityPreferencePoints >= 0
                      ? `+${prop.breakdown.cityPreferencePoints}`
                      : prop.breakdown.cityPreferencePoints}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {prop.detailedJustification ||
                    "Carregando memória de cálculo…"}
                </p>
              </div>
            </details>
          </div>

          {fullPhotos.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Fotos Internas Raspadas ({fullPhotos.length}{" "}
                  {fullPhotos.length === 1 ? "foto" : "fotos"}
                  {totalGalleryCount > fullPhotos.length
                    ? ` · de ${totalGalleryCount} no anúncio`
                    : ""}
                  )
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    setGalleryState({
                      property: propWithPhotos,
                      initialIndex: 0,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-semibold text-primary hover:bg-secondary"
                >
                  <Images className="h-3.5 w-3.5" />
                  Abrir Galeria em Tela Cheia ({totalGalleryCount})
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                {fullPhotos.slice(0, 12).map((ph, idx) => (
                  <button
                    key={`${ph.url}-${idx}`}
                    type="button"
                    onClick={() =>
                      setGalleryState({
                        property: propWithPhotos,
                        initialIndex: idx,
                      })
                    }
                    className="group relative block h-44 w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted text-left"
                  >
                    <img
                      src={getThumbPhotoUrl(ph.url)}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImgError(e, ph.url)}
                      alt={ph.room ?? `Foto ${idx + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <span className="absolute bottom-2 left-2 rounded bg-slate-950/80 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                      {ph.room ?? `Foto ${idx + 1}`}
                    </span>
                  </button>
                ))}
              </div>
              {fullPhotos.length > 12 && (
                <button
                  type="button"
                  onClick={() =>
                    setGalleryState({
                      property: propWithPhotos,
                      initialIndex: 12,
                    })
                  }
                  className="w-full rounded-lg border border-dashed bg-background/70 py-2 text-center text-xs font-semibold text-primary hover:bg-secondary"
                >
                  Ver todas as {totalGalleryCount} fotos na galeria em tela
                  cheia (+{fullPhotos.length - 12} fotos)
                </button>
              )}
            </div>
          )}

          {(() => {
            const resolvedDescription =
              extraDescription ?? prop.description ?? prop.generatedDescription;
            if (!resolvedDescription) return null;
            return (
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {extraDescription || prop.description
                    ? "Descrição Original do Anúncio"
                    : "Descrição do Imóvel"}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {resolvedDescription}
                </p>
              </div>
            );
          })()}

          {/* Rich Nuances Metadata Grid (Deduplicated & Normalized) */}
          {(() => {
            const { interiorFeatures, condoFeatures } =
              categorizePropertyFeatures(prop);
            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                {interiorFeatures.length > 0 && (
                  <div className="rounded-lg border bg-card p-3 space-y-1.5">
                    <h5 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                      Conforto, Luz & Praticidade
                    </h5>
                    <div className="flex flex-wrap gap-1">
                      {interiorFeatures.map((item) => (
                        <span
                          key={item}
                          className="rounded bg-secondary px-2 py-0.5 text-[11px]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {condoFeatures.length > 0 && (
                  <div className="rounded-lg border bg-card p-3 space-y-1.5">
                    <h5 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                      Condomínio & Instalações
                    </h5>
                    <div className="flex flex-wrap gap-1">
                      {condoFeatures.map((item) => (
                        <span
                          key={item}
                          className="rounded bg-secondary px-2 py-0.5 text-[11px]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {prop.placesNearby.length > 0 && (
                  <div className="rounded-lg border bg-card p-3 space-y-1.5">
                    <h5 className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                      Pontos Próximos ({prop.placesNearby.length})
                    </h5>
                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                      {prop.placesNearby.map((pl, idx) => (
                        <span
                          key={`${pl.name}-${idx}`}
                          className={`rounded px-2 py-0.5 text-[11px] ${
                            pl.type === "PARK_OR_GREEN_AREA"
                              ? "bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200 font-medium"
                              : pl.type === "SHOPPING_MALL" ||
                                  pl.type === "ESTACAO_METRO_OU_TREM"
                                ? "bg-primary/15 text-primary font-medium"
                                : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {pl.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </article>
  );
});
