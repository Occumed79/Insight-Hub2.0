import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Eye, EyeOff, Globe2, Layers3, Loader2, MapPinned, MousePointer2, X } from "lucide-react";
import { wcMoney, wcNumber, wcText, type WarCostsRow } from "./war-costs-utils";

declare global {
  interface Window { maptilersdk?: any; }
}

const MAPTILER_VERSION = "4.0.2";
const MAPTILER_SCRIPT = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.umd.min.js`;
const MAPTILER_CSS = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.css`;

type LayerKey = "bases" | "personnel" | "construction" | "instability" | "naval";
type LayerState = Record<LayerKey, boolean>;
type MapCounts = Record<LayerKey, number>;
type MapSelection = {
  layer: LayerKey;
  title: string;
  subtitle?: string;
  location?: string;
  status?: string;
  metricLabel?: string;
  metricValue?: string;
  detail?: string;
  source?: string;
};

type Props = {
  bases: WarCostsRow[];
  personnel?: WarCostsRow[];
  construction?: WarCostsRow[];
  conflicts?: WarCostsRow[];
  strikes?: WarCostsRow[];
  operations?: WarCostsRow[];
  deployments?: WarCostsRow[];
  personnelYear?: number | null;
};

type InstabilitySignal = {
  place: string;
  title: string;
  conflict: boolean;
  strikeRecords: number;
  civilianCasualties: number;
  row: WarCostsRow;
};

const LAYER_META: Array<{ key: LayerKey; label: string; note: string; color: string; swatch: string }> = [
  { key: "bases", label: "Defense Installations", note: "U.S. military bases and overseas installations.", color: "#67e8f9", swatch: "bg-cyan-300" },
  { key: "personnel", label: "Personnel Footprint", note: "U.S. personnel presence and troop posture.", color: "#22c55e", swatch: "bg-emerald-400" },
  { key: "construction", label: "Site Expansion", note: "Military construction and new facilities.", color: "#facc15", swatch: "bg-amber-300" },
  { key: "instability", label: "Instability", note: "Active conflict plus strike/drone and civilian-casualty signals.", color: "#f43f5e", swatch: "bg-rose-400" },
  { key: "naval", label: "Naval Deployments", note: "Approved maritime deployment and fleet-posture context.", color: "#3b82f6", swatch: "bg-blue-400" },
];

async function loadMapTilerSdk() {
  let css = document.querySelector<HTMLLinkElement>(`link[href="${MAPTILER_CSS}"]`);
  if (!css) {
    css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = MAPTILER_CSS;
    css.dataset.maptilerDefenseCss = "true";
    document.head.appendChild(css);
  }
  if (window.maptilersdk) return window.maptilersdk;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-maptiler-sdk="true"]');
    const finish = () => window.maptilersdk ? resolve() : reject(new Error("MapTiler SDK did not initialize."));
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("MapTiler SDK failed to load.")), { once: true });
      setTimeout(() => window.maptilersdk && resolve(), 0);
      return;
    }
    const script = document.createElement("script");
    script.src = MAPTILER_SCRIPT;
    script.async = true;
    script.dataset.maptilerSdk = "true";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("MapTiler SDK failed to load.")), { once: true });
    document.head.appendChild(script);
  });
  return window.maptilersdk;
}

async function geocode(label: string, apiKey: string): Promise<[number, number] | null> {
  const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(label)}.json?key=${encodeURIComponent(apiKey)}&limit=1`, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const center = payload?.features?.[0]?.center;
  return Array.isArray(center) && Number.isFinite(Number(center[0])) && Number.isFinite(Number(center[1])) ? [Number(center[0]), Number(center[1])] : null;
}

function directionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const direction = raw.match(/\b([NSEW])\b/i)?.[1]?.toUpperCase() || raw.match(/([NSEW])\s*$/i)?.[1]?.toUpperCase() || "";
  const numericMatch = raw.replace(/,/g, "").match(/[-+]?\d+(?:\.\d+)?/);
  if (!numericMatch) return null;
  let parsed = Number(numericMatch[0]);
  if (!Number.isFinite(parsed)) return null;
  if (direction === "S" || direction === "W") parsed = -Math.abs(parsed);
  if (direction === "N" || direction === "E") parsed = Math.abs(parsed);
  return parsed;
}

function numericField(row: WarCostsRow, ...keys: string[]): number | null {
  for (const key of keys) {
    const parsed = directionalNumber(row[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function sourceCoordinate(row: WarCostsRow): [number, number] | null {
  const lat = numericField(row, "latitude", "lat");
  const lon = numericField(row, "longitude", "lon", "lng", "long");
  if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lon, lat];
  const coordinates = row.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const first = directionalNumber(coordinates[0]);
    const second = directionalNumber(coordinates[1]);
    if (first !== null && second !== null) {
      if (Math.abs(first) <= 180 && Math.abs(second) <= 90) return [first, second];
      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
    }
  }
  return null;
}

function stringArray(row: WarCostsRow, key: string): string[] {
  return Array.isArray(row[key]) ? (row[key] as unknown[]).filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function placeFromRow(row: WarCostsRow): string {
  return stringArray(row, "countries")[0] || wcText(row, "country", "countryName", "location", "city", "region", "targetCountry", "hostCountry", "aor", "target");
}

function baseLabel(row: WarCostsRow): string {
  return wcText(row, "name", "baseName", "installation", "site", "facility") || "Defense installation";
}

function baseGeocodeLabel(row: WarCostsRow): string {
  return [baseLabel(row), wcText(row, "city", "location"), wcText(row, "state"), wcText(row, "country", "countryName")].filter(Boolean).join(", ");
}

function activeConflict(row: WarCostsRow) {
  const status = wcText(row, "status", "outcome").toLowerCase();
  if (/(ongoing|active|current|in progress)/.test(status)) return true;
  const endYear = wcNumber(row, "endYear");
  const startYear = wcNumber(row, "startYear", "year");
  return !endYear && (!startYear || startYear >= 2001);
}

function buildInstability(conflicts: WarCostsRow[], strikes: WarCostsRow[]): InstabilitySignal[] {
  const grouped = new Map<string, InstabilitySignal>();
  const add = (row: WarCostsRow, conflict: boolean) => {
    const place = placeFromRow(row);
    if (!place) return;
    const key = place.toLowerCase();
    const casualty = wcNumber(row, "civilianDeaths", "civilianCasualties", "deaths", "fatalities", "reportedDeaths");
    const title = wcText(row, "name", "title", "conflict", "event") || `Instability · ${place}`;
    const current = grouped.get(key) || { place, title, conflict: false, strikeRecords: 0, civilianCasualties: 0, row };
    current.conflict ||= conflict;
    if (!conflict) current.strikeRecords += 1;
    current.civilianCasualties = Math.max(current.civilianCasualties, casualty);
    if (conflict) { current.title = title; current.row = row; }
    grouped.set(key, current);
  };
  conflicts.filter(activeConflict).forEach((row) => add(row, true));
  strikes.slice(-150).forEach((row) => add(row, false));
  return [...grouped.values()].sort((a, b) => Number(b.conflict) - Number(a.conflict) || b.civilianCasualties - a.civilianCasualties || b.strikeRecords - a.strikeRecords).slice(0, 40);
}

function buildNaval(deployments: WarCostsRow[], operations: WarCostsRow[]) {
  const seen = new Set<string>();
  return [...deployments, ...operations].filter((row) => {
    const place = placeFromRow(row);
    const title = wcText(row, "name", "title", "operation", "deployment");
    const key = `${place}|${title}`.toLowerCase();
    if ((!place && !title) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 35);
}

async function inBatches<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) await Promise.all(items.slice(index, index + size).map(task));
}

function selectionFromFeature(feature: any): MapSelection | null {
  const props = feature?.properties || {};
  const layer = props.layer as LayerKey | undefined;
  if (!layer || !LAYER_META.some((item) => item.key === layer)) return null;
  return {
    layer,
    title: String(props.title || "Selected map feature"),
    subtitle: props.subtitle ? String(props.subtitle) : undefined,
    location: props.location ? String(props.location) : undefined,
    status: props.status ? String(props.status) : undefined,
    metricLabel: props.metricLabel ? String(props.metricLabel) : undefined,
    metricValue: props.metricValue ? String(props.metricValue) : undefined,
    detail: props.detail ? String(props.detail) : undefined,
    source: props.source ? String(props.source) : undefined,
  };
}

function feature(point: [number, number], properties: Record<string, unknown>) {
  return { type: "Feature", geometry: { type: "Point", coordinates: point }, properties };
}

export function WarCostsMapTilerGlobe({ bases, personnel = [], construction = [], conflicts = [], strikes = [], operations = [], deployments = [], personnelYear = null }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const apiKeyRef = useRef("");
  const [mapRevision, setMapRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<MapCounts>({ bases: 0, personnel: 0, construction: 0, instability: 0, naval: 0 });
  const [visible, setVisible] = useState<LayerState>({ bases: true, personnel: true, construction: true, instability: true, naval: true });
  const [basePlacement, setBasePlacement] = useState({ direct: 0, geocoded: 0, unplaced: 0 });
  const [selection, setSelection] = useState<MapSelection | null>(null);

  const directBaseRows = useMemo(() => bases.filter((row) => Boolean(sourceCoordinate(row))), [bases]);
  const fallbackBaseRows = useMemo(() => bases.filter((row) => !sourceCoordinate(row)).sort((a, b) => wcNumber(b, "personnel", "troops", "size") - wcNumber(a, "personnel", "troops", "size")).slice(0, 50), [bases]);
  const personnelRows = useMemo(() => personnel.filter((row) => wcNumber(row, "personnel", "troops") > 0 && wcText(row, "country", "countryName", "location")).sort((a, b) => wcNumber(b, "personnel", "troops") - wcNumber(a, "personnel", "troops")), [personnel]);
  const constructionRows = useMemo(() => construction.filter((row) => Boolean(sourceCoordinate(row))), [construction]);
  const instabilityRows = useMemo(() => buildInstability(conflicts, strikes), [conflicts, strikes]);
  const navalRows = useMemo(() => buildNaval(deployments, operations), [deployments, operations]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/war-costs/map-config", { cache: "no-store" });
        const config = await response.json().catch(() => ({}));
        if (!response.ok || !config?.configured || !config?.apiKey) throw new Error("MAP_TILER_API_KEY_2 is not configured on this service.");
        apiKeyRef.current = config.apiKey;
        const sdk = await loadMapTilerSdk();
        if (cancelled || !hostRef.current) return;
        sdk.config.apiKey = config.apiKey;
        const map = new sdk.Map({
          container: hostRef.current,
          style: sdk.MapStyle?.STREETS?.DARK || sdk.MapStyle?.BRIGHT?.DARK || "streets-v2-dark",
          center: [15, 23],
          zoom: 1.25,
          pitch: 18,
          bearing: 0,
          projection: "globe",
          halo: true,
          space: { color: "#01040a" },
          attributionControl: true,
        });
        mapRef.current = map;
        if (sdk.NavigationControl) map.addControl(new sdk.NavigationControl({ visualizePitch: true }), "bottom-right");

        let attached = false;
        const attach = () => {
          if (cancelled || attached) return;
          attached = true;
          for (const meta of LAYER_META) {
            const sourceId = `defense-globe-${meta.key}`;
            const glowId = `${sourceId}-glow`;
            const pointId = `${sourceId}-points`;
            if (!map.getSource(sourceId)) map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            if (!map.getLayer(glowId)) map.addLayer({ id: glowId, type: "circle", source: sourceId, paint: { "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "magnitude"], 8], 0, 9, 15, 18, 40, 32], "circle-color": meta.color, "circle-opacity": 0.13, "circle-blur": 0.65 } });
            if (!map.getLayer(pointId)) map.addLayer({ id: pointId, type: "circle", source: sourceId, paint: { "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "magnitude"], 8], 0, 4, 15, 8, 40, 14], "circle-color": meta.color, "circle-opacity": 0.9, "circle-stroke-color": "rgba(238,252,255,.92)", "circle-stroke-width": 1 } });
            map.on("mouseenter", pointId, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", pointId, () => { map.getCanvas().style.cursor = ""; });
            map.on("click", pointId, (event: any) => {
              const next = selectionFromFeature(event.features?.[0]);
              if (next) setSelection(next);
            });
          }
          map.setProjection?.("globe");
          setMapRevision((value) => value + 1);
        };
        map.on("load", attach);
        map.on("ready", attach);
        map.on("error", (event: any) => { if (!cancelled) setError(event?.error?.message || "MapTiler globe resource failed."); });
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Defense globe failed to initialize.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapRevision || !apiKeyRef.current) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const apiKey = apiKeyRef.current;
      const geoCache = new Map<string, [number, number] | null>();
      const locate = async (place: string) => {
        if (geoCache.has(place)) return geoCache.get(place) ?? null;
        const point = await geocode(place, apiKey).catch(() => null);
        geoCache.set(place, point);
        return point;
      };
      const collections: Record<LayerKey, any[]> = { bases: [], personnel: [], construction: [], instability: [], naval: [] };
      let direct = 0;
      let geocoded = 0;
      let unplaced = Math.max(0, bases.length - directBaseRows.length - fallbackBaseRows.length);

      for (const row of directBaseRows) {
        const point = sourceCoordinate(row);
        if (!point || cancelled) continue;
        const personnelCount = wcNumber(row, "personnel", "troops", "assignedPersonnel");
        collections.bases.push(feature(point, { layer: "bases", title: baseLabel(row), subtitle: wcText(row, "type", "baseType", "category") || "Defense installation", location: wcText(row, "country", "countryName") || "Unknown", status: wcText(row, "status") || "Status not recorded", metricLabel: personnelCount ? "Personnel" : "Placement", metricValue: personnelCount ? personnelCount.toLocaleString() : "Source coordinates", detail: "Installation geography can identify locations where contractor examinations, surveillance, vaccines, labs, dental, audiology, pulmonary testing, or other provider-network capacity may be needed.", source: "Defense installation index", magnitude: personnelCount ? Math.min(40, 8 + Math.log10(Math.max(1, personnelCount)) * 8) : 8 }));
        direct += 1;
      }
      for (const row of fallbackBaseRows) {
        if (cancelled) break;
        const label = baseGeocodeLabel(row);
        const point = label ? await locate(label) : null;
        if (!point || cancelled) { unplaced += 1; continue; }
        const personnelCount = wcNumber(row, "personnel", "troops", "assignedPersonnel");
        collections.bases.push(feature(point, { layer: "bases", title: baseLabel(row), subtitle: wcText(row, "type", "baseType", "category") || "Defense installation", location: wcText(row, "country", "countryName") || "Unknown", status: wcText(row, "status") || "Status not recorded", metricLabel: personnelCount ? "Personnel" : "Placement", metricValue: personnelCount ? personnelCount.toLocaleString() : "MapTiler geocode", detail: "Installation geography can identify locations where contractor examinations, surveillance, vaccines, labs, dental, audiology, pulmonary testing, or other provider-network capacity may be needed.", source: "Defense installation index", magnitude: personnelCount ? Math.min(40, 8 + Math.log10(Math.max(1, personnelCount)) * 8) : 8 }));
        geocoded += 1;
      }

      await inBatches(personnelRows, 8, async (row) => {
        if (cancelled) return;
        const country = wcText(row, "country", "countryName", "location");
        const point = sourceCoordinate(row) ?? (country ? await locate(country) : null);
        if (!point || cancelled) return;
        const total = wcNumber(row, "personnel", "troops");
        const year = wcNumber(row, "year") || personnelYear || 0;
        collections.personnel.push(feature(point, { layer: "personnel", title: `${country} · U.S. personnel`, subtitle: year ? `Personnel footprint · ${year}` : "Personnel footprint", location: country, metricLabel: "Total personnel", metricValue: total.toLocaleString(), detail: "Personnel posture helps prioritize countries where contractor medical-network depth may matter. It is context, not an Occu-Med demand estimate.", source: "Defense-presence feed", magnitude: Math.min(45, 8 + Math.log10(Math.max(1, total)) * 9) }));
      });

      for (const row of constructionRows) {
        const point = sourceCoordinate(row);
        if (!point || cancelled) continue;
        const location = wcText(row, "location", "site", "facility", "country") || "Defense site expansion";
        const country = wcText(row, "country", "countryName");
        const year = wcNumber(row, "year");
        const spending = wcNumber(row, "spending", "amount", "cost", "total");
        collections.construction.push(feature(point, { layer: "construction", title: location, subtitle: "Military construction / new facility", location: country || location, status: year ? String(year) : "", metricLabel: spending ? "Construction investment" : "Record", metricValue: spending ? wcMoney(spending) : "Mapped expansion site", detail: "Expansion can signal emerging locations where contractor medical support or provider recruitment may become necessary.", source: "Defense-presence construction feed", magnitude: spending ? Math.min(38, 7 + Math.log10(Math.max(1, spending)) * 4) : 9 }));
      }

      await inBatches(instabilityRows, 6, async (signal) => {
        if (cancelled) return;
        const point = sourceCoordinate(signal.row) ?? await locate(signal.place);
        if (!point || cancelled) return;
        const details = [signal.conflict ? "Active conflict" : "", signal.strikeRecords ? `${signal.strikeRecords} strike/drone record${signal.strikeRecords === 1 ? "" : "s"}` : "", signal.civilianCasualties ? `${signal.civilianCasualties.toLocaleString()} civilian-casualty signal` : ""].filter(Boolean);
        const severity = signal.civilianCasualties || signal.strikeRecords * 100;
        collections.instability.push(feature(point, { layer: "instability", title: signal.title, subtitle: "Combined instability signal", location: signal.place, status: details.join(" · ") || "Instability evidence", metricLabel: signal.strikeRecords ? "Strike/drone records" : signal.civilianCasualties ? "Civilian casualty signal" : "State", metricValue: signal.strikeRecords ? signal.strikeRecords.toLocaleString() : signal.civilianCasualties ? signal.civilianCasualties.toLocaleString() : "Active", detail: "Conflict, strike/drone activity, and civilian-casualty signals are combined because instability can affect provider access, travel feasibility, scheduling reliability, evacuation planning, and local medical capacity.", source: "WarCosts conflict + strike data", magnitude: Math.min(45, 10 + Math.log10(Math.max(1, severity)) * 7) }));
      });

      await inBatches(navalRows, 6, async (row) => {
        if (cancelled) return;
        const place = placeFromRow(row);
        const point = sourceCoordinate(row) ?? (place ? await locate(place) : null);
        if (!point || cancelled) return;
        const title = wcText(row, "name", "title", "operation", "deployment") || `Naval deployment · ${place || "unlabeled"}`;
        const year = wcNumber(row, "year");
        collections.naval.push(feature(point, { layer: "naval", title, subtitle: "Naval / maritime posture", location: place || wcText(row, "region", "aor"), status: year ? String(year) : wcText(row, "status"), metricLabel: "Context", metricValue: "Naval deployment", detail: "Naval posture can change contractor operating tempo, regional access, staging requirements, and medical-support priorities around ports and nearby defense locations.", source: "Sanitized WarCosts deployment / operation data", magnitude: 14 }));
      });

      if (cancelled) return;
      for (const meta of LAYER_META) {
        map.getSource?.(`defense-globe-${meta.key}`)?.setData?.({ type: "FeatureCollection", features: collections[meta.key] });
      }
      setCounts({ bases: collections.bases.length, personnel: collections.personnel.length, construction: collections.construction.length, instability: collections.instability.length, naval: collections.naval.length });
      setBasePlacement({ direct, geocoded, unplaced });
      setLoading(false);
    })().catch((reason) => {
      if (!cancelled) { setError(reason instanceof Error ? reason.message : "Defense globe data failed to render."); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [bases.length, constructionRows, directBaseRows, fallbackBaseRows, instabilityRows, mapRevision, navalRows, personnelRows, personnelYear]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapRevision) return;
    for (const meta of LAYER_META) {
      const visibility = visible[meta.key] ? "visible" : "none";
      for (const suffix of ["glow", "points"]) {
        const id = `defense-globe-${meta.key}-${suffix}`;
        if (map.getLayer?.(id)) map.setLayoutProperty?.(id, "visibility", visibility);
      }
    }
  }, [mapRevision, visible]);

  function resetView() {
    mapRef.current?.easeTo?.({ center: [15, 23], zoom: 1.25, pitch: 18, bearing: 0, duration: 850 });
  }

  return (
    <div className="war-map-operational-workspace grid min-h-[720px] grid-cols-1 overflow-hidden border-y border-white/8 bg-[#05080c] lg:grid-cols-[250px_minmax(0,1fr)_320px]">
      <aside className="defense-map-layer-rail border-b border-white/8 bg-[#070b10]/94 lg:border-b-0 lg:border-r" aria-label="Defense globe layers">
        <div className="flex h-14 items-center justify-between border-b border-white/8 px-4"><div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-cyan-100/60" /><p className="text-xs font-bold text-slate-400">3D defense globe layers</p></div><span className="text-xs text-slate-500">{Object.values(visible).filter(Boolean).length}/{LAYER_META.length}</span></div>
        <div className="divide-y divide-white/[.055]">
          {LAYER_META.map((meta) => (
            <button key={meta.key} type="button" data-layer={meta.key} aria-pressed={visible[meta.key]} onClick={() => setVisible((state) => ({ ...state, [meta.key]: !state[meta.key] }))} className={`flex w-full items-start gap-3 px-4 py-4 text-left transition ${visible[meta.key] ? "bg-white/[.018]" : "opacity-45"}`}>
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.swatch}`} />
              <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold leading-4 text-white">{meta.label}</p><span className="shrink-0 text-xs font-bold text-slate-400">{counts[meta.key].toLocaleString()}</span></div><p className="mt-1.5 text-[11px] leading-4 text-slate-500">{meta.note}</p></div>
              {visible[meta.key] ? <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" /> : <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-700" />}
            </button>
          ))}
        </div>
        <div className="defense-map-source-status border-t border-white/8 p-4 text-[11px] leading-5 text-slate-500"><p className="font-bold text-slate-400">Globe placement</p><p className="mt-2">{basePlacement.direct.toLocaleString()} source coordinates</p><p>{basePlacement.geocoded.toLocaleString()} MapTiler fallbacks</p><p>{basePlacement.unplaced.toLocaleString()} unplaced</p>{personnelYear ? <p className="mt-2 text-slate-400">Personnel dataset: {personnelYear}</p> : null}</div>
      </aside>

      <section className="defense-map-canvas relative min-w-0 overflow-hidden bg-[#01040a]">
        <div ref={hostRef} className="h-[calc(100vh-116px)] min-h-[720px] w-full" data-testid="defense-maptiler-globe" aria-label="3D MapTiler defense medical support globe" />
        <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2 rounded-md border border-cyan-100/12 bg-[#06101a]/78 px-3 py-2 text-[9px] font-semibold text-cyan-50/70 shadow-xl backdrop-blur-xl"><Globe2 className="h-3.5 w-3.5" />MapTiler 3D globe · drag to orbit · scroll to zoom</div>
        <div className="pointer-events-none absolute left-4 top-14 z-20 flex items-center gap-2 rounded-md border border-white/10 bg-[#081019]/78 px-3 py-2 text-[9px] font-semibold text-slate-400 shadow-xl backdrop-blur-xl"><MousePointer2 className="h-3 w-3" />Select a globe feature to inspect its operational context.</div>
        <button type="button" onClick={resetView} className="absolute bottom-5 left-5 z-20 inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#081019]/90 px-3 text-[10px] font-black text-slate-300 shadow-xl backdrop-blur-xl"><Crosshair className="h-3.5 w-3.5" />Reset globe</button>
        {loading ? <div className="absolute inset-0 z-30 grid place-items-center bg-[#020611]/66"><div className="text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-cyan-200" /><p className="mt-3 text-xs font-bold text-cyan-50">Building 3D defense globe…</p></div></div> : null}
        {error ? <div className="absolute bottom-5 right-5 z-40 max-w-md rounded-md border border-rose-200/18 bg-[#1a070d]/95 p-3 text-xs text-rose-100"><div className="flex gap-2"><MapPinned className="h-4 w-4 shrink-0" /><span>{error}</span></div></div> : null}
      </section>

      <aside className="defense-map-inspector border-t border-white/8 bg-[#080c12]/94 lg:border-l lg:border-t-0" aria-label="Selected globe evidence">
        <div className="sticky top-0 max-h-[calc(100vh-116px)] overflow-y-auto">
          <div className="flex h-14 items-center justify-between border-b border-white/8 px-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Globe inspector</p><p className="mt-0.5 text-[11px] font-black text-slate-300">Operational context</p></div>{selection ? <button type="button" onClick={() => setSelection(null)} className="rounded-md border border-white/8 p-1.5 text-slate-600 hover:text-white" aria-label="Clear globe selection"><X className="h-3.5 w-3.5" /></button> : null}</div>
          {selection ? <div className="p-5">
            <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${LAYER_META.find((item) => item.key === selection.layer)?.swatch || "bg-cyan-300"}`} /><span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-500">{LAYER_META.find((item) => item.key === selection.layer)?.label}</span></div>
            <h2 className="mt-4 text-xl font-black leading-6 tracking-[-.025em] text-white">{selection.title}</h2>
            {selection.subtitle ? <p className="mt-2 text-[11px] leading-5 text-slate-400">{selection.subtitle}</p> : null}
            <div className="mt-5 divide-y divide-white/7 border-y border-white/7 text-[10px]">{selection.location ? <InspectorRow label="Location" value={selection.location} /> : null}{selection.status ? <InspectorRow label="Status / year" value={selection.status} /> : null}{selection.metricLabel && selection.metricValue ? <InspectorRow label={selection.metricLabel} value={selection.metricValue} strong /> : null}{selection.source ? <InspectorRow label="Source" value={selection.source} /> : null}</div>
            {selection.detail ? <section className="mt-5 border-l border-white/10 pl-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Why it matters to Occu-Med</p><p className="mt-2 text-[10px] leading-5 text-slate-500">{selection.detail}</p></section> : null}
          </div> : <div className="grid min-h-[560px] place-items-center px-6 text-center"><div><Globe2 className="mx-auto h-8 w-8 text-slate-700" /><h2 className="mt-4 text-base font-black text-slate-300">Nothing selected</h2><p className="mt-2 text-[10px] leading-5 text-slate-600">Rotate the globe and click an installation, personnel marker, expansion site, instability signal, or naval deployment. Detail stays docked here while the globe remains the primary workspace.</p></div></div>}
        </div>
      </aside>
    </div>
  );
}

function InspectorRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-3"><span className="text-slate-600">{label}</span><span className={strong ? "font-black text-white" : "font-semibold text-slate-300"}>{value}</span></div>;
}