import { normalizeNeighborhoodKey } from "@/lib/scoring-engine";
import type { CityHubCode } from "@/types/moradia";

export interface NubankHubLocation {
  id?: string;
  cityCode: CityHubCode;
  name: string;
  shortLabel: string;
  bannerSubtitle: string;
  address: string;
  lat: number;
  lng: number;
}

export const NUBANK_HUBS: Record<CityHubCode, NubankHubLocation> = {
  BH: {
    id: "bh-boulevard",
    cityCode: "BH",
    name: "Nubank BH — Boulevard Corporate Tower (Santa Efigênia)",
    shortLabel: "Nu BH",
    bannerSubtitle: "BH · Santa Efigênia (Boulevard)",
    address:
      "Av. dos Andradas, 3000 — Santa Efigênia, Belo Horizonte - MG, 30260-070",
    lat: -19.920682,
    lng: -43.920117,
  },
  RJ: {
    id: "rj-vista-maua",
    cityCode: "RJ",
    name: "Nubank RJ — Edifício Vista Mauá (Porto Maravilha / Centro)",
    shortLabel: "Nu RJ",
    bannerSubtitle: "RJ · Vista Mauá (Porto Maravilha)",
    address:
      "Rua São Bento, 18 — Centro / Praça Mauá (Porto Maravilha), Rio de Janeiro - RJ, 20090-010",
    lat: -22.898335,
    lng: -43.179387,
  },
  SP: {
    id: "sp-hq1-capote",
    cityCode: "SP",
    name: "Nubank SP — HQ1 / Capote Valente (Pinheiros)",
    shortLabel: "Nu SP",
    bannerSubtitle: "SP · Pinheiros (Capote Valente)",
    address:
      "Rua Capote Valente, 39 / 120 / 210 — Pinheiros, São Paulo - SP, 05409-000",
    lat: -23.56096,
    lng: -46.673544,
  },
  CP: {
    id: "cp-bresco-viracopos",
    cityCode: "CP",
    name: "Nubank CP — Flex Viracopos (Complexo Bresco Viracopos)",
    shortLabel: "Nu CP",
    bannerSubtitle: "CP · Bresco Viracopos (Flex II)",
    address:
      "Rua Sérgio Fernandes Borges Soares, 1000 — Distrito Industrial (Bresco Viracopos), Campinas - SP, 13054-709",
    lat: -23.006134,
    lng: -47.117777,
  },
  BSB: {
    id: "bsb-parque-aguas-claras",
    cityCode: "BSB",
    name: "Parque Ecológico de Águas Claras — Referência BSB",
    shortLabel: "Ref. BSB",
    bannerSubtitle: "BSB · Parque de Águas Claras (Benchmark)",
    address:
      "Av. Castanheiras / Parque Ecológico de Águas Claras — Águas Claras, Brasília - DF, 71900-100",
    lat: -15.8365,
    lng: -48.0258,
  },
};

export const ADDITIONAL_NUBANK_HUBS: NubankHubLocation[] = [];

export const ALL_NUBANK_HUB_LOCATIONS: NubankHubLocation[] = [
  ...Object.values(NUBANK_HUBS).filter((h) => h.cityCode !== "BSB"),
];

export interface CityBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const CITY_BOUNDING_BOXES: Record<CityHubCode, CityBoundingBox> = {
  BH: { minLat: -20.12, maxLat: -19.75, minLng: -44.12, maxLng: -43.80 },
  RJ: { minLat: -23.12, maxLat: -22.75, minLng: -43.55, maxLng: -42.95 },
  CP: { minLat: -23.10, maxLat: -22.75, minLng: -47.25, maxLng: -46.90 },
  SP: { minLat: -23.78, maxLat: -23.40, minLng: -46.85, maxLng: -46.45 },
  BSB: { minLat: -15.90, maxLat: -15.75, minLng: -48.10, maxLng: -47.95 },
};

export function isCoordinateInsideCityBox(
  cityCode: CityHubCode,
  lat: number,
  lng: number,
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const box = CITY_BOUNDING_BOXES[cityCode];
  return (
    lat >= box.minLat &&
    lat <= box.maxLat &&
    lng >= box.minLng &&
    lng <= box.maxLng
  );
}

export interface PropertyCoordinate {
  lat: number;
  lng: number;
  source: "cache" | "nominatim" | "street" | "neighborhood";
  final?: boolean;
}

const NEIGHBORHOOD_COORDINATES: Record<string, [number, number]> = {
  // === BH (Belo Horizonte & Nova Lima) ===
  "bh:santa efigênia": [-19.9235, -43.9215],
  "bh:funcionários": [-19.9325, -43.9310],
  "bh:savassi": [-19.9362, -43.9355],
  "bh:lourdes": [-19.9318, -43.9442],
  "bh:santo agostinho": [-19.9290, -43.9510],
  "bh:sion": [-19.9485, -43.9315],
  "bh:anchieta": [-19.9460, -43.9265],
  "bh:carmo": [-19.9435, -43.9310],
  "bh:santo antônio": [-19.9420, -43.9410],
  "bh:cruzeiro": [-19.9425, -43.9240],
  "bh:serra": [-19.9380, -43.9185],
  "bh:são pedro": [-19.9415, -43.9365],
  "bh:boa viagem": [-19.9285, -43.9340],
  "bh:centro": [-19.9208, -43.9378],
  "bh:floresta": [-19.9155, -43.9285],
  "bh:barro preto": [-19.9235, -43.9515],
  "bh:prado": [-19.9275, -43.9615],
  "bh:gutierrez": [-19.9385, -43.9585],
  "bh:cidade jardim": [-19.9420, -43.9515],
  "bh:vila paris": [-19.9465, -43.9510],
  "bh:luxemburgo": [-19.9515, -43.9535],
  "bh:santa lúcia": [-19.9570, -43.9435],
  "bh:mangabeiras": [-19.9520, -43.9160],
  "bh:belvedere": [-19.9725, -43.9450],
  "bh:vila da serra": [-19.9810, -43.9400],
  "bh:vale do sereno": [-19.9855, -43.9325],
  "bh:buritis": [-19.9710, -43.9675],
  "bh:carlos prates": [-19.9155, -43.9580],
  "bh:lagoinha": [-19.9085, -43.9430],

  // === RJ (Rio de Janeiro & Niterói) ===
  "rj:flamengo": [-22.9335, -43.1755],
  "rj:botafogo": [-22.9510, -43.1840],
  "rj:botafogo (orla)": [-22.9510, -43.1840],
  "rj:laranjeiras": [-22.9345, -43.1885],
  "rj:catete": [-22.9260, -43.1775],
  "rj:glória": [-22.9200, -43.1765],
  "rj:humaitá": [-22.9565, -43.1990],
  "rj:urca": [-22.9545, -43.1665],
  "rj:copacabana": [-22.9695, -43.1865],
  "rj:leme": [-22.9625, -43.1685],
  "rj:ipanema": [-22.9840, -43.2045],
  "rj:arpoador": [-22.9875, -43.1925],
  "rj:leblon": [-22.9845, -43.2225],
  "rj:jardim botânico": [-22.9660, -43.2215],
  "rj:gávea": [-22.9765, -43.2315],
  "rj:lagoa": [-22.9715, -43.2070],
  "rj:cosme velho": [-22.9410, -43.1995],
  "rj:icaraí": [-22.9055, -43.1095],
  "rj:ingá": [-22.9025, -43.1245],
  "rj:santa rosa": [-22.8995, -43.0990],
  "rj:são domingos": [-22.8985, -43.1280],
  "rj:jd. oceânico": [-23.0085, -43.3125],
  "rj:jardim oceânico": [-23.0085, -43.3125],
  "rj:jardim oceanico": [-23.0085, -43.3125],
  "rj:barra da tijuca": [-23.0085, -43.3125],
  "rj:tijuca": [-22.9295, -43.2345],
  "rj:tijuca (pç uruguai)": [-22.9295, -43.2345],
  "rj:grajaú": [-22.9235, -43.2610],
  "rj:grajau": [-22.9235, -43.2610],
  "rj:maracanã": [-22.9145, -43.2310],
  "rj:vila isabel": [-22.9165, -43.2480],
  "rj:andaraí": [-22.9265, -43.2525],
  "rj:santa teresa": [-22.9215, -43.1875],
  "rj:santo cristo": [-22.8995, -43.2015],
  "rj:saúde": [-22.8975, -43.1845],
  "rj:gamboa": [-22.8975, -43.1935],
  "rj:centro": [-22.9045, -43.1795],
  "rj:lapa": [-22.9135, -43.1815],
  "rj:fátima": [-22.9155, -43.1865],
  "rj:cidade nova": [-22.9095, -43.2025],
  "rj:rio comprido": [-22.9245, -43.2095],
  "rj:catumbi": [-22.9185, -43.1975],
  "rj:são cristóvão": [-22.8995, -43.2215],
  "rj:praça da bandeira": [-22.9115, -43.2145],
  "rj:estácio": [-22.9155, -43.2055],

  // === CP (Campinas) ===
  "cp:cambuí": [-22.8935, -47.0515],
  "cp:nova campinas": [-22.8955, -47.0390],
  "cp:taquaral": [-22.8745, -47.0525],
  "cp:parque taquaral": [-22.8745, -47.0525],
  "cp:jd. guanabara": [-22.8865, -47.0645],
  "cp:jardim guanabara": [-22.8865, -47.0645],
  "cp:guanabara": [-22.8865, -47.0645],
  "cp:bosque": [-22.9065, -47.0495],
  "cp:parque prado": [-22.9365, -47.0455],
  "cp:gramado": [-22.8885, -47.0225],
  "cp:mansões santo antônio": [-22.8525, -47.0465],
  "cp:chácara primavera": [-22.8615, -47.0485],
  "cp:chácara da barra": [-22.8815, -47.0375],
  "cp:jd. chapadão": [-22.8845, -47.0815],
  "cp:jardim chapadão": [-22.8845, -47.0815],
  "cp:castelo": [-22.8895, -47.0765],
  "cp:vila itapura": [-22.8935, -47.0655],
  "cp:jardim proença": [-22.9145, -47.0455],
  "cp:botafogo": [-22.9015, -47.0695],
  "cp:centro": [-22.9055, -47.0605],

  // === SP (São Paulo Capital) ===
  "sp:pinheiros": [-23.5635, -46.6885],
  "sp:vila madalena": [-23.5515, -46.6915],
  "sp:jardim paulista": [-23.5675, -46.6615],
  "sp:jardins": [-23.5675, -46.6615],
  "sp:jardim américa": [-23.5665, -46.6715],
  "sp:jardim america": [-23.5665, -46.6715],
  "sp:cerqueira césar": [-23.5585, -46.6635],
  "sp:itaim bibi": [-23.5845, -46.6785],
  "sp:vila nova conceição": [-23.5915, -46.6695],
  "sp:vila olímpia": [-23.5955, -46.6845],
  "sp:vila olimpia": [-23.5955, -46.6845],
  "sp:moema": [-23.6015, -46.6635],
  "sp:indianópolis": [-23.6015, -46.6635],
  "sp:vila uberabinha": [-23.5985, -46.6685],
  "sp:brooklin": [-23.6125, -46.6865],
  "sp:brooklin paulista": [-23.6125, -46.6865],
  "sp:brooklin novo": [-23.6095, -46.6925],
  "sp:paraíso": [-23.5755, -46.6455],
  "sp:vila mariana": [-23.5865, -46.6365],
  "sp:vila clementino": [-23.5965, -46.6425],
  "sp:chácara klabin": [-23.5935, -46.6255],
  "sp:aclimação": [-23.5725, -46.6285],
  "sp:perdizes": [-23.5365, -46.6745],
  "sp:pompeia": [-23.5325, -46.6845],
  "sp:pompéia": [-23.5325, -46.6845],
  "sp:vila pompéia": [-23.5325, -46.6845],
  "sp:sumaré": [-23.5465, -46.6825],
  "sp:sumarezinho": [-23.5485, -46.6895],
  "sp:alto de pinheiros": [-23.5495, -46.7055],
  "sp:higienópolis": [-23.5445, -46.6565],
  "sp:consolação": [-23.5525, -46.6565],
  "sp:bela vista": [-23.5615, -46.6475],
  "sp:santa cecília": [-23.5385, -46.6495],
  "sp:liberdade": [-23.5615, -46.6345],
  "sp:república": [-23.5445, -46.6425],
  "sp:sé": [-23.5505, -46.6335],
  "sp:centro": [-23.5505, -46.6335],
  "sp:brás": [-23.5455, -46.6165],
  "sp:campos elíseos": [-23.5315, -46.6455],

  // === BSB (Águas Claras, Brasília - DF) ===
  "bsb:águas claras": [-15.8386, -48.0269],
  "bsb:aguas claras": [-15.8386, -48.0269],
  "bsb:norte (águas claras)": [-15.8335, -48.0255],
  "bsb:norte (aguas claras)": [-15.8335, -48.0255],
  "bsb:águas claras norte": [-15.8335, -48.0255],
  "bsb:sul (águas claras)": [-15.8425, -48.0285],
  "bsb:sul (aguas claras)": [-15.8425, -48.0285],
  "bsb:águas claras sul": [-15.8425, -48.0285],
};

/**
 * Curated real-world street coordinates for major residential corridors across BH, RJ, CP, and SP.
 */
const KNOWN_STREET_COORDINATES: Record<string, [number, number]> = {
  // BH
  "bh:avenida dos andradas": [-19.9207, -43.9201],
  "bh:avenida paulo camilo pena": [-19.9710, -43.9423],
  "bh:rua padre marinho": [-19.9268, -43.9219],
  "bh:rua padre rolim": [-19.9248, -43.9246],
  "bh:avenida brasil": [-19.9288, -43.9265],
  "bh:rua ceará": [-19.9278, -43.9272],
  "bh:rua piaui": [-19.9295, -43.9288],
  "bh:rua piauí": [-19.9295, -43.9288],
  "bh:rua bernardo guimarães": [-19.9312, -43.9382],
  "bh:rua gonçalves dias": [-19.9324, -43.9395],
  "bh:rua alvarenga peixoto": [-19.9315, -43.9465],
  "bh:rua tomé de souza": [-19.9368, -43.9362],
  "bh:rua sergipe": [-19.9338, -43.9352],
  "bh:rua paraíba": [-19.9345, -43.9340],
  "bh:rua rio grande do norte": [-19.9342, -43.9318],
  "bh:rua pernambuco": [-19.9352, -43.9328],
  "bh:rua levindo lopes": [-19.9365, -43.9378],
  "bh:rua são paulo": [-19.9310, -43.9418],
  "bh:rua rio de janeiro": [-19.9318, -43.9405],
  "bh:rua espírito santo": [-19.9308, -43.9390],
  "bh:rua da bahia": [-19.9322, -43.9380],
  "bh:rua maranhão": [-19.9315, -43.9265],
  "bh:rua santa rita durão": [-19.9375, -43.9342],
  "bh:rua antônio de albuquerque": [-19.9382, -43.9360],
  "bh:rua cláudio manoel": [-19.9335, -43.9295],
  "bh:rua aimorés": [-19.9285, -43.9355],
  "bh:rua timbiras": [-19.9272, -43.9348],
  "bh:rua guajajaras": [-19.9255, -43.9385],
  "bh:rua dos inconfidentes": [-19.9372, -43.9335],
  "bh:rua pium-í": [-19.9448, -43.9295],
  "bh:rua grão mogol": [-19.9465, -43.9312],
  "bh:rua uruguai": [-19.9495, -43.9325],
  "bh:rua monte alegre": [-19.9405, -43.9215],
  "bh:rua do ouro": [-19.9395, -43.9195],
  "bh:rua santo antônio": [-19.9422, -43.9402],
  "bh:rua conde de linhares": [-19.9428, -43.9510],

  // RJ
  "rj:rua são bento": [-22.8983, -43.1794],
  "rj:rua marquês de abrantes": [-22.9355, -43.1772],
  "rj:rua senador vergueiro": [-22.9342, -43.1758],
  "rj:rua paissandu": [-22.9332, -43.1782],
  "rj:praia do flamengo": [-22.9315, -43.1735],
  "rj:rua voluntários da pátria": [-22.9522, -43.1868],
  "rj:rua são clemente": [-22.9518, -43.1892],
  "rj:rua mena barreto": [-22.9542, -43.1885],
  "rj:rua sorocaba": [-22.9535, -43.1855],
  "rj:rua real grandeza": [-22.9562, -43.1912],
  "rj:rua das laranjeiras": [-22.9348, -43.1888],
  "rj:rua pinheiro machado": [-22.9385, -43.1845],
  "rj:rua do catete": [-22.9258, -43.1768],
  "rj:rua barata ribeiro": [-22.9685, -43.1862],
  "rj:avenida nossa senhora de copacabana": [-22.9702, -43.1858],
  "rj:rua visconde de pirajá": [-22.9842, -43.2048],
  "rj:rua coronel moreira césar": [-22.9052, -43.1088],
  "rj:rua gavião peixoto": [-22.9042, -43.1105],
  "rj:rua presidente backer": [-22.9062, -43.1112],
  "rj:rua lopes trovão": [-22.9035, -43.1072],

  // CP
  "cp:rua sérgio fernandes borges soares": [-23.0061, -47.1178],
  "cp:rua coronel quirino": [-22.8942, -47.0512],
  "cp:rua maria monteiro": [-22.8952, -47.0498],
  "cp:rua sampaio peixoto": [-22.8925, -47.0505],
  "cp:rua barreto leme": [-22.8985, -47.0532],
  "cp:rua conceição": [-22.8975, -47.0548],
  "cp:rua general osório": [-22.8965, -47.0555],
  "cp:rua doutor emílio ribas": [-22.8948, -47.0528],
  "cp:rua dos alecrins": [-22.8932, -47.0538],
  "cp:avenida júlio prestes": [-22.8815, -47.0512],
  "cp:avenida doutor heitor penteado": [-22.8735, -47.0525],

  // SP
  "sp:rua capote valente": [-23.5608, -46.6738],
  "sp:rua oscar freire": [-23.5618, -46.6695],
  "sp:rua dos pinheiros": [-23.5652, -46.6825],
  "sp:rua fradique coutinho": [-23.5612, -46.6882],
  "sp:rua teodoro sampaio": [-23.5625, -46.6815],
  "sp:rua cardeal arcoverde": [-23.5595, -46.6852],
  "sp:rua artur de azevedo": [-23.5632, -46.6788],
  "sp:rua cristiano viana": [-23.5568, -46.6768],
  "sp:rua alves guimarães": [-23.5548, -46.6752],
  "sp:rua pamplona": [-23.5665, -46.6568],
  "sp:alameda santos": [-23.5658, -46.6548],
  "sp:alameda jaú": [-23.5642, -46.6582],
  "sp:alameda itu": [-23.5652, -46.6598],
  "sp:alameda franca": [-23.5668, -46.6612],
  "sp:alameda lorena": [-23.5682, -46.6632],

  // BSB (Águas Claras)
  "bsb:avenida das castanheiras": [-15.8345, -48.0245],
  "bsb:av. das castanheiras": [-15.8345, -48.0245],
  "bsb:avenida das araucárias": [-15.8415, -48.0275],
  "bsb:av. das araucárias": [-15.8415, -48.0275],
  "bsb:avenida parque águas claras": [-15.8365, -48.0260],
  "bsb:avenida boulevard norte": [-15.8350, -48.0235],
  "bsb:avenida boulevard sul": [-15.8405, -48.0265],
  "bsb:avenida flamboyant": [-15.8410, -48.0310],
  "bsb:avenida pau brasil": [-15.8435, -48.0295],
  "bsb:avenida jacarandá": [-15.8445, -48.0340],
  "bsb:avenida sibipiruna": [-15.8375, -48.0335],
  "bsb:avenida jequitibá": [-15.8455, -48.0245],
};

function normalizeTextToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildAddressCacheKey(prop: {
  cityCode: CityHubCode;
  neighborhood: string;
  street: string;
  streetNumber: string | null;
}): string {
  const nb = normalizeTextToken(prop.neighborhood);
  const st = normalizeTextToken(prop.street);
  const num = normalizeTextToken(prop.streetNumber ?? "");
  return `${prop.cityCode}|${nb}|${st}|${num}`;
}

/**
 * Resolves an instant 0ms coordinate for any property using known street coordinates
 * or neighborhood center + deterministic street/number offset (~80–220m).
 */
export function resolveInstantPropertyCoordinate(prop: {
  cityCode: CityHubCode;
  neighborhood: string;
  street: string;
  streetNumber: string | null;
  id?: string;
}): PropertyCoordinate {
  const cityKey = prop.cityCode.toLowerCase();
  const streetLower = normalizeTextToken(prop.street);
  const knownStreet = KNOWN_STREET_COORDINATES[`${cityKey}:${streetLower}`];

  const parsedNum = Number.parseInt(prop.streetNumber ?? "", 10);
  const seedStr = `${prop.cityCode}:${prop.neighborhood}:${prop.street}:${prop.streetNumber ?? ""}:${prop.id ?? ""}`;
  const hash1 = deterministicHash(seedStr);
  const hash2 = deterministicHash(`${seedStr}:lng`);

  if (knownStreet) {
    const numDelta = Number.isFinite(parsedNum)
      ? ((parsedNum % 1600) - 800) * 0.0000032
      : ((hash1 % 1000) / 1000 - 0.5) * 0.0018;
    const crossJitter = ((hash2 % 1000) / 1000 - 0.5) * 0.0006;
    return {
      lat: Number((knownStreet[0] + numDelta).toFixed(6)),
      lng: Number((knownStreet[1] + numDelta * 0.65 + crossJitter).toFixed(6)),
      source: "street",
    };
  }

  const nbLower = normalizeTextToken(prop.neighborhood);
  const normNbLower = normalizeTextToken(
    normalizeNeighborhoodKey(prop.neighborhood, prop.cityCode),
  );

  const baseNb =
    NEIGHBORHOOD_COORDINATES[`${cityKey}:${nbLower}`] ??
    NEIGHBORHOOD_COORDINATES[`${cityKey}:${normNbLower}`] ?? [
      NUBANK_HUBS[prop.cityCode].lat,
      NUBANK_HUBS[prop.cityCode].lng,
    ];

  // Spread properties deterministically across the neighborhood grid (~90m to 260m radius)
  const angle = ((hash1 % 3600) / 3600) * Math.PI * 2;
  const radiusDeg = 0.0008 + ((hash2 % 1000) / 1000) * 0.0017;
  const latOffset = Math.sin(angle) * radiusDeg;
  const lngOffset = Math.cos(angle) * radiusDeg * 1.08;

  return {
    lat: Number((baseNb[0] + latOffset).toFixed(6)),
    lng: Number((baseNb[1] + lngOffset).toFixed(6)),
    source: "neighborhood",
  };
}

/**
 * Computes straight-line Haversine distance in kilometers between two coordinates.
 */
export function computeDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function computeDistanceToNubankHubKm(
  cityCode: CityHubCode,
  lat: number,
  lng: number,
): number {
  const hub = NUBANK_HUBS[cityCode];
  return computeDistanceKm(lat, lng, hub.lat, hub.lng);
}
