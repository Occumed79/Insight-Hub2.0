import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  MetricOrb,
  NumberField,
  OccupationalToolShell,
  RangeField,
  ToolHero,
} from "@/components/insight/OccupationalToolPrimitives";
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

type CalculatorId = "rates" | "workers-comp" | "lost-time" | "return-to-work" | "break-even" | "health-burden" | "age-health" | "aggravation" | "readiness" | "job-demands" | "fatigue";
type CategoryId = "safety" | "cost" | "health" | "readiness" | "job";
type EvidenceKind = "arithmetic" | "official" | "assumption" | "onet" | "operational";
type Sector = { id: string; naics: string; label: string; description: string; benchmark: BlsBenchmark | null };
type SharedContext = { employer: string; workforce: number; annualHours: number; sector: Sector | null };
type ToolSpec = { id: CalculatorId; category: CategoryId; label: string; note: string; evidence: EvidenceKind[]; icon: typeof Activity; why: string };

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

type Overview = { sectors?: Sector[] };

const categories: Array<{ id: CategoryId; label: string; description: string }> = [
  { id: "safety", label: "Safety Rates", description: "OSHA arithmetic with official BLS context." },
  { id: "cost", label: "Workers’ Comp & Cost", description: "Transparent claim-cost, lost-time, RTW, and break-even scenarios." },
  { id: "health", label: "Workforce Health", description: "Aggregate chronic-condition, age-band, and aggravation-overlap planning." },
  { id: "readiness", label: "Readiness", description: "Operational coverage and deployment-readiness counts." },
  { id: "job", label: "Job & Exposure", description: "O*NET evidence and schedule/exposure facts without clinical scoring." },
];

const tools: ToolSpec[] = [
  { id: "rates", category: "safety", label: "TRIR & DART", note: "Observed arithmetic + BLS", evidence: ["arithmetic", "official"], icon: CircleGauge, why: "Compare employer incidence rates with an official industry benchmark." },
  { id: "workers-comp", category: "cost", label: "Workers’ Comp Cost", note: "Entered cost scenario", evidence: ["arithmetic", "assumption"], icon: BadgeDollarSign, why: "Translate claim volume and entered cost assumptions into a transparent cost range." },
  { id: "lost-time", category: "cost", label: "Lost Time", note: "Capacity arithmetic", evidence: ["arithmetic", "assumption"], icon: Clock3, why: "Estimate productive hours and capacity cost from entered away/restricted-duty facts." },
  { id: "return-to-work", category: "cost", label: "Return to Work", note: "Modified-duty scenario", evidence: ["arithmetic", "assumption"], icon: RotateCcw, why: "Compare full lost-time cost with an entered modified-duty scenario." },
  { id: "break-even", category: "cost", label: "Intervention Break-Even", note: "Sensitivity arithmetic", evidence: ["arithmetic", "assumption"], icon: TrendingUp, why: "Test how many modeled events an intervention would need to avoid to cover its cost." },
  { id: "health-burden", category: "health", label: "Workforce Health Burden", note: "Prevalence planning", evidence: ["assumption", "operational"], icon: HeartPulse, why: "Translate entered aggregate prevalence assumptions into planning counts." },
  { id: "age-health", category: "health", label: "Age-Based Chronic Conditions", note: "Age-band scenario", evidence: ["assumption", "operational"], icon: Users, why: "Model how workforce age mix changes aggregate chronic-condition planning volume." },
  { id: "aggravation", category: "health", label: "Aggravation & Comorbidity Overlap", note: "Overlap scenario", evidence: ["assumption", "operational"], icon: BriefcaseMedical, why: "Estimate the population where an entered chronic-condition prevalence and job-demand exposure may overlap for planning." },
  { id: "readiness", category: "readiness", label: "Deployment Readiness", note: "Observable operational counts", evidence: ["operational"], icon: Users, why: "See which required occupational-health components are limiting workforce readiness." },
  { id: "job-demands", category: "job", label: "Condition × Job Demands", note: "Live O*NET evidence", evidence: ["onet", "operational", "assumption"], icon: ShieldAlert, why: "Pair aggregate workforce assumptions with O*NET job-demand evidence without making individual fitness conclusions." },
  { id: "fatigue", category: "job", label: "Shift & Fatigue Exposure", note: "Schedule facts, no impairment score", evidence: ["arithmetic", "operational"], icon: BrainCircuit, why: "Quantify schedule intensity, night-work share, and consecutive-day exposure." },
];

const evidenceLabels: Record<EvidenceKind, string> = {
  arithmetic: "Straight arithmetic",
  official: "Official benchmark",
  assumption: "User assumption",
  onet: "O*NET source data",
  operational: "Operational input",
};
const evidenceClasses: Record<EvidenceKind, string> = {
  arithmetic: "border-cyan-200/18 bg-cyan-300/[0.06] text-cyan-50",
  official: "border-emerald-200/18 bg-emerald-300/[0.06] text-emerald-50",
  assumption: "border-amber-200/18 bg-amber-300/[0.06] text-amber-50",
  onet: "border-violet-200/18 bg-violet-300/[0.06] text-violet-50",
  operational: "border-rose-200/18 bg-rose-300/[0.06] text-rose-50",
};

function EvidencePills({ values }: { values: EvidenceKind[] }) {
  return <div className="flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${evidenceClasses[value]}`}>{evidenceLabels[value]}</span>)}</div>;
}

function money(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0); }
function number(value: number, digits = 1): string { return (Number.isFinite(value) ? value : 0).toLocaleString("en-US", { maximumFractionDigits: digits }); }
function clamp(value: number, min = 0, max = 100): number { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0)); }

function Frame({ spec, children, results, formula, sources }: { spec: ToolSpec; children: ReactNode; results: ReactNode; formula: ReactNode; sources: ReactNode }) {
  return <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="grid gap-5 2xl:grid-cols-[.72fr_1.28fr]">
    <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><EvidencePills values={spec.evidence} /><h2 className="mt-3 text-2xl font-black tracking-tight text-white">{spec.label}</h2><p className="mt-2 text-xs leading-6 text-cyan-50/55">{spec.why}</p></div><spec.icon size={22} className="text-cyan-200/55" /></div><div className="mt-5 space-y-4">{children}</div></GlassCard>
    <div className="space-y-5">{results}<GlassCard className="p-4"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-50/42">Formula / interpretation</p><div className="mt-2 text-[10px] leading-5 text-cyan-50/52">{formula}</div></GlassCard><GlassCard className="p-4"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-50/42">Source / reference</p><div className="mt-2 text-[10px] leading-5 text-cyan-50/52">{sources}</div></GlassCard></div>
  </motion.section>;
}

function Waiting({ text }: { text: string }) { return <GlassCard className="p-8 text-center"><Sparkles className="mx-auto h-8 w-8 text-cyan-200/40" /><p className="mt-3 font-black text-white">Waiting for inputs</p><p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-50/50">{text}</p></GlassCard>; }

function Rates({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "rates")!;
  const [recordables, setRecordables] = useState(0); const [dartCases, setDartCases] = useState(0); const [awayCases, setAwayCases] = useState(0);
  const hours = shared.annualHours;
  const trir = calculateIncidentRate(recordables, hours); const dart = calculateIncidentRate(dartCases, hours); const away = calculateIncidentRate(awayCases, hours);
  const benchmark = shared.sector?.benchmark || null;
  const expected = expectedCasesFromHours(benchmark?.trcRate, hours); const gap = benchmark?.trcRate != null && hours > 0 ? trir - benchmark.trcRate : null;
  return <Frame spec={spec} formula={<>TRIR = recordables × 200,000 ÷ annual hours. DART uses the same denominator. Workforce size is not substituted for actual hours.</>} sources={<>OSHA incidence-rate arithmetic; BLS SOII benchmark when an industry is selected.</>} results={hours > 0 ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="TRIR" value={number(trir, 2)} note="Observed recordables × 200,000 ÷ shared hours" icon={CircleGauge} /><MetricOrb label="DART" value={number(dart, 2)} note="Observed DART cases × 200,000 ÷ shared hours" icon={CalendarClock} tone="violet" /><MetricOrb label="BLS TRC" value={benchmark?.trcRate != null ? number(benchmark.trcRate, 2) : "—"} note={shared.sector?.label || "Choose industry in shared context"} icon={Activity} tone="emerald" /><MetricOrb label="Rate gap" value={gap == null ? "—" : `${gap >= 0 ? "+" : ""}${number(gap, 2)}`} note={benchmark ? `${number(expected, 1)} benchmark-implied cases` : "No official benchmark selected"} icon={TrendingUp} tone={gap != null && gap > 0 ? "rose" : "emerald"} /></section> : <Waiting text="Enter annual hours once in the shared context. That same hours value carries into the calculators that use it." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Recordable cases" value={recordables} onChange={setRecordables} /><NumberField label="DART cases" value={dartCases} onChange={setDartCases} /><NumberField label="Days-away cases" value={awayCases} onChange={setAwayCases} /></div>{hours > 0 ? <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-[10px] leading-5 text-cyan-50/48">Shared hours: {hours.toLocaleString()} · Days-away rate: {number(away, 2)}.</div> : null}</Frame>;
}

function WorkersComp({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "workers-comp")!;
  const [claims, setClaims] = useState(0); const [medical, setMedical] = useState(0); const [lostDays, setLostDays] = useState(0); const [daily, setDaily] = useState(0); const [admin, setAdmin] = useState(0); const [indirect, setIndirect] = useState(0);
  const result = calculateWorkersCompCost({ claims, medicalCostPerClaim: medical, lostDaysPerClaim: lostDays, dailyCompensationCost: daily, administrativePercent: admin, indirectMultiplier: indirect });
  const ready = claims > 0 && (medical > 0 || (lostDays > 0 && daily > 0));
  return <Frame spec={spec} formula={<>Scenario total = entered medical + wage-replacement + administrative + indirect assumptions. It is not a jurisdictional workers’ compensation estimate.</>} sources={<>User-entered claim/cost assumptions only; no state benefit schedule is inferred.</>} results={ready ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Scenario total" value={money(result.total)} note={`${claims} entered claims`} icon={BadgeDollarSign} tone="violet" /><MetricOrb label="Medical" value={money(result.medical)} note="Entered medical assumption" icon={BriefcaseMedical} /><MetricOrb label="Wage replacement" value={money(result.wageReplacement)} note="Entered lost days × daily cost" icon={CalendarClock} tone="rose" /><MetricOrb label="Per worker" value={shared.workforce > 0 ? money(result.total / shared.workforce) : "—"} note={shared.workforce > 0 ? `Across shared workforce of ${shared.workforce.toLocaleString()}` : "Add workforce in shared context"} icon={Users} tone="amber" /></section> : <Waiting text="Enter claims and cost assumptions. These are scenario inputs, not sourced claim estimates." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Claims" value={claims} onChange={setClaims} /><NumberField label="Medical cost / claim" value={medical} onChange={setMedical} step={1000} suffix="USD" /><NumberField label="Lost days / claim" value={lostDays} onChange={setLostDays} /><NumberField label="Daily compensation cost" value={daily} onChange={setDaily} suffix="USD" /><NumberField label="Administrative load" value={admin} onChange={setAdmin} suffix="%" /><NumberField label="Indirect multiplier" value={indirect} onChange={setIndirect} step={0.1} suffix="×" /></div></Frame>;
}

function LostTime({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "lost-time")!;
  const [cases, setCases] = useState(0); const [awayDays, setAwayDays] = useState(0); const [restrictedDays, setRestrictedDays] = useState(0); const [loss, setLoss] = useState(0); const [hourly, setHourly] = useState(0); const [overtime, setOvertime] = useState(0);
  const result = calculateLostTime({ cases, daysAway: awayDays, restrictedDays, restrictedProductivityLossPercent: loss, hourlyCompensation: hourly, overtimePercent: overtime });
  const ready = cases > 0 && (awayDays > 0 || restrictedDays > 0);
  return <Frame spec={spec} formula={<>Away days are converted at 8 hours/day. Restricted-duty loss uses the entered productivity-loss percentage. Compensation and overtime are assumptions.</>} sources={<>Operational case/day inputs plus user-entered compensation assumptions.</>} results={ready ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Away hours" value={number(result.awayHours, 0)} note="8 hours per entered day" icon={Clock3} /><MetricOrb label="Productive hours lost" value={number(result.productiveHoursLost, 0)} note="Away + entered restricted-duty loss" icon={Activity} tone="rose" /><MetricOrb label="Capacity cost" value={hourly > 0 ? money(result.total) : "—"} note="Entered compensation basis" icon={BadgeDollarSign} tone="amber" /><MetricOrb label="Workforce-hour share" value={shared.annualHours > 0 ? `${number(result.productiveHoursLost / shared.annualHours * 100, 3)}%` : "—"} note="Uses shared annual hours" icon={Users} tone="violet" /></section> : <Waiting text="Enter case/day facts. Shared annual hours are used only for the optional workforce-hour share." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Cases" value={cases} onChange={setCases} /><NumberField label="Days away / case" value={awayDays} onChange={setAwayDays} /><NumberField label="Restricted days / case" value={restrictedDays} onChange={setRestrictedDays} /><NumberField label="Restricted productivity loss" value={loss} onChange={setLoss} suffix="%" /><NumberField label="Hourly compensation" value={hourly} onChange={setHourly} suffix="USD" /><NumberField label="Overtime premium" value={overtime} onChange={setOvertime} suffix="%" /></div></Frame>;
}

function ReturnToWork({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "return-to-work")!;
  const [workers, setWorkers] = useState(0); const [fullDays, setFullDays] = useState(0); const [modifiedDays, setModifiedDays] = useState(0); const [daily, setDaily] = useState(0); const [productivity, setProductivity] = useState(0);
  const result = calculateReturnToWork({ workers, fullDutyDays: fullDays, modifiedDutyDays: modifiedDays, dailyCompensationCost: daily, modifiedProductivityPercent: productivity });
  const ready = workers > 0 && fullDays > 0;
  return <Frame spec={spec} formula={<>Compares entered full lost-time days with an entered modified-duty duration/productivity scenario. The difference is arithmetic, not a prediction of return-to-work success.</>} sources={<>Operational RTW assumptions only.</>} results={ready ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Without modified duty" value={money(result.fullDutyCost)} note="Entered workers × full lost-time days × daily cost" icon={Clock3} tone="rose" /><MetricOrb label="Modified-duty cost" value={money(result.modifiedDutyCost)} note="Uses entered modified-duty productivity" icon={RotateCcw} tone="amber" /><MetricOrb label="Modeled difference" value={money(result.savings)} note="Arithmetic difference between scenarios" icon={BadgeDollarSign} tone="emerald" /><MetricOrb label="Workers modeled" value={number(workers, 0)} note={shared.employer || "Shared employer not set"} icon={Users} /></section> : <Waiting text="Enter workers, full lost-time days, and daily compensation assumptions." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Workers" value={workers} onChange={setWorkers} /><NumberField label="Full lost-time days" value={fullDays} onChange={setFullDays} /><NumberField label="Modified-duty days" value={modifiedDays} onChange={setModifiedDays} /><NumberField label="Daily compensation cost" value={daily} onChange={setDaily} suffix="USD" /><RangeField label="Modified-duty productivity" value={productivity} onChange={setProductivity} /></div></Frame>;
}

function BreakEven({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "break-even")!;
  const [programCost, setProgramCost] = useState(0); const [costPerEvent, setCostPerEvent] = useState(0); const [baseline, setBaseline] = useState(0); const [effectiveness, setEffectiveness] = useState(0);
  const population = shared.workforce;
  const result = calculateBreakEven({ programCost, costPerEvent, effectivenessPercent: effectiveness, population, baselineEventsPerHundred: baseline });
  const ready = population > 0 && baseline > 0 && costPerEvent > 0;
  return <Frame spec={spec} formula={<>Baseline events = workforce × entered events/100. Avoided events = baseline events × entered effectiveness. Benefit = avoided events × entered cost/event.</>} sources={<>Shared workforce plus user-entered baseline, effectiveness, and cost assumptions.</>} results={ready ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Baseline-implied events" value={number(result.expectedEvents, 1)} note={`Uses shared workforce of ${population.toLocaleString()}`} icon={Activity} /><MetricOrb label="Modeled avoided events" value={number(result.avoidedEvents, 1)} note={`${effectiveness}% entered effectiveness`} icon={ShieldAlert} tone="emerald" /><MetricOrb label="Modeled benefit" value={money(result.potentialBenefit)} note="Avoided events × entered event cost" icon={BadgeDollarSign} tone="violet" /><MetricOrb label="Net arithmetic" value={money(result.netImpact)} note="Modeled benefit − program cost" icon={TrendingUp} tone={result.netImpact >= 0 ? "emerald" : "rose"} /></section> : <Waiting text="Enter workforce once in shared context, then baseline event rate and financial assumptions here." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Program cost" value={programCost} onChange={setProgramCost} suffix="USD" /><NumberField label="Cost per event" value={costPerEvent} onChange={setCostPerEvent} suffix="USD" /><NumberField label="Baseline events / 100 workers" value={baseline} onChange={setBaseline} step={0.1} /><RangeField label="Assumed effectiveness" value={effectiveness} onChange={setEffectiveness} /></div></Frame>;
}

function HealthBurden({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "health-burden")!;
  const [msk, setMsk] = useState(0); const [cardio, setCardio] = useState(0); const [metabolic, setMetabolic] = useState(0); const [respiratory, setRespiratory] = useState(0);
  const population = shared.workforce;
  const rows = [{ label: "Musculoskeletal", pct: msk }, { label: "Cardiometabolic", pct: cardio }, { label: "Metabolic / diabetes", pct: metabolic }, { label: "Respiratory", pct: respiratory }].map((item) => ({ ...item, people: population * Math.max(item.pct, 0) / 100 }));
  const sum = rows.reduce((total, item) => total + item.people, 0);
  return <Frame spec={spec} formula={<>Planning count = shared workforce × entered prevalence %. Categories may overlap, so their sum is not unique affected workers.</>} sources={<>User-entered aggregate prevalence assumptions only. No prevalence is inferred by the app.</>} results={population > 0 ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{rows.map((item) => <MetricOrb key={item.label} label={item.label} value={item.pct > 0 ? number(item.people, 0) : "—"} note={`${item.pct}% entered prevalence assumption`} icon={HeartPulse} tone="rose" />)}</section><GlassCard className="p-4 text-[10px] leading-5 text-cyan-50/48">The category counts may overlap. The {number(sum, 0)} summed count is deliberately not presented as unique affected workers because comorbidity is unknown.</GlassCard></> : <Waiting text="Enter workforce once in shared context, then prevalence assumptions for planning." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Musculoskeletal prevalence" value={msk} onChange={setMsk} suffix="%" /><NumberField label="Cardiometabolic prevalence" value={cardio} onChange={setCardio} suffix="%" /><NumberField label="Metabolic / diabetes prevalence" value={metabolic} onChange={setMetabolic} suffix="%" /><NumberField label="Respiratory prevalence" value={respiratory} onChange={setRespiratory} suffix="%" /></div></Frame>;
}

function AgeHealth({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "age-health")!;
  const [under40, setUnder40] = useState(0); const [age4054, setAge4054] = useState(0); const [age55, setAge55] = useState(0);
  const [prevUnder40, setPrevUnder40] = useState(0); const [prev4054, setPrev4054] = useState(0); const [prev55, setPrev55] = useState(0);
  const workforce = shared.workforce;
  const ageTotal = under40 + age4054 + age55;
  const rows = [
    { label: "Under 40", share: under40, prevalence: prevUnder40 },
    { label: "40–54", share: age4054, prevalence: prev4054 },
    { label: "55+", share: age55, prevalence: prev55 },
  ].map((row) => ({ ...row, workers: workforce * clamp(row.share) / 100, modeled: workforce * clamp(row.share) / 100 * clamp(row.prevalence) / 100 }));
  const modeled = rows.reduce((sum, row) => sum + row.modeled, 0);
  return <Frame spec={spec} formula={<>Age-band workforce = shared workforce × entered age share. Modeled chronic-condition planning count = age-band workforce × entered prevalence for that age band.</>} sources={<>All age shares and prevalence values are user assumptions unless independently sourced by the user. This does not estimate any individual employee’s health status.</>} results={workforce > 0 ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{rows.map((row) => <MetricOrb key={row.label} label={row.label} value={number(row.modeled, 0)} note={`${number(row.workers, 0)} workers in band · ${row.prevalence}% entered prevalence`} icon={Users} tone="amber" />)}<MetricOrb label="Modeled planning population" value={number(modeled, 0)} note="Sum of age-band scenario counts" icon={HeartPulse} tone="violet" /></section>{Math.abs(ageTotal - 100) > 0.1 ? <GlassCard className="border-amber-200/15 p-4 text-[10px] leading-5 text-amber-50/62">Age-band shares currently total {number(ageTotal, 1)}%. Use 100% for a complete workforce distribution.</GlassCard> : null}</> : <Waiting text="Enter shared workforce first, then age-band shares and prevalence assumptions." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Under 40 share" value={under40} onChange={setUnder40} suffix="%" /><NumberField label="Under 40 chronic-condition prevalence" value={prevUnder40} onChange={setPrevUnder40} suffix="%" /><NumberField label="Age 40–54 share" value={age4054} onChange={setAge4054} suffix="%" /><NumberField label="Age 40–54 prevalence" value={prev4054} onChange={setPrev4054} suffix="%" /><NumberField label="Age 55+ share" value={age55} onChange={setAge55} suffix="%" /><NumberField label="Age 55+ prevalence" value={prev55} onChange={setPrev55} suffix="%" /></div></Frame>;
}

function Aggravation({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "aggravation")!;
  const [conditionPrev, setConditionPrev] = useState(0); const [exposureShare, setExposureShare] = useState(0); const [overlap, setOverlap] = useState(100); const [absenceDays, setAbsenceDays] = useState(0); const [dailyCost, setDailyCost] = useState(0);
  const workforce = shared.workforce;
  const conditionPopulation = workforce * clamp(conditionPrev) / 100;
  const exposedPopulation = workforce * clamp(exposureShare) / 100;
  const overlapPopulation = Math.min(conditionPopulation, exposedPopulation) * clamp(overlap) / 100;
  const absence = overlapPopulation * Math.max(absenceDays, 0);
  const cost = absence * Math.max(dailyCost, 0);
  return <Frame spec={spec} formula={<>Potential overlap = min(condition-prevalence population, job-demand-exposed population) × entered overlap factor. This is a planning intersection, not proof of aggravation or causation.</>} sources={<>Shared workforce plus user-entered prevalence, exposure, overlap, absence, and cost assumptions.</>} results={workforce > 0 ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Condition population" value={number(conditionPopulation, 0)} note={`${conditionPrev}% entered prevalence`} icon={HeartPulse} /><MetricOrb label="Demand-exposed population" value={number(exposedPopulation, 0)} note={`${exposureShare}% entered job-demand exposure`} icon={ShieldAlert} tone="rose" /><MetricOrb label="Potential overlap" value={number(overlapPopulation, 0)} note={`${overlap}% entered overlap factor · not a medical determination`} icon={BriefcaseMedical} tone="violet" /><MetricOrb label="Planning cost" value={dailyCost > 0 && absenceDays > 0 ? money(cost) : "—"} note={absenceDays > 0 ? `${number(absence, 0)} modeled absence days` : "Optional absence/cost assumptions"} icon={BadgeDollarSign} tone="amber" /></section> : <Waiting text="Enter shared workforce first. This calculator is intentionally an aggregate overlap scenario, not an individual aggravation assessment." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Chronic-condition prevalence" value={conditionPrev} onChange={setConditionPrev} suffix="%" /><NumberField label="Workforce exposed to relevant job demand" value={exposureShare} onChange={setExposureShare} suffix="%" /><RangeField label="Assumed overlap factor" value={overlap} onChange={setOverlap} /><NumberField label="Modeled absence days / overlap worker" value={absenceDays} onChange={setAbsenceDays} step={0.5} suffix="days" /><NumberField label="Optional daily capacity cost" value={dailyCost} onChange={setDailyCost} suffix="USD" /></div></Frame>;
}

function Readiness({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "readiness")!;
  const workforce = shared.workforce;
  const [readyCount, setReadyCount] = useState(0); const [exams, setExams] = useState(0); const [surveillance, setSurveillance] = useState(0); const [respirator, setRespirator] = useState(0); const [audiograms, setAudiograms] = useState(0); const [fitTests, setFitTests] = useState(0); const [pending, setPending] = useState(0);
  const coverage = [{ label: "Medical exams", value: exams }, { label: "Surveillance", value: surveillance }, { label: "Respirator clearance", value: respirator }, { label: "Audiograms", value: audiograms }, { label: "Fit tests", value: fitTests }].map((item) => ({ ...item, pct: workforce > 0 ? Math.min(100, item.value / workforce * 100) : 0 }));
  const bottleneck = [...coverage].filter((item) => item.value > 0).sort((a, b) => a.pct - b.pct)[0];
  const readyPct = workforce > 0 ? Math.min(100, readyCount / workforce * 100) : 0;
  return <Frame spec={spec} formula={<>Coverage = completed component count ÷ shared workforce. The bottleneck is the lowest non-zero completion percentage entered.</>} sources={<>Operational counts only. The tool does not infer deployability or medical clearance.</>} results={workforce > 0 ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Ready / cleared" value={`${number(readyPct, 1)}%`} note={`${readyCount} of ${workforce.toLocaleString()} entered ready`} icon={Users} tone="emerald" /><MetricOrb label="Pending" value={number(pending, 0)} note="Entered pending reviews / components" icon={CalendarClock} tone="amber" /><MetricOrb label="Coverage bottleneck" value={bottleneck ? `${number(bottleneck.pct, 1)}%` : "—"} note={bottleneck?.label || "Enter component counts"} icon={ShieldAlert} tone="rose" /><MetricOrb label="Gap to workforce" value={number(Math.max(workforce - readyCount, 0), 0)} note="Arithmetic only; not a medical-readiness conclusion" icon={Activity} tone="violet" /></section><GlassCard className="p-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{coverage.map((item) => <div key={item.label} className="rounded-xl border border-white/9 bg-black/15 p-3"><p className="text-[9px] text-cyan-50/45">{item.label}</p><p className="mt-1 text-lg font-black">{number(item.pct, 1)}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-cyan-300/60" style={{ width: `${item.pct}%` }} /></div></div>)}</div></GlassCard></> : <Waiting text="Enter shared workforce first, then operational completion counts." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Ready / cleared workers" value={readyCount} onChange={setReadyCount} /><NumberField label="Medical exams complete" value={exams} onChange={setExams} /><NumberField label="Surveillance complete" value={surveillance} onChange={setSurveillance} /><NumberField label="Respirator clearances complete" value={respirator} onChange={setRespirator} /><NumberField label="Audiograms complete" value={audiograms} onChange={setAudiograms} /><NumberField label="Fit tests complete" value={fitTests} onChange={setFitTests} /><NumberField label="Pending reviews / components" value={pending} onChange={setPending} /></div></Frame>;
}

function JobDemands({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "job-demands")!;
  const [keyword, setKeyword] = useState(""); const [conditionPrev, setConditionPrev] = useState(0); const [roleShare, setRoleShare] = useState(0); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [data, setData] = useState<OnetPayload | null>(null);
  async function run() { const clean = keyword.trim(); if (!clean) return; setLoading(true); setError(""); try { const response = await fetch(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(clean)}`); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || "O*NET lookup failed."); setData(payload); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "O*NET lookup failed."); } finally { setLoading(false); } }
  const profile = data?.profile;
  const evidence = [...(profile?.tasks || []), ...(profile?.workContext || []), ...(profile?.abilities || []), ...(profile?.workActivities || [])];
  const rolePopulation = shared.workforce * clamp(roleShare) / 100;
  const conditionPopulation = rolePopulation * clamp(conditionPrev) / 100;
  return <Frame spec={spec} formula={<>Role population = shared workforce × entered role share. Condition-planning count = role population × entered prevalence. O*NET evidence remains descriptive and does not create a clinical risk score.</>} sources={<>Live O*NET occupational evidence plus user-entered workforce assumptions.</>} results={profile?.occupation ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Resolved occupation" value={profile.occupation.title || "—"} note={profile.occupation.code || "No code"} icon={BriefcaseMedical} /><MetricOrb label="Demand evidence" value={number(evidence.length, 0)} note="Tasks, context, abilities, activities" icon={ShieldAlert} tone="violet" /><MetricOrb label="Role population" value={shared.workforce > 0 ? number(rolePopulation, 0) : "—"} note={`${roleShare}% of shared workforce`} icon={Users} tone="amber" /><MetricOrb label="Condition-planning overlap" value={shared.workforce > 0 ? number(conditionPopulation, 0) : "—"} note={`${conditionPrev}% entered prevalence within role population`} icon={HeartPulse} tone="rose" /></section><GlassCard className="p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-50/42">O*NET evidence preview</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{evidence.slice(0, 14).map((row, index) => <div key={`${row.name}-${index}`} className="rounded-xl border border-white/9 bg-black/15 p-3"><p className="text-xs font-black">{row.name}</p>{row.description ? <p className="mt-1 text-[9px] leading-4 text-cyan-50/42">{row.description}</p> : null}</div>)}</div></GlassCard></> : <Waiting text="Search a job title to retrieve O*NET evidence. This calculator never converts O*NET demand evidence into an individual medical conclusion." />}><div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">Occupation</span><div className="mt-2 flex gap-2"><input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} placeholder="aircraft mechanic" className="min-h-11 flex-1 rounded-xl border border-cyan-100/16 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /><button type="button" onClick={() => void run()} disabled={loading || !keyword.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-black disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}Lookup</button></div>{error ? <p className="mt-2 text-[10px] text-rose-100/65">{error}</p> : null}</label><NumberField label="Share of workforce in this role" value={roleShare} onChange={setRoleShare} suffix="%" /><NumberField label="Aggregate condition prevalence" value={conditionPrev} onChange={setConditionPrev} suffix="%" /></div></Frame>;
}

function Fatigue({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "fatigue")!;
  const [shiftHours, setShiftHours] = useState(0); const [shiftsWeek, setShiftsWeek] = useState(0); const [nightShifts, setNightShifts] = useState(0); const [consecutiveDays, setConsecutiveDays] = useState(0); const [roleShare, setRoleShare] = useState(0);
  const weekly = Math.max(shiftHours, 0) * Math.max(shiftsWeek, 0); const nightShare = shiftsWeek > 0 ? Math.min(100, Math.max(nightShifts, 0) / shiftsWeek * 100) : 0; const exposed = shared.workforce * clamp(roleShare) / 100;
  return <Frame spec={spec} formula={<>Weekly scheduled hours = shift length × shifts/week. Night share = night shifts ÷ total shifts. No impairment or fatigue probability is inferred.</>} sources={<>Entered schedule facts only.</>} results={shiftHours > 0 && shiftsWeek > 0 ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Weekly scheduled hours" value={number(weekly, 1)} note={`${shiftHours}h × ${shiftsWeek} shifts`} icon={Clock3} /><MetricOrb label="Night-work share" value={`${number(nightShare, 1)}%`} note={`${nightShifts} entered night shifts / week`} icon={BrainCircuit} tone="violet" /><MetricOrb label="Consecutive days" value={number(consecutiveDays, 0)} note="Entered schedule fact" icon={CalendarClock} tone="amber" /><MetricOrb label="Workers on schedule" value={shared.workforce > 0 ? number(exposed, 0) : "—"} note={`${roleShare}% of shared workforce`} icon={Users} tone="rose" /></section> : <Waiting text="Enter schedule facts. Results describe exposure intensity only and do not estimate fatigue impairment." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Hours per shift" value={shiftHours} onChange={setShiftHours} step={0.5} /><NumberField label="Shifts per week" value={shiftsWeek} onChange={setShiftsWeek} /><NumberField label="Night shifts per week" value={nightShifts} onChange={setNightShifts} /><NumberField label="Consecutive workdays" value={consecutiveDays} onChange={setConsecutiveDays} /><NumberField label="Share of workforce on schedule" value={roleShare} onChange={setRoleShare} suffix="%" /></div></Frame>;
}

export default function OccupationalCalculatorsV2() {
  const { context } = useEmployerWorkflow();
  const [activeId, setActiveId] = useState<CalculatorId>("rates");
  const [category, setCategory] = useState<CategoryId>("safety");
  const [employer, setEmployer] = useState((context.legalName || context.employer || "").trim());
  const [workforce, setWorkforce] = useState(0);
  const [annualHours, setAnnualHours] = useState(0);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);

  useEffect(() => { const selected = (context.legalName || context.employer || "").trim(); if (selected) setEmployer(selected); }, [context.legalName, context.employer]);
  useEffect(() => { void fetch("/api/occupational-discovery/bls-overview").then((response) => response.json()).then((payload) => { if (payload.ok) setOverview(payload); }).catch(() => undefined); }, []);

  const shared = useMemo<SharedContext>(() => ({ employer, workforce, annualHours, sector }), [employer, workforce, annualHours, sector]);
  const active = tools.find((item) => item.id === activeId) || tools[0];
  const categoryTools = tools.filter((tool) => tool.category === category);

  function resetShared() { setEmployer((context.legalName || context.employer || "").trim()); setWorkforce(0); setAnnualHours(0); setSector(null); }
  function openTool(tool: ToolSpec) { setCategory(tool.category); setActiveId(tool.id); }

  return <OccupationalToolShell eyebrow="Independent Intelligence Tool · Calculator Workstation" title="Occupational Calculators" subtitle="Eleven independent calculators organized by business question, with shared employer/workforce context and evidence type shown before you open a tool." notice="These calculators combine straightforward arithmetic, official BLS/O*NET context, operational inputs, and explicit user assumptions. They are decision-support scenarios, not medical diagnoses, legal conclusions, workers’ compensation benefit determinations, or individual fitness-for-duty decisions.">
    <ToolHero kicker="Calculator workstation" title="Pick the question first. See the evidence type before opening it." description="Safety rates, workers’ comp and cost, workforce health, readiness, and job/exposure calculators each keep their own inputs and results. Only employer, workforce, annual hours, and selected industry are shared." accent="violet">
      <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-cyan-200/12 bg-cyan-300/[0.04] p-3"><p className="text-[9px] text-cyan-50/42">Calculators</p><p className="mt-1 text-2xl font-black">{tools.length}</p></div><div className="rounded-xl border border-violet-200/12 bg-violet-300/[0.04] p-3"><p className="text-[9px] text-cyan-50/42">Categories</p><p className="mt-1 text-2xl font-black">{categories.length}</p></div></div>
    </ToolHero>

    <GlassCard className="mb-5 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-50/42">Shared context</p><h2 className="mt-1 text-lg font-black">Enter once; reuse only where mathematically relevant</h2></div><button type="button" onClick={resetShared} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[10px] font-black text-cyan-50/62"><RotateCcw size={13} />Reset shared context</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">Employer / organization</span><input value={employer} onChange={(event) => setEmployer(event.target.value)} placeholder="Optional" className="mt-2 min-h-11 w-full rounded-xl border border-cyan-100/16 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /></label><NumberField label="Workforce size" value={workforce} onChange={setWorkforce} step={10} suffix="workers" /><NumberField label="Annual hours worked" value={annualHours} onChange={setAnnualHours} step={1000} suffix="hours" /><label><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50/55">BLS industry benchmark</span><select value={sector?.id || ""} onChange={(event) => setSector(overview?.sectors?.find((item) => item.id === event.target.value) || null)} className="mt-2 min-h-11 w-full rounded-xl border border-cyan-100/16 bg-[#040c16]/92 px-3 text-sm text-white outline-none"><option value="">None selected</option>{(overview?.sectors || []).map((item) => <option key={item.id} value={item.id}>{item.label} · {item.naics}</option>)}</select></label></div></GlassCard>

    <GlassCard className="mb-5 p-4"><div className="flex flex-wrap gap-2">{categories.map((item) => <button key={item.id} type="button" onClick={() => { setCategory(item.id); const first = tools.find((tool) => tool.category === item.id); if (first) setActiveId(first.id); }} className={`rounded-full border px-3 py-2 text-[10px] font-black transition ${category === item.id ? "border-cyan-200/28 bg-cyan-300/[0.09] text-white" : "border-white/10 text-cyan-50/48"}`}>{item.label}</button>)}</div><p className="mt-3 text-[10px] leading-5 text-cyan-50/42">{categories.find((item) => item.id === category)?.description}</p></GlassCard>

    <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{categoryTools.map((tool) => <button key={tool.id} type="button" onClick={() => openTool(tool)} className={`rounded-[22px] border p-4 text-left transition ${activeId === tool.id ? "border-cyan-200/28 bg-cyan-300/[0.075] shadow-[0_18px_55px_rgba(0,0,0,.25)]" : "border-white/10 bg-[#071321]/66 hover:border-cyan-200/18"}`}><div className="flex items-start justify-between gap-3"><div><EvidencePills values={tool.evidence} /><p className="mt-3 text-sm font-black text-white">{tool.label}</p><p className="mt-1 text-[10px] leading-5 text-cyan-50/45">{tool.why}</p></div><tool.icon size={18} className="shrink-0 text-cyan-200/52" /></div></button>)}</section>

    <AnimatePresence mode="wait">
      <div key={active.id}>
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
    </AnimatePresence>
  </OccupationalToolShell>;
}
