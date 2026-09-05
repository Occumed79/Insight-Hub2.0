import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CloudLightning,
  Crosshair,
  Globe2,
  HeartPulse,
  Layers3,
  Loader2,
  MapPinned,
  RadioTower,
  Search,
  ShieldAlert,
  ShieldCheck,
  Syringe,
  Waves,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { AorPriorityBrief, buildAorPrioritySignals } from "@/components/insight/AorPriorityBrief";
import { AOR_REGISTRY_REVIEWED_AT, COMMANDS, COMMAND_BY_COUNTRY, type CommandId } from "@/components/insight/aor-command-registry";

declare global {
  interface Window { maptilersdk?: any; }
}

const MAPTILER_VERSION = "4.0.2";
const MAPTILER_SCRIPT = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.umd.min.js`;
const MAPTILER_CSS = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.css`;
const COUNTRY_SOURCE = "https://api.maptiler.com/tiles/countries/tiles.json";

type MapMode = "country" | "aor";
type SelectedCountry = { name: string; iso2: string; center?: [number, number]; bbox?: [number, number, number, number] };
type SourceResult = { data: any; error: string; loading: boolean };
type CountrySources = { travel: SourceResult; who: SourceResult; gdacs: SourceResult; usgs: SourceResult; crisiswatch: SourceResult; health: SourceResult };
type EnvironmentKey = "heat" | "cold" | "altitude" | "poorAir" | "fatigue" | "ppe" | "night";

type AorResponse = {
  ok: boolean;
  command: CommandId;
  commandLabel: string;
  partial: boolean;
  sourceHealth: Array<{ provider: string; ok: boolean; count: number; error?: string }>;
  outbreaks: Array<any>;
  disasters: Array<any>;
  earthquakes: Array<any>;
};

type GlobalWatchResponse = {
  ok: boolean;
  partial: boolean;
  sourceHealth: Array<{ provider: string; ok: boolean; count: number; error?: string }>;
  outbreaks: Array<any>;
  disasters: Array<any>;
  earthquakes: Array<any>;
};
const EMPTY_COUNTRY_FILTER = ["==", "iso_a2", "__NONE__"];
const countryFilter = (iso2s: readonly string[]) => ["all", ["==", "level", 0], ["in", "iso_a2", ...iso2s]];

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

function emptyResult(): SourceResult { return { data: null, error: "", loading: false }; }
function emptyCountrySources(): CountrySources { return { travel: emptyResult(), who: emptyResult(), gdacs: emptyResult(), usgs: emptyResult(), crisiswatch: emptyResult(), health: emptyResult() }; }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

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
  if (minLon >= maxLon || minLat >= maxLat) return undefined;
  return [minLon, minLat, maxLon, maxLat];
}
function formatDate(value?: string | null) {
  if (!value) return "Date not supplied";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function externalUrl(value?: string) {
  if (!value) return "";
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : ""; } catch { return ""; }
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Source request failed."; }
async function loadJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && payload?.configured !== false) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

async function loadMapTilerSdk() {
  let css = document.querySelector<HTMLLinkElement>(`link[href="${MAPTILER_CSS}"]`);
  if (!css) {
    css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = MAPTILER_CSS;
    css.dataset.maptilerCss = "true";
    document.head.appendChild(css);
  }
  if (!css.sheet) {
    await new Promise<void>((resolve, reject) => {
      css!.addEventListener("load", () => resolve(), { once: true });
      css!.addEventListener("error", () => reject(new Error("MapTiler stylesheet failed to load.")), { once: true });
      setTimeout(() => resolve(), 5_000);
    });
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

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <GlassCard variant="glass" className={`border border-white/22 bg-white/[0.06] p-[1px] shadow-[0_24px_72px_rgba(0,0,0,.28),0_0_34px_rgba(186,230,253,.07)] backdrop-blur-3xl ${className}`}><div className="h-full rounded-[27px] border border-white/[0.13] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.16)] md:p-5">{children}</div></GlassCard>;
}
function SourceChip({ label, status, note }: { label: string; status: "ok" | "warn" | "loading"; note: string }) {
  const tone = status === "ok" ? "border-emerald-200/16 bg-emerald-300/[0.05] text-emerald-50/82" : status === "warn" ? "border-amber-200/16 bg-amber-300/[0.05] text-amber-50/78" : "border-cyan-200/16 bg-cyan-300/[0.05] text-cyan-50/72";
  return <div className={`min-w-[132px] flex-1 rounded-xl border px-3 py-2 ${tone}`}><div className="flex items-center gap-2"><i className={`h-1.5 w-1.5 rounded-full ${status === "ok" ? "bg-emerald-300" : status === "warn" ? "bg-amber-300" : "bg-cyan-300"}`} /><strong className="text-[10px]">{label}</strong></div><p className="mt-1 truncate text-[9px] opacity-60">{note}</p></div>;
}
function InspectorSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="border-t border-white/9 py-4 first:border-t-0 first:pt-0"><div className="mb-3 flex items-center gap-2 text-white">{icon}<h3 className="text-sm font-black">{title}</h3></div>{children}</section>;
}
function IntelItem({ title, meta, summary, href }: { title: string; meta?: string; summary?: string; href?: string }) {
  const url = externalUrl(href);
  const body = <div className="rounded-xl border border-white/9 bg-white/[0.025] p-3 transition hover:border-cyan-100/20 hover:bg-white/[0.04]"><div className="flex items-start justify-between gap-2"><strong className="text-[11px] leading-4 text-white/88">{title}</strong>{url ? <ArrowUpRight size={11} className="mt-0.5 shrink-0 text-cyan-100/48" /> : null}</div>{meta ? <p className="mt-1 text-[9px] text-cyan-100/40">{meta}</p> : null}{summary ? <p className="mt-2 line-clamp-3 text-[10px] leading-4 text-cyan-100/48">{summary}</p> : null}</div>;
  return url ? <a href={url} target="_blank" rel="noreferrer" className="block">{body}</a> : body;
}
function EmptyIntel({ children }: { children: ReactNode }) { return <p className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[10px] leading-5 text-cyan-100/40">{children}</p>; }
function ModeButton({ active, icon, title, description, onClick }: { active: boolean; icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-h-[62px] flex-1 items-center gap-3 rounded-2xl border px-4 text-left transition ${active ? "border-cyan-100/40 bg-gradient-to-br from-cyan-300/[0.15] to-violet-300/[0.10] shadow-[0_0_30px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.16)]" : "border-white/11 bg-white/[0.025] hover:border-white/22"}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${active ? "border-cyan-100/30 bg-cyan-300/[0.10] text-cyan-100" : "border-white/10 bg-white/[0.025] text-cyan-100/42"}`}>{icon}</span><span><strong className="block text-xs font-black text-white">{title}</strong><small className="mt-1 block text-[9px] leading-4 text-cyan-100/42">{description}</small></span></button>;
}

export default function ReviewerAorFactorsV2Page() {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapKeyRef = useRef("");
  const modeRef = useRef<MapMode>("country");
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("country");
  const [command, setCommand] = useState<CommandId>("centcom");
  const selectedCommand = COMMANDS.find((item) => item.id === command) ?? COMMANDS[4];
  const [data, setData] = useState<AorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mapLayersRevision, setMapLayersRevision] = useState(0);
  const [mapError, setMapError] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [countrySearchLoading, setCountrySearchLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [countrySources, setCountrySources] = useState<CountrySources>(emptyCountrySources());
  const [globalWatch, setGlobalWatch] = useState<GlobalWatchResponse | null>(null);
  const [globalWatchLoading, setGlobalWatchLoading] = useState(true);
  const [globalWatchError, setGlobalWatchError] = useState("");
  const [environment, setEnvironment] = useState<Record<EnvironmentKey, boolean>>({ heat: false, cold: false, altitude: false, poorAir: false, fatigue: false, ppe: false, night: false });

  const mappedCountryCommand = selectedCountry?.iso2 ? COMMAND_BY_COUNTRY.get(selectedCountry.iso2) ?? null : null;
  const contextLabel = selectedCountry?.name || (mapMode === "aor" ? selectedCommand.label : "Select a country");
  const selectedEnvironment = (Object.keys(environment) as EnvironmentKey[]).filter((key) => environment[key]);

  useEffect(() => { modeRef.current = mapMode; }, [mapMode]);


  useEffect(() => {
    let active = true;
    setGlobalWatchLoading(true);
    setGlobalWatchError("");
    loadJson("/api/aor/global-watch")
      .then((payload) => { if (active) setGlobalWatch(payload); })
      .catch((reason) => { if (active) setGlobalWatchError(errorMessage(reason)); })
      .finally(() => { if (active) setGlobalWatchLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mapMode !== "aor" && !selectedCountry) {
      setData(null);
      setLoading(false);
      return;
    }
    const commandToLoad = mappedCountryCommand?.id || command;
    let active = true;
    setLoading(true);
    setError("");
    loadJson(`/api/aor/unified-command?command=${encodeURIComponent(commandToLoad)}`)
      .then((payload) => { if (active) setData(payload); })
      .catch((reason) => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [command, mapMode, mappedCountryCommand?.id, selectedCountry]);

  useEffect(() => {
    if (!selectedCountry?.name) { setCountrySources(emptyCountrySources()); return; }
    let active = true;
    const loadingResult = { data: null, error: "", loading: true };
    setCountrySources({ travel: loadingResult, who: loadingResult, gdacs: loadingResult, usgs: loadingResult, crisiswatch: loadingResult, health: loadingResult });
    const country = encodeURIComponent(selectedCountry.name);
    const bbox = selectedCountry.bbox;
    const seismic = bbox ? loadJson(`/api/aor/seismic-activity?minLon=${encodeURIComponent(String(bbox[0]))}&minLat=${encodeURIComponent(String(bbox[1]))}&maxLon=${encodeURIComponent(String(bbox[2]))}&maxLat=${encodeURIComponent(String(bbox[3]))}&days=30`) : Promise.resolve({ ok: true, earthquakes: [], limitation: "No country geometry bounds were available for this selection." });
    const requests: Record<keyof CountrySources, Promise<any>> = {
      travel: loadJson(`/api/public-data/aor-risk?country=${country}`),
      who: loadJson(`/api/aor/health-outbreaks?country=${country}`),
      gdacs: loadJson(`/api/aor/disaster-alerts?country=${country}&days=90`),
      usgs: seismic,
      crisiswatch: loadJson(`/api/aor/crisiswatch?country=${country}`),
      health: loadJson(`/api/aor/travel-health?country=${country}`),
    };
    (Object.entries(requests) as Array<[keyof CountrySources, Promise<any>]>).forEach(([key, request]) => request.then((payload) => {
      if (active) setCountrySources((current) => ({ ...current, [key]: { data: payload, error: payload?.error || "", loading: false } }));
    }).catch((reason) => {
      if (active) setCountrySources((current) => ({ ...current, [key]: { data: null, error: errorMessage(reason), loading: false } }));
    }));
    return () => { active = false; };
  }, [selectedCountry?.name, selectedCountry?.bbox]);

  useEffect(() => {
    let cancelled = false;
    let readinessTimer: number | undefined;
    async function initMap() {
      try {
        if (!mapHostRef.current) return;
        setMapStatus("loading");
        setMapError("");
        const configResponse = await fetch("/api/map-config", { cache: "no-store" });
        const config = await configResponse.json().catch(() => ({ configured: false, apiKey: "" }));
        if (!configResponse.ok || !config?.configured || !config?.apiKey) throw new Error("MapTiler key is not configured on this service.");
        mapKeyRef.current = config.apiKey;
        const sdk = await loadMapTilerSdk();
        if (cancelled || !mapHostRef.current) return;
        sdk.config.apiKey = config.apiKey;
        const style = sdk.MapStyle?.BRIGHT?.DARK || sdk.MapStyle?.STREETS?.DARK || sdk.MapStyle?.DATAVIZ?.DARK;
        const map = new sdk.Map({
          container: mapHostRef.current,
          style,
          center: [18, 18],
          zoom: 1.15,
          minZoom: 0.75,
          maxZoom: 9,
          attributionControl: true,
          antialias: true,
        });
        mapRef.current = map;
        map.addControl(new sdk.NavigationControl({ showCompass: false }), "bottom-right");

        const markReady = () => {
          if (cancelled) return;
          const canvas = map.getCanvas?.();
          if (!canvas || canvas.width < 50 || canvas.height < 50) return;
          setMapStatus("ready");
          setMapError("");
        };

        let layersAttached = false;
        const attachLayers = () => {
          if (cancelled || layersAttached) return;
          layersAttached = true;
          const sourceUrl = `${COUNTRY_SOURCE}?key=${encodeURIComponent(config.apiKey)}`;
          if (!map.getSource("aor-countries")) map.addSource("aor-countries", { type: "vector", url: sourceUrl });
          const layers = map.getStyle()?.layers || [];
          const firstSymbol = layers.find((layer: any) => layer.type === "symbol")?.id;
          const before = firstSymbol || undefined;

          COMMANDS.forEach((item) => {
            map.addLayer({ id: `aor-fill-${item.id}`, type: "fill", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(item.countries), paint: { "fill-color": item.color, "fill-opacity": 0 } }, before);
            map.addLayer({ id: `aor-line-${item.id}`, type: "line", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(item.countries), paint: { "line-color": item.color, "line-width": 1, "line-opacity": 0 } }, before);
          });
          map.addLayer({ id: "aor-active-glow", type: "line", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(selectedCommand.countries), paint: { "line-color": "#67ecff", "line-width": 8, "line-opacity": 0, "line-blur": 4 } }, before);
          map.addLayer({ id: "aor-active-line", type: "line", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(selectedCommand.countries), paint: { "line-color": "#d9fbff", "line-width": 2.4, "line-opacity": 0 } }, before);
          map.addLayer({ id: "aor-selected-country-fill", type: "fill", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_COUNTRY_FILTER, paint: { "fill-color": "#47e8d0", "fill-opacity": 0.20 } }, before);
          map.addLayer({ id: "aor-selected-country-glow", type: "line", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_COUNTRY_FILTER, paint: { "line-color": "#71f4ff", "line-width": 8, "line-opacity": 0.18, "line-blur": 4 } }, before);
          map.addLayer({ id: "aor-selected-country-line", type: "line", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_COUNTRY_FILTER, paint: { "line-color": "#efffff", "line-width": 2.8, "line-opacity": 0.96 } }, before);
          map.addLayer({ id: "aor-country-hit", type: "fill", source: "aor-countries", "source-layer": "administrative", filter: ["==", "level", 0], paint: { "fill-color": "#ffffff", "fill-opacity": 0.001 } }, before);
          map.addSource("aor-live-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "aor-live-events-glow", type: "circle", source: "aor-live-events", paint: { "circle-radius": 10, "circle-color": ["match", ["get", "kind"], "GDACS", "#9f76ff", "#52e5ef"], "circle-opacity": 0.18 } });
          map.addLayer({ id: "aor-live-events-points", type: "circle", source: "aor-live-events", paint: { "circle-radius": ["match", ["get", "kind"], "GDACS", 5.5, 4.5], "circle-color": ["match", ["get", "kind"], "GDACS", "#a785ff", "#65eff4"], "circle-stroke-color": "#ecfeff", "circle-stroke-width": 1.1, "circle-opacity": 0.96 } });

          // State-driven effects may have run while the style was still loading.
          // Trigger them again now that every source and layer actually exists.
          setMapLayersRevision((revision) => revision + 1);

          map.on("mousemove", "aor-country-hit", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "aor-country-hit", () => { map.getCanvas().style.cursor = ""; });
          map.on("click", "aor-country-hit", (event: any) => {
            const feature = event.features?.[0];
            const properties = feature?.properties ?? {};
            const iso2 = String(properties.iso_a2 || "").toUpperCase();
            const name = String(properties["name:en"] || properties.name || properties.name_en || iso2 || "Selected country");
            const featureBbox = geometryBbox(feature?.geometry);
            const mapped = COMMAND_BY_COUNTRY.get(iso2);
            if (modeRef.current === "aor") {
              if (mapped) {
                setCommand(mapped.id);
                setSelectedCountry(null);
                setCountryQuery("");
              } else {
                setError(`${name} is not assigned in the current AOR lookup table.`);
              }
              return;
            }
            if (mapped) setCommand(mapped.id);
            setCountryQuery(name);
            setSelectedCountry({ name, iso2, bbox: featureBbox });
            const lng = Number(event?.lngLat?.lng); const lat = Number(event?.lngLat?.lat);
            if (Number.isFinite(lng) && Number.isFinite(lat)) map.easeTo?.({ center: [lng, lat], zoom: 3.7, duration: 650 });
          });
          map.on("click", "aor-live-events-points", (event: any) => {
            const url = externalUrl(String(event.features?.[0]?.properties?.url || ""));
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          });
          map.on("mouseenter", "aor-live-events-points", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "aor-live-events-points", () => { map.getCanvas().style.cursor = ""; });

          requestAnimationFrame(() => map.resize?.());
          window.setTimeout(() => map.resize?.(), 180);
          resizeObserverRef.current = new ResizeObserver(() => map.resize?.());
          resizeObserverRef.current.observe(mapHostRef.current!);
        };

        map.on("load", attachLayers);
        map.on("ready", attachLayers);
        map.on("idle", markReady);
        map.on("error", (event: any) => {
          const message = event?.error?.message || "MapTiler resource failed.";
          if (!cancelled) setMapError(message);
        });
        readinessTimer = window.setTimeout(() => {
          if (cancelled) return;
          const canvas = map.getCanvas?.();
          if (!canvas || canvas.width < 50 || canvas.height < 50 || !map.areTilesLoaded?.()) {
            setMapStatus("error");
            setMapError((current) => current || "MapTiler initialized, but the basemap tiles did not finish rendering. Check key restrictions and tile access for this Render domain.");
          } else markReady();
        }, 15_000);
      } catch (reason) {
        if (!cancelled) { setMapStatus("error"); setMapError(errorMessage(reason)); }
      }
    }
    void initMap();
    return () => {
      cancelled = true;
      if (readinessTimer) window.clearTimeout(readinessTimer);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    COMMANDS.forEach((item) => {
      const selected = item.id === command;
      map.setPaintProperty?.(`aor-fill-${item.id}`, "fill-opacity", mapMode === "aor" ? (selected ? 0.16 : 0.055) : 0);
      map.setPaintProperty?.(`aor-line-${item.id}`, "line-opacity", mapMode === "aor" ? (selected ? 0.92 : 0.34) : 0);
      map.setPaintProperty?.(`aor-line-${item.id}`, "line-width", selected ? 1.8 : 0.8);
    });
    const filter = countryFilter(selectedCommand.countries);
    if (map.getLayer?.("aor-active-glow")) map.setFilter("aor-active-glow", filter);
    if (map.getLayer?.("aor-active-line")) map.setFilter("aor-active-line", filter);
    map.setPaintProperty?.("aor-active-glow", "line-opacity", mapMode === "aor" ? 0.20 : 0);
    map.setPaintProperty?.("aor-active-line", "line-opacity", mapMode === "aor" ? 0.98 : 0);
    if (mapMode === "aor") map.easeTo?.({ center: selectedCommand.center, zoom: selectedCommand.zoom, duration: 650 });
  }, [command, mapMode, mapLayersRevision, selectedCommand]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const filter = mapMode === "country" && selectedCountry?.iso2 ? countryFilter([selectedCountry.iso2]) : EMPTY_COUNTRY_FILTER;
    for (const layer of ["aor-selected-country-fill", "aor-selected-country-glow", "aor-selected-country-line"]) if (map.getLayer?.(layer)) map.setFilter(layer, filter);
  }, [mapLayersRevision, mapMode, selectedCountry]);

  const strictQuakes = useMemo(() => {
    if (selectedCountry) return (countrySources.usgs.data?.earthquakes || []).slice(0, 6);
    return mapMode === "aor" ? (data?.earthquakes || []).slice(0, 6) : [];
  }, [countrySources.usgs.data?.earthquakes, data?.earthquakes, mapMode, selectedCountry]);
  const countryWho = selectedCountry ? (countrySources.who.data?.outbreaks || []).slice(0, 6) : mapMode === "aor" ? (data?.outbreaks || []).slice(0, 6) : [];
  const countryGdacs = selectedCountry ? (countrySources.gdacs.data?.events || []).slice(0, 6) : mapMode === "aor" ? (data?.disasters || []).slice(0, 6) : [];
  const crisisUpdates = selectedCountry ? (countrySources.crisiswatch.data?.updates || []).slice(0, 6) : [];
  const advisory = countrySources.travel.data?.advisory;
  const travelHealth = countrySources.health.data;
  const vaccines = (travelHealth?.vaccines || []).slice(0, 10);
  const infectiousDiseases = (travelHealth?.diseases || []).slice(0, 10);

  const prioritySignals = useMemo(() => buildAorPrioritySignals({
    advisory: selectedCountry ? advisory : undefined,
    outbreaks: selectedCountry ? countryWho : mapMode === "aor" ? (data?.outbreaks || []) : (globalWatch?.outbreaks || []),
    disasters: selectedCountry ? countryGdacs : mapMode === "aor" ? (data?.disasters || []) : (globalWatch?.disasters || []),
    earthquakes: selectedCountry ? strictQuakes : mapMode === "aor" ? (data?.earthquakes || []) : (globalWatch?.earthquakes || []),
    crisisUpdates: selectedCountry ? crisisUpdates.filter((item: any) => item.matchedCountry !== false) : [],
    healthNotices: selectedCountry ? (travelHealth?.notices || []) : [],
    environmentLabels: selectedEnvironment.map((key) => ENVIRONMENT_LABELS[key]),
  }), [advisory, countryGdacs, countryWho, crisisUpdates, data?.disasters, data?.earthquakes, data?.outbreaks, globalWatch?.disasters, globalWatch?.earthquakes, globalWatch?.outbreaks, mapMode, selectedCountry, selectedEnvironment, strictQuakes, travelHealth?.notices]);
  const priorityContext = selectedCountry?.name || (mapMode === "aor" ? selectedCommand.label : "Global watch");
  const priorityLoading = selectedCountry ? Object.values(countrySources).some((source) => source.loading) : mapMode === "aor" ? loading : globalWatchLoading;
  const priorityError = selectedCountry ? "" : mapMode === "aor" ? error : globalWatchError;

  const eventGeoJson = useMemo(() => {
    const features: any[] = [];
    const disasters = selectedCountry ? countryGdacs : mapMode === "aor" ? (data?.disasters || []) : [];
    disasters.forEach((item: any) => {
      const lat = Number(item.latitude ?? item.lat);
      const lng = Number(item.longitude ?? item.lon ?? item.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { kind: "GDACS", title: item.name || item.title || "GDACS event", url: item.sourceUrl || item.url || "" } });
    });
    strictQuakes.forEach((item: any) => {
      const lat = Number(item.latitude); const lng = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { kind: "USGS", title: item.title, url: item.url || "" } });
    });
    return { type: "FeatureCollection", features };
  }, [countryGdacs, data?.disasters, mapMode, selectedCountry, strictQuakes]);

  useEffect(() => { mapRef.current?.getSource?.("aor-live-events")?.setData?.(eventGeoJson); }, [eventGeoJson, mapLayersRevision]);

  async function resolveCountrySearch() {
    const query = countryQuery.trim();
    if (!query) return;
    setCountrySearchLoading(true);
    setError("");
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
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setCountrySearchLoading(false);
    }
  }

  function switchMode(mode: MapMode) {
    setMapMode(mode);
    setError("");
    if (mode === "aor") {
      setSelectedCountry(null);
      setCountryQuery("");
      setCountrySources(emptyCountrySources());
    } else {
      setSelectedCountry(null);
      setCountryQuery("");
      setCountrySources(emptyCountrySources());
      mapRef.current?.easeTo?.({ center: [18, 18], zoom: 1.15, duration: 650 });
    }
  }

  function chooseCommand(id: CommandId) {
    setCommand(id);
    setSelectedCountry(null);
    setCountryQuery("");
    setCountrySources(emptyCountrySources());
  }

  const sourceHealth = new Map((data?.sourceHealth || []).map((item) => [item.provider, item]));
  const countrySourceStatus = (source: SourceResult | undefined, idleNote = "Select a country") => !selectedCountry ? { status: "loading" as const, note: idleNote } : source?.loading ? { status: "loading" as const, note: "Loading" } : source?.error ? { status: "warn" as const, note: source.error } : { status: "ok" as const, note: "Country feed loaded" };
  const healthStatus = countrySourceStatus(countrySources.health);
  const stateStatus = countrySourceStatus(countrySources.travel);
  const whoStatus = countrySourceStatus(countrySources.who);
  const gdacsStatus = countrySourceStatus(countrySources.gdacs);
  const usgsStatus = countrySourceStatus(countrySources.usgs);
  const crisisStatus = countrySourceStatus(countrySources.crisiswatch);

  return (
    <main className="aurora-bg min-h-screen pb-16 text-white">
      <Sidebar />
      <section className="relative z-10 px-4 py-6 pt-24 lg:ml-[210px] lg:px-8 lg:pt-6 xl:px-10">
        <HeaderBar eyebrow="Operational / Environmental Intelligence" title="AOR Factors" subtitle="Choose Country mode for country-level travel and health intelligence, or AOR mode for command-wide operational feeds. Both use the same MapTiler vector-tile map." />

        <Surface className="overflow-hidden">
          <div className="grid gap-3 lg:grid-cols-2" aria-label="Map selection mode">
            <ModeButton active={mapMode === "country"} icon={<Globe2 size={17} />} title="Country mode" description="Default. Click or search any country for country-only intelligence." onClick={() => switchMode("country")} />
            <ModeButton active={mapMode === "aor"} icon={<MapPinned size={17} />} title="AOR mode" description="Click any mapped country region to select its combatant command." onClick={() => switchMode("aor")} />
          </div>

          {mapMode === "country" ? (
            <div className="mt-4 rounded-2xl border border-cyan-100/12 bg-cyan-300/[0.035] p-3 md:p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <label><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/45">Country / operating area</span><div className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-white/14 bg-white/[0.035] px-3 focus-within:border-cyan-100/30"><Search size={14} className="shrink-0 text-cyan-100/42" /><input value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void resolveCountrySearch(); }} placeholder="Search or click a country" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-cyan-100/28" /></div></label>
                <button type="button" onClick={() => void resolveCountrySearch()} disabled={!countryQuery.trim() || countrySearchLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-100/24 bg-cyan-300/[0.09] px-4 text-[10px] font-black disabled:opacity-40">{countrySearchLoading ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}Load country</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-violet-100/12 bg-violet-300/[0.035] p-3 md:p-4"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/45">Combatant command</p><div className="mt-2 flex flex-wrap gap-2">{COMMANDS.map((item) => <button key={item.id} type="button" onClick={() => chooseCommand(item.id)} className={`min-h-9 rounded-xl border px-3 text-[10px] font-black transition ${command === item.id ? "border-violet-100/38 bg-violet-300/[0.13] text-white" : "border-white/11 bg-white/[0.025] text-cyan-100/50 hover:border-white/20 hover:text-white"}`}>{item.label}</button>)}</div><p className="mt-2 text-[9px] text-violet-100/40">You can use these controls or click any country on the map; the map will resolve that country to its assigned AOR. Assignment registry reviewed {AOR_REGISTRY_REVIEWED_AT}.</p></div>
          )}

          <div className="mt-4 flex flex-wrap gap-2" aria-label="AOR source status">
            <SourceChip label="MapTiler" status={mapStatus === "ready" ? "ok" : mapStatus === "error" ? "warn" : "loading"} note={mapStatus === "ready" ? "Bright Dark vector tiles rendered" : mapStatus === "error" ? mapError : "Rendering vector tiles"} />
            {mapMode === "aor" ? ["WHO Disease Outbreak News", "GDACS", "USGS Earthquake Catalog"].map((provider) => { const source = sourceHealth.get(provider); return <SourceChip key={provider} label={provider.replace(" Disease Outbreak News", "").replace(" Earthquake Catalog", "")} status={loading ? "loading" : source?.ok ? "ok" : "warn"} note={loading ? "Refreshing" : source?.ok ? `${source.count} AOR matches` : source?.error || "Unavailable"} />; }) : <><SourceChip label="State Travel" status={stateStatus.status} note={stateStatus.note} /><SourceChip label="CDC Travel Health" status={healthStatus.status} note={healthStatus.note} /><SourceChip label="WHO" status={whoStatus.status} note={whoStatus.note} /><SourceChip label="GDACS" status={gdacsStatus.status} note={gdacsStatus.note} /><SourceChip label="USGS" status={usgsStatus.status} note={usgsStatus.note} /><SourceChip label="CrisisWatch" status={crisisStatus.status} note={crisisStatus.note} /></>}
          </div>

          <div className="mt-4">
            <AorPriorityBrief context={priorityContext} signals={prioritySignals} loading={priorityLoading} error={priorityError} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(340px,.58fr)]">
            <div className="min-w-0 space-y-4">
              <div className="overflow-hidden rounded-[24px] border border-white/13 bg-[#020812]/76 shadow-[0_22px_65px_rgba(0,0,0,.34)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/9 px-4 py-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">{mapMode === "country" ? "Country selection" : "AOR operating picture"}</p><h2 className="mt-1 text-lg font-black">{contextLabel}</h2><p className="mt-1 max-w-3xl text-[10px] leading-4 text-cyan-100/42">{selectedCountry ? `${selectedCountry.name} drives all country-specific travel, health, outbreak, disaster, conflict, and environmental intelligence below.${mappedCountryCommand ? ` Assigned command: ${mappedCountryCommand.label}.` : " No AOR assignment is forced for this country."}` : mapMode === "aor" ? selectedCommand.scope : "Click any country on the MapTiler map or search for a destination. No AOR is selected by default."}</p></div><span className="rounded-full border border-cyan-100/18 bg-cyan-300/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-50/72">{mapMode === "country" ? "Country selection" : "AOR selection"}</span></div>
                <div className="relative h-[650px] overflow-hidden bg-[#020812]" data-testid="aor-map-shell">
                  <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_18%_15%,rgba(34,211,238,.055),transparent_28%),radial-gradient(circle_at_82%_76%,rgba(124,58,237,.055),transparent_30%)]" />
                  <div ref={mapHostRef} className="aor-map-tiler-host absolute inset-0" aria-label="Interactive MapTiler AOR intelligence map" />
                  {mapStatus !== "ready" ? <div className="absolute inset-0 z-20 grid place-items-center bg-[#020812]/82 p-6 text-center backdrop-blur-sm">{mapStatus === "loading" ? <div><Loader2 className="mx-auto animate-spin text-cyan-200/70" size={24} /><p className="mt-3 text-xs text-cyan-100/50">Rendering MapTiler Bright Dark vector tiles…</p></div> : <div><AlertTriangle className="mx-auto text-amber-200/70" size={24} /><p className="mt-3 text-sm font-black text-amber-50/82">Map rendering failed</p><p className="mt-2 max-w-lg text-[10px] leading-5 text-amber-100/52">{mapError}</p></div>}</div> : null}
                  <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[82%] rounded-xl border border-white/10 bg-[#020812]/78 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.1em] text-cyan-50/58 backdrop-blur-xl"><span className="mr-3 inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-violet-300" />GDACS</span><span className="mr-3 inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-cyan-300" />USGS</span>{mapMode === "country" ? "Country mode · click a country for country-only intelligence." : "AOR mode · click a country region to select its command."}</div>
                </div>
              </div>

              {mapMode === "country" ? (
                <div className="rounded-[24px] border border-white/13 bg-gradient-to-br from-cyan-300/[0.055] via-[#04101c]/72 to-violet-300/[0.055] p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] backdrop-blur-2xl">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/44">Country health readiness</p><h2 className="mt-1 text-base font-black">Vaccines, malaria / yellow fever, and travel-relevant infectious diseases</h2><p className="mt-1 text-[10px] leading-4 text-cyan-100/40">Official CDC Travelers' Health destination guidance. This is travel-health context, not an individualized medical recommendation.</p></div><Syringe size={18} className="text-cyan-100/50" /></div>
                  {!selectedCountry ? <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-center text-xs text-cyan-100/42">Select a country to load its CDC travel-health profile.</div> : countrySources.health.loading ? <div className="mt-4 flex min-h-28 items-center justify-center gap-2 text-xs text-cyan-100/45"><Loader2 size={15} className="animate-spin" />Loading CDC destination guidance…</div> : countrySources.health.error ? <div className="mt-4 rounded-xl border border-amber-200/14 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100/68">{countrySources.health.error}</div> : (
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-2xl border border-cyan-100/12 bg-cyan-300/[0.035] p-4"><div className="flex items-center gap-2"><Syringe size={14} className="text-cyan-200/68" /><h3 className="text-xs font-black">Vaccines & medicines</h3></div><div className="mt-3 space-y-2">{vaccines.length ? vaccines.slice(0, 7).map((item: any) => <div key={item.name} className="rounded-xl border border-white/8 bg-white/[0.025] p-2.5"><div className="flex items-start justify-between gap-2"><strong className="text-[10px] text-white/82">{item.name}</strong><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${item.status === "recommended" ? "border-emerald-200/18 bg-emerald-300/[0.06] text-emerald-100/75" : item.status === "consider" ? "border-violet-200/18 bg-violet-300/[0.06] text-violet-100/75" : "border-white/10 bg-white/[0.025] text-cyan-100/42"}`}>{item.status === "not-routinely-recommended" ? "Not routine" : item.status}</span></div><p className="mt-1 line-clamp-2 text-[9px] leading-4 text-cyan-100/40">{item.recommendation}</p></div>) : <EmptyIntel>No vaccine rows parsed for this destination.</EmptyIntel>}</div></div>
                      <div className="rounded-2xl border border-violet-100/12 bg-violet-300/[0.035] p-4"><div className="flex items-center gap-2"><ShieldCheck size={14} className="text-violet-200/68" /><h3 className="text-xs font-black">Malaria & yellow fever</h3></div><div className="mt-3 space-y-2">{travelHealth?.malaria ? <IntelItem title="Malaria prevention" summary={travelHealth.malaria.recommendation} /> : <EmptyIntel>No malaria row was returned on the CDC destination page.</EmptyIntel>}{travelHealth?.yellowFever ? <IntelItem title="Yellow fever" summary={travelHealth.yellowFever.recommendation} /> : <EmptyIntel>No yellow-fever row was returned on the CDC destination page.</EmptyIntel>}{(travelHealth?.notices || []).length ? <div className="rounded-xl border border-amber-200/12 bg-amber-300/[0.035] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-amber-100/48">Travel health notices</p>{travelHealth.notices.slice(0, 3).map((notice: string) => <p key={notice} className="mt-2 text-[10px] leading-4 text-amber-50/68">{notice}</p>)}</div> : null}</div></div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="flex items-center gap-2"><HeartPulse size={14} className="text-cyan-200/68" /><h3 className="text-xs font-black">Travel-relevant disease profile</h3></div><p className="mt-1 text-[9px] leading-4 text-cyan-100/36">CDC-listed non-vaccine-preventable diseases for this destination; this list is not a prevalence ranking.</p><div className="mt-3 flex flex-wrap gap-2">{infectiousDiseases.length ? infectiousDiseases.map((item: any) => <span key={item.name} title={`${item.transmission || ""}${item.advice ? ` · ${item.advice}` : ""}`} className="rounded-full border border-cyan-100/12 bg-cyan-300/[0.04] px-2.5 py-1.5 text-[9px] font-bold text-cyan-50/68">{item.name}</span>) : <span className="text-[10px] text-cyan-100/38">No disease rows parsed.</span>}</div>{externalUrl(travelHealth?.sourceUrl) ? <a href={externalUrl(travelHealth.sourceUrl)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-[9px] font-bold text-cyan-200/64">Open CDC destination guidance<ArrowUpRight size={10} /></a> : null}</div>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="rounded-[24px] border border-white/13 bg-[#04101c]/58 p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] backdrop-blur-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-100/44">Environmental / human-performance load</p><h2 className="mt-1 text-base font-black">Work conditions for {contextLabel}</h2></div><Activity size={17} className="text-violet-100/48" /></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(ENVIRONMENT_LABELS) as EnvironmentKey[]).map((key) => <button key={key} type="button" aria-pressed={environment[key]} onClick={() => setEnvironment((current) => ({ ...current, [key]: !current[key] }))} className={`min-h-10 rounded-xl border px-3 text-left text-[10px] font-bold ${environment[key] ? "border-violet-200/26 bg-violet-300/[0.10] text-white" : "border-white/10 bg-white/[0.025] text-cyan-100/48"}`}>{ENVIRONMENT_LABELS[key]}</button>)}</div><div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">{selectedEnvironment.length ? <div className="grid gap-2 md:grid-cols-2">{selectedEnvironment.map((key) => <p key={key} className="text-[10px] leading-5 text-cyan-100/50"><strong className="text-violet-100/72">{ENVIRONMENT_LABELS[key]}:</strong> {ENVIRONMENT_PROMPTS[key]}</p>)}</div> : <p className="text-[10px] leading-5 text-cyan-100/40">Select only conditions actually present at the mapped operating location. These remain separate evidence factors rather than a fabricated score.</p>}</div></div>
            </div>

            <aside className="max-h-[1180px] overflow-y-auto overscroll-contain rounded-[24px] border border-white/13 bg-[#03101b]/64 p-4 shadow-[0_20px_60px_rgba(0,0,0,.28)] backdrop-blur-2xl" aria-label="Map-linked intelligence inspector">
              <div className="flex items-start justify-between gap-3 pb-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Map-linked intelligence inspector</p><h2 className="mt-1 text-lg font-black">{contextLabel}</h2><p className="mt-1 text-[10px] leading-4 text-cyan-100/40">{selectedCountry ? `Country-only intelligence for ${selectedCountry.name}.` : mapMode === "aor" ? `Command-wide intelligence for ${selectedCommand.label}.` : "Choose a country to populate the inspector."}</p></div><Layers3 size={18} className="text-cyan-100/46" /></div>
              {error ? <div className="mb-3 rounded-xl border border-amber-200/15 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100/70"><AlertTriangle size={13} className="mr-2 inline" />{error}</div> : null}

              <InspectorSection title="U.S. Department of State Travel Advisory" icon={<ShieldAlert size={14} className="text-cyan-200/62" />}>{!selectedCountry ? <EmptyIntel>{mapMode === "country" ? "Select a country to load its travel advisory." : "Travel advisories are country-specific; switch to Country mode to load one."}</EmptyIntel> : countrySources.travel.loading ? <EmptyIntel>Loading travel advisory…</EmptyIntel> : countrySources.travel.error ? <EmptyIntel>{countrySources.travel.error}</EmptyIntel> : advisory ? <div className="space-y-2"><div className="rounded-xl border border-cyan-100/12 bg-cyan-300/[0.04] p-3"><p className="text-[9px] uppercase tracking-[0.15em] text-cyan-100/40">Travel posture</p><p className="mt-1 text-base font-black">Level {advisory.level} · {advisory.levelLabel}</p><p className="mt-2 text-[10px] leading-4 text-cyan-100/48">{advisory.summary || advisory.details || "Review the official advisory."}</p></div>{externalUrl(advisory.sourceUrl || countrySources.travel.data?.sourceUrl) ? <a href={externalUrl(advisory.sourceUrl || countrySources.travel.data?.sourceUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-200/64">Open official advisory<ArrowUpRight size={10} /></a> : null}</div> : <EmptyIntel>No advisory payload returned.</EmptyIntel>}</InspectorSection>

              <InspectorSection title="WHO Disease Outbreaks" icon={<HeartPulse size={14} className="text-violet-200/64" />}>{selectedCountry && countrySources.who.loading ? <EmptyIntel>Loading WHO country matches…</EmptyIntel> : selectedCountry && countrySources.who.error ? <EmptyIntel>{countrySources.who.error}</EmptyIntel> : countryWho.length ? <div className="space-y-2">{countryWho.map((item: any, index: number) => <IntelItem key={item.id || index} title={item.title || "WHO Disease Outbreak News"} meta={formatDate(item.publicationDate || item.publishedAt)} summary={item.summary} href={item.sourceUrl || item.url} />)}</div> : <EmptyIntel>{selectedCountry ? `WHO returned no text-matched outbreak item for ${selectedCountry.name}; unrelated outbreaks are not substituted.` : mapMode === "aor" ? "No recent WHO item matched this command." : "Select a country to load WHO country matches."}</EmptyIntel>}</InspectorSection>

              <InspectorSection title="GDACS Natural Hazards" icon={<CloudLightning size={14} className="text-violet-200/64" />}>{selectedCountry && countrySources.gdacs.loading ? <EmptyIntel>Loading GDACS country matches…</EmptyIntel> : selectedCountry && countrySources.gdacs.error ? <EmptyIntel>{countrySources.gdacs.error}</EmptyIntel> : countryGdacs.length ? <div className="space-y-2">{countryGdacs.map((item: any, index: number) => <IntelItem key={`${item.eventType || "event"}-${item.eventId || item.id || index}`} title={item.name || item.title || "GDACS event"} meta={`${item.alertLevel || "Alert level n/a"} · ${formatDate(item.fromDate)}`} summary={item.description || item.country} href={item.sourceUrl || item.url} />)}</div> : <EmptyIntel>{selectedCountry ? `No GDACS event whose returned country metadata matches ${selectedCountry.name}.` : mapMode === "aor" ? "No recent GDACS event matched this command." : "Select a country to load GDACS country matches."}</EmptyIntel>}</InspectorSection>

              <InspectorSection title="USGS Seismic Activity" icon={<Waves size={14} className="text-cyan-200/64" />}>{strictQuakes.length ? <div className="space-y-2">{strictQuakes.map((item: any, index: number) => <IntelItem key={item.id || index} title={item.title || item.place || "USGS earthquake"} meta={`${item.magnitude == null ? "Magnitude n/a" : `M${item.magnitude}`} · ${formatDate(item.occurredAt)}`} summary={item.depthKm == null ? undefined : `${item.depthKm} km depth`} href={item.url} />)}</div> : <EmptyIntel>{selectedCountry ? `No USGS event fell inside the selected country bounds; command-wide earthquakes are not substituted.` : mapMode === "aor" ? "No recent USGS earthquake matched this command." : "Select a country to evaluate seismic matches."}</EmptyIntel>}</InspectorSection>

              <InspectorSection title="International Crisis Group CrisisWatch" icon={<RadioTower size={14} className="text-violet-200/64" />}>{!selectedCountry ? <EmptyIntel>{mapMode === "country" ? "Select a country to load CrisisWatch context." : "CrisisWatch context is country-specific; switch to Country mode."}</EmptyIntel> : countrySources.crisiswatch.loading ? <EmptyIntel>Loading CrisisWatch…</EmptyIntel> : countrySources.crisiswatch.error ? <EmptyIntel>{countrySources.crisiswatch.error}</EmptyIntel> : crisisUpdates.length ? <div className="space-y-2">{crisisUpdates.map((item: any, index: number) => <IntelItem key={item.id || index} title={item.title || item.headline || "CrisisWatch update"} meta={formatDate(item.publishedAt || item.date)} summary={item.summary || item.description} href={item.url || item.sourceUrl} />)}</div> : <EmptyIntel>No readable CrisisWatch item matched this country.</EmptyIntel>}</InspectorSection>

              <p className="border-t border-white/9 pt-4 text-[9px] leading-4 text-cyan-100/34">Country mode keeps every country source tied to the selected country. AOR mode shows command-wide source matches. CDC travel-health guidance, State advisories, WHO outbreak reporting, GDACS alerts, USGS events, CrisisWatch analysis, and environmental prompts retain their own definitions and timestamps; the tool does not fabricate a composite danger score.</p>
            </aside>
          </div>
        </Surface>
      </section>
    </main>
  );
}
