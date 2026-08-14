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
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
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
  RingGauge,
  ToolHero,
} from "@/components/insight/OccupationalToolPrimitives";
import {
  calculateBreakEven,
  calculateFatigueIndex,
  calculateIncidentRate,
  calculateLostTime,
  calculateReadinessIndex,
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
  {
    id: "rates",
    label: "TRIR & DART",
    note: "Incident-rate simulator",
    icon: CircleGauge,
    tone: "cyan",
  },
  {
    id: "workers-comp",
    label: "Workers’ Comp Cost",
    note: "Claim severity exposure",
    icon: BadgeDollarSign,
    tone: "violet",
  },
  {
    id: "lost-time",
    label: "Lost Time",
    note: "Productivity and overtime",
    icon: Clock3,
    tone: "rose",
  },
  {
    id: "return-to-work",
    label: "Return to Work",
    note: "Modified-duty scenario",
    icon: RotateCcw,
    tone: "emerald",
  },
  {
    id: "aggravation",
    label: "Aggravation Potential",
    note: "Condition-demand collision",
    icon: ShieldAlert,
    tone: "amber",
  },
  {
    id: "chronic-aging",
    label: "Age & Chronic Burden",
    note: "Workforce distribution",
    icon: HeartPulse,
    tone: "rose",
  },
  {
    id: "readiness",
    label: "Workforce Readiness",
    note: "Six-pillar readiness",
    icon: Users,
    tone: "cyan",
  },
  {
    id: "fatigue",
    label: "Fatigue & Shift",
    note: "Schedule pressure",
    icon: BrainCircuit,
    tone: "violet",
  },
  {
    id: "break-even",
    label: "Intervention Break-Even",
    note: "Prevention impact",
    icon: TrendingUp,
    tone: "emerald",
  },
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
  evidence,
  children,
  results,
}: {
  title: string;
  description: string;
  evidence: "A" | "B" | "C" | "D" | "Unavailable";
  children: ReactNode;
  results: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="grid gap-6 2xl:grid-cols-[.72fr_1.28fr]"
    >
      <GlassCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/38">
              Independent calculator
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              {title}
            </h2>
            <p className="mt-2 text-xs leading-6 text-cyan-100/46">
              {description}
            </p>
          </div>
          <EvidenceGradeBadge grade={evidence} />
        </div>
        <div className="mt-6 space-y-4">{children}</div>
      </GlassCard>
      <div className="space-y-6">{results}</div>
    </motion.section>
  );
}

function RateCalculator() {
  const [recordables, setRecordables] = useState(12);
  const [dartCases, setDartCases] = useState(7);
  const [hours, setHours] = useState(800_000);
  const [benchmarkTrir, setBenchmarkTrir] = useState(2.8);
  const [benchmarkDart, setBenchmarkDart] = useState(1.6);
  const trir = calculateIncidentRate(recordables, hours);
  const dart = calculateIncidentRate(dartCases, hours);
  const casesAtBenchmark = (benchmarkTrir * hours) / 200_000;
  const reductionNeeded = Math.max(recordables - casesAtBenchmark, 0);
  const ratio = benchmarkTrir > 0 ? (trir / benchmarkTrir) * 100 : 0;
  const data = [
    { metric: "TRIR", scenario: trir, benchmark: benchmarkTrir },
    { metric: "DART", scenario: dart, benchmark: benchmarkDart },
  ];
  return (
    <CalculatorFrame
      title="TRIR & DART Simulator"
      description="Uses anonymous case totals and hours. Benchmark fields are manual assumptions within this calculator."
      evidence="D"
      results={
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="TRIR"
              value={number(trir, 2)}
              note={`Benchmark ${number(benchmarkTrir)}`}
              icon={CircleGauge}
              tone={trir > benchmarkTrir ? "rose" : "emerald"}
            />
            <MetricOrb
              label="DART"
              value={number(dart, 2)}
              note={`Benchmark ${number(benchmarkDart)}`}
              icon={CalendarClock}
              tone={dart > benchmarkDart ? "rose" : "emerald"}
            />
            <MetricOrb
              label="Cases at benchmark"
              value={number(casesAtBenchmark, 1)}
              note="At entered hours"
              icon={Activity}
            />
            <MetricOrb
              label="Reduction to benchmark"
              value={number(reductionNeeded, 1)}
              note="Modeled recordable cases"
              icon={TrendingUp}
              tone="violet"
            />
          </section>
          <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
            <GlassCard className="grid place-items-center p-6">
              <RingGauge
                value={ratio}
                label="of benchmark"
                detail="Scenario TRIR compared with the manually entered benchmark."
                tone={ratio > 125 ? "rose" : ratio > 90 ? "amber" : "emerald"}
              />
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                Live rate comparison
              </p>
              <div className="mt-4 h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid
                      stroke="rgba(165,243,252,.08)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="metric"
                      tick={{ fill: "rgba(207,250,254,.5)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "rgba(207,250,254,.4)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#06101d",
                        border: "1px solid rgba(103,232,249,.18)",
                        borderRadius: 16,
                      }}
                    />
                    <Bar
                      dataKey="scenario"
                      fill="#a78bfa"
                      radius={[8, 8, 2, 2]}
                    />
                    <Bar
                      dataKey="benchmark"
                      fill="#67e8f9"
                      radius={[8, 8, 2, 2]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Recordable cases"
          value={recordables}
          onChange={setRecordables}
        />
        <NumberField
          label="DART cases"
          value={dartCases}
          onChange={setDartCases}
        />
        <NumberField
          label="Hours worked"
          value={hours}
          onChange={setHours}
          step={10_000}
        />
        <NumberField
          label="TRIR benchmark"
          value={benchmarkTrir}
          onChange={setBenchmarkTrir}
          step={0.1}
        />
        <NumberField
          label="DART benchmark"
          value={benchmarkDart}
          onChange={setBenchmarkDart}
          step={0.1}
        />
      </div>
      <p className="text-[10px] leading-5 text-cyan-100/34">
        TRIR/DART = cases × 200,000 ÷ hours worked.
      </p>
    </CalculatorFrame>
  );
}

function WorkersCompCalculator() {
  const [claims, setClaims] = useState(8);
  const [medical, setMedical] = useState(28_000);
  const [lostDays, setLostDays] = useState(18);
  const [dailyCost, setDailyCost] = useState(420);
  const [admin, setAdmin] = useState(12);
  const [indirect, setIndirect] = useState(1.1);
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
      title="Workers’ Compensation Cost"
      description="Models direct, wage-replacement, administrative, and indirect exposure using editable anonymous assumptions."
      evidence="D"
      results={
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Modeled total"
              value={money(result.total)}
              note={`${claims} claims`}
              icon={BadgeDollarSign}
              tone="violet"
            />
            <MetricOrb
              label="Medical"
              value={money(result.medical)}
              note="Direct medical assumption"
              icon={BriefcaseMedical}
            />
            <MetricOrb
              label="Wage replacement"
              value={money(result.wageReplacement)}
              note={`${lostDays} days per claim`}
              icon={CalendarClock}
              tone="rose"
            />
            <MetricOrb
              label="Indirect"
              value={money(result.indirect)}
              note={`${indirect}× modeled direct base`}
              icon={Sparkles}
              tone="amber"
            />
          </section>
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
              Cost architecture
            </p>
            <div className="mt-4 h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <CartesianGrid
                    stroke="rgba(165,243,252,.08)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "rgba(207,250,254,.38)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) =>
                      `$${Math.round(Number(value) / 1000)}k`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={112}
                    tick={{ fill: "rgba(207,250,254,.52)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => money(Number(value))}
                    contentStyle={{
                      background: "#06101d",
                      border: "1px solid rgba(167,139,250,.2)",
                      borderRadius: 16,
                    }}
                  />
                  <Bar dataKey="value" fill="#a78bfa" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Claims" value={claims} onChange={setClaims} />
        <NumberField
          label="Medical cost per claim"
          value={medical}
          onChange={setMedical}
          step={1_000}
          suffix="USD"
        />
        <NumberField
          label="Lost days per claim"
          value={lostDays}
          onChange={setLostDays}
        />
        <NumberField
          label="Daily compensation cost"
          value={dailyCost}
          onChange={setDailyCost}
          step={10}
          suffix="USD"
        />
        <NumberField
          label="Administrative load"
          value={admin}
          onChange={setAdmin}
          suffix="%"
        />
        <NumberField
          label="Indirect multiplier"
          value={indirect}
          onChange={setIndirect}
          step={0.1}
          suffix="×"
        />
      </div>
    </CalculatorFrame>
  );
}

function LostTimeCalculator() {
  const [cases, setCases] = useState(10);
  const [daysAway, setDaysAway] = useState(12);
  const [restrictedDays, setRestrictedDays] = useState(8);
  const [hourlyCost, setHourlyCost] = useState(54);
  const [overtime, setOvertime] = useState(50);
  const result = calculateLostTime({
    cases,
    daysAway,
    restrictedDays,
    hourlyCompensation: hourlyCost,
    overtimePercent: overtime,
  });
  const dots = Math.min(Math.round(result.productiveHoursLost / 8), 120);
  return (
    <CalculatorFrame
      title="Lost Time & Productivity"
      description="Translates anonymous case counts, days away, restricted days, and compensation assumptions into capacity exposure."
      evidence="D"
      results={
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Away hours"
              value={result.awayHours.toLocaleString()}
              note="Fully unavailable hours"
              icon={Clock3}
              tone="rose"
            />
            <MetricOrb
              label="Restricted hours"
              value={result.restrictedHours.toLocaleString()}
              note="Modeled at 50% productivity loss"
              icon={CalendarClock}
              tone="amber"
            />
            <MetricOrb
              label="Productive hours lost"
              value={number(result.productiveHoursLost, 0)}
              note="Combined capacity effect"
              icon={Activity}
            />
            <MetricOrb
              label="Cost exposure"
              value={money(result.total)}
              note="Compensation plus overtime"
              icon={BadgeDollarSign}
              tone="violet"
            />
          </section>
          <GlassCard className="p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                  Capacity calendar
                </p>
                <h3 className="mt-1 text-lg font-black text-white">
                  Equivalent productive workdays affected
                </h3>
              </div>
              <p className="text-3xl font-black text-rose-200">
                {number(result.productiveHoursLost / 8, 0)}
              </p>
            </div>
            <div className="mt-6 grid grid-cols-12 gap-2">
              {Array.from({ length: 120 }, (_, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(index * 0.006, 0.35) }}
                  className={`aspect-square rounded-md border ${index < dots ? "border-rose-200/22 bg-rose-300/35 shadow-[0_0_10px_rgba(251,113,133,.18)]" : "border-white/6 bg-white/[0.02]"}`}
                />
              ))}
            </div>
            <p className="mt-4 text-[10px] text-cyan-100/32">
              Each illuminated cell represents up to one equivalent eight-hour
              workday; display capped at 120 cells.
            </p>
          </GlassCard>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Cases" value={cases} onChange={setCases} />
        <NumberField
          label="Days away per case"
          value={daysAway}
          onChange={setDaysAway}
        />
        <NumberField
          label="Restricted days per case"
          value={restrictedDays}
          onChange={setRestrictedDays}
        />
        <NumberField
          label="Hourly compensation"
          value={hourlyCost}
          onChange={setHourlyCost}
          suffix="USD"
        />
        <NumberField
          label="Overtime premium"
          value={overtime}
          onChange={setOvertime}
          suffix="%"
        />
      </div>
    </CalculatorFrame>
  );
}

function ReturnToWorkCalculator() {
  const [workers, setWorkers] = useState(6);
  const [fullDays, setFullDays] = useState(45);
  const [modifiedDays, setModifiedDays] = useState(15);
  const [dailyCost, setDailyCost] = useState(420);
  const [productivity, setProductivity] = useState(65);
  const result = calculateReturnToWork({
    workers,
    fullDutyDays: fullDays,
    modifiedDutyDays: modifiedDays,
    dailyCompensationCost: dailyCost,
    modifiedProductivityPercent: productivity,
  });
  const data = [
    { scenario: "No modified duty", cost: result.withoutModifiedDuty },
    { scenario: "Modified duty", cost: result.withModifiedDuty },
  ];
  return (
    <CalculatorFrame
      title="Return-to-Work Simulator"
      description="Compares a full absence scenario with an editable modified-duty scenario. It does not determine medical restrictions or return-to-work eligibility."
      evidence="D"
      results={
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Without modified duty"
              value={money(result.withoutModifiedDuty)}
              note={`${fullDays} days`}
              icon={CalendarClock}
              tone="rose"
            />
            <MetricOrb
              label="Modified-duty exposure"
              value={money(result.withModifiedDuty)}
              note={`${productivity}% productivity`}
              icon={RotateCcw}
              tone="amber"
            />
            <MetricOrb
              label="Potential difference"
              value={money(result.potentialDifference)}
              note="Scenario comparison"
              icon={TrendingUp}
              tone="emerald"
            />
            <MetricOrb
              label="Days recovered"
              value={number(result.daysRecovered, 0)}
              note="Across modeled workers"
              icon={Activity}
            />
          </section>
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
              Scenario comparison
            </p>
            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid
                    stroke="rgba(165,243,252,.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="scenario"
                    tick={{ fill: "rgba(207,250,254,.5)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(207,250,254,.38)", fontSize: 10 }}
                    tickFormatter={(value) =>
                      `$${Math.round(Number(value) / 1000)}k`
                    }
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => money(Number(value))}
                    contentStyle={{
                      background: "#06101d",
                      border: "1px solid rgba(110,231,183,.18)",
                      borderRadius: 16,
                    }}
                  />
                  <Bar dataKey="cost" fill="#6ee7b7" radius={[10, 10, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Workers" value={workers} onChange={setWorkers} />
        <NumberField
          label="Full absence days"
          value={fullDays}
          onChange={setFullDays}
        />
        <NumberField
          label="Modified-duty days"
          value={modifiedDays}
          onChange={setModifiedDays}
        />
        <NumberField
          label="Daily compensation cost"
          value={dailyCost}
          onChange={setDailyCost}
          suffix="USD"
        />
        <RangeField
          label="Modified-duty productivity"
          value={productivity}
          onChange={setProductivity}
        />
      </div>
    </CalculatorFrame>
  );
}

const stressors = [
  { id: "lifting", label: "Heavy lifting", weight: 16 },
  { id: "repetition", label: "Repetition", weight: 13 },
  { id: "heat", label: "Heat / PPE", weight: 14 },
  { id: "noise", label: "Noise", weight: 10 },
  { id: "airborne", label: "Dust / fumes", weight: 15 },
  { id: "shift", label: "Shift work", weight: 12 },
  { id: "driving", label: "Driving", weight: 11 },
  { id: "heights", label: "Heights / machinery", weight: 14 },
] as const;
const conditions = [
  "Musculoskeletal",
  "Cardiovascular",
  "Respiratory",
  "Hearing",
  "Sleep/Fatigue",
  "Metabolic",
] as const;

function AggravationCalculator() {
  const [condition, setCondition] =
    useState<(typeof conditions)[number]>("Musculoskeletal");
  const [selected, setSelected] = useState<string[]>(["lifting", "repetition"]);
  const [intensity, setIntensity] = useState(60);
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const base = stressors
    .filter((item) => selected.includes(item.id))
    .reduce((sum, item) => sum + item.weight, 0);
  const conditionFactor: Record<(typeof conditions)[number], number> = {
    Musculoskeletal: 1.15,
    Cardiovascular: 1.05,
    Respiratory: 1.1,
    Hearing: 0.9,
    "Sleep/Fatigue": 1,
    Metabolic: 0.95,
  };
  const index = Math.min(
    100,
    base * conditionFactor[condition] * (intensity / 70),
  );
  const band =
    index >= 70
      ? "High interaction"
      : index >= 45
        ? "Elevated interaction"
        : index >= 20
          ? "Review"
          : "Limited signal";
  return (
    <CalculatorFrame
      title="Aggravation Potential"
      description="Builds a transparent condition-demand interaction index from manually selected stressors. It is not a probability, diagnosis, work-relatedness finding, or workers’ compensation decision."
      evidence="D"
      results={
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Condition category"
              value={condition}
              note="Anonymous scenario"
              icon={HeartPulse}
              tone="rose"
            />
            <MetricOrb
              label="Selected stressors"
              value={selected.length.toString()}
              note="Manual demand inputs"
              icon={ShieldAlert}
              tone="amber"
            />
            <MetricOrb
              label="Interaction band"
              value={band}
              note="Screening signal only"
              icon={CircleGauge}
              tone={index >= 70 ? "rose" : index >= 45 ? "amber" : "emerald"}
            />
            <MetricOrb
              label="Evidence basis"
              value="Assumption"
              note="No causal probability asserted"
              icon={Sparkles}
              tone="violet"
            />
          </section>
          <div className="grid gap-6 xl:grid-cols-[.65fr_1.35fr]">
            <GlassCard className="grid place-items-center p-6">
              <RingGauge
                value={index}
                label="interaction index"
                detail="Transparent scenario overlap between the selected condition category and work stressors."
                tone={index >= 70 ? "rose" : index >= 45 ? "amber" : "emerald"}
              />
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                Collision matrix
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {stressors.map((stressor) => (
                  <div
                    key={stressor.id}
                    className={`rounded-2xl border p-4 ${selected.includes(stressor.id) ? "border-amber-200/22 bg-amber-300/[0.09]" : "border-white/7 bg-white/[0.02] opacity-45"}`}
                  >
                    <p className="text-xs font-bold text-white">
                      {stressor.label}
                    </p>
                    <p className="mt-2 text-[10px] text-cyan-100/38">
                      Weight {stressor.weight}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </>
      }
    >
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
          Condition category
        </span>
        <select
          value={condition}
          onChange={(event) =>
            setCondition(event.target.value as (typeof conditions)[number])
          }
          className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#06101c] px-4 text-sm text-white outline-none"
        >
          {conditions.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
          Work stressors
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {stressors.map((stressor) => (
            <button
              key={stressor.id}
              type="button"
              onClick={() => toggle(stressor.id)}
              className={`rounded-2xl border px-4 py-3 text-left text-xs font-semibold transition ${selected.includes(stressor.id) ? "border-amber-200/24 bg-amber-300/10 text-white" : "border-white/8 bg-white/[0.025] text-cyan-100/45"}`}
            >
              {stressor.label}
            </button>
          ))}
        </div>
      </div>
      <RangeField
        label="Exposure intensity"
        value={intensity}
        onChange={setIntensity}
      />
    </CalculatorFrame>
  );
}

function ChronicAgingCalculator() {
  const [workforce, setWorkforce] = useState(800);
  const [age55, setAge55] = useState(28);
  const [underPrev, setUnderPrev] = useState(48);
  const [overPrev, setOverPrev] = useState(74);
  const [physical, setPhysical] = useState(55);
  const olderWorkers = (workforce * age55) / 100;
  const youngerWorkers = workforce - olderWorkers;
  const olderBurden = (olderWorkers * overPrev) / 100;
  const youngerBurden = (youngerWorkers * underPrev) / 100;
  const totalBurden = olderBurden + youngerBurden;
  const physicalInteraction = (totalBurden * physical) / 100;
  const data = [
    { group: "Under 55", workforce: youngerWorkers, modeled: youngerBurden },
    { group: "55+", workforce: olderWorkers, modeled: olderBurden },
  ];
  return (
    <CalculatorFrame
      title="Age & Chronic-Condition Burden"
      description="Models age-band distribution and user-entered chronic-condition prevalence. Age is never treated as incapacity or poor performance."
      evidence="D"
      results={
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Modeled chronic burden"
              value={number(totalBurden, 0)}
              note={`${number((totalBurden / Math.max(workforce, 1)) * 100)}% of workforce`}
              icon={HeartPulse}
              tone="rose"
            />
            <MetricOrb
              label="Workers age 55+"
              value={number(olderWorkers, 0)}
              note={`${age55}% age-band assumption`}
              icon={Users}
            />
            <MetricOrb
              label="Physical-demand overlap"
              value={number(physicalInteraction, 0)}
              note="Modeled condition-demand intersection"
              icon={Activity}
              tone="amber"
            />
            <MetricOrb
              label="Readiness meaning"
              value="Context only"
              note="Never an individual determination"
              icon={ShieldAlert}
              tone="emerald"
            />
          </section>
          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
              Age-band and modeled burden
            </p>
            <div className="mt-4 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid
                    stroke="rgba(165,243,252,.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="group"
                    tick={{ fill: "rgba(207,250,254,.5)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(207,250,254,.38)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#06101d",
                      border: "1px solid rgba(251,113,133,.18)",
                      borderRadius: 16,
                    }}
                  />
                  <Bar
                    dataKey="workforce"
                    name="Workers"
                    fill="#67e8f9"
                    radius={[8, 8, 2, 2]}
                  />
                  <Bar
                    dataKey="modeled"
                    name="Modeled chronic condition"
                    fill="#fda4af"
                    radius={[8, 8, 2, 2]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] leading-5 text-cyan-100/34">
              This calculator models aggregate prevalence assumptions. It does
              not infer any individual’s health or ability from age.
            </p>
          </GlassCard>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Workforce size"
          value={workforce}
          onChange={setWorkforce}
        />
        <RangeField
          label="Workforce age 55+"
          value={age55}
          onChange={setAge55}
        />
        <RangeField
          label="Under-55 chronic prevalence"
          value={underPrev}
          onChange={setUnderPrev}
        />
        <RangeField
          label="55+ chronic prevalence"
          value={overPrev}
          onChange={setOverPrev}
        />
        <RangeField
          label="Physically demanding roles"
          value={physical}
          onChange={setPhysical}
        />
      </div>
    </CalculatorFrame>
  );
}

function ReadinessCalculator() {
  const [demand, setDemand] = useState(72);
  const [health, setHealth] = useState(68);
  const [fatigue, setFatigue] = useState(54);
  const [surveillance, setSurveillance] = useState(82);
  const [modified, setModified] = useState(61);
  const [environment, setEnvironment] = useState(76);
  const result = calculateReadinessIndex({
    demandCompatibility: demand,
    healthResilience: health,
    fatigueControl: fatigue,
    surveillanceCoverage: surveillance,
    modifiedDutyCapacity: modified,
    environmentalControls: environment,
  });
  const data = [
    { subject: "Demand fit", value: demand },
    { subject: "Health", value: health },
    { subject: "Fatigue", value: fatigue },
    { subject: "Surveillance", value: surveillance },
    { subject: "Modified duty", value: modified },
    { subject: "Environment", value: environment },
  ];
  return (
    <CalculatorFrame
      title="Workforce Readiness Index"
      description="Combines six manually entered readiness dimensions. This is an operational scenario—not a fitness-for-duty or medical-clearance decision."
      evidence="D"
      results={
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Readiness index"
              value={`${number(result.score, 0)}/100`}
              note={result.band}
              icon={Users}
              tone={result.score >= 65 ? "emerald" : "amber"}
            />
            <MetricOrb
              label="Strongest pillar"
              value={data.reduce((a, b) => (a.value > b.value ? a : b)).subject}
              note={`${Math.max(...data.map((item) => item.value))}/100`}
              icon={TrendingUp}
            />
            <MetricOrb
              label="Priority pillar"
              value={data.reduce((a, b) => (a.value < b.value ? a : b)).subject}
              note={`${Math.min(...data.map((item) => item.value))}/100`}
              icon={ShieldAlert}
              tone="rose"
            />
            <MetricOrb
              label="Pillars"
              value="6"
              note="Transparent operational dimensions"
              icon={Sparkles}
              tone="violet"
            />
          </section>
          <div className="grid gap-6 xl:grid-cols-[.68fr_1.32fr]">
            <GlassCard className="grid place-items-center p-6">
              <RingGauge
                value={result.score}
                label="readiness"
                detail={`${result.band} operational scenario`}
                tone={
                  result.score >= 80
                    ? "emerald"
                    : result.score >= 65
                      ? "cyan"
                      : result.score >= 45
                        ? "amber"
                        : "rose"
                }
              />
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                Six-pillar readiness shape
              </p>
              <div className="mt-2 h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={data} outerRadius="72%">
                    <PolarGrid stroke="rgba(165,243,252,.14)" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "rgba(207,250,254,.55)", fontSize: 10 }}
                    />
                    <Radar
                      dataKey="value"
                      stroke="#67e8f9"
                      fill="#22d3ee"
                      fillOpacity={0.24}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#06101d",
                        border: "1px solid rgba(103,232,249,.18)",
                        borderRadius: 16,
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>
        </>
      }
    >
      <RangeField
        label="Demand compatibility"
        value={demand}
        onChange={setDemand}
      />
      <RangeField
        label="Health resilience"
        value={health}
        onChange={setHealth}
      />
      <RangeField
        label="Fatigue controls"
        value={fatigue}
        onChange={setFatigue}
      />
      <RangeField
        label="Surveillance coverage"
        value={surveillance}
        onChange={setSurveillance}
      />
      <RangeField
        label="Modified-duty capacity"
        value={modified}
        onChange={setModified}
      />
      <RangeField
        label="Environmental controls"
        value={environment}
        onChange={setEnvironment}
      />
    </CalculatorFrame>
  );
}

function FatigueCalculator() {
  const [shiftHours, setShiftHours] = useState(12);
  const [weeklyHours, setWeeklyHours] = useState(56);
  const [consecutive, setConsecutive] = useState(6);
  const [night, setNight] = useState(50);
  const [driving, setDriving] = useState(35);
  const [physical, setPhysical] = useState(65);
  const result = calculateFatigueIndex({
    shiftHours,
    weeklyHours,
    consecutiveShifts: consecutive,
    nightWorkPercent: night,
    drivingPercent: driving,
    physicalDemandPercent: physical,
  });
  const data = Object.entries(result.components).map(([name, value]) => ({
    name,
    value,
  }));
  return (
    <CalculatorFrame
      title="Fatigue & Shift-Risk Simulator"
      description="Models schedule, night work, driving, and physical-demand pressure. It is a transparent scenario index—not an impairment determination."
      evidence="D"
      results={
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Fatigue index"
              value={`${number(result.score, 0)}/100`}
              note={result.band}
              icon={BrainCircuit}
              tone={
                result.score >= 70
                  ? "rose"
                  : result.score >= 50
                    ? "amber"
                    : "emerald"
              }
            />
            <MetricOrb
              label="Shift length"
              value={`${shiftHours} hours`}
              note={`${consecutive} consecutive shifts`}
              icon={Clock3}
            />
            <MetricOrb
              label="Weekly hours"
              value={weeklyHours.toString()}
              note={`${night}% night work`}
              icon={CalendarClock}
              tone="violet"
            />
            <MetricOrb
              label="Safety-sensitive load"
              value={`${Math.max(driving, physical)}%`}
              note="Higher of driving/physical demand"
              icon={ShieldAlert}
              tone="rose"
            />
          </section>
          <div className="grid gap-6 xl:grid-cols-[.68fr_1.32fr]">
            <GlassCard className="grid place-items-center p-6">
              <RingGauge
                value={result.score}
                label="fatigue pressure"
                detail={`${result.band} scenario band`}
                tone={
                  result.score >= 70
                    ? "rose"
                    : result.score >= 50
                      ? "amber"
                      : "emerald"
                }
              />
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                Pressure components
              </p>
              <div className="mt-4 h-[330px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid
                      stroke="rgba(165,243,252,.08)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "rgba(207,250,254,.46)", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "rgba(207,250,254,.36)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#06101d",
                        border: "1px solid rgba(167,139,250,.18)",
                        borderRadius: 16,
                      }}
                    />
                    <Bar dataKey="value" fill="#a78bfa" radius={[8, 8, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Shift length"
          value={shiftHours}
          onChange={setShiftHours}
          max={24}
          suffix="hours"
        />
        <NumberField
          label="Weekly hours"
          value={weeklyHours}
          onChange={setWeeklyHours}
          max={100}
        />
        <NumberField
          label="Consecutive shifts"
          value={consecutive}
          onChange={setConsecutive}
          max={14}
        />
        <RangeField label="Night work" value={night} onChange={setNight} />
        <RangeField
          label="Driving / vigilance"
          value={driving}
          onChange={setDriving}
        />
        <RangeField
          label="Physical demand"
          value={physical}
          onChange={setPhysical}
        />
      </div>
    </CalculatorFrame>
  );
}

function BreakEvenCalculator() {
  const [programCost, setProgramCost] = useState(120_000);
  const [costPerEvent, setCostPerEvent] = useState(85_000);
  const [effectiveness, setEffectiveness] = useState(20);
  const [population, setPopulation] = useState(1_000);
  const [baseline, setBaseline] = useState(3.2);
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
    return {
      effectiveness: pct,
      benefit: scenario.potentialBenefit,
      cost: programCost,
    };
  });
  return (
    <CalculatorFrame
      title="Intervention Break-Even"
      description="Compares a program-cost assumption with modeled events and cost per event. It does not claim a program caused a specific outcome."
      evidence="D"
      results={
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Expected baseline events"
              value={number(result.expectedEvents, 1)}
              note={`${baseline} per 100 workers`}
              icon={Activity}
            />
            <MetricOrb
              label="Modeled avoided events"
              value={number(result.avoidedEvents, 1)}
              note={`${effectiveness}% assumption`}
              icon={ShieldAlert}
              tone="emerald"
            />
            <MetricOrb
              label="Potential benefit"
              value={money(result.potentialBenefit)}
              note="Events × cost assumption"
              icon={BadgeDollarSign}
              tone="violet"
            />
            <MetricOrb
              label="Net scenario"
              value={money(result.netImpact)}
              note={
                result.netImpact >= 0
                  ? "Above modeled break-even"
                  : "Below modeled break-even"
              }
              icon={TrendingUp}
              tone={result.netImpact >= 0 ? "emerald" : "rose"}
            />
          </section>
          <GlassCard className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                  Sensitivity curve
                </p>
                <h3 className="mt-1 text-lg font-black text-white">
                  Benefit as effectiveness changes
                </h3>
              </div>
              <p className="text-xs text-cyan-100/42">
                Break-even: {number(result.eventsToBreakEven, 2)} events
              </p>
            </div>
            <div className="mt-4 h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curve}>
                  <CartesianGrid stroke="rgba(165,243,252,.08)" />
                  <XAxis
                    dataKey="effectiveness"
                    tick={{ fill: "rgba(207,250,254,.5)", fontSize: 10 }}
                    tickFormatter={(value) => `${value}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(207,250,254,.36)", fontSize: 10 }}
                    tickFormatter={(value) =>
                      `$${Math.round(Number(value) / 1000)}k`
                    }
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => money(Number(value))}
                    contentStyle={{
                      background: "#06101d",
                      border: "1px solid rgba(110,231,183,.18)",
                      borderRadius: 16,
                    }}
                  />
                  <Line
                    dataKey="benefit"
                    name="Potential benefit"
                    stroke="#6ee7b7"
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    dataKey="cost"
                    name="Program cost"
                    stroke="#fda4af"
                    strokeWidth={2}
                    strokeDasharray="6 6"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Program cost"
          value={programCost}
          onChange={setProgramCost}
          step={5_000}
          suffix="USD"
        />
        <NumberField
          label="Cost per event"
          value={costPerEvent}
          onChange={setCostPerEvent}
          step={5_000}
          suffix="USD"
        />
        <RangeField
          label="Effectiveness assumption"
          value={effectiveness}
          onChange={setEffectiveness}
          max={50}
        />
        <NumberField
          label="Population"
          value={population}
          onChange={setPopulation}
        />
        <NumberField
          label="Baseline events per 100"
          value={baseline}
          onChange={setBaseline}
          step={0.1}
        />
      </div>
    </CalculatorFrame>
  );
}

function ActiveCalculator({ id }: { id: CalculatorId }) {
  if (id === "rates") return <RateCalculator />;
  if (id === "workers-comp") return <WorkersCompCalculator />;
  if (id === "lost-time") return <LostTimeCalculator />;
  if (id === "return-to-work") return <ReturnToWorkCalculator />;
  if (id === "aggravation") return <AggravationCalculator />;
  if (id === "chronic-aging") return <ChronicAgingCalculator />;
  if (id === "readiness") return <ReadinessCalculator />;
  if (id === "fatigue") return <FatigueCalculator />;
  return <BreakEvenCalculator />;
}

export default function OccupationalCalculators() {
  const [activeCalculator, setActiveCalculator] =
    useState<CalculatorId>("rates");
  return (
    <OccupationalToolShell
      eyebrow="Independent Intelligence Tool · Calculator Suite"
      title="Occupational Calculators"
      subtitle="Nine visually interactive calculators for injury rates, workers’ compensation, aggravation, chronic-condition burden, readiness, fatigue, lost time, return to work, and prevention impact."
      notice="This suite is independent. Every calculator owns its own inputs and results; switching calculators does not transfer values, pull from another tool, access client data, or persist case information. Results are scenario estimates for research and discussion—not medical, legal, compensability, disability, or safety determinations."
    >
      <ToolHero
        kicker="Nine independent calculators"
        title="Model occupational-health scenarios from every angle."
        description="Choose one calculator at a time. Each opens as a fresh standalone model with interactive inputs, animated results, transparent formulas, and explicit evidence grading."
        accent="rose"
      >
        <div className="grid grid-cols-3 gap-3">
          {calculatorOptions.slice(0, 6).map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-3 ${toneClasses[item.tone]}`}
              >
                <Icon size={17} />
                <p className="mt-2 text-[10px] font-bold leading-4 text-white">
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>
      </ToolHero>

      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {calculatorOptions.map((item) => {
          const Icon = item.icon;
          const active = activeCalculator === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveCalculator(item.id)}
              className={`rounded-[22px] border p-4 text-left transition duration-300 hover:-translate-y-0.5 ${active ? toneClasses[item.tone] + " shadow-[0_0_28px_rgba(34,211,238,.08)]" : "border-white/9 bg-white/[0.025] text-cyan-100/50 hover:border-white/15 hover:text-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <Icon size={18} />
                <span className="text-[9px] uppercase tracking-[0.15em] opacity-45">
                  Open
                </span>
              </div>
              <p className="mt-3 text-sm font-black text-white">{item.label}</p>
              <p className="mt-1 text-[10px] opacity-45">{item.note}</p>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <ActiveCalculator key={activeCalculator} id={activeCalculator} />
      </AnimatePresence>
    </OccupationalToolShell>
  );
}
