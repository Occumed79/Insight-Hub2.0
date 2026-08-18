import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleDashed, HeartPulse, Landmark, Loader2, RadioTower, Search, ShieldAlert, Siren } from "lucide-react";
import { GlassCard } from "@/components/insight/GlassCard";

type SourceReadiness = { id: string; name: string; configured: boolean; live: boolean; requirement: string | null };
type SourceResult = { data: any; error: string; loading: boolean };
type SourceState = { travel: SourceResult; who: SourceResult; gdacs: SourceResult; crisiswatch: SourceResult };

const emptyResult = (): SourceResult => ({ data: null, error: "", loading: false });
const initialSources = (): SourceState => ({ travel: emptyResult(), who: emptyResult(), gdacs: emptyResult(), crisiswatch: emptyResult() });

function Surface({ children }: { children: ReactNode }) {
  return (
    <GlassCard variant="glass" className="border border-white/20 bg-white/[0.055] p-[1px] shadow-[0_24px_72px_rgba(0,0,0,.28)] backdrop-blur-3xl">
      <div className="h-full rounded-[27px] border border-white/[0.12] bg-white/[0.03] p-5 md:p-6">{children}</div>
    </GlassCard>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Date not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

async function loadJson(url: string) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && payload?.configured !== false) throw new Error(payload?.error || `Request failed with HTTP ${response.status}`);
  return payload;
}

function SourceMessage({ result, empty }: { result: SourceResult; empty: string }) {
  if (result.loading) return <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-cyan-100/55"><Loader2 className="animate-spin" size={18} />Retrieving source data…</div>;
  if (result.error) return <div className="rounded-2xl border border-amber-200/16 bg-amber-300/[0.05] p-4 text-sm text-amber-50/75"><AlertTriangle size={16} className="mr-2 inline" />{result.error}</div>;
  if (!result.data) return <p className="py-8 text-sm leading-6 text-cyan-100/48">{empty}</p>;
  return null;
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200/72 hover:text-white">{children}<ArrowUpRight size={12} /></a>;
}

export default function AorCountryIntelligence() {
  const [country, setCountry] = useState("");
  const [sources, setSources] = useState<SourceState>(() => initialSources());
  const [readiness, setReadiness] = useState<SourceReadiness[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void loadJson("/api/aor/source-readiness")
      .then((payload) => setReadiness((payload.sources || []).filter((source: SourceReadiness) => ["state", "who", "gdacs", "crisiswatch"].includes(source.id))))
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
      runSource("crisiswatch", `/api/aor/crisiswatch?country=${encoded}`),
    ]);
    setRunning(false);
  }

  const advisory = sources.travel.data?.advisory;
  const outbreaks = sources.who.data?.outbreaks || [];
  const disasterEvents = sources.gdacs.data?.events || [];
  const crisisUpdates = sources.crisiswatch.data?.updates || [];
  const configuredCount = useMemo(() => readiness.filter((source) => source.configured).length, [readiness]);

  return (
    <div className="space-y-6" data-testid="aor-country-intelligence">
      <Surface>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">Country or operating area</span>
            <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-white/18 bg-white/[0.04] px-4 focus-within:border-cyan-100/34">
              <Search size={16} className="text-cyan-100/42" />
              <input value={country} onChange={(event) => setCountry(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runAll(); }} placeholder="Example: Kuwait" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/28" />
            </div>
          </label>
          <button type="button" onClick={() => void runAll()} disabled={running || !country.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/24 bg-cyan-300/[0.10] px-5 text-sm font-black text-white disabled:opacity-45">
            {running ? <Loader2 size={17} className="animate-spin" /> : <RadioTower size={17} />}Run country scan
          </button>
        </div>
      </Surface>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {readiness.map((source) => (
          <div key={source.id} className={`rounded-2xl border p-4 ${source.configured && source.live ? "border-emerald-200/14 bg-emerald-300/[0.04]" : "border-amber-200/14 bg-amber-300/[0.04]"}`}>
            <div className="flex items-start justify-between gap-3"><strong className="text-xs text-white">{source.name}</strong>{source.configured ? <CheckCircle2 size={15} /> : <CircleDashed size={15} />}</div>
            <p className="mt-2 text-[10px] text-cyan-100/38">{source.requirement || "Ready for live use"}</p>
          </div>
        ))}
        {!readiness.length ? <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs text-cyan-100/45">Loading source readiness…</div> : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Surface>
          <div className="flex items-center gap-2"><ShieldAlert size={16} className="text-cyan-200/65" /><h2 className="font-black">U.S. Department of State Travel Advisory</h2></div>
          <SourceMessage result={sources.travel} empty="Run a country scan to retrieve the State Department advisory." />
          {advisory ? <div className="mt-4 space-y-3"><div className="rounded-2xl border border-cyan-100/14 bg-cyan-300/[0.05] p-4"><p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/42">Travel posture</p><p className="mt-1 text-xl font-black">Level {advisory.level} · {advisory.levelLabel}</p><p className="mt-2 text-sm leading-6 text-cyan-100/52">{advisory.summary || advisory.details || "Review the official advisory for current guidance."}</p></div><SourceLink href={advisory.sourceUrl || sources.travel.data?.sourceUrl || "https://travel.state.gov/"}>Open State Department source</SourceLink></div> : null}
        </Surface>

        <Surface>
          <div className="flex items-center gap-2"><Landmark size={16} className="text-violet-200/65" /><h2 className="font-black">International Crisis Group CrisisWatch</h2></div>
          <SourceMessage result={sources.crisiswatch} empty="Run a country scan to retrieve CrisisWatch conflict context." />
          {sources.crisiswatch.data ? <><p className="mt-3 text-xs text-cyan-100/42">{sources.crisiswatch.data.directMatches || 0} direct country matches{sources.crisiswatch.data.fallbackUsed ? " · fallback regional feed shown" : ""}</p><div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">{crisisUpdates.map((item: any, index: number) => <a key={item.id || index} href={item.sourceUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.025] p-3 hover:border-violet-100/24"><strong className="text-xs leading-5">{item.title}</strong><p className="mt-1 text-[10px] text-cyan-100/38">{formatDate(item.publishedAt)}{item.matchedCountry ? " · direct match" : ""}</p>{item.summary ? <p className="mt-2 text-[11px] leading-5 text-cyan-100/48">{item.summary}</p> : null}</a>)}</div><div className="mt-4"><SourceLink href={sources.crisiswatch.data.sourceUrl || "https://www.crisisgroup.org/crisiswatch"}>Open CrisisWatch</SourceLink></div></> : null}
        </Surface>

        <Surface>
          <div className="flex items-center gap-2"><HeartPulse size={16} className="text-rose-200/65" /><h2 className="font-black">WHO country outbreak detail</h2></div>
          <SourceMessage result={sources.who} empty="Run a country scan for detailed WHO country-level outbreak matching." />
          {sources.who.data ? <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">{outbreaks.map((item: any, index: number) => <a key={item.id || index} href={item.sourceUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.025] p-3 hover:border-rose-100/24"><strong className="text-xs leading-5">{item.title}</strong><p className="mt-1 text-[10px] text-cyan-100/38">{formatDate(item.publicationDate)}{item.matchedCountry ? " · direct match" : ""}</p>{item.summary ? <p className="mt-2 text-[11px] leading-5 text-cyan-100/48">{item.summary}</p> : null}</a>)}</div> : null}
        </Surface>

        <Surface>
          <div className="flex items-center gap-2"><Siren size={16} className="text-amber-200/65" /><h2 className="font-black">GDACS country disaster detail</h2></div>
          <SourceMessage result={sources.gdacs} empty="Run a country scan for GDACS country-specific disaster alerts." />
          {sources.gdacs.data ? <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">{disasterEvents.map((item: any, index: number) => <a key={`${item.eventType}-${item.eventId}-${index}`} href={item.sourceUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.025] p-3 hover:border-amber-100/24"><strong className="text-xs leading-5">{item.alertLevel ? `${String(item.alertLevel).toUpperCase()} · ` : ""}{item.name}</strong><p className="mt-1 text-[10px] text-cyan-100/38">{item.country || country} · {formatDate(item.fromDate)}</p>{item.description ? <p className="mt-2 text-[11px] leading-5 text-cyan-100/48">{item.description}</p> : null}</a>)}</div> : null}
        </Surface>
      </div>

      <Surface>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100/44">Interpretation boundary</p>
        <p className="mt-2 text-sm leading-6 text-cyan-100/50">Travel advisories, outbreak reporting, disaster alerts, and CrisisWatch analysis use different definitions and update cycles. They remain separately attributed and are not collapsed into a fabricated composite danger score.</p>
        <p className="mt-2 text-[10px] text-cyan-100/32">Source readiness: {configuredCount}/{readiness.length || 4} configured.</p>
      </Surface>
    </div>
  );
}
