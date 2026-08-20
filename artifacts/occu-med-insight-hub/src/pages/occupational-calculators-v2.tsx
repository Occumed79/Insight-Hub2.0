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

type CalculatorId = "rates" | "workers-comp" | "lost-time" | "return-to-work" | "health-burden" | "readiness" | "job-demands" | "fatigue" | "break-even";
type CategoryId = "safety" | "cost" | "health" | "readiness" | "job";
type EvidenceKind = "arithmetic" | "official" | "assumption" | "onet" | "operational";
type Sector = { id: string; naics: string; label: string; description: string; benchmark: BlsBenchmark | null };
type SharedContext = { employer: string; workforce: number; annualHours: number; sector: Sector | null };
type ToolSpec = { id: CalculatorId; category: CategoryId; label: string; note: string; evidence: EvidenceKind[]; icon: typeof Activity };

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
  { id: "safety", label: "Safety Rates", description: "OSHA arithmetic with official BLS context." },
  { id: "cost", label: "Workers’ Comp & Cost", description: "Transparent cost, lost-time, RTW, and break-even scenarios." },
  { id: "health", label: "Workforce Health", description: "Planning scenarios using explicitly entered prevalence assumptions." },
  { id: "readiness", label: "Readiness", description: "Operational coverage and deployment-readiness counts." },
  { id: "job", label: "Job & Exposure", description: "O*NET evidence and schedule/exposure facts." },
];

const tools: ToolSpec[] = [
  { id: "rates", category: "safety", label: "TRIR & DART", note: "Observed arithmetic + BLS", evidence: ["arithmetic", "official"], icon: CircleGauge },
  { id: "workers-comp", category: "cost", label: "Workers’ Comp Cost", note: "Entered cost scenario", evidence: ["arithmetic", "assumption"], icon: BadgeDollarSign },
  { id: "lost-time", category: "cost", label: "Lost Time", note: "Capacity arithmetic", evidence: ["arithmetic", "assumption"], icon: Clock3 },
  { id: "return-to-work", category: "cost", label: "Return to Work", note: "Modified-duty scenario", evidence: ["arithmetic", "assumption"], icon: RotateCcw },
  { id: "break-even", category: "cost", label: "Intervention Break-Even", note: "Sensitivity arithmetic", evidence: ["arithmetic", "assumption"], icon: TrendingUp },
  { id: "health-burden", category: "health", label: "Workforce Health Burden", note: "Prevalence planning", evidence: ["assumption", "operational"], icon: HeartPulse },
  { id: "readiness", category: "readiness", label: "Deployment Readiness", note: "Observable operational counts", evidence: ["operational"], icon: Users },
  { id: "job-demands", category: "job", label: "Condition × Job Demands", note: "Live O*NET evidence", evidence: ["onet", "operational"], icon: ShieldAlert },
  { id: "fatigue", category: "job", label: "Shift & Fatigue Exposure", note: "Schedule facts, no impairment score", evidence: ["arithmetic", "operational"], icon: BrainCircuit },
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

function Frame({ spec, children, results }: { spec: ToolSpec; children: ReactNode; results: ReactNode }) {
  return <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="grid gap-5 2xl:grid-cols-[.72fr_1.28fr]"><GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><EvidencePills values={spec.evidence} /><h2 className="mt-3 text-2xl font-black tracking-tight text-white">{spec.label}</h2><p className="mt-2 text-xs leading-6 text-cyan-50/55">{spec.note}</p></div><spec.icon size={22} className="text-cyan-200/55" /></div><div className="mt-5 space-y-4">{children}</div></GlassCard><div className="space-y-5">{results}</div></motion.section>;
}

function Waiting({ text }: { text: string }) { return <GlassCard className="p-8 text-center"><Sparkles className="mx-auto h-8 w-8 text-cyan-200/40" /><p className="mt-3 font-black text-white">Waiting for inputs</p><p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-50/50">{text}</p></GlassCard>; }

function Rates({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "rates")!;
  const [recordables, setRecordables] = useState(0); const [dartCases, setDartCases] = useState(0); const [awayCases, setAwayCases] = useState(0);
  const hours = shared.annualHours;
  const trir = calculateIncidentRate(recordables, hours); const dart = calculateIncidentRate(dartCases, hours); const away = calculateIncidentRate(awayCases, hours);
  const benchmark = shared.sector?.benchmark || null;
  const expected = expectedCasesFromHours(benchmark?.trcRate, hours); const gap = benchmark?.trcRate != null && hours > 0 ? trir - benchmark.trcRate : null;
  return <Frame spec={spec} results={hours > 0 ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="TRIR" value={number(trir, 2)} note="Observed recordables × 200,000 ÷ shared hours" icon={CircleGauge} /><MetricOrb label="DART" value={number(dart, 2)} note="Observed DART cases × 200,000 ÷ shared hours" icon={CalendarClock} tone="violet" /><MetricOrb label="BLS TRC" value={benchmark?.trcRate != null ? number(benchmark.trcRate, 2) : "—"} note={shared.sector?.label || "Choose industry in shared context"} icon={Activity} tone="emerald" /><MetricOrb label="Rate gap" value={gap == null ? "—" : `${gap >= 0 ? "+" : ""}${number(gap, 2)}`} note={benchmark ? `${number(expected, 1)} benchmark-implied cases` : "No official benchmark selected"} icon={TrendingUp} tone={gap != null && gap > 0 ? "rose" : "emerald"} /></section> : <Waiting text="Enter annual hours once in the shared context. That same hours value carries into the tools that use it." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Recordable cases" value={recordables} onChange={setRecordables} /><NumberField label="DART cases" value={dartCases} onChange={setDartCases} /><NumberField label="Days-away cases" value={awayCases} onChange={setAwayCases} /></div>{hours > 0 ? <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-[10px] leading-5 text-cyan-50/48">Shared hours: {hours.toLocaleString()} · Days-away rate: {number(away, 2)}. Workforce size is intentionally not substituted for hours.</div> : null}</Frame>;
}

function WorkersComp({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "workers-comp")!;
  const [claims, setClaims] = useState(0); const [medical, setMedical] = useState(0); const [lostDays, setLostDays] = useState(0); const [daily, setDaily] = useState(0); const [admin, setAdmin] = useState(0); const [indirect, setIndirect] = useState(0);
  const result = calculateWorkersCompCost({ claims, medicalCostPerClaim: medical, lostDaysPerClaim: lostDays, dailyCompensationCost: daily, administrativePercent: admin, indirectMultiplier: indirect });
  const ready = claims > 0 && (medical > 0 || (lostDays > 0 && daily > 0));
  return <Frame spec={spec} results={ready ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Scenario total" value={money(result.total)} note={`${claims} entered claims`} icon={BadgeDollarSign} tone="violet" /><MetricOrb label="Medical" value={money(result.medical)} note="Entered medical assumption" icon={BriefcaseMedical} /><MetricOrb label="Wage replacement" value={money(result.wageReplacement)} note="Entered lost days × daily cost" icon={CalendarClock} tone="rose" /><MetricOrb label="Per worker" value={shared.workforce > 0 ? money(result.total / shared.workforce) : "—"} note={shared.workforce > 0 ? `Across shared workforce of ${shared.workforce.toLocaleString()}` : "Add workforce in shared context"} icon={Users} tone="amber" /></section> : <Waiting text="Enter claims and cost assumptions. These are scenario inputs, not jurisdictional claim estimates." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Claims" value={claims} onChange={setClaims} /><NumberField label="Medical cost / claim" value={medical} onChange={setMedical} step={1000} suffix="USD" /><NumberField label="Lost days / claim" value={lostDays} onChange={setLostDays} /><NumberField label="Daily compensation cost" value={daily} onChange={setDaily} suffix="USD" /><NumberField label="Administrative load" value={admin} onChange={setAdmin} suffix="%" /><NumberField label="Indirect multiplier" value={indirect} onChange={setIndirect} step={0.1} suffix="×" /></div></Frame>;
}

function LostTime({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "lost-time")!;
  const [cases, setCases] = useState(0); const [awayDays, setAwayDays] = useState(0); const [restrictedDays, setRestrictedDays] = useState(0); const [loss, setLoss] = useState(0); const [hourly, setHourly] = useState(0); const [overtime, setOvertime] = useState(0);
  const result = calculateLostTime({ cases, daysAway: awayDays, restrictedDays, restrictedProductivityLossPercent: loss, hourlyCompensation: hourly, overtimePercent: overtime });
  const ready = cases > 0 && (awayDays > 0 || restrictedDays > 0);
  return <Frame spec={spec} results={ready ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Away hours" value={number(result.awayHours, 0)} note="8 hours per entered day" icon={Clock3} /><MetricOrb label="Productive hours lost" value={number(result.productiveHoursLost, 0)} note="Away + entered restricted-duty loss" icon={Activity} tone="rose" /><MetricOrb label="Capacity cost" value={hourly > 0 ? money(result.total) : "—"} note="Entered compensation basis" icon={BadgeDollarSign} tone="amber" /><MetricOrb label="Workforce-hour share" value={shared.annualHours > 0 ? `${number(result.productiveHoursLost / shared.annualHours * 100, 3)}%` : "—"} note="Uses shared annual hours" icon={Users} tone="violet" /></section> : <Waiting text="Enter case/day facts. Shared annual hours are used only for the optional workforce-hour share." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Cases" value={cases} onChange={setCases} /><NumberField label="Days away / case" value={awayDays} onChange={setAwayDays} /><NumberField label="Restricted days / case" value={restrictedDays} onChange={setRestrictedDays} /><NumberField label="Restricted productivity loss" value={loss} onChange={setLoss} suffix="%" /><NumberField label="Hourly compensation" value={hourly} onChange={setHourly} suffix="USD" /><NumberField label="Overtime premium" value={overtime} onChange={setOvertime} suffix="%" /></div></Frame>;
}

function ReturnToWork({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "return-to-work")!;
  const [workers, setWorkers] = useState(0); const [fullDays, setFullDays] = useState(0); const [modifiedDays, setModifiedDays] = useState(0); const [daily, setDaily] = useState(0); const [productivity, setProductivity] = useState(0);
  const result = calculateReturnToWork({ workers, fullDutyDays: fullDays, modifiedDutyDays: modifiedDays, dailyCompensationCost: daily, modifiedProductivityPercent: productivity });
  return <Frame spec={spec} results={workers > 0 ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Without modified duty" value={daily > 0 ? money(result.withoutModifiedDuty) : "—"} note="Entered full-duty absence scenario" icon={Clock3} /><MetricOrb label="With modified duty" value={daily > 0 ? money(result.withModifiedDuty) : "—"} note="Entered modified-duty scenario" icon={RotateCcw} tone="emerald" /><MetricOrb label="Potential difference" value={daily > 0 ? money(result.potentialDifference) : "—"} note="Arithmetic difference only" icon={TrendingUp} tone="violet" /><MetricOrb label="Workers modeled" value={workers.toLocaleString()} note={shared.workforce > 0 ? `${number(workers / shared.workforce * 100, 1)}% of shared workforce` : "No shared workforce entered"} icon={Users} tone="amber" /></section> : <Waiting text="Enter workers and RTW scenario assumptions. This tool does not infer medical eligibility for modified duty." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Workers" value={workers} onChange={setWorkers} /><NumberField label="Full-duty absence days" value={fullDays} onChange={setFullDays} /><NumberField label="Modified-duty days" value={modifiedDays} onChange={setModifiedDays} /><NumberField label="Daily compensation cost" value={daily} onChange={setDaily} suffix="USD" /><RangeField label="Modified-duty productivity" value={productivity} onChange={setProductivity} /></div></Frame>;
}

function BreakEven({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "break-even")!;
  const [programCost, setProgramCost] = useState(0); const [costPerEvent, setCostPerEvent] = useState(0); const [effectiveness, setEffectiveness] = useState(0); const [baseline, setBaseline] = useState(0);
  const population = shared.workforce;
  const result = calculateBreakEven({ programCost, costPerEvent, effectivenessPercent: effectiveness, population, baselineEventsPerHundred: baseline });
  const ready = population > 0 && baseline > 0 && costPerEvent > 0;
  return <Frame spec={spec} results={ready ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Baseline-implied events" value={number(result.expectedEvents, 1)} note={`Uses shared workforce of ${population.toLocaleString()}`} icon={Activity} /><MetricOrb label="Modeled avoided events" value={number(result.avoidedEvents, 1)} note={`${effectiveness}% entered effectiveness`} icon={ShieldAlert} tone="emerald" /><MetricOrb label="Modeled benefit" value={money(result.potentialBenefit)} note="Avoided events × entered event cost" icon={BadgeDollarSign} tone="violet" /><MetricOrb label="Net arithmetic" value={money(result.netImpact)} note="Modeled benefit − program cost" icon={TrendingUp} tone={result.netImpact >= 0 ? "emerald" : "rose"} /></section> : <Waiting text="Enter workforce once in shared context, then baseline event rate and financial assumptions here." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Program cost" value={programCost} onChange={setProgramCost} suffix="USD" /><NumberField label="Cost per event" value={costPerEvent} onChange={setCostPerEvent} suffix="USD" /><NumberField label="Baseline events / 100 workers" value={baseline} onChange={setBaseline} step={0.1} /><RangeField label="Assumed effectiveness" value={effectiveness} onChange={setEffectiveness} /></div></Frame>;
}

function HealthBurden({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "health-burden")!;
  const [msk, setMsk] = useState(0); const [cardio, setCardio] = useState(0); const [metabolic, setMetabolic] = useState(0); const [respiratory, setRespiratory] = useState(0);
  const population = shared.workforce;
  const rows = [
    { label: "Musculoskeletal", pct: msk }, { label: "Cardiometabolic", pct: cardio }, { label: "Metabolic / diabetes", pct: metabolic }, { label: "Respiratory", pct: respiratory },
  ].map((item) => ({ ...item, people: population * Math.max(item.pct, 0) / 100 }));
  const sum = rows.reduce((total, item) => total + item.people, 0);
  return <Frame spec={spec} results={population > 0 ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{rows.map((item) => <MetricOrb key={item.label} label={item.label} value={item.pct > 0 ? number(item.people, 0) : "—"} note={`${item.pct}% entered prevalence assumption`} icon={HeartPulse} tone="rose" />)}</section><GlassCard className="p-4 text-[10px] leading-5 text-cyan-50/48">The category counts may overlap. The {number(sum, 0)} summed count is deliberately not presented as “unique affected workers” because comorbidity is unknown.</GlassCard></> : <Waiting text="Enter workforce once in the shared context, then prevalence assumptions for planning. No condition prevalence is inferred by the app." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Musculoskeletal prevalence" value={msk} onChange={setMsk} suffix="%" /><NumberField label="Cardiometabolic prevalence" value={cardio} onChange={setCardio} suffix="%" /><NumberField label="Metabolic / diabetes prevalence" value={metabolic} onChange={setMetabolic} suffix="%" /><NumberField label="Respiratory prevalence" value={respiratory} onChange={setRespiratory} suffix="%" /></div></Frame>;
}

function Readiness({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "readiness")!;
  const workforce = shared.workforce;
  const [allReady, setAllReady] = useState(0); const [exams, setExams] = useState(0); const [surveillance, setSurveillance] = useState(0); const [respirator, setRespirator] = useState(0); const [audiograms, setAudiograms] = useState(0); const [fitTests, setFitTests] = useState(0); const [pending, setPending] = useState(0);
  const coverage = [{ label: "Medical exams", value: exams }, { label: "Surveillance", value: surveillance }, { label: "Respirator clearance", value: respirator }, { label: "Audiograms", value: audiograms }, { label: "Fit tests", value: fitTests }].map((item) => ({ ...item, pct: workforce > 0 ? Math.min(100, item.value / workforce * 100) : 0 }));
  const bottleneck = [...coverage].filter((item) => item.value > 0).sort((a, b) => a.pct - b.pct)[0];
  return <Frame spec={spec} results={workforce > 0 ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Shared workforce" value={workforce.toLocaleString()} note={shared.employer || "Employer not selected"} icon={Users} /><MetricOrb label="Meeting all requirements" value={allReady.toLocaleString()} note={`${number(allReady / workforce * 100, 1)}% entered ready count`} icon={Activity} tone="emerald" /><MetricOrb label="Pending review" value={pending.toLocaleString()} note="Entered operational queue" icon={Clock3} tone="amber" /><MetricOrb label="Lowest coverage" value={bottleneck ? `${number(bottleneck.pct, 1)}%` : "—"} note={bottleneck?.label || "Enter component counts"} icon={ShieldAlert} tone="violet" /></section><GlassCard className="p-5"><div className="space-y-3">{coverage.map((item) => <div key={item.label}><div className="flex justify-between text-xs"><span className="text-cyan-50/62">{item.label}</span><strong>{number(item.pct, 1)}%</strong></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-cyan-300/60" style={{ width: `${item.pct}%` }} /></div></div>)}</div></GlassCard></> : <Waiting text="Enter workforce once in shared context. Then enter current operational counts here; the tool does not derive deployability from unrelated queues." />}><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Meeting all requirements" value={allReady} onChange={setAllReady} /><NumberField label="Medical exams current" value={exams} onChange={setExams} /><NumberField label="Surveillance current" value={surveillance} onChange={setSurveillance} /><NumberField label="Respirator clearances current" value={respirator} onChange={setRespirator} /><NumberField label="Audiograms current" value={audiograms} onChange={setAudiograms} /><NumberField label="Fit tests current" value={fitTests} onChange={setFitTests} /><NumberField label="Pending medical review" value={pending} onChange={setPending} /></div></Frame>;
}

function JobDemands({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "job-demands")!;
  const [query, setQuery] = useState(""); const [payload, setPayload] = useState<OnetPayload | null>(null); const [loading, setLoading] = useState(false); const [condition, setCondition] = useState("");
  async function run() { if (!query.trim()) return; setLoading(true); try { const response = await fetch(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(query.trim())}`); const body = await response.json(); setPayload(body); } finally { setLoading(false); } }
  const evidence = useMemo(() => payload?.profile ? [...(payload.profile.tasks || []), ...(payload.profile.workContext || []), ...(payload.profile.abilities || []), ...(payload.profile.workActivities || []), ...(payload.profile.detailedWorkActivities || [])] : [], [payload]);
  const terms = condition.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 4);
  const ranked = useMemo(() => evidence.map((item) => ({ ...item, score: terms.reduce((sum, term) => `${item.name} ${item.description || ""}`.toLowerCase().includes(term) ? sum + 1 : sum, 0) })).sort((a, b) => b.score - a.score || (b.value || 0) - (a.value || 0)).slice(0, 16), [evidence, condition]);
  return <Frame spec={spec} results={payload?.profile ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Occupation" value={payload.profile.occupation?.title || "Unresolved"} note={payload.profile.occupation?.code || "No code"} icon={Users} /><MetricOrb label="O*NET evidence items" value={evidence.length.toLocaleString()} note="Tasks, context, abilities, activities" icon={Search} tone="violet" /><MetricOrb label="Candidate matches" value={(payload.matches?.length || 0).toLocaleString()} note="Ambiguity remains visible" icon={ShieldAlert} tone="amber" /><MetricOrb label="Employer" value={shared.employer || "—"} note="Shared context only; not sent to O*NET" icon={Activity} tone="emerald" /></section><GlassCard className="p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-50/55">Ranked demand evidence</p><p className="mt-1 text-xs text-cyan-50/45">Condition keywords only re-rank source evidence; they do not establish aggravation, causation, restriction, or medical risk.</p></div></div><div className="mt-4 grid gap-2 md:grid-cols-2">{ranked.map((item, index) => <div key={`${item.name}-${index}`} className="rounded-xl border border-white/9 bg-black/15 p-3"><div className="flex items-start justify-between gap-3"><p className="text-xs font-black">{item.name}</p><span className="text-[9px] text-violet-100/55">match {item.score}</span></div>{item.description ? <p className="mt-1 text-[10px] leading-5 text-cyan-50/43">{item.description}</p> : null}</div>)}</div></GlassCard></> : <Waiting text="Search an occupation. This calculator now treats Job Intelligence as the canonical place for selecting a final occupation and building essential functions." />}><label><span className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-50/55">Occupation</span><div className="mt-2 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} placeholder="e.g. aircraft mechanic" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /><button type="button" onClick={() => void run()} disabled={loading || !query.trim()} className="min-h-11 rounded-xl border border-violet-200/20 bg-violet-300/[0.08] px-4 text-xs font-black">{loading ? <Loader2 size={14} className="animate-spin" /> : "Load"}</button></div></label><label><span className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-50/55">Condition / concern keywords optional</span><input value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="e.g. shoulder lifting overhead" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /></label>{payload?.matches && payload.matches.length > 1 ? <div className="rounded-xl border border-amber-200/14 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-50/60">O*NET returned {payload.matches.length} candidate occupations. This mini-tool does not hide that ambiguity; use Job Intelligence to resolve the candidate and build the saved essential-functions profile.</div> : null}</Frame>;
}

function parseTime(value: string): number | null { const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim()); if (!match) return null; const hour = Number(match[1]); const minute = Number(match[2]); if (hour > 23 || minute > 59) return null; return hour * 60 + minute; }
function durationHours(start: string, end: string): number { const a = parseTime(start); const b = parseTime(end); if (a == null || b == null) return 0; let diff = b - a; if (diff <= 0) diff += 1440; return diff / 60; }
function nightHours(start: string, end: string): number { const a = parseTime(start); if (a == null || parseTime(end) == null) return 0; const duration = durationHours(start, end) * 60; let total = 0; for (let minute = 0; minute < duration; minute += 15) { const clock = (a + minute) % 1440; if (clock >= 1320 || clock < 360) total += Math.min(15, duration - minute); } return total / 60; }

function Fatigue({ shared }: { shared: SharedContext }) {
  const spec = tools.find((item) => item.id === "fatigue")!;
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [nextStart, setNextStart] = useState(""); const [commute, setCommute] = useState(0); const [breaks, setBreaks] = useState(0); const [consecutive, setConsecutive] = useState(0); const [weekly, setWeekly] = useState(0);
  const shift = durationHours(start, end); const night = nightHours(start, end); const endM = parseTime(end); const nextM = parseTime(nextStart); let interval = 0; if (endM != null && nextM != null) { let diff = nextM - endM; if (diff <= 0) diff += 1440; interval = diff / 60; } const nonCommute = Math.max(interval - commute * 2, 0); const net = Math.max(shift - breaks / 60, 0);
  return <Frame spec={spec} results={shift > 0 || weekly > 0 ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricOrb label="Shift duration" value={shift ? `${number(shift, 1)} hr` : "—"} note={`${breaks} entered break minutes`} icon={Clock3} /><MetricOrb label="Net work time" value={shift ? `${number(net, 1)} hr` : "—"} note="Shift minus entered breaks" icon={Activity} tone="violet" /><MetricOrb label="Night overlap" value={shift ? `${number(night, 1)} hr` : "—"} note="22:00–06:00 clock overlap" icon={BrainCircuit} tone="amber" /><MetricOrb label="Non-commute interval" value={interval ? `${number(nonCommute, 1)} hr` : "—"} note="Between shifts after entered commute" icon={CalendarClock} tone="emerald" /></section> : <Waiting text="Enter actual schedule facts. The tool reports exposure facts and never generates an impairment or safety score." />}><div className="grid gap-4 sm:grid-cols-2"><label><span className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-50/55">Shift start</span><input value={start} onChange={(event) => setStart(event.target.value)} placeholder="18:00" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /></label><label><span className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-50/55">Shift end</span><input value={end} onChange={(event) => setEnd(event.target.value)} placeholder="06:00" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /></label><label><span className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-50/55">Next shift start</span><input value={nextStart} onChange={(event) => setNextStart(event.target.value)} placeholder="18:00" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" /></label><NumberField label="Commute each way" value={commute} onChange={setCommute} step={0.25} suffix="hours" /><NumberField label="Break time" value={breaks} onChange={setBreaks} step={15} suffix="minutes" /><NumberField label="Consecutive shifts" value={consecutive} onChange={setConsecutive} /><NumberField label="Weekly hours" value={weekly} onChange={setWeekly} max={168} /></div>{shared.employer ? <p className="text-[10px] text-cyan-50/42">Shared employer: {shared.employer}. Schedule facts remain user-entered and are not inferred from the employer.</p> : null}</Frame>;
}

function ActiveTool({ id, shared }: { id: CalculatorId; shared: SharedContext }) {
  if (id === "rates") return <Rates shared={shared} />;
  if (id === "workers-comp") return <WorkersComp shared={shared} />;
  if (id === "lost-time") return <LostTime shared={shared} />;
  if (id === "return-to-work") return <ReturnToWork shared={shared} />;
  if (id === "break-even") return <BreakEven shared={shared} />;
  if (id === "health-burden") return <HealthBurden shared={shared} />;
  if (id === "readiness") return <Readiness shared={shared} />;
  if (id === "job-demands") return <JobDemands shared={shared} />;
  return <Fatigue shared={shared} />;
}

export default function OccupationalCalculatorsV2() {
  const { context } = useEmployerWorkflow();
  const employer = (context.legalName || context.employer || "").trim();
  const [activeCategory, setActiveCategory] = useState<CategoryId>("safety");
  const [active, setActive] = useState<CalculatorId>("rates");
  const [workforce, setWorkforce] = useState(0);
  const [annualHours, setAnnualHours] = useState(0);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedNaics, setSelectedNaics] = useState(context.naics || "");

  useEffect(() => {
    void fetch("/api/occupational-discovery/bls-overview").then((response) => response.json()).then((payload) => { if (payload.ok) setSectors(payload.sectors || []); }).catch(() => undefined);
  }, []);
  useEffect(() => { if (context.naics) setSelectedNaics(context.naics); }, [context.naics]);
  const sector = sectors.find((item) => item.naics === selectedNaics) || null;
  const shared: SharedContext = { employer, workforce, annualHours, sector };

  function chooseCategory(id: CategoryId) {
    setActiveCategory(id);
    const first = tools.find((tool) => tool.category === id);
    if (first) setActive(first.id);
  }

  return <OccupationalToolShell eyebrow="Independent Intelligence Tool · Calculator Suite" title="Occupational Calculators" subtitle="Nine tools organized by purpose and evidence quality, with one shared employer/workforce context that carries between calculators instead of forcing repeated entry." notice="The shared context carries only employer name, workforce size, annual hours, and selected industry within this suite. Each calculator still distinguishes source data, operational facts, assumptions, and arithmetic. No calculator declares compensability, disability, medical causation, fatigue impairment, or fitness for duty.">
    <ToolHero kicker="Calculator catalog" title="Choose the question first — then the calculator." description="The suite is grouped into Safety Rates, Workers’ Comp & Cost, Workforce Health, Readiness, and Job & Exposure. Evidence labels appear before you enter the tool so arithmetic, official benchmarks, assumptions, O*NET evidence, and operational inputs cannot look equivalent." accent="rose">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{categories.map((category) => <button key={category.id} type="button" onClick={() => chooseCategory(category.id)} className={`rounded-xl border p-3 text-left transition ${activeCategory === category.id ? "border-rose-200/26 bg-rose-300/[0.08]" : "border-white/10 bg-black/15"}`}><p className="text-[10px] font-black text-white">{category.label}</p><p className="mt-1 text-[8px] leading-4 text-cyan-50/42">{tools.filter((tool) => tool.category === category.id).length} tools</p></button>)}</div>
    </ToolHero>

    <GlassCard className="mb-5 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-50/48">Shared employer / workforce context</p><h2 className="mt-1 text-lg font-black text-white">Enter once, reuse where mathematically relevant</h2><p className="mt-1 text-xs text-cyan-50/45">{employer ? `Entity context: ${employer}` : "No employer selected. Calculator math still works independently."}</p></div><Users size={18} className="text-cyan-200/55" /></div><div className="mt-4 grid gap-4 md:grid-cols-3"><NumberField label="Workforce size" value={workforce} onChange={setWorkforce} suffix="workers" /><NumberField label="Annual hours worked" value={annualHours} onChange={setAnnualHours} step={10_000} suffix="hours" /><label><span className="text-[10px] font-bold uppercase tracking-[.14em] text-cyan-50/60">Industry benchmark</span><select value={selectedNaics} onChange={(event) => setSelectedNaics(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-cyan-100/18 bg-[#040c16]/92 px-3 text-sm text-white outline-none"><option value="">None selected</option>{sectors.map((item) => <option key={item.id} value={item.naics}>{item.label} · NAICS {item.naics}</option>)}</select></label></div></GlassCard>

    <div className="mb-3 flex gap-2 overflow-x-auto">{categories.map((category) => <button key={category.id} type="button" onClick={() => chooseCategory(category.id)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black ${activeCategory === category.id ? "border-cyan-200/28 bg-cyan-300/[0.09] text-white" : "border-white/10 text-cyan-50/45"}`}>{category.label}</button>)}</div>
    <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{tools.filter((tool) => tool.category === activeCategory).map((tool) => { const Icon = tool.icon; return <button key={tool.id} type="button" onClick={() => setActive(tool.id)} className={`rounded-2xl border p-4 text-left transition ${active === tool.id ? "border-cyan-200/28 bg-cyan-300/[0.08]" : "border-white/10 bg-[#06101d]/76 hover:border-white/18"}`}><div className="flex items-center gap-2"><Icon size={16} className="text-cyan-200/60" /><span className="text-xs font-black text-white">{tool.label}</span></div><p className="mt-1 text-[9px] leading-4 text-cyan-50/43">{tool.note}</p><div className="mt-3"><EvidencePills values={tool.evidence} /></div></button>; })}</div>

    <AnimatePresence mode="wait"><motion.div key={active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ActiveTool id={active} shared={shared} /></motion.div></AnimatePresence>
  </OccupationalToolShell>;
}
