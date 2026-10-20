import type { NeighborhoodQol, QolCell, QolColumnId, QolMetric, QolMetricId, QolRow } from "@/types/neighborhood-research";

/** Public quality-of-life metrics: display only, none of them enters a score. */

export const QOL_CITY_NAMES: Record<string, string> = {
  BH: "Belo Horizonte",
  NOVA_LIMA: "Nova Lima",
  RJ: "Rio de Janeiro",
  SP: "São Paulo",
  CP: "Campinas",
  GO: "Goiânia",
  BSB: "Brasília (DF)",
};

const DISPLAY_ONLY = "Só exibição: não entra em nenhuma nota.";

const num = (v: number, min: number, max = min) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });

/** "R$ 13,9 mil" (≥ R$ 1 mil) or "R$ 850". */
export function formatReais(v: number): string {
  return v >= 1000 ? `R$ ${num(v / 1000, 1)} mil` : `R$ ${num(v, 0)}`;
}

const LOW_COUNT = /contagem baixa/i;

/** Value text of a metric, as in the panel and the table cells. */
export function formatQolValue(id: QolMetricId, v: number): string {
  switch (id) {
    case "idhm":
      return num(v, 3);
    case "life_expectancy":
      return `${num(v, 1)} anos`;
    case "income_per_capita_2010":
    case "income_household_head_2022":
      return formatReais(v);
    case "crime_robbery":
    case "crime_homicide":
      return `${num(v, 1)}/100 mil`;
    case "park_area_1km_ha":
      return `${num(v, 0, 1)} ha`;
    case "nearest_large_park_m":
      return v >= 1000 ? `${num(v / 1000, 1)} km` : `${num(v, 0)} m`;
    default:
      return `${num(v, 0, 1)}%`;
  }
}

const ratioText = (r: number) => `${num(r, 1)}×`;
const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");
const HINT_PART_MAX = 120;
/** Tooltip-sized text: Atlas UDH codes ("[1355030830010, POP2010 28709]") dropped, then clipped. */
const clip = (s: string | undefined) => {
  const t = s?.replace(/\s*\[[^\]]*\]/g, "");
  return !t || t.length <= HINT_PART_MAX ? t : `${t.slice(0, HINT_PART_MAX - 1).trimEnd()}…`;
};
/** Notes worth a tooltip: the Atlas caveats; the census notes only restate the formula. */
const HINT_NOTE_METRICS = new Set<QolMetricId>(["idhm", "life_expectancy"]);

/** The 13 metrics of the dossier panel, in display order. */
export const QOL_PANEL_METRICS: { id: QolMetricId; label: string }[] = [
  { id: "idhm", label: "IDH-M" },
  { id: "life_expectancy", label: "Expectativa de vida" },
  { id: "income_per_capita_2010", label: "Renda per capita (2010)" },
  { id: "income_household_head_2022", label: "Renda do responsável (2022)" },
  { id: "crime_robbery", label: "Roubos" },
  { id: "crime_homicide", label: "Homicídios" },
  { id: "park_area_1km_ha", label: "Parques a até 1 km" },
  { id: "nearest_large_park_m", label: "Parque ≥ 10 ha mais próximo" },
  { id: "street_trees_faces", label: "Arborização" },
  { id: "sewer_network", label: "Esgoto na rede" },
  { id: "street_lighting", label: "Iluminação pública" },
  { id: "sidewalk", label: "Calçada" },
  { id: "paved_road", label: "Via pavimentada" },
];

/** Table columns: header text, header tooltip (definition · year · source) and the metric each reads. */
export const QOL_COLUMNS: {
  id: QolColumnId;
  metric: QolMetricId;
  label: string;
  short: string;
  title: string;
  /** Lower is better for crime, so it sorts ascending first. */
  defaultDir: "asc" | "desc";
}[] = [
  {
    id: "idhm",
    metric: "idhm",
    label: "IDH-M",
    short: "IDH-M",
    title: `IDH-M (0–1) das UDHs do bairro · 2010 (Censo 2010) · Atlas do Desenvolvimento Humano no Brasil (PNUD/IPEA/FJP). ${DISPLAY_ONLY}`,
    defaultDir: "desc",
  },
  {
    id: "lifeExpectancy",
    metric: "life_expectancy",
    label: "Expect. vida",
    short: "Exp. vida",
    title: `Expectativa de vida ao nascer, em anos · 2010 (Censo 2010) · Atlas do Desenvolvimento Humano no Brasil, UDH. ${DISPLAY_ONLY}`,
    defaultDir: "desc",
  },
  {
    id: "income",
    metric: "income_household_head_2022",
    label: "Renda",
    short: "Renda",
    title: `Rendimento nominal médio mensal do responsável pelo domicílio (só quem tem rendimento; não é renda per capita) · 2022 · IBGE Censo 2022. ${DISPLAY_ONLY}`,
    defaultDir: "desc",
  },
  {
    id: "robbery",
    metric: "crime_robbery",
    label: "Roubo × cidade",
    short: "Roubo×",
    title: `Taxa de roubos por 100 mil moradores da unidade oficial (bairro, DP, CISP ou RA) ÷ a taxa da própria cidade · janelas de 12 meses de 2025–26 · SEJUSP-MG, ISP-RJ, SSP-SP, SSP-DF. Indicadores, unidades e janelas diferem por estado: a razão só compara bairros da mesma cidade. ${DISPLAY_ONLY}`,
    defaultDir: "asc",
  },
  {
    id: "homicide",
    metric: "crime_homicide",
    label: "Homicídio × cidade",
    short: "Homic.×",
    title: `Taxa de homicídios dolosos por 100 mil moradores da unidade oficial ÷ a taxa da própria cidade · janelas de 12 meses de 2025–26 · SEJUSP-MG, ISP-RJ, SSP-SP, SSP-DF. Indicadores, unidades e janelas diferem por estado: a razão só compara bairros da mesma cidade. Contagens pequenas (*) deixam a taxa instável. ${DISPLAY_ONLY}`,
    defaultDir: "asc",
  },
  {
    id: "parks",
    metric: "park_area_1km_ha",
    label: "Parques 1 km",
    short: "Parq. 1km",
    title: `Área de parques (ha) num raio de 1 km do ponto de referência do bairro; o parque ≥ 10 ha mais próximo fica no tooltip da célula (* = visitação restrita) · out/2026 · OpenStreetMap (Overpass). ${DISPLAY_ONLY}`,
    defaultDir: "desc",
  },
  {
    id: "trees",
    metric: "street_trees_faces",
    label: "Arborização",
    short: "Árvores",
    title: `% de quadras (faces) com pelo menos 1 árvore · 2022 · IBGE Censo 2022, entorno dos domicílios. ${DISPLAY_ONLY}`,
    defaultDir: "desc",
  },
  {
    id: "sewer",
    metric: "sewer_network",
    label: "Esgoto",
    short: "Esgoto",
    title: `% dos domicílios com esgoto na rede geral/pluvial ou em fossa ligada à rede · 2022 · IBGE Censo 2022. ${DISPLAY_ONLY}`,
    defaultDir: "desc",
  },
];

const cityPart = (id: QolMetricId, m: QolMetric, cityRef: string) =>
  m.cityValue !== undefined ? `${QOL_CITY_NAMES[cityRef] ?? cityRef}: ${formatQolValue(id, m.cityValue)}` : null;

function crimeCell(id: QolMetricId, m: QolMetric, cityRef: string): QolCell {
  if (m.ratio == null || m.value === null) {
    return { value: null, text: "—", hint: join(m.reason ?? "Sem taxa comparável", clip(m.scope)) };
  }
  const low = LOW_COUNT.test(m.note ?? "");
  return {
    value: m.ratio,
    text: `${ratioText(m.ratio)}${low ? "*" : ""}`,
    hint: join(
      clip(m.scope),
      `${formatQolValue(id, m.value)} vs ${cityPart(id, m, cityRef) ?? "cidade"}`,
      m.year,
      low && `* contagem baixa (${m.count ?? "?"} casos): taxa instável`,
    ),
  };
}

function parksCell(area: QolMetric, nearest: QolMetric | null | undefined): QolCell {
  if (area.value === null) return { value: null, text: "—", hint: area.reason ?? "" };
  const park = nearest?.park;
  const restricted = Boolean(park?.accessNote);
  return {
    value: area.value,
    text: `${formatQolValue("park_area_1km_ha", area.value)}${restricted ? "*" : ""}`,
    hint: join(
      "raio de 1 km do ponto de referência",
      park && nearest?.value != null
        ? `parque ≥ 10 ha mais próximo: ${park.name} (${num(park.ha ?? 0, 0, 1)} ha) a ${formatQolValue("nearest_large_park_m", nearest.value)}`
        : "nenhum parque ≥ 10 ha em 3 km",
      restricted && `* ${park!.accessNote}`,
    ),
  };
}

/** The table cells of a neighbourhood; a column without data is absent (rendered "—", sorted last). */
export function qolRow(qol: NeighborhoodQol): QolRow {
  const row: QolRow = {};
  for (const col of QOL_COLUMNS) {
    const m = qol.metrics[col.metric];
    if (!m) continue;
    if (col.id === "robbery" || col.id === "homicide") {
      row[col.id] = crimeCell(col.metric, m, qol.cityRef);
    } else if (col.id === "parks") {
      row[col.id] = parksCell(m, qol.metrics.nearest_large_park_m);
    } else if (m.value === null) {
      row[col.id] = { value: null, text: "—", hint: m.reason ?? "" };
    } else {
      row[col.id] = {
        value: m.value,
        text: formatQolValue(col.metric, m.value),
        hint: join(clip(m.scope), cityPart(col.metric, m, qol.cityRef), HINT_NOTE_METRICS.has(col.metric) && clip(m.note)),
      };
    }
  }
  return row;
}
