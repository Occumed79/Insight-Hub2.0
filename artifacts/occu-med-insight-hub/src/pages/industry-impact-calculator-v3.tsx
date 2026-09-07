import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BarChart3, CircleDollarSign, Gauge, Loader2, Search, TrendingDown, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sidebar } from "@/components/insight/Sidebar";
import type { BlsBenchmark } from "@/data/employerIntelligenceApi";

type Sector = { id: string; naics: string; label: string; description: string; benchmark: BlsBenchmark | null; message?: string };
type Overview = { sectors: Sector[]; ranked?: Sector[]; limitation?: string };
type EvidenceKind = "Observed data" | "Official benchmark" | "User assumption" | "Modeled output";
type WorkforceBasis = "headcount" | "fte";
type WorkforceSource = "reported" | "estimated" | "user";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const number = (value: number, digits = 1) => (Number.isFinite(value) ? value : 0).toLocaleString("en-US", { maximumFractionDigits: digits });
const fixed = (value: number, digits = 1) => (Number.isFinite(value) ? value : 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function Kind({ children }: { children: ReactNode }) {
  return <span className="text-[9px] font-semibold uppercase tracking-[.11em] text-slate-500">{children}</span>;
}

function NumberInput({ label, value, onChange, suffix, step = 1 }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; step?: number }) {
  return <label className="block"><span className="text-[10px] font-medium text-slate-400">{label}</span><div className="mt-1.5 flex h-10 items-center border border-white/10 bg-[#03080d]"><input aria-label={label} type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[12px] font-medium text-white outline-none" />{suffix ? <span className="border-l border-white/8 px-2.5 text-[9px] text-slate-600">{suffix}</span> : null}</div></label>;
}

function SelectInput({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="block"><span className="text-[10px] font-medium text-slate-400">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full border border-white/10 bg-[#03080d] px-3 text-[11px] text-white outline-none">{children}</select></label>;
}

function Metric({ label, value, note, kind }: { label: string; value: string; note: string; kind?: EvidenceKind }) {
  return <div className="border-b border-r border-white/8 px-4 py-4"><div className="flex flex-wrap items-center gap-2"><p className="text-[9px] font-semibold uppercase tracking-[.11em] text-slate-600">{label}</p>{kind ? <Kind>{kind}</Kind> : null}</div><p className="mt-1.5 text-2xl font-semibold tracking-[-.03em] text-white">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{note}</p></div>;
}

export default function IndustryImpactCalculatorV3() {
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
  const [targetTrir, setTargetTrir] = useState(1.6);
  const [lostDaysPerRecordable, setLostDaysPerRecordable] = useState(8);
  const [lowCost, setLowCost] = useState(15000);
  const [baseCost, setBaseCost] = useState(30000);
  const [highCost, setHighCost] = useState(60000);
  const [indirectMultiplier, setIndirectMultiplier] = useState(0);
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
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "BLS lookup failed.");
    } finally { setLoading(false); }
  }

  function clearSample() {
    setWorkforce(0); setHoursPerWorker(0); setObservedTrir(0); setObservedDart(0); setTargetTrir(0);
    setLostDaysPerRecordable(0); setLowCost(0); setBaseCost(0); setHighCost(0); setIndirectMultiplier(0); setProfitMargin(0);
    setBenchmark(null); setSelectedNaics(""); setYear(""); setMessage("");
  }

  const model = useMemo(() => {
    const modeledAnnualHours = Math.max(workforce, 0) * Math.max(hoursPerWorker, 0);
    const currentRate = Math.max(observedTrir, 0);
    const benchmarkRate = Math.max(benchmark?.trcRate ?? 0, 0);
    const targetRate = Math.max(targetTrir > 0 ? targetTrir : benchmarkRate, 0);
    const casesAt = (rate: number) => modeledAnnualHours > 0 ? rate * modeledAnnualHours / 200_000 : 0;
    const currentCases = casesAt(currentRate);
    const currentDartCases = casesAt(Math.max(observedDart, 0));
    const benchmarkCases = casesAt(benchmarkRate);
    const targetCases = casesAt(targetRate);
    const avoidedCases = Math.max(currentCases - targetCases, 0);
    const excessVsBenchmark = Math.max(currentCases - benchmarkCases, 0);
    const gapPercent = benchmarkRate > 0 ? ((currentRate / benchmarkRate) - 1) * 100 : null;
    const lostDaysCurrent = currentCases * Math.max(lostDaysPerRecordable, 0);
    const lostDaysTarget = targetCases * Math.max(lostDaysPerRecordable, 0);
    const avoidedLostDays = Math.max(lostDaysCurrent - lostDaysTarget, 0);
    const multiplier = 1 + Math.max(indirectMultiplier, 0);
    const currentCost = { low: currentCases * Math.max(lowCost, 0) * multiplier, base: currentCases * Math.max(baseCost, 0) * multiplier, high: currentCases * Math.max(highCost, 0) * multiplier };
    const targetCost = { low: targetCases * Math.max(lowCost, 0) * multiplier, base: targetCases * Math.max(baseCost, 0) * multiplier, high: targetCases * Math.max(highCost, 0) * multiplier };
    const savings = { low: Math.max(currentCost.low - targetCost.low, 0), base: Math.max(currentCost.base - targetCost.base, 0), high: Math.max(currentCost.high - targetCost.high, 0) };
    const margin = Math.max(profitMargin, 0) / 100;
    const salesRecovery = margin > 0 ? savings.base / margin : 0;
    const trajectory = Array.from({ length: 6 }, (_, index) => {
      const fraction = index / 5;
      const rate = currentRate + (targetRate - currentRate) * fraction;
      return { year: index === 0 ? "Now" : `Year ${index}`, rate, cases: casesAt(rate) };
    });
    return { modeledAnnualHours, currentRate, benchmarkRate, currentCases, currentDartCases, benchmarkCases, targetCases, avoidedCases, excessVsBenchmark, gapPercent, lostDaysCurrent, avoidedLostDays, savings, salesRecovery, trajectory };
  }, [workforce, hoursPerWorker, observedTrir, observedDart, benchmark, targetTrir, lostDaysPerRecordable, lowCost, baseCost, highCost, indirectMultiplier, profitMargin]);

  const ready = workforce > 0 && hoursPerWorker > 0;
  const provenanceLabel = workforceSource === "reported" ? "Official reported baseline" : workforceSource === "estimated" ? "Estimated baseline" : "User-entered baseline";

  return <main className="min-h-screen bg-[#03080e] text-slate-100">
    <Sidebar />
    <section className="min-h-screen lg:ml-[210px]">
      <header className="border-b border-white/8 bg-[#060b11]/96 px-6 py-5 xl:px-8">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-600">Industry intelligence / scenario laboratory</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-[-.035em] text-white">Industry Impact Calculator</h1><p className="mt-2 max-w-4xl text-[11px] leading-5 text-slate-500">A live workforce-scaled scenario model. Official BLS benchmark, employer baseline, assumptions and modeled outputs stay visually separate.</p></div><div className="flex gap-5 text-right"><div><p className="text-[9px] uppercase tracking-[.12em] text-slate-600">Modeled hours</p><p className="mt-1 text-sm font-semibold text-white">{ready ? number(model.modeledAnnualHours, 0) : "—"}</p></div><div><p className="text-[9px] uppercase tracking-[.12em] text-slate-600">BLS year</p><p className="mt-1 text-sm font-semibold text-white">{benchmark?.year || "—"}</p></div></div></div>
      </header>
      <div className="border-b border-amber-300/12 bg-amber-300/[.025] px-6 py-3 text-[10px] text-amber-100/70"><strong className="font-semibold text-amber-100">Demo / sample scenario — replace with employer values.</strong> The initial workforce, rates and cost values are demonstration inputs. <button type="button" onClick={clearSample} className="ml-2 underline underline-offset-2">Clear sample scenario</button></div>

      <div className="grid min-h-[calc(100vh-150px)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-r border-white/8 bg-[#050a10]/94">
          <section className="border-b border-white/8 p-5"><div className="flex items-center justify-between"><div><Kind>Observed data</Kind><h2 className="mt-1 text-base font-semibold text-white">Workforce baseline</h2></div><Users size={16} className="text-sky-300/50" /></div><div className="mt-4 space-y-4"><NumberInput label="Workforce size (headcount or FTE)" value={workforce} onChange={setWorkforce} suffix={workforceBasis === "fte" ? "FTE" : "people"} step={10} /><SelectInput label="Workforce basis" value={workforceBasis} onChange={(value) => setWorkforceBasis(value as WorkforceBasis)}><option value="headcount">Headcount</option><option value="fte">FTE</option></SelectInput><SelectInput label="Workforce source" value={workforceSource} onChange={(value) => setWorkforceSource(value as WorkforceSource)}><option value="reported">Official reported count</option><option value="estimated">Estimate</option><option value="user">User-entered / unknown provenance</option></SelectInput><NumberInput label={`Annual hours per ${workforceBasis === "fte" ? "FTE" : "worker"}`} value={hoursPerWorker} onChange={setHoursPerWorker} suffix="hours" step={40} /></div></section>

          <section className="border-b border-white/8 p-5"><Kind>Official benchmark</Kind><h2 className="mt-1 text-base font-semibold text-white">Prepared BLS industry library</h2><p className="mt-1 text-[9px] leading-4 text-slate-600">Select by industry name. NAICS remains visible for traceability.</p>{!overview ? <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500"><Loader2 size={13} className="animate-spin" />Loading BLS…</div> : <div className="mt-3 max-h-48 overflow-y-auto border-y border-white/8">{overview.sectors.map((sector) => <button key={sector.id} type="button" onClick={() => selectPrepared(sector)} className={`flex w-full items-center justify-between gap-3 border-b border-white/[.055] px-1 py-2.5 text-left last:border-b-0 ${selectedNaics === sector.naics && benchmark ? "text-white" : "text-slate-500 hover:text-slate-300"}`}><span className="text-[10px] font-semibold">{sector.label}</span><span className="text-[9px]">{sector.benchmark?.trcRate != null ? `${number(sector.benchmark.trcRate, 1)} TRC` : "—"}</span></button>)}</div>}
            <div className="mt-4 grid grid-cols-[1fr_90px] gap-2"><label><span className="text-[9px] text-slate-500">NAICS</span><input value={selectedNaics} onChange={(event) => setSelectedNaics(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} className="mt-1 h-9 w-full border border-white/9 bg-[#03070c] px-2.5 text-[11px] text-white outline-none" /></label><label><span className="text-[9px] text-slate-500">Year</span><input value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Latest" className="mt-1 h-9 w-full border border-white/9 bg-[#03070c] px-2 text-[10px] text-white outline-none" /></label></div><button type="button" onClick={() => void lookup()} disabled={loading || !selectedNaics.trim()} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 border border-sky-300/15 bg-sky-300/[.04] text-[10px] font-semibold text-sky-100 disabled:opacity-40">{loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}Load BLS benchmark</button>{message ? <p className="mt-2 text-[9px] leading-4 text-amber-100/60">{message}</p> : null}</section>

          <section className="border-b border-white/8 p-5"><Kind>Observed data</Kind><h2 className="mt-1 text-base font-semibold text-white">Employer incidence baseline</h2><div className="mt-4 space-y-4"><NumberInput label="Observed employer TRIR" value={observedTrir} onChange={setObservedTrir} step={0.1} /><NumberInput label="Observed employer DART rate" value={observedDart} onChange={setObservedDart} step={0.1} /></div></section>
          <section className="p-5"><Kind>User assumption</Kind><h2 className="mt-1 text-base font-semibold text-white">Scenario assumptions</h2><div className="mt-4 space-y-4"><NumberInput label="Target TRIR" value={targetTrir} onChange={setTargetTrir} step={0.1} /><NumberInput label="Lost workdays per recordable" value={lostDaysPerRecordable} onChange={setLostDaysPerRecordable} suffix="days" step={0.5} /><NumberInput label="Low cost per recordable" value={lowCost} onChange={setLowCost} suffix="USD" step={1000} /><NumberInput label="Base cost per recordable" value={baseCost} onChange={setBaseCost} suffix="USD" step={1000} /><NumberInput label="High cost per recordable" value={highCost} onChange={setHighCost} suffix="USD" step={1000} /><NumberInput label="Indirect cost multiplier" value={indirectMultiplier} onChange={setIndirectMultiplier} suffix="× direct" step={0.1} /><NumberInput label="Profit margin" value={profitMargin} onChange={setProfitMargin} suffix="%" step={0.5} /></div></section>
        </aside>

        <div className="min-w-0 p-5 xl:p-7">
          <section className="border border-white/8 bg-[#060c13]/78"><div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5"><div><Kind>Modeled output</Kind><h2 className="mt-1 text-2xl font-semibold tracking-[-.025em] text-white">Live employer impact</h2><p className="mt-2 max-w-3xl text-[10px] leading-5 text-slate-500">Changing workforce size or hours immediately rescales cases, lost workdays and dollars. These are scenario outputs, not forecasts.</p></div><Gauge size={20} className="text-violet-300/50" /></div><div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Affected workers / recordables" value={ready ? number(model.currentCases, 1) : "—"} note={`${number(workforce, 0)} ${workforceBasis === "fte" ? "FTE" : "workers"} × ${number(model.currentRate, 2)} TRIR`} kind="Modeled output" /><Metric label="Target recordables" value={ready ? fixed(model.targetCases, 1) : "—"} note={`${number(model.avoidedCases, 1)} modeled cases avoided`} kind="Modeled output" /><Metric label="Current lost workdays" value={ready && lostDaysPerRecordable > 0 ? number(model.lostDaysCurrent, 0) : "—"} note={`${number(model.avoidedLostDays, 0)} modeled days avoided`} kind="Modeled output" /><Metric label="Base annual savings" value={ready && baseCost > 0 ? money(model.savings.base) : "—"} note="Current scaled cost − target cost" kind="Modeled output" /></div></section>

          <section className="mt-5 border border-white/8 bg-[#060c13]/78"><div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><div><Kind>Official benchmark</Kind><h2 className="mt-1 text-lg font-semibold text-white">Employer vs official BLS benchmark</h2></div><BarChart3 size={17} className="text-emerald-300/50" /></div><div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Employer TRIR" value={ready ? number(model.currentRate, 2) : "—"} note="Entered employer baseline" kind="Observed data" /><Metric label="BLS TRC" value={benchmark?.trcRate != null ? number(model.benchmarkRate, 2) : "—"} note={benchmark?.year ? `Official BLS · ${benchmark.year}` : "Choose industry benchmark"} kind="Official benchmark" /><Metric label="Benchmark-implied cases" value={ready && benchmark?.trcRate != null ? number(model.benchmarkCases, 1) : "—"} note="BLS rate scaled to this workforce" kind="Modeled output" /><Metric label="Rate gap" value={model.gapPercent == null ? "—" : `${model.gapPercent >= 0 ? "+" : ""}${number(model.gapPercent, 1)}%`} note={benchmark ? `${number(model.excessVsBenchmark, 1)} cases above benchmark-implied level` : "No benchmark selected"} kind="Modeled output" /></div></section>

          <section className="mt-5 border border-white/8 bg-[#060c13]/78"><div className="border-b border-white/8 px-5 py-4"><Kind>Observed data</Kind><h2 className="mt-1 text-lg font-semibold text-white">Workforce scaling basis</h2></div><div className="grid sm:grid-cols-3"><Metric label="Baseline provenance" value={provenanceLabel} note={`${number(workforce, 0)} ${workforceBasis === "fte" ? "FTE" : "headcount"}`} kind="Observed data" /><Metric label="Modeled annual hours" value={ready ? number(model.modeledAnnualHours, 0) : "—"} note="Workforce × annual hours per worker/FTE" kind="Modeled output" /><Metric label="Hours basis" value={hoursPerWorker > 0 ? number(hoursPerWorker, 0) : "—"} note={`per ${workforceBasis === "fte" ? "FTE" : "worker"} per year`} kind="Observed data" /></div></section>

          <section className="mt-5 border border-white/8 bg-[#060c13]/78"><div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><div><Kind>Modeled output</Kind><h2 className="mt-1 text-lg font-semibold text-white">Cost sensitivity</h2></div><CircleDollarSign size={17} className="text-amber-300/50" /></div><div className="grid sm:grid-cols-3"><Metric label="Low savings" value={lowCost > 0 ? money(model.savings.low) : "—"} note="Low entered cost assumption" kind="Modeled output" /><Metric label="Base savings" value={baseCost > 0 ? money(model.savings.base) : "—"} note="Base entered cost assumption" kind="Modeled output" /><Metric label="High savings" value={highCost > 0 ? money(model.savings.high) : "—"} note="High entered cost assumption" kind="Modeled output" /></div>{profitMargin > 0 && baseCost > 0 ? <div className="border-t border-white/8 px-5 py-4"><p className="text-[9px] uppercase tracking-[.12em] text-slate-600">Equivalent sales needed to recover modeled base cost</p><p className="mt-1 text-2xl font-semibold text-white">{money(model.salesRecovery)}</p><p className="mt-1 text-[9px] text-slate-500">Uses entered {number(profitMargin, 1)}% profit margin.</p></div> : null}</section>

          <section className="mt-5 border border-white/8 bg-[#060c13]/78"><div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4"><div><Kind>Modeled output</Kind><h2 className="mt-1 text-lg font-semibold text-white">Five-year linear scenario path</h2><p className="mt-1 max-w-3xl text-[10px] leading-5 text-slate-500">This is not a forecast. It linearly interpolates the entered employer TRIR toward the target while holding workforce and hours constant.</p></div><TrendingDown size={17} className="text-violet-300/50" /></div><div className="h-[330px] p-4"><ResponsiveContainer width="100%" height="100%"><LineChart data={model.trajectory} margin={{ left: 0, right: 20, top: 12, bottom: 0 }}><CartesianGrid stroke="rgba(148,163,184,.09)" vertical={false} /><XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 10 }} /><YAxis stroke="#64748b" tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ background: "#071019", border: "1px solid rgba(255,255,255,.12)", borderRadius: 0 }} /><Line type="monotone" dataKey="rate" stroke="#a78bfa" strokeWidth={2.2} dot={{ r: 3 }} name="TRIR" /><Line type="monotone" dataKey="cases" stroke="#67e8f9" strokeWidth={1.6} dot={false} name="Recordables" /></LineChart></ResponsiveContainer></div></section>

          <section className="mt-5 grid border border-white/8 bg-[#060c13]/78 xl:grid-cols-2"><div className="border-b border-white/8 p-5 xl:border-b-0 xl:border-r"><Kind>User assumption</Kind><h2 className="mt-1 text-sm font-semibold text-white">Interpretation boundary</h2><p className="mt-2 text-[10px] leading-5 text-slate-500">BLS rates are aggregate official benchmarks. Employer rates, workforce basis, target rate, lost-day assumptions, cost assumptions and profit margin are separate inputs. Savings and the trajectory are arithmetic scenarios, not causal findings or guaranteed outcomes.</p></div><div className="p-5"><Kind>Modeled output</Kind><h2 className="mt-1 text-sm font-semibold text-white">Current scenario summary</h2><p className="mt-2 text-[10px] leading-5 text-slate-500">{ready ? `${number(model.currentCases, 1)} modeled recordables at the current rate versus ${number(model.targetCases, 1)} at the target, a difference of ${number(model.avoidedCases, 1)} cases and ${number(model.avoidedLostDays, 0)} lost workdays under the entered assumptions.` : "Enter a workforce and annual hours basis to activate the scenario."}</p></div></section>
        </div>
      </div>
    </section>
  </main>;
}
