import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileSearch,
  Filter,
  Landmark,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { useEmployerWorkflow } from "@/components/insight/EmployerWorkflowContext";

type Award = {
  awardId: string;
  recipientName: string;
  awardAmount: number | null;
  description: string;
  startDate: string;
  endDate: string;
  awardingAgency: string;
  awardingSubAgency?: string;
  city: string;
  state: string;
  country: string;
  naics: string;
  naicsDescription?: string;
  awardGroup: "contract" | "idv";
};

type AwardsPayload = {
  ok: boolean;
  companyName: string;
  fromDate: string;
  toDate: string;
  awards: Award[];
  totalAwardAmount: number;
  sourceUrl: string;
  limitation?: string;
};

type GroupMode = "all" | "contract" | "idv";

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
    : "—";
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return money(value);
}

function date(value: string) {
  if (!value) return "Not reported";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function aggregate(items: Award[], key: (award: Award) => string) {
  const map = new Map<string, { label: string; amount: number; count: number }>();
  for (const item of items) {
    const label = key(item).trim() || "Not reported";
    const current = map.get(label) || { label, amount: 0, count: 0 };
    current.amount += item.awardAmount || 0;
    current.count += 1;
    map.set(label, current);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || b.count - a.count);
}

function AwardRow({ award, selected, onSelect }: { award: Award; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`grid w-full grid-cols-[110px_minmax(0,1fr)_145px_108px] gap-3 border-b border-white/[.055] px-4 py-3 text-left transition ${selected ? "bg-sky-400/[.055]" : "hover:bg-white/[.018]"}`}>
      <span><strong className="block text-[11px] text-white">{award.awardGroup === "idv" ? "IDV" : "Contract"}</strong><span className="mt-1 block truncate text-[9px] text-slate-600">{award.awardId}</span></span>
      <span className="min-w-0"><strong className="block truncate text-[11px] text-slate-100">{award.description || "Federal award"}</strong><span className="mt-1 block truncate text-[9px] text-slate-600">{award.awardingAgency}{award.awardingSubAgency ? ` · ${award.awardingSubAgency}` : ""}</span></span>
      <span className="text-[10px] font-black text-emerald-100/78">{money(award.awardAmount)}</span>
      <span className="text-[9px] text-slate-600">{date(award.startDate)}</span>
    </button>
  );
}

export default function FederalAwardsV2() {
  const { context } = useEmployerWorkflow();
  const workflowName = (context.legalName || context.employer || "").trim();
  const [query, setQuery] = useState(workflowName);
  const [state, setState] = useState("");
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear() - 7}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<AwardsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("all");
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const seeded = useRef("");

  async function run(value = query) {
    const clean = value.trim();
    if (!clean) return;
    setQuery(clean);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/public-data/usaspending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: clean, state, fromDate, toDate }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "USAspending request failed.");
      const next = payload as AwardsPayload;
      setData(next);
      setSelectedId(next.awards[0]?.awardId || "");
      setAgencyFilter("all");
      setGroupMode("all");
      setTextFilter("");
    } catch (caught) {
      setData(null);
      setSelectedId("");
      setError(caught instanceof Error ? caught.message : "USAspending request failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (workflowName) setQuery(workflowName);
  }, [workflowName]);

  useEffect(() => {
    let cancelled = false;
    if (workflowName || query) return () => { cancelled = true; };
    void fetch("/api/entities/roster", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const first = payload?.entities?.[0]?.name;
        if (!cancelled && typeof first === "string" && first.trim()) setQuery(first.trim());
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [workflowName]);

  useEffect(() => {
    const clean = query.trim();
    if (!clean || seeded.current === clean) return;
    seeded.current = clean;
    void run(clean);
  }, [query]);

  const awards = data?.awards || [];
  const agencies = useMemo(() => aggregate(awards, (award) => award.awardingAgency), [awards]);
  const naics = useMemo(() => aggregate(awards, (award) => award.naicsDescription || award.naics), [awards]);
  const geographies = useMemo(() => aggregate(awards, (award) => [award.city, award.state, award.country].filter(Boolean).join(", ")), [awards]);
  const visibleAwards = useMemo(() => {
    const needle = textFilter.trim().toLowerCase();
    return awards.filter((award) => {
      if (groupMode !== "all" && award.awardGroup !== groupMode) return false;
      if (agencyFilter !== "all" && award.awardingAgency !== agencyFilter) return false;
      if (!needle) return true;
      return [award.awardId, award.recipientName, award.description, award.awardingAgency, award.awardingSubAgency, award.naics, award.naicsDescription, award.city, award.state, award.country]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [agencyFilter, awards, groupMode, textFilter]);
  const selected = awards.find((award) => award.awardId === selectedId) || visibleAwards[0] || null;
  const filteredAmount = visibleAwards.reduce((sum, award) => sum + (award.awardAmount || 0), 0);

  return (
    <main className="reviewer-native-page min-h-screen bg-[#090c10] text-white">
      <Sidebar />
      <section className="min-h-screen lg:ml-[210px]">
        <div className="px-6 pt-7"><HeaderBar eyebrow="Federal Spending Intelligence · USAspending" title="Federal Awards Intelligence" subtitle="The entity is the persistent object. Award history, agency concentration, geography, NAICS, and individual award evidence stay in one drill-down workspace." /></div>
        {error ? <div className="mx-6 mb-3 flex items-start gap-2 border-l-2 border-rose-300/35 pl-3 text-xs leading-5 text-rose-100/74"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</div> : null}

        <div className="grid min-h-[calc(100vh-120px)] grid-cols-[270px_minmax(0,1fr)_360px] border-y border-white/8">
          <aside className="border-r border-white/8 bg-[#0a0e13]/90">
            <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Entity context</p><h2 className="mt-1 text-lg font-black text-white">{data?.companyName || query || "Federal awards"}</h2></div><Building2 className="h-5 w-5 text-sky-100/38" /></div>
              <label className="mt-4 block"><span className="text-[9px] font-black uppercase tracking-[.11em] text-slate-600">Company / recipient</span><div className="mt-1.5 flex h-10 items-center gap-2 rounded-md border border-white/9 bg-black/20 px-3"><Search className="h-3.5 w-3.5 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void run()} placeholder="Company name" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div></label>
              <div className="mt-3 grid grid-cols-2 gap-2"><label><span className="text-[8px] font-black uppercase tracking-[.1em] text-slate-650">From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-white/9 bg-black/20 px-2 text-[10px] outline-none" /></label><label><span className="text-[8px] font-black uppercase tracking-[.1em] text-slate-650">To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-white/9 bg-black/20 px-2 text-[10px] outline-none" /></label></div>
              <label className="mt-3 block"><span className="text-[8px] font-black uppercase tracking-[.1em] text-slate-650">State filter sent to source</span><input value={state} onChange={(event) => setState(event.target.value)} placeholder="Optional state" className="mt-1 h-9 w-full rounded-md border border-white/9 bg-black/20 px-2 text-[10px] outline-none" /></label>
              <button onClick={() => void run()} disabled={loading || !query.trim()} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-sky-300/16 bg-sky-400/[.05] text-[10px] font-black text-sky-100 disabled:opacity-40">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}Refresh awards</button>

              <div className="mt-5 border-t border-white/8 pt-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Top awarding agencies</p><div className="mt-2 divide-y divide-white/7">{agencies.slice(0, 8).map((item) => <button key={item.label} onClick={() => setAgencyFilter(agencyFilter === item.label ? "all" : item.label)} className={`block w-full py-2.5 text-left ${agencyFilter === item.label ? "text-white" : "text-slate-400"}`}><div className="flex items-center justify-between gap-3"><span className="truncate text-[10px] font-bold">{item.label}</span><span className="shrink-0 text-[9px] text-emerald-100/55">{compactMoney(item.amount)}</span></div><p className="mt-1 text-[8px] text-slate-650">{item.count} award{item.count === 1 ? "" : "s"}</p></button>)}</div></div>

              <div className="mt-5 flex items-start gap-2 border-t border-white/8 pt-4 text-[9px] leading-5 text-slate-600"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Federal awards show contractor footprint and spending context. They are not a solicitation feed, injury data, or proof of a current operational requirement.</div>
            </div>
          </aside>

          <section className="min-w-0 bg-[#090c10]/72">
            <div className="grid grid-cols-4 border-b border-white/8 bg-[#0b0f14] px-4 py-3"><Metric label="Awards" value={visibleAwards.length.toLocaleString()} icon={<FileSearch className="h-3 w-3" />} /><Metric label="Value in view" value={compactMoney(filteredAmount)} icon={<CircleDollarSign className="h-3 w-3" />} /><Metric label="Agencies" value={agencies.length.toLocaleString()} icon={<Landmark className="h-3 w-3" />} /><Metric label="Geographies" value={geographies.length.toLocaleString()} icon={<MapPin className="h-3 w-3" />} /></div>
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-white/8 bg-[#0a0e13]/95 px-4 py-3 backdrop-blur-xl"><label className="relative min-w-[260px] flex-1"><Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" /><input value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="Filter award ID, description, agency, NAICS, geography" className="h-9 w-full rounded-md border border-white/9 bg-[#101419] pl-9 pr-3 text-[10px] outline-none placeholder:text-slate-700" /></label>{(["all", "contract", "idv"] as GroupMode[]).map((mode) => <button key={mode} onClick={() => setGroupMode(mode)} className={`h-9 rounded-md border px-3 text-[9px] font-black uppercase tracking-[.08em] ${groupMode === mode ? "border-sky-300/20 bg-sky-400/[.06] text-white" : "border-white/8 text-slate-500"}`}>{mode === "all" ? "All awards" : mode}</button>)}</div>
            <div className="grid grid-cols-[110px_minmax(0,1fr)_145px_108px] gap-3 border-b border-white/8 px-4 py-2 text-[8px] font-black uppercase tracking-[.1em] text-slate-650"><span>Type / ID</span><span>Award / agency</span><span>Amount</span><span>Start</span></div>
            {loading && !data ? <div className="grid min-h-[520px] place-items-center"><div className="text-center text-xs text-slate-500"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading USAspending records…</div></div> : visibleAwards.length ? visibleAwards.map((award) => <AwardRow key={award.awardId} award={award} selected={selected?.awardId === award.awardId} onSelect={() => setSelectedId(award.awardId)} />) : <div className="grid min-h-[520px] place-items-center text-center"><div><FileSearch className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-4 text-sm font-black text-slate-300">No awards match the current view.</p><p className="mt-2 text-xs text-slate-600">Change the entity, date window, source-state filter, or local filters.</p></div></div>}
          </section>

          <aside className="border-l border-white/8 bg-[#0d1014]/92">
            <div className="sticky top-0 max-h-screen overflow-y-auto p-5">
              {selected ? <>
                <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.13em] text-sky-100/38">Selected federal award</p><h2 className="mt-2 text-xl font-black leading-6 tracking-[-.025em] text-white">{selected.description || "Federal award"}</h2><p className="mt-2 text-[10px] text-slate-500">{selected.recipientName}</p></div><button onClick={() => setSelectedId("")} className="rounded-md border border-white/8 p-1.5 text-slate-600 hover:text-white"><X className="h-3.5 w-3.5" /></button></div>
                <div className="mt-5 border-y border-white/7 py-4"><p className="text-[8px] font-black uppercase tracking-[.11em] text-slate-650">Award amount</p><p className="mt-1 text-3xl font-black tracking-[-.04em] text-emerald-100">{money(selected.awardAmount)}</p></div>
                <div className="divide-y divide-white/7 text-[10px]"><Info label="Award ID" value={selected.awardId} /><Info label="Award type" value={selected.awardGroup === "idv" ? "Indefinite delivery vehicle" : "Contract"} /><Info label="Agency" value={selected.awardingAgency || "Not reported"} /><Info label="Sub-agency" value={selected.awardingSubAgency || "Not reported"} /><Info label="Start" value={date(selected.startDate)} /><Info label="End" value={date(selected.endDate)} /><Info label="Place" value={[selected.city, selected.state, selected.country].filter(Boolean).join(", ") || "Not reported"} /><Info label="NAICS" value={[selected.naics, selected.naicsDescription].filter(Boolean).join(" · ") || "Not reported"} /></div>
                <a href={`https://www.usaspending.gov/award/${encodeURIComponent(selected.awardId)}`} target="_blank" rel="noreferrer" className="mt-5 flex min-h-10 items-center justify-between gap-3 rounded-md border border-emerald-300/15 bg-emerald-400/[.04] px-3 text-[10px] font-black text-emerald-100"><span>Open USAspending award</span><ArrowUpRight className="h-3.5 w-3.5" /></a>

                <section className="mt-6 border-t border-white/8 pt-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Recipient concentration context</p><div className="mt-3 space-y-3"><MiniRanking label="Top NAICS" items={naics.slice(0, 4)} /><MiniRanking label="Top locations" items={geographies.slice(0, 4)} /></div></section>
              </> : <div className="grid min-h-[520px] place-items-center text-center"><div><CircleDollarSign className="mx-auto h-8 w-8 text-slate-700" /><h2 className="mt-4 text-lg font-black">Select an award</h2><p className="mx-auto mt-2 max-w-[260px] text-xs leading-5 text-slate-600">Agency, geography, dates, NAICS, amount, and the official award record remain visible here.</p></div></div>}

              {data?.limitation ? <div className="mt-6 border-l-2 border-amber-300/24 pl-3 text-[9px] leading-5 text-amber-100/56">{data.limitation}</div> : null}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="border-r border-white/8 px-4 first:pl-0 last:border-r-0"><div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.1em] text-slate-650">{icon}{label}</div><p className="mt-1 text-[14px] font-black text-white">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 py-3"><span className="text-slate-650">{label}</span><strong className="break-words font-semibold text-slate-300">{value}</strong></div>;
}

function MiniRanking({ label, items }: { label: string; items: Array<{ label: string; amount: number; count: number }> }) {
  return <div><p className="text-[8px] font-black uppercase tracking-[.1em] text-slate-650">{label}</p><div className="mt-1 divide-y divide-white/7">{items.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate text-[9px] text-slate-500">{item.label}</span><span className="shrink-0 text-[9px] font-black text-slate-400">{compactMoney(item.amount)}</span></div>)}</div></div>;
}
