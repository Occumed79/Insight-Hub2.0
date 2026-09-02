import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, MapPinned } from "lucide-react";
import { wcConflictCost, wcConflictName, wcMoney, wcNumber, wcStringArray, wcText, type WarCostsRow } from "./war-costs-utils";

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

type LayerKey = "conflicts" | "bases" | "naval" | "covert";
type LayerState = Record<LayerKey, boolean>;
type MapCounts = Record<LayerKey, number>;

type WarCostsArcGisMapProps = {
  conflicts: WarCostsRow[];
  bases: WarCostsRow[];
  deployments?: WarCostsRow[];
  operations?: WarCostsRow[];
  strikes?: WarCostsRow[];
};

const LAYER_META: Array<{ key: LayerKey; label: string; note: string }> = [
  { key: "conflicts", label: "Active Combat Zones", note: "Current WarCosts conflicts" },
  { key: "bases", label: "US Military Bases", note: "Installation-level base-index records" },
  { key: "naval", label: "Naval Deployments", note: "Current maritime deployment evidence" },
  { key: "covert", label: "Covert Operations", note: "Drone / special-operations evidence" },
];

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

function numericField(row: WarCostsRow, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[$,%+°NSEW,]/gi, "").trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function sourceCoordinate(row: WarCostsRow): [number, number] | null {
  const lat = numericField(row, "latitude", "lat");
  const lon = numericField(row, "longitude", "lon", "lng", "long");
  if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lon, lat];
  const coordinates = row.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const first = Number(coordinates[0]);
    const second = Number(coordinates[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
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
  return wcText(row, "name", "baseName", "installation", "site", "facility") || "US military installation";
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

export function WarCostsArcGisMap({ conflicts, bases, deployments = [], operations = [], strikes = [] }: WarCostsArcGisMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const layerRefs = useRef<Record<LayerKey, any>>({ conflicts: null, bases: null, naval: null, covert: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<MapCounts>({ conflicts: 0, bases: 0, naval: 0, covert: 0 });
  const [visible, setVisible] = useState<LayerState>({ conflicts: true, bases: true, naval: true, covert: true });
  const [basePlacement, setBasePlacement] = useState({ direct: 0, geocoded: 0, unplaced: 0 });

  const conflictRows = useMemo(() => conflicts.filter(activeConflict).slice(0, 12), [conflicts]);
  const directBaseRows = useMemo(() => bases.filter((row) => Boolean(sourceCoordinate(row))), [bases]);
  const fallbackBaseRows = useMemo(() => bases.filter((row) => !sourceCoordinate(row)).sort((a, b) => wcNumber(b, "personnel", "troops", "size", "annualCost", "cost") - wcNumber(a, "personnel", "troops", "size", "annualCost", "cost")).slice(0, 50), [bases]);
  const navalRows = useMemo(() => {
    const keyword = /(navy|naval|carrier|fleet|warship|ship|maritime|red sea|arabian sea|persian gulf|strait|sea of oman)/i;
    return uniqueByPlace([...deployments.filter((row) => keyword.test(rowBlob(row))), ...operations.filter((row) => wcNumber(row, "year") >= 2001 && keyword.test(rowBlob(row)))], 8);
  }, [deployments, operations]);
  const covertRows = useMemo(() => {
    const keyword = /(covert|cia|secret|special operations|special forces|seal|shadow|drone|classified)/i;
    return uniqueByPlace([...[...strikes].reverse(), ...operations.filter((row) => wcNumber(row, "year") >= 2001 && keyword.test(rowBlob(row)))], 7);
  }, [operations, strikes]);

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
            bases: new GraphicsLayer({ title: "US Military Bases" }),
            naval: new GraphicsLayer({ title: "Naval Deployments" }),
            covert: new GraphicsLayer({ title: "Covert Operations" }),
            conflicts: new GraphicsLayer({ title: "Active Combat Zones" }),
          };
          map.addMany([created.bases, created.naval, created.covert, created.conflicts]);
          layerRefs.current = created;
          viewRef.current = new MapView({ container: hostRef.current, map, center: [15, 23], zoom: 1.7, constraints: { minZoom: 1 }, popup: { dockEnabled: false } });
          await viewRef.current.when();
        }

        for (const key of Object.keys(layerRefs.current) as LayerKey[]) layerRefs.current[key]?.removeAll();
        const nextCounts: MapCounts = { conflicts: 0, bases: 0, naval: 0, covert: 0 };
        const geoCache = new Map<string, [number, number] | null>();
        const locate = async (place: string) => {
          if (geoCache.has(place)) return geoCache.get(place) ?? null;
          const location = await geocode(place, config.apiKey).catch(() => null);
          geoCache.set(place, location);
          return location;
        };

        let direct = 0, geocoded = 0, unplaced = Math.max(0, bases.length - directBaseRows.length - fallbackBaseRows.length);
        const addBase = (row: WarCostsRow, point: [number, number], placement: "source coordinates" | "ArcGIS fallback") => {
          const name = baseLabel(row);
          const country = wcText(row, "country", "countryName") || "Unknown";
          const type = wcText(row, "type", "baseType", "category") || "Military installation";
          const status = wcText(row, "status") || "Status not recorded";
          const personnel = wcNumber(row, "personnel", "troops", "assignedPersonnel");
          const cost = wcNumber(row, "annualCost", "cost", "estimatedCost");
          layerRefs.current.bases.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [103, 232, 249, 0.62], size: personnel ? Math.max(5, Math.min(13, 5 + Math.log10(Math.max(1, personnel)) * 2)) : 6, outline: { color: [224, 247, 250, 0.72], width: 0.55 } },
            attributes: { title: name, country },
            popupTemplate: { title: "{title}", content: `<b>${type}</b><br/>Country: ${country}<br/>Status: ${status}${personnel ? `<br/>Personnel: ${personnel.toLocaleString()}` : ""}${cost ? `<br/>Annual / source cost: ${wcMoney(cost)}` : ""}<br/>Placement: ${placement}` },
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
          const label = baseGeocodeLabel(row);
          const point = label ? await locate(label) : null;
          if (!point || cancelled) { unplaced += 1; continue; }
          addBase(row, point, "ArcGIS fallback");
          geocoded += 1;
        }

        for (const row of conflictRows) {
          const place = placeFromRow(row);
          const point = sourceCoordinate(row) ?? (place ? await locate(place) : null);
          if (!point || cancelled) continue;
          const name = wcConflictName(row);
          layerRefs.current.conflicts.add(new Graphic({ geometry: { type: "point", longitude: point[0], latitude: point[1] }, symbol: { type: "simple-marker", color: [251, 113, 133, 0.95], size: 15, outline: { color: [255, 228, 230, 0.98], width: 1.3 } }, attributes: { title: name }, popupTemplate: { title: "{title}", content: `<b>Active / ongoing conflict</b>${place ? `<br/>Location: ${place}` : ""}<br/>Adjusted cost: ${wcMoney(wcConflictCost(row))}` } }));
          nextCounts.conflicts += 1;
        }

        for (const row of navalRows) {
          const place = placeFromRow(row);
          const point = sourceCoordinate(row) ?? (place ? await locate(place) : null);
          if (!point || cancelled) continue;
          const title = wcText(row, "name", "title", "operation", "deployment") || `Naval activity — ${place}`;
          layerRefs.current.naval.add(new Graphic({ geometry: { type: "point", longitude: point[0], latitude: point[1] }, symbol: { type: "simple-marker", color: [96, 165, 250, 0.92], size: 12, outline: { color: [219, 234, 254, 0.95], width: 1 } }, attributes: { title }, popupTemplate: { title: "{title}", content: `<b>Naval / maritime deployment evidence</b>${place ? `<br/>Location: ${place}` : ""}<br/>Source: WarCosts deployment/operation data` } }));
          nextCounts.naval += 1;
        }

        for (const row of covertRows) {
          const place = placeFromRow(row);
          const point = sourceCoordinate(row) ?? (place ? await locate(place) : null);
          if (!point || cancelled) continue;
          const title = wcText(row, "name", "title", "target", "location") || `Covert / strike activity — ${place}`;
          layerRefs.current.covert.add(new Graphic({ geometry: { type: "point", longitude: point[0], latitude: point[1] }, symbol: { type: "simple-marker", color: [192, 132, 252, 0.92], size: 11, outline: { color: [243, 232, 255, 0.95], width: 1 } }, attributes: { title }, popupTemplate: { title: "{title}", content: `<b>Covert / special-operations evidence</b>${place ? `<br/>Location: ${place}` : ""}<br/>Source: WarCosts strike/operation data` } }));
          nextCounts.covert += 1;
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
  }, [bases.length, conflictRows, covertRows, directBaseRows, fallbackBaseRows, navalRows]);

  useEffect(() => () => {
    viewRef.current?.destroy?.();
    viewRef.current = null;
    layerRefs.current = { conflicts: null, bases: null, naval: null, covert: null };
  }, []);

  return (
    <div className="relative min-h-[720px] overflow-hidden rounded-3xl border border-cyan-100/10 bg-[#020611] shadow-[0_28px_90px_rgba(0,0,0,.42)]">
      <div ref={hostRef} className="h-[calc(100vh-235px)] min-h-[720px] w-full" aria-label="Standalone ArcGIS WarCosts operational map" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-sm rounded-2xl border border-white/10 bg-[#020611]/88 p-4 shadow-2xl backdrop-blur-xl"><p className="text-[9px] font-bold uppercase tracking-[.24em] text-cyan-100/40">Independent ArcGIS workspace</p><h2 className="mt-1 text-lg font-black text-white">Global War Map</h2><p className="mt-1 text-[10px] leading-4 text-cyan-100/42">Fresh ArcGIS canvas. WarCosts-only data. AOR remains on MapTiler.</p><p className="mt-3 text-[9px] text-cyan-100/34">Bases: {basePlacement.direct.toLocaleString()} direct source coordinates · {basePlacement.geocoded} ArcGIS fallbacks · {basePlacement.unplaced.toLocaleString()} currently unplaced</p></div>
      <div className="absolute right-4 top-4 z-10 w-[270px] rounded-2xl border border-white/10 bg-[#020611]/90 p-3 shadow-2xl backdrop-blur-xl"><p className="px-1 pb-2 text-[9px] font-bold uppercase tracking-[.2em] text-cyan-100/35">Operational layers</p>{LAYER_META.map((meta) => <button key={meta.key} type="button" onClick={() => setVisible((state) => ({ ...state, [meta.key]: !state[meta.key] }))} className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${visible[meta.key] ? "border-cyan-200/18 bg-cyan-300/[.08]" : "border-white/7 bg-black/20 opacity-55"}`}>{visible[meta.key] ? <Eye size={14} className="text-cyan-100" /> : <EyeOff size={14} className="text-cyan-100/40" />}<div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-[10px] font-black text-white">{meta.label}</p><span className="text-[10px] font-black text-cyan-100/60">{counts[meta.key].toLocaleString()}</span></div><p className="mt-1 text-[9px] leading-3 text-cyan-100/32">{meta.note}</p></div></button>)}</div>
      {loading && <div className="absolute inset-0 z-20 grid place-items-center bg-[#020611]/78"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs font-bold text-cyan-50">Building independent ArcGIS WarCosts layers…</p></div></div>}
      {error && <div className="absolute bottom-4 left-4 z-30 max-w-md rounded-xl border border-rose-200/20 bg-[#1a070d]/95 p-3 text-xs text-rose-100"><div className="flex gap-2"><MapPinned size={15} className="shrink-0" /><span>{error}</span></div></div>}
    </div>
  );
}
