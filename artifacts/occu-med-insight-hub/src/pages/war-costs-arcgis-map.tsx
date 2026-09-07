import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, MapPinned } from "lucide-react";
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
  { key: "instability", label: "Conflict / Instability", note: "Active conflict, strike/drone and civilian-casualty signals combined." },
  { key: "naval", label: "Naval Deployments", note: "Maritime deployment and naval operational presence." },
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

export function WarCostsArcGisMap({ bases, conflicts = [], strikes = [], deployments = [], operations = [], personnel = [], construction = [], personnelYear = null }: WarCostsArcGisMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const layerRefs = useRef<Record<LayerKey, any>>({ bases: null, personnel: null, construction: null, instability: null, naval: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<MapCounts>({ bases: 0, personnel: 0, construction: 0, instability: 0, naval: 0 });
  const [visible, setVisible] = useState<LayerState>({ bases: true, personnel: true, construction: true, instability: true, naval: true });
  const [basePlacement, setBasePlacement] = useState({ direct: 0, geocoded: 0, unplaced: 0 });

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

        let direct = 0, geocoded = 0, unplaced = Math.max(0, bases.length - directBaseRows.length - fallbackBaseRows.length);
        const addBase = (row: WarCostsRow, point: [number, number], placement: "source coordinates" | "ArcGIS fallback") => {
          const name = baseLabel(row);
          const country = wcText(row, "country", "countryName") || "Unknown";
          const type = wcText(row, "type", "baseType", "category") || "Military installation";
          const status = wcText(row, "status") || "Status not recorded";
          const personnelCount = wcNumber(row, "personnel", "troops", "assignedPersonnel");
          layerRefs.current.bases.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [103, 232, 249, 0.62], size: personnelCount ? Math.max(5, Math.min(13, 5 + Math.log10(Math.max(1, personnelCount)) * 2)) : 6, outline: { color: [224, 247, 250, 0.72], width: 0.55 } },
            attributes: { title: name, country },
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
          layerRefs.current.personnel.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [34, 197, 94, 0.78], size: Math.max(6, Math.min(22, 5 + Math.log10(Math.max(1, total)) * 3.2)), outline: { color: [220, 252, 231, 0.9], width: 0.85 } },
            attributes: { title: `${country} · U.S. personnel` },
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
            symbol: { type: "simple-marker", color: [250, 204, 21, 0.8], size: spending ? Math.max(5, Math.min(16, 5 + Math.log10(Math.max(1, spending)) * 1.2)) : 7, outline: { color: [254, 249, 195, 0.9], width: 0.8 } },
            attributes: { title: location },
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
            symbol: { type: "simple-marker", color: [251, 113, 133, 0.9], size, outline: { color: [255, 228, 230, 0.96], width: 1.2 } },
            attributes: { title: name },
            popupTemplate: { title: "{title}", content: `<b>Instability signal · active conflict</b>${place ? `<br/>Location: ${place}` : ""}${civilianDeaths ? `<br/>Civilian casualties/deaths in source: ${civilianDeaths.toLocaleString()}` : ""}<br/>Conflict, strike activity and civilian impact are consolidated into this instability layer.` },
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
            symbol: { type: "simple-marker", color: [244, 63, 94, 0.72], size: casualties ? Math.max(7, Math.min(14, 7 + Math.log10(Math.max(1, casualties)) * 1.7)) : 8, outline: { color: [254, 205, 211, 0.88], width: 0.8 } },
            attributes: { title },
            popupTemplate: { title: "{title}", content: `<b>Instability signal · strike / drone activity</b>${place ? `<br/>Location: ${place}` : ""}${casualties ? `<br/>Civilian casualty signal: ${casualties.toLocaleString()}` : ""}<br/>Shown as part of instability, not as a separate warfare layer.` },
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
            symbol: { type: "simple-marker", color: [96, 165, 250, 0.9], size: 11, outline: { color: [219, 234, 254, 0.94], width: 1 } },
            attributes: { title },
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
    viewRef.current?.destroy?.();
    viewRef.current = null;
    layerRefs.current = { bases: null, personnel: null, construction: null, instability: null, naval: null };
  }, []);

  return (
    <div className="relative min-h-[720px] overflow-hidden rounded-3xl border border-cyan-100/10 bg-[#020611] shadow-[0_28px_90px_rgba(0,0,0,.42)]">
      <div ref={hostRef} className="h-[calc(100vh-235px)] min-h-[720px] w-full" aria-label="ArcGIS War Map with approved Occu-Med defense intelligence layers" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-sm rounded-2xl border border-white/10 bg-[#020611]/88 p-4 shadow-2xl backdrop-blur-xl"><p className="text-[9px] font-bold uppercase tracking-[.24em] text-cyan-100/40">Occu-Med defense intelligence</p><h2 className="mt-1 text-lg font-black text-white">Global War Map</h2><p className="mt-1 text-[10px] leading-4 text-cyan-100/42">Installations, personnel posture, military construction, instability and naval deployments.</p><p className="mt-3 text-[9px] text-cyan-100/34">Bases: {basePlacement.direct.toLocaleString()} direct coordinates · {basePlacement.geocoded} ArcGIS fallbacks · {basePlacement.unplaced.toLocaleString()} unplaced{personnelYear ? ` · Personnel ${personnelYear}` : ""}</p></div>
      <div className="absolute right-4 top-4 z-10 w-[285px] rounded-2xl border border-white/10 bg-[#020611]/90 p-3 shadow-2xl backdrop-blur-xl"><p className="px-1 pb-2 text-[9px] font-bold uppercase tracking-[.2em] text-cyan-100/35">Approved layers</p>{LAYER_META.map((meta) => <button key={meta.key} type="button" onClick={() => setVisible((state) => ({ ...state, [meta.key]: !state[meta.key] }))} className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${visible[meta.key] ? "border-cyan-200/18 bg-cyan-300/[.08]" : "border-white/7 bg-black/20 opacity-55"}`}>{visible[meta.key] ? <Eye size={14} className="text-cyan-100" /> : <EyeOff size={14} className="text-cyan-100/40" />}<div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-[10px] font-black text-white">{meta.label}</p><span className="text-[10px] font-black text-cyan-100/60">{counts[meta.key].toLocaleString()}</span></div><p className="mt-1 text-[9px] leading-3 text-cyan-100/32">{meta.note}</p></div></button>)}</div>
      {loading && <div className="absolute inset-0 z-20 grid place-items-center bg-[#020611]/78"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs font-bold text-cyan-50">Building approved defense layers…</p></div></div>}
      {error && <div className="absolute bottom-4 left-4 z-30 max-w-md rounded-xl border border-rose-200/20 bg-[#1a070d]/95 p-3 text-xs text-rose-100"><div className="flex gap-2"><MapPinned size={15} className="shrink-0" /><span>{error}</span></div></div>}
    </div>
  );
}
