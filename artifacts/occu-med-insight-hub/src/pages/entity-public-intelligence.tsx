import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  BellRing,
  BookMarked,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileSearch,
  Gavel,
  Landmark,
  Link2,
  Loader2,
  MapPinned,
  Network,
  Scale,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { useEmployerWorkflow } from "@/components/insight/EmployerWorkflowContext";

const inputClass = "min-h-11 w-full rounded-xl border border-cyan-100/16 bg-[#040c16]/92 px-3 text-sm text-white outline-none transition placeholder:text-cyan-100/25 focus:border-cyan-200/42 focus:ring-2 focus:ring-cyan-300/10";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200/22 bg-cyan-300/10 px-4 text-xs font-black text-white transition hover:border-cyan-100/40 hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-40";

function money(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
    : "—";
}

function number(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : "—";
}

function date(value: string | null | undefined): string {
  if (!value) return "Not reported";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function ToolShell({ eyebrow, title, subtitle, notice, children }: { eyebrow: string; title: string; subtitle: string; notice: string; children: ReactNode }) {
  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10 2xl:px-14">
        <HeaderBar eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <GlassCard className="mb-5 border-cyan-100/14 bg-[#06101d]/72 p-4">
          <div className="flex items-start gap-3 text-xs leading-6 text-cyan-50/62"><ShieldCheck size={16} className="mt-1 shrink-0 text-cyan-200/70" /><p>{notice}</p></div>
        </GlassCard>
        {children}
      </section>
    </main>
  );
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <GlassCard className={`border-white/12 bg-[#071321]/76 p-5 ${className}`}>{children}</GlassCard>;
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Building2 }) {
  return <Surface><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-50/45">{label}</p><Icon size={15} className="text-cyan-200/50" /></div><p className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">{value}</p><p className="mt-1 text-xs leading-5 text-cyan-50/48">{note}</p></Surface>;
}

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <Surface className="border-rose-200/18"><div className="flex items-start gap-3 text-rose-50"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div><p className="font-black">Source request failed</p><p className="mt-1 text-xs leading-6 text-rose-100/62">{message}</p></div></div></Surface>;
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200/70 transition hover:text-white">{children}<ArrowUpRight size={13} /></a>;
}

function EntitySearch({ entityName, query, setQuery, loading, onRun, children }: { entityName: string; query: string; setQuery: (value: string) => void; loading: boolean; onRun: () => void; children?: ReactNode }) {
  return <Surface className="mb-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/48">Entity context</p><h2 className="mt-1 text-lg font-black text-white">{entityName || "No employer selected"}</h2><p className="mt-1 text-xs text-cyan-50/46">{entityName ? "Loaded from the shared employer workflow. This source will automatically follow the selected entity." : "Select an Entity first or search directly below."}</p></div>{entityName ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/20 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-black text-emerald-50"><Link2 size={12} />Entity-linked</span> : null}</div><div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">Organization</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onRun(); }} placeholder="Company or organization name" className={`mt-2 ${inputClass}`} /></label><button type="button" onClick={onRun} disabled={loading || !query.trim()} className={buttonClass}>{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}Refresh intelligence</button></div>{children}</Surface>;
}

function useEntitySeed(run: (value: string) => void) {
  const { context } = useEmployerWorkflow();
  const entityName = (context.legalName || context.employer || "").trim();
  const seeded = useRef("");
  useEffect(() => {
    if (!entityName || seeded.current === entityName) return;
    seeded.current = entityName;
    run(entityName);
  }, [entityName, run]);
  return entityName;
}

type FecCommittee = {
  committeeId: string;
  name: string;
  designation?: string;
  committeeType?: string;
  organizationType?: string;
  state?: string;
  treasurer?: string;
  filingFrequency?: string;
  sourceUrl: string;
};

type FecFiling = {
  committeeId: string;
  committeeName: string;
  formType?: string;
  reportType?: string;
  reportYear?: number | null;
  coverageStart?: string;
  coverageEnd?: string;
  receiptDate?: string;
  totalReceipts?: number | null;
  totalDisbursements?: number | null;
  cashOnHandEnd?: number | null;
  fileNumber?: string;
  sourceUrl: string;
};

type FecPayload = { ok: boolean; query: string; committees: FecCommittee[]; filings: FecFiling[]; limitation?: string; sourceUrl?: string };
type FecRelationship = { entity: string; committeeId: string; committeeName: string; confirmedAt: string; monitoring: boolean; lastSeenFilingKey: string };
const FEC_RELATIONSHIP_KEY = "insightHub.fec.relationships.v2";

function filingKey(filing: FecFiling | undefined): string {
  if (!filing) return "";
  return `${filing.committeeId}|${filing.fileNumber || ""}|${filing.receiptDate || ""}`;
}

function readFecRelationships(): Record<string, FecRelationship> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(FEC_RELATIONSHIP_KEY) || "{}"); } catch { return {}; }
}

function saveFecRelationship(key: string, relationship: FecRelationship) {
  if (typeof window === "undefined") return;
  const all = readFecRelationships();
  all[key] = relationship;
  window.localStorage.setItem(FEC_RELATIONSHIP_KEY, JSON.stringify(all));
}

export function EntityFecFilingsPage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<FecPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCommitteeId, setSelectedCommitteeId] = useState("");
  const [relationship, setRelationship] = useState<FecRelationship | null>(null);

  async function runSearch(value = query) {
    const clean = value.trim();
    if (!clean) return;
    setQuery(clean); setLoading(true); setError("");
    try {
      const response = await fetch(`/api/public-data/fec?query=${encodeURIComponent(clean)}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "FEC request failed.");
      setData(payload);
      const stored = readFecRelationships()[normalize(clean)] || null;
      setRelationship(stored);
      setSelectedCommitteeId(stored?.committeeId || payload.committees?.[0]?.committeeId || "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "FEC request failed.");
    } finally { setLoading(false); }
  }

  const entityName = useEntitySeed(runSearch);
  useEffect(() => {
    if (!entityName) return;
    const stored = readFecRelationships()[normalize(entityName)] || null;
    setRelationship(stored);
  }, [entityName]);

  const activeCommittee = data?.committees.find((item) => item.committeeId === selectedCommitteeId) || null;
  const filings = useMemo(() => (data?.filings || []).filter((item) => !selectedCommitteeId || item.committeeId === selectedCommitteeId), [data, selectedCommitteeId]);
  const timeline = useMemo(() => [...filings].filter((item) => item.receiptDate).sort((a, b) => String(a.receiptDate).localeCompare(String(b.receiptDate))).map((item) => ({ date: date(item.receiptDate), receipts: item.totalReceipts || 0, disbursements: item.totalDisbursements || 0 })), [filings]);
  const yearTrend = useMemo(() => {
    const map = new Map<number, { year: number; receipts: number; disbursements: number; filings: number }>();
    filings.forEach((item) => {
      const year = item.reportYear || (item.receiptDate ? new Date(item.receiptDate).getFullYear() : 0);
      if (!year) return;
      const row = map.get(year) || { year, receipts: 0, disbursements: 0, filings: 0 };
      row.receipts = Math.max(row.receipts, item.totalReceipts || 0);
      row.disbursements = Math.max(row.disbursements, item.totalDisbursements || 0);
      row.filings += 1;
      map.set(year, row);
    });
    return [...map.values()].sort((a, b) => a.year - b.year);
  }, [filings]);
  const latest = filings[0];
  const latestKey = filingKey(latest);
  const newSinceReview = useMemo(() => {
    if (!relationship?.monitoring || !relationship.lastSeenFilingKey) return 0;
    const index = filings.findIndex((item) => filingKey(item) === relationship.lastSeenFilingKey);
    return index < 0 ? filings.length : index;
  }, [filings, relationship]);

  function persistRelationship(next: FecRelationship) {
    const entity = (entityName || query).trim();
    if (!entity) return;
    const normalized = normalize(entity);
    const normalizedRelationship = { ...next, entity };
    saveFecRelationship(normalized, normalizedRelationship);
    setRelationship(normalizedRelationship);
  }

  function confirmRelationship() {
    if (!activeCommittee) return;
    persistRelationship({ entity: entityName || query, committeeId: activeCommittee.committeeId, committeeName: activeCommittee.name, confirmedAt: new Date().toISOString(), monitoring: relationship?.monitoring || false, lastSeenFilingKey: latestKey });
  }

  function toggleMonitoring() {
    if (!activeCommittee) return;
    const current = relationship?.committeeId === activeCommittee.committeeId ? relationship : null;
    persistRelationship({ entity: entityName || query, committeeId: activeCommittee.committeeId, committeeName: activeCommittee.name, confirmedAt: current?.confirmedAt || new Date().toISOString(), monitoring: !current?.monitoring, lastSeenFilingKey: current?.lastSeenFilingKey || latestKey });
  }

  function markReviewed() {
    if (!relationship) return;
    persistRelationship({ ...relationship, lastSeenFilingKey: latestKey });
  }

  return <ToolShell eyebrow="Entity Intelligence · OpenFEC" title="FEC Relationship Intelligence" subtitle="Resolve a company to a federal committee once, then keep the relationship, filing history, financial trend, and watch state attached to the Entity." notice="FEC committee-name matches require confirmation before they are treated as an entity relationship. Reported receipts are committee-level filing totals, not a list of individual contributors, and FEC contributor data is not used here for commercial solicitation.">
    <EntitySearch entityName={entityName} query={query} setQuery={setQuery} loading={loading} onRun={() => void runSearch()} />
    <ErrorBox message={error} />
    {data ? <>
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Committee candidates" value={number(data.committees.length)} note="Name matches requiring confirmation" icon={Users} /><Metric label="Filings in view" value={number(filings.length)} note={activeCommittee?.name || "Select a committee"} icon={FileSearch} /><Metric label="Relationship" value={relationship?.committeeId === selectedCommitteeId ? "Confirmed" : "Unconfirmed"} note={relationship?.confirmedAt ? `Saved ${date(relationship.confirmedAt)}` : "No saved committee relationship"} icon={CheckCircle2} /><Metric label="Watch state" value={relationship?.monitoring ? (newSinceReview ? `${newSinceReview} new` : "Current") : "Off"} note={relationship?.monitoring ? "Checked whenever this Entity loads" : "Enable watch-on-load for this relationship"} icon={relationship?.monitoring ? BellRing : Bell} /></section>
      <div className="grid gap-5 2xl:grid-cols-[.72fr_1.28fr]">
        <div className="space-y-5">
          <Surface><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/48">Committee relationship</p><h2 className="mt-1 text-lg font-black text-white">Confirm the correct committee once</h2><div className="mt-4 space-y-2">{data.committees.map((committee) => <button key={committee.committeeId} type="button" onClick={() => setSelectedCommitteeId(committee.committeeId)} className={`w-full rounded-xl border p-3 text-left transition ${selectedCommitteeId === committee.committeeId ? "border-cyan-200/30 bg-cyan-300/[0.08]" : "border-white/9 bg-black/15 hover:border-white/16"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-white">{committee.name}</p><p className="mt-1 text-[10px] text-cyan-50/45">{committee.committeeId} · {committee.committeeType || committee.designation || "Type not reported"}</p></div>{relationship?.committeeId === committee.committeeId ? <CheckCircle2 size={16} className="text-emerald-200" /> : null}</div></button>)}</div>{activeCommittee ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={confirmRelationship} className={buttonClass}><Link2 size={14} />Confirm relationship</button><button type="button" onClick={toggleMonitoring} className={buttonClass}>{relationship?.monitoring && relationship.committeeId === activeCommittee.committeeId ? <BellRing size={14} /> : <Bell size={14} />}{relationship?.monitoring && relationship.committeeId === activeCommittee.committeeId ? "Stop watching" : "Watch on load"}</button>{newSinceReview > 0 ? <button type="button" onClick={markReviewed} className={buttonClass}>Mark reviewed</button> : null}</div> : null}</Surface>
          {activeCommittee ? <Surface><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-50/48">Relationship graph</p><div className="mt-5 grid items-center gap-3 text-center md:grid-cols-[1fr_auto_1fr_auto_1fr]"><div className="rounded-2xl border border-cyan-200/18 bg-cyan-300/[0.06] p-4"><Building2 className="mx-auto text-cyan-200/65" size={20} /><p className="mt-2 text-xs font-black">{entityName || query}</p></div><div className="text-cyan-100/35">→</div><div className="rounded-2xl border border-violet-200/18 bg-violet-300/[0.06] p-4"><Landmark className="mx-auto text-violet-200/65" size={20} /><p className="mt-2 text-xs font-black">{activeCommittee.name}</p><p className="mt-1 text-[9px] text-cyan-50/42">{activeCommittee.committeeId}</p></div><div className="text-cyan-100/35">→</div><div className="rounded-2xl border border-emerald-200/18 bg-emerald-300/[0.06] p-4"><FileSearch className="mx-auto text-emerald-200/65" size={20} /><p className="mt-2 text-xs font-black">{filings.length} filings</p><p className="mt-1 text-[9px] text-cyan-50/42">Treasurer: {activeCommittee.treasurer || "not reported"}</p></div></div></Surface> : null}
        </div>
        <div className="space-y-5">
          {yearTrend.length ? <Surface><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-50/48">Reported financial trend</p><h2 className="mt-1 text-lg font-black">Committee receipts and disbursements by report year</h2></div><span className="text-[10px] text-cyan-50/42">Committee-level filing totals</span></div><div className="mt-4 h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={yearTrend}><CartesianGrid stroke="rgba(165,243,252,.08)" /><XAxis dataKey="year" tick={{ fill: "rgba(207,250,254,.62)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1_000_000)}m`} tick={{ fill: "rgba(207,250,254,.48)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "#06101d", border: "1px solid rgba(110,231,183,.2)", borderRadius: 12 }} /><Line dataKey="receipts" name="Reported receipts" stroke="#6ee7b7" strokeWidth={3} dot={false} /><Line dataKey="disbursements" name="Reported disbursements" stroke="#c4b5fd" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></Surface> : null}
          <Surface><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/48">Filing timeline</p><h2 className="mt-1 text-lg font-black">Recent committee activity</h2></div><Network size={18} className="text-cyan-200/50" /></div><div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">{filings.map((filing) => <div key={filingKey(filing)} className="rounded-xl border border-white/9 bg-black/15 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black text-white">{filing.formType || "FEC filing"} · {filing.reportType || "Report"}</p><p className="mt-1 text-[10px] text-cyan-50/43">Received {date(filing.receiptDate)} · coverage {date(filing.coverageStart)} – {date(filing.coverageEnd)}</p></div><SourceLink href={filing.sourceUrl}>Open filing</SourceLink></div><div className="mt-3 grid gap-2 text-[10px] text-cyan-50/50 sm:grid-cols-3"><span>Receipts {money(filing.totalReceipts)}</span><span>Disbursements {money(filing.totalDisbursements)}</span><span>Cash {money(filing.cashOnHandEnd)}</span></div></div>)}</div></Surface>
          {timeline.length === 0 ? <Surface><p className="text-sm text-cyan-50/50">No filing timeline is available for the selected committee.</p></Surface> : null}
        </div>
      </div>
    </> : null}
  </ToolShell>;
}

type Award = { awardId: string; recipientName: string; awardAmount: number | null; description: string; startDate: string; endDate: string; awardingAgency: string; awardingSubAgency?: string; city: string; state: string; country: string; naics: string; naicsDescription?: string; awardGroup: "contract" | "idv" };
type AwardsPayload = { ok: boolean; companyName: string; fromDate: string; toDate: string; awards: Award[]; totalAwardAmount: number; sourceUrl: string; limitation?: string };

function sumBy<T>(values: T[], key: (value: T) => string, amount: (value: T) => number) {
  const map = new Map<string, number>();
  values.forEach((item) => { const label = key(item) || "Not reported"; map.set(label, (map.get(label) || 0) + amount(item)); });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function EntityFederalAwardsPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear() - 7}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [group, setGroup] = useState<"all" | "contract" | "idv">("all");
  const [data, setData] = useState<AwardsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runSearch(value = query) {
    const clean = value.trim(); if (!clean) return;
    setQuery(clean); setLoading(true); setError("");
    try {
      const response = await fetch("/api/public-data/usaspending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName: clean, state, fromDate, toDate }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "USAspending request failed.");
      setData(payload);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "USAspending request failed."); }
    finally { setLoading(false); }
  }

  const entityName = useEntitySeed(runSearch);
  const awards = useMemo(() => (data?.awards || []).filter((award) => group === "all" || award.awardGroup === group), [data, group]);
  const total = useMemo(() => awards.reduce((sum, award) => sum + (award.awardAmount || 0), 0), [awards]);
  const agencies = useMemo(() => sumBy(awards, (award) => award.awardingAgency, (award) => award.awardAmount || 0), [awards]);
  const naics = useMemo(() => sumBy(awards, (award) => award.naics ? `${award.naics} ${award.naicsDescription || ""}`.trim() : "Not reported", (award) => award.awardAmount || 0), [awards]);
  const timeline = useMemo(() => {
    const map = new Map<number, number>();
    awards.forEach((award) => { const year = award.startDate ? new Date(award.startDate).getFullYear() : 0; if (year) map.set(year, (map.get(year) || 0) + (award.awardAmount || 0)); });
    return [...map.entries()].map(([year, value]) => ({ year, value })).sort((a, b) => a.year - b.year);
  }, [awards]);
  const footprint = useMemo(() => new Set(awards.map((award) => [award.city, award.state, award.country].filter(Boolean).join(", ")).filter(Boolean)), [awards]);
  const recompetes = useMemo(() => {
    const now = Date.now(); const horizon = now + 730 * 24 * 60 * 60 * 1000;
    return awards.filter((award) => { const end = Date.parse(award.endDate); return Number.isFinite(end) && end >= now && end <= horizon; }).sort((a, b) => Date.parse(a.endDate) - Date.parse(b.endDate));
  }, [awards]);
  const cues = useMemo(() => {
    const rules = [
      { label: "Respiratory / fit-testing relevance", terms: ["construction", "maintenance", "industrial", "hazard", "chemical", "environmental"] },
      { label: "Hearing-conservation relevance", terms: ["aviation", "aircraft", "ship", "construction", "maintenance", "manufacturing"] },
      { label: "Deployment / readiness relevance", terms: ["logistics", "defense", "security", "overseas", "base support", "mission support"] },
      { label: "Driver / safety-sensitive relevance", terms: ["transport", "vehicle", "fleet", "logistics", "driver"] },
    ];
    return rules.map((rule) => ({ ...rule, count: awards.filter((award) => rule.terms.some((term) => `${award.description} ${award.naicsDescription || ""}`.toLowerCase().includes(term))).length })).filter((rule) => rule.count > 0);
  }, [awards]);

  return <ToolShell eyebrow="Entity Intelligence · USAspending" title="Federal Awards Intelligence" subtitle="Turn federal award records into agency concentration, award timing, recompete windows, NAICS mix, geographic footprint, and occupational-health opportunity cues for the selected Entity." notice="USAspending award records describe federal spending and place-of-performance information. Recompete windows and occupational-health cues below are research aids derived from award dates and text; they do not establish staffing, contract renewal, workplace risk, or medical-service demand.">
    <EntitySearch entityName={entityName} query={query} setQuery={setQuery} loading={loading} onRun={() => void runSearch()}><div className="mt-4 grid gap-3 sm:grid-cols-3"><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">State optional</span><input value={state} onChange={(event) => setState(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} placeholder="VA" className={`mt-2 ${inputClass}`} /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={`mt-2 ${inputClass}`} /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={`mt-2 ${inputClass}`} /></label></div></EntitySearch>
    <ErrorBox message={error} />
    {data ? <>
      <div className="mb-5 flex flex-wrap gap-2">{(["all", "contract", "idv"] as const).map((item) => <button key={item} type="button" onClick={() => setGroup(item)} className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${group === item ? "border-cyan-200/28 bg-cyan-300/[0.09] text-white" : "border-white/10 text-cyan-50/48"}`}>{item === "all" ? "All awards" : item === "idv" ? "IDVs" : "Contracts"}</button>)}</div>
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Awards" value={number(awards.length)} note={`${group === "all" ? "All returned award groups" : group.toUpperCase()} in current view`} icon={BadgeDollarSign} /><Metric label="Displayed value" value={money(total)} note="Sum of returned awards in current filter" icon={CircleDollarSign} /><Metric label="Agency concentration" value={agencies[0] ? `${Math.round((agencies[0].value / Math.max(total, 1)) * 100)}%` : "—"} note={agencies[0]?.label || "No awarding agency"} icon={Landmark} /><Metric label="2-year expirations" value={number(recompetes.length)} note="Awards ending within the next 24 months" icon={CalendarDays} /></section>
      <div className="grid gap-5 2xl:grid-cols-2">
        <Surface><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/48">Agency concentration</p><h2 className="mt-1 text-lg font-black">Where the federal revenue is concentrated</h2><div className="mt-4 space-y-3">{agencies.slice(0, 8).map((item) => <div key={item.label}><div className="flex justify-between gap-3 text-xs"><span className="text-cyan-50/64">{item.label}</span><strong>{money(item.value)}</strong></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-cyan-300/60" style={{ width: `${Math.min(100, item.value / Math.max(total, 1) * 100)}%` }} /></div></div>)}</div></Surface>
        <Surface><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-50/48">Award timeline</p><h2 className="mt-1 text-lg font-black">Award value by start year</h2><div className="mt-4 h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={timeline}><CartesianGrid stroke="rgba(165,243,252,.08)" vertical={false} /><XAxis dataKey="year" tick={{ fill: "rgba(207,250,254,.62)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1_000_000)}m`} tick={{ fill: "rgba(207,250,254,.45)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "#06101d", border: "1px solid rgba(110,231,183,.2)", borderRadius: 12 }} /><Bar dataKey="value" name="Award value" fill="#6ee7b7" radius={[7, 7, 2, 2]} /></BarChart></ResponsiveContainer></div></Surface>
        <Surface><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-50/48">Expiration / recompete watch</p><h2 className="mt-1 text-lg font-black">Awards approaching end date</h2></div><TrendingUp size={18} className="text-violet-200/55" /></div><div className="mt-4 space-y-2">{recompetes.slice(0, 12).map((award) => <div key={award.awardId} className="rounded-xl border border-white/9 bg-black/15 p-3"><div className="flex justify-between gap-3"><p className="text-xs font-black">{award.awardId || award.recipientName}</p><span className="text-[10px] text-violet-100/65">Ends {date(award.endDate)}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-cyan-50/45">{award.description || "No description"}</p></div>)}{recompetes.length === 0 ? <p className="text-xs text-cyan-50/45">No returned awards end within the next 24 months.</p> : null}</div></Surface>
        <Surface><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-50/48">NAICS + geographic footprint</p><div className="mt-4 grid gap-5 md:grid-cols-2"><div><h2 className="text-sm font-black">NAICS distribution</h2><div className="mt-3 space-y-2">{naics.slice(0, 8).map((item) => <div key={item.label} className="rounded-xl border border-white/9 bg-black/15 p-3"><p className="text-[10px] font-bold text-white">{item.label}</p><p className="mt-1 text-[10px] text-cyan-50/45">{money(item.value)}</p></div>)}</div></div><div><h2 className="text-sm font-black">Places of performance</h2><p className="mt-2 text-3xl font-black">{footprint.size}</p><p className="text-[10px] text-cyan-50/45">Distinct returned city/state/country combinations</p><div className="mt-3 flex flex-wrap gap-2">{[...footprint].slice(0, 12).map((place) => <span key={place} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] text-cyan-50/55">{place}</span>)}</div></div></div></Surface>
        <Surface className="2xl:col-span-2"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-50/48">Occupational-health opportunity cues</p><h2 className="mt-1 text-lg font-black">What the award text suggests you should investigate next</h2><p className="mt-2 text-xs leading-5 text-cyan-50/46">Keyword-derived research cues only. They are not claims about the workforce or contract requirements.</p></div><MapPinned size={18} className="text-rose-200/55" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cues.map((cue) => <div key={cue.label} className="rounded-xl border border-rose-200/12 bg-rose-300/[0.035] p-4"><p className="text-xs font-black">{cue.label}</p><p className="mt-2 text-2xl font-black text-rose-100">{cue.count}</p><p className="text-[9px] text-cyan-50/42">returned awards contain matching operational terms</p></div>)}{cues.length === 0 ? <p className="text-xs text-cyan-50/45">No strong occupational-health keyword cues were detected in the returned award descriptions.</p> : null}</div></Surface>
      </div>
      <div className="mt-5"><SourceLink href={data.sourceUrl}>Open USAspending</SourceLink></div>
    </> : null}
  </ToolShell>;
}

type LegalReference = { caseName: string; docketNumber?: string; dateFiled?: string; court?: string; citation?: string; snippet?: string; contentSource?: string; contentAvailable?: boolean; recordType?: "opinion" | "recap"; documentDescription?: string; sourceUrl: string };
type LegalPayload = { ok: boolean; query: string; references: LegalReference[]; sourceUrl: string; limitation?: string };
type LegalClass = { employee: boolean; injury: boolean; workersComp: boolean; occupationalHealth: boolean; tort: boolean; role: "plaintiff-name-position" | "defendant-name-position" | "unclear" };
const SAVED_LEGAL_KEY = "insightHub.legal.savedCases.v2";

function classifyLegal(reference: LegalReference, entity: string): LegalClass {
  const body = `${reference.caseName} ${reference.documentDescription || ""} ${reference.snippet || ""}`.toLowerCase();
  const entityNeedle = normalize(entity);
  const caseName = normalize(reference.caseName);
  const employee = /\b(employee|employer|worker|workplace|employment|labor|occupational|job duties|on the job)\b/.test(body);
  const injury = /\b(injur|accident|fracture|burn|sprain|strain|fatal|death|medical treatment|disability|impairment)\b/.test(body);
  const workersComp = /\b(workers.? compensation|workmen.?s compensation|compensability|industrial commission|benefits claim|longshore|defense base act|dba)\b/.test(body);
  const occupationalHealth = /\b(occupational health|fitness for duty|medical exam|medical evaluation|drug test|hearing|audiogram|respirator|surveillance)\b/.test(body);
  const tort = /\b(negligence|wrongful death|premises liability|tort|personal injury)\b/.test(body);
  let role: LegalClass["role"] = "unclear";
  const split = caseName.split(" v ");
  if (entityNeedle && split.length >= 2) {
    if (split[0].includes(entityNeedle)) role = "plaintiff-name-position";
    else if (split.slice(1).join(" v ").includes(entityNeedle)) role = "defendant-name-position";
  }
  return { employee, injury, workersComp, occupationalHealth, tort, role };
}

function readSavedLegal(): Record<string, LegalReference[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(SAVED_LEGAL_KEY) || "{}"); } catch { return {}; }
}

export function EntityLegalReferencesPage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<LegalPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [relevance, setRelevance] = useState<"all" | "employee" | "injury" | "workers-comp" | "occupational-health">("all");
  const [saved, setSaved] = useState<LegalReference[]>([]);

  async function runSearch(value = query) {
    const clean = value.trim(); if (!clean) return;
    setQuery(clean); setLoading(true); setError("");
    try {
      const response = await fetch(`/api/public-data/courtlistener?query=${encodeURIComponent(clean)}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "CourtListener request failed.");
      setData(payload);
      setSaved(readSavedLegal()[normalize(clean)] || []);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "CourtListener request failed."); }
    finally { setLoading(false); }
  }

  const entityName = useEntitySeed(runSearch);
  useEffect(() => { if (entityName) setSaved(readSavedLegal()[normalize(entityName)] || []); }, [entityName]);

  const classified = useMemo(() => (data?.references || []).map((reference) => ({ reference, classification: classifyLegal(reference, entityName || query) })), [data, entityName, query]);
  const filtered = useMemo(() => classified.filter(({ reference, classification }) => {
    if (jurisdiction.trim() && !String(reference.court || "").toLowerCase().includes(jurisdiction.trim().toLowerCase())) return false;
    if (fromYear && Number(fromYear) > 0) { const year = reference.dateFiled ? new Date(reference.dateFiled).getFullYear() : 0; if (!year || year < Number(fromYear)) return false; }
    if (relevance === "employee" && !classification.employee) return false;
    if (relevance === "injury" && !classification.injury) return false;
    if (relevance === "workers-comp" && !classification.workersComp) return false;
    if (relevance === "occupational-health" && !classification.occupationalHealth) return false;
    return true;
  }), [classified, jurisdiction, fromYear, relevance]);
  const counts = useMemo(() => classified.reduce((acc, item) => ({ employee: acc.employee + (item.classification.employee ? 1 : 0), injury: acc.injury + (item.classification.injury ? 1 : 0), workersComp: acc.workersComp + (item.classification.workersComp ? 1 : 0), occupationalHealth: acc.occupationalHealth + (item.classification.occupationalHealth ? 1 : 0) }), { employee: 0, injury: 0, workersComp: 0, occupationalHealth: 0 }), [classified]);

  function isSaved(reference: LegalReference) { return saved.some((item) => item.sourceUrl === reference.sourceUrl); }
  function toggleSave(reference: LegalReference) {
    const entity = (entityName || query).trim(); if (!entity || typeof window === "undefined") return;
    const all = readSavedLegal(); const key = normalize(entity);
    const current = all[key] || [];
    const next = current.some((item) => item.sourceUrl === reference.sourceUrl) ? current.filter((item) => item.sourceUrl !== reference.sourceUrl) : [reference, ...current];
    all[key] = next; window.localStorage.setItem(SAVED_LEGAL_KEY, JSON.stringify(all)); setSaved(next);
  }

  return <ToolShell eyebrow="Entity Intelligence · CourtListener" title="Employee Injury & Legal Intelligence" subtitle="Automatically triage a selected Entity’s public court references for employee, injury, workers’ comp, occupational-health, and tort signals instead of dumping a free-text result list." notice="CourtListener results are public research references, not legal conclusions. Entity identity, party role, injury relevance, and case type tags below are heuristic triage aids and require human verification from the underlying docket or opinion.">
    <EntitySearch entityName={entityName} query={query} setQuery={setQuery} loading={loading} onRun={() => void runSearch()}><div className="mt-4 grid gap-3 sm:grid-cols-3"><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">Jurisdiction / court</span><input value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} placeholder="e.g. 9th Cir." className={`mt-2 ${inputClass}`} /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">Filed since year</span><input value={fromYear} onChange={(event) => setFromYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="2020" className={`mt-2 ${inputClass}`} /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">Relevance</span><select value={relevance} onChange={(event) => setRelevance(event.target.value as typeof relevance)} className={`mt-2 ${inputClass}`}><option value="all">All returned references</option><option value="employee">Employee / workplace</option><option value="injury">Injury / medical</option><option value="workers-comp">Workers’ comp / DBA</option><option value="occupational-health">Occupational health</option></select></label></div></EntitySearch>
    <ErrorBox message={error} />
    {data ? <>
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="References" value={number(data.references.length)} note="Deduplicated opinions + RECAP records" icon={Scale} /><Metric label="Employee signals" value={number(counts.employee)} note="Heuristic workplace/employment language" icon={Users} /><Metric label="Injury signals" value={number(counts.injury)} note="Heuristic injury/medical language" icon={Gavel} /><Metric label="Workers’ comp / DBA" value={number(counts.workersComp)} note="Heuristic compensation/DBA language" icon={FileSearch} /><Metric label="Saved cases" value={number(saved.length)} note="Persisted for this Entity in this browser" icon={BookMarked} /></section>
      <div className="grid gap-4 xl:grid-cols-2">{filtered.map(({ reference, classification }) => <Surface key={reference.sourceUrl}><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-50/40">{reference.recordType === "recap" ? "Federal docket / RECAP" : "Opinion"} · {date(reference.dateFiled)}</p><h2 className="mt-2 text-base font-black leading-6 text-white">{reference.caseName}</h2><p className="mt-1 text-[10px] text-cyan-50/43">{reference.court || "Court not reported"}{reference.docketNumber ? ` · ${reference.docketNumber}` : ""}</p></div><button type="button" onClick={() => toggleSave(reference)} className={`rounded-xl border p-2 ${isSaved(reference) ? "border-emerald-200/24 bg-emerald-300/[0.08] text-emerald-100" : "border-white/10 text-cyan-50/45"}`} aria-label={isSaved(reference) ? "Remove saved case" : "Save case"}><BookMarked size={16} /></button></div><div className="mt-3 flex flex-wrap gap-2">{classification.employee ? <span className="rounded-full border border-cyan-200/16 bg-cyan-300/[0.05] px-2.5 py-1 text-[9px] font-bold text-cyan-100">Employee/workplace</span> : null}{classification.injury ? <span className="rounded-full border border-rose-200/16 bg-rose-300/[0.05] px-2.5 py-1 text-[9px] font-bold text-rose-100">Injury/medical</span> : null}{classification.workersComp ? <span className="rounded-full border border-violet-200/16 bg-violet-300/[0.05] px-2.5 py-1 text-[9px] font-bold text-violet-100">Workers’ comp / DBA</span> : null}{classification.occupationalHealth ? <span className="rounded-full border border-emerald-200/16 bg-emerald-300/[0.05] px-2.5 py-1 text-[9px] font-bold text-emerald-100">Occupational health</span> : null}{classification.tort ? <span className="rounded-full border border-amber-200/16 bg-amber-300/[0.05] px-2.5 py-1 text-[9px] font-bold text-amber-100">Tort/personal injury</span> : null}<span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] text-cyan-50/42">{classification.role === "plaintiff-name-position" ? "Entity name appears before v." : classification.role === "defendant-name-position" ? "Entity name appears after v." : "Party role unclear"}</span></div>{reference.snippet ? <p className="mt-4 line-clamp-6 text-xs leading-6 text-cyan-50/56">{reference.snippet}</p> : <p className="mt-4 text-xs text-cyan-50/38">No public text excerpt was available; open the source for review.</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-[9px] text-cyan-50/35">{reference.contentSource || reference.documentDescription || "CourtListener metadata"}</span><SourceLink href={reference.sourceUrl}>Open record</SourceLink></div></Surface>)}{filtered.length === 0 ? <Surface className="xl:col-span-2"><p className="text-sm text-cyan-50/52">No returned references match the current triage filters.</p></Surface> : null}</div>
      <div className="mt-5"><SourceLink href={data.sourceUrl}>Open CourtListener</SourceLink></div>
    </> : null}
  </ToolShell>;
}
