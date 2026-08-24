import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, CloudLightning, ExternalLink, Globe2, HeartPulse, Layers3, Loader2, MapPinned, Radar, ShieldAlert, Waves } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { COMMANDS, COMMAND_BY_COUNTRY, type CommandId } from "@/components/insight/aor-command-registry";

declare global { interface Window { maptilersdk?: any; } }

const VERSION = "4.0.2";
const SCRIPT = `https://cdn.maptiler.com/maptiler-sdk-js/v${VERSION}/maptiler-sdk.umd.min.js`;
const CSS = `https://cdn.maptiler.com/maptiler-sdk-js/v${VERSION}/maptiler-sdk.css`;
const COUNTRIES = "https://api.maptiler.com/tiles/countries/tiles.json";
const EMPTY_FILTER = ["==", "iso_a2", "__NONE__"];
const countryFilter = (codes: readonly string[]) => ["all", ["==", "level", 0], ["in", "iso_a2", ...codes]];

type MapStyleKey = "Topo" | "Base" | "Outdoor";
type Country = { name: string; iso2: string };
type SourceState = { loading: boolean; error: string; data: any };
const blankSource = (): SourceState => ({ loading: false, error: "", data: null });

async function loadJson(url: string) {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && payload?.configured !== false) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload;
}
async function loadSdk() {
  if (!document.querySelector(`link[href="${CSS}"]`)) {
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = CSS; document.head.appendChild(link);
  }
  if (window.maptilersdk) return window.maptilersdk;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-maptiler-aor="true"]');
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("MapTiler SDK failed to load.")), { once: true }); return; }
    const script = document.createElement("script"); script.src = SCRIPT; script.async = true; script.dataset.maptilerAor = "true"; script.onload = () => resolve(); script.onerror = () => reject(new Error("MapTiler SDK failed to load.")); document.head.appendChild(script);
  });
  return window.maptilersdk;
}
function external(url?: string | null) {
  if (!url) return "";
  try { const value = new URL(url); return value.protocol === "https:" ? value.toString() : ""; } catch { return ""; }
}
function eventCoordinates(item: any): [number, number] | null {
  const lat = Number(item?.latitude ?? item?.lat ?? item?.geometry?.coordinates?.[1]);
  const lon = Number(item?.longitude ?? item?.lon ?? item?.lng ?? item?.geometry?.coordinates?.[0]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null;
}
function styleObject(sdk: any, style: MapStyleKey) {
  if (style === "Base") return sdk.MapStyle?.BASE?.DARK || sdk.MapStyle?.BASE;
  if (style === "Outdoor") return sdk.MapStyle?.OUTDOOR?.DARK || sdk.MapStyle?.OUTDOOR;
  return sdk.MapStyle?.TOPO?.DARK || sdk.MapStyle?.TOPO || sdk.MapStyle?.BASE?.DARK || sdk.MapStyle?.STREETS?.DARK;
}

export default function ReviewerAorFactorsLivePage() {
  const mapHost = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const popupRef = useRef<any>(null);
  const mapKey = useRef("");
  const [style, setStyle] = useState<MapStyleKey>("Topo");
  const [mode, setMode] = useState<"country" | "aor">("country");
  const [command, setCommand] = useState<CommandId>("centcom");
  const [country, setCountry] = useState<Country | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [globalWatch, setGlobalWatch] = useState<any>(null);
  const [commandData, setCommandData] = useState<any>(null);
  const [sources, setSources] = useState({ travel: blankSource(), who: blankSource(), gdacs: blankSource(), health: blankSource(), crisis: blankSource() });
  const selectedCommand = COMMANDS.find((item) => item.id === command) || COMMANDS[0];

  useEffect(() => {
    loadJson("/api/aor/global-watch").then(setGlobalWatch).catch(() => setGlobalWatch(null));
  }, []);

  useEffect(() => {
    if (mode !== "aor") return;
    let active = true;
    setCommandData(null);
    loadJson(`/api/aor/unified-command?command=${encodeURIComponent(command)}`).then((payload) => active && setCommandData(payload)).catch(() => active && setCommandData(null));
    return () => { active = false; };
  }, [command, mode]);

  useEffect(() => {
    if (!country) return;
    let active = true;
    const loading = { loading: true, error: "", data: null };
    setSources({ travel: loading, who: loading, gdacs: loading, health: loading, crisis: loading });
    const name = encodeURIComponent(country.name);
    const requests = {
      travel: loadJson(`/api/public-data/aor-risk?country=${name}`),
      who: loadJson(`/api/aor/health-outbreaks?country=${name}`),
      gdacs: loadJson(`/api/aor/disaster-alerts?country=${name}&days=90`),
      health: loadJson(`/api/aor/travel-health?country=${name}`),
      crisis: loadJson(`/api/aor/crisiswatch?country=${name}`),
    };
    (Object.entries(requests) as Array<[keyof typeof requests, Promise<any>]>).forEach(([key, request]) => request.then((data) => active && setSources((current) => ({ ...current, [key]: { loading: false, error: data?.error || "", data } }))).catch((reason) => active && setSources((current) => ({ ...current, [key]: { loading: false, error: reason instanceof Error ? reason.message : "Source request failed.", data: null } }))));
    return () => { active = false; };
  }, [country]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const configResponse = await fetch("/api/map-config", { cache: "no-store" });
        const config = await configResponse.json().catch(() => ({}));
        if (!configResponse.ok || !config?.configured || !config?.apiKey) throw new Error("MapTiler key is not configured.");
        const sdk = await loadSdk();
        if (cancelled || !mapHost.current) return;
        sdk.config.apiKey = config.apiKey;
        mapKey.current = config.apiKey;
        const map = new sdk.Map({ container: mapHost.current, style: styleObject(sdk, "Topo"), center: [10, 18], zoom: 1.25, minZoom: .8, maxZoom: 10, antialias: true, attributionControl: true, hash: false });
        mapRef.current = map;
        popupRef.current = new sdk.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
        map.addControl(new sdk.NavigationControl({ showCompass: true }), "bottom-right");
        if (sdk.FullscreenControl) map.addControl(new sdk.FullscreenControl(), "bottom-right");
        if (sdk.ScaleControl) map.addControl(new sdk.ScaleControl({ unit: "metric" }), "bottom-left");

        const installOverlays = () => {
          if (!map.getSource("aor-countries")) map.addSource("aor-countries", { type: "vector", url: `${COUNTRIES}?key=${encodeURIComponent(config.apiKey)}` });
          const firstSymbol = (map.getStyle()?.layers || []).find((layer: any) => layer.type === "symbol")?.id;
          if (!map.getLayer("country-hover")) map.addLayer({ id: "country-hover", type: "fill", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_FILTER, paint: { "fill-color": "#7dd3fc", "fill-opacity": .18 } }, firstSymbol);
          if (!map.getLayer("country-selected")) map.addLayer({ id: "country-selected", type: "line", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_FILTER, paint: { "line-color": "#d9fffb", "line-width": 3, "line-opacity": .95 } }, firstSymbol);
          if (!map.getLayer("aor-fill")) map.addLayer({ id: "aor-fill", type: "fill", source: "aor-countries", "source-layer": "administrative", filter: EMPTY_FILTER, paint: { "fill-color": "#22d3ee", "fill-opacity": .11 } }, firstSymbol);
          if (!map.getLayer("country-hit")) map.addLayer({ id: "country-hit", type: "fill", source: "aor-countries", "source-layer": "administrative", filter: ["==", "level", 0], paint: { "fill-color": "#ffffff", "fill-opacity": .001 } }, firstSymbol);
          if (!map.getSource("aor-events")) map.addSource("aor-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          if (!map.getLayer("event-halo")) map.addLayer({ id: "event-halo", type: "circle", source: "aor-events", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 8, 6, 18], "circle-color": ["match", ["get", "kind"], "OUTBREAK", "#34d399", "DISASTER", "#a78bfa", "#67e8f9"], "circle-opacity": .16, "circle-blur": .35 } });
          if (!map.getLayer("event-point")) map.addLayer({ id: "event-point", type: "circle", source: "aor-events", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3.5, 6, 7], "circle-color": ["match", ["get", "kind"], "OUTBREAK", "#34d399", "DISASTER", "#a78bfa", "#67e8f9"], "circle-stroke-color": "#e6fffb", "circle-stroke-width": 1, "circle-opacity": .95 } });
        };
        map.on("load", () => { installOverlays(); setMapReady(true); });
        map.on("style.load", installOverlays);
        map.on("mousemove", "country-hit", (event: any) => {
          map.getCanvas().style.cursor = "pointer";
          const feature = event.features?.[0];
          const iso2 = String(feature?.properties?.iso_a2 || "").toUpperCase();
          const name = String(feature?.properties?.["name:en"] || feature?.properties?.name || iso2 || "Country");
          map.setFilter("country-hover", countryFilter([iso2]));
          popupRef.current?.setLngLat(event.lngLat).setHTML(`<div style="font:600 12px system-ui;color:#06111f">${name}</div>`).addTo(map);
        });
        map.on("mouseleave", "country-hit", () => { map.getCanvas().style.cursor = ""; if (map.getLayer("country-hover")) map.setFilter("country-hover", EMPTY_FILTER); popupRef.current?.remove(); });
        map.on("click", "country-hit", (event: any) => {
          if (mode === "aor") return;
          const feature = event.features?.[0];
          const iso2 = String(feature?.properties?.iso_a2 || "").toUpperCase();
          const name = String(feature?.properties?.["name:en"] || feature?.properties?.name || iso2 || "Selected country");
          setCountry({ name, iso2 });
          const mapped = COMMAND_BY_COUNTRY.get(iso2); if (mapped) setCommand(mapped.id);
          if (map.getLayer("country-selected")) map.setFilter("country-selected", countryFilter([iso2]));
          map.easeTo({ center: [event.lngLat.lng, event.lngLat.lat], zoom: Math.max(map.getZoom(), 3.2), duration: 650 });
        });
        map.on("mousemove", "event-point", (event: any) => {
          const feature = event.features?.[0]; if (!feature) return;
          map.getCanvas().style.cursor = "pointer";
          popupRef.current?.setLngLat(event.lngLat).setHTML(`<div style="max-width:240px;font:600 12px system-ui;color:#06111f">${String(feature.properties?.title || "Live event")}</div>`).addTo(map);
        });
        map.on("mouseleave", "event-point", () => { map.getCanvas().style.cursor = ""; popupRef.current?.remove(); });
        map.on("click", "event-point", (event: any) => { const url = external(String(event.features?.[0]?.properties?.url || "")); if (url) window.open(url, "_blank", "noopener,noreferrer"); });
      } catch (reason) { if (!cancelled) setMapError(reason instanceof Error ? reason.message : "Map failed to initialize."); }
    }
    void initialize();
    return () => { cancelled = true; popupRef.current?.remove?.(); mapRef.current?.remove?.(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const sdk = window.maptilersdk;
    if (!map || !sdk || !mapReady) return;
    map.setStyle(styleObject(sdk, style));
  }, [style, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (mode === "aor") {
      setCountry(null);
      if (map.getLayer("aor-fill")) map.setFilter("aor-fill", countryFilter(selectedCommand.countries));
      if (map.getLayer("country-selected")) map.setFilter("country-selected", EMPTY_FILTER);
      map.easeTo({ center: selectedCommand.center, zoom: selectedCommand.zoom, duration: 700 });
    } else if (map.getLayer("aor-fill")) map.setFilter("aor-fill", EMPTY_FILTER);
  }, [command, mapReady, mode, selectedCommand]);

  const sourcePayload = country ? sources : null;
  const outbreaks = country ? (sourcePayload?.who.data?.outbreaks || []) : mode === "aor" ? (commandData?.outbreaks || []) : (globalWatch?.outbreaks || []);
  const disasters = country ? (sourcePayload?.gdacs.data?.events || []) : mode === "aor" ? (commandData?.disasters || []) : (globalWatch?.disasters || []);
  const earthquakes = mode === "aor" ? (commandData?.earthquakes || []) : (globalWatch?.earthquakes || []);
  const advisory = country ? sourcePayload?.travel.data?.advisory : null;
  const health = country ? sourcePayload?.health.data : null;
  const vaccines = health?.vaccines || [];
  const diseases = health?.diseases || [];
  const riskScore = Math.min(100, outbreaks.length * 10 + disasters.length * 7 + earthquakes.length * 3 + Math.min(vaccines.length, 8) * 2);
  const context = country?.name || (mode === "aor" ? selectedCommand.label : "Global watch");

  const geoJson = useMemo(() => {
    const features: any[] = [];
    for (const item of outbreaks.slice(0, 30)) { const coords = eventCoordinates(item); if (coords) features.push({ type: "Feature", geometry: { type: "Point", coordinates: coords }, properties: { kind: "OUTBREAK", title: item.title || item.name || "Health outbreak", url: item.url || item.sourceUrl || "" } }); }
    for (const item of disasters.slice(0, 40)) { const coords = eventCoordinates(item); if (coords) features.push({ type: "Feature", geometry: { type: "Point", coordinates: coords }, properties: { kind: "DISASTER", title: item.title || item.name || "Disaster alert", url: item.url || item.sourceUrl || "" } }); }
    for (const item of earthquakes.slice(0, 30)) { const coords = eventCoordinates(item); if (coords) features.push({ type: "Feature", geometry: { type: "Point", coordinates: coords }, properties: { kind: "QUAKE", title: item.title || "Earthquake", url: item.url || "" } }); }
    return { type: "FeatureCollection", features };
  }, [disasters, earthquakes, outbreaks]);
  useEffect(() => { mapRef.current?.getSource?.("aor-events")?.setData?.(geoJson); }, [geoJson, mapReady, style]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(13,148,136,.21),transparent_32%),radial-gradient(circle_at_78%_18%,rgba(59,130,246,.18),transparent_28%),linear-gradient(150deg,#020817,#05263a_52%,#0c0b2b)]" />
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[224px] lg:px-12 lg:pt-8">
        <HeaderBar eyebrow="Area of Responsibility · interactive terrain intelligence" title="AOR Factors" subtitle="Explore country and combatant-command risk on an interactive MapTiler topographic basemap. Live public-health, disaster, seismic, travel-health, and deployment-context signals stay spatial instead of becoming another card wall." />

        <section className="mt-8 overflow-hidden rounded-[34px] border border-white/12 bg-black/25 shadow-[0_40px_120px_rgba(0,0,0,.45)]">
          <div className="relative h-[66vh] min-h-[620px]">
            <div ref={mapHost} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,23,.32),transparent_28%,transparent_70%,rgba(2,8,23,.22))]" />

            <div className="absolute left-5 top-5 z-10 flex flex-wrap gap-2 rounded-2xl border border-white/12 bg-[#020817]/72 p-2 backdrop-blur-2xl">
              <button onClick={() => setMode("country")} className={`rounded-xl px-4 py-2 text-[10px] font-black ${mode === "country" ? "bg-cyan-300/14 text-white" : "text-cyan-50/50"}`}>Country explorer</button>
              <button onClick={() => setMode("aor")} className={`rounded-xl px-4 py-2 text-[10px] font-black ${mode === "aor" ? "bg-cyan-300/14 text-white" : "text-cyan-50/50"}`}>Combatant command</button>
            </div>

            <div className="absolute right-5 top-5 z-10 flex gap-1 rounded-2xl border border-white/12 bg-[#020817]/72 p-1.5 backdrop-blur-2xl">
              <Layers3 size={14} className="mx-2 my-2 text-cyan-100/45" />
              {(["Topo", "Base", "Outdoor"] as MapStyleKey[]).map((value) => <button key={value} onClick={() => setStyle(value)} className={`rounded-xl px-3 py-2 text-[9px] font-black ${style === value ? "bg-white/10 text-white" : "text-cyan-50/45 hover:text-white"}`}>{value}</button>)}
            </div>

            {mode === "aor" ? <div className="absolute left-5 top-20 z-10 max-h-[46vh] w-[250px] overflow-y-auto rounded-[24px] border border-white/12 bg-[#020817]/76 p-3 backdrop-blur-2xl"><p className="px-2 pb-2 text-[8px] font-black uppercase tracking-[.17em] text-cyan-100/35">Combatant commands</p>{COMMANDS.map((item) => <button key={item.id} onClick={() => setCommand(item.id)} className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-[11px] font-black transition ${item.id === command ? "bg-cyan-300/13 text-white" : "text-cyan-50/52 hover:bg-white/[.04] hover:text-white"}`}>{item.label}</button>)}</div> : null}

            <div className="absolute bottom-5 left-5 z-10 w-[min(440px,calc(100%-40px))] rounded-[26px] border border-white/12 bg-[#020817]/78 p-5 backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[8px] font-black uppercase tracking-[.18em] text-cyan-100/38">Current context</p><h2 className="mt-1 text-2xl font-black tracking-[-.04em]">{context}</h2></div><div className="relative grid h-16 w-16 place-items-center rounded-full" style={{ background: `conic-gradient(#67e8f9 ${riskScore}%,rgba(255,255,255,.06) 0)` }}><div className="grid h-12 w-12 place-items-center rounded-full bg-[#04101d] text-xs font-black">{riskScore}</div></div></div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center"><div><strong className="text-xl">{outbreaks.length}</strong><p className="text-[8px] text-cyan-50/38">outbreaks</p></div><div><strong className="text-xl">{disasters.length}</strong><p className="text-[8px] text-cyan-50/38">disasters</p></div><div><strong className="text-xl">{earthquakes.length}</strong><p className="text-[8px] text-cyan-50/38">seismic</p></div></div>
            </div>

            {!mapReady && !mapError ? <div className="absolute inset-0 z-20 grid place-items-center bg-[#020817]/70"><div className="flex items-center gap-3 text-sm text-cyan-50/60"><Loader2 className="animate-spin" size={18} />Loading interactive terrain…</div></div> : null}
            {mapError ? <div className="absolute inset-x-6 top-24 z-20 rounded-2xl border border-rose-200/18 bg-rose-950/85 p-4 text-sm text-rose-100"><AlertTriangle size={16} className="mr-2 inline" />{mapError}</div> : null}
          </div>
        </section>

        <section className="mt-12 grid gap-8 xl:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/40">Deployment-health lens</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-.05em]">Signals that change the medical review.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-cyan-50/50">This replaces the decorative medical visual with a functional readout: what changed, what a reviewer needs to verify, and which source produced the signal.</p>
            <div className="mt-8 space-y-4">
              {advisory ? <div className="border-l-2 border-amber-300/55 pl-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-amber-100/50">Travel advisory</p><p className="mt-1 text-sm font-black">{advisory.title || advisory.level || "Current advisory"}</p><p className="mt-1 text-xs leading-6 text-cyan-50/48">{advisory.summary || advisory.description || "Review the current official advisory before deployment."}</p></div> : null}
              {country && !advisory ? <div className="border-l-2 border-white/12 pl-4 text-xs text-cyan-50/42">Travel advisory data is not currently available for this selection.</div> : null}
              {vaccines.slice(0, 4).map((item: any, index: number) => <div key={`${item.name || item.title}-${index}`} className="border-l-2 border-emerald-300/45 pl-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-100/50">Travel health</p><p className="mt-1 text-sm font-black">{item.name || item.title || "Vaccine / immunization"}</p><p className="mt-1 text-xs leading-6 text-cyan-50/48">{item.summary || item.description || item.recommendation || "Review current official travel-health guidance."}</p></div>)}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[.03] p-6 md:p-8">
            <div className="flex items-center justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.17em] text-cyan-100/40">Live event stream</p><h3 className="mt-2 text-2xl font-black">What is changing around {context}</h3></div><Radar className="text-cyan-100/45" /></div>
            <div className="mt-6 divide-y divide-white/8">{[...outbreaks.slice(0, 5).map((item: any) => ({ ...item, kind: "Health outbreak" })), ...disasters.slice(0, 5).map((item: any) => ({ ...item, kind: "Disaster alert" })), ...earthquakes.slice(0, 4).map((item: any) => ({ ...item, kind: "Seismic" }))].slice(0, 12).map((item: any, index: number) => { const href = external(item.url || item.sourceUrl); return <article key={`${item.kind}-${index}`} className="grid gap-3 py-4 md:grid-cols-[auto_1fr_auto]"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.kind === "Health outbreak" ? "bg-emerald-300" : item.kind === "Disaster alert" ? "bg-violet-300" : "bg-cyan-300"}`} /><div><p className="text-[8px] font-black uppercase tracking-[.14em] text-cyan-100/35">{item.kind}</p><h4 className="mt-1 text-sm font-black">{item.title || item.name || "Live source signal"}</h4><p className="mt-1 line-clamp-2 text-xs leading-5 text-cyan-50/45">{item.summary || item.description || item.place || "Open the official source for detail."}</p></div>{href ? <a href={href} target="_blank" rel="noreferrer" className="mt-1 text-cyan-100/50 hover:text-white"><ExternalLink size={14} /></a> : null}</article>; })}{!outbreaks.length && !disasters.length && !earthquakes.length ? <div className="py-12 text-sm text-cyan-50/40">No live mapped signals are available for this context right now.</div> : null}</div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-4">
          {[{ icon: HeartPulse, label: "Health", value: diseases.length || outbreaks.length, note: "disease / outbreak signals" }, { icon: CloudLightning, label: "Disaster", value: disasters.length, note: "current disaster alerts" }, { icon: Waves, label: "Seismic", value: earthquakes.length, note: "mapped earthquake signals" }, { icon: ShieldAlert, label: "AOR", value: selectedCommand.countries.length, note: "countries in selected command" }].map(({ icon: Icon, label, value, note }) => <div key={label} className="rounded-[24px] border border-white/9 bg-white/[.025] p-5"><Icon size={17} className="text-cyan-100/45" /><strong className="mt-4 block text-3xl font-black">{value}</strong><p className="mt-1 text-[10px] text-cyan-50/38">{note}</p></div>)}
        </section>
      </section>
    </main>
  );
}
