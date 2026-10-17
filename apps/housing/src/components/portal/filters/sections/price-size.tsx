"use client";

import { Chip, Field, PriceRange, Section, Segmented } from "@/components/portal/filters/controls";
import { useSectionState, type SectionContext } from "@/components/portal/filters/sections/shared";
import { useState } from "react";

export const AREA_PRESETS = [
  { id: "45-72", label: "45–72 m²", min: 45, max: 72 },
  { id: "45", label: "≥ 45 m²", min: 45, max: null },
  { id: "60", label: "≥ 60 m²", min: 60, max: null },
  { id: "75", label: "≥ 75 m²", min: 75, max: null },
] as const;

const GROUPS = ["price", "area", "bedrooms", "bathrooms", "parking"] as const;

function toggleNumber(list: number[], v: number): number[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => a - b);
}

export function PriceSizeSection({ ctx }: { ctx: SectionContext }) {
  const { state, set, activeIn } = useSectionState(ctx.store);
  const isPreset = AREA_PRESETS.some((p) => p.min === state.minAreaM2 && p.max === state.maxAreaM2);
  const [customArea, setCustomArea] = useState(
    !isPreset && (state.minAreaM2 !== null || state.maxAreaM2 !== null),
  );
  return (
    <Section title="Preço & tamanho" activeCount={activeIn(GROUPS)}>
      <PriceRange
        min={state.minTotalMonthly}
        max={state.maxTotalMonthly}
        onChange={({ min, max }) => set({ minTotalMonthly: min, maxTotalMonthly: max })}
      />
      <Field label="Área útil">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={state.minAreaM2 === null && state.maxAreaM2 === null && !customArea}
            onClick={() => {
              setCustomArea(false);
              set({ minAreaM2: null, maxAreaM2: null });
            }}
          >
            Qualquer
          </Chip>
          {AREA_PRESETS.map((p) => (
            <Chip
              key={p.id}
              active={!customArea && state.minAreaM2 === p.min && state.maxAreaM2 === p.max}
              count={ctx.counts?.[`area:${p.id}`]}
              onClick={() => {
                setCustomArea(false);
                set({ minAreaM2: p.min, maxAreaM2: p.max });
              }}
            >
              {p.label}
            </Chip>
          ))}
          <Chip active={customArea} onClick={() => setCustomArea((v) => !v)}>
            Personalizar…
          </Chip>
        </div>
        {customArea && (
          <div className="flex items-center gap-2 font-mono text-xs">
            <input
              type="number"
              inputMode="numeric"
              placeholder="Mín m²"
              aria-label="Área mínima (m²)"
              value={state.minAreaM2 ?? ""}
              onChange={(e) => set({ minAreaM2: e.target.value === "" ? null : Number(e.target.value) })}
              className="min-h-11 w-24 rounded-md border bg-background px-2 text-right sm:min-h-8"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Máx m²"
              aria-label="Área máxima (m²)"
              value={state.maxAreaM2 ?? ""}
              onChange={(e) => set({ maxAreaM2: e.target.value === "" ? null : Number(e.target.value) })}
              className="min-h-11 w-24 rounded-md border bg-background px-2 text-right sm:min-h-8"
            />
          </div>
        )}
      </Field>
      <Field label="Quartos · Banheiros · Vagas">
        <div className="flex flex-wrap gap-2">
          <Segmented<number>
            label="Quartos"
            multiple
            values={state.selectedBedrooms}
            onToggle={(v) => set({ selectedBedrooms: toggleNumber(state.selectedBedrooms, v), minBedrooms: null })}
            options={[
              { value: 1, label: "1q" },
              { value: 2, label: "2q" },
              { value: 3, label: "3q+" },
            ]}
          />
          <Segmented<number>
            label="Banheiros"
            multiple
            values={state.selectedBathrooms}
            onToggle={(v) => set({ selectedBathrooms: toggleNumber(state.selectedBathrooms, v), minBathrooms: null })}
            options={[
              { value: 1, label: "1b" },
              { value: 2, label: "2b" },
              { value: 3, label: "3b+" },
            ]}
          />
          <Segmented<number>
            label="Vagas"
            multiple
            values={state.selectedParking}
            onToggle={(v) => set({ selectedParking: toggleNumber(state.selectedParking, v), minParking: null })}
            options={[
              { value: 1, label: "1v" },
              { value: 2, label: "2v+" },
            ]}
          />
        </div>
      </Field>
    </Section>
  );
}
