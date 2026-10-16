"use client";

import {
  getCardPhotoUrl,
  handleImgError,
} from "@/components/property-photo-showcase";
import {
  ALL_NUBANK_HUB_LOCATIONS,
  computeDistanceToNubankHubKm,
  NUBANK_HUBS,
  type PropertyCoordinate,
  resolveInstantPropertyCoordinate,
} from "@/lib/geocoding";
import type { CityHubCode, EvaluatedProperty, FloorRarity } from "@/types/moradia";
import {
  Building2,
  Compass,
  ExternalLink,
  Globe,
  Heart,
  Images,
  ListFilter,
  Map as MapIcon,
  Navigation,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type MapStyleMode = "hybrid" | "satellite" | "roadmap";

const MAP_STYLE_STORAGE_KEY = "moradia_map_style_v1";

const MAP_STYLE_CONFIG: Record<
  MapStyleMode,
  {
    label: string;
    shortLabel: string;
    url: string;
    fallbackUrl: string;
    attribution: string;
  }
> = {
  hybrid: {
    label: "Satélite + Ruas",
    shortLabel: "Satélite + Ruas",
    url: "https://{s}.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}",
    fallbackUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagens &copy; Google Satellite Hybrid",
  },
  satellite: {
    label: "Satélite Puro",
    shortLabel: "Satélite",
    url: "https://{s}.google.com/vt/lyrs=s&hl=pt-BR&x={x}&y={y}&z={z}",
    fallbackUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagens &copy; Google Satellite",
  },
  roadmap: {
    label: "Mapa Limpo / Ruas",
    shortLabel: "Mapa Limpo",
    url: "https://{s}.google.com/vt/lyrs=m&hl=pt-BR&x={x}&y={y}&z={z}",
    fallbackUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "Dados do mapa &copy; Google Maps",
  },
};

const HUB_BANNER_SUBTITLE: Record<CityHubCode, string> = {
  BH: "BH · Santa Efigênia",
  RJ: "RJ · Porto Maravilha",
  SP: "SP · Pinheiros",
  CP: "CP · Viracopos",
  BSB: "BSB · Parque de Águas Claras",
};

interface LeafletMapInstance {
  setView: (center: [number, number], zoom: number, opts?: unknown) => void;
  flyTo: (
    center: [number, number],
    zoom: number,
    opts?: { duration?: number },
  ) => void;
  fitBounds: (
    bounds: [[number, number], [number, number]],
    opts?: { padding?: [number, number]; maxZoom?: number; animate?: boolean },
  ) => void;
  getZoom: () => number;
  remove: () => void;
  invalidateSize: () => void;
}

interface LeafletLayerGroup {
  clearLayers: () => void;
  addTo: (map: LeafletMapInstance) => LeafletLayerGroup;
}

interface LeafletTileLayer {
  addTo: (map: LeafletMapInstance) => LeafletTileLayer;
  setUrl: (url: string) => void;
  on: (event: string, handler: () => void) => LeafletTileLayer;
}

interface LeafletMarker {
  addTo: (group: LeafletLayerGroup) => LeafletMarker;
  on: (event: string, handler: () => void) => LeafletMarker;
  bindTooltip: (html: string, opts?: Record<string, unknown>) => LeafletMarker;
  openTooltip: () => LeafletMarker;
}

interface LeafletPolyline {
  addTo: (group: LeafletLayerGroup) => LeafletPolyline;
}

interface LeafletCircle {
  addTo: (group: LeafletLayerGroup) => LeafletCircle;
}

interface LeafletNamespace {
  map: (
    el: HTMLElement,
    opts?: Record<string, unknown>,
  ) => LeafletMapInstance;
  tileLayer: (
    url: string,
    opts?: Record<string, unknown>,
  ) => LeafletTileLayer;
  layerGroup: () => LeafletLayerGroup;
  divIcon: (opts: {
    className?: string;
    html: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
  }) => unknown;
  marker: (
    latlng: [number, number],
    opts?: Record<string, unknown>,
  ) => LeafletMarker;
  polyline: (
    latlngs: [number, number][],
    opts?: Record<string, unknown>,
  ) => LeafletPolyline;
  circle: (
    latlng: [number, number],
    opts?: Record<string, unknown>,
  ) => LeafletCircle;
}

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

let leafletLoaderPromise: Promise<LeafletNamespace | null> | null = null;

function loadLeafletFromCdn(): Promise<LeafletNamespace | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoaderPromise) return leafletLoaderPromise;

  leafletLoaderPromise = new Promise((resolve) => {
    if (!document.getElementById("leaflet-cdn-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-cdn-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(
      "leaflet-cdn-js",
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L ?? null));
      existingScript.addEventListener("error", () => resolve(null));
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-cdn-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(window.L ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return leafletLoaderPromise;
}

const FLOOR_RARITY_PILL: Record<FloorRarity, string> = {
  legendary:
    "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-200",
  epic: "border-purple-500/50 bg-purple-500/15 text-purple-800 dark:border-purple-400/50 dark:bg-purple-500/20 dark:text-purple-200",
  rare: "border-sky-500/50 bg-sky-500/15 text-sky-800 dark:border-sky-400/50 dark:bg-sky-500/20 dark:text-sky-200",
  uncommon:
    "border-zinc-400/50 bg-zinc-500/15 text-zinc-700 dark:border-zinc-500/50 dark:bg-zinc-500/20 dark:text-zinc-300",
  common:
    "border-rose-600/50 bg-rose-500/18 text-rose-800 dark:border-rose-400/50 dark:bg-rose-500/22 dark:text-rose-200",
};

const FLOOR_RARITY_BADGE_HEX: Record<FloorRarity, string> = {
  legendary: "#f59e0b", // Gold for Cobertura / Último andar
  epic: "#7c3aed", // Purple for Andar alto
  rare: "#0284c7", // Blue for Andar médio
  uncommon: "#475569", // Slate for Andar baixo
  common: "#e11d48", // Rose for Térreo
};

export function formatPinPriceCompact(value: number): string {
  const k = value / 1000;
  return `${k.toFixed(1).replace(".", ",")}k`;
}

function getProviderName(provider: string): string {
  switch (provider) {
    case "quintoandar":
      return "QuintoAndar";
    case "vivareal":
      return "Viva Real";
    case "netimoveis":
      return "Netimóveis";
    case "imovelweb":
      return "Imovelweb";
    default:
      return "Zap Imóveis";
  }
}

export interface ResolvedDisplayPoint {
  key: string;
  prop: EvaluatedProperty;
  listIndex: number;
  coord: PropertyCoordinate;
  distHubKm: number;
}

/**
 * Resolves display coordinates for all visible properties using a two-stage
 * Golden-Angle Spiral + Pixel-Aware Elliptical De-Collision algorithm so
 * speech-bubble pins never pile on top of each other or cover the Nubank Office HQ crest.
 */
export function resolveDisplayPoints(
  properties: EvaluatedProperty[],
  geocodedMap: Record<string, PropertyCoordinate> = {},
): ResolvedDisplayPoint[] {
  const rawItems: ResolvedDisplayPoint[] = properties.map((prop, idx) => {
    const key = `${prop.provider}:${prop.id}`;
    const baseCoord =
      geocodedMap[key] ??
      resolveInstantPropertyCoordinate({
        cityCode: prop.cityCode,
        neighborhood: prop.neighborhood,
        street: prop.street,
        streetNumber: prop.streetNumber,
        id: prop.id,
      });
    const distHubKm = computeDistanceToNubankHubKm(
      prop.cityCode,
      baseCoord.lat,
      baseCoord.lng,
    );
    return {
      key,
      prop,
      listIndex: idx + 1,
      coord: { ...baseCoord },
      distHubKm,
    };
  });

  // Stage 1: Group properties in the same neighborhood / micro-block and spread via Golden-Angle Fermat Spiral
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.508 deg
  const clusterGroups = new Map<string, ResolvedDisplayPoint[]>();
  for (const item of rawItems) {
    const bucketLat = Math.round(item.coord.lat / 0.0032);
    const bucketLng = Math.round(item.coord.lng / 0.0048);
    const bucketKey = `${item.prop.cityCode}:${bucketLat}:${bucketLng}`;
    const list = clusterGroups.get(bucketKey) ?? [];
    list.push(item);
    clusterGroups.set(bucketKey, list);
  }

  for (const group of clusterGroups.values()) {
    if (group.length <= 1) continue;
    const centerLat =
      group.reduce((acc, it) => acc + it.coord.lat, 0) / group.length;
    const centerLng =
      group.reduce((acc, it) => acc + it.coord.lng, 0) / group.length;

    for (let idx = 0; idx < group.length; idx++) {
      const item = group[idx]!;
      const theta = idx * goldenAngle;
      const radiusLat = 0.0022 * Math.sqrt(idx + 0.75);
      const radiusLng = 0.0038 * Math.sqrt(idx + 0.75);
      item.coord.lat = Number(
        (centerLat + Math.sin(theta) * radiusLat).toFixed(6),
      );
      item.coord.lng = Number(
        (centerLng + Math.cos(theta) * radiusLng).toFixed(6),
      );
    }
  }

  // Stage 2: Elliptical pairwise repulsion + Nubank Hub beacon clearance zone
  // Sized for 74x32px speech-bubble pins at city zoom (zoom 12.5–14.5) so zero pins overlap
  const minLatGap = 0.0044;
  const minLngGap = 0.0094;
  const hubClearanceLat = 0.0054;
  const hubClearanceLng = 0.0112;

  for (let iter = 0; iter < 28; iter++) {
    // Keep pins from covering any Nubank HQ Beacon & Banner
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i]!;
      const cityHubs = ALL_NUBANK_HUB_LOCATIONS.filter(
        (h) => h.cityCode === item.prop.cityCode,
      );
      for (const hub of cityHubs) {
        const dLat = item.coord.lat - hub.lat;
        const dLng = item.coord.lng - hub.lng;
        const normDist = Math.hypot(
          dLat / hubClearanceLat,
          dLng / hubClearanceLng,
        );
        if (normDist < 1) {
          const angle =
            normDist < 0.01
              ? (i + 1) * goldenAngle
              : Math.atan2(dLat / hubClearanceLat, dLng / hubClearanceLng);
          const pushFactor = (1 - normDist) * 0.8;
          item.coord.lat = Number(
            (
              item.coord.lat +
              Math.sin(angle) * hubClearanceLat * pushFactor
            ).toFixed(6),
          );
          item.coord.lng = Number(
            (
              item.coord.lng +
              Math.cos(angle) * hubClearanceLng * pushFactor
            ).toFixed(6),
          );
        }
      }
    }

    // Pairwise pin separation
    for (let i = 0; i < rawItems.length; i++) {
      for (let j = i + 1; j < rawItems.length; j++) {
        const a = rawItems[i]!;
        const b = rawItems[j]!;
        if (a.prop.cityCode !== b.prop.cityCode) continue;
        const dLat = b.coord.lat - a.coord.lat;
        const dLng = b.coord.lng - a.coord.lng;
        const normY = dLat / minLatGap;
        const normX = dLng / minLngGap;
        const ellipticalDist = Math.hypot(normX, normY);

        if (ellipticalDist < 1) {
          const angle =
            ellipticalDist < 0.02
              ? ((i * 5 + j * 11 + iter) * goldenAngle) % (Math.PI * 2)
              : Math.atan2(normY, normX);
          const overlap = (1 - ellipticalDist) * 0.55;
          const pushLat = Math.sin(angle) * minLatGap * overlap;
          const pushLng = Math.cos(angle) * minLngGap * overlap;
          a.coord.lat = Number((a.coord.lat - pushLat).toFixed(6));
          a.coord.lng = Number((a.coord.lng - pushLng).toFixed(6));
          b.coord.lat = Number((b.coord.lat + pushLat).toFixed(6));
          b.coord.lng = Number((b.coord.lng + pushLng).toFixed(6));
        }
      }
    }
  }

  return rawItems;
}

export interface PropertyMapViewProps {
  properties: EvaluatedProperty[];
  totalFilteredCount?: number;
  onLoadMore?: () => void;
  selectedCity: CityHubCode | "ALL";
  favoriteKeys: string[];
  hoveredPropertyKey: string | null;
  selectedPropertyKey: string | null;
  onHoverProperty: (key: string | null) => void;
  onSelectProperty: (key: string | null) => void;
  onFocusCardInList: (key: string) => void;
  onToggleFavorite: (key: string) => void;
  onOpenGallery: (property: EvaluatedProperty, initialIndex: number) => void;
}

export function PropertyMapView({
  properties,
  totalFilteredCount,
  onLoadMore,
  selectedCity,
  favoriteKeys,
  hoveredPropertyKey,
  selectedPropertyKey,
  onHoverProperty,
  onSelectProperty,
  onFocusCardInList,
  onToggleFavorite,
  onOpenGallery,
}: PropertyMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMapInstance | null>(null);
  const tileLayerRef = useRef<LeafletTileLayer | null>(null);
  const markersGroupRef = useRef<LeafletLayerGroup | null>(null);
  const hubsGroupRef = useRef<LeafletLayerGroup | null>(null);
  const lineGroupRef = useRef<LeafletLayerGroup | null>(null);

  const [leafletReady, setLeafletReady] = useState<boolean>(false);
  const [mapStyle, setMapStyle] = useState<MapStyleMode>("hybrid");
  const mapStyleRef = useRef<MapStyleMode>("hybrid");
  const [focusedHubCity, setFocusedHubCity] = useState<CityHubCode | "ALL">(
    selectedCity,
  );
  const [geocodedMap, setGeocodedMap] = useState<
    Record<string, PropertyCoordinate>
  >({});
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const lastFitSignatureRef = useRef<string>("");

  useEffect(() => {
    setFocusedHubCity(selectedCity);
  }, [selectedCity]);

  // Load persisted map style preference from localStorage (defaults to "hybrid" = Satélite + Ruas)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY);
      if (saved === "hybrid" || saved === "satellite" || saved === "roadmap") {
        setMapStyle(saved);
        mapStyleRef.current = saved;
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const handleSelectMapStyle = useCallback((nextStyle: MapStyleMode) => {
    setMapStyle(nextStyle);
    mapStyleRef.current = nextStyle;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, nextStyle);
      } catch {
        // Ignore storage write errors
      }
    }
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(MAP_STYLE_CONFIG[nextStyle].url);
    }
  }, []);

  // Compute coordinates for all visible properties with Golden-Angle Spiral + Elliptical De-Collision
  const resolvedItems = useMemo(
    () => resolveDisplayPoints(properties, geocodedMap),
    [properties, geocodedMap],
  );

  // Background geocode refinement for visible properties
  useEffect(() => {
    const missing = properties
      .filter((p) => {
        const k = `${p.provider}:${p.id}`;
        return !geocodedMap[k];
      })
      .slice(0, 32)
      .map((p) => ({
        key: `${p.provider}:${p.id}`,
        cityCode: p.cityCode,
        city: p.city,
        neighborhood: p.neighborhood,
        street: p.street,
        streetNumber: p.streetNumber,
      }));

    if (missing.length === 0) return;

    let cancelled = false;
    setIsGeocoding(true);

    void fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: missing }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            coordinates?: Record<string, PropertyCoordinate>;
          } | null,
        ) => {
          if (cancelled || !data?.coordinates) return;
          setGeocodedMap((prev) => ({
            ...prev,
            ...data.coordinates,
          }));
        },
      )
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsGeocoding(false);
      });

    return () => {
      cancelled = true;
    };
  }, [properties, geocodedMap]);

  // Initialize Leaflet Map
  useEffect(() => {
    let mounted = true;
    void loadLeafletFromCdn().then((L) => {
      if (!mounted || !L || !mapContainerRef.current) return;
      if (mapInstanceRef.current) {
        setLeafletReady(true);
        return;
      }

      const defaultCenter: [number, number] =
        selectedCity !== "ALL"
          ? [NUBANK_HUBS[selectedCity].lat, NUBANK_HUBS[selectedCity].lng]
          : [-19.9325, -43.9355];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13.5,
        maxZoom: 20,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      const initialStyle = mapStyleRef.current;
      const tileLayer = L.tileLayer(MAP_STYLE_CONFIG[initialStyle].url, {
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        attribution: MAP_STYLE_CONFIG[initialStyle].attribution,
        maxZoom: 20,
        maxNativeZoom: 20,
      }).addTo(map);

      let consecutiveTileErrors = 0;
      tileLayer.on("tileload", () => {
        consecutiveTileErrors = 0;
      });
      tileLayer.on("tileerror", () => {
        consecutiveTileErrors += 1;
        if (consecutiveTileErrors >= 6) {
          consecutiveTileErrors = 0;
          tileLayer.setUrl(MAP_STYLE_CONFIG[mapStyleRef.current].fallbackUrl);
        }
      });

      const lineGroup = L.layerGroup().addTo(map);
      const hubsGroup = L.layerGroup().addTo(map);
      const markersGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      tileLayerRef.current = tileLayer;
      lineGroupRef.current = lineGroup;
      hubsGroupRef.current = hubsGroup;
      markersGroupRef.current = markersGroup;

      setLeafletReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update tile layer URL when map style changes
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(MAP_STYLE_CONFIG[mapStyle].url);
    }
  }, [mapStyle]);

  // Fit bounds or fly directly to a Nubank city hub
  const fitMapToCurrentItems = useCallback(
    (targetCity?: CityHubCode | "ALL", flyToHubDirectly?: boolean) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      if (targetCity && targetCity !== "ALL" && flyToHubDirectly) {
        setFocusedHubCity(targetCity);
        const hub = NUBANK_HUBS[targetCity];
        const cityHubs = ALL_NUBANK_HUB_LOCATIONS.filter(
          (h) => h.cityCode === targetCity,
        );
        const cityItems = resolvedItems.filter(
          (item) => item.prop.cityCode === targetCity,
        );
        if (cityItems.length > 0) {
          const lats = [
            ...cityItems.map((i) => i.coord.lat),
            ...cityHubs.map((h) => h.lat),
          ];
          const lngs = [
            ...cityItems.map((i) => i.coord.lng),
            ...cityHubs.map((h) => h.lng),
          ];
          map.fitBounds(
            [
              [Math.min(...lats), Math.min(...lngs)],
              [Math.max(...lats), Math.max(...lngs)],
            ],
            { padding: [48, 48], maxZoom: 14.5, animate: false },
          );
        } else {
          map.setView([hub.lat, hub.lng], 15.5);
        }
        return;
      }

      if (targetCity === "ALL") {
        setFocusedHubCity("ALL");
      }

      const itemsInScope =
        targetCity && targetCity !== "ALL"
          ? resolvedItems.filter((item) => item.prop.cityCode === targetCity)
          : selectedCity !== "ALL"
            ? resolvedItems.filter(
                (item) => item.prop.cityCode === selectedCity,
              )
            : resolvedItems;

      if (itemsInScope.length === 0) {
        const hubCity =
          targetCity && targetCity !== "ALL"
            ? targetCity
            : selectedCity !== "ALL"
              ? selectedCity
              : "BH";
        const hub = NUBANK_HUBS[hubCity];
        map.setView([hub.lat, hub.lng], 14);
        return;
      }

      // If multiple cities are mixed, focus on the dominant city in the visible set so zoom is street-level rather than continental
      let finalItems = itemsInScope;
      let dominantCity: CityHubCode = itemsInScope[0]!.prop.cityCode;
      if ((!targetCity || targetCity === "ALL") && selectedCity === "ALL") {
        const counts = new Map<CityHubCode, number>();
        for (const it of itemsInScope) {
          counts.set(it.prop.cityCode, (counts.get(it.prop.cityCode) ?? 0) + 1);
        }
        let bestCount = 0;
        for (const [c, cnt] of counts.entries()) {
          if (cnt > bestCount) {
            bestCount = cnt;
            dominantCity = c;
          }
        }
        finalItems = itemsInScope.filter(
          (it) => it.prop.cityCode === dominantCity,
        );
      }

      const hub = NUBANK_HUBS[dominantCity];
      const lats = [...finalItems.map((i) => i.coord.lat), hub.lat];
      const lngs = [...finalItems.map((i) => i.coord.lng), hub.lng];

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      map.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        { padding: [48, 48], maxZoom: 14.5, animate: false },
      );
    },
    [resolvedItems, selectedCity],
  );

  // Auto-fit when city or visible property set changes significantly
  useEffect(() => {
    if (!leafletReady || resolvedItems.length === 0) return;
    const sig = `${selectedCity}:${resolvedItems
      .slice(0, 5)
      .map((i) => i.key)
      .join(",")}:${resolvedItems.length}`;
    if (lastFitSignatureRef.current !== sig) {
      lastFitSignatureRef.current = sig;
      fitMapToCurrentItems();
    }
  }, [leafletReady, selectedCity, resolvedItems, fitMapToCurrentItems]);

  // Frame selected property together with its Nubank Office Hub when selected
  useEffect(() => {
    if (!leafletReady || !selectedPropertyKey || !mapInstanceRef.current) return;
    const found = resolvedItems.find((i) => i.key === selectedPropertyKey);
    if (!found) return;
    const hub = NUBANK_HUBS[found.prop.cityCode];
    const minLat = Math.min(found.coord.lat, hub.lat) - 0.004;
    const maxLat = Math.max(found.coord.lat, hub.lat) + 0.004;
    const minLng = Math.min(found.coord.lng, hub.lng) - 0.006;
    const maxLng = Math.max(found.coord.lng, hub.lng) + 0.006;
    mapInstanceRef.current.fitBounds(
      [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
      { padding: [56, 56], maxZoom: 15, animate: true },
    );
  }, [leafletReady, selectedPropertyKey, resolvedItems]);

  // Render Nubank Hub HQ Beacons + Commute Radius Rings, Property Speech-Bubble Pins, and Active Connection Line
  useEffect(() => {
    const L = typeof window !== "undefined" ? window.L : undefined;
    if (
      !leafletReady ||
      !L ||
      !markersGroupRef.current ||
      !hubsGroupRef.current ||
      !lineGroupRef.current
    ) {
      return;
    }

    const markersGroup = markersGroupRef.current;
    const hubsGroup = hubsGroupRef.current;
    const lineGroup = lineGroupRef.current;

    markersGroup.clearLayers();
    hubsGroup.clearLayers();
    lineGroup.clearLayers();

    // 1. Render Nubank Office HQ Beacons + 2.5km Commute Radius Rings
    const activeHubs =
      selectedCity === "BSB" ||
      resolvedItems.some((it) => it.prop.cityCode === "BSB")
        ? [...ALL_NUBANK_HUB_LOCATIONS, NUBANK_HUBS.BSB]
        : ALL_NUBANK_HUB_LOCATIONS;

    for (const hub of activeHubs) {
      if (typeof L.circle === "function") {
        // Outer 2.5 km commute ring
        L.circle([hub.lat, hub.lng], {
          radius: 2500,
          color: "#a855f7",
          weight: 1.5,
          dashArray: "6 6",
          fillColor: "#a855f7",
          fillOpacity: 0.05,
          interactive: false,
        }).addTo(hubsGroup);
      }

      const subtitle =
        hub.bannerSubtitle || HUB_BANNER_SUBTITLE[hub.cityCode];
      const hubIcon = L.divIcon({
        className: "moradia-nu-hub-icon",
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        html: `
          <div style="
            position:relative;
            width:44px;
            height:44px;
            display:flex;
            align-items:center;
            justify-content:center;
            cursor:pointer;
          ">
            <!-- Outer Animated Radar Pulse Halo -->
            <div style="
              position:absolute;
              inset:-10px;
              border-radius:9999px;
              background:rgba(168,85,247,0.38);
              border:2px solid rgba(253,224,71,0.75);
              animation:moradia-nu-pulse 2.2s infinite ease-out;
              pointer-events:none;
            "></div>

            <!-- Secondary 3D Radar Ring -->
            <div style="
              position:absolute;
              inset:-2px;
              border-radius:9999px;
              background:rgba(88,28,135,0.45);
              border:2.5px solid #fde047;
              box-shadow:0 0 22px rgba(168,85,247,0.95), 0 0 8px rgba(253,224,71,0.9);
              pointer-events:none;
            "></div>

            <!-- Inner 36x36 Circular HQ Crest -->
            <div style="
              position:relative;
              z-index:2;
              width:36px;
              height:36px;
              border-radius:9999px;
              background:linear-gradient(135deg,#9333ea 0%,#581c87 100%);
              border:2.5px solid #ffffff;
              box-shadow:0 4px 16px rgba(88,28,135,0.75);
              display:flex;
              align-items:center;
              justify-content:center;
              color:#ffffff;
            ">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
                <path d="M10 6h4"/>
                <path d="M10 10h4"/>
                <path d="M10 14h4"/>
                <path d="M10 18h4"/>
              </svg>
            </div>

            <!-- Distinctive Floating HQ Banner Label Above Crest -->
            <div style="
              position:absolute;
              bottom:calc(100% + 7px);
              left:50%;
              transform:translateX(-50%);
              z-index:3;
              display:flex;
              flex-direction:column;
              align-items:center;
              pointer-events:none;
            ">
              <div style="
                display:flex;
                flex-direction:column;
                align-items:center;
                padding:3.5px 10px;
                border-radius:8px;
                background:linear-gradient(135deg,#3b0764 0%,#1e1b4b 100%);
                border:2px solid #fde047;
                box-shadow:0 8px 20px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(255,255,255,0.9);
                white-space:nowrap;
                line-height:1.15;
              ">
                <span style="
                  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
                  font-size:9.5px;
                  font-weight:900;
                  letter-spacing:0.06em;
                  color:#fde047;
                ">${hub.cityCode === "BSB" ? "★ REFERÊNCIA ATUAL (BSB)" : "★ ESCRITÓRIO NUBANK"}</span>
                <span style="
                  font-family:ui-sans-serif,system-ui,sans-serif;
                  font-size:10px;
                  font-weight:800;
                  color:#ffffff;
                ">${subtitle}</span>
              </div>
              <div style="
                width:0;
                height:0;
                border-left:5.5px solid transparent;
                border-right:5.5px solid transparent;
                border-top:6.5px solid #fde047;
                margin-top:-1px;
              "></div>
            </div>
          </div>
        `,
      });

      const marker = L.marker([hub.lat, hub.lng], {
        icon: hubIcon,
        zIndexOffset: 4200,
      }).addTo(hubsGroup);

      marker.bindTooltip(
        `<div style="font-size:11px;font-weight:800;color:#fde047;">★ ${hub.name}</div><div style="font-size:10.5px;color:#f8fafc;margin-top:1px;">${hub.address}</div><div style="font-size:9.5px;color:#c084fc;margin-top:2px;">Raio tracejado = 2,5 km do escritório</div>`,
        {
          direction: "bottom",
          offset: [0, 22],
          className: "moradia-hub-tooltip",
        },
      );

      marker.on("click", () => {
        setFocusedHubCity(hub.cityCode);
        mapInstanceRef.current?.flyTo([hub.lat, hub.lng], 16.5, {
          duration: 0.65,
        });
      });
    }

    // 2. Render dashed line from hovered/selected property to its Nubank Office Hub
    const activeKey = hoveredPropertyKey ?? selectedPropertyKey;
    const activeItem = activeKey
      ? resolvedItems.find((i) => i.key === activeKey)
      : undefined;

    if (activeItem) {
      const hub = NUBANK_HUBS[activeItem.prop.cityCode];
      L.polyline(
        [
          [activeItem.coord.lat, activeItem.coord.lng],
          [hub.lat, hub.lng],
        ],
        {
          color: "#a855f7",
          weight: 3,
          opacity: 0.92,
          dashArray: "6, 6",
        },
      ).addTo(lineGroup);
    }

    // 3. Render Crisp Airbnb-Style White Speech-Bubble Pointer Pins for Properties
    for (const item of resolvedItems) {
      const { key, prop, coord, listIndex } = item;
      const isHovered = hoveredPropertyKey === key;
      const isSelected = selectedPropertyKey === key;
      const isActive = isHovered || isSelected;
      const isFav = favoriteKeys.includes(key);
      const rankNum = prop.overallRank ?? listIndex;
      const priceCompact = formatPinPriceCompact(prop.totalMonthly);
      const rarity = prop.cardTags.floorTag?.rarity ?? null;
      const badgeColor = rarity ? FLOOR_RARITY_BADGE_HEX[rarity] : "#475569";

      const pillBg = isActive ? "#1e1b4b" : "#ffffff";
      const pillText = isActive ? "#ffffff" : "#0f172a";
      const pillBorder = isActive
        ? "2px solid #ffffff"
        : "1.5px solid rgba(15,23,42,0.22)";
      const pillShadow = isActive
        ? "0 8px 20px rgba(0,0,0,0.6), 0 0 0 3px rgba(139,92,246,0.55)"
        : "0 3px 10px rgba(0,0,0,0.45), 0 0 0 1.5px rgba(15,23,42,0.18)";
      const wrapperTransform = isActive
        ? "scale(1.18) translateY(-3px)"
        : "scale(1)";

      const iconWidth = 74;
      const iconHeight = 32;

      const icon = L.divIcon({
        className: "moradia-prop-pill-icon",
        iconSize: [iconWidth, iconHeight],
        iconAnchor: [iconWidth / 2, iconHeight],
        html: `
          <div
            data-prop-key="${key}"
            style="
              position:relative;
              width:${iconWidth}px;
              height:${iconHeight}px;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:flex-end;
              transform:${wrapperTransform};
              transform-origin:bottom center;
              transition:transform 140ms cubic-bezier(0.2,0.8,0.2,1);
              cursor:pointer;
            "
          >
            <!-- Speech Bubble Pill -->
            <div style="
              position:relative;
              display:inline-flex;
              align-items:center;
              gap:4px;
              padding:3px 8px 3px 4px;
              border-radius:9999px;
              background:${pillBg};
              color:${pillText};
              border:${pillBorder};
              box-shadow:${pillShadow};
              white-space:nowrap;
              line-height:1;
            ">
              <!-- Floor-Tier Tinted Mini Rank Badge -->
              <span style="
                display:inline-flex;
                align-items:center;
                justify-content:center;
                padding:1.5px 4.5px;
                border-radius:9999px;
                background:${badgeColor};
                color:#ffffff;
                font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
                font-size:9px;
                font-weight:800;
                letter-spacing:-0.02em;
              ">#${rankNum}</span>

              <!-- Compact Price Text in Dark Bold Monospace (e.g. 4,1k) -->
              <span style="
                font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
                font-size:11px;
                font-weight:800;
                letter-spacing:-0.03em;
                color:${pillText};
              ">${priceCompact}</span>

              ${
                isFav
                  ? `<span style="
                      position:absolute;
                      top:-5px;
                      right:-5px;
                      width:14px;
                      height:14px;
                      border-radius:9999px;
                      background:#e11d48;
                      color:#ffffff;
                      border:1.5px solid #ffffff;
                      display:inline-flex;
                      align-items:center;
                      justify-content:center;
                      font-size:8px;
                      box-shadow:0 2px 4px rgba(0,0,0,0.35);
                    ">♥</span>`
                  : ""
              }
            </div>

            <!-- Crisp Downward Pointer Tail (▼) -->
            <div style="
              width:0;
              height:0;
              border-left:6px solid transparent;
              border-right:6px solid transparent;
              border-top:7px solid ${pillBg};
              margin-top:-1px;
              filter:drop-shadow(0 2px 1.5px rgba(15,23,42,0.45));
            "></div>
          </div>
        `,
      });

      const marker = L.marker([coord.lat, coord.lng], {
        icon,
        zIndexOffset: isActive ? 5000 : isFav ? 2000 : 1000 - rankNum,
      }).addTo(markersGroup);

      marker.on("mouseover", () => {
        onHoverProperty(key);
      });
      marker.on("mouseout", () => {
        onHoverProperty(null);
      });
      marker.on("click", () => {
        onSelectProperty(key);
      });
    }
  }, [
    leafletReady,
    resolvedItems,
    hoveredPropertyKey,
    selectedPropertyKey,
    favoriteKeys,
    onHoverProperty,
    onSelectProperty,
  ]);

  const activePreviewItem = useMemo(() => {
    const key = selectedPropertyKey ?? hoveredPropertyKey;
    if (!key) return null;
    return resolvedItems.find((i) => i.key === key) ?? null;
  }, [selectedPropertyKey, hoveredPropertyKey, resolvedItems]);

  const cityCounts = useMemo(() => {
    const map: Record<CityHubCode, number> = { BH: 0, RJ: 0, CP: 0, SP: 0, BSB: 0 };
    for (const item of resolvedItems) {
      map[item.prop.cityCode] += 1;
    }
    return map;
  }, [resolvedItems]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
      {/* Ultra-Clean Single-Row Top Bar */}
      <div className="flex items-center justify-between gap-1.5 border-b bg-card/95 px-2 py-1 text-xs backdrop-blur-xs z-20 overflow-x-auto whitespace-nowrap">
        {/* Quick City-Hub Jump Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {(["BH", "RJ", "CP", "SP", ...(cityCounts.BSB > 0 || selectedCity === "BSB" ? (["BSB"] as const) : [])] as const).map((c) => {
            const count = cityCounts[c];
            const isHubActive = focusedHubCity === c;
            return (
              <button
                key={`map-jump-${c}`}
                type="button"
                data-testid={`map-jump-${c}`}
                onClick={() => fitMapToCurrentItems(c, true)}
                title={`Voar para ${NUBANK_HUBS[c].name} (${NUBANK_HUBS[c].address})`}
                className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-all whitespace-nowrap ${
                  isHubActive
                    ? "border-purple-500 bg-purple-700 text-white shadow-2xs"
                    : count > 0
                      ? "border-border bg-background text-foreground hover:border-purple-400 hover:bg-secondary"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                <span aria-hidden="true" className="text-[9px]">
                  📍
                </span>
                <span>Nu {c}</span>
              </button>
            );
          })}

          <button
            type="button"
            data-testid="map-jump-all"
            onClick={() => fitMapToCurrentItems("ALL")}
            title="Enquadrar todos os imóveis visíveis"
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors whitespace-nowrap ${
              focusedHubCity === "ALL"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Compass className="h-2.5 w-2.5 text-primary" />
            <span className="hidden sm:inline">Ver </span>
            <span>Todos</span>
          </button>

          {isGeocoding && (
            <span className="inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 font-mono text-[9px] text-amber-700 dark:text-amber-300">
              GPS
            </span>
          )}

          {onLoadMore &&
            totalFilteredCount !== undefined &&
            properties.length < totalFilteredCount && (
              <button
                type="button"
                data-testid="map-load-more-button"
                onClick={onLoadMore}
                className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 whitespace-nowrap"
              >
                +Mais ({properties.length} de {totalFilteredCount})
              </button>
            )}
        </div>

        {/* Layer Switcher: Satélite + Ruas | Satélite | Mapa Limpo */}
        <div
          role="group"
          aria-label="Modo de visualização do mapa"
          className="inline-flex items-center rounded-md border bg-muted/60 p-0.5 shrink-0"
        >
          {(
            [
              {
                id: "hybrid",
                label: "Satélite + Ruas",
                mobileLabel: "Híbrido",
                icon: Globe,
              },
              {
                id: "satellite",
                label: "Satélite",
                mobileLabel: "Satélite",
                icon: Globe,
              },
              {
                id: "roadmap",
                label: "Mapa Limpo",
                mobileLabel: "Ruas",
                icon: MapIcon,
              },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const isActive = mapStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`map-style-${opt.id}`}
                aria-pressed={isActive}
                onClick={() => handleSelectMapStyle(opt.id)}
                title={MAP_STYLE_CONFIG[opt.id].label}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-2.5 w-2.5" />
                <span className="sm:hidden">{opt.mobileLabel}</span>
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Map Canvas */}
      <div
        className="relative flex-1 min-h-[300px] sm:min-h-[380px] w-full bg-slate-950/30"
        onClick={(e) => {
          const target = e.target as HTMLElement | null;
          const propPin = target?.closest?.("[data-prop-key]") as HTMLElement | null;
          const propKey = propPin?.getAttribute("data-prop-key");
          if (propKey) {
            onSelectProperty(propKey);
          }
        }}
      >
        <div ref={mapContainerRef} className="h-full w-full z-10" />

        {/* Ultra-Compact Floating Key Pill (Top-Right) */}
        <div className="pointer-events-none absolute right-2 top-2 z-20 hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/80 px-2.5 py-0.5 text-[9.5px] font-medium text-white shadow-lg backdrop-blur-md">
          <span className="inline-flex items-center gap-1 font-bold text-amber-300">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-600 ring-1 ring-amber-300" />
            ★ Escritório Nu (2,5 km)
          </span>
          <span className="opacity-30">|</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#f59e0b]" />
            Cob
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#7c3aed]" />
            Alto
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#0284c7]" />
            Méd
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#475569]" />
            Baixo
          </span>
        </div>

        {/* Sleek, Compact Selected / Hovered Property Floating Card */}
        {activePreviewItem && (
          <div
            data-testid="map-selected-property-card"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-2 bottom-2 z-30 mx-auto max-w-lg rounded-xl border border-primary/45 bg-card/95 p-2 shadow-2xl backdrop-blur-md transition-all sm:inset-x-3 sm:bottom-2.5"
          >
            <div className="flex items-center gap-2.5">
              {/* Compact Thumbnail with Gallery Trigger */}
              {activePreviewItem.prop.samplePhotos[0]?.url ? (
                <button
                  type="button"
                  onClick={() => onOpenGallery(activePreviewItem.prop, 0)}
                  className="group relative h-14 w-18 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border bg-muted sm:h-16 sm:w-22"
                >
                  <img
                    src={getCardPhotoUrl(
                      activePreviewItem.prop.samplePhotos[0].url,
                    )}
                    referrerPolicy="no-referrer"
                    onError={(e) =>
                      handleImgError(
                        e,
                        activePreviewItem.prop.samplePhotos[0]!.url,
                      )
                    }
                    alt={activePreviewItem.prop.neighborhood}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute bottom-0.5 right-0.5 inline-flex items-center gap-0.5 rounded bg-slate-950/80 px-1 py-0.5 font-mono text-[8px] font-semibold text-white">
                    <Images className="h-2 w-2" />
                    {activePreviewItem.prop.samplePhotos.length}
                  </span>
                </button>
              ) : (
                <div className="flex h-14 w-18 shrink-0 items-center justify-center rounded-lg border bg-muted text-[10px] text-muted-foreground sm:h-16 sm:w-22">
                  <Building2 className="h-4 w-4 opacity-40" />
                </div>
              )}

              {/* Compact Details */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white dark:bg-primary">
                      #
                      {activePreviewItem.prop.overallRank ??
                        activePreviewItem.listIndex}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-800 dark:text-purple-200">
                      <Navigation className="h-2.5 w-2.5 text-purple-600 dark:text-purple-300" />
                      <span>
                        a{" "}
                        {activePreviewItem.distHubKm
                          .toFixed(1)
                          .replace(".", ",")}{" "}
                        km do{" "}
                        <span className="sm:hidden">Nu</span>
                        <span className="hidden sm:inline">
                          Escritório Nubank
                        </span>
                      </span>
                    </span>
                    {activePreviewItem.prop.cardTags.floorTag && (
                      <span
                        className={`hidden sm:inline-block rounded border px-1.5 py-0.5 text-[9px] font-semibold ${
                          FLOOR_RARITY_PILL[
                            activePreviewItem.prop.cardTags.floorTag.rarity
                          ]
                        }`}
                      >
                        {activePreviewItem.prop.cardTags.floorTag.label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(activePreviewItem.key)}
                      aria-label="Favoritar imóvel"
                      className="rounded-md border p-1 hover:bg-secondary"
                    >
                      <Heart
                        className={`h-3 w-3 ${
                          favoriteKeys.includes(activePreviewItem.key)
                            ? "fill-rose-500 text-rose-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProperty(null);
                        onHoverProperty(null);
                      }}
                      aria-label="Fechar prévia do mapa"
                      className="rounded-md border p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <h4 className="truncate text-xs font-bold">
                  {activePreviewItem.prop.neighborhood} —{" "}
                  {activePreviewItem.prop.street}
                  {activePreviewItem.prop.streetNumber
                    ? `, ${activePreviewItem.prop.streetNumber}`
                    : ""}
                </h4>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    <span className="font-bold text-primary">
                      <Sparkles className="mr-0.5 inline h-3 w-3" />
                      {activePreviewItem.prop.finalScore.toFixed(1)} pts
                    </span>
                    <span className="font-bold">
                      R${" "}
                      {activePreviewItem.prop.totalMonthly.toLocaleString(
                        "pt-BR",
                      )}
                      /mês
                    </span>
                    <span className="font-sans text-[10.5px] text-muted-foreground">
                      {activePreviewItem.prop.areaM2}m² ·{" "}
                      {activePreviewItem.prop.bedrooms}Q ·{" "}
                      {activePreviewItem.prop.parkingSpaces}V
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onFocusCardInList(activePreviewItem.key)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10.5px] font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <ListFilter className="h-2.5 w-2.5" />
                      Na Lista
                    </button>
                    <a
                      href={activePreviewItem.prop.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[10.5px] font-semibold hover:bg-secondary"
                    >
                      {getProviderName(activePreviewItem.prop.provider)}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
