"use client";

import { Field, Section, Segmented, Toggle } from "@/components/portal/filters/controls";
import { useSectionState, type SectionContext } from "@/components/portal/filters/sections/shared";
import { HIDDEN_BY_DEFAULT_CITIES, HIDDEN_CITY_LABELS } from "@/lib/city-config";
import { ineligibleModeOf, ineligibleModePatch } from "@/lib/filter-state";

const SCORE_PRESETS = [140, 155, 170, 185, 200] as const;

export function AdvancedSection({ ctx }: { ctx: SectionContext }) {
  const { state, set, activeIn } = useSectionState(ctx.store);
  return (
    <Section
      title="Avançado"
      activeCount={activeIn(["score", "ineligible"])}
      summary="nota · retidos · cidades ocultas"
      defaultOpen={false}
    >
      <Field label="Nota mínima">
        <Segmented<number | null>
          label="Nota mínima"
          value={state.minScore}
          onChange={(v) => set({ minScore: v })}
          options={[
            { value: null, label: "Qualquer" },
            ...SCORE_PRESETS.map((v) => ({ value: v, label: `≥ ${v}`, count: ctx.counts?.[`score:${v}`] })),
          ]}
        />
      </Field>
      <Field
        label={`Retidos pelas barreiras (${ctx.ineligibleActiveCount}: área, vaga, elevador, tempo > 50 min…)`}
      >
        <Segmented
          label="Retidos"
          value={ineligibleModeOf(state)}
          onChange={(mode) => set(ineligibleModePatch(mode))}
          options={[
            { value: "hide", label: "Ocultar" },
            { value: "include", label: "Incluir" },
            { value: "only", label: "Só retidos" },
          ]}
        />
      </Field>
      <Field label="Cidades ocultas">
        <div data-testid="hidden-cities-section" className="flex flex-col">
          {HIDDEN_BY_DEFAULT_CITIES.map((city) => (
            <Toggle
              key={city}
              testId={`toggle-hidden-city-${city}`}
              label={HIDDEN_CITY_LABELS[city]}
              checked={ctx.enabledHiddenCities.includes(city)}
              onChange={() => ctx.onToggleHiddenCity(city)}
            />
          ))}
        </div>
      </Field>
    </Section>
  );
}
