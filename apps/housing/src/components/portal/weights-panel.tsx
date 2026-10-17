"use client";

import { BUILTIN_PRESETS } from "@/lib/scoring-engine";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

import type { PortalController } from "@/components/portal/use-portal-controller";

export function WeightsPanel({ ctl }: { ctl: PortalController }) {
  const {
    activePresetId,
    applyPreset,
    showSlidersDrawer,
    updateWeight,
    weights,
  } = ctl;
  return (
    <>
      {/* Interactive Weight Calibrator Panel */}
      {showSlidersDrawer && (
        <section className="rounded-xl border bg-card p-5 shadow-xs space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Calibrador de Critérios e Pesos em Tempo Real
              </h2>
              <p className="text-xs text-muted-foreground">
                Altere qualquer peso ou limite abaixo para reordenar os imóveis
                e os 20 bairros instantaneamente e reconstruir as
                justificativas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {BUILTIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  title={preset.description}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    activePresetId === preset.id
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background hover:bg-secondary"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyPreset("balanced-original")}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Property Weights */}
            <div className="space-y-3 rounded-lg border bg-background/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                1. Pesos e Limites dos Imóveis
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-neighborhood-multiplier">
                      Peso da Nota do Bairro
                    </label>
                    <span className="font-mono text-primary">
                      {weights.neighborhoodMultiplier.toFixed(1)}x (até{" "}
                      {(10 * weights.neighborhoodMultiplier).toFixed(0)} pts)
                    </span>
                  </div>
                  <input
                    id="weight-neighborhood-multiplier"
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={weights.neighborhoodMultiplier}
                    onChange={(e) =>
                      updateWeight(
                        "neighborhoodMultiplier",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-modernity-multiplier">
                      Peso Anti-Velharia (Modernidade)
                    </label>
                    <span className="font-mono text-primary">
                      {weights.modernityMultiplier.toFixed(2)}x (até{" "}
                      {(100 * weights.modernityMultiplier).toFixed(0)} pts)
                    </span>
                  </div>
                  <input
                    id="weight-modernity-multiplier"
                    type="range"
                    min={0}
                    max={1.4}
                    step={0.05}
                    value={weights.modernityMultiplier}
                    onChange={(e) =>
                      updateWeight(
                        "modernityMultiplier",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-nuances-multiplier">
                      Peso das Nuances (Sol, Vista, Andar, Parques)
                    </label>
                    <span className="font-mono text-primary">
                      {(weights.nuancesMultiplier ?? 1).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="weight-nuances-multiplier"
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={weights.nuancesMultiplier ?? 1}
                    onChange={(e) =>
                      updateWeight("nuancesMultiplier", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-min-modernity-score">
                      Corte Mínimo Modernidade (0–100)
                    </label>
                    <span className="font-mono text-primary">
                      ≥ {weights.minModernityScore}/100
                    </span>
                  </div>
                  <input
                    id="weight-min-modernity-score"
                    type="range"
                    min={30}
                    max={85}
                    step={2}
                    value={weights.minModernityScore}
                    onChange={(e) =>
                      updateWeight("minModernityScore", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-budget-ideal">
                      Teto Ideal All-in (R$)
                    </label>
                    <span className="font-mono text-primary">
                      R$ {weights.budgetIdeal.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <input
                    id="weight-budget-ideal"
                    type="range"
                    min={3200}
                    max={7000}
                    step={100}
                    value={weights.budgetIdeal}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const nextMax = Math.max(weights.budgetMax, val);
                      const nextHardCap = Math.max(
                        weights.budgetHardCap,
                        nextMax + 350,
                      );
                      updateWeight("budgetIdeal", val);
                      if (nextMax !== weights.budgetMax) {
                        updateWeight("budgetMax", nextMax);
                      }
                      if (nextHardCap !== weights.budgetHardCap) {
                        updateWeight("budgetHardCap", nextHardCap);
                      }
                    }}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-budget-max">
                      Teto Limite Tolerado (R$)
                    </label>
                    <span className="font-mono text-primary">
                      R$ {weights.budgetMax.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <input
                    id="weight-budget-max"
                    type="range"
                    min={3600}
                    max={8000}
                    step={100}
                    value={weights.budgetMax}
                    onChange={(e) => {
                      const rawVal = Number(e.target.value);
                      const val = Math.max(rawVal, weights.budgetIdeal);
                      const nextHardCap = Math.max(
                        weights.budgetHardCap,
                        val + 350,
                      );
                      updateWeight("budgetMax", val);
                      updateWeight("budgetHardCap", nextHardCap);
                    }}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-unfurnished-bonus">
                      Bônus Não-Mobiliado (p/ Mobília BSB)
                    </label>
                    <span className="font-mono text-primary">
                      +{weights.unfurnishedBonus} pts
                    </span>
                  </div>
                  <input
                    id="weight-unfurnished-bonus"
                    type="range"
                    min={0}
                    max={25}
                    step={1}
                    value={weights.unfurnishedBonus}
                    onChange={(e) =>
                      updateWeight("unfurnishedBonus", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-furnished-penalty">
                      Penalidade Imóvel Mobiliado
                    </label>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      {weights.furnishedPenalty} pts
                    </span>
                  </div>
                  <input
                    id="weight-furnished-penalty"
                    type="range"
                    min={-40}
                    max={0}
                    step={1}
                    value={weights.furnishedPenalty}
                    onChange={(e) =>
                      updateWeight("furnishedPenalty", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-min-area-m2">
                      Área Útil Mínima (m²)
                    </label>
                    <span className="font-mono text-primary">
                      {weights.minAreaM2} m² a {weights.maxAreaM2} m²
                    </span>
                  </div>
                  <input
                    id="weight-min-area-m2"
                    type="range"
                    min={35}
                    max={65}
                    step={1}
                    value={weights.minAreaM2}
                    onChange={(e) =>
                      updateWeight("minAreaM2", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 text-xs">
                  <label
                    htmlFor="weight-require-parking"
                    className="font-medium"
                  >
                    Exigir ≥ 1 Vaga de Garagem
                  </label>
                  <input
                    id="weight-require-parking"
                    type="checkbox"
                    checked={weights.requireParking}
                    onChange={(e) =>
                      updateWeight("requireParking", e.target.checked)
                    }
                    className="h-4 w-4 accent-primary"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 text-xs">
                  <label
                    htmlFor="weight-penalize-mega-condo"
                    className="font-medium"
                  >
                    Penalizar Megacondomínio Familiar
                  </label>
                  <input
                    id="weight-penalize-mega-condo"
                    type="checkbox"
                    checked={weights.penalizeMegaCondo ?? true}
                    onChange={(e) =>
                      updateWeight("penalizeMegaCondo", e.target.checked)
                    }
                    className="h-4 w-4 accent-primary"
                  />
                </div>
              </div>
            </div>

            {/* Neighborhood Sub-weights */}
            <div className="space-y-3 rounded-lg border bg-background/50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                2. Sub-Pesos de Avaliação dos 20 Bairros
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-urban-breathing">
                      Respiração Urbana (Vibe Setor Marista)
                    </label>
                    <span className="font-mono text-primary">
                      {weights.urbanBreathingWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="weight-urban-breathing"
                    type="range"
                    min={0}
                    max={3.5}
                    step={0.1}
                    value={weights.urbanBreathingWeight}
                    onChange={(e) =>
                      updateWeight(
                        "urbanBreathingWeight",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-commute-logistics">
                      Logística & Tempo p/ Escritório Nubank
                    </label>
                    <span className="font-mono text-primary">
                      {weights.commuteLogisticsWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="weight-commute-logistics"
                    type="range"
                    min={0}
                    max={3.5}
                    step={0.1}
                    value={weights.commuteLogisticsWeight}
                    onChange={(e) =>
                      updateWeight(
                        "commuteLogisticsWeight",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-building-stock">
                      Oferta de Prédios Bons c/ Vaga
                    </label>
                    <span className="font-mono text-primary">
                      {weights.buildingStockWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="weight-building-stock"
                    type="range"
                    min={0}
                    max={3.5}
                    step={0.1}
                    value={weights.buildingStockWeight}
                    onChange={(e) =>
                      updateWeight(
                        "buildingStockWeight",
                        Number(e.target.value),
                      )
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-budget-fit">
                      Poder de Compra no Orçamento
                    </label>
                    <span className="font-mono text-primary">
                      {weights.budgetFitWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="weight-budget-fit"
                    type="range"
                    min={0}
                    max={3.5}
                    step={0.1}
                    value={weights.budgetFitWeight}
                    onChange={(e) =>
                      updateWeight("budgetFitWeight", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1 text-xs sm:col-span-2">
                  <div className="flex justify-between font-medium">
                    <label htmlFor="weight-safety-car">
                      Segurança Pública & Facilidade de Dirigir
                    </label>
                    <span className="font-mono text-primary">
                      {weights.safetyCarWeight.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="weight-safety-car"
                    type="range"
                    min={0}
                    max={3.5}
                    step={0.1}
                    value={weights.safetyCarWeight}
                    onChange={(e) =>
                      updateWeight("safetyCarWeight", Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
