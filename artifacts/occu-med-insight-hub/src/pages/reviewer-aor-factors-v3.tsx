import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Crosshair,
  Globe2,
  HeartPulse,
  Loader2,
  MapPinned,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
  Syringe,
} from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { AorGlassSidebar, type AorSidebarTab } from "@/components/insight/AorGlassSidebar";
import { AorOrbOverlay } from "@/components/insight/AorOrbOverlay";
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
type ProjectionMode = "2d" | "3d";
type HealthTool = "travel" | "notices" | "respiratory" | "immunization" | "fungal" | "yellowbook" | "history";
type SelectedCountry = { name: string; iso2: string; center?: [number, number]; bbox?: [number, number, number, number] };
type SourceResult = { data: any; error: string; loading: boolean };
type CountrySources = { baseline: SourceResult; travel: SourceResult; who: SourceResult; gdacs: SourceResult; usgs: SourceResult; crisiswatch: SourceResult; health: SourceResult };
type EnvironmentKey = "heat" | "cold" | "altitude" | "poorAir" | "fatigue" | "ppe" | "night";
type AorResponse = { ok: boolean; command: CommandId; commandLabel: string; partial: boolean; sourceHealth: Array<{ provider: string; ok: boolean; count: number; error?: string }>; outbreaks: any[]; disasters: any[]; earthquakes: any[] };
type GlobalWatchResponse = { ok: boolean; partial: boolean; sourceHealth: Array<{ provider: string; ok: boolean; count: number; error?: string }>; outbreaks: any[]; disasters: any[]; earthquakes: any[] };
type BaselineSignal = { key: string; label: string; evidenceField: string; evidenceText: string };
type CountryBaselineResponse = {
  ok: boolean;
  profile: {
    country: string; iso2: string; iso3: string; aorRegion: string; unSubregion: string; capital: string;
    climateEnvironment: string; medicalAccess: string; securityAccess: string; travelHealthContext: string;
    escalationEvacuation: string; reviewWatchItems: string[]; medicalAccessTier: string;
  };
  baselineSignals: BaselineSignal[];
  source: { name: string; reviewedAt: string; profileType: "baseline"; coverage: number };
  limitation: string;
};
type ConditionLensResponse = { ok: boolean; classification: string; considerations: Array<{ ruleId: string; classification: string; summary: string; matchedTerms: string[]; countrySignals: string[]; evidenceField: string; evidenceText: string }> };

const ENVIRONMENT_LABELS: Record<EnvironmentKey, string> = {
  heat: "Heat exposure",
  cold: "Cold exposure",
  altitude: "Altitude",
  poorAir: "Poor air / dust",
  fatigue: "Fatigue / long shift",
  ppe: "PPE burden",
  night: "Night / circadian disruption",
};

function emptyResult(loading = false): SourceResult { return { data: null, error: "", loading }; }
function emptyCountrySources(loading = false): CountrySources { return { baseline: emptyResult(loading), travel: emptyResult(loading), who: emptyResult(loading), gdacs: emptyResult(loading), usgs: emptyResult(loading), crisiswatch: emptyResult(loading), health: emptyResult(loading) }; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Source request failed."; }
function formatDate(value?: string | null) { if (!value) return "Date unavailable"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
function externalUrl(value?: string) { if (!value) return ""; try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : ""; } catch { return ""; } }
async function loadJson(url: string) { const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" }); const payload = await response.json().catch(() => ({})); if (!response.ok && payload?.configured !== false) throw new Error(payload?.error || `Request failed (${response.status}).`); return payload; }
async function postJson(url: string, body: unknown) { const response = await fetch(url, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`); return payload; }

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
      window.setTimeout(() => window.maptilersdk && resolve(), 0);
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-b border-white/[.075] py-4 last:border-b-0"><p className="mb-2 text-[9px] font-black uppercase tracking-[.17em] text-slate-400/70">{title}</p>{children}</section>;
}

function SegmentedButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-9 rounded-[12px] border px-3 text-[9px] font-bold transition ${active ? "border-white/14 bg-white/[.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.06)]" : "border-white/[.06] bg-white/[.025] text-slate-400 hover:bg-white/[.05] hover:text-white"}`}>{children}</button>;
}

function IntelLine({ title, meta, summary, href }: { title: string; meta?: string; summary?: string; href?: string }) {
  const url = externalUrl(href);
  const content = <div className="py-2.5"><div className="flex items-start justify-between gap-3"><strong className="text-[10px] leading-4 text-white/78">{title}</strong>{url ? <ArrowUpRight size={10} className="mt-0.5 shrink-0 text-cyan-100/38" /> : null}</div>{meta ? <p className="mt-1 text-[8px] text-slate-500">{meta}</p> : null}{summary ? <p className="mt-1 text-[9px] leading-4 text-slate-400">{summary}</p> : null}</div>;
  return url ? <a href={url} target="_blank" rel="noreferrer" className="block border-b border-white/[.055] last:border-b-0 hover:bg-white/[.025]">{content}</a> : <div className="border-b border-white/[.055] last:border-b-0">{content}</div>;
}

export default function ReviewerAorFactorsV3Page() {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapKeyRef = useRef("");
  const modeRef = useRef<MapMode>("country");
  const [mapMode, setMapMode] = useState<MapMode>("country");
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>("3d");
  const [command, setCommand] = useState<CommandId>("centcom");
  const selectedCommand = COMMANDS.find((item) => item.id === command) ?? COMMANDS[0];
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
  const [condition, setCondition] = useState("");
  const [medication, setMedication] = useState("");
  const [workContext, setWorkContext] = useState("");
  const [conditionLens, setConditionLens] = useState<ConditionLensResponse | null>(null);
  const [conditionLensLoading, setConditionLensLoading] = useState(false);
  const [conditionLensError, setConditionLensError] = useState("");
  const [healthTool, setHealthTool] = useState<HealthTool>("travel");
  const [healthToolData, setHealthToolData] = useState<any>(null);
  const [healthToolError, setHealthToolError] = useState("");
  const [healthToolLoading, setHealthToolLoading] = useState(false);

  const mappedCountryCommand = selectedCountry?.iso2 ? COMMAND_BY_COUNTRY.get(selectedCountry.iso2) ?? null : null;
  const countryBaseline = countrySources.baseline.data as CountryBaselineResponse | null;
  const baselineSignals = countryBaseline?.baselineSignals || [];
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
    setConditionLens(null); setConditionLensError("");
    if (!selectedCountry) { setCountrySources(emptyCountrySources()); return; }
    let active = true;
    const name = selectedCountry.name;
    const encoded = encodeURIComponent(name);
    setCountrySources(emptyCountrySources(true));
    const entries: Array<[keyof CountrySources, string]> = [
      ["baseline", `/api/aor/country-profile?iso2=${encodeURIComponent(selectedCountry.iso2)}`],
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
    if (healthTool === "travel") { setHealthToolData(null); setHealthToolError(""); setHealthToolLoading(false); return; }
    let active = true;
    setHealthToolLoading(true); setHealthToolError(""); setHealthToolData(null);
    const urls: Record<Exclude<HealthTool, "travel">, string> = {
      notices: "/api/aor/travel-notices",
      respiratory: "/api/aor/respiratory-surveillance",
      immunization: "/api/aor/immunization?dataset=coverage",
      fungal: "/api/aor/fungal-burden?disease=cpa",
      yellowbook: "/api/aor/yellow-book",
      history: "/api/aor/epidemic-history",
    };
    loadJson(urls[healthTool])
      .then((payload) => { if (active) setHealthToolData(payload); })
      .catch((reason) => { if (active) setHealthToolError(errorMessage(reason)); })
      .finally(() => { if (active) setHealthToolLoading(false); });
    return () => { active = false; };
  }, [healthTool]);

  useEffect(() => {
    let cancelled = false;
    let readinessTimer = 0;
    (async () => {
      try {
        const config = await loadJson("/api/map-config");
        if (!config?.configured || !config?.apiKey) throw new Error("MapTiler is not configured on this service.");
        mapKeyRef.current = config.apiKey;
        const sdk = await loadMapTilerSdk();
        if (cancelled || !mapHostRef.current) return;
        sdk.config.apiKey = config.apiKey;
        const map = new sdk.Map({
          container: mapHostRef.current,
          style: sdk.MapStyle?.BRIGHT?.DARK || sdk.MapStyle?.STREETS?.DARK || "streets-v2-dark",
          center: [18, 18], zoom: 1.15, attributionControl: true,
          projection: "globe", halo: false, space: { color: "#01050a" },
        });
        mapRef.current = map;
        document.documentElement.dataset.aorProjectionMode = "3d";
        window.dispatchEvent(new CustomEvent("aor:projection-change", { detail: { mode: "3d", projection: "globe" } }));
        if (sdk.NavigationControl) map.addControl(new sdk.NavigationControl(), "bottom-right");
        let layersAttached = false;
        const markReady = () => { if (!cancelled) { setMapStatus("ready"); setMapError(""); } };
        const attachLayers = () => {
          if (cancelled || layersAttached) return;
          layersAttached = true;
          const sourceUrl = `${COUNTRY_SOURCE}?key=${encodeURIComponent(config.apiKey)}`;
          if (!map.getSource("aor-countries")) map.addSource("aor-countries", { type: "vector", url: sourceUrl });
          COMMANDS.forEach((item) => {
            map.addLayer({ id: `aor-v3-fill-${item.id}`, type: "fill", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(item.countries), paint: { "fill-color": item.color, "fill-opacity": 0 } });
            map.addLayer({ id: `aor-v3-line-${item.id}`, type: "line", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(item.countries), paint: { "line-color": item.color, "line-width": 1, "line-opacity": 0 } });
          });
          map.addLayer({ id: "aor-v3-selected-fill", type: "fill", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_COUNTRY_FILTER, paint: { "fill-color": "#48e6d3", "fill-opacity": 0.16 } });
          map.addLayer({ id: "aor-v3-selected-line", type: "line", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_COUNTRY_FILTER, paint: { "line-color": "#e8ffff", "line-width": 2.6, "line-opacity": 0.94 } });
          map.addLayer({ id: "aor-v3-country-hit", type: "fill", source: "aor-countries", "source-layer": "administrative", filter: ["==", "level", 0], paint: { "fill-color": "#ffffff", "fill-opacity": 0.001 } });
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
      if (map.getLayer?.(`aor-v3-fill-${item.id}`)) map.setPaintProperty(`aor-v3-fill-${item.id}`, "fill-opacity", mapMode === "aor" ? (selected ? 0.15 : 0.035) : 0);
      if (map.getLayer?.(`aor-v3-line-${item.id}`)) map.setPaintProperty(`aor-v3-line-${item.id}`, "line-opacity", mapMode === "aor" ? (selected ? 0.92 : 0.18) : 0);
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
  const countryWho = selectedCountry ? (countrySources.who.data?.outbreaks || []).slice(0, 10) : [];
  const countryGdacs = selectedCountry ? (countrySources.gdacs.data?.events || []).slice(0, 10) : [];
  const countryQuakes = selectedCountry ? (countrySources.usgs.data?.earthquakes || []).slice(0, 10) : [];
  const crisisUpdates = selectedCountry ? (countrySources.crisiswatch.data?.updates || []).slice(0, 10) : [];
  const displayOutbreaks = selectedCountry ? countryWho : mapMode === "aor" ? (data?.outbreaks || []).slice(0, 10) : (globalWatch?.outbreaks || []).slice(0, 10);
  const displayDisasters = selectedCountry ? countryGdacs : mapMode === "aor" ? (data?.disasters || []).slice(0, 10) : (globalWatch?.disasters || []).slice(0, 10);
  const displayQuakes = selectedCountry ? countryQuakes : mapMode === "aor" ? (data?.earthquakes || []).slice(0, 10) : (globalWatch?.earthquakes || []).slice(0, 10);

  const eventGeoJson = useMemo(() => {
    const features: any[] = [];
    displayDisasters.forEach((item: any) => {
      const lat = Number(item.latitude ?? item.lat); const lng = Number(item.longitude ?? item.lon ?? item.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { kind: "GDACS", title: item.name || item.title || "GDACS event" } });
    });
    displayQuakes.forEach((item: any) => {
      const lat = Number(item.latitude); const lng = Number(item.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { kind: "USGS", title: item.title || "Earthquake" } });
    });
    return { type: "FeatureCollection", features };
  }, [displayDisasters, displayQuakes]);

  useEffect(() => { mapRef.current?.getSource?.("aor-v3-events")?.setData?.(eventGeoJson); }, [eventGeoJson, mapLayersRevision]);

  function setProjection(mode: ProjectionMode) {
    const map = mapRef.current;
    const projection = mode === "3d" ? "globe" : "mercator";
    setProjectionMode(mode);
    map?.setProjection?.(projection);
    map?.easeTo?.({ pitch: mode === "3d" ? 18 : 0, bearing: 0, duration: 650 });
    document.documentElement.dataset.aorProjectionMode = mode;
    window.dispatchEvent(new CustomEvent("aor:projection-change", { detail: { mode, projection } }));
    window.setTimeout(() => map?.resize?.(), 0);
  }

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
      const name = String(feature.text || feature.place_name || query);
      const iso2 = String(feature.properties?.short_code || feature.properties?.country_code || feature.id?.split(".")?.pop() || "").replace(/^country\./, "").toUpperCase();
      if (!/^[A-Z]{2}$/.test(iso2)) throw new Error("MapTiler did not return an ISO2 country code.");
      const bbox = Array.isArray(feature.bbox) && feature.bbox.length === 4 ? feature.bbox.map(Number) as [number, number, number, number] : undefined;
      const center = Array.isArray(feature.center) && feature.center.length >= 2 ? [Number(feature.center[0]), Number(feature.center[1])] as [number, number] : undefined;
      setSelectedCountry({ name, iso2, bbox, center });
      setCountryQuery(name);
      const mapped = COMMAND_BY_COUNTRY.get(iso2); if (mapped) setCommand(mapped.id);
      if (bbox && bbox.every(Number.isFinite)) mapRef.current?.fitBounds?.([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 50, maxZoom: 5, duration: 650 });
      else if (center) mapRef.current?.easeTo?.({ center, zoom: 4, duration: 650 });
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setCountrySearchLoading(false); }
  }

  async function evaluateConditionContext() {
    if (!selectedCountry || (!condition.trim() && !medication.trim() && !workContext.trim())) return;
    setConditionLensLoading(true); setConditionLensError("");
    try {
      const payload = await postJson("/api/aor/country-condition-lens", { iso2: selectedCountry.iso2, condition: condition.trim(), medication: medication.trim(), workContext: workContext.trim() });
      setConditionLens(payload as ConditionLensResponse);
    } catch (reason) { setConditionLens(null); setConditionLensError(errorMessage(reason)); }
    finally { setConditionLensLoading(false); }
  }

  function switchMode(mode: MapMode) {
    setMapMode(mode); setError(""); setSelectedCountry(null); setCountryQuery("");
    if (mode === "country") mapRef.current?.easeTo?.({ center: [18, 18], zoom: 1.15, duration: 650 });
  }

  const healthTabs: Array<[HealthTool, string]> = [["travel", "Travel"], ["notices", "Notices"], ["respiratory", "Respiratory"], ["immunization", "Immunization"], ["fungal", "Fungal"], ["yellowbook", "Yellow Book"], ["history", "History"]];

  const explorePane = <div>
    <Section title="Scope">
      <div className="grid grid-cols-2 gap-2"><SegmentedButton active={mapMode === "country"} onClick={() => switchMode("country")}><span className="inline-flex items-center gap-1.5"><Globe2 size={12} />Country</span></SegmentedButton><SegmentedButton active={mapMode === "aor"} onClick={() => switchMode("aor")}><span className="inline-flex items-center gap-1.5"><MapPinned size={12} />AOR</span></SegmentedButton></div>
    </Section>
    <Section title="View">
      <div className="grid grid-cols-2 gap-2"><SegmentedButton active={projectionMode === "3d"} onClick={() => setProjection("3d")}>3D Globe</SegmentedButton><SegmentedButton active={projectionMode === "2d"} onClick={() => setProjection("2d")}>2D Flat</SegmentedButton></div>
    </Section>
    {mapMode === "country" ? <Section title="Destination">
      <div className="flex items-center gap-2 rounded-[14px] border border-white/[.08] bg-black/20 px-3"><Search size={13} className="text-slate-500" /><input value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void resolveCountrySearch(); }} placeholder="Search or click a country" className="min-h-10 min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-slate-600" /></div>
      <button type="button" onClick={() => void resolveCountrySearch()} disabled={!countryQuery.trim() || countrySearchLoading} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-[12px] border border-cyan-100/12 bg-cyan-200/[.055] text-[9px] font-black text-cyan-50/75 disabled:opacity-35">{countrySearchLoading ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}Load country</button>
      {selectedCountry ? <p className="mt-3 text-[9px] leading-4 text-slate-400">Selected: <b className="text-white/80">{selectedCountry.name}</b>{mappedCountryCommand ? ` · ${mappedCountryCommand.label}` : ""}</p> : null}
    </Section> : <Section title="Combatant command">
      <div className="grid grid-cols-2 gap-1.5">{COMMANDS.map((item) => <button key={item.id} type="button" onClick={() => setCommand(item.id)} className={`min-h-9 rounded-[11px] border px-2 text-left text-[8px] font-bold transition ${command === item.id ? "border-violet-100/18 bg-violet-200/[.07] text-white" : "border-white/[.05] bg-white/[.02] text-slate-400 hover:bg-white/[.045]"}`}>{item.label}</button>)}</div><p className="mt-3 text-[8px] text-slate-600">Registry reviewed {AOR_REGISTRY_REVIEWED_AT}.</p>
    </Section>}
    {(error || globalWatchError) ? <p className="mt-3 text-[9px] leading-4 text-amber-100/60"><AlertTriangle size={11} className="mr-1 inline" />{error || globalWatchError}</p> : null}
  </div>;

  const healthPane = <div>
    <Section title="Health intelligence">
      <div className="flex flex-wrap gap-1.5">{healthTabs.map(([id, label]) => <button key={id} type="button" onClick={() => setHealthTool(id)} className={`rounded-full border px-2.5 py-1.5 text-[8px] font-bold transition ${healthTool === id ? "border-cyan-100/18 bg-cyan-200/[.08] text-white" : "border-white/[.06] bg-white/[.02] text-slate-400"}`}>{label}</button>)}</div>
    </Section>
    {healthTool === "travel" ? <>
      <Section title="CDC Travelers' Health">
        {!selectedCountry ? <p className="text-[9px] leading-4 text-slate-500">Select a country to load destination-specific vaccine and disease guidance.</p> : countrySources.health.loading ? <p className="inline-flex items-center gap-2 text-[9px] text-slate-400"><Loader2 size={11} className="animate-spin" />Loading destination guidance…</p> : countrySources.health.error ? <p className="text-[9px] text-amber-100/60">{countrySources.health.error}</p> : <div>{(travelHealth?.vaccines || []).slice(0, 8).map((item: any) => <IntelLine key={item.name} title={item.name} summary={item.recommendation} />)}{(travelHealth?.diseases || []).slice(0, 8).map((item: any) => <IntelLine key={item.name} title={item.name} meta={item.transmission} summary={item.advice} />)}</div>}
      </Section>
    </> : <Section title={healthTabs.find(([id]) => id === healthTool)?.[1] || "Health tool"}>
      {healthToolLoading ? <p className="inline-flex items-center gap-2 text-[9px] text-slate-400"><Loader2 size={11} className="animate-spin" />Loading source…</p> : healthToolError ? <p className="text-[9px] leading-4 text-amber-100/60">{healthToolError}</p> : healthTool === "notices" ? <div>{(healthToolData?.notices || []).slice(0, 14).map((item: any, index: number) => <IntelLine key={item.url || index} title={item.title || `Notice ${index + 1}`} meta={item.levelLabel || item.date} summary={item.summary} href={item.url} />)}</div> : healthTool === "respiratory" ? <div className="space-y-2 text-[9px] leading-4 text-slate-400"><p>Latest ARI: <b className="text-white/75">{healthToolData?.ari?.latestDate || "—"}</b></p><p>Latest Rt model: <b className="text-white/75">{healthToolData?.rt?.latestModelRun || healthToolData?.rt?.latestDate || "—"}</b></p><p>Latest ED feed: <b className="text-white/75">{healthToolData?.ed?.latestDate || "—"}</b></p><p>Latest wastewater: <b className="text-white/75">{healthToolData?.wastewater?.latestDate || "—"}</b></p>{healthToolData?.limitation ? <p className="text-slate-500">{healthToolData.limitation}</p> : null}</div> : healthTool === "immunization" ? <div className="space-y-2 text-[9px] leading-4 text-slate-400"><p>Dataset: <b className="text-white/75">{healthToolData?.dataset || "coverage"}</b></p><p>Rows: <b className="text-white/75">{healthToolData?.rows?.length ?? 0}</b></p><p>Metric: <b className="text-white/75">{healthToolData?.selected?.item || "—"}</b></p><p>Year: <b className="text-white/75">{healthToolData?.selected?.year || "—"}</b></p>{selectedCountry ? <p>{selectedCountry.name}: <b className="text-white/75">{healthToolData?.rows?.find((row: any) => row.iso2?.toUpperCase() === selectedCountry.iso2)?.value ?? "No matched row"}</b></p> : null}</div> : healthTool === "fungal" ? <div className="space-y-2 text-[9px] leading-4 text-slate-400"><p><b className="text-white/75">{healthToolData?.disease?.title || "Fungal burden"}</b></p><p>{healthToolData?.publicationYear || 2017} publication · modeled historical estimate</p>{selectedCountry ? <p>{selectedCountry.name}: <b className="text-white/75">{healthToolData?.rows?.find((row: any) => row.iso2?.toUpperCase() === selectedCountry.iso2)?.ratePer100k ?? "No published estimate"}</b></p> : null}{healthToolData?.limitation ? <p className="text-slate-500">{healthToolData.limitation}</p> : null}</div> : healthTool === "yellowbook" ? <div className="space-y-2 text-[9px] leading-4 text-slate-400"><p>CDC Yellow Book {healthToolData?.source?.edition || 2026}</p><p>Indexed disease chapters: <b className="text-white/75">{healthToolData?.source?.diseaseChapters ?? healthToolData?.profiles?.length ?? 0}</b></p><p>Structured assets: <b className="text-white/75">{healthToolData?.source?.structuredAssets ?? "—"}</b></p></div> : <div className="space-y-2 text-[9px] leading-4 text-slate-400"><p>Historical country rows: <b className="text-white/75">{healthToolData?.rows?.length ?? 0}</b></p><p>Diseases indexed: <b className="text-white/75">{healthToolData?.diseases?.length ?? 0}</b></p><p>{healthToolData?.methodology?.limitation || "Historical occurrence context; occurrence is not severity."}</p></div>}
    </Section>}
  </div>;

  const conditionsPane = <div>
    <Section title="Work conditions">
      <div className="grid grid-cols-2 gap-1.5">{(Object.keys(ENVIRONMENT_LABELS) as EnvironmentKey[]).map((key) => <button key={key} type="button" aria-pressed={environment[key]} onClick={() => setEnvironment((current) => ({ ...current, [key]: !current[key] }))} className={`min-h-10 rounded-[11px] border px-2 text-left text-[8px] font-bold transition ${environment[key] ? "border-amber-100/18 bg-amber-200/[.07] text-amber-50" : "border-white/[.05] bg-white/[.02] text-slate-400 hover:bg-white/[.045]"}`}>{ENVIRONMENT_LABELS[key]}</button>)}</div>
      <p className="mt-3 text-[8px] leading-4 text-slate-500">Reviewer-entered factors remain separate from country baseline signals. No automatic fit/unfit determination is made.</p>
    </Section>
    <Section title="Medical condition × deployment context">
      {!selectedCountry ? <p className="text-[9px] leading-4 text-slate-500">Select a country first.</p> : <><input value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="Condition" className="mb-2 min-h-9 w-full rounded-[11px] border border-white/[.07] bg-black/20 px-3 text-[9px] text-white outline-none placeholder:text-slate-600" /><input value={medication} onChange={(event) => setMedication(event.target.value)} placeholder="Medication / treatment" className="mb-2 min-h-9 w-full rounded-[11px] border border-white/[.07] bg-black/20 px-3 text-[9px] text-white outline-none placeholder:text-slate-600" /><textarea value={workContext} onChange={(event) => setWorkContext(event.target.value)} placeholder="Work / site context" rows={3} className="w-full resize-none rounded-[11px] border border-white/[.07] bg-black/20 px-3 py-2 text-[9px] text-white outline-none placeholder:text-slate-600" /><button type="button" onClick={() => void evaluateConditionContext()} disabled={conditionLensLoading || (!condition.trim() && !medication.trim() && !workContext.trim())} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-[11px] border border-violet-100/13 bg-violet-200/[.065] text-[9px] font-black text-white/80 disabled:opacity-35">{conditionLensLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}Evaluate context</button>{conditionLensError ? <p className="mt-2 text-[9px] text-amber-100/60">{conditionLensError}</p> : null}{conditionLens?.considerations?.length ? <div className="mt-3">{conditionLens.considerations.map((item) => <IntelLine key={item.ruleId} title={item.classification} summary={`${item.summary} ${item.evidenceText}`} />)}</div> : null}</>}
    </Section>
  </div>;

  const intelPane = <div>
    <Section title="Operational watch">
      {(globalWatchLoading || loading) ? <p className="inline-flex items-center gap-2 text-[9px] text-slate-400"><Loader2 size={11} className="animate-spin" />Refreshing live feeds…</p> : null}
      {displayOutbreaks.map((item: any, index: number) => <IntelLine key={item.id || item.url || `o-${index}`} title={item.title || item.name || "Outbreak"} meta={formatDate(item.publishedAt || item.publicationDate)} summary={item.summary} href={item.url || item.sourceUrl} />)}
      {displayDisasters.map((item: any, index: number) => <IntelLine key={item.eventId || item.id || `d-${index}`} title={item.name || item.title || "GDACS event"} meta={item.alertLevel ? `GDACS · ${item.alertLevel}` : "GDACS"} summary={item.country} href={item.sourceUrl || item.url} />)}
      {displayQuakes.map((item: any, index: number) => <IntelLine key={item.id || `q-${index}`} title={item.title || item.place || "Earthquake"} meta={item.magnitude != null ? `USGS · M${item.magnitude}` : "USGS"} summary={item.place} href={item.url} />)}
      {selectedCountry ? crisisUpdates.map((item: any, index: number) => <IntelLine key={item.url || `c-${index}`} title={item.title || "CrisisWatch update"} meta="CrisisWatch" summary={item.summary} href={item.url} />) : null}
      {!displayOutbreaks.length && !displayDisasters.length && !displayQuakes.length && !loading && !globalWatchLoading ? <p className="text-[9px] leading-4 text-slate-500">No current matched events in this view.</p> : null}
    </Section>
  </div>;

  const infoPane = <div>
    <Section title="Country baseline">
      {!selectedCountry ? <p className="text-[9px] leading-4 text-slate-500">Select a country to load the reviewed 197-country baseline profile.</p> : countrySources.baseline.loading ? <p className="inline-flex items-center gap-2 text-[9px] text-slate-400"><Loader2 size={11} className="animate-spin" />Loading baseline…</p> : countrySources.baseline.error ? <p className="text-[9px] text-amber-100/60">{countrySources.baseline.error}</p> : countryBaseline?.profile ? <div>
        <IntelLine title={`${countryBaseline.profile.aorRegion} · ${countryBaseline.profile.unSubregion}`} meta={`Capital: ${countryBaseline.profile.capital} · Medical access: ${countryBaseline.profile.medicalAccessTier}`} />
        <IntelLine title="Climate / environment" summary={countryBaseline.profile.climateEnvironment} />
        <IntelLine title="Medical access" summary={countryBaseline.profile.medicalAccess} />
        <IntelLine title="Security / access" summary={countryBaseline.profile.securityAccess} />
        <IntelLine title="Travel-health context" summary={countryBaseline.profile.travelHealthContext} />
        <IntelLine title="Escalation / evacuation" summary={countryBaseline.profile.escalationEvacuation} />
        {countryBaseline.profile.reviewWatchItems?.length ? <div className="mt-2 flex flex-wrap gap-1">{countryBaseline.profile.reviewWatchItems.map((item) => <span key={item} className="rounded-full border border-white/[.07] bg-white/[.025] px-2 py-1 text-[8px] text-slate-400">{item}</span>)}</div> : null}
        {baselineSignals.length ? <details className="mt-3 border-t border-white/[.06] pt-3"><summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.13em] text-cyan-100/45">Evidence-backed baseline signals</summary><div className="mt-2">{baselineSignals.map((signal) => <IntelLine key={signal.key} title={signal.label} meta={signal.evidenceField} summary={signal.evidenceText} />)}</div></details> : null}
        <p className="mt-3 text-[8px] leading-4 text-slate-600">Reviewed {countryBaseline.source.reviewedAt} · {countryBaseline.source.coverage} profiles · {countryBaseline.source.name}</p>
      </div> : null}
    </Section>
    <Section title="Source status">
      <div className="space-y-1 text-[8px] leading-4 text-slate-400"><p><span className={mapStatus === "ready" ? "text-emerald-300" : mapStatus === "error" ? "text-amber-300" : "text-cyan-300"}>●</span> MapTiler · {mapStatus === "ready" ? "ready" : mapStatus === "error" ? mapError : "loading"}</p>{selectedCountry ? (["baseline", "travel", "health", "who", "gdacs", "usgs", "crisiswatch"] as const).map((key) => <p key={key}><span className={countrySources[key].error ? "text-amber-300" : countrySources[key].data ? "text-emerald-300" : "text-cyan-300"}>●</span> {key} · {countrySources[key].loading ? "loading" : countrySources[key].error || (countrySources[key].data ? "loaded" : "idle")}</p>) : (globalWatch?.sourceHealth || []).map((source) => <p key={source.provider}><span className={source.ok ? "text-emerald-300" : "text-amber-300"}>●</span> {source.provider} · {source.ok ? `${source.count} matched` : source.error || "unavailable"}</p>)}</div>
    </Section>
  </div>;

  const panes: Record<AorSidebarTab, ReactNode> = { explore: explorePane, health: healthPane, conditions: conditionsPane, intel: intelPane, info: infoPane };

  return <main className="min-h-screen overflow-hidden bg-[#01050a] text-white">
    <Sidebar />
    <section className="fixed inset-y-0 left-0 right-0 overflow-hidden bg-[#01050a] lg:left-[210px]" aria-label="AOR Factors immersive map workspace">
      <div data-testid="aor-map-shell" className="absolute inset-0 overflow-hidden bg-[#01050a]">
        <div ref={mapHostRef} className="aor-map-tiler-host absolute inset-0" aria-label="Interactive MapTiler AOR intelligence map" />
        <AorOrbOverlay />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(1,5,10,.08)_70%,rgba(1,5,10,.45)_100%)]" />
        {mapStatus !== "ready" ? <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[#01050a]/68 text-center backdrop-blur-sm">{mapStatus === "loading" ? <div><Loader2 className="mx-auto animate-spin text-cyan-100/55" size={22} /><p className="mt-3 text-[10px] text-slate-400">Rendering immersive AOR globe…</p></div> : <div className="max-w-lg px-8"><AlertTriangle className="mx-auto text-amber-200/65" size={22} /><p className="mt-3 text-[11px] font-black text-amber-50">Map rendering failed</p><p className="mt-2 text-[9px] leading-4 text-amber-100/55">{mapError}</p></div>}</div> : null}
        <div className="pointer-events-none absolute bottom-4 right-4 z-30 rounded-full border border-white/[.08] bg-black/25 px-3 py-1.5 text-[8px] font-bold text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-xl"><span className="mr-3"><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-violet-300" />GDACS</span><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />USGS</span></div>
      </div>
      <AorGlassSidebar panes={panes} contextLabel={contextLabel} statusLabel="AOR Factors" />
    </section>
  </main>;
}
