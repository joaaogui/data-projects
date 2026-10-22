"use client";

import { Chip, Field, Section, Segmented, Toggle } from "@/components/portal/filters/controls";
import { useSectionState, type SectionContext } from "@/components/portal/filters/sections/shared";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

export const COMMUTE_PRESETS = [15, 20, 25, 30, 40] as const;

const GROUPS = ["neighborhoods", "top-neighborhoods", "commute", "safe-streets", "feat-safe_street"] as const;
const COLLAPSED_NEIGHBORHOODS = 8;

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function LocationSection({ ctx }: { ctx: SectionContext }) {
  const { state, set, activeIn } = useSectionState(ctx.store);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const singleCity = state.selectedCities.length === 1;
  const safe = state.onlySafeStreets || state.requiredFeatures.includes("safe_street");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? ctx.neighborhoodOptions.filter((n) => normalize(n.name).includes(q)) : ctx.neighborhoodOptions;
  }, [ctx.neighborhoodOptions, query]);
  const visible = showAll || query ? filtered : filtered.slice(0, COLLAPSED_NEIGHBORHOODS);

  return (
    <Section title="Localização & deslocamento" activeCount={activeIn(GROUPS)}>
      <Field label="Tempo até o escritório">
        <Segmented<number | null>
          label="Tempo até o escritório"
          value={state.maxCommuteMinutes}
          onChange={(v) => set({ maxCommuteMinutes: v })}
          options={[
            { value: null, label: "Qualquer" },
            ...COMMUTE_PRESETS.map((m) => ({
              value: m,
              label: `≤ ${m}`,
              count: ctx.counts?.[`commute:${m}`],
            })),
          ]}
        />
      </Field>
      <Toggle
        label="Só bairros do ranking (Top Bairros)"
        checked={state.onlyTop20Neighborhoods}
        onChange={(v) => set({ onlyTop20Neighborhoods: v })}
      />
      <Toggle
        label="Rua sem problemas de segurança"
        checked={safe}
        onChange={(v) =>
          set({
            onlySafeStreets: v,
            requiredFeatures: state.requiredFeatures.filter((f) => f !== "safe_street"),
          })
        }
      />
      <Field label={`Bairros (${ctx.neighborhoodOptions.length})`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar bairro"
            aria-label="Buscar bairro"
            className="min-h-11 w-full rounded-lg border bg-background pl-8 pr-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-primary sm:min-h-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {visible.map((nb) => {
            const qualified = `${nb.cityCode}:${nb.name}`;
            const selected =
              state.selectedNeighborhoods.includes(qualified) ||
              (singleCity && state.selectedNeighborhoods.includes(nb.name));
            return (
              <Chip
                key={qualified}
                active={selected}
                count={nb.count}
                onClick={() =>
                  set({
                    selectedNeighborhoods: selected
                      ? state.selectedNeighborhoods.filter(
                          (x) => x !== qualified && (!singleCity || x !== nb.name),
                        )
                      : [...state.selectedNeighborhoods, singleCity ? nb.name : qualified],
                  })
                }
              >
                {!singleCity && (
                  <>
                    <span className="font-mono text-[10px] opacity-70">{nb.cityCode}</span>{" "}
                  </>
                )}
                {nb.name}
              </Chip>
            );
          })}
          {!query && filtered.length > COLLAPSED_NEIGHBORHOODS && (
            <Chip active={false} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "ver menos" : `ver todos (${filtered.length})`}
            </Chip>
          )}
        </div>
      </Field>
    </Section>
  );
}
