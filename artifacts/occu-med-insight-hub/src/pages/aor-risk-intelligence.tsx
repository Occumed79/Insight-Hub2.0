import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  CloudLightning,
  Flame,
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
  crisiswatch: SourceResult;
};

const emptyResult = (): SourceResult => ({ data: null, error: "", loading: false });

const initialSources = (): SourceState => ({
  travel: emptyResult(),
  who: emptyResult(),
  gdacs: emptyResult(),
  crisiswatch: emptyResult(),
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
  if (configured && live) {
    return "border-emerald-200/22 bg-emerald-300/[0.07] text-emerald-100/86";
  }
  return "border-amber-200/20 bg-amber-300/[0.06] text-amber-100/78";
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white/26 bg-white/[0.075] p-[1px] shadow-[0_24px_72px_rgba(0,0,0,.28),0_0_34px_rgba(186,230,253,.09)] backdrop-blur-3xl ${className}`}>
      <div className="h-full rounded-[27px] border border-white/[0.16] bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.22)] md:p-6">
        {children}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
}) {
  return (
    <Surface>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/52">{label}</p>
        <Icon size={15} className="text-cyan-100/64" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-cyan-100/56">{note}</p>
    </Surface>
  );
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-100/78 transition hover:text-white"
    >
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}

function SourceMessage({ result, empty }: { result: SourceResult; empty: string }) {
  if (result.loading) {
    return (
      <div className="flex min-h-[180px] items-center justify-center gap-3 text-sm text-cyan-100/62">
        <Loader2 className="animate-spin" size={19} />
        Retrieving source data…
      </div>
    );
  }
  if (result.error) {
    return (
      <Surface>
        <div className="flex items-start gap-3 text-amber-100">
          <AlertTriangle size={19} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-black">Source unavailable</p>
            <p className="mt-2 text-sm leading-6 text-amber-100/70">{result.error}</p>
          </div>
        </div>
      </Surface>
    );
  }
  if (!result.data) {
    return (
      <Surface>
        <p className="text-sm leading-7 text-cyan-100/60">{empty}</p>
      </Surface>
    );
  }
  return null;
}

async function loadJson(url: string): Promise<any> {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok && payload?.configured !== false) {
    throw new Error(payload?.error || `Request failed with HTTP ${response.status}`);
  }
  return payload;
}

function normalizeReadiness(items: SourceReadiness[]): SourceReadiness[] {
  const allowedIds = new Set(["state", "who", "gdacs", "crisiswatch"]);
  const filtered = items.filter((source) => allowedIds.has(source.id));
  if (!filtered.some((source) => source.id === "crisiswatch")) {
    filtered.push({
      id: "crisiswatch",
      name: "International Crisis Group CrisisWatch",
      configured: true,
      live: true,
      requirement: null,
    });
  }
  return filtered;
}

export function AorRiskIntelligencePage() {
  const [country, setCountry] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sources, setSources] = useState<SourceState>(() => initialSources());
  const [readiness, setReadiness] = useState<SourceReadiness[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void loadJson("/api/aor/source-readiness")
      .then((payload) => setReadiness(normalizeReadiness(payload.sources || [])))
      .catch(() => setReadiness(normalizeReadiness([])));
  }, []);

  async function runSource(key: keyof SourceState, url: string) {
    setSources((current) => ({
      ...current,
      [key]: { data: null, error: "", loading: true },
    }));
    try {
      const payload = await loadJson(url);
      setSources((current) => ({
        ...current,
        [key]: { data: payload, error: payload?.error || "", loading: false },
      }));
    } catch (error) {
      setSources((current) => ({
        ...current,
        [key]: {
          data: null,
          error: error instanceof Error ? error.message : "Source request failed",
          loading: false,
        },
      }));
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
      runSource("crisiswatch", `/api/aor/crisiswatch?country=${encoded}`),
    ]);
    setRunning(false);
  }

  const advisory = sources.travel.data?.advisory;
  const outbreaks = sources.who.data?.outbreaks || [];
  const disasterEvents = sources.gdacs.data?.events || [];
  const crisisUpdates = sources.crisiswatch.data?.updates || [];
  const activeAlerts = disasterEvents.filter((event: any) =>
    ["orange", "red"].includes(String(event.alertLevel || "").toLowerCase()),
  );
  const outbreakMatches = outbreaks.filter((item: any) => item.matchedCountry);
  const configuredCount = useMemo(
    () => readiness.filter((source) => source.configured).length,
    [readiness],
  );

  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Area of Responsibility Intelligence"
          title="AOR Risk Intelligence"
          subtitle="Country-level travel, health-crisis, disaster, and conflict context from separately attributed public sources."
        />

        <GlassCard
          variant="glass"
          className="mb-6 border border-white/28 bg-white/[0.075] p-[1px] shadow-[0_30px_95px_rgba(0,0,0,.32),0_0_42px_rgba(186,230,253,.10)] backdrop-blur-3xl"
        >
          <div className="rounded-[27px] border border-white/[0.16] bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.22)] md:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <label>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/56">
                  Country or operating area
                </span>
                <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-white/26 bg-white/[0.065] px-4 backdrop-blur-2xl focus-within:border-white/48">
                  <Search size={17} className="text-cyan-100/52" />
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void runAll();
                    }}
                    placeholder="Example: Kuwait"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/38"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={() => void runAll()}
                disabled={running || !country.trim()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/32 bg-white/[0.11] px-5 text-sm font-black text-white shadow-[0_0_30px_rgba(186,230,253,.10),inset_0_1px_0_rgba(255,255,255,.22)] backdrop-blur-2xl transition hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-45"
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
              className={`min-h-10 whitespace-nowrap rounded-2xl border px-4 text-xs font-bold backdrop-blur-xl transition ${
                activeTab === tab.id
                  ? "border-white/40 bg-white/[0.14] text-white shadow-[0_0_24px_rgba(186,230,253,.10),inset_0_1px_0_rgba(255,255,255,.22)]"
                  : "border-white/20 bg-white/[0.045] text-cyan-100/58 hover:border-white/32 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <>
            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Source readiness"
                value={readiness.length ? `${configuredCount}/${readiness.length}` : "Loading"}
                note="Configured source adapters"
                icon={ShieldCheck}
              />
              <Metric
                label="Travel posture"
                value={advisory?.level ? `Level ${advisory.level}` : "Not scanned"}
                note={advisory?.levelLabel || "Run a country scan"}
                icon={ShieldAlert}
              />
              <Metric
                label="Outbreak matches"
                value={formatNumber(outbreakMatches.length)}
                note="WHO reports with direct country text matches"
                icon={HeartPulse}
              />
              <Metric
                label="Conflict context"
                value={sources.crisiswatch.data ? formatNumber(sources.crisiswatch.data.directMatches) : "Not scanned"}
                note="CrisisWatch country-matched updates"
                icon={Landmark}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
              <Surface>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/54">
                      Source readiness
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">Connected intelligence layers</h2>
                  </div>
                  <RadioTower className="text-cyan-100/58" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {readiness.map((source) => (
                    <div
                      key={source.id}
                      className={`rounded-2xl border p-4 backdrop-blur-xl ${sourceTone(source.configured, source.live)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-white">{source.name}</p>
                          <p className="mt-1 text-xs leading-5 opacity-80">
                            {source.requirement || "Ready for live use"}
                          </p>
                        </div>
                        {source.configured ? <CheckCircle2 size={16} /> : <CircleDashed size={16} />}
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>

              <Surface>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/54">
                  Interpretation boundary
                </p>
                <h2 className="mt-2 text-xl font-black text-white">No unsupported composite danger score</h2>
                <p className="mt-4 text-sm leading-7 text-cyan-100/62">
                  Travel guidance, outbreak reports, conflict analysis, and disaster alerts use different definitions and update cycles. The workspace keeps each evidence stream separate instead of combining unlike sources into one misleading score.
                </p>
              </Surface>
            </section>
          </>
        )}

        {activeTab === "travel" && (
          <>
            <SourceMessage
              result={sources.travel}
              empty="Run an AOR scan to retrieve the official U.S. Department of State travel advisory."
            />
            {advisory && (
              <section className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
                <Surface>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/54">Official advisory posture</p>
                  <p className="mt-4 text-5xl font-black text-amber-100">{advisory.level ? `Level ${advisory.level}` : "—"}</p>
                  <h2 className="mt-3 text-xl font-black text-white">{advisory.levelLabel}</h2>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {(advisory.riskFactors || []).map((factor: string) => (
                      <span key={factor} className="rounded-full border border-amber-100/20 bg-amber-300/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100/82">
                        {factor}
                      </span>
                    ))}
                  </div>
                </Surface>
                <Surface>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/54">Official-source excerpt</p>
                  <h2 className="mt-2 text-xl font-black text-white">{advisory.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-cyan-100/64">{advisory.summary}</p>
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <span className="text-xs text-cyan-100/50">{advisory.updatedAt || "Date not parsed"}</span>
                    <SourceLink href={advisory.sourceUrl}>Read full advisory</SourceLink>
                  </div>
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
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-rose-100/58">{outbreak.matchedCountry ? "Country match" : "Recent global outbreak"}</p>
                          <h2 className="mt-2 text-lg font-black text-white">{outbreak.title}</h2>
                        </div>
                        <HeartPulse size={19} className="shrink-0 text-rose-100/68" />
                      </div>
                      <p className="mt-4 text-sm leading-7 text-cyan-100/62">{outbreak.summary || "No summary returned."}</p>
                      {outbreak.assessment && <div className="mt-4 rounded-2xl border border-rose-100/16 bg-rose-300/[0.05] p-4 text-xs leading-6 text-rose-100/72">{outbreak.assessment}</div>}
                      <div className="mt-5 flex items-center justify-between gap-4">
                        <span className="text-xs text-cyan-100/48">{formatDate(outbreak.publicationDate)}</span>
                        <SourceLink href={outbreak.sourceUrl}>Open WHO report</SourceLink>
                      </div>
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
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/54">{event.eventType || "Disaster"} · {event.alertLevel || "Alert level not reported"}</p>
                          <h2 className="mt-2 text-lg font-black text-white">{event.name}</h2>
                        </div>
                        <CloudLightning size={19} className="shrink-0 text-cyan-100/66" />
                      </div>
                      {event.description && <p className="mt-4 text-sm leading-7 text-cyan-100/62">{event.description}</p>}
                      <div className="mt-4 grid gap-2 text-xs text-cyan-100/50 sm:grid-cols-2">
                        <span>{formatDate(event.fromDate)}</span>
                        <span>{event.country || event.affectedCountries?.map((item: any) => item.name).filter(Boolean).join(", ") || "Country not reported"}</span>
                        <span>Alert score: {event.alertScore ?? "Not reported"}</span>
                        <span>{event.severity || "Severity not reported"}</span>
                      </div>
                      <div className="mt-5"><SourceLink href={event.sourceUrl}>Open GDACS event</SourceLink></div>
                    </Surface>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "conflict" && (
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/56">Curated conflict context</p>
                <h2 className="mt-2 text-2xl font-black text-white">International Crisis Group CrisisWatch</h2>
              </div>
              <Landmark className="text-violet-100/66" />
            </div>
            <SourceMessage
              result={sources.crisiswatch}
              empty="Run an AOR scan to retrieve CrisisWatch conflict analysis for the selected country or operating area."
            />
            {sources.crisiswatch.data && (
              <>
                <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Updates returned" value={formatNumber(crisisUpdates.length)} note="CrisisWatch RSS entries" icon={Landmark} />
                  <Metric label="Direct matches" value={formatNumber(sources.crisiswatch.data.directMatches)} note="Country text matches" icon={MapPinned} />
                  <Metric label="Latest update" value={crisisUpdates[0] ? formatDate(crisisUpdates[0].publishedAt) : "None"} note="Newest returned entry" icon={CalendarDays} />
                  <Metric label="Source" value="CrisisWatch" note="Qualitative early-warning analysis" icon={RadioTower} />
                </section>
                {sources.crisiswatch.data.fallbackUsed && (
                  <div className="mb-4 rounded-2xl border border-amber-200/20 bg-amber-300/[0.06] px-4 py-3 text-xs leading-6 text-amber-100/76 backdrop-blur-xl">
                    No direct country text match was found, so the most recent global CrisisWatch updates are shown for review.
                  </div>
                )}
                <div className="grid gap-4 xl:grid-cols-2">
                  {crisisUpdates.map((update: any) => (
                    <Surface key={update.id || update.sourceUrl}>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-100/58">{update.matchedCountry ? "Country match" : "Recent CrisisWatch update"}</p>
                      <h3 className="mt-2 text-lg font-black text-white">{update.title}</h3>
                      <p className="mt-4 text-sm leading-7 text-cyan-100/62">{update.summary || "No summary returned."}</p>
                      <div className="mt-5 flex items-center justify-between gap-4">
                        <span className="text-xs text-cyan-100/48">{formatDate(update.publishedAt)}</span>
                        <SourceLink href={update.sourceUrl}>Open CrisisWatch source</SourceLink>
                      </div>
                    </Surface>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-6 text-cyan-100/48">{sources.crisiswatch.data.limitation}</p>
              </>
            )}
          </section>
        )}

        <div className="mt-8 flex items-start gap-3 border-t border-cyan-100/14 pt-5 text-xs leading-6 text-cyan-100/52">
          <AlertTriangle size={15} className="mt-1 shrink-0" />
          <p>
            These public-source layers support operational awareness and research. They do not replace official security, medical, emergency-management, or travel decisions. Review the linked source and its publication date before acting.
          </p>
        </div>
      </section>
    </main>
  );
}

export default AorRiskIntelligencePage;
