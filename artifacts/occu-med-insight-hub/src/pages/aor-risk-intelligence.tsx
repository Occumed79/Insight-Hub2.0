import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  CloudLightning,
  ExternalLink,
  FileText,
  Flame,
  Globe2,
  HeartPulse,
  Landmark,
  Loader2,
  MapPinned,
  RadioTower,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Stethoscope,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "travel", label: "Travel Advisory" },
  { id: "health", label: "Health Crisis" },
  { id: "disasters", label: "Disasters" },
  { id: "conflict", label: "Conflict" },
  { id: "humanitarian", label: "Humanitarian" },
] as const;

type TabId = typeof tabs[number]["id"];

type SourceReadiness = {
  id: string;
  name: string;
  configured: boolean;
  live: boolean;
  requirement: string | null;
};

type SourceResult = {
  data: any;
  error: string;
  loading: boolean;
};

type SourceState = {
  travel: SourceResult;
  who: SourceResult;
  gdacs: SourceResult;
  reliefweb: SourceResult;
  acled: SourceResult;
};

const emptyResult = (): SourceResult => ({ data: null, error: "", loading: false });

const initialSources = (): SourceState => ({
  travel: emptyResult(),
  who: emptyResult(),
  gdacs: emptyResult(),
  reliefweb: emptyResult(),
  acled: emptyResult(),
});

function formatDate(value?: string | null): string {
  if (!value) return "Date not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatNumber(value?: number | null): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : "Not reported";
}

function sourceTone(configured: boolean, live: boolean): string {
  if (configured && live) return "border-emerald-200/18 bg-emerald-300/[0.055] text-emerald-100/76";
  return "border-amber-200/16 bg-amber-300/[0.045] text-amber-100/68";
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white/15 bg-white/[0.045] p-[1px] shadow-[0_24px_72px_rgba(0,0,0,.34)] backdrop-blur-3xl ${className}`}>
      <div className="h-full rounded-[27px] border border-white/[0.075] bg-[#071321]/74 p-5 md:p-6">{children}</div>
    </div>
  );
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: LucideIcon }) {
  return (
    <Surface>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/40">{label}</p>
        <Icon size={15} className="text-cyan-200/45" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-cyan-100/43">{note}</p>
    </Surface>
  );
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200/70 transition hover:text-white">
      {children}<ArrowUpRight size={13} />
    </a>
  );
}

function SourceMessage({ result, empty }: { result: SourceResult; empty: string }) {
  if (result.loading) {
    return <div className="flex min-h-[220px] items-center justify-center gap-3 text-sm text-cyan-100/52"><Loader2 className="animate-spin" size={19} />Retrieving source data…</div>;
  }
  if (result.error) {
    return <Surface><div className="flex items-start gap-3 text-amber-100"><AlertTriangle size={19} className="mt-0.5 shrink-0" /><div><p className="font-black">Source unavailable</p><p className="mt-2 text-sm leading-6 text-amber-100/58">{result.error}</p></div></div></Surface>;
  }
  if (!result.data) {
    return <Surface><p className="text-sm leading-7 text-cyan-100/48">{empty}</p></Surface>;
  }
  return null;
}

async function loadJson(url: string): Promise<any> {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok && payload?.configured !== false) throw new Error(payload?.error || `Request failed with HTTP ${response.status}`);
  return payload;
}

export function AorRiskIntelligencePage() {
  const [country, setCountry] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sources, setSources] = useState<SourceState>(() => initialSources());
  const [readiness, setReadiness] = useState<SourceReadiness[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void loadJson("/api/aor/source-readiness")
      .then((payload) => setReadiness(payload.sources || []))
      .catch(() => setReadiness([]));
  }, []);

  async function runSource(key: keyof SourceState, url: string) {
    setSources((current) => ({ ...current, [key]: { data: null, error: "", loading: true } }));
    try {
      const payload = await loadJson(url);
      setSources((current) => ({ ...current, [key]: { data: payload, error: payload?.error || "", loading: false } }));
    } catch (error) {
      setSources((current) => ({ ...current, [key]: { data: null, error: error instanceof Error ? error.message : "Source request failed", loading: false } }));
    }
  }

  async function runAll() {
    const query = country.trim();
    if (!query) return;
    setRunning(true);
    const encoded = encodeURIComponent(query);
    await Promise.all([
      runSource("travel", `/api/public-data/aor-risk?country=${encoded}`),
      runSource("who", `/api/aor/health-outbreaks?country=${encoded}`),
      runSource("gdacs", `/api/aor/disaster-alerts?country=${encoded}&days=90`),
      runSource("reliefweb", `/api/aor/reliefweb-health?country=${encoded}`),
      runSource("acled", `/api/aor/conflict-events?country=${encoded}&days=90`),
    ]);
    setRunning(false);
  }

  const advisory = sources.travel.data?.advisory;
  const outbreaks = sources.who.data?.outbreaks || [];
  const disasterEvents = sources.gdacs.data?.events || [];
  const reports = sources.reliefweb.data?.reports || [];
  const conflictEvents = sources.acled.data?.events || [];
  const activeAlerts = disasterEvents.filter((event: any) => ["orange", "red"].includes(String(event.alertLevel || "").toLowerCase()));
  const outbreakMatches = outbreaks.filter((item: any) => item.matchedCountry);
  const conflictFatalities = conflictEvents.reduce((sum: number, event: any) => sum + (Number(event.fatalities) || 0), 0);

  const configuredCount = useMemo(() => readiness.filter((source) => source.configured).length, [readiness]);

  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Area of Responsibility Intelligence"
          title="AOR Risk Intelligence"
          subtitle="Country-level travel, health-crisis, disaster, conflict, and humanitarian context from separately attributed public sources."
        />

        <GlassCard variant="glass" className="mb-6 border border-white/16 bg-white/[0.045] p-[1px] shadow-[0_30px_95px_rgba(0,0,0,.4),0_0_42px_rgba(34,211,238,.06)] backdrop-blur-3xl">
          <div className="rounded-[27px] border border-white/[0.08] bg-[#06101d]/68 p-5 md:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <label>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Country or operating area</span>
                <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 px-4 focus-within:border-cyan-200/38">
                  <Search size={17} className="text-cyan-100/35" />
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") void runAll(); }}
                    placeholder="Example: Kuwait"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/25"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={() => void runAll()}
                disabled={running || !country.trim()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/12 px-5 text-sm font-black text-white shadow-[0_0_30px_rgba(34,211,238,.11)] transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {running ? <Loader2 size={17} className="animate-spin" /> : <RadioTower size={17} />}
                Run AOR scan
              </button>
            </div>
          </div>
        </GlassCard>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-10 whitespace-nowrap rounded-2xl border px-4 text-xs font-bold transition ${activeTab === tab.id ? "border-cyan-200/24 bg-cyan-300/13 text-white shadow-[0_0_24px_rgba(34,211,238,.1)]" : "border-white/9 bg-white/[0.025] text-cyan-100/42 hover:text-white"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <>
            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Source readiness" value={readiness.length ? `${configuredCount}/${readiness.length}` : "Loading"} note="Configured source adapters" icon={ShieldCheck} />
              <Metric label="Travel posture" value={advisory?.level ? `Level ${advisory.level}` : "Not scanned"} note={advisory?.levelLabel || "Run a country scan"} icon={ShieldAlert} />
              <Metric label="Outbreak matches" value={formatNumber(outbreakMatches.length)} note="WHO reports with direct country text matches" icon={HeartPulse} />
              <Metric label="High disaster alerts" value={formatNumber(activeAlerts.length)} note="GDACS orange or red alerts in the selected window" icon={Siren} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
              <Surface>
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Source readiness</p><h2 className="mt-2 text-2xl font-black text-white">Connected and pending layers</h2></div>
                  <RadioTower className="text-cyan-200/38" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {readiness.map((source) => (
                    <div key={source.id} className={`rounded-2xl border p-4 ${sourceTone(source.configured, source.live)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-black text-white">{source.name}</p><p className="mt-1 text-xs leading-5 opacity-70">{source.requirement || "Ready for live use"}</p></div>
                        {source.configured ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>

              <Surface>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/42">Interpretation boundary</p>
                <h2 className="mt-2 text-xl font-black text-white">No unsupported composite danger score</h2>
                <p className="mt-4 text-sm leading-7 text-cyan-100/54">Each source remains separate because travel guidance, outbreak reports, conflict events, humanitarian reports, and disaster alerts use different definitions and update cycles. The workspace surfaces evidence and freshness rather than converting unlike sources into one misleading score.</p>
              </Surface>
            </section>
          </>
        )}

        {activeTab === "travel" && (
          <>
            <SourceMessage result={sources.travel} empty="Run an AOR scan to retrieve the official U.S. Department of State travel advisory." />
            {advisory && (
              <section className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
                <Surface>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">Official advisory posture</p>
                  <p className="mt-4 text-5xl font-black text-amber-100">{advisory.level ? `Level ${advisory.level}` : "—"}</p>
                  <h2 className="mt-3 text-xl font-black text-white">{advisory.levelLabel}</h2>
                  <div className="mt-5 flex flex-wrap gap-2">{(advisory.riskFactors || []).map((factor: string) => <span key={factor} className="rounded-full border border-amber-100/14 bg-amber-300/[0.055] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100/70">{factor}</span>)}</div>
                </Surface>
                <Surface>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/42">Official-source excerpt</p>
                  <h2 className="mt-2 text-xl font-black text-white">{advisory.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-cyan-100/56">{advisory.summary}</p>
                  <div className="mt-5 flex items-center justify-between gap-4"><span className="text-xs text-cyan-100/38">{advisory.updatedAt || "Date not parsed"}</span><SourceLink href={advisory.sourceUrl}>Read full advisory</SourceLink></div>
                </Surface>
              </section>
            )}
          </>
        )}

        {activeTab === "health" && (
          <>
            <SourceMessage result={sources.who} empty="Run an AOR scan to retrieve WHO Disease Outbreak News." />
            {sources.who.data && (
              <>
                <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="WHO records" value={formatNumber(outbreaks.length)} note="Returned outbreak reports" icon={HeartPulse} />
                  <Metric label="Direct matches" value={formatNumber(sources.who.data.directMatches)} note="Country text matches" icon={MapPinned} />
                  <Metric label="Latest report" value={outbreaks[0] ? formatDate(outbreaks[0].publicationDate) : "None"} note="Newest returned publication" icon={CalendarDays} />
                  <Metric label="Source" value="WHO DON" note="Disease Outbreak News API" icon={Stethoscope} />
                </section>
                <div className="grid gap-4 xl:grid-cols-2">
                  {outbreaks.map((outbreak: any) => (
                    <Surface key={outbreak.id || outbreak.sourceUrl}>
                      <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-rose-100/42">{outbreak.matchedCountry ? "Country match" : "Recent global outbreak"}</p><h2 className="mt-2 text-lg font-black text-white">{outbreak.title}</h2></div><HeartPulse size={19} className="shrink-0 text-rose-200/50" /></div>
                      <p className="mt-4 text-sm leading-7 text-cyan-100/55">{outbreak.summary || "No summary returned."}</p>
                      {outbreak.assessment && <div className="mt-4 rounded-2xl border border-rose-100/10 bg-rose-300/[0.035] p-4 text-xs leading-6 text-rose-100/58">{outbreak.assessment}</div>}
                      <div className="mt-5 flex items-center justify-between gap-4"><span className="text-xs text-cyan-100/36">{formatDate(outbreak.publicationDate)}</span><SourceLink href={outbreak.sourceUrl}>Open WHO report</SourceLink></div>
                    </Surface>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "disasters" && (
          <>
            <SourceMessage result={sources.gdacs} empty="Run an AOR scan to retrieve GDACS multi-hazard disaster alerts." />
            {sources.gdacs.data && (
              <>
                <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Events returned" value={formatNumber(disasterEvents.length)} note={`${sources.gdacs.data.days}-day GDACS window`} icon={CloudLightning} />
                  <Metric label="Orange / red" value={formatNumber(activeAlerts.length)} note="Higher-alert events" icon={Siren} />
                  <Metric label="Flood events" value={formatNumber(disasterEvents.filter((event: any) => event.eventType === "FL").length)} note="GDACS flood category" icon={Waves} />
                  <Metric label="Fire events" value={formatNumber(disasterEvents.filter((event: any) => event.eventType === "WF").length)} note="GDACS wildfire category" icon={Flame} />
                </section>
                <div className="grid gap-4 xl:grid-cols-2">
                  {disasterEvents.map((event: any, index: number) => (
                    <Surface key={`${event.eventType}-${event.eventId}-${index}`}>
                      <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/40">{event.eventType || "Disaster"} · {event.alertLevel || "Alert level not reported"}</p><h2 className="mt-2 text-lg font-black text-white">{event.name}</h2></div><CloudLightning size={19} className="shrink-0 text-cyan-200/48" /></div>
                      {event.description && <p className="mt-4 text-sm leading-7 text-cyan-100/55">{event.description}</p>}
                      <div className="mt-4 grid gap-2 text-xs text-cyan-100/42 sm:grid-cols-2"><span>{formatDate(event.fromDate)}</span><span>{event.country || event.affectedCountries?.map((item: any) => item.name).filter(Boolean).join(", ") || "Country not reported"}</span><span>Alert score: {event.alertScore ?? "Not reported"}</span><span>{event.severity || "Severity not reported"}</span></div>
                      <div className="mt-5"><SourceLink href={event.sourceUrl}>Open GDACS event</SourceLink></div>
                    </Surface>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "conflict" && (
          <>
            <SourceMessage result={sources.acled} empty="Run an AOR scan. ACLED results will appear after server credentials are configured." />
            {sources.acled.data?.configured && (
              <>
                <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Conflict events" value={formatNumber(conflictEvents.length)} note={`${sources.acled.data.startDate} through ${sources.acled.data.endDate}`} icon={Activity} />
                  <Metric label="Reported fatalities" value={formatNumber(conflictFatalities)} note="Sum across returned ACLED events" icon={Siren} />
                  <Metric label="Civilian targeting" value={formatNumber(conflictEvents.filter((event: any) => event.civilianTargeting).length)} note="Events explicitly tagged by ACLED" icon={ShieldAlert} />
                  <Metric label="Source" value="ACLED" note="Live event-level data" icon={RadioTower} />
                </section>
                <div className="grid gap-4 xl:grid-cols-2">{conflictEvents.slice(0, 80).map((event: any, index: number) => <Surface key={`${event.id}-${index}`}><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-rose-100/40">{event.eventType} · {event.subEventType}</p><h2 className="mt-2 text-lg font-black text-white">{event.location || event.admin1 || event.country}</h2><p className="mt-3 text-xs text-cyan-100/42">{[event.actor1, event.actor2].filter(Boolean).join(" ↔ ") || "Actors not reported"}</p><p className="mt-4 text-sm leading-7 text-cyan-100/55">{event.notes || "No event note returned."}</p><div className="mt-4 flex flex-wrap gap-4 text-xs text-cyan-100/42"><span>{formatDate(event.eventDate)}</span><span>Fatalities: {event.fatalities}</span><span>{event.sourceScale || "Source scale not reported"}</span></div></Surface>)}</div>
              </>
            )}
            <Surface className="mt-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/42">Curated major-conflict context</p><h2 className="mt-2 text-xl font-black text-white">CFR Global Conflict Tracker</h2></div><Landmark className="text-violet-200/45" /></div>
              <p className="mt-4 text-sm leading-7 text-cyan-100/54">CFR does not publish a documented public API. It remains link-only until a terms-compliant structured parser is validated so the application does not depend on a fragile iframe or silently republish copyrighted narrative content.</p>
              <div className="mt-5"><SourceLink href="https://www.cfr.org/global-conflict-tracker">Open CFR tracker</SourceLink></div>
            </Surface>
          </>
        )}

        {activeTab === "humanitarian" && (
          <>
            <SourceMessage result={sources.reliefweb} empty="Run an AOR scan. ReliefWeb health and humanitarian reports will appear after a pre-approved appname is configured." />
            {sources.reliefweb.data?.configured && (
              <>
                <section className="mb-6 grid gap-3 sm:grid-cols-3"><Metric label="Reports returned" value={formatNumber(reports.length)} note="Latest country-filtered reports" icon={FileText} /><Metric label="Country" value={sources.reliefweb.data.country} note="ReliefWeb country filter" icon={MapPinned} /><Metric label="Source" value="ReliefWeb" note="Curated humanitarian report index" icon={Globe2} /></section>
                <div className="grid gap-4 xl:grid-cols-2">{reports.map((report: any) => <Surface key={report.id || report.sourceUrl}><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-100/40">{report.sourceNames?.join(", ") || "Humanitarian report"}</p><h2 className="mt-2 text-lg font-black text-white">{report.title}</h2><p className="mt-4 text-sm leading-7 text-cyan-100/55">{report.summary || "Open the original report for details."}</p><div className="mt-4 flex flex-wrap gap-2">{(report.themes || []).slice(0, 5).map((theme: string) => <span key={theme} className="rounded-full border border-emerald-100/12 bg-emerald-300/[0.04] px-3 py-1 text-[10px] font-bold text-emerald-100/62">{theme}</span>)}</div><div className="mt-5 flex items-center justify-between gap-4"><span className="text-xs text-cyan-100/36">{formatDate(report.createdAt)}</span><SourceLink href={report.sourceUrl}>Open report</SourceLink></div></Surface>)}</div>
              </>
            )}
          </>
        )}

        <div className="mt-8 flex items-start gap-3 border-t border-cyan-100/10 pt-5 text-xs leading-6 text-cyan-100/38">
          <ShieldCheck size={16} className="mt-1 shrink-0" />
          <p>All layers remain separately attributed. Results can be delayed, incomplete, preliminary, revised, or unrelated to the specific operating site and require human review before operational use.</p>
        </div>
      </section>
    </main>
  );
}

export default AorRiskIntelligencePage;
