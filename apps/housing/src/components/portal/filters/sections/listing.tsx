"use client";

import { Chip, Field, Section, Segmented, Toggle } from "@/components/portal/filters/controls";
import { useSectionState, type SectionContext } from "@/components/portal/filters/sections/shared";
import type { ProviderFilterOption } from "@/lib/property-filters";
import { useState } from "react";

const AGE_PRESETS = [
  { id: "7", label: "≤ 7 dias", min: null, max: 7 },
  { id: "15", label: "≤ 15 dias", min: null, max: 15 },
  { id: "30", label: "≤ 30 dias", min: null, max: 30 },
  { id: "90", label: "≤ 90 dias", min: null, max: 90 },
  { id: "old", label: "> 60 dias (negociar)", min: 61, max: null },
] as const;

const PROVIDERS: { value: ProviderFilterOption; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "quintoandar", label: "QuintoAndar" },
  { value: "zapimoveis", label: "Zap" },
  { value: "vivareal", label: "Viva Real" },
  { value: "netimoveis", label: "Netimóveis" },
  { value: "imovelweb", label: "Imovelweb" },
];

const GROUPS = ["listing-age", "listing-date", "new-entries", "provider", "deactivated"] as const;

export function ListingSection({ ctx }: { ctx: SectionContext }) {
  const { state, set, activeIn } = useSectionState(ctx.store);
  const hasDates = state.listingDateFrom.trim() !== "" || state.listingDateTo.trim() !== "";
  const presetActive = (p: (typeof AGE_PRESETS)[number]) =>
    !hasDates && state.minListingAgeDays === p.min && state.maxListingAgeDays === p.max;
  const isCustomAge =
    !hasDates &&
    (state.minListingAgeDays !== null || state.maxListingAgeDays !== null) &&
    !AGE_PRESETS.some(presetActive);
  const [custom, setCustom] = useState(hasDates || isCustomAge);
  return (
    <Section
      title="Anúncio"
      activeCount={activeIn(GROUPS)}
      summary="publicado · plataforma · status"
      defaultOpen={false}
    >
      <Field label="Publicado">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={!custom && state.minListingAgeDays === null && state.maxListingAgeDays === null && !hasDates}
            onClick={() => {
              setCustom(false);
              set({ minListingAgeDays: null, maxListingAgeDays: null, listingDateFrom: "", listingDateTo: "" });
            }}
          >
            Qualquer
          </Chip>
          {AGE_PRESETS.map((p) => (
            <Chip
              key={p.id}
              active={!custom && presetActive(p)}
              onClick={() => {
                setCustom(false);
                set({ minListingAgeDays: p.min, maxListingAgeDays: p.max, listingDateFrom: "", listingDateTo: "" });
              }}
            >
              {p.label}
            </Chip>
          ))}
          <Chip
            active={custom}
            onClick={() => {
              setCustom(true);
              set({ minListingAgeDays: null, maxListingAgeDays: null });
            }}
          >
            Personalizado
          </Chip>
        </div>
        {custom && (
          <div className="flex items-center gap-2 font-mono text-xs">
            <input
              type="date"
              aria-label="Publicado a partir de"
              value={state.listingDateFrom}
              onChange={(e) => set({ listingDateFrom: e.target.value })}
              className="min-h-11 rounded-md border bg-background px-2 sm:min-h-8"
            />
            <span className="text-muted-foreground">→</span>
            <input
              type="date"
              aria-label="Publicado até"
              value={state.listingDateTo}
              onChange={(e) => set({ listingDateTo: e.target.value })}
              className="min-h-11 rounded-md border bg-background px-2 sm:min-h-8"
            />
          </div>
        )}
      </Field>
      <Toggle
        label="Só novas entradas"
        hint="(últimos 5 dias)"
        checked={state.onlyNewEntries}
        onChange={(v) => set({ onlyNewEntries: v })}
      />
      <Field label="Plataforma">
        <div className="flex flex-wrap gap-1.5">
          {PROVIDERS.map((p) => (
            <Chip key={p.value} active={state.providerFilter === p.value} onClick={() => set({ providerFilter: p.value })}>
              {p.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label={`Status (${ctx.deactivatedTotalCount} desativados / alugados)`}>
        <Segmented
          label="Status do anúncio"
          value={state.deactivatedFilter}
          onChange={(v) => set({ deactivatedFilter: v })}
          options={[
            { value: "ACTIVE_ONLY", label: "Só ativos" },
            { value: "ALL", label: "Incluir desativados" },
            { value: "DEACTIVATED_ONLY", label: "Só desativados" },
          ]}
        />
      </Field>
    </Section>
  );
}
