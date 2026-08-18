import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip as LeafletTooltip, useMap } from "react-leaflet";
import { AlertTriangle, ExternalLink, HeartPulse, Layers3, Loader2, MapPinned, Radar, ShieldAlert, Waves } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import AorCountryIntelligence from "@/pages/aor-country-intelligence";

const COMMANDS = [
  { id: "northcom", label: "USNORTHCOM", scope: "United States, Canada, Mexico, Greenland, The Bahamas, and assigned approaches", center: [46, -101] as [number, number], zoom: 2.4, color: "#4f9aaa" },
  { id: "southcom", label: "USSOUTHCOM", scope: "Central America, South America, the Caribbean, and adjacent approaches", center: [-9, -67] as [number, number], zoom: 2.7, color: "#4f927f" },
  { id: "eucom", label: "USEUCOM", scope: "Europe and assigned portions of Eurasia, the Arctic, Atlantic, and adjoining approaches", center: [52, 21] as [number, number], zoom: 3.1, color: "#7485a5" },
  { id: "africom", label: "USAFRICOM", scope: "The African continent, island nations, and surrounding waters, except Egypt", center: [3, 19] as [number, number], zoom: 2.6, color: "#8d8068" },
  { id: "centcom", label: "USCENTCOM", scope: "Twenty-one nations across the Middle East and Central and South Asia, including Egypt", center: [30, 53] as [number, number], zoom: 3.1, color: "#a97567" },
  { id: "indopacom", label: "USINDOPACOM", scope: "The Indo-Pacific from India through East Asia, Australia, and Pacific island nations", center: [13, 142] as [number, number], zoom: 2.3, color: "#6577a8" },
] as const;

type CommandId = (typeof COMMANDS)[number]["id"];
type TabId = "command" | "country" | "environment";
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

type EnvironmentState = {
  heat: boolean;
  cold: boolean;
  altitude: boolean;
  poorAir: boolean;
  fatigue: boolean;
  ppe: boolean;
  night: boolean;
};

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard variant="glass" className={`border border-white/24 bg-white/[0.065] p-[1px] shadow-[0_24px_72px_rgba(0,0,0,.28),0_0_34px_rgba(186,230,253,.07)] backdrop-blur-3xl ${className}`}>
      <div className="h-full rounded-[27px] border border-white/[0.14] bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.17)] md:p-6">{children}</div>
    </GlassCard>
  );
}

function MapFocus({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.65 });
  }, [center, map, zoom]);
  return null;
}

function formatDate(value?: string) {
  if (!value) return "Date not supplied";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const ENVIRONMENT_LABELS: Record<keyof EnvironmentState, string> = {
  heat: "Heat / high WBGT",
  cold: "Cold exposure",
  altitude: "Altitude",
  poorAir: "Poor air quality",
  fatigue: "Fatigue / long shift",
  ppe: "PPE burden",
  night: "Night / circadian disruption",
};

const ENVIRONMENT_PROMPTS: Record<keyof EnvironmentState, string> = {
  heat: "Confirm temperature/WBGT, work-rest cycle, hydration, acclimatization, clothing/PPE and heat-sensitive conditions or medications.",
  cold: "Confirm temperature, wind, wetness, protective clothing, warming access and dexterity requirements.",
  altitude: "Confirm elevation, ascent profile, prior tolerance, cardiopulmonary limitations and emergency descent/oxygen access.",
  poorAir: "Identify pollutant or particulate source, AQI/monitoring, respiratory protection and underlying respiratory disease.",
  fatigue: "Confirm shift length, sleep opportunity, recent time-zone change, driving/critical tasks and recovery time.",
  ppe: "Confirm respirator/body armor/chemical PPE burden, heat retention, communication and emergency egress requirements.",
  night: "Confirm circadian timing, sleep opportunity, lighting, vigilance demand and commute/driving exposure.",
};

export default function ReviewerAorFactorsPage() {
  const [tab, setTab] = useState<TabId>("command");
  const [command, setCommand] = useState<CommandId>("centcom");
  const [data, setData] = useState<AorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentState>({ heat: false, cold: false, altitude: false, poorAir: false, fatigue: false, ppe: false, night: false });
  const selected = COMMANDS.find((item) => item.id === command) ?? COMMANDS[4];

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
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "AOR sources unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [command]);

  const eventPoints = useMemo(() => {
    const gdacs = (data?.disasters || []).flatMap((item) => item.latitude != null && item.longitude != null ? [{ id: `gdacs-${item.id}`, kind: "GDACS", label: item.title, meta: `${item.country || item.eventType}${item.alertLevel ? ` · ${String(item.alertLevel).toUpperCase()}` : ""}`, lat: item.latitude, lng: item.longitude, color: "#f5b95e", url: item.url }] : []);
    const usgs = (data?.earthquakes || []).flatMap((item) => item.latitude != null && item.longitude != null ? [{ id: `usgs-${item.id}`, kind: "USGS", label: `${item.magnitude != null ? `M${Number(item.magnitude).toFixed(1)} · ` : ""}${item.place || item.title}`, meta: item.tsunami ? "Tsunami flag" : "Seismic event", lat: item.latitude, lng: item.longitude, color: "#69d7ff", url: item.url }] : []);
    return [...gdacs, ...usgs];
  }, [data]);

  const selectedEnvironment = (Object.keys(environment) as Array<keyof EnvironmentState>).filter((key) => environment[key]);

  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8">
        <HeaderBar
          eyebrow="Operational / Environmental Intelligence"
          title="AOR Factors"
          subtitle="Unified AOR workspace with command intelligence, country-level travel and conflict context, WHO outbreaks, GDACS disasters, USGS seismic activity, and human-performance factors."
        />

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="AOR Factors domains">
          <button type="button" role="tab" aria-selected={tab === "command"} onClick={() => setTab("command")} className={`min-h-11 rounded-2xl border px-4 text-xs font-black ${tab === "command" ? "border-cyan-100/34 bg-cyan-300/[0.12]" : "border-white/12 bg-white/[0.03] text-cyan-100/55"}`}>AOR & Command Intelligence</button>
          <button type="button" role="tab" aria-selected={tab === "country"} onClick={() => setTab("country")} className={`min-h-11 rounded-2xl border px-4 text-xs font-black ${tab === "country" ? "border-cyan-100/34 bg-cyan-300/[0.12]" : "border-white/12 bg-white/[0.03] text-cyan-100/55"}`}>Country Intelligence</button>
          <button type="button" role="tab" aria-selected={tab === "environment"} onClick={() => setTab("environment")} className={`min-h-11 rounded-2xl border px-4 text-xs font-black ${tab === "environment" ? "border-cyan-100/34 bg-cyan-300/[0.12]" : "border-white/12 bg-white/[0.03] text-cyan-100/55"}`}>Environmental & Performance Factors</button>
        </div>

        {tab === "command" ? (
          <div className="space-y-6">
            <Surface>
              <div className="flex flex-wrap items-center gap-2">
                {COMMANDS.map((item) => (
                  <button key={item.id} type="button" onClick={() => setCommand(item.id)} className={`min-h-10 rounded-2xl border px-4 text-xs font-black transition ${command === item.id ? "border-cyan-100/34 bg-cyan-300/[0.12] text-white" : "border-white/12 bg-white/[0.025] text-cyan-100/55 hover:border-white/20"}`}>{item.label}</button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">Selected command</p><h2 className="mt-1 text-2xl font-black">{selected.label}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-100/52">{selected.scope}</p></div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${loading ? "border-cyan-200/18 bg-cyan-300/[0.06] text-cyan-50/70" : data?.partial ? "border-amber-200/20 bg-amber-300/[0.07] text-amber-50/80" : "border-emerald-200/20 bg-emerald-300/[0.07] text-emerald-50/80"}`}>{loading ? "Refreshing sources" : data?.partial ? "Partial source coverage" : "Public sources live"}</span>
              </div>
            </Surface>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
              <Surface className="overflow-hidden">
                <div className="mb-4 flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Geographic / hazard picture</p><h2 className="mt-1 text-lg font-black">Command orientation & live events</h2></div><MapPinned className="text-cyan-100/52" /></div>
                <div className="relative h-[520px] overflow-hidden rounded-[22px] border border-cyan-100/14 bg-[#030913]">
                  <MapContainer center={selected.center} zoom={selected.zoom} minZoom={2} maxZoom={7} worldCopyJump className="h-full w-full" zoomControl attributionControl>
                    <TileLayer attribution="&copy; OpenStreetMap contributors &copy; CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                    <MapFocus center={selected.center} zoom={selected.zoom} />
                    {COMMANDS.map((item) => (
                      <CircleMarker key={item.id} center={item.center} radius={command === item.id ? 10 : 6} pathOptions={{ color: command === item.id ? "#b9f5ff" : item.color, weight: command === item.id ? 3 : 1.5, fillColor: item.color, fillOpacity: command === item.id ? 0.72 : 0.38 }} eventHandlers={{ click: () => setCommand(item.id) }}>
                        <LeafletTooltip direction="top"><strong>{item.label}</strong><br />{item.scope}</LeafletTooltip>
                      </CircleMarker>
                    ))}
                    {eventPoints.map((point) => (
                      <CircleMarker key={point.id} center={[point.lat, point.lng]} radius={5} pathOptions={{ color: point.color, fillColor: point.color, fillOpacity: 0.76, weight: 1.5 }} eventHandlers={{ click: () => window.open(point.url, "_blank", "noopener,noreferrer") }}>
                        <LeafletTooltip direction="top"><strong>{point.kind}</strong><br />{point.label}<br />{point.meta}</LeafletTooltip>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                  <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#030913]/84 p-2 text-[9px] font-bold uppercase tracking-[0.1em] text-cyan-50/62 backdrop-blur-xl"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f5b95e]" />GDACS</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#69d7ff]" />USGS</span><span>Command markers are orientation points; controlling AOR boundaries remain the official command descriptions.</span></div>
                </div>
              </Surface>

              <Surface>
                <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/48">Live source diagnostics</p><h2 className="mt-1 text-lg font-black">Source health</h2></div><Layers3 className="text-violet-100/52" /></div>
                {loading ? <Loading text="Refreshing WHO, GDACS and USGS…" /> : error ? <ErrorState error={error} /> : <div className="mt-4 space-y-2">{(data?.sourceHealth || []).map((source) => <div key={source.provider} className={`rounded-2xl border p-3 ${source.ok ? "border-emerald-200/14 bg-emerald-300/[0.04]" : "border-rose-200/14 bg-rose-300/[0.04]"}`}><div className="flex items-center justify-between gap-3"><strong className="text-xs">{source.provider}</strong><span className="text-[10px] font-bold text-cyan-100/44">{source.ok ? `${source.count} matched` : "Unavailable"}</span></div>{source.error ? <p className="mt-2 text-[10px] leading-4 text-rose-50/58">{source.error}</p> : null}</div>)}</div>}
                <p className="mt-4 text-[10px] leading-5 text-cyan-100/34">Source health reflects the actual operational request path. A provider is not labeled healthy merely because its hostname responds.</p>
              </Surface>
            </div>

            {loading ? <Loading /> : error ? <ErrorState error={error} /> : data ? (
              <div className="grid gap-6 xl:grid-cols-3">
                <Feed title="WHO Disease Outbreaks" icon={<HeartPulse size={16} />} items={data.outbreaks.map((item) => ({ title: item.title, meta: `${item.matchedArea || selected.label} · ${formatDate(item.publishedAt)}`, detail: item.summary, url: item.url }))} empty="No recent WHO Disease Outbreak News item matched this command." />
                <Feed title="GDACS Natural Hazards" icon={<ShieldAlert size={16} />} items={data.disasters.map((item) => ({ title: `${item.alertLevel ? `${String(item.alertLevel).toUpperCase()} · ` : ""}${item.title}`, meta: `${item.country || item.eventType} · ${formatDate(item.fromDate || item.toDate)}`, detail: item.eventType, url: item.url }))} empty="No current GDACS disaster event matched this command." />
                <Feed title="USGS Seismic Activity" icon={<Waves size={16} />} items={data.earthquakes.map((item) => ({ title: `${item.magnitude != null ? `M${Number(item.magnitude).toFixed(1)} · ` : ""}${item.place || item.title}`, meta: formatDate(item.occurredAt), detail: [item.depthKm != null ? `${Number(item.depthKm).toFixed(1)} km deep` : "", item.tsunami ? "tsunami flag" : ""].filter(Boolean).join(" · "), url: item.url }))} empty="No magnitude 4.0+ earthquake matched this command in the current window." />
              </div>
            ) : null}
          </div>
        ) : tab === "country" ? (
          <AorCountryIntelligence />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
            <Surface>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Exposure scenario</p>
              <h2 className="mt-2 text-xl font-black">Build the work environment</h2>
              <p className="mt-2 text-sm leading-6 text-cyan-100/48">Choose only conditions actually present in the job or deployed location.</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {(Object.keys(ENVIRONMENT_LABELS) as Array<keyof EnvironmentState>).map((key) => (
                  <button key={key} type="button" onClick={() => setEnvironment((current) => ({ ...current, [key]: !current[key] }))} className={`rounded-2xl border p-3 text-left text-xs font-bold transition ${environment[key] ? "border-cyan-100/30 bg-cyan-300/[0.10] text-white" : "border-white/10 bg-white/[0.02] text-cyan-100/55 hover:border-white/20"}`}>{ENVIRONMENT_LABELS[key]}</button>
                ))}
              </div>
            </Surface>
            <Surface>
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/48">Human-performance load field</p><h2 className="mt-2 text-xl font-black">Reviewer prompts</h2></div><Radar className="text-violet-100/52" /></div>
              {selectedEnvironment.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{selectedEnvironment.map((key) => <article key={key} className="rounded-2xl border border-white/12 bg-white/[0.025] p-4"><strong className="text-sm">{ENVIRONMENT_LABELS[key]}</strong><p className="mt-2 text-xs leading-5 text-cyan-100/52">{ENVIRONMENT_PROMPTS[key]}</p></article>)}</div> : <p className="mt-5 text-sm leading-6 text-cyan-100/50">Select actual exposure conditions. The tool intentionally does not collapse unrelated environmental variables into a fabricated composite danger score.</p>}
            </Surface>
          </div>
        )}
      </section>
    </main>
  );
}

function Loading({ text = "Loading live source records…" }: { text?: string }) {
  return <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-cyan-100/55"><Loader2 size={18} className="animate-spin" />{text}</div>;
}
function ErrorState({ error }: { error: string }) {
  return <div className="rounded-2xl border border-rose-200/16 bg-rose-300/[0.05] p-4 text-sm text-rose-50/75"><AlertTriangle size={16} className="mr-2 inline" />{error}</div>;
}
function Feed({ title, icon, items, empty }: { title: string; icon: ReactNode; items: Array<{ title: string; meta: string; detail?: string; url: string }>; empty: string }) {
  return (
    <Surface>
      <div className="flex items-center gap-2"><span className="text-cyan-100/55">{icon}</span><h2 className="text-sm font-black">{title}</h2></div>
      {items.length ? <div className="mt-4 max-h-[640px] space-y-2 overflow-y-auto pr-1">{items.map((item, index) => <a key={`${item.title}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.025] p-3 transition hover:border-cyan-100/24"><div className="flex gap-2"><strong className="min-w-0 flex-1 text-xs leading-5">{item.title}</strong><ExternalLink size={11} className="shrink-0 text-cyan-100/40" /></div><p className="mt-1 text-[10px] text-cyan-100/38">{item.meta}</p>{item.detail ? <p className="mt-2 text-[11px] leading-5 text-cyan-100/48">{item.detail}</p> : null}</a>)}</div> : <p className="mt-5 text-sm text-cyan-100/48">{empty}</p>}
    </Surface>
  );
}
