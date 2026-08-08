import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}/api/${path}`;

type WatchlistRecord = {
  id: string;
  displayName: string;
  canonicalName: string;
  website: string | null;
  aliases: string[];
  uei: string | null;
  cage: string | null;
  relationshipType: string;
  sourceScope: string;
  status: "active" | "review" | "archived";
  evidenceUrl: string | null;
  evidenceNote: string | null;
};

type AwardRecord = {
  id: string;
  competitorId: string | null;
  competitorName: string | null;
  sourceScope: "federal" | "state";
  sourceName: string;
  stateCode: string | null;
  awardId: string;
  recipientName: string;
  recipientUei: string | null;
  title: string;
  description: string | null;
  agency: string | null;
  subagency: string | null;
  amount: number | null;
  actionDate: string | null;
  startDate: string | null;
  endDate: string | null;
  naics: string | null;
  psc: string | null;
  placeOfPerformance: string | null;
  sourceUrl: string;
  matchConfidence: number;
  matchMethod: string;
};

type CandidateRecord = {
  id: string;
  displayName: string;
  awardCount: number;
  totalValue: number;
  sourceScopes: string[];
  sampleAwards: Array<{ awardId: string; title: string; sourceName: string; amount: number | null }>;
};

type SourceCoverage = {
  key: string;
  scope: "federal" | "state";
  name: string;
  stateCode?: string;
  method: "api" | "open-data" | "official-index";
  configured: boolean;
  state: "ready" | "success" | "empty" | "disabled" | "error";
  resultCount: number;
  limitation: string;
  error?: string;
};

type Overview = {
  watchlist: WatchlistRecord[];
  awards: AwardRecord[];
  candidates: CandidateRecord[];
  sourceCoverage: SourceCoverage[];
  summary: {
    watchedCompetitors: number;
    awardsInWindow: number;
    totalAwardValue: number;
    candidateCompetitors: number;
    federalAwards: number;
    stateAwards: number;
  };
  generatedAt: string;
};

const EMPTY_OVERVIEW: Overview = {
  watchlist: [],
  awards: [],
  candidates: [],
  sourceCoverage: [],
  summary: { watchedCompetitors: 0, awardsInWindow: 0, totalAwardValue: 0, candidateCompetitors: 0, federalAwards: 0, stateAwards: 0 },
  generatedAt: "",
};

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Value not reported";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date not reported";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `Request failed with HTTP ${response.status}`);
  return payload as T;
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <GlassCard variant="glass" className="border-cyan-100/20 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.10)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/46">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-cyan-50/52">{hint}</p>
    </GlassCard>
  );
}

function StatusPill({ source }: { source: SourceCoverage }) {
  const good = source.state === "success" || source.state === "ready";
  const neutral = source.state === "empty";
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
      good && "border-emerald-200/24 bg-emerald-300/10 text-emerald-100",
      neutral && "border-cyan-100/20 bg-cyan-300/8 text-cyan-100/70",
      !good && !neutral && "border-amber-200/20 bg-amber-300/10 text-amber-100",
    )}>
      {source.state}
    </span>
  );
}

export default function CompetitiveAwardsPage() {
  const [overview, setOverview] = useState<Overview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"all" | "federal" | "state">("all");
  const [days, setDays] = useState(365);
  const [search, setSearch] = useState("");
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [candidateBusy, setCandidateBusy] = useState<string | null>(null);

  async function load(nextDays = days) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(api(`competitive-awards/overview?days=${nextDays}`), { cache: "no-store" });
      setOverview(await readJson<Overview>(response));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load competitive awards intelligence.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(days); }, [days]);

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(api("competitive-awards/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const payload = await readJson<{ overview: Overview }>(response);
      setOverview(payload.overview);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function reviewCandidate(candidate: CandidateRecord, action: "approve" | "reject") {
    setCandidateBusy(candidate.id);
    setError("");
    try {
      const response = await fetch(api(`competitive-awards/candidates/${encodeURIComponent(candidate.id)}/${action}`), { method: "POST" });
      await readJson<Record<string, unknown>>(response);
      await load(days);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `Unable to ${action} candidate.`);
    } finally {
      setCandidateBusy(null);
    }
  }

  const filteredAwards = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return overview.awards.filter((award) => {
      if (scope !== "all" && award.sourceScope !== scope) return false;
      if (!needle) return true;
      return [award.competitorName, award.recipientName, award.awardId, award.title, award.agency, award.subagency, award.naics, award.psc, award.stateCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [overview.awards, scope, search]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(8,145,178,.28),transparent_34%),radial-gradient(circle_at_70%_30%,rgba(59,130,246,.22),transparent_38%),radial-gradient(circle_at_82%_82%,rgba(124,58,237,.20),transparent_35%),linear-gradient(145deg,#020817_8%,#061827_48%,#070c24)]" />
      <Sidebar />
      <main className="relative min-h-screen px-5 pb-12 pt-24 sm:px-8 lg:ml-[210px] lg:px-10 lg:pt-8 xl:px-14">
        <HeaderBar
          eyebrow="Competitive intelligence"
          title="Competitive Awards"
          subtitle="Verified competitor identities, newly awarded federal contracts, state procurement wins, and reverse-discovered contract winners."
        />

        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Competitive awards summary">
          <MetricCard label="Active watchlist" value={String(overview.summary.watchedCompetitors)} hint="Verified or reviewed competitor identities" />
          <MetricCard label={`Awards · ${days}d`} value={String(overview.summary.awardsInWindow)} hint={`${overview.summary.federalAwards} federal · ${overview.summary.stateAwards} state`} />
          <MetricCard label="Reported value" value={formatMoney(overview.summary.totalAwardValue)} hint="Sum of source-reported values in view" />
          <MetricCard label="Candidates" value={String(overview.summary.candidateCompetitors)} hint="Recurring unknown winners awaiting review" />
        </section>

        <GlassCard variant="glass" className="mt-4 border-cyan-100/18 bg-white/[0.05] p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Award source scope">
              {(["all", "federal", "state"] as const).map((value) => (
                <button key={value} type="button" onClick={() => setScope(value)} className={cn("min-h-10 rounded-xl border px-4 text-xs font-black capitalize transition", scope === value ? "border-cyan-200/35 bg-cyan-300/14 text-white" : "border-white/10 bg-white/[0.03] text-cyan-50/58 hover:text-white")}>{value}</button>
              ))}
              {[90, 365, 730].map((value) => (
                <button key={value} type="button" onClick={() => setDays(value)} className={cn("min-h-10 rounded-xl border px-3 text-xs font-bold transition", days === value ? "border-violet-200/30 bg-violet-300/12 text-white" : "border-white/10 bg-white/[0.03] text-cyan-50/52 hover:text-white")}>{value === 730 ? "2 years" : `${value} days`}</button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-white/12 bg-black/15 px-3 sm:min-w-[290px]">
                <Search size={15} className="shrink-0 text-cyan-100/55" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search competitive awards" placeholder="Search winner, agency, award, NAICS or PSC" className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-cyan-100/32" />
              </label>
              <button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200/26 bg-cyan-300/12 px-4 text-xs font-black text-cyan-50 transition hover:bg-cyan-300/18 disabled:opacity-50">
                {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {refreshing ? "Refreshing sources" : "Refresh awards"}
              </button>
            </div>
          </div>
        </GlassCard>

        {error ? (
          <div role="alert" className="mt-4 rounded-2xl border border-rose-200/18 bg-rose-400/8 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_330px]">
          <GlassCard variant="glass" className="min-w-0 overflow-hidden border-cyan-100/18 bg-white/[0.045]">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/42">Recent wins</p>
                <h2 className="mt-1 text-lg font-black text-white">Award feed</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-bold text-cyan-50/55">{filteredAwards.length} shown</span>
            </div>

            {loading ? (
              <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-semibold text-cyan-50/65"><Loader2 size={18} className="animate-spin" />Loading award intelligence…</div>
            ) : filteredAwards.length === 0 ? (
              <div className="grid min-h-72 place-items-center px-6 text-center">
                <div>
                  <Radar className="mx-auto text-cyan-100/30" size={34} />
                  <p className="mt-4 text-sm font-black text-white">No matching award records yet</p>
                  <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-cyan-50/50">Run Refresh awards to query USAspending and active state sources. Only source-backed awards that survive strict identity matching are attached to watchlist competitors.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="bg-white/[0.025] text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/40">
                    <tr>
                      <th className="px-5 py-3">Winner</th><th className="px-4 py-3">Award</th><th className="px-4 py-3">Agency</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Classification</th><th className="px-4 py-3">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.055]">
                    {filteredAwards.map((award) => (
                      <tr key={award.id} className="align-top transition hover:bg-cyan-300/[0.035]">
                        <td className="px-5 py-4"><p className="max-w-[210px] text-sm font-black text-white">{award.competitorName || award.recipientName}</p><p className="mt-1 max-w-[210px] text-[10px] text-cyan-50/42">{award.recipientName}{award.recipientUei ? ` · UEI ${award.recipientUei}` : ""}</p></td>
                        <td className="px-4 py-4"><p className="max-w-[330px] text-xs font-bold leading-5 text-cyan-50/78">{award.title}</p><p className="mt-1 font-mono text-[10px] text-cyan-100/40">{award.awardId}</p></td>
                        <td className="px-4 py-4"><p className="max-w-[180px] text-xs font-semibold text-cyan-50/72">{award.agency || "Agency not reported"}</p>{award.subagency ? <p className="mt-1 text-[10px] text-cyan-50/38">{award.subagency}</p> : null}</td>
                        <td className="px-4 py-4 text-xs font-black text-white">{formatMoney(award.amount)}</td>
                        <td className="px-4 py-4 text-xs font-semibold text-cyan-50/62">{formatDate(award.actionDate || award.startDate)}</td>
                        <td className="px-4 py-4"><div className="flex max-w-[150px] flex-wrap gap-1">{award.naics ? <span className="rounded-lg bg-white/[0.055] px-2 py-1 text-[10px] text-cyan-50/60">NAICS {award.naics}</span> : null}{award.psc ? <span className="rounded-lg bg-white/[0.055] px-2 py-1 text-[10px] text-cyan-50/60">PSC {award.psc}</span> : null}{award.stateCode ? <span className="rounded-lg bg-violet-300/8 px-2 py-1 text-[10px] text-violet-100/70">{award.stateCode}</span> : null}</div></td>
                        <td className="px-4 py-4"><a href={award.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-cyan-200/78 hover:text-white">{award.sourceName}<ExternalLink size={12} /></a><p className="mt-1 text-[10px] text-cyan-50/36">{Math.round(award.matchConfidence * 100)}% identity match</p></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          <div className="space-y-5">
            <GlassCard variant="glass" className="border-violet-100/18 bg-white/[0.045] p-4">
              <div className="flex items-center gap-2"><Sparkles size={16} className="text-violet-200" /><h2 className="text-sm font-black text-white">Candidate competitors</h2></div>
              <p className="mt-2 text-xs leading-5 text-cyan-50/48">Unknown recipients repeatedly appearing in relevant award searches. Approval promotes the entity into the watchlist.</p>
              <div className="mt-4 space-y-3">
                {overview.candidates.length === 0 ? <p className="rounded-xl border border-white/8 bg-black/10 px-3 py-4 text-xs text-cyan-50/42">No candidates currently meet the recurring-winner threshold.</p> : overview.candidates.slice(0, 10).map((candidate) => (
                  <div key={candidate.id} className="rounded-xl border border-white/10 bg-black/12 p-3">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-white">{candidate.displayName}</p><p className="mt-1 text-[10px] text-cyan-50/42">{candidate.awardCount} hits · {formatMoney(candidate.totalValue)} · {candidate.sourceScopes.join(" + ")}</p></div></div>
                    <div className="mt-3 flex gap-2"><button type="button" onClick={() => void reviewCandidate(candidate, "approve")} disabled={candidateBusy === candidate.id} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-200/18 bg-emerald-300/8 text-[10px] font-black text-emerald-100 disabled:opacity-50"><Check size={12} />Add to watchlist</button><button type="button" onClick={() => void reviewCandidate(candidate, "reject")} disabled={candidateBusy === candidate.id} aria-label={`Dismiss ${candidate.displayName}`} className="inline-flex min-h-9 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-cyan-50/48 hover:text-white disabled:opacity-50"><X size={12} /></button></div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard variant="glass" className="border-cyan-100/18 bg-white/[0.045] p-4">
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-cyan-200" /><h2 className="text-sm font-black text-white">Source coverage</h2></div>
              <div className="mt-4 space-y-3">
                {overview.sourceCoverage.map((source) => <div key={source.key} className="rounded-xl border border-white/8 bg-black/10 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-white">{source.name}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-cyan-50/34">{source.scope}{source.stateCode ? ` · ${source.stateCode}` : ""} · {source.method}</p></div><StatusPill source={source} /></div><p className="mt-2 text-[10px] leading-4 text-cyan-50/38">{source.limitation}</p></div>)}
              </div>
            </GlassCard>
          </div>
        </section>

        <GlassCard variant="glass" className="mt-5 border-cyan-100/16 bg-white/[0.04]">
          <button type="button" onClick={() => setShowWatchlist((value) => !value)} aria-expanded={showWatchlist} className="flex min-h-14 w-full items-center justify-between px-5 text-left">
            <span className="flex items-center gap-2"><Building2 size={16} className="text-cyan-200/70" /><span className="text-sm font-black text-white">Competitor watchlist</span><span className="rounded-full bg-white/[0.055] px-2 py-0.5 text-[10px] font-bold text-cyan-50/45">{overview.watchlist.length}</span></span>
            <ChevronDown size={16} className={cn("text-cyan-50/40 transition", showWatchlist && "rotate-180")} />
          </button>
          {showWatchlist ? <div className="grid gap-3 border-t border-white/8 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{overview.watchlist.map((competitor) => <div key={competitor.id} className="rounded-xl border border-white/9 bg-black/10 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black text-white">{competitor.displayName}</p><p className="mt-1 text-[10px] text-cyan-50/38">{competitor.relationshipType.replaceAll("-", " ")} · {competitor.sourceScope}</p></div>{competitor.status === "review" ? <span className="rounded-full bg-amber-300/8 px-2 py-1 text-[9px] font-black uppercase text-amber-100/80">review</span> : null}</div><p className="mt-2 text-[10px] leading-4 text-cyan-50/46">{competitor.canonicalName}</p>{competitor.uei ? <p className="mt-1 font-mono text-[9px] text-emerald-100/55">UEI {competitor.uei}</p> : null}</div>)}</div> : null}
        </GlassCard>

        <div className="mt-5 flex items-center gap-2 text-[10px] text-cyan-50/30"><BadgeDollarSign size={12} /><span>Award records remain linked to their source. Loose company-name matches are intentionally rejected rather than guessed.</span></div>
      </main>
    </div>
  );
}
