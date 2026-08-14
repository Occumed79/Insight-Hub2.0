import { useMemo, useState } from "react";
import {
  BarChart3,
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
import { calculateIndustryImpact } from "@/data/occupationalCalculations";
import type { BlsBenchmark } from "@/data/employerIntelligenceApi";

const industries = [
  { code: "23", label: "Construction" },
  { code: "31", label: "Manufacturing" },
  { code: "48", label: "Transportation" },
  { code: "62", label: "Healthcare" },
  { code: "21", label: "Mining" },
  { code: "22", label: "Utilities" },
  { code: "54", label: "Professional / Scientific / Technical" },
  { code: "72", label: "Accommodation & Food" },
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

function NotCalculated() {
  return <span className="text-cyan-50/42">Not calculated</span>;
}

export default function IndustryImpactCalculator() {
  const [naics, setNaics] = useState("");
  const [year, setYear] = useState("");
  const [loadedNaics, setLoadedNaics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [benchmark, setBenchmark] = useState<BlsBenchmark | null>(null);
  const [benchmarkMessage, setBenchmarkMessage] = useState("");

  const [workforce, setWorkforce] = useState(0);
  const [annualHours, setAnnualHours] = useState(0);
  const [observedCases, setObservedCases] = useState(0);
  const [observedDartCases, setObservedDartCases] = useState(0);
  const [observedDaysAwayCases, setObservedDaysAwayCases] = useState(0);
  const [eventsAvoided, setEventsAvoided] = useState(0);
  const [directCost, setDirectCost] = useState(0);
  const [indirectMultiplier, setIndirectMultiplier] = useState(0);
  const [profitMargin, setProfitMargin] = useState(0);
  const [manualTrc, setManualTrc] = useState(0);
  const [manualDart, setManualDart] = useState(0);
  const [manualDaysAway, setManualDaysAway] = useState(0);

  async function loadBenchmark(nextNaics?: string) {
    const query = (nextNaics ?? naics).trim();
    if (!query) return;
    setNaics(query);
    setLoadedNaics("");
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
      setLoadedNaics(query);
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

  const manualRatesActive = !benchmark && (manualTrc > 0 || manualDart > 0 || manualDaysAway > 0);
  const rates = {
    trc: benchmark?.trcRate ?? (manualTrc > 0 ? manualTrc : null),
    dart: benchmark?.dartRate ?? (manualDart > 0 ? manualDart : null),
    daysAway: benchmark?.daysAwayRate ?? (manualDaysAway > 0 ? manualDaysAway : null),
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

  const hasHours = annualHours > 0;
  const hasTrcBenchmark = typeof rates.trc === "number" && rates.trc > 0;
  const hasDartBenchmark = typeof rates.dart === "number" && rates.dart > 0;
  const hasDaysAwayBenchmark = typeof rates.daysAway === "number" && rates.daysAway > 0;
  const hasExpected = hasHours && hasTrcBenchmark;
  const hasObservedRate = hasHours;
  const hasCostScenario = eventsAvoided > 0 && directCost > 0;
  const hasRecovery = hasCostScenario && profitMargin > 0;

  const comparisonData = [
    hasTrcBenchmark && hasObservedRate
      ? { metric: "TRC", benchmark: rates.trc, scenario: result.observedTrir }
      : null,
    hasDartBenchmark && hasObservedRate
      ? { metric: "DART", benchmark: rates.dart, scenario: result.observedDartRate }
      : null,
    hasDaysAwayBenchmark && hasObservedRate
      ? {
          metric: "Days Away",
          benchmark: rates.daysAway,
          scenario: result.observedDaysAwayRate,
        }
      : null,
  ].filter(
    (
      item,
    ): item is { metric: string; benchmark: number; scenario: number } => item !== null,
  );

  const industryLabel =
    benchmark?.industryTitle ??
    industries.find((item) => item.code === naics)?.label ??
    (naics ? `NAICS ${naics}` : "Selected industry");

  return (
    <OccupationalToolShell
      eyebrow="Independent Intelligence Tool · Scenario Modeling"
      title="Industry Impact Calculator"
      subtitle="Scale an industry benchmark against anonymous workforce totals and separately model cost assumptions without presenting defaults as findings."
      notice="This calculator is independent. It does not inherit data from the Occupational Data Explorer, O*NET, a client profile, or another calculator. BLS rates are aggregate industry benchmarks. Cost and avoided-event fields are user-entered scenario assumptions and do not prove causation or savings."
    >
      <ToolHero
        kicker="Blank by design"
        title="Build the scenario from evidence you choose."
        description="Load a BLS benchmark or enter a manual rate, then add anonymous hours and case totals. Financial outputs stay uncalculated until you explicitly enter cost assumptions."
        accent="emerald"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/12 bg-black/20 p-3">
            <Users size={17} className="text-cyan-200/65" />
            <p className="mt-2 text-xl font-black text-white">{workforce > 0 ? workforce.toLocaleString() : "—"}</p>
            <p className="text-[9px] text-cyan-50/50">Entered workforce</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/20 p-3">
            <BriefcaseBusiness size={17} className="text-violet-200/65" />
            <p className="mt-2 text-xl font-black text-white">{hasExpected ? number(result.expectedRecordables) : "—"}</p>
            <p className="text-[9px] text-cyan-50/50">Benchmark-implied recordables</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/20 p-3">
            <CircleDollarSign size={17} className="text-emerald-200/65" />
            <p className="mt-2 text-xl font-black text-white">{hasCostScenario ? money(result.potentialAvoidedCost) : "—"}</p>
            <p className="text-[9px] text-cyan-50/50">Modeled cost amount</p>
          </div>
        </div>
      </ToolHero>

      <section className="grid gap-5 2xl:grid-cols-[.72fr_1.28fr]">
        <div className="space-y-5">
          <GlassCard className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Independent benchmark lookup</p>
                <h2 className="mt-1 text-lg font-black text-white">BLS SOII rate</h2>
              </div>
              <EvidenceGradeBadge grade={benchmark ? "A" : "Unavailable"} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {industries.map((industry) => (
                <button
                  key={industry.code}
                  type="button"
                  onClick={() => void loadBenchmark(industry.code)}
                  className={`rounded-xl border px-3 py-3 text-left text-xs transition ${loadedNaics === industry.code ? "border-emerald-200/28 bg-emerald-300/[0.09] text-white" : "border-white/10 bg-[#071321]/70 text-cyan-50/68 hover:border-emerald-200/18"}`}
                >
                  <span className="font-black">{industry.label}</span>
                  <span className="mt-1 block text-[9px] opacity-65">NAICS {industry.code}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_.55fr_auto] sm:items-end">
              <label>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-50/62">NAICS</span>
                <input value={naics} onChange={(event) => setNaics(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="2–6 digits" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" />
              </label>
              <label>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-50/62">Year</span>
                <input value={year} onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="Latest" className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#040c16]/92 px-3 text-sm text-white outline-none" />
              </label>
              <button type="button" onClick={() => void loadBenchmark()} disabled={loading || !naics.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200/22 bg-emerald-300/10 px-4 text-xs font-black text-white disabled:opacity-45">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Load
              </button>
            </div>
            {error ? <p className="mt-3 rounded-xl border border-rose-200/16 bg-rose-300/[0.04] p-3 text-xs leading-5 text-rose-50/75">{error}</p> : null}
            {!benchmark && benchmarkMessage ? <p className="mt-3 rounded-xl border border-amber-200/16 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-50/72">{benchmarkMessage}</p> : null}
            <p className="mt-3 text-[10px] leading-5 text-cyan-50/50">
              Public Administration is not a quick option because a government ownership selection is required for a defensible SOII comparison.
            </p>
          </GlassCard>

          {!benchmark ? (
            <GlassCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Optional manual benchmark</p>
                  <h2 className="mt-1 text-lg font-black text-white">Enter rates only if you have a source</h2>
                </div>
                <EvidenceGradeBadge grade="D" />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <NumberField label="TRC rate" value={manualTrc} onChange={setManualTrc} step={0.1} />
                <NumberField label="DART rate" value={manualDart} onChange={setManualDart} step={0.1} />
                <NumberField label="Days-away rate" value={manualDaysAway} onChange={setManualDaysAway} step={0.1} />
              </div>
              <p className="mt-3 text-[10px] leading-5 text-cyan-50/50">Zero means no manual benchmark entered. Manual values are scenario inputs, not source-verified by this calculator.</p>
            </GlassCard>
          ) : null}

          <GlassCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Anonymous workforce scenario</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <NumberField label="Workforce size" value={workforce} onChange={setWorkforce} suffix="workers" />
              <NumberField label="Annual hours worked" value={annualHours} onChange={setAnnualHours} step={10_000} suffix="hours" />
              <NumberField label="Observed recordable cases" value={observedCases} onChange={setObservedCases} hint="Aggregate count only." />
              <NumberField label="Observed DART cases" value={observedDartCases} onChange={setObservedDartCases} />
              <NumberField label="Observed days-away cases" value={observedDaysAwayCases} onChange={setObservedDaysAwayCases} />
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Optional financial scenario</p>
                <h2 className="mt-1 text-lg font-black text-white">No financial defaults</h2>
              </div>
              <EvidenceGradeBadge grade="D" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <NumberField label="Modeled events avoided" value={eventsAvoided} onChange={setEventsAvoided} />
              <NumberField label="Direct cost per event" value={directCost} onChange={setDirectCost} step={1_000} suffix="USD" />
              <NumberField label="Indirect multiplier" value={indirectMultiplier} onChange={setIndirectMultiplier} step={0.1} suffix="× direct" />
              <NumberField label="Profit margin" value={profitMargin} onChange={setProfitMargin} step={0.5} suffix="%" />
            </div>
            <p className="mt-3 text-[10px] leading-5 text-cyan-50/50">These values are entirely user-supplied. The tool performs arithmetic on them; it does not validate that an event was prevented or that a cost would have occurred.</p>
          </GlassCard>
        </div>

        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb label="Benchmark-implied cases" value={hasExpected ? number(result.expectedRecordables) : "—"} note={hasExpected ? `${industryLabel} rate × entered hours` : "Needs TRC rate + annual hours"} icon={BriefcaseBusiness} />
            <MetricOrb label="Observed TRIR" value={hasObservedRate ? number(result.observedTrir, 2) : "—"} note={hasObservedRate ? "From entered cases and hours" : "Needs annual hours"} icon={Gauge} tone="violet" />
            <MetricOrb label="Modeled cost amount" value={hasCostScenario ? money(result.potentialAvoidedCost) : "—"} note={hasCostScenario ? "Scenario arithmetic" : "Needs events + direct cost"} icon={CircleDollarSign} tone="emerald" />
            <MetricOrb label="Recovery revenue equivalent" value={hasRecovery ? money(result.revenueRequiredToRecover) : "—"} note={hasRecovery ? `At ${profitMargin}% entered margin` : "Needs cost scenario + margin"} icon={TrendingUp} tone="amber" />
          </section>

          <GlassCard className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Calculation state</p>
                <h2 className="mt-1 text-xl font-black text-white">What is actually supported right now</h2>
              </div>
              <EvidenceGradeBadge grade={benchmark ? "A" : manualRatesActive ? "D" : "Unavailable"} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#071321]/74 p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-50/50">Benchmark source</p>
                <p className="mt-2 text-sm font-black text-white">{benchmark ? `${benchmark.industryTitle} · ${benchmark.year}` : manualRatesActive ? "Manual rate input" : "None loaded"}</p>
                <p className="mt-2 text-xs leading-5 text-cyan-50/60">{benchmark ? benchmark.limitation : manualRatesActive ? "Manual rates are not independently verified by this calculator." : "Load BLS or enter a manual rate before interpreting benchmark-based outputs."}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#071321]/74 p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-50/50">Financial evidence</p>
                <p className="mt-2 text-sm font-black text-white">Scenario only</p>
                <p className="mt-2 text-xs leading-5 text-cyan-50/60">Financial fields remain separate from BLS. A BLS rate does not validate a cost per event, an indirect multiplier, or an avoided-event count.</p>
              </div>
            </div>
          </GlassCard>

          {comparisonData.length ? (
            <GlassCard className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Rate comparison</p>
              <div className="mt-3 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid stroke="rgba(165,243,252,.10)" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fill: "rgba(207,250,254,.7)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(207,250,254,.55)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(103,232,249,.2)", borderRadius: 12 }} />
                    <Bar dataKey="benchmark" name="Industry benchmark" fill="#67e8f9" radius={[7, 7, 2, 2]} />
                    <Bar dataKey="scenario" name="Entered aggregate scenario" fill="#a78bfa" radius={[7, 7, 2, 2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-7 text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-cyan-200/42" />
              <p className="mt-3 font-black text-white">Rate chart waiting for inputs</p>
              <p className="mt-2 text-xs text-cyan-50/55">A comparison appears only when annual hours and at least one benchmark rate are present.</p>
            </GlassCard>
          )}

          <GlassCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">Method trace</p>
                <h2 className="mt-1 text-lg font-black text-white">Every output is inspectable</h2>
              </div>
              <BookOpenCheck className="text-cyan-200/60" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#071321]/72 p-3 text-xs leading-6 text-cyan-50/68">Benchmark-implied cases = aggregate rate × annual hours ÷ 200,000.</div>
              <div className="rounded-xl border border-white/10 bg-[#071321]/72 p-3 text-xs leading-6 text-cyan-50/68">Observed incident rate = aggregate cases × 200,000 ÷ annual hours.</div>
              <div className="rounded-xl border border-white/10 bg-[#071321]/72 p-3 text-xs leading-6 text-cyan-50/68">Scenario cost amount = entered avoided events × entered direct cost × (1 + entered indirect multiplier).</div>
              <div className="rounded-xl border border-white/10 bg-[#071321]/72 p-3 text-xs leading-6 text-cyan-50/68">Recovery revenue equivalent = modeled cost amount ÷ entered profit margin.</div>
            </div>
            <p className="mt-4 text-xs leading-6 text-amber-50/70">None of these equations establishes causation. “Avoided events” is an input selected by the user, not an outcome inferred by the calculator.</p>
          </GlassCard>

          {!hasExpected && !hasObservedRate && !hasCostScenario ? (
            <div className="text-center text-xs text-cyan-50/42"><NotCalculated /></div>
          ) : null}
        </div>
      </section>
    </OccupationalToolShell>
  );
}
