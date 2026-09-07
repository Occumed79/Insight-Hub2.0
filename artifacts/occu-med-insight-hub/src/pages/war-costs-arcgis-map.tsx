import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Eye, EyeOff, Layers3, Loader2, MapPinned, MousePointer2, X } from "lucide-react";
import { wcCivilianDeaths, wcConflictName, wcMoney, wcNumber, wcStringArray, wcText, type WarCostsRow } from "./war-costs-utils";

declare global {
  interface Window {
    $arcgis?: { import: (modules: string | string[]) => Promise<any> };
    esriConfig?: { apiKey?: string };
  }
}

const ARCGIS_VERSION = "5.1";
const ARCGIS_SCRIPT = `https://js.arcgis.com/${ARCGIS_VERSION}/`;
const ARCGIS_CSS = `https://js.arcgis.com/${ARCGIS_VERSION}/esri/themes/dark/main.css`;
const GEOCODE_URL = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

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

type WarCostsArcGisMapProps = {
  bases: WarCostsRow[];
  conflicts?: WarCostsRow[];
  strikes?: WarCostsRow[];
  deployments?: WarCostsRow[];
  operations?: WarCostsRow[];
  personnel?: WarCostsRow[];
  construction?: WarCostsRow[];
  personnelYear?: number | null;
};

const LAYER_META: Array<{ key: LayerKey; label: string; note: string }> = [
  { key: "bases", label: "U.S. Military Installations", note: "Overseas and domestic installation footprint." },
  { key: "personnel", label: "U.S. Personnel Presence", note: "Country-level troop and personnel posture." },
  { key: "construction", label: "Military Construction", note: "New facilities and site expansion." },
  { key: "instability", label: "Conflict / Instability", note: "Active conflict, strike/drone and civilian-impact signals." },
  { key: "naval", label: "Naval Deployments", note: "Maritime deployment and naval operational presence." },
];

const LAYER_SWATCH: Record<LayerKey, string> = {
  bases: "bg-cyan-300",
  personnel: "bg-emerald-400",
  construction: "bg-amber-300",
  instability: "bg-rose-400",
  naval: "bg-blue-400",
};

async function loadArcGis(apiKey: string) {
  let css = document.querySelector<HTMLLinkElement>(`link[href="${ARCGIS_CSS}"]`);
  if (!css) {
    css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = ARCGIS_CSS;
    css.dataset.arcgisWarCosts = "true";
    document.head.appendChild(css);
  }
  window.esriConfig = { ...(window.esriConfig ?? {}), apiKey };
  if (!window.$arcgis) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-arcgis-war-costs="true"]');
      const done = () => window.$arcgis ? resolve() : reject(new Error("ArcGIS SDK did not initialize."));
      if (existing) {
        existing.addEventListener("load", done, { once: true });
        existing.addEventListener("error", () => reject(new Error("ArcGIS SDK failed to load.")), { once: true });
        setTimeout(() => window.$arcgis && resolve(), 0);
        return;
      }
      const script = document.createElement("script");
      script.type = "module";
      script.src = ARCGIS_SCRIPT;
      script.dataset.arcgisWarCosts = "true";
      script.addEventListener("load", done, { once: true });
      script.addEventListener("error", () => reject(new Error("ArcGIS SDK failed to load.")), { once: true });
      document.head.appendChild(script);
    });
  }
  if (!window.$arcgis) throw new Error("ArcGIS SDK is unavailable.");
  const config = await window.$arcgis.import("@arcgis/core/config.js");
  config.apiKey = apiKey;
  return window.$arcgis;
}

async function geocode(label: string, apiKey: string): Promise<[number, number] | null> {
  const params = new URLSearchParams({ SingleLine: label, maxLocations: "1", outFields: "Match_addr,Addr_type", forStorage: "false", f: "json", token: apiKey });
  const response = await fetch(`${GEOCODE_URL}?${params.toString()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const location = payload?.candidates?.[0]?.location;
  return Number.isFinite(location?.x) && Number.isFinite(location?.y) ? [location.x, location.y] : null;
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
  if (coordinates && typeof coordinates === "object" && !Array.isArray(coordinates)) {
    const nested = coordinates as WarCostsRow;
    const nestedLat = numericField(nested, "latitude", "lat", "y");
    const nestedLon = numericField(nested, "longitude", "lon", "lng", "long", "x");
    if (nestedLat !== null && nestedLon !== null && Math.abs(nestedLat) <= 90 && Math.abs(nestedLon) <= 180) return [nestedLon, nestedLat];
  }
  return null;
}

function activeConflict(row: WarCostsRow) {
  const status = wcText(row, "status", "outcome").toLowerCase();
  if (/(ongoing|active|current|in progress)/.test(status)) return true;
  const startYear = wcNumber(row, "startYear", "year");
  return !wcNumber(row, "endYear") && startYear >= 2022;
}

function placeFromRow(row: WarCostsRow): string {
  const countries = wcStringArray(row, "countries");
  const direct = countries[0] || wcText(row, "country", "countryName", "location", "city", "region", "targetCountry", "hostCountry", "aor");
  if (direct) return direct;
  const conflict = wcText(row, "conflict");
  return conflict ? conflict.replace(/-/g, " ").replace(/\b(war|intervention|invasion)\b/gi, " ").replace(/\s+/g, " ").trim() : "";
}

function baseLabel(row: WarCostsRow): string {
  return wcText(row, "name", "baseName", "installation", "site", "facility") || "U.S. military installation";
}

function baseGeocodeLabel(row: WarCostsRow): string {
  return [baseLabel(row), wcText(row, "city", "location"), wcText(row, "state"), wcText(row, "country", "countryName")].filter(Boolean).join(", ");
}

function rowBlob(row: WarCostsRow): string {
  try { return JSON.stringify(row).toLowerCase(); }
  catch { return ""; }
}

function uniqueByPlace(rows: WarCostsRow[], max: number): WarCostsRow[] {
  const seen = new Set<string>();
  const output: WarCostsRow[] = [];
  for (const row of rows) {
    const place = placeFromRow(row).toLowerCase();
    if (!place || seen.has(place)) continue;
    seen.add(place);
    output.push(row);
    if (output.length >= max) break;
  }
  return output;
}

async function inBatches<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) await Promise.all(items.slice(index, index + size).map(task));
}

function selectionFromGraphic(graphic: any): MapSelection | null {
  const attributes = graphic?.attributes || {};
  const layer = attributes.layer as LayerKey | undefined;
  if (!layer || !LAYER_META.some((item) => item.key === layer)) return null;
  return {
    layer,
    title: String(attributes.title || "Selected map feature"),
    subtitle: attributes.subtitle ? String(attributes.subtitle) : undefined,
    location: attributes.location ? String(attributes.location) : undefined,
    status: attributes.status ? String(attributes.status) : undefined,
    metricLabel: attributes.metricLabel ? String(attributes.metricLabel) : undefined,
    metricValue: attributes.metricValue ? String(attributes.metricValue) : undefined,
    detail: attributes.detail ? String(attributes.detail) : undefined,
    source: attributes.source ? String(attributes.source) : undefined,
  };
}

export function WarCostsArcGisMap({ bases, conflicts = [], strikes = [], deployments = [], operations = [], personnel = [], construction = [], personnelYear = null }: WarCostsArcGisMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const clickHandleRef = useRef<any>(null);
  const layerRefs = useRef<Record<LayerKey, any>>({ bases: null, personnel: null, construction: null, instability: null, naval: null });
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
  const conflictRows = useMemo(() => conflicts.filter(activeConflict).slice(0, 18), [conflicts]);
  const strikeRows = useMemo(() => [...strikes].reverse().slice(0, 24), [strikes]);
  const navalRows = useMemo(() => {
    const keyword = /(navy|naval|carrier|fleet|warship|ship|maritime|red sea|arabian sea|persian gulf|strait|sea of oman|mediterranean|pacific fleet|atlantic fleet)/i;
    return uniqueByPlace([...deployments.filter((row) => keyword.test(rowBlob(row))), ...operations.filter((row) => keyword.test(rowBlob(row)))], 16);
  }, [deployments, operations]);

  useEffect(() => {
    for (const key of Object.keys(visible) as LayerKey[]) if (layerRefs.current[key]) layerRefs.current[key].visible = visible[key];
  }, [visible]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const configResponse = await fetch("/api/war-costs/arcgis-config", { cache: "no-store" });
        const config = await configResponse.json().catch(() => ({}));
        if (!configResponse.ok || !config?.configured || !config?.apiKey) throw new Error("ARCGIS_API_KEY is not configured on this service.");
        const arcgis = await loadArcGis(config.apiKey);
        if (cancelled || !hostRef.current) return;
        const [EsriMap, MapView, GraphicsLayer, Graphic] = await arcgis.import(["@arcgis/core/Map.js", "@arcgis/core/views/MapView.js", "@arcgis/core/layers/GraphicsLayer.js", "@arcgis/core/Graphic.js"]);
        if (cancelled || !hostRef.current) return;

        if (!viewRef.current) {
          const map = new EsriMap({ basemap: "dark-gray-vector" });
          const created: Record<LayerKey, any> = {
            bases: new GraphicsLayer({ title: "U.S. Military Installations" }),
            personnel: new GraphicsLayer({ title: "U.S. Personnel Presence" }),
            construction: new GraphicsLayer({ title: "Military Construction" }),
            instability: new GraphicsLayer({ title: "Conflict / Instability" }),
            naval: new GraphicsLayer({ title: "Naval Deployments" }),
          };
          map.addMany([created.bases, created.construction, created.personnel, created.naval, created.instability]);
          layerRefs.current = created;
          viewRef.current = new MapView({ container: hostRef.current, map, center: [15, 23], zoom: 1.7, constraints: { minZoom: 1 }, popup: { dockEnabled: false } });
          await viewRef.current.when();
          clickHandleRef.current?.remove?.();
          clickHandleRef.current = viewRef.current.on("click", async (event: any) => {
            const hit = await viewRef.current?.hitTest?.(event).catch(() => null);
            const result = hit?.results?.find((item: any) => selectionFromGraphic(item?.graphic));
            const next = selectionFromGraphic(result?.graphic);
            if (next) setSelection(next);
          });
        }

        for (const key of Object.keys(layerRefs.current) as LayerKey[]) layerRefs.current[key]?.removeAll();
        const nextCounts: MapCounts = { bases: 0, personnel: 0, construction: 0, instability: 0, naval: 0 };
        const geoCache = new Map<string, [number, number] | null>();
        const locate = async (place: string) => {
          if (geoCache.has(place)) return geoCache.get(place) ?? null;
          const location = await geocode(place, config.apiKey).catch(() => null);
          geoCache.set(place, location);
          return location;
        };

        let direct = 0;
        let geocoded = 0;
        let unplaced = Math.max(0, bases.length - directBaseRows.length - fallbackBaseRows.length);

        const addBase = (row: WarCostsRow, point: [number, number], placement: "source coordinates" | "ArcGIS fallback") => {
          const name = baseLabel(row);
          const country = wcText(row, "country", "countryName") || "Unknown";
          const type = wcText(row, "type", "baseType", "category") || "Military installation";
          const status = wcText(row, "status") || "Status not recorded";
          const personnelCount = wcNumber(row, "personnel", "troops", "assignedPersonnel");
          layerRefs.current.bases.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [103, 232, 249, 0.70], size: personnelCount ? Math.max(5, Math.min(13, 5 + Math.log10(Math.max(1, personnelCount)) * 2)) : 6, outline: { color: [224, 247, 250, 0.80], width: 0.65 } },
            attributes: {
              layer: "bases",
              title: name,
              subtitle: type,
              location: country,
              status,
              metricLabel: personnelCount ? "Personnel" : "Placement",
              metricValue: personnelCount ? personnelCount.toLocaleString() : placement,
              detail: `Mapped from ${placement}.`,
              source: "WarCosts base-index",
            },
            popupTemplate: { title: "{title}", content: `<b>${type}</b><br/>Country: ${country}<br/>Status: ${status}${personnelCount ? `<br/>Personnel: ${personnelCount.toLocaleString()}` : ""}<br/>Placement: ${placement}` },
          }));
          nextCounts.bases += 1;
        };

        for (const row of directBaseRows) {
          const point = sourceCoordinate(row);
          if (!point || cancelled) continue;
          addBase(row, point, "source coordinates");
          direct += 1;
        }

        for (const row of fallbackBaseRows) {
          if (cancelled) break;
          const label = baseGeocodeLabel(row);
          const point = label ? await locate(label) : null;
          if (!point || cancelled) { unplaced += 1; continue; }
          addBase(row, point, "ArcGIS fallback");
          geocoded += 1;
        }

        await inBatches(personnelRows, 8, async (row) => {
          if (cancelled) return;
          const country = wcText(row, "country", "countryName", "location");
          const point = sourceCoordinate(row) ?? (country ? await locate(country) : null);
          if (!point || cancelled) return;
          const total = wcNumber(row, "personnel", "troops");
          const army = wcNumber(row, "army");
          const navy = wcNumber(row, "navy");
          const airForce = wcNumber(row, "airForce", "air_force");
          const marines = wcNumber(row, "marines", "marineCorps");
          const year = wcNumber(row, "year") || personnelYear || 0;
          const branches = [army ? `Army ${army.toLocaleString()}` : "", navy ? `Navy ${navy.toLocaleString()}` : "", airForce ? `Air Force ${airForce.toLocaleString()}` : "", marines ? `Marines ${marines.toLocaleString()}` : ""].filter(Boolean).join(" · ");
          layerRefs.current.personnel.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [34, 197, 94, 0.80], size: Math.max(6, Math.min(22, 5 + Math.log10(Math.max(1, total)) * 3.2)), outline: { color: [220, 252, 231, 0.92], width: 0.85 } },
            attributes: {
              layer: "personnel",
              title: `${country} · U.S. personnel`,
              subtitle: year ? `Personnel posture · ${year}` : "Personnel posture",
              location: country,
              metricLabel: "Total personnel",
              metricValue: total.toLocaleString(),
              detail: branches || "Branch detail not reported in the source row.",
              source: "Michael Allen / troopdata defense-presence feed",
            },
            popupTemplate: { title: "{title}", content: `<b>U.S. personnel posture${year ? ` · ${year}` : ""}</b><br/>Total: ${total.toLocaleString()}${army ? `<br/>Army: ${army.toLocaleString()}` : ""}${navy ? `<br/>Navy: ${navy.toLocaleString()}` : ""}${airForce ? `<br/>Air Force: ${airForce.toLocaleString()}` : ""}${marines ? `<br/>Marines: ${marines.toLocaleString()}` : ""}` },
          }));
          nextCounts.personnel += 1;
        });

        for (const row of constructionRows) {
          const point = sourceCoordinate(row);
          if (!point || cancelled) continue;
          const location = wcText(row, "location", "site", "facility", "country") || "Military construction";
          const country = wcText(row, "country", "countryName");
          const year = wcNumber(row, "year");
          const spending = wcNumber(row, "spending", "amount", "cost", "total");
          layerRefs.current.construction.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [250, 204, 21, 0.82], size: spending ? Math.max(5, Math.min(16, 5 + Math.log10(Math.max(1, spending)) * 1.2)) : 7, outline: { color: [254, 249, 195, 0.92], width: 0.8 } },
            attributes: {
              layer: "construction",
              title: location,
              subtitle: "Military construction / new facility",
              location: country || location,
              status: year ? String(year) : undefined,
              metricLabel: spending ? "Spending" : "Record",
              metricValue: spending ? wcMoney(spending) : "Mapped construction site",
              source: "Defense-presence construction feed",
            },
            popupTemplate: { title: "{title}", content: `<b>Military construction / new facility</b>${country ? `<br/>Country: ${country}` : ""}${year ? `<br/>Year: ${year}` : ""}${spending ? `<br/>Spending: ${wcMoney(spending)}` : ""}` },
          }));
          nextCounts.construction += 1;
        }

        for (const row of conflictRows) {
          const place = placeFromRow(row);
          const point = sourceCoordinate(row) ?? (place ? await locate(place) : null);
          if (!point || cancelled) continue;
          const name = wcConflictName(row);
          const civilianDeaths = wcCivilianDeaths(row);
          const size = civilianDeaths > 0 ? Math.max(12, Math.min(24, 11 + Math.log10(Math.max(1, civilianDeaths)) * 2.1)) : 14;
          layerRefs.current.instability.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [251, 113, 133, 0.92], size, outline: { color: [255, 228, 230, 0.96], width: 1.2 } },
            attributes: {
              layer: "instability",
              title: name,
              subtitle: "Active conflict signal",
              location: place,
              metricLabel: civilianDeaths ? "Civilian impact in source" : "Signal",
              metricValue: civilianDeaths ? civilianDeaths.toLocaleString() : "Active",
              detail: "Conflict, strike activity and civilian impact are consolidated into the instability layer.",
              source: "WarCosts conflicts",
            },
            popupTemplate: { title: "{title}", content: `<b>Instability signal · active conflict</b>${place ? `<br/>Location: ${place}` : ""}${civilianDeaths ? `<br/>Civilian casualties/deaths in source: ${civilianDeaths.toLocaleString()}` : ""}` },
          }));
          nextCounts.instability += 1;
        }

        for (const row of strikeRows) {
          const place = placeFromRow(row);
          const point = sourceCoordinate(row) ?? (place ? await locate(place) : null);
          if (!point || cancelled) continue;
          const title = wcText(row, "name", "title", "target", "location", "country") || `Strike activity — ${place}`;
          const casualties = wcNumber(row, "civilianDeaths", "civilianCasualties", "civiliansKilled", "deaths", "casualties");
          layerRefs.current.instability.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [244, 63, 94, 0.75], size: casualties ? Math.max(7, Math.min(14, 7 + Math.log10(Math.max(1, casualties)) * 1.7)) : 8, outline: { color: [254, 205, 211, 0.90], width: 0.8 } },
            attributes: {
              layer: "instability",
              title,
              subtitle: "Strike / drone activity",
              location: place,
              metricLabel: casualties ? "Civilian casualty signal" : "Signal",
              metricValue: casualties ? casualties.toLocaleString() : "Mapped strike activity",
              detail: "Shown as part of instability rather than a separate warfare layer.",
              source: "WarCosts drone-strikes",
            },
            popupTemplate: { title: "{title}", content: `<b>Instability signal · strike / drone activity</b>${place ? `<br/>Location: ${place}` : ""}${casualties ? `<br/>Civilian casualty signal: ${casualties.toLocaleString()}` : ""}` },
          }));
          nextCounts.instability += 1;
        }

        for (const row of navalRows) {
          const place = placeFromRow(row);
          const point = sourceCoordinate(row) ?? (place ? await locate(place) : null);
          if (!point || cancelled) continue;
          const title = wcText(row, "name", "title", "operation", "deployment") || `Naval deployment — ${place}`;
          layerRefs.current.naval.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [96, 165, 250, 0.92], size: 11, outline: { color: [219, 234, 254, 0.95], width: 1 } },
            attributes: {
              layer: "naval",
              title,
              subtitle: "Naval deployment / maritime presence",
              location: place,
              metricLabel: "Presence",
              metricValue: "Mapped",
              source: "WarCosts overseas-presence / operations",
            },
            popupTemplate: { title: "{title}", content: `<b>Naval deployment / maritime presence</b>${place ? `<br/>Location: ${place}` : ""}` },
          }));
          nextCounts.naval += 1;
        }

        for (const key of Object.keys(visible) as LayerKey[]) layerRefs.current[key].visible = visible[key];
        if (!cancelled) {
          setCounts(nextCounts);
          setBasePlacement({ direct, geocoded, unplaced });
        }
      } catch (mapError) {
        if (!cancelled) setError(mapError instanceof Error ? mapError.message : "ArcGIS map failed to initialize.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bases.length, conflictRows, constructionRows, directBaseRows, fallbackBaseRows, navalRows, personnelRows, personnelYear, strikeRows]);

  useEffect(() => () => {
    clickHandleRef.current?.remove?.();
    clickHandleRef.current = null;
    viewRef.current?.destroy?.();
    viewRef.current = null;
    layerRefs.current = { bases: null, personnel: null, construction: null, instability: null, naval: null };
  }, []);

  function resetView() {
    void viewRef.current?.goTo?.({ center: [15, 23], zoom: 1.7 }, { duration: 700 }).catch(() => undefined);
  }

  return (
    <div className="war-map-operational-workspace grid min-h-[720px] grid-cols-[250px_minmax(0,1fr)_320px] overflow-hidden border-y border-white/8 bg-[#05080c]">
      <aside className="border-r border-white/8 bg-[#070b10]/94">
        <div className="flex h-14 items-center justify-between border-b border-white/8 px-4"><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-cyan-100/55" /><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Layers</p></div><span className="text-[9px] text-slate-600">{Object.values(visible).filter(Boolean).length}/{LAYER_META.length}</span></div>
        <div className="divide-y divide-white/[.055]">
          {LAYER_META.map((meta) => (
            <button key={meta.key} type="button" onClick={() => setVisible((state) => ({ ...state, [meta.key]: !state[meta.key] }))} className={`flex w-full items-start gap-3 px-4 py-4 text-left transition ${visible[meta.key] ? "bg-white/[.018]" : "opacity-45"}`}>
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${LAYER_SWATCH[meta.key]}`} />
              <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-[10px] font-black leading-4 text-white">{meta.label}</p><span className="shrink-0 text-[10px] font-black text-slate-400">{counts[meta.key].toLocaleString()}</span></div><p className="mt-1.5 text-[9px] leading-4 text-slate-600">{meta.note}</p></div>
              {visible[meta.key] ? <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" /> : <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-700" />}
            </button>
          ))}
        </div>
        <div className="border-t border-white/8 p-4 text-[9px] leading-5 text-slate-600"><p className="font-black uppercase tracking-[.11em] text-slate-500">Base placement</p><p className="mt-2">{basePlacement.direct.toLocaleString()} source coordinates</p><p>{basePlacement.geocoded.toLocaleString()} ArcGIS fallbacks</p><p>{basePlacement.unplaced.toLocaleString()} unplaced</p>{personnelYear ? <p className="mt-2 text-slate-500">Personnel dataset: {personnelYear}</p> : null}</div>
      </aside>

      <section className="relative min-w-0 bg-[#04070a]">
        <div ref={hostRef} className="h-[calc(100vh-116px)] min-h-[720px] w-full" aria-label="ArcGIS War Map with approved Occu-Med defense intelligence layers" />
        <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2 rounded-md border border-white/10 bg-[#081019]/82 px-3 py-2 text-[9px] font-semibold text-slate-400 shadow-xl backdrop-blur-xl"><MousePointer2 className="h-3 w-3" />Select any mapped feature to inspect its evidence.</div>
        <button type="button" onClick={resetView} className="absolute bottom-5 left-5 z-20 inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-[#081019]/90 px-3 text-[10px] font-black text-slate-300 shadow-xl backdrop-blur-xl"><Crosshair className="h-3.5 w-3.5" />Reset world view</button>
        {loading ? <div className="absolute inset-0 z-30 grid place-items-center bg-[#020611]/72"><div className="text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-cyan-200" /><p className="mt-3 text-xs font-bold text-cyan-50">Building approved defense layers…</p></div></div> : null}
        {error ? <div className="absolute bottom-5 right-5 z-40 max-w-md rounded-md border border-rose-200/18 bg-[#1a070d]/95 p-3 text-xs text-rose-100"><div className="flex gap-2"><MapPinned className="h-4 w-4 shrink-0" /><span>{error}</span></div></div> : null}
      </section>

      <aside className="border-l border-white/8 bg-[#080c12]/94">
        <div className="sticky top-0 max-h-[calc(100vh-116px)] overflow-y-auto">
          <div className="flex h-14 items-center justify-between border-b border-white/8 px-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Selection inspector</p><p className="mt-0.5 text-[11px] font-black text-slate-300">Mapped evidence</p></div>{selection ? <button onClick={() => setSelection(null)} className="rounded-md border border-white/8 p-1.5 text-slate-600 hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}</div>
          {selection ? <div className="p-5">
            <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${LAYER_SWATCH[selection.layer]}`} /><span className="text-[9px] font-black uppercase tracking-[.12em] text-slate-500">{LAYER_META.find((item) => item.key === selection.layer)?.label}</span></div>
            <h2 className="mt-4 text-xl font-black leading-6 tracking-[-.025em] text-white">{selection.title}</h2>
            {selection.subtitle ? <p className="mt-2 text-[11px] leading-5 text-slate-400">{selection.subtitle}</p> : null}
            <div className="mt-5 divide-y divide-white/7 border-y border-white/7 text-[10px]">{selection.location ? <InspectorRow label="Location" value={selection.location} /> : null}{selection.status ? <InspectorRow label="Status / year" value={selection.status} /> : null}{selection.metricLabel && selection.metricValue ? <InspectorRow label={selection.metricLabel} value={selection.metricValue} strong /> : null}{selection.source ? <InspectorRow label="Source" value={selection.source} /> : null}</div>
            {selection.detail ? <section className="mt-5 border-l border-white/10 pl-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Context</p><p className="mt-2 text-[10px] leading-5 text-slate-500">{selection.detail}</p></section> : null}
          </div> : <div className="grid min-h-[560px] place-items-center px-6 text-center"><div><MapPinned className="mx-auto h-8 w-8 text-slate-700" /><h2 className="mt-4 text-base font-black text-slate-300">Nothing selected</h2><p className="mt-2 text-[10px] leading-5 text-slate-600">Click an installation, personnel marker, construction site, instability signal, or naval presence on the map. The map stays full size while evidence opens here.</p></div></div>}
        </div>
      </aside>
    </div>
  );
}

function InspectorRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-3"><span className="text-slate-650">{label}</span><span className={strong ? "font-black text-white" : "font-semibold text-slate-300"}>{value}</span></div>;
}
