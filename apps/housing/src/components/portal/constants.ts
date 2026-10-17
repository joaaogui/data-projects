import type { CityHubCode, FloorRarity } from "@/types/housing";

export const CITY_LABELS: Record<CityHubCode | "ALL", string> = {
  ALL: "Todas as Praças",
  BH: "Belo Horizonte (MG)",
  CP: "Campinas (SP)",
  RJ: "Rio de Janeiro (RJ)",
  SP: "São Paulo Capital (SP)",
  BSB: "Águas Claras — Brasília (DF) [Benchmark]",
};

export const CITY_BADGE_INFO: Record<
  CityHubCode,
  { ufLabel: string; className: string }
> = {
  BH: {
    ufLabel: "BH",
    className:
      "border-teal-500/30 bg-teal-500/10 text-teal-800 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-200",
  },
  CP: {
    ufLabel: "CP",
    className:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-200",
  },
  RJ: {
    ufLabel: "RJ",
    className:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200",
  },
  SP: {
    ufLabel: "SP",
    className:
      "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-800 dark:border-fuchsia-400/30 dark:bg-fuchsia-400/10 dark:text-fuchsia-200",
  },
  BSB: {
    ufLabel: "BSB · Ref",
    className:
      "border-amber-500/45 bg-amber-500/15 text-amber-800 dark:border-amber-400/45 dark:bg-amber-400/15 dark:text-amber-200",
  },
};

export const MODERNITY_TIER_BADGES: Record<
  string,
  { label: string; shortLabel: string; dotClassName: string; className: string }
> = {
  MODERN_OR_RENOVATED: {
    label: "Estado: Novo / Reformado",
    shortLabel: "Novo / Reformado",
    dotClassName: "text-emerald-600 dark:text-emerald-400",
    className:
      "bg-stone-100/90 text-stone-800 border-stone-300/80 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700",
  },
  WELL_MAINTAINED: {
    label: "Estado: Bem Conservado",
    shortLabel: "Bem Conservado",
    dotClassName: "text-teal-600 dark:text-teal-400",
    className:
      "bg-stone-100/90 text-stone-800 border-stone-300/80 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700",
  },
  STANDARD: {
    label: "Estado: Padrão",
    shortLabel: "Padrão",
    dotClassName: "text-amber-600 dark:text-amber-400",
    className:
      "bg-stone-100/90 text-stone-700 border-stone-300/80 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700",
  },
  DATED: {
    label: "Estado: Antigo / Datado",
    shortLabel: "Antigo / Datado",
    dotClassName: "text-rose-600 dark:text-rose-400",
    className:
      "bg-stone-100/90 text-stone-700 border-stone-300/80 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700",
  },
};

export const PROVIDER_BUTTON_STYLES: Record<
  string,
  { label: string; cardClassName: string }
> = {
  quintoandar: {
    label: "QuintoAndar",
    cardClassName:
      "border-indigo-600/30 bg-indigo-500/10 text-indigo-800 hover:bg-indigo-500/20 dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-200 dark:hover:bg-indigo-500/25",
  },
  zapimoveis: {
    label: "Zap Imóveis",
    cardClassName:
      "border-orange-600/30 bg-orange-500/10 text-orange-900 hover:bg-orange-500/20 dark:border-orange-400/30 dark:bg-orange-500/15 dark:text-orange-200 dark:hover:bg-orange-500/25",
  },
  zap: {
    label: "Zap Imóveis",
    cardClassName:
      "border-orange-600/30 bg-orange-500/10 text-orange-900 hover:bg-orange-500/20 dark:border-orange-400/30 dark:bg-orange-500/15 dark:text-orange-200 dark:hover:bg-orange-500/25",
  },
  vivareal: {
    label: "Viva Real",
    cardClassName:
      "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/20 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25",
  },
  imovelweb: {
    label: "Imovelweb",
    cardClassName:
      "border-amber-600/30 bg-amber-500/10 text-amber-900 hover:bg-amber-500/20 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25",
  },
  netimoveis: {
    label: "Netimóveis",
    cardClassName:
      "border-sky-600/30 bg-sky-500/10 text-sky-900 hover:bg-sky-500/20 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25",
  },
};

export function getProviderStyle(provider: string | undefined) {
  return (
    (provider ? PROVIDER_BUTTON_STYLES[provider] : undefined) ??
    PROVIDER_BUTTON_STYLES.zapimoveis!
  );
}

export const FLOOR_RARITY_BADGES: Record<FloorRarity, { className: string }> = {
  legendary: {
    className:
      "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-300",
  },
  epic: {
    className:
      "border-purple-500/50 bg-purple-500/15 text-purple-700 dark:border-purple-400/50 dark:bg-purple-500/20 dark:text-purple-300",
  },
  rare: {
    className:
      "border-sky-500/50 bg-sky-500/15 text-sky-700 dark:border-sky-400/50 dark:bg-sky-500/20 dark:text-sky-300",
  },
  uncommon: {
    className:
      "border-zinc-400/50 bg-zinc-500/15 text-zinc-700 dark:border-zinc-500/50 dark:bg-zinc-500/20 dark:text-zinc-300",
  },
  common: {
    className:
      "border-rose-600/50 bg-rose-500/18 text-rose-800 dark:border-rose-400/50 dark:bg-rose-500/22 dark:text-rose-200",
  },
};

export const DEFAULT_COMPARE_KEYS = [
  "quintoandar:893127481",
  "zapimoveis:2900134401",
  "quintoandar:895394820",
];

export const MAX_EXTRA_PHOTOS_CACHE_ENTRIES = 25;

export function upsertBoundedRecord<T>(
  prev: Record<string, T>,
  key: string,
  value: T,
  maxEntries = MAX_EXTRA_PHOTOS_CACHE_ENTRIES,
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [k, v] of Object.entries(prev)) {
    if (k !== key) {
      next[k] = v;
    }
  }
  next[key] = value;
  const keys = Object.keys(next);
  if (keys.length > maxEntries) {
    for (let i = 0; i < keys.length - maxEntries; i++) {
      delete next[keys[i]!];
    }
  }
  return next;
}
