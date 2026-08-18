import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CloudLightning,
  HeartPulse,
  Layers3,
  Loader2,
  RadioTower,
  Search,
  ShieldAlert,
  Waves,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

declare global {
  interface Window { maptilersdk?: any; }
}

const MAPTILER_VERSION = "4.0.2";
const MAPTILER_SCRIPT = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.umd.min.js`;
const MAPTILER_CSS = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.css`;
const COUNTRY_SOURCE = "https://api.maptiler.com/tiles/countries/tiles.json";

const COMMANDS = [
  { id: "northcom", label: "USNORTHCOM", scope: "United States, Canada, Mexico, Greenland, The Bahamas, and assigned approaches", center: [-101, 46] as [number, number], zoom: 1.55, color: "#52d7dd", countries: ["US", "CA", "MX", "GL", "BS", "PR", "VI"] },
  { id: "southcom", label: "USSOUTHCOM", scope: "Central America, South America, the Caribbean, and adjacent approaches", center: [-67, -9] as [number, number], zoom: 1.7, color: "#55e3bb", countries: ["AG", "AR", "BB", "BZ", "BO", "BR", "CL", "CO", "CR", "CU", "DM", "DO", "EC", "SV", "GD", "GT", "GY", "HT", "HN", "JM", "NI", "PA", "PY", "PE", "KN", "LC", "VC", "SR", "TT", "UY", "VE"] },
  { id: "eucom", label: "USEUCOM", scope: "Europe and assigned portions of Eurasia, the Arctic, Atlantic, and adjoining approaches", center: [21, 52] as [number, number], zoom: 2.15, color: "#7eb8ff", countries: ["AL", "AD", "AM", "AT", "AZ", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "GE", "DE", "GR", "HU", "IS", "IE", "IT", "XK", "LV", "LI", "LT", "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL", "PT", "RO", "RU", "SM", "RS", "SK", "SI", "ES", "SE", "CH", "TR", "UA", "GB", "VA"] },
  { id: "africom", label: "USAFRICOM", scope: "The African continent, island nations, and surrounding waters, except Egypt", center: [19, 3] as [number, number], zoom: 1.8, color: "#9d8cff", countries: ["DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW"] },
  { id: "centcom", label: "USCENTCOM", scope: "Twenty-one nations across the Middle East and Central and South Asia, including Egypt", center: [53, 30] as [number, number], zoom: 2.25, color: "#69d8ff", countries: ["AF", "BH", "EG", "IR", "IQ", "IL", "JO", "KZ", "KW", "KG", "LB", "OM", "PK", "QA", "SA", "SY", "TJ", "TM", "AE", "UZ", "YE"] },
  { id: "indopacom", label: "USINDOPACOM", scope: "The Indo-Pacific from India through East Asia, Australia, and Pacific island nations", center: [142, 13] as [number, number], zoom: 1.45, color: "#817dff", countries: ["AU", "BD", "BT", "BN", "KH", "CN", "TW", "FJ", "IN", "ID", "JP", "KI", "LA", "MY", "MV", "MH", "FM", "MN", "MM", "NR", "NP", "NZ", "KP", "PW", "PG", "PH", "WS", "SG", "SB", "KR", "LK", "TH", "TL", "TO", "TV", "VU", "VN"] },
] as const;

type Command = (typeof COMMANDS)[number];
type CommandId = Command["id"];
type SelectedCountry = { name: string; iso2: string; center?: [number, number]; bbox?: [number, number, number, number] };
type SourceResult = { data: any; error: string; loading: boolean };
type CountrySources = { travel: SourceResult; who: SourceResult; gdacs: SourceResult; crisiswatch: SourceResult };
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

const COMMAND_BY_COUNTRY = new Map<string, Command>(COMMANDS.flatMap((command) => command.countries.map((iso2) => [iso2, command] as [string, Command])));
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
function emptyCountrySources(): CountrySources { return { travel: emptyResult(), who: emptyResult(), gdacs: emptyResult(), crisiswatch: emptyResult() }; }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
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

export default function ReviewerAorFactorsLivePage() {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapKeyRef = useRef("");
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [command, setCommand] = useState<CommandId>("centcom");
  const selectedCommand = COMMANDS.find((item) => item.id === command) ?? COMMANDS[4];
  const [data, setData] = useState<AorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mapError, setMapError] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [countrySearchLoading, setCountrySearchLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [countrySources, setCountrySources] = useState<CountrySources>(emptyCountrySources());
  const [environment, setEnvironment] = useState<Record<EnvironmentKey, boolean>>({ heat: false, cold: false, altitude: false, poorAir: false, fatigue: false, ppe: false, night: false });

  const contextLabel = selectedCountry?.name ? `${selectedCommand.label} · ${selectedCountry.name}` : selectedCommand.label;
  const selectedEnvironment = (Object.keys(environment) as EnvironmentKey[]).filter((key) => environment[key]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadJson(`/api/aor/unified-command?command=${encodeURIComponent(command)}`)
      .then((payload) => { if (active) setData(payload); })
      .catch((reason) => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [command]);

  useEffect(() => {
    if (!selectedCountry?.name) { setCountrySources(emptyCountrySources()); return; }
    let active = true;
    setCountrySources({ travel: { data: null, error: "", loading: true }, who: { data: null, error: "", loading: true }, gdacs: { data: null, error: "", loading: true }, crisiswatch: { data: null, error: "", loading: true } });
    const country = encodeURIComponent(selectedCountry.name);
    const requests: Record<keyof CountrySources, Promise<any>> = {
      travel: loadJson(`/api/public-data/aor-risk?country=${country}`),
      who: loadJson(`/api/aor/health-outbreaks?country=${country}`),
      gdacs: loadJson(`/api/aor/disaster-alerts?country=${country}&days=90`),
      crisiswatch: loadJson(`/api/aor/crisiswatch?country=${country}`),
    };
    (Object.entries(requests) as Array<[keyof CountrySources, Promise<any>]>).forEach(([key, request]) => request.then((payload) => {
      if (active) setCountrySources((current) => ({ ...current, [key]: { data: payload, error: payload?.error || "", loading: false } }));
    }).catch((reason) => {
      if (active) setCountrySources((current) => ({ ...current, [key]: { data: null, error: errorMessage(reason), loading: false } }));
    }));
    return () => { active = false; };
  }, [selectedCountry?.name]);

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
        const map = new sdk.Map({
          container: mapHostRef.current,
          style: sdk.MapStyle.DATAVIZ.DARK,
          center: selectedCommand.center,
          zoom: selectedCommand.zoom,
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

        map.on("ready", () => {
          if (cancelled) return;
          const sourceUrl = `${COUNTRY_SOURCE}?key=${encodeURIComponent(config.apiKey)}`;
          if (!map.getSource("aor-countries")) map.addSource("aor-countries", { type: "vector", url: sourceUrl });
          const layers = map.getStyle()?.layers || [];
          const firstSymbol = layers.find((layer: any) => layer.type === "symbol")?.id;
          const before = firstSymbol || undefined;

          COMMANDS.forEach((item) => {
            map.addLayer({ id: `aor-fill-${item.id}`, type: "fill", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(item.countries), paint: { "fill-color": item.color, "fill-opacity": item.id === command ? 0.18 : 0.08 } }, before);
            map.addLayer({ id: `aor-line-${item.id}`, type: "line", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(item.countries), paint: { "line-color": item.color, "line-width": item.id === command ? 1.8 : 0.8, "line-opacity": item.id === command ? 0.82 : 0.42 } }, before);
          });
          map.addLayer({ id: "aor-active-glow", type: "line", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(selectedCommand.countries), paint: { "line-color": "#6feeff", "line-width": 7, "line-opacity": 0.18, "line-blur": 3 } }, before);
          map.addLayer({ id: "aor-active-line", type: "line", source: "aor-countries", "source-layer": "administrative", filter: countryFilter(selectedCommand.countries), paint: { "line-color": "#c8fbff", "line-width": 2.2, "line-opacity": 0.95 } }, before);
          map.addLayer({ id: "aor-selected-country-fill", type: "fill", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_COUNTRY_FILTER, paint: { "fill-color": "#66f2d0", "fill-opacity": 0.24 } }, before);
          map.addLayer({ id: "aor-selected-country-line", type: "line", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_COUNTRY_FILTER, paint: { "line-color": "#e1fff7", "line-width": 3.2, "line-opacity": 1 } }, before);
          map.addLayer({ id: "aor-country-hit", type: "fill", source: "aor-countries", "source-layer": "administrative", filter: ["==", "level", 0], paint: { "fill-color": "#ffffff", "fill-opacity": 0.001 } }, before);
          map.addSource("aor-live-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "aor-live-events-glow", type: "circle", source: "aor-live-events", paint: { "circle-radius": 10, "circle-color": ["match", ["get", "kind"], "GDACS", "#8e77ff", "#57e3f1"], "circle-opacity": 0.18 } });
          map.addLayer({ id: "aor-live-events-points", type: "circle", source: "aor-live-events", paint: { "circle-radius": ["match", ["get", "kind"], "GDACS", 5.5, 4.5], "circle-color": ["match", ["get", "kind"], "GDACS", "#9d87ff", "#5be3ec"], "circle-stroke-color": "#e7fdff", "circle-stroke-width": 1.1, "circle-opacity": 0.94 } });

          map.on("mousemove", "aor-country-hit", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "aor-country-hit", () => { map.getCanvas().style.cursor = ""; });
          map.on("click", "aor-country-hit", (event: any) => {
            const properties = event.features?.[0]?.properties ?? {};
            const iso2 = String(properties.iso_a2 || "").toUpperCase();
            const name = String(properties.name || iso2 || "Selected country");
            const mapped = COMMAND_BY_COUNTRY.get(iso2);
            if (mapped) setCommand(mapped.id);
            setCountryQuery(name);
            setSelectedCountry({ name, iso2 });
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
        });
        map.on("idle", markReady);
        map.on("error", (event: any) => {
          const message = event?.error?.message || "MapTiler resource failed.";
          if (!cancelled && mapStatus !== "ready") setMapError(message);
        });
        readinessTimer = window.setTimeout(() => {
          if (cancelled) return;
          const canvas = map.getCanvas?.();
          if (!canvas || canvas.width < 50 || canvas.height < 50 || !map.areTilesLoaded?.()) {
            setMapStatus("error");
            setMapError((current) => current || "MapTiler initialized, but the basemap tiles did not finish rendering. Check key restrictions and tile access for this Render domain.");
          } else {
            markReady();
          }
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
    if (!mapRef.current) return;
    const filter = countryFilter(selectedCommand.countries);
    if (mapRef.current.getLayer?.("aor-active-glow")) mapRef.current.setFilter("aor-active-glow", filter);
    if (mapRef.current.getLayer?.("aor-active-line")) mapRef.current.setFilter("aor-active-line", filter);
    mapRef.current.easeTo?.({ center: selectedCommand.center, zoom: selectedCommand.zoom, duration: 650 });
  }, [selectedCommand]);

  useEffect(() => {
    if (!mapRef.current) return;
    const filter = selectedCountry?.iso2 ? countryFilter([selectedCountry.iso2]) : EMPTY_COUNTRY_FILTER;
    if (mapRef.current.getLayer?.("aor-selected-country-fill")) mapRef.current.setFilter("aor-selected-country-fill", filter);
    if (mapRef.current.getLayer?.("aor-selected-country-line")) mapRef.current.setFilter("aor-selected-country-line", filter);
  }, [selectedCountry]);

  const strictQuakes = useMemo(() => {
    const quakes = data?.earthquakes || [];
    if (!selectedCountry) return quakes.slice(0, 6);
    const needle = normalize(selectedCountry.name);
    return quakes.filter((item) => normalize(`${item.place || ""} ${item.title || ""}`).includes(needle)).slice(0, 6);
  }, [data?.earthquakes, selectedCountry]);
  const countryWho = selectedCountry ? (countrySources.who.data?.outbreaks || []).slice(0, 6) : (data?.outbreaks || []).slice(0, 6);
  const countryGdacs = selectedCountry ? (countrySources.gdacs.data?.events || []).slice(0, 6) : (data?.disasters || []).slice(0, 6);
  const crisisUpdates = selectedCountry ? (countrySources.crisiswatch.data?.updates || []).slice(0, 6) : [];
  const advisory = countrySources.travel.data?.advisory;

  const eventGeoJson = useMemo(() => {
    const features: any[] = [];
    const disasters = selectedCountry ? countryGdacs : (data?.disasters || []);
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
  }, [countryGdacs, data?.disasters, selectedCountry, strictQuakes]);

  useEffect(() => {
    mapRef.current?.getSource?.("aor-live-events")?.setData?.(eventGeoJson);
  }, [eventGeoJson]);

  async function resolveCountrySearch() {
    const query = countryQuery.trim();
    if (!query) return;
    setCountrySearchLoading(true);
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
  function chooseCommand(id: CommandId) {
    setCommand(id);
    setCountryQuery("");
    setSelectedCountry(null);
    setCountrySources(emptyCountrySources());
  }

  const sourceHealth = new Map((data?.sourceHealth || []).map((item) => [item.provider, item]));
  const stateStatus = !selectedCountry ? { status: "loading" as const, note: "Select a country" } : countrySources.travel.loading ? { status: "loading" as const, note: "Loading" } : countrySources.travel.error ? { status: "warn" as const, note: countrySources.travel.error } : { status: "ok" as const, note: "Country feed loaded" };
  const crisisStatus = !selectedCountry ? { status: "loading" as const, note: "Select a country" } : countrySources.crisiswatch.loading ? { status: "loading" as const, note: "Loading" } : countrySources.crisiswatch.error ? { status: "warn" as const, note: countrySources.crisiswatch.error } : { status: "ok" as const, note: "Country feed loaded" };

  return (
    <main className="aurora-bg min-h-screen pb-16 text-white">
      <Sidebar />
      <section className="relative z-10 px-4 py-6 pt-24 lg:ml-[210px] lg:px-8 lg:pt-6 xl:px-10">
        <HeaderBar eyebrow="Operational / Environmental Intelligence" title="AOR Factors" subtitle="One operating picture. Every country scan, command feed, travel advisory, outbreak, hazard, seismic event, conflict update, and human-performance factor stays tied to the same map-selected geography." />

        <Surface className="overflow-hidden">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/45">Combatant command</p><div className="mt-2 flex flex-wrap gap-2">{COMMANDS.map((item) => <button key={item.id} type="button" onClick={() => chooseCommand(item.id)} className={`min-h-9 rounded-xl border px-3 text-[10px] font-black transition ${command === item.id ? "border-cyan-100/38 bg-cyan-300/[0.13] text-white" : "border-white/11 bg-white/[0.025] text-cyan-100/50 hover:border-white/20 hover:text-white"}`}>{item.label}</button>)}</div></div>
            <div className="min-w-0 xl:w-[380px]"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/45">Country / operating area</p><div className="mt-2 flex gap-2"><label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/14 bg-white/[0.035] px-3 focus-within:border-cyan-100/30"><Search size={14} className="shrink-0 text-cyan-100/42" /><input value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void resolveCountrySearch(); }} placeholder="Search or click a country" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-cyan-100/28" /></label><button type="button" onClick={() => void resolveCountrySearch()} disabled={!countryQuery.trim() || countrySearchLoading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-100/24 bg-cyan-300/[0.08] px-3 text-[10px] font-black disabled:opacity-40">{countrySearchLoading ? <Loader2 size={13} className="animate-spin" /> : <RadioTower size={13} />}Scan</button></div></div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="AOR source status">
            <SourceChip label="MapTiler" status={mapStatus === "ready" ? "ok" : mapStatus === "error" ? "warn" : "loading"} note={mapStatus === "ready" ? "Basemap + country tiles rendered" : mapStatus === "error" ? mapError : "Rendering basemap"} />
            {["WHO Disease Outbreak News", "GDACS", "USGS Earthquake Catalog"].map((provider) => { const source = sourceHealth.get(provider); return <SourceChip key={provider} label={provider.replace(" Disease Outbreak News", "").replace(" Earthquake Catalog", "")} status={loading ? "loading" : source?.ok ? "ok" : "warn"} note={loading ? "Refreshing" : source?.ok ? `${source.count} command matches` : source?.error || "Unavailable"} />; })}
            <SourceChip label="State Travel" status={stateStatus.status} note={stateStatus.note} />
            <SourceChip label="CrisisWatch" status={crisisStatus.status} note={crisisStatus.note} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
            <div className="min-w-0 space-y-4">
              <div className="overflow-hidden rounded-[24px] border border-white/13 bg-[#020812]/76 shadow-[0_22px_65px_rgba(0,0,0,.34)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/9 px-4 py-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Selected operating picture</p><h2 className="mt-1 text-lg font-black">{contextLabel}</h2><p className="mt-1 max-w-3xl text-[10px] leading-4 text-cyan-100/42">{selectedCountry ? `${selectedCountry.name} alone drives the country-specific inspector. No command-wide fallback is substituted when a country has no matching event.` : selectedCommand.scope}</p></div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${data?.partial ? "border-amber-200/18 bg-amber-300/[0.06] text-amber-50/78" : "border-emerald-200/18 bg-emerald-300/[0.06] text-emerald-50/78"}`}>{loading ? "Refreshing" : data?.partial ? "Partial coverage" : "Sources live"}</span></div>
                <div className="relative h-[650px] bg-[#020812]" data-testid="aor-map-shell">
                  <div ref={mapHostRef} className="aor-map-tiler-host absolute inset-0" aria-label="Interactive MapTiler AOR intelligence map" />
                  {mapStatus !== "ready" ? <div className="absolute inset-0 z-20 grid place-items-center bg-[#020812]/82 p-6 text-center backdrop-blur-sm">{mapStatus === "loading" ? <div><Loader2 className="mx-auto animate-spin text-cyan-200/70" size={24} /><p className="mt-3 text-xs text-cyan-100/50">Rendering MapTiler basemap and command layers…</p></div> : <div><AlertTriangle className="mx-auto text-amber-200/70" size={24} /><p className="mt-3 text-sm font-black text-amber-50/82">Map rendering failed</p><p className="mt-2 max-w-lg text-[10px] leading-5 text-amber-100/52">{mapError}</p></div>}</div> : null}
                  <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[78%] rounded-xl border border-white/10 bg-[#020812]/82 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.1em] text-cyan-50/56 backdrop-blur-xl"><span className="mr-3 inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-violet-300" />GDACS</span><span className="mr-3 inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-cyan-300" />USGS</span>Click a country to synchronize every country intelligence feed.</div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/13 bg-[#04101c]/58 p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] backdrop-blur-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-100/44">Environmental / human-performance load</p><h2 className="mt-1 text-base font-black">Work conditions for {contextLabel}</h2></div><Activity size={17} className="text-violet-100/48" /></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(ENVIRONMENT_LABELS) as EnvironmentKey[]).map((key) => <button key={key} type="button" aria-pressed={environment[key]} onClick={() => setEnvironment((current) => ({ ...current, [key]: !current[key] }))} className={`min-h-10 rounded-xl border px-3 text-left text-[10px] font-bold ${environment[key] ? "border-violet-200/26 bg-violet-300/[0.10] text-white" : "border-white/10 bg-white/[0.025] text-cyan-100/48"}`}>{ENVIRONMENT_LABELS[key]}</button>)}</div><div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">{selectedEnvironment.length ? <div className="grid gap-2 md:grid-cols-2">{selectedEnvironment.map((key) => <p key={key} className="text-[10px] leading-5 text-cyan-100/50"><strong className="text-violet-100/72">{ENVIRONMENT_LABELS[key]}:</strong> {ENVIRONMENT_PROMPTS[key]}</p>)}</div> : <p className="text-[10px] leading-5 text-cyan-100/40">Select only conditions actually present at the mapped operating location. These remain separate evidence factors rather than a fabricated score.</p>}</div></div>
            </div>

            <aside className="max-h-[930px] overflow-y-auto overscroll-contain rounded-[24px] border border-white/13 bg-[#03101b]/64 p-4 shadow-[0_20px_60px_rgba(0,0,0,.28)] backdrop-blur-2xl" aria-label="Map-linked intelligence inspector">
              <div className="flex items-start justify-between gap-3 pb-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Map-linked intelligence inspector</p><h2 className="mt-1 text-lg font-black">{selectedCountry?.name || selectedCommand.label}</h2><p className="mt-1 text-[10px] leading-4 text-cyan-100/40">{selectedCountry ? `Country-only intelligence for ${selectedCountry.name}.` : "Command-wide operational intelligence. Select a country for strict country-only feeds."}</p></div><Layers3 size={18} className="text-cyan-100/46" /></div>
              {error ? <div className="mb-3 rounded-xl border border-amber-200/15 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100/70"><AlertTriangle size={13} className="mr-2 inline" />{error}</div> : null}

              <InspectorSection title="U.S. Department of State Travel Advisory" icon={<ShieldAlert size={14} className="text-cyan-200/62" />}>{!selectedCountry ? <EmptyIntel>Select a country to load its travel advisory.</EmptyIntel> : countrySources.travel.loading ? <EmptyIntel>Loading travel advisory…</EmptyIntel> : countrySources.travel.error ? <EmptyIntel>{countrySources.travel.error}</EmptyIntel> : advisory ? <div className="space-y-2"><div className="rounded-xl border border-cyan-100/12 bg-cyan-300/[0.04] p-3"><p className="text-[9px] uppercase tracking-[0.15em] text-cyan-100/40">Travel posture</p><p className="mt-1 text-base font-black">Level {advisory.level} · {advisory.levelLabel}</p><p className="mt-2 text-[10px] leading-4 text-cyan-100/48">{advisory.summary || advisory.details || "Review the official advisory."}</p></div>{externalUrl(advisory.sourceUrl || countrySources.travel.data?.sourceUrl) ? <a href={externalUrl(advisory.sourceUrl || countrySources.travel.data?.sourceUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-200/64">Open official advisory<ArrowUpRight size={10} /></a> : null}</div> : <EmptyIntel>No advisory payload returned.</EmptyIntel>}</InspectorSection>

              <InspectorSection title="WHO Disease Outbreaks" icon={<HeartPulse size={14} className="text-violet-200/64" />}>{selectedCountry && countrySources.who.loading ? <EmptyIntel>Loading WHO country matches…</EmptyIntel> : selectedCountry && countrySources.who.error ? <EmptyIntel>{countrySources.who.error}</EmptyIntel> : countryWho.length ? <div className="space-y-2">{countryWho.map((item: any, index: number) => <IntelItem key={item.id || index} title={item.title || "WHO Disease Outbreak News"} meta={formatDate(item.publicationDate || item.publishedAt)} summary={item.summary} href={item.sourceUrl || item.url} />)}</div> : <EmptyIntel>{selectedCountry ? `WHO returned no text-matched outbreak item for ${selectedCountry.name}; unrelated outbreaks are not substituted.` : "No recent WHO item matched this command."}</EmptyIntel>}</InspectorSection>

              <InspectorSection title="GDACS Natural Hazards" icon={<CloudLightning size={14} className="text-violet-200/64" />}>{selectedCountry && countrySources.gdacs.loading ? <EmptyIntel>Loading GDACS country matches…</EmptyIntel> : selectedCountry && countrySources.gdacs.error ? <EmptyIntel>{countrySources.gdacs.error}</EmptyIntel> : countryGdacs.length ? <div className="space-y-2">{countryGdacs.map((item: any, index: number) => <IntelItem key={`${item.eventType || "event"}-${item.eventId || item.id || index}`} title={item.name || item.title || "GDACS event"} meta={`${item.alertLevel || "Alert level n/a"} · ${formatDate(item.fromDate)}`} summary={item.description || item.country} href={item.sourceUrl || item.url} />)}</div> : <EmptyIntel>{selectedCountry ? `No GDACS event whose returned country metadata matches ${selectedCountry.name}.` : "No recent GDACS event matched this command."}</EmptyIntel>}</InspectorSection>

              <InspectorSection title="USGS Seismic Activity" icon={<Waves size={14} className="text-cyan-200/64" />}>{strictQuakes.length ? <div className="space-y-2">{strictQuakes.map((item: any, index: number) => <IntelItem key={item.id || index} title={item.title || item.place || "USGS earthquake"} meta={`${item.magnitude == null ? "Magnitude n/a" : `M${item.magnitude}`} · ${formatDate(item.occurredAt)}`} summary={item.depthKm == null ? undefined : `${item.depthKm} km depth`} href={item.url} />)}</div> : <EmptyIntel>{selectedCountry ? `No command-feed earthquake place text matched ${selectedCountry.name}; command-wide earthquakes are not substituted.` : "No recent USGS earthquake matched this command."}</EmptyIntel>}</InspectorSection>

              <InspectorSection title="International Crisis Group CrisisWatch" icon={<RadioTower size={14} className="text-violet-200/64" />}>{!selectedCountry ? <EmptyIntel>Select a country to load CrisisWatch context.</EmptyIntel> : countrySources.crisiswatch.loading ? <EmptyIntel>Loading CrisisWatch…</EmptyIntel> : countrySources.crisiswatch.error ? <EmptyIntel>{countrySources.crisiswatch.error}</EmptyIntel> : crisisUpdates.length ? <div className="space-y-2">{crisisUpdates.map((item: any, index: number) => <IntelItem key={item.id || index} title={item.title || item.headline || "CrisisWatch update"} meta={formatDate(item.publishedAt || item.date)} summary={item.summary || item.description} href={item.url || item.sourceUrl} />)}</div> : <EmptyIntel>No readable CrisisWatch item matched this country.</EmptyIntel>}</InspectorSection>

              <p className="border-t border-white/9 pt-4 text-[9px] leading-4 text-cyan-100/34">Travel advisories, WHO reporting, GDACS alerts, USGS events, CrisisWatch analysis, and environmental prompts retain their own definitions and timestamps. Geography is synchronized; the tool does not fabricate a composite danger score.</p>
            </aside>
          </div>
        </Surface>
      </section>
    </main>
  );
}
