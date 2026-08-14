import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  Gauge,
  Loader2,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
  RingGauge,
  ToolHero,
} from "@/components/insight/OccupationalToolPrimitives";
import { calculateIndustryImpact } from "@/data/occupationalCalculations";
import type { BlsBenchmark } from "@/data/employerIntelligenceApi";

const industries = [
  { code: "23", label: "Construction" },
  { code: "31", label: "Manufacturing" },
  { code: "48", label: "Transportation" },
  { code: "62", label: "Healthcare" },
  { code: "92", label: "Public Administration" },
  { code: "21", label: "Mining" },
] as const;

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

export default function IndustryImpactCalculator() {
  const [naics, setNaics] = useState("23");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [benchmark, setBenchmark] = useState<BlsBenchmark | null>(null);
  const [benchmarkMessage, setBenchmarkMessage] = useState("");
  const [workforce, setWorkforce] = useState(500);
  const [annualHours, setAnnualHours] = useState(1_000_000);
  const [observedCases, setObservedCases] = useState(8);
  const [observedDartCases, setObservedDartCases] = useState(5);
  const [observedDaysAwayCases, setObservedDaysAwayCases] = useState(3);
  const [eventsAvoided, setEventsAvoided] = useState(3);
  const [directCost, setDirectCost] = useState(45_000);
  const [indirectMultiplier, setIndirectMultiplier] = useState(1.1);
  const [profitMargin, setProfitMargin] = useState(5);
  const [manualTrc, setManualTrc] = useState(2.8);
  const [manualDart, setManualDart] = useState(1.6);
  const [manualDaysAway, setManualDaysAway] = useState(0.9);

  async function loadBenchmark(nextNaics = naics) {
    const query = nextNaics.trim();
    if (!query) return;
    setNaics(query);
    setLoading(true);
    setError("");
    setBenchmarkMessage("");
    setBenchmark(null);
    try {
      const params = new URLSearchParams({ naics: query });
      if (year.trim()) params.set("year", year.trim());
      const response = await fetch(`/api/bls/industry-benchmark?${params}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "BLS benchmark request failed.");
      setBenchmark(payload.benchmark ?? null);
      setBenchmarkMessage(payload.message || payload.limitation || "");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "BLS benchmark request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  const rates = {
    trc: benchmark?.trcRate ?? manualTrc,
    dart: benchmark?.dartRate ?? manualDart,
    daysAway: benchmark?.daysAwayRate ?? manualDaysAway,
  };

  const result = useMemo(
    () =>
      calculateIndustryImpact({
        workforce,
        annualHours,
        observedCases,
        observedDartCases,
        observedDaysAwayCases,
        eventsAvoided,
        directCostPerEvent: directCost,
        indirectMultiplier,
        profitMarginPercent: profitMargin,
        trcRate: rates.trc,
        dartRate: rates.dart,
        daysAwayRate: rates.daysAway,
      }),
    [
      workforce,
      annualHours,
      observedCases,
      observedDartCases,
      observedDaysAwayCases,
      eventsAvoided,
      directCost,
      indirectMultiplier,
      profitMargin,
      rates.trc,
      rates.dart,
      rates.daysAway,
    ],
  );

  const comparisonData = [
    { metric: "TRC", benchmark: rates.trc, scenario: result.observedTrir },
    {
      metric: "DART",
      benchmark: rates.dart,
      scenario: result.observedDartRate,
    },
    {
      metric: "Days Away",
      benchmark: rates.daysAway,
      scenario: result.observedDaysAwayRate,
    },
  ];
  const costData = [
    { name: "Direct", value: result.directAvoidedCost, color: "#67e8f9" },
    { name: "Indirect", value: result.indirectAvoidedCost, color: "#a78bfa" },
  ];
  const benchmarkRatio =
    rates.trc > 0 ? (result.observedTrir / rates.trc) * 100 : 0;
  const industryLabel =
    benchmark?.industryTitle ??
    industries.find((item) => item.code === naics)?.label ??
    `NAICS ${naics}`;

  return (
    <OccupationalToolShell
      eyebrow="Independent Intelligence Tool · Scenario Modeling"
      title="Industry Impact Calculator"
      subtitle="Model expected industry events, aggregate rate comparisons, potential avoided cost, and recovery exposure in one standalone calculation."
      notice="This calculator is independent and does not receive data from the Occupational Data Explorer, O*NET Master Tool, any client system, or another calculator. All workforce and event inputs are anonymous scenario values. BLS rates are aggregate industry benchmarks—not employer-specific findings or proof that an event was prevented."
    >
      <ToolHero
        kicker="Independent impact model"
        title="Translate an industry benchmark into a visual workforce-impact story."
        description="Load a BLS industry benchmark inside this calculator or use clearly labeled manual assumptions. Every slider and value updates the result immediately."
        accent="emerald"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <Users className="text-cyan-200/55" size={19} />
            <p className="mt-3 text-2xl font-black text-white">
              {workforce.toLocaleString()}
            </p>
            <p className="text-[10px] text-cyan-100/35">Modeled workers</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <TrendingUp className="text-violet-200/55" size={19} />
            <p className="mt-3 text-2xl font-black text-white">
              {number(result.expectedRecordables)}
            </p>
            <p className="text-[10px] text-cyan-100/35">Expected recordables</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <CircleDollarSign className="text-emerald-200/55" size={19} />
            <p className="mt-3 text-2xl font-black text-white">
              {money(result.potentialAvoidedCost)}
            </p>
            <p className="text-[10px] text-cyan-100/35">
              Potential avoided cost
            </p>
          </div>
        </div>
      </ToolHero>

      <section className="grid gap-6 2xl:grid-cols-[.72fr_1.28fr]">
        <div className="space-y-6">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                  Independent source lookup
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  Industry benchmark
                </h2>
              </div>
              {benchmark ? (
                <EvidenceGradeBadge grade="A" />
              ) : (
                <EvidenceGradeBadge grade="D" />
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {industries.map((industry) => (
                <button
                  key={industry.code}
                  type="button"
                  onClick={() => void loadBenchmark(industry.code)}
                  className={`rounded-2xl border px-3 py-3 text-left text-xs transition ${naics === industry.code ? "border-emerald-200/24 bg-emerald-300/[0.08] text-white" : "border-white/8 bg-white/[0.025] text-cyan-100/48 hover:border-white/14"}`}
                >
                  <span className="font-black">{industry.label}</span>
                  <span className="mt-1 block text-[9px] opacity-55">
                    NAICS {industry.code}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_.65fr_auto] sm:items-end">
              <label>
                <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-cyan-100/40">
                  NAICS
                </span>
                <input
                  value={naics}
                  onChange={(event) =>
                    setNaics(
                      event.target.value.replace(/[^0-9]/g, "").slice(0, 6),
                    )
                  }
                  className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"
                />
              </label>
              <label>
                <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-cyan-100/40">
                  Year
                </span>
                <input
                  value={year}
                  onChange={(event) =>
                    setYear(
                      event.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                    )
                  }
                  placeholder="Latest"
                  className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadBenchmark()}
                disabled={loading || !naics}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200/20 bg-emerald-300/10 px-4 text-xs font-black text-white disabled:opacity-45"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Search size={15} />
                )}
                Load
              </button>
            </div>
            {error ? (
              <p className="mt-4 rounded-2xl border border-rose-200/14 bg-rose-300/[0.04] p-3 text-xs leading-5 text-rose-100/65">
                {error}
              </p>
            ) : null}
            {!benchmark && benchmarkMessage ? (
              <p className="mt-4 rounded-2xl border border-amber-200/14 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/62">
                {benchmarkMessage}
              </p>
            ) : null}
            <p className="mt-4 text-xs leading-5 text-cyan-100/42">
              {benchmark
                ? `${benchmark.industryTitle} · ${benchmark.year} · ${benchmark.authMode}`
                : "Manual benchmark assumptions are active until a BLS series is loaded."}
            </p>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
              Anonymous workforce scenario
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Workforce size"
                value={workforce}
                onChange={setWorkforce}
                suffix="workers"
              />
              <NumberField
                label="Annual hours"
                value={annualHours}
                onChange={setAnnualHours}
                step={10_000}
                suffix="hours"
              />
              <NumberField
                label="Observed recordable cases"
                value={observedCases}
                onChange={setObservedCases}
                suffix="optional"
                hint="Anonymous total only; no case records."
              />
              <NumberField
                label="Observed DART cases"
                value={observedDartCases}
                onChange={setObservedDartCases}
                suffix="optional"
              />
              <NumberField
                label="Observed days-away cases"
                value={observedDaysAwayCases}
                onChange={setObservedDaysAwayCases}
                suffix="optional"
              />
              <NumberField
                label="Potential events avoided"
                value={eventsAvoided}
                onChange={setEventsAvoided}
                suffix="scenario"
              />
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                Cost assumptions
              </p>
              <EvidenceGradeBadge grade="D" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Direct cost per event"
                value={directCost}
                onChange={setDirectCost}
                step={1_000}
                suffix="USD"
              />
              <NumberField
                label="Indirect multiplier"
                value={indirectMultiplier}
                onChange={setIndirectMultiplier}
                step={0.1}
                suffix="× direct"
              />
              <NumberField
                label="Profit margin"
                value={profitMargin}
                onChange={setProfitMargin}
                step={0.5}
                suffix="%"
              />
            </div>
            <p className="mt-4 text-[10px] leading-5 text-cyan-100/34">
              Defaults are editable scenario assumptions. They are not claimed
              as a universal injury cost.
            </p>
          </GlassCard>

          {!benchmark ? (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                  Manual rate assumptions
                </p>
                <EvidenceGradeBadge grade="D" />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <NumberField
                  label="TRC rate"
                  value={manualTrc}
                  onChange={setManualTrc}
                  step={0.1}
                />
                <NumberField
                  label="DART rate"
                  value={manualDart}
                  onChange={setManualDart}
                  step={0.1}
                />
                <NumberField
                  label="Days-away rate"
                  value={manualDaysAway}
                  onChange={setManualDaysAway}
                  step={0.1}
                />
              </div>
            </GlassCard>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Expected cases"
              value={number(result.expectedRecordables)}
              note={`${industryLabel} benchmark`}
              icon={BriefcaseBusiness}
            />
            <MetricOrb
              label="Scenario TRIR"
              value={number(result.observedTrir)}
              note={`Benchmark ${number(rates.trc)}`}
              icon={Gauge}
              tone={result.observedTrir > rates.trc ? "rose" : "emerald"}
            />
            <MetricOrb
              label="Potential avoided cost"
              value={money(result.potentialAvoidedCost)}
              note={`${eventsAvoided} modeled events`}
              icon={CircleDollarSign}
              tone="emerald"
            />
            <MetricOrb
              label="Recovery revenue"
              value={money(result.revenueRequiredToRecover)}
              note={`At ${profitMargin}% margin`}
              icon={TrendingUp}
              tone="violet"
            />
          </section>

          <GlassCard className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
            <div className="relative grid gap-6 lg:grid-cols-[240px_1fr] lg:items-center">
              <RingGauge
                value={benchmarkRatio}
                label="of benchmark"
                detail="Scenario TRIR as a percentage of the selected industry TRC rate."
                tone={
                  benchmarkRatio > 125
                    ? "rose"
                    : benchmarkRatio > 90
                      ? "amber"
                      : "emerald"
                }
              />
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <EvidenceGradeBadge grade={benchmark ? "A" : "D"} />
                  <span className="text-xs text-cyan-100/40">
                    {benchmark
                      ? "BLS-backed industry context"
                      : "Manual industry assumption"}
                  </span>
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                  Generated impact statement
                </p>
                <p className="mt-2 text-lg font-semibold leading-8 text-white">
                  A modeled workforce of{" "}
                  <strong className="text-cyan-200">
                    {workforce.toLocaleString()}
                  </strong>{" "}
                  in <strong className="text-white">{industryLabel}</strong>{" "}
                  would be expected to experience approximately{" "}
                  <strong className="text-violet-200">
                    {number(result.expectedRecordables)}
                  </strong>{" "}
                  recordable cases at the selected rate. Modeling{" "}
                  <strong className="text-emerald-200">{eventsAvoided}</strong>{" "}
                  potentially avoided events produces a potential direct and
                  indirect cost range centered on{" "}
                  <strong className="text-emerald-200">
                    {money(result.potentialAvoidedCost)}
                  </strong>
                  .
                </p>
                <p className="mt-3 text-xs leading-6 text-cyan-100/38">
                  This is a scenario statement, not proof of causation or a
                  definitive savings claim.
                </p>
              </div>
            </div>
          </GlassCard>

          <div className="grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                Rate landscape
              </p>
              <div className="mt-4 h-[330px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid
                      stroke="rgba(165,243,252,.08)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="metric"
                      tick={{ fill: "rgba(207,250,254,.52)", fontSize: 11 }}
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
                        border: "1px solid rgba(103,232,249,.18)",
                        borderRadius: 16,
                      }}
                    />
                    <Bar
                      dataKey="benchmark"
                      name="Industry benchmark"
                      fill="#67e8f9"
                      radius={[8, 8, 2, 2]}
                    />
                    <Bar
                      dataKey="scenario"
                      name="Scenario"
                      fill="#a78bfa"
                      radius={[8, 8, 2, 2]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                Potential cost composition
              </p>
              <div className="mt-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="56%"
                      outerRadius="82%"
                      paddingAngle={3}
                    >
                      {costData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => money(Number(value))}
                      contentStyle={{
                        background: "#06101d",
                        border: "1px solid rgba(103,232,249,.18)",
                        borderRadius: 16,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-cyan-200/12 bg-cyan-300/[0.04] p-3">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/38">
                    Direct
                  </p>
                  <p className="mt-2 font-black text-white">
                    {money(result.directAvoidedCost)}
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-200/12 bg-violet-300/[0.04] p-3">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-violet-100/38">
                    Indirect
                  </p>
                  <p className="mt-2 font-black text-white">
                    {money(result.indirectAvoidedCost)}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
                  Methodology trace
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  Every number remains inspectable.
                </h2>
              </div>
              <BookOpenCheck className="text-cyan-200/45" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-xs leading-6 text-cyan-100/52">
                Expected cases = industry rate × annual hours ÷ 200,000.
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-xs leading-6 text-cyan-100/52">
                Scenario TRIR = observed aggregate cases × 200,000 ÷ hours.
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-xs leading-6 text-cyan-100/52">
                Avoided cost = modeled events × direct cost × (1 + indirect
                multiplier).
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-xs leading-6 text-cyan-100/52">
                Recovery revenue = potential cost ÷ profit margin.
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
    </OccupationalToolShell>
  );
}
