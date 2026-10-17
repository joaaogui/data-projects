"use client";

import { Chip, Field, Section } from "@/components/portal/filters/controls";
import { useSectionState, type SectionContext } from "@/components/portal/filters/sections/shared";
import { APARTMENT_FEATURES, FLOOR_OPTIONS, FURNITURE_OPTIONS } from "@/lib/filter-options";

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
