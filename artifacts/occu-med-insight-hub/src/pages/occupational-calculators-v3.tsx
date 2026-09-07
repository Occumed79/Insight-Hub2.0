import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BadgeDollarSign,
  BrainCircuit,
  BriefcaseMedical,
  CalendarClock,
  CircleGauge,
  Clock3,
  HeartPulse,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { useEmployerWorkflow } from "@/components/insight/EmployerWorkflowContext";
import {
  calculateBreakEven,
  calculateIncidentRate,
  calculateLostTime,
  calculateReturnToWork,
  calculateWorkersCompCost,
  expectedCasesFromHours,
} from "@/data/occupationalCalculations";
import type { BlsBenchmark } from "@/data/employerIntelligenceApi";
import { cn } from "@/lib/utils";

type CalculatorId = "rates" | "workers-comp" | "lost-time" | "return-to-work" | "break-even" | "health-burden" | "age-health" | "aggravation" | "readiness" | "job-demands" | "fatigue";
type CategoryId = "safety" | "cost" | "health" | "readiness" | "job";
type EvidenceKind = "arithmetic" | "official" | "assumption" | "onet" | "operational";
type Sector = { id: string; naics: string; label: string; description: string; benchmark: BlsBenchmark | null };
type SharedContext = { employer: string; workforce: number; annualHours: number; sector: Sector | null };
type ToolSpec = { id: CalculatorId; category: CategoryId; label: string; note: string; evidence: EvidenceKind[]; icon: typeof Activity; why: string };
type Overview = { sectors?: Sector[] };
type OnetEvidence = { name: string; description?: string; value?: number; category?: string };
type OnetPayload = {
  ok?: boolean;
  error?: string;
  matches?: Array<{ code: string; title: string; score?: number }>;
  profile?: {
    occupation?: { code?: string; title?: string; description?: string };
    tasks?: OnetEvidence[];
    workContext?: OnetEvidence[];
    abilities?: OnetEvidence[];
    workActivities?: OnetEvidence[];
    detailedWorkActivities?: OnetEvidence[];
  } | null;
};

const categories: Array<{ id: CategoryId; label: string; description: string }> = [
  { id: "safety", label: "Safety Rates", description: "OSHA incidence arithmetic with official BLS benchmark context." },
  { id: "cost", label: "Workers’ Comp & Cost", description: "Claim-cost, lost-time, return-to-work and break-even scenarios." },
  { id: "health", label: "Workforce Health", description: "Aggregate condition, age-band and overlap planning." },
  { id: "readiness", label: "Readiness", description: "Operational completion and deployment-readiness counts." },
  { id: "job", label: "Job & Exposure", description: "O*NET evidence and schedule exposure without clinical scoring." },
];

const tools: ToolSpec[] = [
  { id: "rates", category: "safety", label: "TRIR & DART", note: "Observed arithmetic + BLS", evidence: ["arithmetic", "official"], icon: CircleGauge, why: "Compare observed employer incidence rates with an official industry benchmark." },
  { id: "workers-comp", category: "cost", label: "Workers’ Comp Cost", note: "Entered cost scenario", evidence: ["arithmetic", "assumption"], icon: BadgeDollarSign, why: "Translate entered claim volume and cost assumptions into a transparent scenario total." },
  { id: "lost-time", category: "cost", label: "Lost Time", note: "Capacity arithmetic", evidence: ["arithmetic", "assumption"], icon: Clock3, why: "Estimate productive hours and capacity cost from entered away/restricted-duty facts." },
  { id: "return-to-work", category: "cost", label: "Return to Work", note: "Modified-duty scenario", evidence: ["arithmetic", "assumption"], icon: RotateCcw, why: "Compare a full lost-time scenario with entered modified-duty assumptions." },
  { id: "break-even", category: "cost", label: "Intervention Break-Even", note: "Sensitivity arithmetic", evidence: ["arithmetic", "assumption"], icon: TrendingUp, why: "Test how many modeled events an intervention must avoid to cover its entered cost." },
  { id: "health-burden", category: "health", label: "Workforce Health Burden", note: "Prevalence planning", evidence: ["assumption", "operational"], icon: HeartPulse, why: "Translate entered aggregate prevalence assumptions into planning counts." },
  { id: "age-health", category: "health", label: "Age-Based Chronic Conditions", note: "Age-band scenario", evidence: ["assumption", "operational"], icon: Users, why: "Model how an entered workforce age mix changes aggregate condition-planning volume." },
  { id: "aggravation", category: "health", label: "Aggravation & Comorbidity Overlap", note: "Overlap scenario", evidence: ["assumption", "operational"], icon: BriefcaseMedical, why: "Estimate where an entered condition prevalence and job-demand exposure may overlap for planning." },
  { id: "readiness", category: "readiness", label: "Deployment Readiness", note: "Observable operational counts", evidence: ["operational"], icon: Users, why: "See which entered occupational-health completion counts are limiting readiness." },
  { id: "job-demands", category: "job", label: "Condition × Job Demands", note: "Live O*NET evidence", evidence: ["onet", "operational", "assumption"], icon: ShieldAlert, why: "Pair aggregate workforce assumptions with O*NET job-demand evidence without an individual fitness conclusion." },
  { id: "fatigue", category: "job", label: "Shift & Fatigue Exposure", note: "Schedule facts", evidence: ["arithmetic", "operational"], icon: BrainCircuit, why: "Quantify schedule intensity, night-work share and consecutive-day exposure without an impairment score." },
];

const evidenceLabel: Record<EvidenceKind, string> = {
  arithmetic: "Straight arithmetic",
  official: "Official benchmark",
  assumption: "User assumption",
  onet: "O*NET source data",
  operational: "Operational input",
};

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0); }
function number(value: number, digits = 1) { return (Number.isFinite(value) ? value : 0).toLocaleString("en-US", { maximumFractionDigits: digits }); }
function clamp(value: number, min = 0, max = 100) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0)); }

function Input({ label, value, onChange, suffix, step = 1, min = 0 }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; step?: number; min?: number }) {
  return <label className="block"><span className="text-[10px] font-medium text-slate-400">{label}</span><div className="mt-1.5 flex h-10 items-center border border-white/10 bg-[#040a10]"><input aria-label={label} type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[12px] font-medium text-white outline-none" />{suffix ? <span className="border-l border-white/8 px-2.5 text-[9px] text-slate-600">{suffix}</span> : null}</div></label>;
}

function Evidence({ values }: { values: EvidenceKind[] }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1">{values.map((value) => <span key={value} className="text-[9px] font-semibold uppercase tracking-[.1em] text-slate-500">{evidenceLabel[value]}</span>)}</div>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="border-b border-r border-white/8 px-4 py-4"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-1.5 text-xl font-semibold tracking-[-.02em] text-white">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{note}</p></div>;
}

function Waiting({ text }: { text: string }) {
  return <div className="grid min-h-[240px] place-items-center border-y border-white/8 px-8 text-center"><div><p className="text-base font-semibold text-slate-300">Waiting for inputs</p><p className="mx-auto mt-2 max-w-xl text-[10px] leading-5 text-slate-600">{text}</p></div></div>;
}

function WorkSurface({ spec, inputs, results, formula, source }: { spec: ToolSpec; inputs: ReactNode; results: ReactNode; formula: ReactNode; source: ReactNode }) {
  const Icon = spec.icon;
  return <section className="min-w-0 border border-white/8 bg-[#060c13]/78">
    <header className="flex items-start justify-between gap-5 border-b border-white/8 px-5 py-5"><div><Evidence values={spec.evidence} /><h2 className="mt-2 text-2xl font-semibold tracking-[-.025em] text-white">{spec.label}</h2><p className="mt-2 max-w-3xl text-[11px] leading-5 text-slate-500">{spec.why}</p></div><Icon size={20} className="mt-1 shrink-0 text-sky-300/55" /></header>
    <div className="grid min-h-[600px] 2xl:grid-cols-[minmax(320px,.72fr)_minmax(0,1.28fr)]">
      <div className="border-r border-white/8 p-5"><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-600">Inputs</p><div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">{inputs}</div></div>
      <div className="min-w-0"><div className="border-b border-white/8 px-5 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-600">Live result</p></div>{results}<div className="grid border-t border-white/8 xl:grid-cols-2"><div className="border-b border-white/8 p-5 xl:border-b-0 xl:border-r"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-slate-600">Formula / interpretation</p><div className="mt-2 text-[10px] leading-5 text-slate-500">{formula}</div></div><div className="p-5"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-slate-600">Source / reference</p><div className="mt-2 text-[10px] leading-5 text-slate-500">{source}</div></div></div></div>
    </div>
  </section>;
}

function Rates({ shared }: { shared: SharedContext }) {
  const spec = tools[0];
  const [recordables, setRecordables] = useState(32);
  const [dartCases, setDartCases] = useState(18);
  const [awayCases, setAwayCases] = useState(9);
  const trir = calculateIncidentRate(recordables, shared.annualHours);
  const dart = calculateIncidentRate(dartCases, shared.annualHours);
  const away = calculateIncidentRate(awayCases, shared.annualHours);
  const benchmark = shared.sector?.benchmark || null;
  const expected = expectedCasesFromHours(benchmark?.trcRate, shared.annualHours);
  const gap = benchmark?.trcRate != null && shared.annualHours > 0 ? trir - benchmark.trcRate : null;
  return <WorkSurface spec={spec} inputs={<><Input label="Recordable cases" value={recordables} onChange={setRecordables} /><Input label="DART cases" value={dartCases} onChange={setDartCases} /><Input label="Days-away cases" value={awayCases} onChange={setAwayCases} /></>} results={shared.annualHours > 0 ? <div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="TRIR" value={number(trir, 2)} note="Observed recordables × 200,000 ÷ hours" /><Metric label="DART" value={number(dart, 2)} note="Observed DART cases × 200,000 ÷ hours" /><Metric label="BLS TRC" value={benchmark?.trcRate != null ? number(benchmark.trcRate, 2) : "—"} note={shared.sector?.label || "No official benchmark selected"} /><Metric label="Rate gap" value={gap == null ? "—" : `${gap >= 0 ? "+" : ""}${number(gap, 2)}`} note={benchmark ? `${number(expected, 1)} benchmark-implied cases · away rate ${number(away, 2)}` : `Days-away rate ${number(away, 2)}`} /></div> : <Waiting text="Enter annual hours in the shared context to calculate incidence rates." />} formula={<>TRIR = recordables × 200,000 ÷ annual hours. DART and days-away rates use the same denominator.</>} source={<>OSHA incidence-rate arithmetic; BLS SOII benchmark when an industry is selected.</>} />;
}

function WorkersComp({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "workers-comp")!;
  const [claims, setClaims] = useState(0); const [medical, setMedical] = useState(0); const [lostDays, setLostDays] = useState(0); const [daily, setDaily] = useState(0); const [admin, setAdmin] = useState(0); const [indirect, setIndirect] = useState(0);
  const result = calculateWorkersCompCost({ claims, medicalCostPerClaim: medical, lostDaysPerClaim: lostDays, dailyCompensationCost: daily, administrativePercent: admin, indirectMultiplier: indirect });
  const ready = claims > 0 && (medical > 0 || (lostDays > 0 && daily > 0));
  return <WorkSurface spec={spec} inputs={<><Input label="Claims" value={claims} onChange={setClaims} /><Input label="Medical cost / claim" value={medical} onChange={setMedical} suffix="USD" step={1000} /><Input label="Lost days / claim" value={lostDays} onChange={setLostDays} /><Input label="Daily compensation cost" value={daily} onChange={setDaily} suffix="USD" /><Input label="Administrative load" value={admin} onChange={setAdmin} suffix="%" /><Input label="Indirect multiplier" value={indirect} onChange={setIndirect} suffix="×" step={0.1} /></>} results={ready ? <div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Scenario total" value={money(result.total)} note={`${claims} entered claims`} /><Metric label="Medical" value={money(result.medical)} note="Entered medical assumption" /><Metric label="Wage replacement" value={money(result.wageReplacement)} note="Lost days × daily cost" /><Metric label="Per worker" value={shared.workforce > 0 ? money(result.total / shared.workforce) : "—"} note={shared.workforce > 0 ? `Across ${shared.workforce.toLocaleString()} workers` : "Shared workforce not entered"} /></div> : <Waiting text="Enter claims and cost assumptions. The tool does not infer jurisdictional benefits." />} formula={<>Scenario total combines entered medical, wage-replacement, administrative and indirect-cost assumptions.</>} source={<>User-entered claim and cost assumptions only; no state workers’ compensation benefit schedule is inferred.</>} />;
}

function LostTime({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "lost-time")!;
  const [cases, setCases] = useState(0); const [awayDays, setAwayDays] = useState(0); const [restrictedDays, setRestrictedDays] = useState(0); const [loss, setLoss] = useState(0); const [hourly, setHourly] = useState(0); const [overtime, setOvertime] = useState(0);
  const result = calculateLostTime({ cases, daysAway: awayDays, restrictedDays, restrictedProductivityLossPercent: loss, hourlyCompensation: hourly, overtimePercent: overtime });
  const ready = cases > 0 && (awayDays > 0 || restrictedDays > 0);
  return <WorkSurface spec={spec} inputs={<><Input label="Cases" value={cases} onChange={setCases} /><Input label="Days away / case" value={awayDays} onChange={setAwayDays} /><Input label="Restricted days / case" value={restrictedDays} onChange={setRestrictedDays} /><Input label="Restricted productivity loss" value={loss} onChange={setLoss} suffix="%" /><Input label="Hourly compensation" value={hourly} onChange={setHourly} suffix="USD" /><Input label="Overtime premium" value={overtime} onChange={setOvertime} suffix="%" /></>} results={ready ? <div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Away hours" value={number(result.awayHours, 0)} note="8 hours per entered day" /><Metric label="Productive hours lost" value={number(result.productiveHoursLost, 0)} note="Away + restricted-duty loss" /><Metric label="Capacity cost" value={hourly > 0 ? money(result.total) : "—"} note="Entered compensation basis" /><Metric label="Workforce-hour share" value={shared.annualHours > 0 ? `${number(result.productiveHoursLost / shared.annualHours * 100, 3)}%` : "—"} note="Uses shared annual hours" /></div> : <Waiting text="Enter case/day facts. Shared annual hours are used only for workforce-hour share." />} formula={<>Away days are converted at 8 hours/day. Restricted-duty loss uses the entered productivity-loss percentage.</>} source={<>Operational case/day inputs plus user-entered compensation assumptions.</>} />;
}

function ReturnToWork({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "return-to-work")!;
  const [workers, setWorkers] = useState(0); const [fullDays, setFullDays] = useState(0); const [modifiedDays, setModifiedDays] = useState(0); const [daily, setDaily] = useState(0); const [productivity, setProductivity] = useState(0);
  const result = calculateReturnToWork({ workers, fullDutyDays: fullDays, modifiedDutyDays: modifiedDays, dailyCompensationCost: daily, modifiedProductivityPercent: productivity });
  const ready = workers > 0 && fullDays > 0;
  return <WorkSurface spec={spec} inputs={<><Input label="Workers" value={workers} onChange={setWorkers} /><Input label="Full lost-time days" value={fullDays} onChange={setFullDays} /><Input label="Modified-duty days" value={modifiedDays} onChange={setModifiedDays} /><Input label="Daily compensation cost" value={daily} onChange={setDaily} suffix="USD" /><Input label="Modified-duty productivity" value={productivity} onChange={setProductivity} suffix="%" /></>} results={ready ? <div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Without modified duty" value={money(result.fullDutyCost)} note="Full lost-time scenario" /><Metric label="Modified-duty cost" value={money(result.modifiedDutyCost)} note="Entered productivity scenario" /><Metric label="Modeled difference" value={money(result.savings)} note="Arithmetic difference" /><Metric label="Workers modeled" value={number(workers, 0)} note={shared.employer || "Shared employer not set"} /></div> : <Waiting text="Enter workers, full lost-time days and daily compensation assumptions." />} formula={<>Compares entered full lost-time days with an entered modified-duty duration/productivity scenario.</>} source={<>Operational return-to-work assumptions only; no success probability is inferred.</>} />;
}

function BreakEven({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "break-even")!;
  const [programCost, setProgramCost] = useState(0); const [costPerEvent, setCostPerEvent] = useState(0); const [baseline, setBaseline] = useState(0); const [effectiveness, setEffectiveness] = useState(0);
  const result = calculateBreakEven({ programCost, costPerEvent, effectivenessPercent: effectiveness, population: shared.workforce, baselineEventsPerHundred: baseline });
  const ready = shared.workforce > 0 && baseline > 0 && costPerEvent > 0;
  return <WorkSurface spec={spec} inputs={<><Input label="Program cost" value={programCost} onChange={setProgramCost} suffix="USD" /><Input label="Cost per event" value={costPerEvent} onChange={setCostPerEvent} suffix="USD" /><Input label="Baseline events / 100 workers" value={baseline} onChange={setBaseline} step={0.1} /><Input label="Assumed effectiveness" value={effectiveness} onChange={setEffectiveness} suffix="%" /></>} results={ready ? <div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Baseline-implied events" value={number(result.expectedEvents, 1)} note={`Uses ${shared.workforce.toLocaleString()} workers`} /><Metric label="Modeled avoided events" value={number(result.avoidedEvents, 1)} note={`${effectiveness}% entered effectiveness`} /><Metric label="Modeled benefit" value={money(result.potentialBenefit)} note="Avoided events × event cost" /><Metric label="Net arithmetic" value={money(result.netImpact)} note="Benefit − program cost" /></div> : <Waiting text="Enter workforce in shared context, then baseline event rate and financial assumptions." />} formula={<>Baseline events = workforce × entered events/100. Avoided events = baseline events × entered effectiveness.</>} source={<>Shared workforce plus user-entered baseline, effectiveness and cost assumptions.</>} />;
}

function HealthBurden({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "health-burden")!;
  const [msk, setMsk] = useState(0); const [cardio, setCardio] = useState(0); const [metabolic, setMetabolic] = useState(0); const [respiratory, setRespiratory] = useState(0);
  const rows = [{ label: "Musculoskeletal", pct: msk }, { label: "Cardiometabolic", pct: cardio }, { label: "Metabolic / diabetes", pct: metabolic }, { label: "Respiratory", pct: respiratory }].map((item) => ({ ...item, people: shared.workforce * Math.max(item.pct, 0) / 100 }));
  return <WorkSurface spec={spec} inputs={<><Input label="Musculoskeletal prevalence" value={msk} onChange={setMsk} suffix="%" /><Input label="Cardiometabolic prevalence" value={cardio} onChange={setCardio} suffix="%" /><Input label="Metabolic / diabetes prevalence" value={metabolic} onChange={setMetabolic} suffix="%" /><Input label="Respiratory prevalence" value={respiratory} onChange={setRespiratory} suffix="%" /></>} results={shared.workforce > 0 ? <div className="grid sm:grid-cols-2 xl:grid-cols-4">{rows.map((row) => <Metric key={row.label} label={row.label} value={row.pct > 0 ? number(row.people, 0) : "—"} note={`${row.pct}% entered prevalence`} />)}</div> : <Waiting text="Enter workforce in shared context, then aggregate prevalence assumptions." />} formula={<>Planning count = shared workforce × entered prevalence %. Categories can overlap and are not unique workers.</>} source={<>User-entered aggregate prevalence assumptions only; the app does not infer prevalence.</>} />;
}

function AgeHealth({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "age-health")!;
  const [under40, setUnder40] = useState(0); const [age4054, setAge4054] = useState(0); const [age55, setAge55] = useState(0); const [prevUnder40, setPrevUnder40] = useState(0); const [prev4054, setPrev4054] = useState(0); const [prev55, setPrev55] = useState(0);
  const ageTotal = under40 + age4054 + age55;
  const rows = [{ label: "Under 40", share: under40, prevalence: prevUnder40 }, { label: "40–54", share: age4054, prevalence: prev4054 }, { label: "55+", share: age55, prevalence: prev55 }].map((row) => ({ ...row, workers: shared.workforce * clamp(row.share) / 100, modeled: shared.workforce * clamp(row.share) / 100 * clamp(row.prevalence) / 100 }));
  const modeled = rows.reduce((sum, row) => sum + row.modeled, 0);
  return <WorkSurface spec={spec} inputs={<><Input label="Under 40 share" value={under40} onChange={setUnder40} suffix="%" /><Input label="Under 40 chronic-condition prevalence" value={prevUnder40} onChange={setPrevUnder40} suffix="%" /><Input label="Age 40–54 share" value={age4054} onChange={setAge4054} suffix="%" /><Input label="Age 40–54 prevalence" value={prev4054} onChange={setPrev4054} suffix="%" /><Input label="Age 55+ share" value={age55} onChange={setAge55} suffix="%" /><Input label="Age 55+ prevalence" value={prev55} onChange={setPrev55} suffix="%" /></>} results={shared.workforce > 0 ? <><div className="grid sm:grid-cols-2 xl:grid-cols-4">{rows.map((row) => <Metric key={row.label} label={row.label} value={number(row.modeled, 0)} note={`${number(row.workers, 0)} workers · ${row.prevalence}% prevalence`} />)}<Metric label="Modeled planning population" value={number(modeled, 0)} note={`Age shares total ${number(ageTotal, 1)}%`} /></div></> : <Waiting text="Enter shared workforce, then age-band shares and prevalence assumptions." />} formula={<>Age-band workforce = workforce × entered age share. Planning count = age-band workforce × entered prevalence.</>} source={<>Age shares and prevalence values are user assumptions unless independently sourced by the user.</>} />;
}

function Aggravation({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "aggravation")!;
  const [conditionPrev, setConditionPrev] = useState(0); const [exposureShare, setExposureShare] = useState(0); const [overlap, setOverlap] = useState(100); const [absenceDays, setAbsenceDays] = useState(0); const [dailyCost, setDailyCost] = useState(0);
  const conditionPopulation = shared.workforce * clamp(conditionPrev) / 100; const exposedPopulation = shared.workforce * clamp(exposureShare) / 100; const overlapPopulation = Math.min(conditionPopulation, exposedPopulation) * clamp(overlap) / 100; const absence = overlapPopulation * Math.max(absenceDays, 0); const cost = absence * Math.max(dailyCost, 0);
  return <WorkSurface spec={spec} inputs={<><Input label="Chronic-condition prevalence" value={conditionPrev} onChange={setConditionPrev} suffix="%" /><Input label="Workforce exposed to relevant job demand" value={exposureShare} onChange={setExposureShare} suffix="%" /><Input label="Assumed overlap factor" value={overlap} onChange={setOverlap} suffix="%" /><Input label="Modeled absence days / overlap worker" value={absenceDays} onChange={setAbsenceDays} step={0.5} suffix="days" /><Input label="Optional daily capacity cost" value={dailyCost} onChange={setDailyCost} suffix="USD" /></>} results={shared.workforce > 0 ? <div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Condition population" value={number(conditionPopulation, 0)} note={`${conditionPrev}% prevalence`} /><Metric label="Demand-exposed population" value={number(exposedPopulation, 0)} note={`${exposureShare}% exposure`} /><Metric label="Potential overlap" value={number(overlapPopulation, 0)} note="Planning intersection only" /><Metric label="Planning cost" value={dailyCost > 0 && absenceDays > 0 ? money(cost) : "—"} note={absenceDays > 0 ? `${number(absence, 0)} modeled absence days` : "Optional cost scenario"} /></div> : <Waiting text="Enter shared workforce first. This is an aggregate planning intersection, not an individual aggravation assessment." />} formula={<>Potential overlap = min(condition population, demand-exposed population) × entered overlap factor.</>} source={<>Shared workforce plus entered prevalence, exposure, overlap, absence and cost assumptions. No causation is inferred.</>} />;
}

function Readiness({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "readiness")!;
  const [readyCount, setReadyCount] = useState(0); const [exams, setExams] = useState(0); const [surveillance, setSurveillance] = useState(0); const [respirator, setRespirator] = useState(0); const [audiograms, setAudiograms] = useState(0); const [fitTests, setFitTests] = useState(0); const [pending, setPending] = useState(0);
  const coverage = [{ label: "Medical exams", value: exams }, { label: "Surveillance", value: surveillance }, { label: "Respirator clearance", value: respirator }, { label: "Audiograms", value: audiograms }, { label: "Fit tests", value: fitTests }].map((item) => ({ ...item, pct: shared.workforce > 0 ? Math.min(100, item.value / shared.workforce * 100) : 0 }));
  const bottleneck = [...coverage].filter((item) => item.value > 0).sort((a, b) => a.pct - b.pct)[0];
  const readyPct = shared.workforce > 0 ? Math.min(100, readyCount / shared.workforce * 100) : 0;
  return <WorkSurface spec={spec} inputs={<><Input label="Ready / cleared workers" value={readyCount} onChange={setReadyCount} /><Input label="Medical exams complete" value={exams} onChange={setExams} /><Input label="Surveillance complete" value={surveillance} onChange={setSurveillance} /><Input label="Respirator clearances complete" value={respirator} onChange={setRespirator} /><Input label="Audiograms complete" value={audiograms} onChange={setAudiograms} /><Input label="Fit tests complete" value={fitTests} onChange={setFitTests} /><Input label="Pending reviews / components" value={pending} onChange={setPending} /></>} results={shared.workforce > 0 ? <><div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Ready / cleared" value={`${number(readyPct, 1)}%`} note={`${readyCount} of ${shared.workforce.toLocaleString()} entered ready`} /><Metric label="Pending" value={number(pending, 0)} note="Entered pending reviews/components" /><Metric label="Coverage bottleneck" value={bottleneck ? `${number(bottleneck.pct, 1)}%` : "—"} note={bottleneck?.label || "Enter component counts"} /><Metric label="Gap to workforce" value={number(Math.max(shared.workforce - readyCount, 0), 0)} note="Arithmetic only" /></div><div className="grid border-t border-white/8 sm:grid-cols-2 xl:grid-cols-5">{coverage.map((item) => <Metric key={item.label} label={item.label} value={`${number(item.pct, 1)}%`} note={`${item.value} entered completions`} />)}</div></> : <Waiting text="Enter shared workforce first, then operational completion counts." />} formula={<>Coverage = completed component count ÷ shared workforce. Bottleneck is the lowest non-zero entered completion percentage.</>} source={<>Operational counts only. The tool does not infer deployability or issue medical clearance.</>} />;
}

function JobDemands({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "job-demands")!;
  const [keyword, setKeyword] = useState(""); const [conditionPrev, setConditionPrev] = useState(0); const [roleShare, setRoleShare] = useState(0); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [data, setData] = useState<OnetPayload | null>(null);
  async function run() { const clean = keyword.trim(); if (!clean) return; setLoading(true); setError(""); try { const response = await fetch(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(clean)}`); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || "O*NET lookup failed."); setData(payload); } catch (reason) { setError(reason instanceof Error ? reason.message : "O*NET lookup failed."); } finally { setLoading(false); } }
  const profile = data?.profile; const evidence = [...(profile?.tasks || []), ...(profile?.workContext || []), ...(profile?.abilities || []), ...(profile?.workActivities || [])]; const rolePopulation = shared.workforce * clamp(roleShare) / 100; const conditionPopulation = rolePopulation * clamp(conditionPrev) / 100;
  const input = <><label className="block"><span className="text-[10px] font-medium text-slate-400">Occupation</span><div className="mt-1.5 flex h-10 border border-white/10 bg-[#040a10]"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} placeholder="aircraft mechanic" className="min-w-0 flex-1 bg-transparent px-3 text-[12px] text-white outline-none" /><button type="button" onClick={() => void run()} disabled={loading || !keyword.trim()} className="inline-flex w-24 items-center justify-center gap-2 border-l border-white/10 text-[10px] font-semibold text-sky-200 disabled:opacity-40">{loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}Lookup</button></div>{error ? <p className="mt-2 text-[10px] text-rose-200/80">{error}</p> : null}</label><Input label="Share of workforce in this role" value={roleShare} onChange={setRoleShare} suffix="%" /><Input label="Aggregate condition prevalence" value={conditionPrev} onChange={setConditionPrev} suffix="%" /></>;
  const results = profile?.occupation ? <><div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Resolved occupation" value={profile.occupation.title || "—"} note={profile.occupation.code || "No O*NET code"} /><Metric label="Demand evidence" value={number(evidence.length, 0)} note="Tasks, context, abilities, activities" /><Metric label="Role population" value={shared.workforce > 0 ? number(rolePopulation, 0) : "—"} note={`${roleShare}% of shared workforce`} /><Metric label="Condition-planning overlap" value={shared.workforce > 0 ? number(conditionPopulation, 0) : "—"} note={`${conditionPrev}% entered prevalence`} /></div><div className="border-t border-white/8 px-5 py-4"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-slate-600">O*NET evidence preview</p><div className="mt-3 divide-y divide-white/8">{evidence.slice(0, 14).map((row, index) => <div key={`${row.name}-${index}`} className="py-3"><p className="text-[11px] font-semibold text-slate-300">{row.name}</p>{row.description ? <p className="mt-1 text-[9px] leading-4 text-slate-600">{row.description}</p> : null}</div>)}</div></div></> : <Waiting text="Search a job title to retrieve O*NET evidence. The tool does not convert job-demand evidence into an individual medical conclusion." />;
  return <WorkSurface spec={spec} inputs={input} results={results} formula={<>Role population = shared workforce × entered role share. Condition-planning count = role population × entered prevalence.</>} source={<>Live O*NET occupational evidence plus user-entered aggregate workforce assumptions.</>} />;
}

function Fatigue({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "fatigue")!;
  const [shiftHours, setShiftHours] = useState(0); const [shiftsWeek, setShiftsWeek] = useState(0); const [nightShifts, setNightShifts] = useState(0); const [consecutiveDays, setConsecutiveDays] = useState(0); const [roleShare, setRoleShare] = useState(0);
  const weekly = Math.max(shiftHours, 0) * Math.max(shiftsWeek, 0); const nightShare = shiftsWeek > 0 ? Math.min(100, Math.max(nightShifts, 0) / shiftsWeek * 100) : 0; const exposed = shared.workforce * clamp(roleShare) / 100;
  return <WorkSurface spec={spec} inputs={<><Input label="Hours per shift" value={shiftHours} onChange={setShiftHours} step={0.5} /><Input label="Shifts per week" value={shiftsWeek} onChange={setShiftsWeek} /><Input label="Night shifts per week" value={nightShifts} onChange={setNightShifts} /><Input label="Consecutive workdays" value={consecutiveDays} onChange={setConsecutiveDays} /><Input label="Share of workforce on schedule" value={roleShare} onChange={setRoleShare} suffix="%" /></>} results={shiftHours > 0 && shiftsWeek > 0 ? <div className="grid sm:grid-cols-2 xl:grid-cols-4"><Metric label="Weekly scheduled hours" value={number(weekly, 1)} note={`${shiftHours}h × ${shiftsWeek} shifts`} /><Metric label="Night-work share" value={`${number(nightShare, 1)}%`} note={`${nightShifts} entered night shifts/week`} /><Metric label="Consecutive days" value={number(consecutiveDays, 0)} note="Entered schedule fact" /><Metric label="Workers on schedule" value={shared.workforce > 0 ? number(exposed, 0) : "—"} note={`${roleShare}% of shared workforce`} /></div> : <Waiting text="Enter schedule facts. Results describe schedule exposure only and do not estimate fatigue impairment." />} formula={<>Weekly scheduled hours = shift length × shifts/week. Night share = night shifts ÷ total shifts.</>} source={<>Entered schedule facts only; no impairment or fatigue probability is inferred.</>} />;
}

export default function OccupationalCalculatorsV3() {
  const { context } = useEmployerWorkflow();
  const [activeId, setActiveId] = useState<CalculatorId>("rates");
  const [category, setCategory] = useState<CategoryId>("safety");
  const [employer, setEmployer] = useState((context.legalName || context.employer || "").trim());
  const [workforce, setWorkforce] = useState(1000);
  const [annualHours, setAnnualHours] = useState(2_000_000);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);

  useEffect(() => { const value = (context.legalName || context.employer || "").trim(); if (value) setEmployer(value); }, [context.legalName, context.employer]);
  useEffect(() => { void fetch("/api/occupational-discovery/bls-overview").then((response) => response.json()).then((payload) => { if (payload.ok) setOverview(payload); }).catch(() => undefined); }, []);

  const shared = useMemo<SharedContext>(() => ({ employer, workforce, annualHours, sector }), [employer, workforce, annualHours, sector]);
  const active = tools.find((item) => item.id === activeId) || tools[0];
  const categoryTools = tools.filter((item) => item.category === category);
  function chooseCategory(id: CategoryId) { setCategory(id); const first = tools.find((item) => item.category === id); if (first) setActiveId(first.id); }
  function resetShared() { setEmployer((context.legalName || context.employer || "").trim()); setWorkforce(0); setAnnualHours(0); setSector(null); }

  return <main className="min-h-screen bg-[#03080e] text-slate-100">
    <Sidebar />
    <section className="min-h-screen lg:ml-[210px]">
      <header className="border-b border-white/8 bg-[#060b11]/96 px-6 py-5 xl:px-8"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-600">Occupational intelligence / calculator workstation</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-[-.035em] text-white">Occupational Calculators</h1><p className="mt-2 max-w-4xl text-[11px] leading-5 text-slate-500">Select a calculator from the library, enter only the variables it needs, and keep the result, formula and evidence source visible in one work surface.</p></div><div className="flex items-end gap-6 text-right"><div><p className="text-[9px] uppercase tracking-[.12em] text-slate-600">Calculators</p><p className="mt-1 text-lg font-semibold text-white">11</p></div><div><p className="text-[9px] uppercase tracking-[.12em] text-slate-600">Categories</p><p className="mt-1 text-lg font-semibold text-white">{categories.length}</p></div></div></div></header>

      <div className="border-b border-amber-300/12 bg-amber-300/[.025] px-6 py-3 text-[10px] text-amber-100/70"><strong className="font-semibold text-amber-100">Sample scenario — replace with employer values.</strong> The initial workforce, hours and TRIR inputs are demonstration assumptions, not employer facts or official rates.</div>

      <div className="grid min-h-[calc(100vh-150px)] 2xl:grid-cols-[285px_minmax(0,1fr)]">
        <aside className="border-r border-white/8 bg-[#050a10]/92">
          <div className="border-b border-white/8 p-4"><div className="flex items-center justify-between"><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-600">Shared context</p><button type="button" onClick={resetShared} className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-slate-500 hover:text-white"><RotateCcw size={11} />Reset shared context</button></div><div className="mt-3 space-y-3"><label className="block"><span className="text-[9px] text-slate-500">Employer / organization</span><input value={employer} onChange={(event) => setEmployer(event.target.value)} placeholder="Optional" className="mt-1 h-9 w-full border border-white/9 bg-[#03070c] px-2.5 text-[11px] text-white outline-none" /></label><Input label="Workforce size" value={workforce} onChange={setWorkforce} suffix="workers" step={10} /><Input label="Annual hours worked" value={annualHours} onChange={setAnnualHours} suffix="hours" step={1000} /><label className="block"><span className="text-[9px] text-slate-500">BLS industry benchmark</span><select value={sector?.id || ""} onChange={(event) => setSector(overview?.sectors?.find((item) => item.id === event.target.value) || null)} className="mt-1 h-9 w-full border border-white/9 bg-[#03070c] px-2.5 text-[10px] text-white outline-none"><option value="">None selected</option>{(overview?.sectors || []).map((item) => <option key={item.id} value={item.id}>{item.label} · {item.naics}</option>)}</select></label></div></div>

          <nav aria-label="Calculator categories" className="border-b border-white/8 p-3"><div className="space-y-1">{categories.map((item) => <button key={item.id} type="button" onClick={() => chooseCategory(item.id)} className={cn("w-full border-l-2 px-3 py-2 text-left text-[11px] font-semibold transition", category === item.id ? "border-sky-300 bg-sky-300/[.05] text-white" : "border-transparent text-slate-500 hover:bg-white/[.02] hover:text-slate-300")}>{item.label}</button>)}</div><p className="mt-3 px-3 text-[9px] leading-4 text-slate-600">{categories.find((item) => item.id === category)?.description}</p></nav>

          <div className="p-3"><p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[.14em] text-slate-700">Calculator library</p><div className="space-y-1">{categoryTools.map((tool) => { const Icon = tool.icon; return <button key={tool.id} type="button" onClick={() => setActiveId(tool.id)} className={cn("w-full px-3 py-3 text-left transition", activeId === tool.id ? "bg-white/[.055]" : "hover:bg-white/[.025]")}><div className="flex items-start gap-3"><Icon size={14} className={cn("mt-0.5 shrink-0", activeId === tool.id ? "text-sky-300" : "text-slate-600")} /><div><p className={cn("text-[11px] font-semibold", activeId === tool.id ? "text-white" : "text-slate-400")}>{tool.label}</p><p className="mt-1 text-[9px] leading-4 text-slate-650">{tool.note}</p></div></div></button>; })}</div></div>
        </aside>

        <div className="min-w-0 p-5 xl:p-7">
          {active.id === "rates" ? <Rates shared={shared} /> : null}
          {active.id === "workers-comp" ? <WorkersComp shared={shared} /> : null}
          {active.id === "lost-time" ? <LostTime shared={shared} /> : null}
          {active.id === "return-to-work" ? <ReturnToWork shared={shared} /> : null}
          {active.id === "break-even" ? <BreakEven shared={shared} /> : null}
          {active.id === "health-burden" ? <HealthBurden shared={shared} /> : null}
          {active.id === "age-health" ? <AgeHealth shared={shared} /> : null}
          {active.id === "aggravation" ? <Aggravation shared={shared} /> : null}
          {active.id === "readiness" ? <Readiness shared={shared} /> : null}
          {active.id === "job-demands" ? <JobDemands shared={shared} /> : null}
          {active.id === "fatigue" ? <Fatigue shared={shared} /> : null}
        </div>
      </div>
    </section>
  </main>;
}
