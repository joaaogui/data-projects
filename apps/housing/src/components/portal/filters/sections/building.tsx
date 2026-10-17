"use client";

import { Chip, Field, Section, Toggle } from "@/components/portal/filters/controls";
import { useSectionState, type SectionContext } from "@/components/portal/filters/sections/shared";
import { BUILDING_FEATURES, TIER_OPTIONS } from "@/lib/filter-options";

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
          {TIER_OPTIONS.map((o) => (
            <Chip key={o.id} {...option(o)} count={ctx.counts?.[o.id]}>
              {o.label}
            </Chip>
          ))}
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
