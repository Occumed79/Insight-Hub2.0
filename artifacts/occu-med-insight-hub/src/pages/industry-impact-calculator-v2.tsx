import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
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
import type { BlsBenchmark } from "@/data/employerIntelligenceApi";

type Sector = { id: string; naics: string; label: string; description: string; benchmark: BlsBenchmark | null; message?: string };
type Overview = { sectors: Sector[]; ranked: Sector[]; limitation?: string };
type EvidenceKind = "observed" | "benchmark" | "assumption" | "modeled";
type WorkforceBasis = "headcount" | "fte";
type WorkforceSource = "reported" | "estimated" | "user";

const evidenceStyle: Record<EvidenceKind, string> = {
  observed: "border-cyan-200/20 bg-cyan-300/[0.07] text-cyan-50",
  benchmark: "border-emerald-200/20 bg-emerald-300/[0.07] text-emerald-50",
  assumption: "border-amber-200/20 bg-amber-300/[0.07] text-amber-50",
  modeled: "border-violet-200/20 bg-violet-300/[0.07] text-violet-50",
};

function Kind({ kind, children }: { kind: EvidenceKind; children?: ReactNode }) {
  const label = children || ({ observed: "Observed data", benchmark: "Official benchmark", assumption: "User assumption", modeled: "Modeled output" } as const)[kind];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${evidenceStyle[kind]}`}>{label}</span>;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function number(value: number, digits = 1): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("en-US", { maximumFractionDigits: digits });
}

function SelectField({ label, value, onChange, children, hint }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-cyan-100/16 bg-[#040c16]/92 px-3 text-sm text-white outline-none focus:border-cyan-200/42">{children}</select>{hint ? <p className="mt-1.5 text-[9px] leading-4 text-cyan-50/38">{hint}</p> : null}</label>;
}

export default function IndustryImpactCalculatorV2() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [benchmark, setBenchmark] = useState<BlsBenchmark | null>(null);
  const [selectedNaics, setSelectedNaics] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [workforce, setWorkforce] = useState(1000);
  const [workforceBasis, setWorkforceBasis] = useState<WorkforceBasis>("headcount");
  const [workforceSource, setWorkforceSource] = useState<WorkforceSource>("user");
  const [hoursPerWorker, setHoursPerWorker] = useState(2000);
  const [observedTrir, setObservedTrir] = useState(3.2);
  const [observedDart, setObservedDart] = useState(1.8);
  const [targetTrir, setTargetTrir] = useState(2.1);
  const [lostDaysPerRecordable, setLostDaysPerRecordable] = useState(8);
  const [lowCost, setLowCost] = useState(15000);
  const [baseCost, setBaseCost] = useState(30000);
  const [highCost, setHighCost] = useState(60000);
  const [indirectMultiplier, setIndirectMultiplier] = useState(1.5);
  const [profitMargin, setProfitMargin] = useState(8);

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
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "BLS lookup failed.");
    } finally { setLoading(false); }
  }

  const model = useMemo(() => {
    const workers = Math.max(workforce, 0);
    const hoursEach = Math.max(hoursPerWorker, 0);
    const modeledAnnualHours = workers * hoursEach;
    const currentRate = Math.max(observedTrir, 0);
    const currentDartRate = Math.max(observedDart, 0);
    const benchmarkRate = Math.max(benchmark?.trcRate ?? 0, 0);
    const benchmarkDartRate = Math.max(benchmark?.dartRate ?? 0, 0);
    const targetRate = Math.max(targetTrir > 0 ? targetTrir : benchmarkRate, 0);

    const casesAt = (rate: number) => modeledAnnualHours > 0 ? rate * modeledAnnualHours / 200_000 : 0;
    const currentCases = casesAt(currentRate);
    const currentDartCases = casesAt(currentDartRate);
    const benchmarkCases = casesAt(benchmarkRate);
    const benchmarkDartCases = casesAt(benchmarkDartRate);
    const targetCases = casesAt(targetRate);
    const avoidedCases = Math.max(currentCases - targetCases, 0);
    const excessVsBenchmark = Math.max(currentCases - benchmarkCases, 0);
    const gapPercent = benchmarkRate > 0 ? ((currentRate / benchmarkRate) - 1) * 100 : null;

    const lostDaysCurrent = currentCases * Math.max(lostDaysPerRecordable, 0);
    const lostDaysTarget = targetCases * Math.max(lostDaysPerRecordable, 0);
    const avoidedLostDays = Math.max(lostDaysCurrent - lostDaysTarget, 0);

    const multiplier = 1 + Math.max(indirectMultiplier, 0);
    const currentCost = {
      low: currentCases * Math.max(lowCost, 0) * multiplier,
      base: currentCases * Math.max(baseCost, 0) * multiplier,
      high: currentCases * Math.max(highCost, 0) * multiplier,
    };
    const targetCost = {
      low: targetCases * Math.max(lowCost, 0) * multiplier,
      base: targetCases * Math.max(baseCost, 0) * multiplier,
      high: targetCases * Math.max(highCost, 0) * multiplier,
    };
    const savings = {
      low: Math.max(currentCost.low - targetCost.low, 0),
      base: Math.max(currentCost.base - targetCost.base, 0),
      high: Math.max(currentCost.high - targetCost.high, 0),
    };
    const margin = Math.max(profitMargin, 0) / 100;
    const salesRecovery = margin > 0 ? savings.base / margin : 0;

    const trajectory = Array.from({ length: 6 }, (_, index) => {
      const fraction = index / 5;
      const rate = currentRate + (targetRate - currentRate) * fraction;
      const cases = casesAt(rate);
      const lostDays = cases * Math.max(lostDaysPerRecordable, 0);
      const cost = cases * Math.max(baseCost, 0) * multiplier;
      return { year: index === 0 ? "Now" : `Year ${index}`, rate, cases, lostDays, cost };
    });

    return {
      modeledAnnualHours,
      currentRate,
      currentDartRate,
      benchmarkRate,
      benchmarkDartRate,
      targetRate,
      currentCases,
      currentDartCases,
      benchmarkCases,
      benchmarkDartCases,
      targetCases,
      avoidedCases,
      excessVsBenchmark,
      gapPercent,
      lostDaysCurrent,
      lostDaysTarget,
      avoidedLostDays,
      currentCost,
      targetCost,
      savings,
      salesRecovery,
      trajectory,
    };
  }, [workforce, hoursPerWorker, observedTrir, observedDart, benchmark, targetTrir, lostDaysPerRecordable, lowCost, baseCost, highCost, indirectMultiplier, profitMargin]);

  const ready = workforce > 0 && hoursPerWorker > 0 && observedTrir >= 0;
  const provenanceLabel = workforceSource === "reported" ? "Official reported baseline" : workforceSource === "estimated" ? "Estimated baseline" : "User-entered baseline";

  return <OccupationalToolShell eyebrow="Independent Intelligence Tool · Scenario Laboratory" title="Industry Impact Calculator" subtitle="A workforce-driven benchmark and impact model where workforce size changes every downstream case, lost-workday, cost, and trajectory output." notice="Workforce size is modeled as either headcount or FTE and is never decorative. The model uses workforce × annual hours per worker/FTE to translate incidence rates into expected cases. BLS values are official industry benchmarks; workforce provenance, cost assumptions, lost-day assumptions, targets, and the five-year linear path are labeled separately and are not forecasts.">
    <GlassCard className="mb-5 border-amber-200/20 bg-amber-300/[0.06] p-4"><p className="text-xs font-black uppercase tracking-[.15em] text-amber-100">Demo / sample scenario — replace with employer values</p><p className="mt-2 text-xs text-cyan-50/55">The populated assumptions demonstrate the model immediately. Official BLS rates remain separately labeled.</p></GlassCard>
    <ToolHero kicker="Workforce-driven scenario lab" title="Change workforce size and the entire model changes with it." description="Set the workforce basis and provenance, choose a BLS industry benchmark, enter the employer incidence-rate baseline, and then test an improvement scenario. A reported workforce count stays visibly reported; an estimate stays visibly estimated." accent="emerald">
      <div className="grid grid-cols-2 gap-2"><Kind kind="observed" /><Kind kind="benchmark" /><Kind kind="assumption" /><Kind kind="modeled" /></div>
    </ToolHero>

    <GlassCard className="mb-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Kind kind="observed" /><EvidenceGradeBadge grade={workforceSource === "reported" ? "A" : workforceSource === "estimated" ? "C" : "D"} /></div><h2 className="mt-2 text-xl font-black text-white">Workforce baseline</h2><p className="mt-2 text-xs leading-5 text-cyan-50/52">This is the primary scaling driver for affected workers, recordable cases, lost workdays, costs, and every point on the scenario path.</p></div><Users size={19} className="text-cyan-200/55" /></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NumberField label="Workforce size (headcount or FTE)" value={workforce} onChange={setWorkforce} step={10} suffix={workforceBasis === "fte" ? "FTE" : "people"} hint="The selected basis is carried into all modeled outputs." />
        <SelectField label="Workforce basis" value={workforceBasis} onChange={(value) => setWorkforceBasis(value as WorkforceBasis)}><option value="headcount">Headcount</option><option value="fte">FTE</option></SelectField>
        <SelectField label="Workforce source" value={workforceSource} onChange={(value) => setWorkforceSource(value as WorkforceSource)} hint="Preserves whether the count is reported or estimated."><option value="reported">Official reported count</option><option value="estimated">Estimate</option><option value="user">User-entered / unknown provenance</option></SelectField>
        <NumberField label={`Annual hours per ${workforceBasis === "fte" ? "FTE" : "worker"}`} value={hoursPerWorker} onChange={setHoursPerWorker} step={40} suffix="hours" hint="Used with workforce size to calculate the modeled annual exposure-hours denominator." />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><MetricOrb label="Baseline provenance" value={provenanceLabel} note={`${number(workforce, 0)} ${workforceBasis === "fte" ? "FTE" : "headcount"}`} icon={BriefcaseBusiness} /><MetricOrb label="Modeled annual hours" value={ready ? number(model.modeledAnnualHours, 0) : "—"} note="Workforce × annual hours per worker/FTE" icon={Gauge} tone="violet" /><MetricOrb label="Hours basis" value={hoursPerWorker > 0 ? number(hoursPerWorker, 0) : "—"} note={`per ${workforceBasis === "fte" ? "FTE" : "worker"} per year`} icon={CalendarDays} tone="amber" /></div>
    </GlassCard>

    <GlassCard className="mb-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Kind kind="benchmark" /><EvidenceGradeBadge grade={overview ? "A" : "Unavailable"} /></div><h2 className="mt-2 text-xl font-black text-white">Prepared BLS industry library</h2><p className="mt-2 text-xs leading-5 text-cyan-50/52">Choose by industry name. NAICS stays visible for traceability.</p></div><BarChart3 size={19} className="text-emerald-200/55" /></div>
      {!overview ? <div className="mt-4 flex items-center gap-2 text-xs text-cyan-50/55"><Loader2 size={15} className="animate-spin" />Loading live BLS benchmarks…</div> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{overview.sectors.map((sector) => <button key={sector.id} type="button" onClick={() => selectPrepared(sector)} className={`rounded-2xl border p-4 text-left transition ${selectedNaics === sector.naics && benchmark ? "border-emerald-200/30 bg-emerald-300/[0.09]" : "border-white/10 bg-[#071321]/72 hover:border-emerald-200/20"}`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-black text-white">{sector.label}</p><span className="text-[8px] text-cyan-50/38">{sector.naics}</span></div><p className="mt-2 line-clamp-2 text-[9px] leading-4 text-cyan-50/48">{sector.description}</p><div className="mt-3 flex items-center gap-3"><span className="text-lg font-black text-emerald-100">{sector.benchmark?.trcRate != null ? number(sector.benchmark.trcRate, 1) : "—"}</span><span className="text-[9px] text-cyan-50/42">TRC · {sector.benchmark?.year ?? "not returned"}</span></div></button>)}</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_.45fr_auto] sm:items-end"><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">NAICS</span><input value={selectedNaics} onChange={(event) => setSelectedNaics(event.target.value.replace(/[^0-9]/g, ""))} placeholder="336411" className="mt-2 min-h-11 w-full rounded-xl border border-cyan-100/16 bg-[#040c16]/92 px-3 text-sm text-white outline-none focus:border-cyan-200/42" /></label><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">Year optional</span><input value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Latest" className="mt-2 min-h-11 w-full rounded-xl border border-cyan-100/16 bg-[#040c16]/92 px-3 text-sm text-white outline-none focus:border-cyan-200/42" /></label><button type="button" onClick={() => void lookup()} disabled={loading || !selectedNaics.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200/22 bg-cyan-300/10 px-4 text-xs font-black text-white disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}Load BLS benchmark</button></div>
      {message ? <p className="mt-3 text-[10px] leading-5 text-amber-100/60">{message}</p> : null}
    </GlassCard>

    <div className="grid gap-5 2xl:grid-cols-[.72fr_1.28fr]">
      <div className="space-y-5">
        <GlassCard className="p-5"><Kind kind="observed" /><h2 className="mt-2 text-lg font-black text-white">Employer incidence baseline</h2><p className="mt-2 text-[10px] leading-5 text-cyan-50/48">Enter the employer’s observed or otherwise selected incidence-rate baseline. Workforce size converts these rates into modeled affected-worker/case counts.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField label="Observed employer TRIR" value={observedTrir} onChange={setObservedTrir} step={0.1} /><NumberField label="Observed employer DART rate" value={observedDart} onChange={setObservedDart} step={0.1} /></div></GlassCard>

        <GlassCard className="p-5"><Kind kind="assumption" /><h2 className="mt-2 text-lg font-black text-white">Improvement + lost-workday assumptions</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField label="Target TRIR" value={targetTrir} onChange={setTargetTrir} step={0.1} hint="Selecting a BLS industry seeds this value, but you can change it for the scenario." /><NumberField label="Lost workdays per recordable" value={lostDaysPerRecordable} onChange={setLostDaysPerRecordable} step={0.5} suffix="days" hint="User assumption used only for lost-workday outputs." /></div></GlassCard>

        <GlassCard className="p-5"><div className="flex items-start justify-between gap-3"><div><Kind kind="assumption" /><h2 className="mt-2 text-lg font-black text-white">Financial sensitivity</h2><p className="mt-2 text-[10px] leading-5 text-cyan-50/48">All dollar values below are scenario assumptions, not BLS or OSHA source data.</p></div><EvidenceGradeBadge grade="D" /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField label="Low cost per recordable" value={lowCost} onChange={setLowCost} step={1000} suffix="USD" /><NumberField label="Base cost per recordable" value={baseCost} onChange={setBaseCost} step={1000} suffix="USD" /><NumberField label="High cost per recordable" value={highCost} onChange={setHighCost} step={1000} suffix="USD" /><NumberField label="Indirect cost multiplier" value={indirectMultiplier} onChange={setIndirectMultiplier} step={0.1} suffix="× direct" /><NumberField label="Profit margin" value={profitMargin} onChange={setProfitMargin} step={0.5} suffix="%" /></div></GlassCard>
      </div>

      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Affected workers / recordables" value={ready ? number(model.currentCases, 1) : "—"} note={`${number(workforce, 0)} ${workforceBasis === "fte" ? "FTE" : "workers"} × ${number(model.currentRate, 2)} TRIR`} icon={Users} /><MetricOrb label="Target recordables" value={ready ? number(model.targetCases, 1) : "—"} note={`${number(model.avoidedCases, 1)} modeled cases avoided`} icon={TrendingDown} tone="emerald" /><MetricOrb label="Current lost workdays" value={ready && lostDaysPerRecordable > 0 ? number(model.lostDaysCurrent, 0) : "—"} note={lostDaysPerRecordable > 0 ? `${number(model.avoidedLostDays, 0)} modeled days avoided` : "Enter lost days per recordable"} icon={CalendarDays} tone="rose" /><MetricOrb label="Base annual savings" value={ready && baseCost > 0 ? money(model.savings.base) : "—"} note="Current workforce-scaled cost − target cost" icon={CircleDollarSign} tone="violet" /></section>

        <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><Kind kind="benchmark" /><h2 className="mt-2 text-lg font-black text-white">Employer vs official BLS benchmark</h2></div><Activity size={18} className="text-emerald-200/55" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Employer TRIR" value={ready ? number(model.currentRate, 2) : "—"} note="Entered employer baseline" icon={Gauge} /><MetricOrb label="BLS TRC" value={benchmark?.trcRate != null ? number(model.benchmarkRate, 2) : "—"} note={benchmark?.year ? `Official BLS · ${benchmark.year}` : "Choose an industry benchmark"} icon={BarChart3} tone="emerald" /><MetricOrb label="Benchmark-implied cases" value={ready && benchmark?.trcRate != null ? number(model.benchmarkCases, 1) : "—"} note="BLS rate scaled to this workforce" icon={BriefcaseBusiness} tone="emerald" /><MetricOrb label="Rate gap" value={model.gapPercent == null ? "—" : `${model.gapPercent >= 0 ? "+" : ""}${number(model.gapPercent, 1)}%`} note={benchmark ? `${number(model.excessVsBenchmark, 1)} cases above benchmark-implied level` : "No official benchmark selected"} icon={TrendingUp} tone={model.gapPercent != null && model.gapPercent > 0 ? "rose" : "emerald"} /></div></GlassCard>

        <GlassCard className="p-5"><Kind kind="modeled" /><h2 className="mt-2 text-lg font-black text-white">Workforce-scaled cost range</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><MetricOrb label="Low savings" value={lowCost > 0 ? money(model.savings.low) : "—"} note="Low entered cost assumption" icon={CircleDollarSign} tone="emerald" /><MetricOrb label="Base savings" value={baseCost > 0 ? money(model.savings.base) : "—"} note="Base entered cost assumption" icon={CircleDollarSign} tone="violet" /><MetricOrb label="High savings" value={highCost > 0 ? money(model.savings.high) : "—"} note="High entered cost assumption" icon={CircleDollarSign} tone="amber" /></div>{profitMargin > 0 && baseCost > 0 ? <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-cyan-50/42">Equivalent sales needed to recover modeled base cost</p><p className="mt-1 text-2xl font-black">{money(model.salesRecovery)}</p><p className="mt-1 text-[10px] text-cyan-50/42">Uses the entered {number(profitMargin, 1)}% profit-margin assumption.</p></div> : null}</GlassCard>

        <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><Kind kind="modeled" /><h2 className="mt-2 text-lg font-black text-white">Five-year linear scenario path</h2><p className="mt-2 text-[10px] leading-5 text-cyan-50/48">This is not a forecast. It simply interpolates the entered employer TRIR toward the target while holding the selected workforce size and annual hours basis constant.</p></div><TrendingDown size={18} className="text-violet-200/55" /></div><div className="mt-4 h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={model.trajectory}><CartesianGrid stroke="rgba(165,243,252,.08)" vertical={false} /><XAxis dataKey="year" tick={{ fill: "rgba(207,250,254,.62)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="rate" tick={{ fill: "rgba(207,250,254,.45)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="cases" orientation="right" tick={{ fill: "rgba(221,214,254,.45)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(196,181,253,.2)", borderRadius: 12 }} formatter={(value, name) => name === "Modeled cost" ? money(Number(value)) : number(Number(value), 1)} /><Line yAxisId="rate" type="monotone" dataKey="rate" name="TRIR" stroke="#67e8f9" strokeWidth={2.2} dot={{ r: 3 }} /><Line yAxisId="cases" type="monotone" dataKey="cases" name="Affected workers / cases" stroke="#c4b5fd" strokeWidth={2.2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{model.trajectory.map((point) => <div key={point.year} className="rounded-xl border border-white/9 bg-black/15 p-3"><p className="text-[9px] font-black text-cyan-50/45">{point.year}</p><p className="mt-1 text-sm font-black">{number(point.cases, 1)} cases</p><p className="text-[9px] text-cyan-50/40">{number(point.lostDays, 0)} lost days · {baseCost > 0 ? money(point.cost) : "cost not modeled"}</p></div>)}</div></GlassCard>
      </div>
    </div>
  </OccupationalToolShell>;
}
