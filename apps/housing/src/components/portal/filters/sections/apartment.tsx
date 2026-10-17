"use client";

import { Chip, Field, Section } from "@/components/portal/filters/controls";
import { useSectionState, type SectionContext } from "@/components/portal/filters/sections/shared";
import { featureOption, floorOption, furnitureOption } from "@/lib/filter-options";

export const FLOOR_OPTIONS = [
  floorOption("HIGH_OR_TOP", "Alto / cobertura"),
  floorOption("LEGENDARY", "Só cobertura / último"),
  floorOption("RARE", "Médio (4º–7º)"),
  floorOption("UNCOMMON", "Baixo (1º–3º)"),
  floorOption("NO_GROUND", "Sem térreo"),
];

export const APARTMENT_FEATURES = [
  featureOption("ac", "Ar-condicionado"),
  featureOption("free_view_sun", "Vista livre"),
  featureOption("balcony", "Varanda"),
  featureOption("suite", "Suíte"),
];

export const FURNITURE_OPTIONS = [
  furnitureOption(["UNFURNISHED"], "unfurnished", "Não mobiliado"),
  furnitureOption(["FULLY_FURNISHED"], "furnished", "Mobiliado"),
];

const GROUPS = ["floor", "furniture", "feat-ac", "feat-free_view_sun", "feat-balcony", "feat-suite"] as const;

export function ApartmentSection({ ctx }: { ctx: SectionContext }) {
  const { state, set, activeIn, option } = useSectionState(ctx.store);
  const anyFurniture = state.selectedFurnitureTiers.length === 0 && state.furnishedFilter === "ALL";
  return (
    <Section title="Apartamento" activeCount={activeIn(GROUPS)}>
      <Field label="Andar">
        <div className="flex flex-wrap gap-1.5">
          {FLOOR_OPTIONS.map((o) => (
            <Chip key={o.id} {...option(o)} count={ctx.counts?.[o.id]}>
              {o.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Precisa ter">
        <div className="flex flex-wrap gap-1.5">
          {APARTMENT_FEATURES.map((o) => (
            <Chip key={o.id} {...option(o)} count={ctx.counts?.[o.id]}>
              {o.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Mobília">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={anyFurniture}
            onClick={() => set({ selectedFurnitureTiers: [], furnishedFilter: "ALL" })}
          >
            Indiferente
          </Chip>
          {FURNITURE_OPTIONS.map((o) => (
            <Chip key={o.id} {...option(o)} count={ctx.counts?.[o.id]}>
              {o.label}
            </Chip>
          ))}
        </div>
      </Field>
    </Section>
  );
}
