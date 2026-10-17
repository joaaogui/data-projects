"use client";

import { Chip, Field, Section, Toggle } from "@/components/portal/filters/controls";
import { useSectionState, type SectionContext } from "@/components/portal/filters/sections/shared";
import { featureOption } from "@/lib/filter-options";
import type { ModernityTier } from "@/types/housing";

export const BUILDING_FEATURES = [
  featureOption("new_building", "Prédio novo (2010+)"),
  featureOption("doorman_24h", "Portaria 24h"),
  featureOption("pool_gym", "Piscina / academia"),
  featureOption("reserved_building", "Torre única"),
  featureOption("pets", "Aceita pet"),
];

const TIERS: { tier: ModernityTier; label: string }[] = [
  { tier: "MODERN_OR_RENOVATED", label: "Novo / reformado" },
  { tier: "WELL_MAINTAINED", label: "Bem conservado" },
  { tier: "STANDARD", label: "Padrão" },
  { tier: "DATED", label: "Antigo" },
];

const GROUPS = [
  "feat-new_building",
  "feat-doorman_24h",
  "feat-pool_gym",
  "feat-reserved_building",
  "feat-pets",
  "feat-free_parking",
  "modernity",
  "min-modernity",
  "no-megacondo",
  "no-forsale",
] as const;

export function BuildingSection({ ctx }: { ctx: SectionContext }) {
  const { state, set, activeIn, option } = useSectionState(ctx.store);
  return (
    <Section title="Prédio & vaga" activeCount={activeIn(GROUPS)}>
      <div className="flex flex-wrap gap-1.5">
        {BUILDING_FEATURES.map((o) => (
          <Chip key={o.id} {...option(o)} count={ctx.counts?.[o.id]}>
            {o.label}
          </Chip>
        ))}
      </div>
      <Field label="Conservação">
        <div className="flex flex-wrap gap-1.5">
          {TIERS.map(({ tier, label }) => {
            const active = state.modernityTiers.includes(tier);
            return (
              <Chip
                key={tier}
                active={active}
                count={ctx.counts?.[`tier:${tier}`]}
                onClick={() =>
                  set({
                    modernityTiers: active
                      ? state.modernityTiers.filter((t) => t !== tier)
                      : [...state.modernityTiers, tier],
                  })
                }
              >
                {label}
              </Chip>
            );
          })}
        </div>
      </Field>
      <Toggle
        label="Ocultar megacondomínios"
        checked={state.hideMegaCondo}
        onChange={(v) => set({ hideMegaCondo: v })}
      />
      <Toggle
        label="Ocultar também à venda"
        hint="(anunciados para venda e aluguel)"
        checked={state.hideForSale}
        onChange={(v) => set({ hideForSale: v })}
      />
    </Section>
  );
}
