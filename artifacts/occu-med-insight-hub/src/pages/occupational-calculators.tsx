import { useState, type ReactNode } from "react";
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
  RotateCcw,
  ShieldAlert,
  Sparkles,
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
  RangeField,
  ToolHero,
} from "@/components/insight/OccupationalToolPrimitives";
import {
  calculateBreakEven,
  calculateIncidentRate,
  calculateLostTime,
  calculateReturnToWork,
  calculateWorkersCompCost,
} from "@/data/occupationalCalculations";

type CalculatorId =
  | "rates"
  | "workers-comp"
  | "lost-time"
  | "return-to-work"
  | "aggravation"
  | "chronic-aging"
  | "readiness"
  | "fatigue"
  | "break-even";

const calculatorOptions: Array<{
  id: CalculatorId;
  label: string;
  note: string;
  icon: typeof Activity;
  tone: string;
}> = [
  { id: "rates", label: "TRIR & DART", note: "Rate arithmetic", icon: CircleGauge, tone: "cyan" },
  { id: "workers-comp", label: "Workers’ Comp Cost", note: "Entered cost assumptions", icon: BadgeDollarSign, tone: "violet" },
  { id: "lost-time", label: "Lost Time", note: "Capacity arithmetic", icon: Clock3, tone: "rose" },
  { id: "return-to-work", label: "Return to Work", note: "Scenario comparison", icon: RotateCcw, tone: "emerald" },
  { id: "aggravation", label: "Aggravation Review", note: "Condition-demand review builder", icon: ShieldAlert, tone: "amber" },
  { id: "chronic-aging", label: "Age & Chronic Burden", note: "Aggregate entered prevalence", icon: HeartPulse, tone: "rose" },
  { id: "readiness", label: "Readiness Profile", note: "Six entered dimensions", icon: Users, tone: "cyan" },
  { id: "fatigue", label: "Fatigue / Shift Profile", note: "Schedule and exposure inputs", icon: BrainCircuit, tone: "violet" },
  { id: "break-even", label: "Intervention Break-Even", note: "Scenario arithmetic", icon: TrendingUp, tone: "emerald" },
];

const toneClasses: Record<string, string> = {
  cyan: "border-cyan-200/20 bg-cyan-300/[0.07] text-cyan-100",
  violet: "border-violet-200/20 bg-violet-300/[0.07] text-violet-100",
  rose: "border-rose-200/20 bg-rose-300/[0.07] text-rose-100",
  emerald: "border-emerald-200/20 bg-emerald-300/[0.07] text-emerald-100",
  amber: "border-amber-200/20 bg-amber-300/[0.07] text-amber-100",
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function number(value: number, digits = 1): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function CalculatorFrame({
  title,
  description,
  children,
  results,
}: {
  title: string;
  description: string;
  children: ReactNode;
  results: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22 }}
      className="grid gap-5 2xl:grid-cols-[.72fr_1.28fr]"
    >
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Independent scenario tool</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{title}</h2>
            <p className="mt-2 text-xs leading-6 text-cyan-50/64">{description}</p>
          </div>
          <EvidenceGradeBadge grade="D" />
        </div>
        <div className="mt-5 space-y-4">{children}</div>
      </GlassCard>
      <div className="space-y-5">{results}</div>
    </motion.section>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <GlassCard className="p-8 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-cyan-200/40" />
      <p className="mt-3 font-black text-white">Waiting for scenario inputs</p>
      <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-50/55">{text}</p>
    </GlassCard>
  );
}

function RateCalculator() {
  const [recordables, setRecordables] = useState(0);
  const [dartCases, setDartCases] = useState(0);
  const [hours, setHours] = useState(0);
  const [benchmarkTrir, setBenchmarkTrir] = useState(0);
  const [benchmarkDart, setBenchmarkDart] = useState(0);
  const ready = hours > 0;
  const trir = calculateIncidentRate(recordables, hours);
  const dart = calculateIncidentRate(dartCases, hours);
  const casesAtBenchmark = benchmarkTrir > 0 ? (benchmarkTrir * hours) / 200_000 : 0;
  const reductionNeeded = benchmarkTrir > 0 ? Math.max(recordables - casesAtBenchmark, 0) : 0;
  const chartData = [
    benchmarkTrir > 0 && ready ? { metric: "TRIR", scenario: trir, benchmark: benchmarkTrir } : null,
    benchmarkDart > 0 && ready ? { metric: "DART", scenario: dart, benchmark: benchmarkDart } : null,
  ].filter((item): item is { metric: string; scenario: number; benchmark: number } => item !== null);

  return (
    <CalculatorFrame
      title="TRIR & DART Arithmetic"
      description="Calculates incident rates from anonymous case counts and hours. Optional benchmark fields are manual inputs in this calculator and are not source-verified here."
      results={ready ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="TRIR" value={number(trir, 2)} note="Recordables × 200,000 ÷ hours" icon={CircleGauge} />
            <MetricOrb label="DART rate" value={number(dart, 2)} note="DART cases × 200,000 ÷ hours" icon={CalendarClock} tone="violet" />
            <MetricOrb label="Cases at entered TRIR benchmark" value={benchmarkTrir > 0 ? number(casesAtBenchmark, 1) : "—"} note={benchmarkTrir > 0 ? "Manual benchmark arithmetic" : "No benchmark entered"} icon={Activity} tone="emerald" />
            <MetricOrb label="Case difference" value={benchmarkTrir > 0 ? number(reductionNeeded, 1) : "—"} note="Arithmetic difference only" icon={TrendingUp} tone="amber" />
          </section>
          {chartData.length ? (
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Entered benchmark comparison</p>
              <div className="mt-3 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="rgba(165,243,252,.10)" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fill: "rgba(207,250,254,.7)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(207,250,254,.52)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(103,232,249,.2)", borderRadius: 12 }} />
                    <Bar dataKey="scenario" fill="#a78bfa" radius={[7, 7, 2, 2]} />
                    <Bar dataKey="benchmark" fill="#67e8f9" radius={[7, 7, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          ) : null}
        </>
      ) : <Waiting text="Enter hours worked. Zero case counts are allowed once hours are present; no example findings are preloaded." />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Recordable cases" value={recordables} onChange={setRecordables} />
        <NumberField label="DART cases" value={dartCases} onChange={setDartCases} />
        <NumberField label="Hours worked" value={hours} onChange={setHours} step={10_000} />
        <NumberField label="Optional TRIR benchmark" value={benchmarkTrir} onChange={setBenchmarkTrir} step={0.1} />
        <NumberField label="Optional DART benchmark" value={benchmarkDart} onChange={setBenchmarkDart} step={0.1} />
      </div>
      <p className="text-[10px] leading-5 text-cyan-50/50">Formula: cases × 200,000 ÷ hours. Benchmark values are user-entered unless obtained independently from a source such as BLS.</p>
    </CalculatorFrame>
  );
}

function WorkersCompCalculator() {
  const [claims, setClaims] = useState(0);
  const [medical, setMedical] = useState(0);
  const [lostDays, setLostDays] = useState(0);
  const [dailyCost, setDailyCost] = useState(0);
  const [admin, setAdmin] = useState(0);
  const [indirect, setIndirect] = useState(0);
  const ready = claims > 0 && (medical > 0 || (lostDays > 0 && dailyCost > 0));
  const result = calculateWorkersCompCost({
    claims,
    medicalCostPerClaim: medical,
    lostDaysPerClaim: lostDays,
    dailyCompensationCost: dailyCost,
    administrativePercent: admin,
    indirectMultiplier: indirect,
  });
  const data = [
    { name: "Medical", value: result.medical },
    { name: "Wage replacement", value: result.wageReplacement },
    { name: "Administration", value: result.administration },
    { name: "Indirect", value: result.indirect },
  ];

  return (
    <CalculatorFrame
      title="Workers’ Compensation Cost Scenario"
      description="Performs arithmetic on entered claim, medical, wage-replacement, administrative, and indirect-cost assumptions. It does not predict claim severity or substitute for jurisdiction-specific workers’ compensation rules."
      results={ready ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="Scenario total" value={money(result.total)} note={`${claims} entered claims`} icon={BadgeDollarSign} tone="violet" />
            <MetricOrb label="Medical" value={money(result.medical)} note="Claims × entered medical cost" icon={BriefcaseMedical} />
            <MetricOrb label="Wage replacement" value={money(result.wageReplacement)} note="Entered days × entered daily cost" icon={CalendarClock} tone="rose" />
            <MetricOrb label="Indirect" value={money(result.indirect)} note={`${indirect}× entered base`} icon={Sparkles} tone="amber" />
          </section>
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Scenario cost components</p>
            <div className="mt-3 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <CartesianGrid stroke="rgba(165,243,252,.10)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "rgba(207,250,254,.52)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={118} tick={{ fill: "rgba(207,250,254,.7)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "#06101d", border: "1px solid rgba(167,139,250,.2)", borderRadius: 12 }} />
                  <Bar dataKey="value" fill="#a78bfa" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
      ) : <Waiting text="Enter at least one claim and a cost basis. The calculator starts at zero so sample assumptions cannot be confused with claims data." />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Claims" value={claims} onChange={setClaims} />
        <NumberField label="Medical cost per claim" value={medical} onChange={setMedical} step={1_000} suffix="USD" />
        <NumberField label="Lost days per claim" value={lostDays} onChange={setLostDays} />
        <NumberField label="Daily compensation cost" value={dailyCost} onChange={setDailyCost} step={10} suffix="USD" />
        <NumberField label="Administrative load" value={admin} onChange={setAdmin} suffix="%" />
        <NumberField label="Indirect multiplier" value={indirect} onChange={setIndirect} step={0.1} suffix="×" />
      </div>
    </CalculatorFrame>
  );
}

function LostTimeCalculator() {
  const [cases, setCases] = useState(0);
  const [daysAway, setDaysAway] = useState(0);
  const [restrictedDays, setRestrictedDays] = useState(0);
  const [restrictedLoss, setRestrictedLoss] = useState(0);
  const [hourlyCost, setHourlyCost] = useState(0);
  const [overtime, setOvertime] = useState(0);
  const ready = cases > 0 && (daysAway > 0 || restrictedDays > 0);
  const result = calculateLostTime({
    cases,
    daysAway,
    restrictedDays,
    restrictedProductivityLossPercent: restrictedLoss,
    hourlyCompensation: hourlyCost,
    overtimePercent: overtime,
  });

  return (
    <CalculatorFrame
      title="Lost Time & Capacity Scenario"
      description="Converts entered days away and restricted days into hours. Restricted-duty productivity loss is an explicit user input rather than a hidden assumption."
      results={ready ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="Away hours" value={result.awayHours.toLocaleString()} note="8 hours per entered day" icon={Clock3} tone="rose" />
            <MetricOrb label="Restricted hours" value={result.restrictedHours.toLocaleString()} note="Before entered productivity-loss factor" icon={CalendarClock} tone="amber" />
            <MetricOrb label="Modeled productive hours lost" value={number(result.productiveHoursLost, 0)} note={`${restrictedLoss}% restricted-day loss assumption`} icon={Activity} />
            <MetricOrb label="Cost arithmetic" value={hourlyCost > 0 ? money(result.total) : "—"} note={hourlyCost > 0 ? "Entered compensation assumptions" : "No hourly cost entered"} icon={BadgeDollarSign} tone="violet" />
          </section>
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Capacity components</p>
            <div className="mt-4 grid grid-cols-12 gap-2">
              {Array.from({ length: 96 }, (_, index) => {
                const equivalentDays = result.productiveHoursLost / 8;
                return <span key={index} className={`aspect-square rounded-md border ${index < Math.min(Math.ceil(equivalentDays), 96) ? "border-rose-200/24 bg-rose-300/28" : "border-white/7 bg-white/[0.02]"}`} />;
              })}
            </div>
            <p className="mt-3 text-[10px] text-cyan-50/50">Each illuminated cell represents up to one eight-hour equivalent of modeled productive time; display capped at 96 cells.</p>
          </GlassCard>
        </>
      ) : <Waiting text="Enter cases and at least one day category. Restricted-duty loss starts at 0% until you explicitly choose an assumption." />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Cases" value={cases} onChange={setCases} />
        <NumberField label="Days away per case" value={daysAway} onChange={setDaysAway} />
        <NumberField label="Restricted days per case" value={restrictedDays} onChange={setRestrictedDays} />
        <RangeField label="Restricted-day productivity loss" value={restrictedLoss} onChange={setRestrictedLoss} />
        <NumberField label="Hourly compensation" value={hourlyCost} onChange={setHourlyCost} suffix="USD" />
        <NumberField label="Overtime premium" value={overtime} onChange={setOvertime} suffix="%" />
      </div>
    </CalculatorFrame>
  );
}

function ReturnToWorkCalculator() {
  const [workers, setWorkers] = useState(0);
  const [fullDays, setFullDays] = useState(0);
  const [modifiedDays, setModifiedDays] = useState(0);
  const [dailyCost, setDailyCost] = useState(0);
  const [productivity, setProductivity] = useState(0);
  const ready = workers > 0 && fullDays > 0;
  const result = calculateReturnToWork({
    workers,
    fullDutyDays: fullDays,
    modifiedDutyDays: modifiedDays,
    dailyCompensationCost: dailyCost,
    modifiedProductivityPercent: productivity,
  });
  const data = [
    { scenario: "Full absence", amount: result.withoutModifiedDuty },
    { scenario: "Modified duty loss", amount: result.withModifiedDuty },
  ];

  return (
    <CalculatorFrame
      title="Return-to-Work Scenario Comparison"
      description="Compares an entered full-absence scenario with an entered modified-duty duration and productivity percentage. It does not determine restrictions, eligibility, or medical readiness."
      results={ready ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="Full-absence days" value={number(fullDays * workers, 0)} note="Entered workers × days" icon={CalendarClock} tone="rose" />
            <MetricOrb label="Modified-duty days" value={number(modifiedDays * workers, 0)} note={`${productivity}% entered productivity`} icon={RotateCcw} tone="amber" />
            <MetricOrb label="Day difference" value={number(result.daysRecovered, 0)} note="Scenario arithmetic" icon={Activity} tone="emerald" />
            <MetricOrb label="Cost difference" value={dailyCost > 0 ? money(result.potentialDifference) : "—"} note={dailyCost > 0 ? "Entered compensation basis" : "No daily cost entered"} icon={TrendingUp} tone="violet" />
          </section>
          {dailyCost > 0 ? (
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Entered scenario cost comparison</p>
              <div className="mt-3 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid stroke="rgba(165,243,252,.10)" vertical={false} />
                    <XAxis dataKey="scenario" tick={{ fill: "rgba(207,250,254,.68)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(207,250,254,.52)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "#06101d", border: "1px solid rgba(110,231,183,.2)", borderRadius: 12 }} />
                    <Bar dataKey="amount" fill="#6ee7b7" radius={[8, 8, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          ) : null}
        </>
      ) : <Waiting text="Enter workers and a full-absence duration. No modified-duty scenario or cost is assumed until you add it." />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Workers" value={workers} onChange={setWorkers} />
        <NumberField label="Full absence days" value={fullDays} onChange={setFullDays} />
        <NumberField label="Modified-duty days" value={modifiedDays} onChange={setModifiedDays} />
        <NumberField label="Daily compensation cost" value={dailyCost} onChange={setDailyCost} suffix="USD" />
        <RangeField label="Modified-duty productivity" value={productivity} onChange={setProductivity} />
      </div>
    </CalculatorFrame>
  );
}

const reviewConditions = [
  "Musculoskeletal / arthritis",
  "Cardiovascular / hypertension",
  "Respiratory",
  "Hearing",
  "Sleep / fatigue",
  "Metabolic / heat vulnerability",
] as const;

const reviewDemands = [
  "Heavy lifting / carrying",
  "Repetition",
  "Awkward postures",
  "Standing / walking",
  "Heat / outdoor work",
  "Noise",
  "Dust / fumes / contaminants",
  "Respirator / PPE use",
  "Driving / vehicle operation",
  "Heights / hazardous equipment",
  "Night / rotating shifts",
  "Time pressure / emergency response",
] as const;

function AggravationReview() {
  const [condition, setCondition] = useState<(typeof reviewConditions)[number]>(reviewConditions[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (value: string) => setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  return (
    <CalculatorFrame
      title="Condition-Demand Review Builder"
      description="Creates a transparent human-review packet from a selected condition category and selected work demands. It intentionally does not assign weights, an aggravation score, a probability, or a compensability conclusion."
      results={selected.length ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricOrb label="Condition category" value={condition} note="Selected review topic" icon={HeartPulse} tone="rose" />
            <MetricOrb label="Selected work demands" value={selected.length.toString()} note="No weighting or score" icon={ShieldAlert} tone="amber" />
            <MetricOrb label="Automated conclusion" value="None" note="Human evidence review required" icon={Sparkles} tone="emerald" />
          </section>
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Review packet</p>
            <h3 className="mt-1 text-lg font-black text-white">{condition}</h3>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {selected.map((item) => <div key={item} className="rounded-xl border border-amber-100/14 bg-amber-300/[0.045] px-4 py-3 text-xs leading-5 text-amber-50/75">{item}</div>)}
            </div>
            <p className="mt-4 text-xs leading-6 text-cyan-50/58">Next step: compare these selected demands against actual job tasks, exposure measurements, medical restrictions, and appropriate clinical/occupational evidence. This tool does not perform that determination automatically.</p>
          </GlassCard>
        </>
      ) : <Waiting text="Choose one or more work demands. The tool will build a review packet only; it will not manufacture an aggravation index." />}
    >
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-50/62">Condition category</span>
        <select value={condition} onChange={(event) => setCondition(event.target.value as (typeof reviewConditions)[number])} className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none">
          {reviewConditions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-50/62">Work demands to review</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {reviewDemands.map((item) => (
            <button key={item} type="button" onClick={() => toggle(item)} className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold transition ${selected.includes(item) ? "border-amber-200/26 bg-amber-300/10 text-white" : "border-white/10 bg-[#071321]/70 text-cyan-50/62 hover:border-white/16"}`}>{item}</button>
          ))}
        </div>
      </div>
    </CalculatorFrame>
  );
}

function ChronicAgingCalculator() {
  const [workforce, setWorkforce] = useState(0);
  const [age55, setAge55] = useState(0);
  const [underPrev, setUnderPrev] = useState(0);
  const [overPrev, setOverPrev] = useState(0);
  const ready = workforce > 0;
  const olderWorkers = (workforce * age55) / 100;
  const youngerWorkers = workforce - olderWorkers;
  const olderBurden = (olderWorkers * overPrev) / 100;
  const youngerBurden = (youngerWorkers * underPrev) / 100;
  const totalBurden = olderBurden + youngerBurden;
  const data = [
    { group: "Under 55", workforce: youngerWorkers, modeled: youngerBurden },
    { group: "55+", workforce: olderWorkers, modeled: olderBurden },
  ];

  return (
    <CalculatorFrame
      title="Age-Band & Chronic-Condition Scenario"
      description="Applies user-entered age-band and prevalence percentages to an aggregate workforce. Age is not treated as incapacity, performance, or a fitness determination."
      results={ready ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="Entered workforce" value={workforce.toLocaleString()} note="Aggregate scenario" icon={Users} />
            <MetricOrb label="Workers age 55+" value={number(olderWorkers, 0)} note={`${age55}% entered share`} icon={Users} tone="violet" />
            <MetricOrb label="Modeled condition count" value={number(totalBurden, 0)} note="From entered prevalence assumptions" icon={HeartPulse} tone="rose" />
            <MetricOrb label="Individual inference" value="None" note="Aggregate arithmetic only" icon={ShieldAlert} tone="emerald" />
          </section>
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Entered age-band scenario</p>
            <div className="mt-3 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid stroke="rgba(165,243,252,.10)" vertical={false} />
                  <XAxis dataKey="group" tick={{ fill: "rgba(207,250,254,.68)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(207,250,254,.52)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(251,113,133,.2)", borderRadius: 12 }} />
                  <Bar dataKey="workforce" name="Workers" fill="#67e8f9" radius={[7, 7, 2, 2]} />
                  <Bar dataKey="modeled" name="Modeled condition count" fill="#fda4af" radius={[7, 7, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
      ) : <Waiting text="Enter an aggregate workforce. Age-band and prevalence percentages begin at zero and must be supplied by the user." />}
    >
      <NumberField label="Workforce size" value={workforce} onChange={setWorkforce} />
      <RangeField label="Workforce age 55+" value={age55} onChange={setAge55} />
      <RangeField label="Under-55 prevalence assumption" value={underPrev} onChange={setUnderPrev} />
      <RangeField label="55+ prevalence assumption" value={overPrev} onChange={setOverPrev} />
      <p className="text-[10px] leading-5 text-cyan-50/50">Prevalence values are not fetched or validated in this calculator. Enter them only when you have an appropriate aggregate source.</p>
    </CalculatorFrame>
  );
}

function ReadinessProfile() {
  const [demand, setDemand] = useState(0);
  const [health, setHealth] = useState(0);
  const [fatigue, setFatigue] = useState(0);
  const [surveillance, setSurveillance] = useState(0);
  const [modified, setModified] = useState(0);
  const [environment, setEnvironment] = useState(0);
  const data = [
    { dimension: "Demand compatibility", value: demand },
    { dimension: "Health resilience", value: health },
    { dimension: "Fatigue controls", value: fatigue },
    { dimension: "Surveillance", value: surveillance },
    { dimension: "Modified duty", value: modified },
    { dimension: "Environment", value: environment },
  ];
  const entered = data.filter((item) => item.value > 0);

  return (
    <CalculatorFrame
      title="Workforce Readiness Input Profile"
      description="Visualizes six user-entered operational dimensions independently. The previous unvalidated weighted/averaged readiness score and Strong/Stable/Watch/Vulnerable bands have been removed."
      results={entered.length ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricOrb label="Entered dimensions" value={`${entered.length}/6`} note="No composite score" icon={Users} />
            <MetricOrb label="Highest entered value" value={`${Math.max(...entered.map((item) => item.value))}%`} note={entered.reduce((a, b) => a.value > b.value ? a : b).dimension} icon={TrendingUp} tone="emerald" />
            <MetricOrb label="Automated readiness classification" value="None" note="No validated band asserted" icon={ShieldAlert} tone="violet" />
          </section>
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">User-entered dimensions</p>
            <div className="mt-3 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <CartesianGrid stroke="rgba(165,243,252,.10)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "rgba(207,250,254,.52)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="dimension" width={118} tick={{ fill: "rgba(207,250,254,.68)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(103,232,249,.2)", borderRadius: 12 }} />
                  <Bar dataKey="value" fill="#67e8f9" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
      ) : <Waiting text="Enter any dimensions you want to visualize. The tool no longer generates an unsupported single readiness index." />}
    >
      <RangeField label="Demand compatibility" value={demand} onChange={setDemand} />
      <RangeField label="Health resilience" value={health} onChange={setHealth} />
      <RangeField label="Fatigue controls" value={fatigue} onChange={setFatigue} />
      <RangeField label="Surveillance coverage" value={surveillance} onChange={setSurveillance} />
      <RangeField label="Modified-duty capacity" value={modified} onChange={setModified} />
      <RangeField label="Environmental controls" value={environment} onChange={setEnvironment} />
    </CalculatorFrame>
  );
}

function FatigueProfile() {
  const [shiftHours, setShiftHours] = useState(0);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [consecutive, setConsecutive] = useState(0);
  const [night, setNight] = useState(0);
  const [driving, setDriving] = useState(0);
  const [physical, setPhysical] = useState(0);
  const ready = shiftHours > 0 || weeklyHours > 0 || consecutive > 0 || night > 0 || driving > 0 || physical > 0;
  const percentageData = [
    { dimension: "Night work", value: night },
    { dimension: "Driving / vigilance", value: driving },
    { dimension: "Physical demand", value: physical },
  ];

  return (
    <CalculatorFrame
      title="Fatigue & Shift Input Profile"
      description="Displays entered schedule and exposure characteristics without converting them into an arbitrary fatigue-risk score or impairment classification."
      results={ready ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricOrb label="Shift length" value={shiftHours > 0 ? `${shiftHours} hr` : "—"} note="Entered schedule value" icon={Clock3} />
            <MetricOrb label="Weekly hours" value={weeklyHours > 0 ? weeklyHours.toString() : "—"} note="Entered schedule value" icon={CalendarClock} tone="violet" />
            <MetricOrb label="Consecutive shifts" value={consecutive > 0 ? consecutive.toString() : "—"} note="Entered schedule value" icon={BrainCircuit} tone="amber" />
          </section>
          <GlassCard className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Exposure mix</p>
                <h3 className="mt-1 text-lg font-black text-white">Entered percentages only</h3>
              </div>
              <span className="text-xs text-cyan-50/52">No fatigue score</span>
            </div>
            <div className="mt-3 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={percentageData}>
                  <CartesianGrid stroke="rgba(165,243,252,.10)" vertical={false} />
                  <XAxis dataKey="dimension" tick={{ fill: "rgba(207,250,254,.68)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "rgba(207,250,254,.52)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(167,139,250,.2)", borderRadius: 12 }} />
                  <Bar dataKey="value" fill="#a78bfa" radius={[7, 7, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] leading-5 text-cyan-50/50">Interpretation requires appropriate fatigue, scheduling, and safety evidence for the actual operation. This display does not diagnose impairment or establish a safe/unsafe threshold.</p>
          </GlassCard>
        </>
      ) : <Waiting text="Enter schedule or exposure characteristics. The previous custom fatigue index and severity bands have been removed." />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Shift length" value={shiftHours} onChange={setShiftHours} max={24} suffix="hours" />
        <NumberField label="Weekly hours" value={weeklyHours} onChange={setWeeklyHours} max={168} />
        <NumberField label="Consecutive shifts" value={consecutive} onChange={setConsecutive} max={31} />
        <RangeField label="Night work" value={night} onChange={setNight} />
        <RangeField label="Driving / vigilance" value={driving} onChange={setDriving} />
        <RangeField label="Physical demand" value={physical} onChange={setPhysical} />
      </div>
    </CalculatorFrame>
  );
}

function BreakEvenCalculator() {
  const [programCost, setProgramCost] = useState(0);
  const [costPerEvent, setCostPerEvent] = useState(0);
  const [effectiveness, setEffectiveness] = useState(0);
  const [population, setPopulation] = useState(0);
  const [baseline, setBaseline] = useState(0);
  const ready = population > 0 && baseline > 0 && costPerEvent > 0;
  const result = calculateBreakEven({
    programCost,
    costPerEvent,
    effectivenessPercent: effectiveness,
    population,
    baselineEventsPerHundred: baseline,
  });
  const curve = Array.from({ length: 11 }, (_, index) => {
    const pct = index * 5;
    const scenario = calculateBreakEven({
      programCost,
      costPerEvent,
      effectivenessPercent: pct,
      population,
      baselineEventsPerHundred: baseline,
    });
    return { effectiveness: pct, benefit: scenario.potentialBenefit, cost: programCost };
  });

  return (
    <CalculatorFrame
      title="Intervention Break-Even Scenario"
      description="Performs break-even arithmetic from entered population, baseline event rate, cost per event, program cost, and effectiveness assumption. It does not infer intervention effectiveness."
      results={ready ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="Baseline-implied events" value={number(result.expectedEvents, 1)} note="Entered rate × population" icon={Activity} />
            <MetricOrb label="Modeled avoided events" value={effectiveness > 0 ? number(result.avoidedEvents, 1) : "0"} note={`${effectiveness}% entered effectiveness`} icon={ShieldAlert} tone="emerald" />
            <MetricOrb label="Modeled benefit" value={money(result.potentialBenefit)} note="Avoided events × entered cost" icon={BadgeDollarSign} tone="violet" />
            <MetricOrb label="Net arithmetic" value={money(result.netImpact)} note="Modeled benefit − entered program cost" icon={TrendingUp} tone={result.netImpact >= 0 ? "emerald" : "rose"} />
          </section>
          <GlassCard className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Sensitivity arithmetic</p>
                <h3 className="mt-1 text-lg font-black text-white">Benefit across entered-effectiveness scenarios</h3>
              </div>
              <p className="text-xs text-cyan-50/55">Cost-only break-even: {number(result.eventsToBreakEven, 2)} events</p>
            </div>
            <div className="mt-3 h-[330px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curve}>
                  <CartesianGrid stroke="rgba(165,243,252,.10)" />
                  <XAxis dataKey="effectiveness" tick={{ fill: "rgba(207,250,254,.68)", fontSize: 10 }} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(207,250,254,.52)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "#06101d", border: "1px solid rgba(110,231,183,.2)", borderRadius: 12 }} />
                  <Line dataKey="benefit" name="Modeled benefit" stroke="#6ee7b7" strokeWidth={3} dot={false} />
                  <Line dataKey="cost" name="Program cost" stroke="#fda4af" strokeWidth={2} strokeDasharray="6 6" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
      ) : <Waiting text="Enter a population, baseline event rate, and cost per event. Effectiveness begins at zero and must be supplied explicitly." />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Program cost" value={programCost} onChange={setProgramCost} step={5_000} suffix="USD" />
        <NumberField label="Cost per event" value={costPerEvent} onChange={setCostPerEvent} step={5_000} suffix="USD" />
        <RangeField label="Effectiveness assumption" value={effectiveness} onChange={setEffectiveness} max={100} />
        <NumberField label="Population" value={population} onChange={setPopulation} />
        <NumberField label="Baseline events per 100" value={baseline} onChange={setBaseline} step={0.1} />
      </div>
    </CalculatorFrame>
  );
}

function ActiveCalculator({ id }: { id: CalculatorId }) {
  if (id === "rates") return <RateCalculator />;
  if (id === "workers-comp") return <WorkersCompCalculator />;
  if (id === "lost-time") return <LostTimeCalculator />;
  if (id === "return-to-work") return <ReturnToWorkCalculator />;
  if (id === "aggravation") return <AggravationReview />;
  if (id === "chronic-aging") return <ChronicAgingCalculator />;
  if (id === "readiness") return <ReadinessProfile />;
  if (id === "fatigue") return <FatigueProfile />;
  return <BreakEvenCalculator />;
}

export default function OccupationalCalculators() {
  const [activeCalculator, setActiveCalculator] = useState<CalculatorId>("rates");
  return (
    <OccupationalToolShell
      eyebrow="Independent Intelligence Tool · Calculator Suite"
      title="Occupational Calculators"
      subtitle="Nine independent occupational-health scenario tools with explicit inputs, transparent arithmetic, and no preloaded findings."
      notice="Each calculator is independent and starts from zero or an empty selection. Nothing transfers from another Insight Hub tool or client/case data. Scenario-only tools do not claim medical risk, aggravation probability, compensability, disability, readiness, fatigue impairment, or intervention effectiveness."
    >
      <ToolHero
        kicker="Nine independent tools"
        title="Useful models without fake certainty."
        description="Rate and financial tools perform transparent arithmetic. Review/profile tools visualize user-entered information without manufacturing unsupported risk scores or authoritative-looking defaults."
        accent="rose"
      >
        <div className="grid grid-cols-3 gap-2">
          {calculatorOptions.slice(0, 6).map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className={`rounded-xl border p-3 ${toneClasses[item.tone]}`}>
                <Icon size={16} />
                <p className="mt-2 text-[10px] font-bold leading-4 text-white">{item.label}</p>
              </div>
            );
          })}
        </div>
      </ToolHero>

      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {calculatorOptions.map((item) => {
          const Icon = item.icon;
          const active = activeCalculator === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveCalculator(item.id)}
              className={`rounded-xl border p-3 text-left transition ${active ? toneClasses[item.tone] : "border-white/10 bg-[#06101d]/80 text-cyan-50/60 hover:border-white/16"}`}
            >
              <div className="flex items-center gap-2">
                <Icon size={16} />
                <span className="text-xs font-black text-white">{item.label}</span>
              </div>
              <p className="mt-1 text-[9px] leading-4 opacity-65">{item.note}</p>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeCalculator} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <ActiveCalculator id={activeCalculator} />
        </motion.div>
      </AnimatePresence>
    </OccupationalToolShell>
  );
}
