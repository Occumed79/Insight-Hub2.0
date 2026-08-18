import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CloudLightning,
  HeartPulse,
  Layers3,
  Loader2,
  MapPinned,
  RadioTower,
  Search,
  ShieldAlert,
  Waves,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

declare global {
  interface Window {
    maptilersdk?: any;
  }
}

const MAPTILER_VERSION = "4.0.2";
const MAPTILER_SCRIPT = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.umd.min.js`;
const MAPTILER_CSS = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.css`;
const COUNTRY_SOURCE = "https://api.maptiler.com/tiles/countries/tiles.json";

const COMMANDS = [
  {
    id: "northcom",
    label: "USNORTHCOM",
    scope: "United States, Canada, Mexico, Greenland, The Bahamas, and assigned approaches",
    mapView: { center: [-101, 46] as [number, number], zoom: 1.55 },
    color: "#4f9aaa",
    countryIso2: ["US", "CA", "MX", "GL", "BS", "PR", "VI"],
  },
  {
    id: "southcom",
    label: "USSOUTHCOM",
    scope: "Central America, South America, the Caribbean, and adjacent approaches",
    mapView: { center: [-67, -9] as [number, number], zoom: 1.7 },
    color: "#4f927f",
    countryIso2: [
      "AG", "AR", "BB", "BZ", "BO", "BR", "CL", "CO", "CR", "CU", "DM", "DO", "EC", "SV", "GD", "GT", "GY", "HT", "HN", "JM", "NI", "PA", "PY", "PE", "KN", "LC", "VC", "SR", "TT", "UY", "VE",
    ],
  },
  {
    id: "eucom",
    label: "USEUCOM",
    scope: "Europe and assigned portions of Eurasia, the Arctic, Atlantic, and adjoining approaches",
    mapView: { center: [21, 52] as [number, number], zoom: 2.15 },
    color: "#7485a5",
    countryIso2: [
      "AL", "AD", "AM", "AT", "AZ", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "GE", "DE", "GR", "HU", "IS", "IE", "IT", "XK", "LV", "LI", "LT", "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL", "PT", "RO", "RU", "SM", "RS", "SK", "SI", "ES", "SE", "CH", "TR", "UA", "GB", "VA",
    ],
  },
  {
    id: "africom",
    label: "USAFRICOM",
    scope: "The African continent, island nations, and surrounding waters, except Egypt",
    mapView: { center: [19, 3] as [number, number], zoom: 1.8 },
    color: "#8d8068",
    countryIso2: [
      "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW",
    ],
  },
  {
    id: "centcom",
    label: "USCENTCOM",
    scope: "Twenty-one nations across the Middle East and Central and South Asia, including Egypt",
    mapView: { center: [53, 30] as [number, number], zoom: 2.25 },
    color: "#a97567",
    countryIso2: ["AF", "BH", "EG", "IR", "IQ", "IL", "JO", "KZ", "KW", "KG", "LB", "OM", "PK", "QA", "SA", "SY", "TJ", "TM", "AE", "UZ", "YE"],
  },
  {
    id: "indopacom",
    label: "USINDOPACOM",
    scope: "The Indo-Pacific from India through East Asia, Australia, and Pacific island nations",
    mapView: { center: [142, 13] as [number, number], zoom: 1.45 },
    color: "#6577a8",
    countryIso2: [
      "AU", "BD", "BT", "BN", "KH", "CN", "TW", "FJ", "IN", "ID", "JP", "KI", "LA", "MY", "MV", "MH", "FM", "MN", "MM", "NR", "NP", "NZ", "KP", "PW", "PG", "PH", "WS", "SG", "SB", "KR", "LK", "TH", "TL", "TO", "TV", "VU", "VN",
    ],
  },
] as const;

type CommandId = (typeof COMMANDS)[number]["id"];
type EnvironmentKey = "heat" | "cold" | "altitude" | "poorAir" | "fatigue" | "ppe" | "night";
type EnvironmentState = Record<EnvironmentKey, boolean>;
type SourceReadiness = { id: string; name: string; configured: boolean; live: boolean; requirement: string | null };
type SourceResult = { data: any; error: string; loading: boolean };
type CountrySources = { travel: SourceResult; who: SourceResult; gdacs: SourceResult; crisiswatch: SourceResult };
type SelectedCountry = { name: string; iso2: string };
type AorResponse = {
  ok: boolean;
  command: CommandId;
  commandLabel: string;
  retrievedAt: string;
  partial: boolean;
  sourceHealth: Array<{ provider: string; ok: boolean; count: number; error?: string }>;
  outbreaks: Array<{ id: string; title: string; publishedAt: string; summary: string; matchedArea: string; url: string }>;
  disasters: Array<{ id: string; title: string; eventType: string; country: string; alertLevel: string; fromDate: string; toDate: string; latitude: number | null; longitude: number | null; url: string }>;
  earthquakes: Array<{ id: string; title: string; place: string; magnitude: number | null; occurredAt: string; url: string; tsunami: boolean; latitude: number | null; longitude: number | null; depthKm: number | null }>;
};

const COMMAND_BY_COUNTRY = new Map(
  COMMANDS.flatMap((command) => command.countryIso2.map((iso2) => [iso2, command] as const)),
);
const ALL_COUNTRIES_FILTER = ["==", ["get", "level"], 0];
const EMPTY_COUNTRY_FILTER = ["==", ["get", "iso_a2"], "__NONE__"];
const countryFilter = (iso2s: readonly string[]) => [
  "all",
  ALL_COUNTRIES_FILTER,
  ["in", ["get", "iso_a2"], ["literal", [...iso2s]]],
];

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

function emptyResult(): SourceResult {
  return { data: null, error: "", loading: false };
}
function emptyCountrySources(): CountrySources {
  return { travel: emptyResult(), who: emptyResult(), gdacs: emptyResult(), crisiswatch: emptyResult() };
}
function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function formatDate(value?: string | null) {
  if (!value) return "Date not supplied";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function externalUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}
async function loadJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && payload?.configured !== false) {
    throw new Error(payload?.error || `Request failed (${response.status}).`);
  }
  return payload;
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Source request failed.";
}

function loadMapTilerSdk() {
  if (window.maptilersdk) return Promise.resolve(window.maptilersdk);
  if (!document.querySelector(`link[href="${MAPTILER_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MAPTILER_CSS;
    document.head.appendChild(link);
  }
  return new Promise<any>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-maptiler-sdk="true"]');
    const finish = () => window.maptilersdk ? resolve(window.maptilersdk) : reject(new Error("MapTiler SDK did not initialize."));
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load MapTiler SDK.")), { once: true });
      if (window.maptilersdk) finish();
      return;
    }
    const script = document.createElement("script");
    script.src = MAPTILER_SCRIPT;
    script.async = true;
    script.dataset.maptilerSdk = "true";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load MapTiler SDK.")), { once: true });
    document.head.appendChild(script);
  });
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard variant="glass" className={`border border-white/22 bg-white/[0.06] p-[1px] shadow-[0_24px_72px_rgba(0,0,0,.28),0_0_34px_rgba(186,230,253,.07)] backdrop-blur-3xl ${className}`}>
      <div className="h-full rounded-[27px] border border-white/[0.13] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.16)] md:p-5">{children}</div>
    </GlassCard>
  );
}

function SourceChip({ label, status, note }: { label: string; status: "ok" | "warn" | "loading"; note: string }) {
  const tone = status === "ok"
    ? "border-emerald-200/16 bg-emerald-300/[0.05] text-emerald-50/82"
    : status === "warn"
      ? "border-amber-200/16 bg-amber-300/[0.05] text-amber-50/78"
      : "border-cyan-200/16 bg-cyan-300/[0.05] text-cyan-50/72";
  return (
    <div className={`min-w-[132px] flex-1 rounded-xl border px-3 py-2 ${tone}`}>
      <div className="flex items-center gap-2"><i className={`h-1.5 w-1.5 rounded-full ${status === "ok" ? "bg-emerald-300" : status === "warn" ? "bg-amber-300" : "bg-cyan-300"}`} /><strong className="text-[10px]">{label}</strong></div>
      <p className="mt-1 truncate text-[9px] opacity-60">{note}</p>
    </div>
  );
}

function InspectorSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-white/9 py-4 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2 text-white">{icon}<h3 className="text-sm font-black">{title}</h3></div>
      {children}
    </section>
  );
}

function IntelItem({ title, meta, summary, href }: { title: string; meta?: string; summary?: string; href?: string }) {
  const url = externalUrl(href);
  const content = (
    <div className="rounded-xl border border-white/9 bg-white/[0.025] p-3 transition hover:border-cyan-100/20 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-2"><strong className="text-[11px] leading-4 text-white/88">{title}</strong>{url ? <ArrowUpRight size={11} className="mt-0.5 shrink-0 text-cyan-100/48" /> : null}</div>
      {meta ? <p className="mt-1 text-[9px] text-cyan-100/40">{meta}</p> : null}
      {summary ? <p className="mt-2 line-clamp-3 text-[10px] leading-4 text-cyan-100/48">{summary}</p> : null}
    </div>
  );
  return url ? <a href={url} target="_blank" rel="noreferrer" className="block">{content}</a> : content;
}

function EmptyIntel({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[10px] leading-5 text-cyan-100/40">{children}</p>;
}

export default function ReviewerAorFactorsPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapKeyRef = useRef("");
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mapError, setMapError] = useState("");
  const [command, setCommand] = useState<CommandId>("centcom");
  const [data, setData] = useState<AorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const [countrySearchLoading, setCountrySearchLoading] = useState(false);
  const [countrySources, setCountrySources] = useState<CountrySources>(() => emptyCountrySources());
  const [readiness, setReadiness] = useState<SourceReadiness[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentState>({ heat: false, cold: false, altitude: false, poorAir: false, fatigue: false, ppe: false, night: false });

  const selected = COMMANDS.find((item) => item.id === command) ?? COMMANDS[4];
  const selectedEnvironment = (Object.keys(environment) as EnvironmentKey[]).filter((key) => environment[key]);
  const contextLabel = selectedCountry?.name ? `${selected.label} · ${selectedCountry.name}` : selected.label;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/reviewer-tools/aor?command=${command}`, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
        setData(payload as AorResponse);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [command]);

  useEffect(() => {
    void loadJson("/api/aor/source-readiness")
      .then((payload) => setReadiness((payload.sources || []).filter((source: SourceReadiness) => ["state", "who", "gdacs", "crisiswatch"].includes(source.id))))
      .catch(() => setReadiness([]));
  }, []);

  useEffect(() => {
    const countryName = selectedCountry?.name.trim();
    if (!countryName) {
      setCountrySources(emptyCountrySources());
      return;
    }
    let active = true;
    setCountrySources({
      travel: { data: null, error: "", loading: true },
      who: { data: null, error: "", loading: true },
      gdacs: { data: null, error: "", loading: true },
      crisiswatch: { data: null, error: "", loading: true },
    });
    const encoded = encodeURIComponent(countryName);
    const requests = {
      travel: loadJson(`/api/public-data/aor-risk?country=${encoded}`),
      who: loadJson(`/api/aor/health-outbreaks?country=${encoded}`),
      gdacs: loadJson(`/api/aor/disaster-alerts?country=${encoded}&days=90`),
      crisiswatch: loadJson(`/api/aor/crisiswatch?country=${encoded}`),
    };
    (Object.entries(requests) as Array<[keyof CountrySources, Promise<any>]>).forEach(([key, request]) => {
      request
        .then((payload) => {
          if (active) setCountrySources((current) => ({ ...current, [key]: { data: payload, error: payload?.error || "", loading: false } }));
        })
        .catch((reason) => {
          if (active) setCountrySources((current) => ({ ...current, [key]: { data: null, error: errorMessage(reason), loading: false } }));
        });
    });
    return () => { active = false; };
  }, [selectedCountry]);

  useEffect(() => {
    let cancelled = false;
    async function initializeMap() {
      try {
        if (!mapContainerRef.current) return;
        const configResponse = await fetch("/api/map-config", { cache: "no-store" });
        const config = await configResponse.json().catch(() => ({ configured: false, apiKey: "" }));
        if (!configResponse.ok || !config?.configured || !config?.apiKey) {
          throw new Error("MapTiler key is not configured on the Insight Hub 2 web service.");
        }
        mapKeyRef.current = config.apiKey;
        const sdk = await loadMapTilerSdk();
        if (cancelled || !mapContainerRef.current) return;
        sdk.config.apiKey = config.apiKey;
        const style = sdk.MapStyle?.DATAVIZ?.DARK ?? sdk.MapStyle?.STREETS?.DARK ?? sdk.MapStyle.STREETS;
        const map = new sdk.Map({
          container: mapContainerRef.current,
          style,
          center: selected.mapView.center,
          zoom: selected.mapView.zoom,
          minZoom: 0.75,
          maxZoom: 8,
          attributionControl: true,
        });
        mapRef.current = map;
        map.addControl(new sdk.NavigationControl({ showCompass: false }), "bottom-right");

        map.on("load", () => {
          if (cancelled) return;
          map.addSource("aor-countries", { type: "vector", url: COUNTRY_SOURCE });
          const firstSymbol = map.getStyle()?.layers?.find((layer: any) => layer.type === "symbol")?.id;
          const before = firstSymbol || undefined;

          COMMANDS.forEach((item) => {
            map.addLayer({
              id: `aor-fill-${item.id}`,
              type: "fill",
              source: "aor-countries",
              "source-layer": "administrative",
              filter: countryFilter(item.countryIso2),
              paint: { "fill-color": item.color, "fill-opacity": 0.2 },
            }, before);
            map.addLayer({
              id: `aor-line-${item.id}`,
              type: "line",
              source: "aor-countries",
              "source-layer": "administrative",
              filter: countryFilter(item.countryIso2),
              paint: { "line-color": item.color, "line-width": 1, "line-opacity": 0.72 },
            }, before);
          });

          map.addLayer({
            id: "aor-active-glow",
            type: "line",
            source: "aor-countries",
            "source-layer": "administrative",
            filter: countryFilter(selected.countryIso2),
            paint: { "line-color": "#72e7ff", "line-width": 7, "line-opacity": 0.18, "line-blur": 3 },
          }, before);
          map.addLayer({
            id: "aor-active-line",
            type: "line",
            source: "aor-countries",
            "source-layer": "administrative",
            filter: countryFilter(selected.countryIso2),
            paint: { "line-color": "#baf5ff", "line-width": 2.2, "line-opacity": 0.96 },
          }, before);
          map.addLayer({
            id: "aor-selected-country-fill",
            type: "fill",
            source: "aor-countries",
            "source-layer": "administrative",
            filter: EMPTY_COUNTRY_FILTER,
            paint: { "fill-color": "#7ff7dc", "fill-opacity": 0.2 },
          }, before);
          map.addLayer({
            id: "aor-selected-country-line",
            type: "line",
            source: "aor-countries",
            "source-layer": "administrative",
            filter: EMPTY_COUNTRY_FILTER,
            paint: { "line-color": "#d5fff4", "line-width": 3.2, "line-opacity": 1 },
          }, before);
          map.addLayer({
            id: "aor-country-hit",
            type: "fill",
            source: "aor-countries",
            "source-layer": "administrative",
            filter: ALL_COUNTRIES_FILTER,
            paint: { "fill-color": "#ffffff", "fill-opacity": 0.001 },
          }, before);

          map.addSource("aor-live-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "aor-live-events-glow",
            type: "circle",
            source: "aor-live-events",
            paint: { "circle-radius": 10, "circle-color": ["match", ["get", "kind"], "GDACS", "#f4b85a", "#68d7ff"], "circle-opacity": 0.13 },
          });
          map.addLayer({
            id: "aor-live-events-points",
            type: "circle",
            source: "aor-live-events",
            paint: {
              "circle-radius": ["match", ["get", "kind"], "GDACS", 5.5, 4.5],
              "circle-color": ["match", ["get", "kind"], "GDACS", "#f4b85a", "#68d7ff"],
              "circle-stroke-color": "#d8fbff",
              "circle-stroke-width": 1.2,
              "circle-opacity": 0.92,
            },
          });

          map.on("mousemove", "aor-country-hit", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "aor-country-hit", () => { map.getCanvas().style.cursor = ""; });
          map.on("click", "aor-country-hit", (event: any) => {
            const properties = event.features?.[0]?.properties ?? {};
            const iso2 = String(properties.iso_a2 || properties.iso2 || "").toUpperCase();
            const name = String(properties.name_en || properties.name || properties.name_int || iso2 || "Selected country");
            const mappedCommand = COMMAND_BY_COUNTRY.get(iso2);
            if (mappedCommand) setCommand(mappedCommand.id);
            setCountryQuery(name);
            setSelectedCountry({ name, iso2 });
          });
          map.on("click", "aor-live-events-points", (event: any) => {
            const url = externalUrl(String(event.features?.[0]?.properties?.url || ""));
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          });
          map.on("mouseenter", "aor-live-events-points", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "aor-live-events-points", () => { map.getCanvas().style.cursor = ""; });
          setMapStatus("ready");
        });
        map.on("error", (event: any) => {
          if (!cancelled && event?.error?.message) setMapError(event.error.message);
        });
      } catch (reason) {
        if (!cancelled) {
          setMapStatus("error");
          setMapError(errorMessage(reason));
        }
      }
    }
    void initializeMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current) return;
    const filter = countryFilter(selected.countryIso2);
    if (mapRef.current.getLayer?.("aor-active-glow")) mapRef.current.setFilter("aor-active-glow", filter);
    if (mapRef.current.getLayer?.("aor-active-line")) mapRef.current.setFilter("aor-active-line", filter);
    mapRef.current.easeTo?.({ center: selected.mapView.center, zoom: selected.mapView.zoom, duration: 650 });
  }, [selected, mapStatus]);

  useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current) return;
    const filter = selectedCountry?.iso2 ? countryFilter([selectedCountry.iso2]) : EMPTY_COUNTRY_FILTER;
    if (mapRef.current.getLayer?.("aor-selected-country-fill")) mapRef.current.setFilter("aor-selected-country-fill", filter);
    if (mapRef.current.getLayer?.("aor-selected-country-line")) mapRef.current.setFilter("aor-selected-country-line", filter);
  }, [selectedCountry, mapStatus]);

  const eventGeoJson = useMemo(() => {
    const features: any[] = [];
    (data?.disasters || []).forEach((item) => {
      if (item.latitude == null || item.longitude == null) return;
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [item.longitude, item.latitude] }, properties: { kind: "GDACS", title: item.title, url: item.url } });
    });
    (data?.earthquakes || []).forEach((item) => {
      if (item.latitude == null || item.longitude == null) return;
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [item.longitude, item.latitude] }, properties: { kind: "USGS", title: item.title, url: item.url } });
    });
    const countryEvents = countrySources.gdacs.data?.events || [];
    countryEvents.forEach((item: any) => {
      const lat = Number(item.latitude ?? item.lat);
      const lng = Number(item.longitude ?? item.lon ?? item.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { kind: "GDACS", title: item.name || item.title || "GDACS event", url: item.sourceUrl || item.url || "" } });
    });
    return { type: "FeatureCollection", features };
  }, [data, countrySources.gdacs.data]);

  useEffect(() => {
    if (mapStatus !== "ready" || !mapRef.current) return;
    mapRef.current.getSource?.("aor-live-events")?.setData?.(eventGeoJson);
  }, [eventGeoJson, mapStatus]);

  async function resolveCountrySearch() {
    const query = countryQuery.trim();
    if (!query) return;
    setCountrySearchLoading(true);
    let name = query;
    let iso2 = "";
    try {
      if (mapKeyRef.current) {
        const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(mapKeyRef.current)}&types=country&limit=1`, { headers: { Accept: "application/json" } });
        const payload = await response.json().catch(() => ({}));
        const feature = payload?.features?.[0];
        if (feature) {
          name = String(feature.text || feature.place_name || query).split(",")[0].trim() || query;
          const propertyCode = String(feature.properties?.country_code || feature.properties?.iso_a2 || "").toUpperCase();
          const idCode = String(feature.id || "").startsWith("country.") ? String(feature.id).split(".").pop()?.toUpperCase() || "" : "";
          iso2 = propertyCode || idCode;
          if (Array.isArray(feature.center) && feature.center.length >= 2) mapRef.current?.easeTo?.({ center: feature.center, zoom: 4, duration: 650 });
        }
      }
      const mappedCommand = COMMAND_BY_COUNTRY.get(iso2);
      if (mappedCommand) setCommand(mappedCommand.id);
      setSelectedCountry({ name, iso2 });
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

  const advisory = countrySources.travel.data?.advisory;
  const countryWho = countrySources.who.data?.outbreaks || [];
  const countryGdacs = countrySources.gdacs.data?.events || [];
  const crisisUpdates = countrySources.crisiswatch.data?.updates || [];
  const displayedWho = selectedCountry ? countryWho.slice(0, 5) : (data?.outbreaks || []).slice(0, 5);
  const displayedGdacs = selectedCountry && countryGdacs.length ? countryGdacs.slice(0, 5) : (data?.disasters || []).slice(0, 5);
  const displayedQuakes = useMemo(() => {
    const earthquakes = data?.earthquakes || [];
    if (!selectedCountry?.name) return earthquakes.slice(0, 5);
    const needle = normalize(selectedCountry.name);
    const matches = earthquakes.filter((item) => normalize(`${item.place} ${item.title}`).includes(needle));
    return (matches.length ? matches : earthquakes).slice(0, 5);
  }, [data?.earthquakes, selectedCountry]);

  const sourceHealth = new Map((data?.sourceHealth || []).map((item) => [item.provider, item]));
  const readinessMap = new Map(readiness.map((item) => [item.id, item]));

  return (
    <main className="aurora-bg min-h-screen pb-16 text-white">
      <Sidebar />
      <section className="relative z-10 px-4 py-6 pt-24 lg:ml-[210px] lg:px-8 lg:pt-6 xl:px-10">
        <HeaderBar
          eyebrow="Operational / Environmental Intelligence"
          title="AOR Factors"
          subtitle="One operating picture: command geography, country intelligence, WHO outbreaks, GDACS hazards, USGS seismic activity, travel/conflict context, and human-performance factors all tied to the same map selection."
        />

        <Surface className="overflow-hidden" data-testid="unified-aor-workspace">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/45">Combatant command</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COMMANDS.map((item) => (
                  <button key={item.id} type="button" onClick={() => chooseCommand(item.id)} className={`min-h-9 rounded-xl border px-3 text-[10px] font-black transition ${command === item.id ? "border-cyan-100/38 bg-cyan-300/[0.13] text-white shadow-[0_0_20px_rgba(34,211,238,.08)]" : "border-white/11 bg-white/[0.025] text-cyan-100/50 hover:border-white/20 hover:text-white"}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0 xl:w-[380px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/45">Country / operating area</p>
              <div className="mt-2 flex gap-2">
                <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/14 bg-white/[0.035] px-3 focus-within:border-cyan-100/30">
                  <Search size={14} className="shrink-0 text-cyan-100/42" />
                  <input value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void resolveCountrySearch(); }} placeholder="Search or click a country" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-cyan-100/28" />
                </label>
                <button type="button" onClick={() => void resolveCountrySearch()} disabled={!countryQuery.trim() || countrySearchLoading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-100/24 bg-cyan-300/[0.08] px-3 text-[10px] font-black disabled:opacity-40">
                  {countrySearchLoading ? <Loader2 size={13} className="animate-spin" /> : <RadioTower size={13} />}Scan
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="AOR source status">
            <SourceChip label="MapTiler" status={mapStatus === "ready" ? "ok" : mapStatus === "error" ? "warn" : "loading"} note={mapStatus === "ready" ? "Interactive AOR map live" : mapStatus === "error" ? mapError : "Loading map"} />
            {["WHO Disease Outbreak News", "GDACS", "USGS Earthquake Catalog"].map((provider) => {
              const source = sourceHealth.get(provider);
              return <SourceChip key={provider} label={provider.replace(" Disease Outbreak News", "").replace(" Earthquake Catalog", "")} status={loading ? "loading" : source?.ok ? "ok" : "warn"} note={loading ? "Refreshing" : source?.ok ? `${source.count} matched` : source?.error || "Unavailable"} />;
            })}
            {[
              ["state", "State Travel"],
              ["crisiswatch", "CrisisWatch"],
            ].map(([id, label]) => {
              const source = readinessMap.get(id);
              return <SourceChip key={id} label={label} status={!source ? "loading" : source.configured && source.live ? "ok" : "warn"} note={!source ? "Checking" : source.requirement || "Ready for country selection"} />;
            })}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
            <div className="min-w-0 space-y-4">
              <div className="overflow-hidden rounded-[24px] border border-white/13 bg-[#020812]/76 shadow-[0_22px_65px_rgba(0,0,0,.34)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/9 px-4 py-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Selected operating picture</p>
                    <h2 className="mt-1 text-lg font-black">{contextLabel}</h2>
                    <p className="mt-1 max-w-3xl text-[10px] leading-4 text-cyan-100/42">{selectedCountry?.name ? `${selectedCountry.name} is driving the country-specific travel, outbreak, disaster, and conflict feeds below.` : selected.scope}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${loading ? "border-cyan-200/16 bg-cyan-300/[0.05] text-cyan-50/68" : data?.partial ? "border-amber-200/18 bg-amber-300/[0.06] text-amber-50/78" : "border-emerald-200/18 bg-emerald-300/[0.06] text-emerald-50/78"}`}>{loading ? "Refreshing" : data?.partial ? "Partial coverage" : "Sources live"}</span>
                </div>
                <div className="relative h-[610px] bg-[#020812]" data-testid="aor-map-shell">
                  <div ref={mapContainerRef} className="absolute inset-0" aria-label="Interactive MapTiler AOR intelligence map" />
                  {mapStatus !== "ready" ? (
                    <div className="absolute inset-0 z-20 grid place-items-center bg-[#020812]/84 p-6 text-center backdrop-blur-sm">
                      {mapStatus === "loading" ? <div><Loader2 className="mx-auto animate-spin text-cyan-200/70" size={24} /><p className="mt-3 text-xs text-cyan-100/50">Loading MapTiler AOR layers…</p></div> : <div><AlertTriangle className="mx-auto text-amber-200/70" size={24} /><p className="mt-3 text-sm font-black text-amber-50/82">MapTiler unavailable</p><p className="mt-2 max-w-md text-[10px] leading-5 text-amber-100/52">{mapError}</p></div>}
                    </div>
                  ) : null}
                  <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[75%] rounded-xl border border-white/10 bg-[#020812]/82 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.1em] text-cyan-50/56 backdrop-blur-xl">
                    <span className="mr-3 inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-[#f4b85a]" />GDACS</span>
                    <span className="mr-3 inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-[#68d7ff]" />USGS</span>
                    Click any country to select it, identify its command, and run the country intelligence feeds.
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/13 bg-[#04101c]/58 p-4 shadow-[0_18px_50px_rgba(0,0,0,.24)] backdrop-blur-2xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-100/44">Environmental / human-performance load</p><h2 className="mt-1 text-base font-black">Work conditions for {contextLabel}</h2></div>
                  <Activity size={17} className="text-violet-100/48" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {(Object.keys(ENVIRONMENT_LABELS) as EnvironmentKey[]).map((key) => (
                    <button key={key} type="button" aria-pressed={environment[key]} onClick={() => setEnvironment((current) => ({ ...current, [key]: !current[key] }))} className={`min-h-10 rounded-xl border px-3 text-left text-[10px] font-bold transition ${environment[key] ? "border-violet-200/26 bg-violet-300/[0.10] text-white" : "border-white/10 bg-white/[0.025] text-cyan-100/48 hover:border-white/18"}`}>
                      {ENVIRONMENT_LABELS[key]}
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  {selectedEnvironment.length ? <div className="grid gap-2 md:grid-cols-2">{selectedEnvironment.map((key) => <p key={key} className="text-[10px] leading-5 text-cyan-100/50"><strong className="text-violet-100/72">{ENVIRONMENT_LABELS[key]}:</strong> {ENVIRONMENT_PROMPTS[key]}</p>)}</div> : <p className="text-[10px] leading-5 text-cyan-100/40">Select the environmental conditions actually present at the mapped operating location. These prompts remain separate evidence factors; they are not collapsed into a fabricated score.</p>}
                </div>
              </div>
            </div>

            <aside className="max-h-[870px] overflow-y-auto overscroll-contain rounded-[24px] border border-white/13 bg-[#03101b]/64 p-4 shadow-[0_20px_60px_rgba(0,0,0,.28)] backdrop-blur-2xl" aria-label="Map-linked intelligence inspector">
              <div className="flex items-start justify-between gap-3 pb-4">
                <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Map-linked intelligence inspector</p><h2 className="mt-1 text-lg font-black">{selectedCountry?.name || selected.label}</h2><p className="mt-1 text-[10px] leading-4 text-cyan-100/40">{selectedCountry ? `Country scan active inside ${selected.label}.` : "Select a country on the map for travel and conflict detail, or review command-wide sources now."}</p></div>
                <Layers3 size={18} className="text-cyan-100/46" />
              </div>

              {error ? <div className="mb-3 rounded-xl border border-amber-200/15 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100/70"><AlertTriangle size={13} className="mr-2 inline" />{error}</div> : null}

              <InspectorSection title="U.S. Department of State Travel Advisory" icon={<ShieldAlert size={14} className="text-cyan-200/62" />}>
                {!selectedCountry ? <EmptyIntel>Click or search a country on the map to load its State Department travel advisory.</EmptyIntel> : countrySources.travel.loading ? <EmptyIntel>Loading travel advisory…</EmptyIntel> : countrySources.travel.error ? <EmptyIntel>{countrySources.travel.error}</EmptyIntel> : advisory ? (
                  <div className="space-y-2">
                    <div className="rounded-xl border border-cyan-100/12 bg-cyan-300/[0.04] p-3"><p className="text-[9px] uppercase tracking-[0.15em] text-cyan-100/40">Travel posture</p><p className="mt-1 text-base font-black">Level {advisory.level} · {advisory.levelLabel}</p><p className="mt-2 text-[10px] leading-4 text-cyan-100/48">{advisory.summary || advisory.details || "Review the official advisory for current guidance."}</p></div>
                    {externalUrl(advisory.sourceUrl || countrySources.travel.data?.sourceUrl) ? <a href={externalUrl(advisory.sourceUrl || countrySources.travel.data?.sourceUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-200/64">Open official advisory<ArrowUpRight size={10} /></a> : null}
                  </div>
                ) : <EmptyIntel>No advisory payload returned for this country.</EmptyIntel>}
              </InspectorSection>

              <InspectorSection title="WHO Disease Outbreaks" icon={<HeartPulse size={14} className="text-rose-200/64" />}>
                {selectedCountry && countrySources.who.loading ? <EmptyIntel>Loading WHO country matches…</EmptyIntel> : selectedCountry && countrySources.who.error ? <EmptyIntel>{countrySources.who.error}</EmptyIntel> : displayedWho.length ? <div className="space-y-2">{displayedWho.map((item: any, index: number) => <IntelItem key={item.id || index} title={item.title || "WHO Disease Outbreak News"} meta={`${formatDate(item.publicationDate || item.publishedAt)}${item.matchedArea ? ` · ${item.matchedArea}` : item.matchedCountry ? " · direct country match" : ""}`} summary={item.summary} href={item.sourceUrl || item.url} />)}</div> : <EmptyIntel>No recent WHO outbreak item matched this mapped context.</EmptyIntel>}
              </InspectorSection>

              <InspectorSection title="GDACS Natural Hazards" icon={<CloudLightning size={14} className="text-amber-200/64" />}>
                {selectedCountry && countrySources.gdacs.loading ? <EmptyIntel>Loading GDACS country alerts…</EmptyIntel> : selectedCountry && countrySources.gdacs.error ? <EmptyIntel>{countrySources.gdacs.error}</EmptyIntel> : displayedGdacs.length ? <div className="space-y-2">{displayedGdacs.map((item: any, index: number) => <IntelItem key={item.id || item.eventId || index} title={`${item.alertLevel ? `${String(item.alertLevel).toUpperCase()} · ` : ""}${item.name || item.title || "GDACS event"}`} meta={`${item.country || selectedCountry?.name || item.eventType || "Hazard"} · ${formatDate(item.fromDate)}`} summary={item.description} href={item.sourceUrl || item.url} />)}</div> : <EmptyIntel>No current GDACS event matched this mapped context.</EmptyIntel>}
              </InspectorSection>

              <InspectorSection title="USGS Seismic Activity" icon={<Waves size={14} className="text-sky-200/64" />}>
                {loading ? <EmptyIntel>Loading USGS command activity…</EmptyIntel> : displayedQuakes.length ? <div className="space-y-2">{displayedQuakes.map((item) => <IntelItem key={item.id} title={`${item.magnitude != null ? `M${Number(item.magnitude).toFixed(1)} · ` : ""}${item.place || item.title}`} meta={`${formatDate(item.occurredAt)}${item.depthKm != null ? ` · ${item.depthKm} km depth` : ""}`} href={item.url} />)}</div> : <EmptyIntel>No recent USGS event matched the current command.</EmptyIntel>}
              </InspectorSection>

              <InspectorSection title="International Crisis Group CrisisWatch" icon={<RadioTower size={14} className="text-violet-200/64" />}>
                {!selectedCountry ? <EmptyIntel>Select a country on the map to load CrisisWatch conflict context for that same geography.</EmptyIntel> : countrySources.crisiswatch.loading ? <EmptyIntel>Loading CrisisWatch…</EmptyIntel> : countrySources.crisiswatch.error ? <EmptyIntel>{countrySources.crisiswatch.error}</EmptyIntel> : crisisUpdates.length ? <div className="space-y-2">{crisisUpdates.slice(0, 5).map((item: any, index: number) => <IntelItem key={item.id || index} title={item.title || "CrisisWatch update"} meta={`${formatDate(item.publishedAt)}${item.matchedCountry ? " · direct country match" : ""}`} summary={item.summary} href={item.sourceUrl} />)}</div> : <EmptyIntel>No CrisisWatch update was returned for this country.</EmptyIntel>}
              </InspectorSection>

              <div className="border-t border-white/9 pt-4 text-[9px] leading-4 text-cyan-100/34">
                Travel advisories, WHO reporting, GDACS alerts, USGS events, CrisisWatch analysis, and environmental prompts retain their own definitions and timestamps. The map synchronizes the geography; it does not fabricate a composite danger score.
              </div>
            </aside>
          </div>
        </Surface>
      </section>
    </main>
  );
}
