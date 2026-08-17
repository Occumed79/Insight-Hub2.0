import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  Gauge,
  Loader2,
  Search,
  TrendingDown,
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
import { GlassCard } from "@/components/insight/GlassCard";
import {
  EvidenceGradeBadge,
  MetricOrb,
  NumberField,
  OccupationalToolShell,
  ToolHero,
} from "@/components/insight/OccupationalToolPrimitives";
import { calculateIncidentRate, expectedCasesFromHours } from "@/data/occupationalCalculations";
import type { BlsBenchmark } from "@/data/employerIntelligenceApi";

type Sector = {
  id: string;
  naics: string;
  label: string;
  description: string;
  benchmark: BlsBenchmark | null;
  message?: string;
};

type Overview = {
  sectors: Sector[];
  ranked: Sector[];
  limitation?: string;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function number(value: number, digits = 1): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("en-US", { maximumFractionDigits: digits });
}

export default function IndustryImpactCalculator() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [benchmark, setBenchmark] = useState<BlsBenchmark | null>(null);
  const [selectedNaics, setSelectedNaics] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [workforce, setWorkforce] = useState(0);
  const [annualHours, setAnnualHours] = useState(0);
  const [recordables, setRecordables] = useState(0);
  const [dartCases, setDartCases] = useState(0);
  const [daysAwayCases, setDaysAwayCases] = useState(0);
  const [targetTrir, setTargetTrir] = useState(0);
  const [lowCost, setLowCost] = useState(0);
  const [baseCost, setBaseCost] = useState(0);
  const [highCost, setHighCost] = useState(0);
  const [indirectMultiplier, setIndirectMultiplier] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);

  useEffect(() => {
    void fetch("/api/occupational-discovery/bls-overview")
      .then((response) => response.json())
      .then((payload) => { if (payload.ok) setOverview(payload); })
      .catch(() => undefined);
  }, []);

  function selectPrepared(sector: Sector) {
    setSelectedNaics(sector.naics);
    setBenchmark(sector.benchmark);
    setMessage(sector.message || "");
    if (sector.benchmark?.trcRate != null) setTargetTrir(sector.benchmark.trcRate);
  }

  async function lookup() {
    if (!selectedNaics.trim()) return;
    setLoading(true); setMessage(""); setBenchmark(null);
    try {
      const params = new URLSearchParams({ naics: selectedNaics.trim() });
      if (year.trim()) params.set("year", year.trim());
      const response = await fetch(`/api/bls/industry-benchmark?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "BLS lookup failed.");
      setBenchmark(payload.benchmark ?? null);
      setMessage(payload.message || payload.limitation || "");
      if (payload.benchmark?.trcRate != null) setTargetTrir(payload.benchmark.trcRate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "BLS lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  const model = useMemo(() => {
    const observedTrir = calculateIncidentRate(recordables, annualHours);
    const observedDart = calculateIncidentRate(dartCases, annualHours);
    const observedAway = calculateIncidentRate(daysAwayCases, annualHours);
    const benchmarkTrir = benchmark?.trcRate ?? 0;
    const benchmarkCases = expectedCasesFromHours(benchmarkTrir, annualHours);
    const benchmarkDartCases = expectedCasesFromHours(benchmark?.dartRate, annualHours);
    const targetRate = targetTrir > 0 ? targetTrir : benchmarkTrir;
    const targetCases = expectedCasesFromHours(targetRate, annualHours);
    const avoidedCases = Math.max(recordables - targetCases, 0);
    const excessVsBenchmark = Math.max(recordables - benchmarkCases, 0);
    const gapPercent = benchmarkTrir > 0 ? ((observedTrir / benchmarkTrir) - 1) * 100 : null;
    const direct = {
      low: avoidedCases * Math.max(lowCost, 0),
      base: avoidedCases * Math.max(baseCost, 0),
      high: avoidedCases * Math.max(highCost, 0),
    };
    const multiplier = Math.max(indirectMultiplier, 0);
    const total = {
      low: direct.low * (1 + multiplier),
      base: direct.base * (1 + multiplier),
      high: direct.high * (1 + multiplier),
    };
    const margin = Math.max(profitMargin, 0) / 100;
    const salesRecovery = margin > 0 ? total.base / margin : 0;
    const trajectory = Array.from({ length: 6 }, (_, index) => {
      const fraction = index / 5;
      const start = annualHours > 0 ? observedTrir : 0;
      const end = targetRate;
      const rate = start + (end - start) * fraction;
      const cases = expectedCasesFromHours(rate, annualHours);
      return { year: index === 0 ? "Now" : `Year ${index}`, rate, cases, avoided: Math.max(recordables - cases, 0) };
    });
    return { observedTrir, observedDart, observedAway, benchmarkTrir, benchmarkCases, benchmarkDartCases, targetRate, targetCases, avoidedCases, excessVsBenchmark, gapPercent, total, salesRecovery, trajectory };
  }, [annualHours, recordables, dartCases, daysAwayCases, benchmark, targetTrir, lowCost, baseCost, highCost, indirectMultiplier, profitMargin]);

  const hasObserved = annualHours > 0;
  const hasBenchmark = Boolean(benchmark?.trcRate != null);
  const comparison = hasObserved && hasBenchmark ? [
    { metric: "TRIR", actual: model.observedTrir, benchmark: benchmark?.trcRate ?? 0, target: model.targetRate },
    { metric: "DART", actual: model.observedDart, benchmark: benchmark?.dartRate ?? 0, target: benchmark?.dartRate ?? 0 },
    { metric: "Days Away", actual: model.observedAway, benchmark: benchmark?.daysAwayRate ?? 0, target: benchmark?.daysAwayRate ?? 0 },
  ] : [];

  return (
    <OccupationalToolShell
      eyebrow="Independent Intelligence Tool · Scenario Laboratory"
      title="Industry Impact Calculator"
      subtitle="Start from ready BLS industry benchmarks, add only the employer facts you actually know, then stress-test improvement and financial scenarios."
      notice="BLS values are aggregate industry benchmarks. Employer cases, hours, target rates, cost assumptions, indirect multipliers, and profit margins are user-entered scenario facts or assumptions. Modeled avoided cases and dollars are arithmetic scenarios, not guaranteed outcomes or causal findings."
    >
      <ToolHero
        kicker="Benchmark-first scenario lab"
        title="Pick an industry. Insight Hub handles the BLS plumbing."
        description="The common industries are already loaded. Once you add actual hours and cases, the laboratory shows the rate gap, benchmark-implied case burden, target scenarios, five-year trajectories, and low/base/high cost sensitivity."
        accent="emerald"
      >
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/12 bg-black/20 p-3 text-center"><BriefcaseBusiness className="mx-auto text-emerald-200/65" size={18} /><p className="mt-2 text-lg font-black text-white">{overview?.sectors.length ?? "—"}</p><p className="text-[9px] text-cyan-50/45">Ready industries</p></div>
          <div className="rounded-xl border border-white/12 bg-black/20 p-3 text-center"><Gauge className="mx-auto text-cyan-200/65" size={18} /><p className="mt-2 text-lg font-black text-white">{hasObserved ? number(model.observedTrir, 2) : "—"}</p><p className="text-[9px] text-cyan-50/45">Actual TRIR</p></div>
          <div className="rounded-xl border border-white/12 bg-black/20 p-3 text-center"><TrendingDown className="mx-auto text-violet-200/65" size={18} /><p className="mt-2 text-lg font-black text-white">{hasObserved && hasBenchmark ? number(model.excessVsBenchmark, 1) : "—"}</p><p className="text-[9px] text-cyan-50/45">Cases above benchmark</p></div>
        </div>
      </ToolHero>

      <GlassCard className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-50/55">Ready BLS benchmarks</p><h2 className="mt-1 text-xl font-black text-white">Choose the workforce's industry</h2><p className="mt-2 text-xs leading-5 text-cyan-50/54">No NAICS knowledge required. The code is shown only for traceability.</p></div><EvidenceGradeBadge grade={overview ? "A" : "Unavailable"} /></div>
        {!overview ? <div className="mt-4 flex items-center gap-2 text-xs text-cyan-50/55"><Loader2 size={15} className="animate-spin" />Loading live BLS benchmarks…</div> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{overview.sectors.map((sector) => <button key={sector.id} type="button" onClick={() => selectPrepared(sector)} className={`rounded-2xl border p-4 text-left transition ${selectedNaics === sector.naics && benchmark ? "border-emerald-200/30 bg-emerald-300/[0.09]" : "border-white/10 bg-[#071321]/72 hover:border-emerald-200/20"}`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-black text-white">{sector.label}</p><span className="text-[8px] text-cyan-50/38">{sector.naics}</span></div><p className="mt-2 line-clamp-2 text-[9px] leading-4 text-cyan-50/48">{sector.description}</p><div className="mt-3 flex items-center gap-3"><span className="text-lg font-black text-emerald-100">{sector.benchmark?.trcRate != null ? number(sector.benchmark.trcRate, 1) : "—"}</span><span className="text-[9px] text-cyan-50/42">TRC · {sector.benchmark?.year ?? "not returned"}</span></div></button>)}</div>}
      </GlassCard>

      <div className="grid gap-5 2xl:grid-cols-[.72fr_1.28fr]">
        <div className="space-y-5">
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/55">Employer facts</p><h2 className="mt-1 text-lg font-black text-white">Enter only what you know</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField label="Workforce size" value={workforce} onChange={setWorkforce} suffix="workers" /><NumberField label="Annual hours worked" value={annualHours} onChange={setAnnualHours} step={10_000} suffix="hours" /><NumberField label="Recordable cases" value={recordables} onChange={setRecordables} /><NumberField label="DART cases" value={dartCases} onChange={setDartCases} /><NumberField label="Days-away cases" value={daysAwayCases} onChange={setDaysAwayCases} /></div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-50/55">Improvement target</p><h2 className="mt-1 text-lg font-black text-white">Test a target TRIR</h2><p className="mt-2 text-[10px] leading-5 text-cyan-50/48">Selecting an industry seeds this field with the returned BLS benchmark. Change it to test a different target.</p><div className="mt-4"><NumberField label="Target TRIR" value={targetTrir} onChange={setTargetTrir} step={0.1} /></div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-50/55">Financial sensitivity</p><h2 className="mt-1 text-lg font-black text-white">Low / base / high cost per case</h2></div><EvidenceGradeBadge grade="D" /></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField label="Low cost per avoided case" value={lowCost} onChange={setLowCost} step={1_000} suffix="USD" /><NumberField label="Base cost per avoided case" value={baseCost} onChange={setBaseCost} step={1_000} suffix="USD" /><NumberField label="High cost per avoided case" value={highCost} onChange={setHighCost} step={1_000} suffix="USD" /><NumberField label="Indirect cost multiplier" value={indirectMultiplier} onChange={setIndirectMultiplier} step={0.1} suffix="× direct" /><NumberField label="Profit margin" value={profitMargin} onChange={setProfitMargin} step={0.5} suffix="%" /></div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/48">Advanced benchmark lookup</p><h2 className="mt-1 text-lg font-black text-white">Specific NAICS not in the ready library?</h2></div><Search size={17} className="text-cyan-200/55" /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_.55fr_auto] sm:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">NAICS</span><input value={selectedNaics} onChange={(event) => setSelectedNaics(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="2–6 digits" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">Year</span><input value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Latest" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /></label><button type="button" onClick={() => void lookup()} disabled={loading || !selectedNaics} className="min-h-11 rounded-xl border border-cyan-200/22 bg-cyan-300/10 px-4 text-xs font-black text-white disabled:opacity-45">{loading ? "Loading…" : "Lookup"}</button></div>
            {message ? <p className="mt-3 text-[10px] leading-5 text-amber-50/65">{message}</p> : null}
          </GlassCard>
        </div>

        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Actual TRIR" value={hasObserved ? number(model.observedTrir, 2) : "—"} note="Recordables × 200,000 ÷ hours" icon={Gauge} /><MetricOrb label="Industry benchmark" value={hasBenchmark ? number(model.benchmarkTrir, 2) : "—"} note={benchmark?.industryTitle || "Choose an industry"} icon={BookOpenCheck} tone="emerald" /><MetricOrb label="Gap vs benchmark" value={hasObserved && hasBenchmark && model.gapPercent != null ? `${model.gapPercent >= 0 ? "+" : ""}${number(model.gapPercent, 1)}%` : "—"} note="Actual relative to returned BLS rate" icon={TrendingUp} tone={model.gapPercent != null && model.gapPercent > 0 ? "rose" : "emerald"} /><MetricOrb label="Excess cases vs benchmark" value={hasObserved && hasBenchmark ? number(model.excessVsBenchmark, 1) : "—"} note="Arithmetic difference at entered hours" icon={Activity} tone="violet" /></section>

          {comparison.length ? <GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/55">Actual vs benchmark</p><h2 className="mt-1 text-lg font-black text-white">Three returned incidence-rate measures</h2><div className="mt-4 h-[310px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison}><CartesianGrid stroke="rgba(165,243,252,.09)" vertical={false} /><XAxis dataKey="metric" tick={{ fill: "rgba(207,250,254,.65)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "rgba(207,250,254,.48)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(103,232,249,.2)", borderRadius: 12 }} /><Bar dataKey="actual" name="Actual" fill="#fda4af" radius={[7, 7, 2, 2]} /><Bar dataKey="benchmark" name="BLS benchmark" fill="#67e8f9" radius={[7, 7, 2, 2]} /></BarChart></ResponsiveContainer></div></GlassCard> : <GlassCard className="p-8 text-center"><BarChart3 className="mx-auto h-8 w-8 text-cyan-200/40" /><p className="mt-3 font-black text-white">Ready for employer facts</p><p className="mt-2 text-xs leading-5 text-cyan-50/48">Choose an industry and enter annual hours to activate the benchmark comparison.</p></GlassCard>}

          {hasObserved && model.targetRate > 0 ? <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Target TRIR" value={number(model.targetRate, 2)} note="User-selected scenario target" icon={TrendingDown} tone="emerald" /><MetricOrb label="Cases at target" value={number(model.targetCases, 1)} note="Target rate × entered hours" icon={Users} tone="violet" /><MetricOrb label="Modeled cases avoided" value={number(model.avoidedCases, 1)} note="Actual cases minus target-implied cases" icon={Activity} tone="emerald" /><MetricOrb label="Base modeled cost" value={baseCost > 0 ? money(model.total.base) : "—"} note={baseCost > 0 ? `Includes ${indirectMultiplier}× indirect multiplier` : "Enter a base cost per case"} icon={CircleDollarSign} tone="amber" /></section>
            <GlassCard className="p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/55">Five-year trajectory</p><h2 className="mt-1 text-lg font-black text-white">Linear scenario from actual TRIR to target</h2></div><span className="text-[10px] text-cyan-50/45">Trajectory is a user scenario, not a forecast.</span></div><div className="mt-4 h-[330px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={model.trajectory}><CartesianGrid stroke="rgba(165,243,252,.08)" /><XAxis dataKey="year" tick={{ fill: "rgba(207,250,254,.62)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="rate" tick={{ fill: "rgba(207,250,254,.48)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="cases" orientation="right" tick={{ fill: "rgba(207,250,254,.48)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(110,231,183,.2)", borderRadius: 12 }} /><Line yAxisId="rate" dataKey="rate" name="TRIR" stroke="#6ee7b7" strokeWidth={3} dot={false} /><Line yAxisId="cases" dataKey="cases" name="Implied cases" stroke="#c4b5fd" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></GlassCard>
          </> : null}

          {model.avoidedCases > 0 && (lowCost > 0 || baseCost > 0 || highCost > 0) ? <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-50/55">Sensitivity matrix</p><h2 className="mt-1 text-lg font-black text-white">Cost impact across entered assumptions</h2></div><EvidenceGradeBadge grade="D" /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-cyan-50/45">Low</p><p className="mt-2 text-2xl font-black text-white">{money(model.total.low)}</p><p className="mt-1 text-[10px] text-cyan-50/45">{money(lowCost)} per modeled avoided case</p></div><div className="rounded-2xl border border-amber-200/20 bg-amber-300/[0.06] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-amber-50/55">Base</p><p className="mt-2 text-2xl font-black text-white">{money(model.total.base)}</p><p className="mt-1 text-[10px] text-amber-50/55">{money(baseCost)} per modeled avoided case</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-cyan-50/45">High</p><p className="mt-2 text-2xl font-black text-white">{money(model.total.high)}</p><p className="mt-1 text-[10px] text-cyan-50/45">{money(highCost)} per modeled avoided case</p></div></div>{profitMargin > 0 && baseCost > 0 ? <div className="mt-4 rounded-xl border border-violet-200/16 bg-violet-300/[0.05] p-4"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-violet-50/55">Sales-equivalent recovery</p><p className="mt-1 text-xl font-black text-white">{money(model.salesRecovery)}</p><p className="mt-1 text-[10px] leading-5 text-cyan-50/48">Revenue at an entered {profitMargin}% profit margin that would produce profit equal to the base modeled cost amount.</p></div> : null}</GlassCard> : null}
        </div>
      </div>
    </OccupationalToolShell>
  );
}
