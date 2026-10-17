"use client";

import {
  getCardPhotoUrl,
  handleImgError,
} from "@/components/property-photo-showcase";
import { ExternalLink, Heart, Images, X } from "lucide-react";

import {
  CITY_BADGE_INFO,
  getProviderStyle,
} from "@/components/portal/constants";
import type { PortalController } from "@/components/portal/use-portal-controller";

export function ComparePanel({ ctl }: { ctl: PortalController }) {
  const {
    activeTab,
    comparedProperties,
    favoriteKeys,
    setCompareKeys,
    setGalleryState,
    toggleCompare,
    toggleFavorite,
  } = ctl;
  return (
    <>
      {/* TAB 3: SIDE-BY-SIDE COMPARATOR */}
      {activeTab === "compare" && (
        <section className="space-y-4">
          {comparedProperties.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2.5 text-xs">
              <span className="font-medium text-muted-foreground">
                Comparando{" "}
                <strong className="text-foreground">
                  {comparedProperties.length}
                </strong>{" "}
                de 4 imóveis lado a lado
              </span>
              <button
                type="button"
                onClick={() => setCompareKeys([])}
                className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-500/20 dark:border-rose-400/40 dark:text-rose-200"
              >
                <X className="h-3.5 w-3.5" />
                <span>Limpar comparação</span>
              </button>
            </div>
          )}
          {comparedProperties.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Selecione até 4 imóveis clicando em <strong>Comparar</strong> na
              aba de Imóveis para analisá-los lado a lado.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {comparedProperties.map((p) => {
                const key = `${p.provider}:${p.id}`;
                const isFav = favoriteKeys.includes(key);
                const isDeactivated = p.isActive === false;
                const providerStyle = getProviderStyle(p.provider);
                return (
                  <div
                    key={key}
                    className={`flex flex-col justify-between rounded-xl border bg-card p-4 space-y-3 ${
                      isDeactivated ? "opacity-75 border-rose-500/35" : ""
                    }`}
                  >
                    <div className="space-y-3">
                      {p.samplePhotos[0]?.url && (
                        <button
                          type="button"
                          onClick={() =>
                            setGalleryState({ property: p, initialIndex: 0 })
                          }
                          className="group relative block h-48 w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted text-left"
                        >
                          <img
                            src={getCardPhotoUrl(p.samplePhotos[0].url)}
                            referrerPolicy="no-referrer"
                            onError={(e) =>
                              handleImgError(e, p.samplePhotos[0]!.url)
                            }
                            alt={p.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {p.samplePhotos.length > 1 && (
                            <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-xs group-hover:bg-primary">
                              <Images className="h-3 w-3" />
                              Galeria (
                              {Math.max(
                                p.samplePhotos.length,
                                p.photosCount || p.samplePhotos.length,
                              )}
                              )
                            </span>
                          )}
                        </button>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                              CITY_BADGE_INFO[p.cityCode].className
                            }`}
                          >
                            {CITY_BADGE_INFO[p.cityCode].ufLabel}
                          </span>
                          <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                            {p.finalScore.toFixed(1)} pts (#
                            {p.overallRank ?? "—"} Geral · #{p.cityRank ?? "—"}{" "}
                            {p.cityCode})
                          </span>
                          {isDeactivated && (
                            <span className="rounded-md border border-rose-500/50 bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:text-rose-200">
                              Desativado / Alugado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(key)}
                            aria-label={
                              isFav
                                ? "Remover dos favoritos"
                                : "Adicionar aos favoritos"
                            }
                            title={
                              isFav
                                ? "Remover dos favoritos"
                                : "Salvar nos favoritos"
                            }
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors ${
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
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCompare(key)}
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">
                          {p.neighborhood} ({p.cityCode})
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {p.street}
                          {p.streetNumber ? `, ${p.streetNumber}` : ""}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/60 p-2.5 font-mono text-xs space-y-1">
                        <div className="flex justify-between font-bold text-sm">
                          <span>Total All-in:</span>
                          <span>
                            R$ {p.totalMonthly.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Aluguel:</span>
                          <span>R$ {p.rent.toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Condomínio + IPTU:</span>
                          <span>
                            R$ {(p.condoFee + p.iptu).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Planta / Vagas:</span>
                          <span>
                            {p.areaM2} m² · {p.bedrooms}q · {p.parkingSpaces}v
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Modernidade:</span>
                          <span>{p.modernityScore}/100</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Idade do Anúncio:</span>
                          <span>{p.listingAgeLabel ?? "Não informada"}</span>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground">
                        {p.narrativeJustification ||
                          "Carregando análise completa…"}
                      </p>
                      <details className="group rounded-lg border bg-background/60 p-3 text-xs">
                        <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                          Ver memória de cálculo e notas quebradas
                        </summary>
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                          {p.detailedJustification ||
                            "Carregando memória de cálculo…"}
                        </p>
                      </details>
                    </div>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${providerStyle.cardClassName}`}
                    >
                      Abrir no {providerStyle.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
