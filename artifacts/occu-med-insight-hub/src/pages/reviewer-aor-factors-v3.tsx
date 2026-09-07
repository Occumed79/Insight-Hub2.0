import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Crosshair,
  Globe2,
  HeartPulse,
  Layers3,
  Loader2,
  MapPinned,
  Search,
  ShieldAlert,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { AorPriorityBrief, buildAorPrioritySignals } from "@/components/insight/AorPriorityBrief";
import { AorEpidemicOverlay } from "@/components/insight/AorEpidemicOverlay";
import { AOR_REGISTRY_REVIEWED_AT, COMMANDS, COMMAND_BY_COUNTRY, type CommandId } from "@/components/insight/aor-command-registry";

declare global {
  interface Window { maptilersdk?: any; }
}

const MAPTILER_VERSION = "4.0.2";
const MAPTILER_SCRIPT = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.umd.min.js`;
const MAPTILER_CSS = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.css`;
const COUNTRY_SOURCE = "https://api.maptiler.com/tiles/countries/tiles.json";
const EMPTY_COUNTRY_FILTER = ["==", "iso_a2", "__NONE__"];
const countryFilter = (iso2s: readonly string[]) => ["all", ["==", "level", 0], ["in", "iso_a2", ...iso2s]];

type MapMode = "country" | "aor";
type SelectedCountry = { name: string; iso2: string; center?: [number, number]; bbox?: [number, number, number, number] };
type SourceResult = { data: any; error: string; loading: boolean };
type CountrySources = { travel: SourceResult; who: SourceResult; gdacs: SourceResult; usgs: SourceResult; crisiswatch: SourceResult; health: SourceResult };
type EnvironmentKey = "heat" | "cold" | "altitude" | "poorAir" | "fatigue" | "ppe" | "night";
type AorResponse = { ok: boolean; command: CommandId; commandLabel: string; partial: boolean; sourceHealth: Array<{ provider: string; ok: boolean; count: number; error?: string }>; outbreaks: any[]; disasters: any[]; earthquakes: any[] };
type GlobalWatchResponse = { ok: boolean; partial: boolean; sourceHealth: Array<{ provider: string; ok: boolean; count: number; error?: string }>; outbreaks: any[]; disasters: any[]; earthquakes: any[] };

const ENVIRONMENT_LABELS: Record<EnvironmentKey, string> = {
  heat: "Heat / high WBGT",
  cold: "Cold exposure",
  altitude: "Altitude",
  poorAir: "Poor air quality",
  fatigue: "Fatigue / long shift",
  ppe: "PPE burden",
  night: "Night / circadian disruption",
};

const ENVIRONMENT_PROMPTS: Record<EnvironmentKey, string> = {
  heat: "Confirm temperature/WBGT, work-rest cycle, hydration, acclimatization, clothing/PPE and heat-sensitive conditions or medications.",
  cold: "Confirm temperature, wind, wetness, protective clothing, warming access and dexterity requirements.",
  altitude: "Confirm elevation, ascent profile, prior tolerance, cardiopulmonary limitations and emergency descent/oxygen access.",
  poorAir: "Identify pollutant or particulate source, AQI/monitoring, respiratory protection and underlying respiratory disease.",
  fatigue: "Confirm shift length, sleep opportunity, recent time-zone change, driving/critical tasks and recovery time.",
  ppe: "Confirm respirator/body armor/chemical PPE burden, heat retention, communication and emergency egress requirements.",
  night: "Confirm circadian timing, sleep opportunity, lighting, vigilance demand and commute/driving exposure.",
};

function emptyResult(loading = false): SourceResult { return { data: null, error: "", loading }; }
function emptyCountrySources(loading = false): CountrySources { return { travel: emptyResult(loading), who: emptyResult(loading), gdacs: emptyResult(loading), usgs: emptyResult(loading), crisiswatch: emptyResult(loading), health: emptyResult(loading) }; }
function externalUrl(value?: string) { if (!value) return ""; try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : ""; } catch { return ""; } }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Source request failed."; }
function formatDate(value?: string | null) { if (!value) return "Date not supplied"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
async function loadJson(url: string) { const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" }); const payload = await response.json().catch(() => ({})); if (!response.ok && payload?.configured !== false) throw new Error(payload?.error || `Request failed (${response.status}).`); return payload; }

async function loadMapTilerSdk() {
  let css = document.querySelector<HTMLLinkElement>(`link[href="${MAPTILER_CSS}"]`);
  if (!css) {
    css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = MAPTILER_CSS;
    css.dataset.maptilerCss = "true";
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

function geometryBbox(geometry: any): [number, number, number, number] | undefined {
  const pairs: Array<[number, number]> = [];
  const walk = (value: any) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
      const lon = Number(value[0]); const lat = Number(value[1]);
      if (Math.abs(lon) <= 180 && Math.abs(lat) <= 90) pairs.push([lon, lat]);
      return;
    }
    value.forEach(walk);
  };
  walk(geometry?.coordinates);
  if (!pairs.length) return undefined;
  const lons = pairs.map(([lon]) => lon); const lats = pairs.map(([, lat]) => lat);
  const minLon = Math.min(...lons); const maxLon = Math.max(...lons); const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
  return minLon < maxLon && minLat < maxLat ? [minLon, minLat, maxLon, maxLat] : undefined;
}

function RailSection({ label, children }: { label: string; children: ReactNode }) {
  return <section className="border-t border-white/8 px-3 py-4 first:border-t-0"><p className="px-1 text-[9px] font-black uppercase tracking-[.18em] text-slate-500">{label}</p><div className="mt-3">{children}</div></section>;
}

function SourceRow({ label, status, note }: { label: string; status: "ok" | "warn" | "loading"; note: string }) {
  return <div className="flex items-start gap-2 py-1.5"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${status === "ok" ? "bg-emerald-300" : status === "warn" ? "bg-amber-300" : "bg-cyan-300"}`} /><div className="min-w-0"><p className="text-[10px] font-bold text-slate-200">{label}</p><p className="mt-0.5 truncate text-[9px] text-slate-600">{note}</p></div></div>;
}

function InspectorSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="border-t border-white/8 py-4 first:border-t-0 first:pt-0"><div className="mb-3 flex items-center gap-2"><span className="text-cyan-200/65">{icon}</span><h3 className="text-[12px] font-black text-white">{title}</h3></div>{children}</section>;
}

function IntelRow({ title, meta, summary, href }: { title: string; meta?: string; summary?: string; href?: string }) {
  const url = externalUrl(href);
  const body = <div className="border-b border-white/[.055] py-3 last:border-b-0"><div className="flex items-start justify-between gap-3"><strong className="text-[11px] leading-4 text-slate-100">{title}</strong>{url ? <ArrowUpRight size={11} className="mt-0.5 shrink-0 text-cyan-200/45" /> : null}</div>{meta ? <p className="mt-1 text-[9px] text-slate-600">{meta}</p> : null}{summary ? <p className="mt-1.5 text-[10px] leading-4 text-slate-400">{summary}</p> : null}</div>;
  return url ? <a href={url} target="_blank" rel="noreferrer" className="block">{body}</a> : body;
}

export default function ReviewerAorFactorsV3Page() {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapKeyRef = useRef("");
  const modeRef = useRef<MapMode>("country");
  const [mapMode, setMapMode] = useState<MapMode>("country");
  const [command, setCommand] = useState<CommandId>("centcom");
  const selectedCommand = COMMANDS.find((item) => item.id === command) ?? COMMANDS[4];
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [countrySearchLoading, setCountrySearchLoading] = useState(false);
  const [countrySources, setCountrySources] = useState<CountrySources>(emptyCountrySources());
  const [data, setData] = useState<AorResponse | null>(null);
  const [globalWatch, setGlobalWatch] = useState<GlobalWatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [globalWatchLoading, setGlobalWatchLoading] = useState(true);
  const [error, setError] = useState("");
  const [globalWatchError, setGlobalWatchError] = useState("");
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mapError, setMapError] = useState("");
  const [mapLayersRevision, setMapLayersRevision] = useState(0);
  const [environment, setEnvironment] = useState<Record<EnvironmentKey, boolean>>({ heat: false, cold: false, altitude: false, poorAir: false, fatigue: false, ppe: false, night: false });

  const mappedCountryCommand = selectedCountry?.iso2 ? COMMAND_BY_COUNTRY.get(selectedCountry.iso2) ?? null : null;
  const selectedEnvironment = (Object.keys(environment) as EnvironmentKey[]).filter((key) => environment[key]);
  const contextLabel = selectedCountry?.name || (mapMode === "aor" ? selectedCommand.label : "Global watch");

  useEffect(() => { modeRef.current = mapMode; }, [mapMode]);

  useEffect(() => {
    let active = true;
    setGlobalWatchLoading(true);
    loadJson("/api/aor/global-watch")
      .then((payload) => { if (active) setGlobalWatch(payload as GlobalWatchResponse); })
      .catch((reason) => { if (active) setGlobalWatchError(errorMessage(reason)); })
      .finally(() => { if (active) setGlobalWatchLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mapMode !== "aor") { setData(null); setLoading(false); return; }
    let active = true;
    setLoading(true); setError("");
    loadJson(`/api/aor/unified-command?command=${encodeURIComponent(command)}`)
      .then((payload) => { if (active) setData(payload as AorResponse); })
      .catch((reason) => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [command, mapMode]);

  useEffect(() => {
    if (!selectedCountry) { setCountrySources(emptyCountrySources()); return; }
    let active = true;
    const name = selectedCountry.name;
    const encoded = encodeURIComponent(name);
    setCountrySources(emptyCountrySources(true));
    const entries: Array<[keyof CountrySources, string]> = [
      ["travel", `/api/public-data/aor-risk?country=${encoded}`],
      ["who", `/api/aor/health-outbreaks?country=${encoded}`],
      ["gdacs", `/api/aor/disaster-alerts?country=${encoded}`],
      ["usgs", `/api/aor/seismic-activity?country=${encoded}`],
      ["crisiswatch", `/api/aor/crisiswatch?country=${encoded}`],
      ["health", `/api/aor/travel-health?country=${encoded}`],
    ];
    entries.forEach(([key, url]) => {
      loadJson(url)
        .then((payload) => { if (active) setCountrySources((current) => ({ ...current, [key]: { data: payload, error: "", loading: false } })); })
        .catch((reason) => { if (active) setCountrySources((current) => ({ ...current, [key]: { data: null, error: errorMessage(reason), loading: false } })); });
    });
    return () => { active = false; };
  }, [selectedCountry]);

  useEffect(() => {
    let cancelled = false;
    let readinessTimer = 0;
    (async () => {
      try {
        const config = await loadJson("/api/map-config");
        if (!config?.configured || !config?.apiKey) throw new Error("MAPTILER_API_KEY is not configured on this service.");
        mapKeyRef.current = config.apiKey;
        const sdk = await loadMapTilerSdk();
        if (cancelled || !mapHostRef.current) return;
        sdk.config.apiKey = config.apiKey;
        const map = new sdk.Map({ container: mapHostRef.current, style: sdk.MapStyle?.BRIGHT?.DARK || sdk.MapStyle?.STREETS?.DARK || "streets-v2-dark", center: [18, 18], zoom: 1.15, attributionControl: true });
        mapRef.current = map;
        if (sdk.NavigationControl) map.addControl(new sdk.NavigationControl(), "bottom-right");
        let layersAttached = false;
        const markReady = () => { if (!cancelled) { setMapStatus("ready"); setMapError(""); } };
        const attachLayers = () => {
          if (cancelled || layersAttached) return;
          layersAttached = true;
          const sourceUrl = `${COUNTRY_SOURCE}?key=${encodeURIComponent(config.apiKey)}`;
          if (!map.getSource("aor-v3-countries")) map.addSource("aor-v3-countries", { type: "vector", url: sourceUrl });
          COMMANDS.forEach((item) => {
            map.addLayer({ id: `aor-v3-fill-${item.id}`, type: "fill", source: "aor-v3-countries", "source-layer": "administrative", filter: countryFilter(item.countries), paint: { "fill-color": item.color, "fill-opacity": 0 } });
            map.addLayer({ id: `aor-v3-line-${item.id}`, type: "line", source: "aor-v3-countries", "source-layer": "administrative", filter: countryFilter(item.countries), paint: { "line-color": item.color, "line-width": 1, "line-opacity": 0 } });
          });
          map.addLayer({ id: "aor-v3-selected-fill", type: "fill", source: "aor-v3-countries", "source-layer": "administrative", filter: EMPTY_COUNTRY_FILTER, paint: { "fill-color": "#48e6d3", "fill-opacity": 0.18 } });
          map.addLayer({ id: "aor-v3-selected-line", type: "line", source: "aor-v3-countries", "source-layer": "administrative", filter: EMPTY_COUNTRY_FILTER, paint: { "line-color": "#e8ffff", "line-width": 2.8, "line-opacity": 0.95 } });
          map.addLayer({ id: "aor-v3-country-hit", type: "fill", source: "aor-v3-countries", "source-layer": "administrative", filter: ["==", "level", 0], paint: { "fill-color": "#ffffff", "fill-opacity": 0.001 } });
          map.addSource("aor-v3-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "aor-v3-event-glow", type: "circle", source: "aor-v3-events", paint: { "circle-radius": 10, "circle-color": ["match", ["get", "kind"], "GDACS", "#a78bfa", "#67e8f9"], "circle-opacity": 0.16 } });
          map.addLayer({ id: "aor-v3-event-points", type: "circle", source: "aor-v3-events", paint: { "circle-radius": ["match", ["get", "kind"], "GDACS", 5.5, 4.5], "circle-color": ["match", ["get", "kind"], "GDACS", "#a78bfa", "#67e8f9"], "circle-stroke-color": "#ecfeff", "circle-stroke-width": 1.1, "circle-opacity": 0.96 } });
          setMapLayersRevision((value) => value + 1);
          map.on("mousemove", "aor-v3-country-hit", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "aor-v3-country-hit", () => { map.getCanvas().style.cursor = ""; });
          map.on("click", "aor-v3-country-hit", (event: any) => {
            const feature = event.features?.[0];
            const properties = feature?.properties || {};
            const iso2 = String(properties.iso_a2 || "").toUpperCase();
            const name = String(properties["name:en"] || properties.name || properties.name_en || iso2 || "Selected country");
            const mapped = COMMAND_BY_COUNTRY.get(iso2);
            if (modeRef.current === "aor") {
              if (mapped) setCommand(mapped.id);
              return;
            }
            if (mapped) setCommand(mapped.id);
            setSelectedCountry({ name, iso2, bbox: geometryBbox(feature?.geometry) });
            setCountryQuery(name);
          });
        };
        map.on("load", attachLayers);
        map.on("ready", attachLayers);
        map.on("idle", markReady);
        map.on("error", (event: any) => { if (!cancelled) { setMapStatus("error"); setMapError(event?.error?.message || "MapTiler resource failed."); } });
        readinessTimer = window.setTimeout(() => {
          if (cancelled) return;
          const canvas = map.getCanvas?.();
          if (!canvas || canvas.width < 50 || canvas.height < 50 || !map.areTilesLoaded?.()) { setMapStatus("error"); setMapError((current) => current || "MapTiler initialized, but the basemap tiles did not finish rendering."); }
          else markReady();
        }, 15_000);
      } catch (reason) {
        if (!cancelled) { setMapStatus("error"); setMapError(errorMessage(reason)); }
      }
    })();
    return () => { cancelled = true; if (readinessTimer) window.clearTimeout(readinessTimer); mapRef.current?.remove?.(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    COMMANDS.forEach((item) => {
      const selected = item.id === command;
      if (map.getLayer?.(`aor-v3-fill-${item.id}`)) map.setPaintProperty(`aor-v3-fill-${item.id}`, "fill-opacity", mapMode === "aor" ? (selected ? 0.16 : 0.045) : 0);
      if (map.getLayer?.(`aor-v3-line-${item.id}`)) map.setPaintProperty(`aor-v3-line-${item.id}`, "line-opacity", mapMode === "aor" ? (selected ? 0.95 : 0.25) : 0);
    });
    if (mapMode === "aor") map.easeTo?.({ center: selectedCommand.center, zoom: selectedCommand.zoom, duration: 650 });
  }, [command, mapLayersRevision, mapMode, selectedCommand]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer?.("aor-v3-selected-fill")) return;
    const filter = mapMode === "country" && selectedCountry?.iso2 ? countryFilter([selectedCountry.iso2]) : EMPTY_COUNTRY_FILTER;
    map.setFilter("aor-v3-selected-fill", filter);
    map.setFilter("aor-v3-selected-line", filter);
  }, [mapLayersRevision, mapMode, selectedCountry]);

  const advisory = countrySources.travel.data?.advisory;
  const travelHealth = countrySources.health.data;
  const countryWho = selectedCountry ? (countrySources.who.data?.outbreaks || []).slice(0, 8) : [];
  const countryGdacs = selectedCountry ? (countrySources.gdacs.data?.events || []).slice(0, 8) : [];
  const countryQuakes = selectedCountry ? (countrySources.usgs.data?.earthquakes || []).slice(0, 8) : [];
  const crisisUpdates = selectedCountry ? (countrySources.crisiswatch.data?.updates || []).slice(0, 8) : [];
  const vaccines = (travelHealth?.vaccines || []).slice(0, 10);
  const diseases = (travelHealth?.diseases || []).slice(0, 12);

  const displayOutbreaks = selectedCountry ? countryWho : mapMode === "aor" ? (data?.outbreaks || []).slice(0, 8) : (globalWatch?.outbreaks || []).slice(0, 8);
  const displayDisasters = selectedCountry ? countryGdacs : mapMode === "aor" ? (data?.disasters || []).slice(0, 8) : (globalWatch?.disasters || []).slice(0, 8);
  const displayQuakes = selectedCountry ? countryQuakes : mapMode === "aor" ? (data?.earthquakes || []).slice(0, 8) : (globalWatch?.earthquakes || []).slice(0, 8);

  const prioritySignals = useMemo(() => buildAorPrioritySignals({
    advisory: selectedCountry ? advisory : undefined,
    outbreaks: displayOutbreaks,
    disasters: displayDisasters,
    earthquakes: displayQuakes,
    crisisUpdates: selectedCountry ? crisisUpdates.filter((item: any) => item.matchedCountry !== false) : [],
    healthNotices: selectedCountry ? (travelHealth?.notices || []) : [],
    environmentLabels: selectedEnvironment.map((key) => ENVIRONMENT_LABELS[key]),
  }), [advisory, crisisUpdates, displayDisasters, displayOutbreaks, displayQuakes, selectedCountry, selectedEnvironment, travelHealth?.notices]);

  const eventGeoJson = useMemo(() => {
    const features: any[] = [];
    displayDisasters.forEach((item: any) => {
      const lat = Number(item.latitude ?? item.lat); const lng = Number(item.longitude ?? item.lon ?? item.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { kind: "GDACS", title: item.name || item.title || "GDACS event", url: item.sourceUrl || item.url || "" } });
    });
    displayQuakes.forEach((item: any) => {
      const lat = Number(item.latitude); const lng = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { kind: "USGS", title: item.title || "Earthquake", url: item.url || "" } });
    });
    return { type: "FeatureCollection", features };
  }, [displayDisasters, displayQuakes]);

  useEffect(() => { mapRef.current?.getSource?.("aor-v3-events")?.setData?.(eventGeoJson); }, [eventGeoJson, mapLayersRevision]);

  async function resolveCountrySearch() {
    const query = countryQuery.trim();
    if (!query) return;
    setCountrySearchLoading(true); setError("");
    try {
      if (!mapKeyRef.current) throw new Error("MapTiler is not ready yet.");
      const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(mapKeyRef.current)}&types=country&limit=1`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`MapTiler geocoding returned ${response.status}.`);
      const payload = await response.json();
      const feature = payload?.features?.[0];
      if (!feature) throw new Error(`No country match found for “${query}”.`);
      const name = String(feature.text || feature.place_name || query).split(",")[0].trim() || query;
      const propertyCode = String(feature.properties?.country_code || feature.properties?.iso_a2 || "").toUpperCase();
      const idCode = String(feature.id || "").startsWith("country.") ? String(feature.id).split(".").pop()?.toUpperCase() || "" : "";
      const iso2 = propertyCode || idCode;
      const center = Array.isArray(feature.center) && feature.center.length >= 2 ? [Number(feature.center[0]), Number(feature.center[1])] as [number, number] : undefined;
      const bbox = Array.isArray(feature.bbox) && feature.bbox.length >= 4 ? feature.bbox.slice(0, 4).map(Number) as [number, number, number, number] : undefined;
      const mapped = COMMAND_BY_COUNTRY.get(iso2);
      if (mapped) setCommand(mapped.id);
      setSelectedCountry({ name, iso2, center, bbox });
      setCountryQuery(name);
      if (bbox && bbox.every(Number.isFinite)) mapRef.current?.fitBounds?.([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 50, maxZoom: 5, duration: 650 });
      else if (center) mapRef.current?.easeTo?.({ center, zoom: 4, duration: 650 });
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setCountrySearchLoading(false); }
  }

  function switchMode(mode: MapMode) {
    setMapMode(mode); setError("");
    if (mode === "aor") { setSelectedCountry(null); setCountryQuery(""); }
    else { setSelectedCountry(null); setCountryQuery(""); mapRef.current?.easeTo?.({ center: [18, 18], zoom: 1.15, duration: 650 }); }
  }

  function sourceState(source: SourceResult) { return source.loading ? { status: "loading" as const, note: "Loading" } : source.error ? { status: "warn" as const, note: source.error } : source.data ? { status: "ok" as const, note: "Loaded" } : { status: "loading" as const, note: "Select a country" }; }
  const sourceHealth = new Map((data?.sourceHealth || []).map((item) => [item.provider, item]));
  const priorityLoading = selectedCountry ? Object.values(countrySources).some((source) => source.loading) : mapMode === "aor" ? loading : globalWatchLoading;
  const priorityError = selectedCountry ? "" : mapMode === "aor" ? error : globalWatchError;

  return <main className="min-h-screen bg-[#05080c] pb-20 text-white">
    <Sidebar />
    <section className="px-4 py-6 pt-24 lg:ml-[210px] lg:px-6 lg:pt-6 xl:px-8">
      <HeaderBar eyebrow="Operational / Environmental Intelligence" title="AOR Factors" subtitle="Map-first travel-health and operating-environment intelligence. Country mode is destination-specific; AOR mode is command-wide. No generic war-intelligence layer is mixed into this workspace." />

      <div className="mt-5 grid min-h-[760px] overflow-hidden border border-white/10 bg-[#070b10] xl:grid-cols-[238px_minmax(0,1fr)_360px]">
        <aside className="border-r border-white/10 bg-[#080c12]" aria-label="AOR scope and layer controls">
          <RailSection label="Scope">
            <div className="grid gap-2">
              <button type="button" aria-pressed={mapMode === "country"} onClick={() => switchMode("country")} className={`min-h-12 border px-3 text-left ${mapMode === "country" ? "border-cyan-200/25 bg-cyan-300/[.07]" : "border-white/8 bg-black/10"}`}><div className="flex items-center gap-2"><Globe2 size={14} /><strong className="text-[11px]">Country mode</strong></div><p className="mt-1 text-[9px] leading-4 text-slate-500">Destination-specific health and travel evidence.</p></button>
              <button type="button" aria-pressed={mapMode === "aor"} onClick={() => switchMode("aor")} className={`min-h-12 border px-3 text-left ${mapMode === "aor" ? "border-violet-200/25 bg-violet-300/[.07]" : "border-white/8 bg-black/10"}`}><div className="flex items-center gap-2"><MapPinned size={14} /><strong className="text-[11px]">AOR mode</strong></div><p className="mt-1 text-[9px] leading-4 text-slate-500">Command-wide outbreak, disaster and seismic context.</p></button>
            </div>
          </RailSection>

          {mapMode === "country" ? <RailSection label="Destination">
            <label className="flex min-h-10 items-center gap-2 border border-white/10 bg-black/20 px-2.5"><Search size={13} className="text-slate-500" /><input value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void resolveCountrySearch(); }} placeholder="Search or click a country" className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-600" /></label>
            <button type="button" onClick={() => void resolveCountrySearch()} disabled={!countryQuery.trim() || countrySearchLoading} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 border border-cyan-200/20 bg-cyan-300/[.07] text-[10px] font-black disabled:opacity-40">{countrySearchLoading ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}Load country</button>
          </RailSection> : <RailSection label="Combatant command">
            <div className="space-y-1">{COMMANDS.map((item) => <button key={item.id} type="button" onClick={() => setCommand(item.id)} className={`w-full border px-2.5 py-2 text-left text-[10px] font-bold ${command === item.id ? "border-violet-200/22 bg-violet-300/[.07] text-white" : "border-transparent text-slate-500 hover:bg-white/[.02] hover:text-slate-200"}`}>{item.label}</button>)}</div>
            <p className="mt-3 text-[8px] leading-4 text-slate-600">Registry reviewed {AOR_REGISTRY_REVIEWED_AT}.</p>
          </RailSection>}

          <RailSection label="Work conditions">
            <div className="space-y-1">{(Object.keys(ENVIRONMENT_LABELS) as EnvironmentKey[]).map((key) => <button key={key} type="button" aria-pressed={environment[key]} onClick={() => setEnvironment((current) => ({ ...current, [key]: !current[key] }))} className={`w-full border px-2.5 py-2 text-left text-[9px] font-bold ${environment[key] ? "border-amber-200/20 bg-amber-300/[.06] text-amber-50" : "border-transparent text-slate-500 hover:bg-white/[.02]"}`}>{ENVIRONMENT_LABELS[key]}</button>)}</div>
          </RailSection>

          <RailSection label="Source health">
            <SourceRow label="MapTiler" status={mapStatus === "ready" ? "ok" : mapStatus === "error" ? "warn" : "loading"} note={mapStatus === "ready" ? "Bright Dark vector tiles rendered" : mapStatus === "error" ? mapError : "Rendering vector tiles"} />
            {mapMode === "country" ? <>{(["travel", "health", "who", "gdacs", "usgs", "crisiswatch"] as const).map((key) => { const label = { travel: "State Travel", health: "CDC Travel Health", who: "WHO", gdacs: "GDACS", usgs: "USGS", crisiswatch: "CrisisWatch" }[key]; const state = sourceState(countrySources[key]); return <SourceRow key={key} label={label} status={state.status} note={state.note} />; })}</> : <>{["WHO Disease Outbreak News", "GDACS", "USGS Earthquake Catalog"].map((provider) => { const source = sourceHealth.get(provider); return <SourceRow key={provider} label={provider.replace(" Disease Outbreak News", "").replace(" Earthquake Catalog", "")} status={loading ? "loading" : source?.ok ? "ok" : "warn"} note={loading ? "Refreshing" : source?.ok ? `${source.count} AOR matches` : source?.error || "Unavailable"} />; })}</>}
          </RailSection>
        </aside>

        <div className="min-w-0 bg-[#03070b]">
          <div className="flex min-h-[74px] items-start justify-between gap-4 border-b border-white/10 px-4 py-3">
            <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-600">{mapMode === "country" ? "Destination operating picture" : "Command operating picture"}</p><h2 className="mt-1 text-lg font-black text-white">{contextLabel}</h2><p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-500">{selectedCountry ? `${selectedCountry.name} drives country-specific travel, health, outbreak, disaster, seismic and environmental evidence.${mappedCountryCommand ? ` Assigned command: ${mappedCountryCommand.label}.` : ""}` : mapMode === "aor" ? selectedCommand.scope : "Global watch is visible immediately. Search or click a country when you need destination-specific evidence."}</p></div>
            <span className="shrink-0 border border-white/10 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-slate-500">{mapMode === "country" ? "Country" : "AOR"}</span>
          </div>
          <div className="relative h-[650px] min-h-[650px]" data-testid="aor-map-shell">
            <div ref={mapHostRef} className="aor-map-tiler-host absolute inset-0" aria-label="Interactive MapTiler AOR intelligence map" />
            <AorEpidemicOverlay map={mapRef.current} mapStatus={mapStatus} selectedCountry={selectedCountry} travelHealth={travelHealth} />
            {mapStatus !== "ready" ? <div className="absolute inset-0 z-20 grid place-items-center bg-[#03070b]/82 p-6 text-center backdrop-blur-sm">{mapStatus === "loading" ? <div><Loader2 className="mx-auto animate-spin text-cyan-200/70" size={24} /><p className="mt-3 text-xs text-slate-500">Rendering MapTiler Bright Dark vector tiles…</p></div> : <div><AlertTriangle className="mx-auto text-amber-200/70" size={24} /><p className="mt-3 text-sm font-black text-amber-50">Map rendering failed</p><p className="mt-2 max-w-lg text-[10px] leading-5 text-amber-100/55">{mapError}</p></div>}</div> : null}
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 border border-white/10 bg-[#05080c]/88 px-3 py-2 text-[8px] font-bold uppercase tracking-[.1em] text-slate-500 backdrop-blur-xl"><span className="mr-3 inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-violet-300" />GDACS</span><span className="mr-3 inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-cyan-300" />USGS</span>{mapMode === "country" ? "Click country for destination intelligence" : "Click country to resolve command"}</div>
          </div>
          <div className="border-t border-white/10 p-4"><AorPriorityBrief context={contextLabel} signals={prioritySignals} loading={priorityLoading} error={priorityError} /></div>
        </div>

        <aside className="max-h-[900px] overflow-y-auto border-l border-white/10 bg-[#080c12] p-4" aria-label="Map-linked intelligence inspector">
          <div className="flex items-start justify-between gap-3 pb-4"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-600">Map-linked intelligence inspector</p><h2 className="mt-1 text-lg font-black">{contextLabel}</h2><p className="mt-1 text-[10px] leading-4 text-slate-500">{selectedCountry ? `Country-only intelligence for ${selectedCountry.name}.` : mapMode === "aor" ? `Command-wide intelligence for ${selectedCommand.label}.` : "Global watch is loaded by default; choose a country for destination detail."}</p></div><Layers3 size={17} className="text-cyan-200/45" /></div>
          {error || globalWatchError ? <div className="mb-3 border border-amber-200/15 bg-amber-300/[.035] p-3 text-[10px] leading-5 text-amber-100/65"><AlertTriangle size={12} className="mr-1.5 inline" />{error || globalWatchError}</div> : null}

          <InspectorSection title="Operational watch" icon={<ShieldAlert size={14} />}>
            {selectedCountry && advisory ? <IntelRow title={`Level ${advisory.level ?? "—"} · ${advisory.levelLabel || "Travel advisory"}`} summary={advisory.summary || advisory.message} href={advisory.sourceUrl || advisory.url} /> : null}
            {displayDisasters.length ? displayDisasters.map((item: any, index: number) => <IntelRow key={`dis-${index}`} title={`${item.alertLevel ? `${item.alertLevel} · ` : ""}${item.name || item.title || "GDACS event"}`} meta={[item.country, formatDate(item.fromDate || item.date)].filter(Boolean).join(" · ")} summary={item.description || item.summary} href={item.sourceUrl || item.url} />) : selectedCountry && !countrySources.gdacs.loading && !countrySources.gdacs.error ? <p className="py-2 text-[10px] leading-4 text-slate-500">No GDACS event whose returned country metadata matches {selectedCountry.name}.</p> : null}
            {displayQuakes.length ? displayQuakes.map((item: any, index: number) => <IntelRow key={`quake-${index}`} title={item.title || `${item.magnitude ? `M${item.magnitude}` : "Earthquake"} · ${item.place || ""}`} meta={formatDate(item.occurredAt || item.time)} href={item.url || item.sourceUrl} />) : null}
          </InspectorSection>

          <InspectorSection title="Health & outbreak intelligence" icon={<HeartPulse size={14} />}>
            {displayOutbreaks.length ? displayOutbreaks.map((item: any, index: number) => <IntelRow key={`who-${index}`} title={item.title || item.name || "WHO outbreak"} meta={formatDate(item.publishedAt || item.publicationDate || item.date)} summary={item.summary || item.description} href={item.url || item.sourceUrl} />) : selectedCountry && !countrySources.who.loading && !countrySources.who.error ? <p className="py-2 text-[10px] leading-4 text-slate-500">WHO returned no text-matched outbreak item for {selectedCountry.name}; unrelated outbreaks are not substituted.</p> : null}
            {crisisUpdates.length ? crisisUpdates.map((item: any, index: number) => <IntelRow key={`crisis-${index}`} title={item.title || item.name || "CrisisWatch update"} meta={formatDate(item.date || item.publishedAt)} summary={item.summary || item.description} href={item.url || item.sourceUrl} />) : null}
          </InspectorSection>

          <InspectorSection title="Country health readiness" icon={<Syringe size={14} />}>
            {!selectedCountry ? <p className="text-[10px] leading-5 text-slate-500">Select a country to load its CDC travel-health profile.</p> : countrySources.health.loading ? <div className="flex items-center gap-2 py-3 text-[10px] text-slate-500"><Loader2 size={12} className="animate-spin" />Loading CDC destination guidance…</div> : countrySources.health.error ? <p className="text-[10px] leading-5 text-amber-100/60">{countrySources.health.error}</p> : <>
              <p className="text-[9px] leading-4 text-slate-600">Official CDC Travelers' Health destination guidance; not an individualized medical recommendation.</p>
              <div className="mt-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Vaccines & medicines</p>{vaccines.length ? vaccines.map((item: any) => <IntelRow key={item.name} title={item.name} meta={item.status === "not-routinely-recommended" ? "Not routine" : item.status} summary={item.recommendation} />) : <p className="py-2 text-[10px] text-slate-500">No vaccine rows parsed for this destination.</p>}</div>
              {travelHealth?.malaria ? <IntelRow title="Malaria prevention" summary={travelHealth.malaria.recommendation} /> : null}
              {travelHealth?.yellowFever ? <IntelRow title="Yellow fever" summary={travelHealth.yellowFever.recommendation} /> : null}
              {diseases.length ? <div className="mt-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Travel-relevant disease profile</p><div className="mt-2 flex flex-wrap gap-1.5">{diseases.map((item: any) => <span key={item.name} title={`${item.transmission || ""}${item.advice ? ` · ${item.advice}` : ""}`} className="border border-white/10 px-2 py-1 text-[9px] font-bold text-slate-300">{item.name}</span>)}</div></div> : null}
              {externalUrl(travelHealth?.sourceUrl) ? <a href={externalUrl(travelHealth.sourceUrl)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold text-cyan-200/60">Open CDC destination guidance<ArrowUpRight size={10} /></a> : null}
            </>}
          </InspectorSection>

          <InspectorSection title={`Work conditions for ${contextLabel}`} icon={<Activity size={14} />}>
            {selectedEnvironment.length ? selectedEnvironment.map((key) => <div key={key} className="border-b border-white/[.055] py-2 last:border-b-0"><p className="text-[10px] font-bold text-amber-100/70">{ENVIRONMENT_LABELS[key]}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{ENVIRONMENT_PROMPTS[key]}</p></div>) : <p className="text-[10px] leading-5 text-slate-500">Select only conditions actually present at the operating location. These remain separate evidence factors rather than a fabricated score.</p>}
          </InspectorSection>

          <InspectorSection title="Evidence boundary" icon={<ShieldCheck size={14} />}>
            <p className="text-[9px] leading-4 text-slate-600">Country mode never substitutes command-wide events when a destination feed is empty. AOR mode intentionally aggregates command-wide WHO, GDACS and USGS signals. Environmental factors are reviewer-entered context, not observed surveillance.</p>
          </InspectorSection>
        </aside>
      </div>
    </section>
  </main>;
}
