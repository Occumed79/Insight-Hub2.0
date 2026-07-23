import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  Gauge,
  Loader2,
  Microscope,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  fetchBlsBenchmark,
  fetchOshaEstablishments,
  normalizeJob,
  resolveEmployer,
  scoreOpportunity,
  type BlsBenchmark,
  type EntityMatch,
  type JobNormalization,
  type OpportunityScore,
  type OshaEstablishment,
} from "@/data/employerIntelligenceApi";

const SESSION_COMPANY_KEY = "insight-hub.injury-workforce.company";
const SESSION_JOB_KEY = "insight-hub.injury-workforce.job";

const INTERPRETATION_WARNING =
  "This tool combines public OSHA establishment records, BLS industry benchmarks, and generalized O*NET occupation context. It does not calculate an employee's probability of injury, determine whether an employer is safe or unsafe, establish legal compliance, or replace worksite-specific assessment.";

type ConfidenceBand = "high" | "moderate" | "low";

type ExposureDefinition = {
  id: string;
  label: string;
  description: string;
  pattern: RegExp;
  serviceExamples: string[];
};

type ExposureSignal = {
  id: string;
  label: string;
  description: string;
  score: number;
  confidence: ConfidenceBand;
  evidence: string[];
  caseEvidence: string[];
  serviceExamples: string[];
};

type AnalysisResult = {
  employerName: string;
  jobTitle: string;
  state?: string;
  naics?: string;
  entity: EntityMatch | null;
  oshaRecords: OshaEstablishment[];
  blsBenchmark: BlsBenchmark | null;
  onetMapping: JobNormalization | null;
  opportunity: OpportunityScore | null;
  messages: string[];
  completedAt: string;
};

type EvidenceSelection =
  | { kind: "exposure"; value: ExposureSignal }
  | { kind: "establishment"; value: OshaEstablishment }
  | { kind: "benchmark"; value: BlsBenchmark }
  | null;

type SettledValue<T> = { data: T | null; error?: string };

const exposureDefinitions: ExposureDefinition[] = [
  {
    id: "manual-handling",
    label: "Manual handling",
    description: "Lifting, carrying, moving, pushing, pulling, and strength-intensive work context.",
    pattern: /lifting|carrying|handling|strength|pushing|pulling|moving objects|heavy objects/i,
    serviceExamples: ["Occupational physicals", "Functional capacity", "Return-to-work"],
  },
  {
    id: "repetition-posture",
    label: "Repetition & posture",
    description: "Repeated movement, bending, reaching, standing, walking, kneeling, or constrained posture.",
    pattern: /repetitive|bending|kneeling|crawling|reaching|using hands|standing|walking|awkward posture/i,
    serviceExamples: ["Functional capacity", "Ergonomic review", "Return-to-work"],
  },
  {
    id: "respiratory",
    label: "Respiratory context",
    description: "Dust, fumes, chemicals, vapors, contaminants, or respiratory-protection context.",
    pattern: /respirator|respiratory|contaminants|chemical|fumes|dust|airborne|vapors/i,
    serviceExamples: ["Respirator clearance", "Spirometry / PFT", "Medical surveillance"],
  },
  {
    id: "noise",
    label: "Noise & hearing",
    description: "Noise, loud equipment, auditory demand, or hearing-protection context.",
    pattern: /noise|hearing|auditory|loud|ear protection/i,
    serviceExamples: ["Audiograms", "Hearing conservation", "Medical surveillance"],
  },
  {
    id: "driving",
    label: "Driving & transport",
    description: "Vehicle operation, commercial driving, transportation, or sustained road-duty context.",
    pattern: /driving|vehicle|transportation|truck|bus|commercial driver|motor vehicle/i,
    serviceExamples: ["DOT / FMCSA exams", "Drug and alcohol screening", "Sleep-apnea screening"],
  },
  {
    id: "heights-equipment",
    label: "Heights & equipment",
    description: "Climbing, balance, high places, hazardous equipment, or protective-equipment context.",
    pattern: /high places|hazardous equipment|dangerous equipment|protective equipment|balance|climbing|heights/i,
    serviceExamples: ["Fitness-for-duty", "Occupational physicals", "Safety-sensitive screening"],
  },
  {
    id: "temperature",
    label: "Weather & temperature",
    description: "Outdoor work, heat, cold, weather, or temperature-extreme context.",
    pattern: /outdoors|weather|heat|hot|cold|temperature extremes/i,
    serviceExamples: ["Heat-stress surveillance", "Occupational physicals", "Medical surveillance"],
  },
  {
    id: "biological",
    label: "Biological exposure",
    description: "Disease, infection, blood, pathogens, biohazards, or close-contact exposure context.",
    pattern: /disease|infection|biohazard|blood|pathogen|biological|infectious/i,
    serviceExamples: ["Medical surveillance", "Immunization review", "Occupational physicals"],
  },
];

async function settle<T>(operation: () => Promise<T>): Promise<SettledValue<T>> {
  try {
    return { data: await operation() };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Request failed" };
  }
}

function normalizeNaics(value: string | undefined): string | undefined {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 2 ? digits.slice(0, 6) : undefined;
}

function mostCommonNaics(records: OshaEstablishment[]): string | undefined {
  const counts = new Map<string, number>();
  for (const record of records) {
    const naics = normalizeNaics(record.naics);
    if (!naics) continue;
    counts.set(naics, (counts.get(naics) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function confidenceBand(value: number): ConfidenceBand {
  if (value >= 0.72) return "high";
  if (value >= 0.44) return "moderate";
  return "low";
}

function confidenceTone(value: ConfidenceBand): string {
  if (value === "high") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (value === "moderate") return "border-amber-200/20 bg-amber-300/10 text-amber-100";
  return "border-rose-200/20 bg-rose-300/10 text-rose-100";
}

function parseProminence(indicator: string): number {
  const value = indicator.toLowerCase();
  if (/continually|almost continually|every day|daily|more than half the time/.test(value)) return 1;
  if (/weekly|once a week|about half the time|several times/.test(value)) return 0.78;
  if (/monthly|once a month|occasionally|less than half the time/.test(value)) return 0.56;
  if (/yearly|once a year|rarely/.test(value)) return 0.32;
  if (/never/.test(value)) return 0;
  return 0.5;
}

function buildExposureSignals(analysis: AnalysisResult): ExposureSignal[] {
  const onet = analysis.onetMapping;
  const indicators = onet
    ? [
      ...onet.physicalDemandIndicators,
      ...onet.environmentalIndicators,
      ...onet.safetySensitiveIndicators,
    ]
    : [];
  const caseCategories = analysis.oshaRecords.flatMap((record) => record.caseCategories ?? []);

  return exposureDefinitions.map((definition) => {
    const evidence = [...new Set(indicators.filter((indicator) => definition.pattern.test(indicator)))].slice(0, 8);
    const caseEvidence = [...new Set(caseCategories.filter((category) => definition.pattern.test(category)))].slice(0, 6);
    const prominence = evidence.length
      ? evidence.reduce((sum, item) => sum + parseProminence(item), 0) / evidence.length
      : 0;
    const supported = evidence.length > 0 || caseEvidence.length > 0;
    const score = supported
      ? Math.min(100, Math.round(22 + prominence * 36 + Math.min(evidence.length * 8, 32) + Math.min(caseEvidence.length * 5, 10)))
      : 0;
    const confidenceValue = Math.min(
      1,
      (onet?.confidence ?? 0) * 0.78
        + (caseEvidence.length > 0 ? 0.14 : 0)
        + (analysis.entity?.confidence ?? 0) * 0.08,
    );

    return {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      score,
      confidence: confidenceBand(confidenceValue),
      evidence,
      caseEvidence,
      serviceExamples: definition.serviceExamples,
    };
  }).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function averageReportedRate(records: OshaEstablishment[], key: "trcRate" | "dartRate" | "daysAwayRate"): number | undefined {
  const values = records.map((record) => record[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedRate(
  records: OshaEstablishment[],
  rateKey: "trcRate" | "dartRate" | "daysAwayRate",
  caseKey: "totalCases" | "dartCases" | "daysAwayCases",
): number | undefined {
  const usable = records.filter((record) =>
    typeof record.totalHoursWorked === "number"
      && record.totalHoursWorked > 0
      && typeof record[caseKey] === "number",
  );
  const hours = usable.reduce((sum, record) => sum + (record.totalHoursWorked ?? 0), 0);
  const cases = usable.reduce((sum, record) => sum + (record[caseKey] ?? 0), 0);
  if (hours > 0) return (cases * 200_000) / hours;
  return averageReportedRate(records, rateKey);
}

function formatRate(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "—";
}

function sourceDate(records: OshaEstablishment[]): string {
  const dates = records.map((record) => record.lastImportedDate).filter(Boolean).sort().reverse();
  return dates[0] || "Not available";
}

function metricDelta(selected: number | undefined, benchmark: number | undefined): string {
  if (selected === undefined || benchmark === undefined || benchmark === 0) return "No comparable rate";
  const delta = ((selected - benchmark) / benchmark) * 100;
  if (Math.abs(delta) < 1) return "Approximately benchmark";
  return `${Math.abs(delta).toFixed(0)}% ${delta > 0 ? "above" : "below"} benchmark`;
}

export default function OccupationalExposure() {
  const [companyName, setCompanyName] = useState(() => sessionStorage.getItem(SESSION_COMPANY_KEY) || "");
  const [jobTitle, setJobTitle] = useState(() => sessionStorage.getItem(SESSION_JOB_KEY) || "");
  const [state, setState] = useState("");
  const [naics, setNaics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceSelection>(null);
  const [establishmentFilter, setEstablishmentFilter] = useState("");

  const exposureSignals = useMemo(() => result ? buildExposureSignals(result) : [], [result]);
  const supportedExposureSignals = useMemo(() => exposureSignals.filter((signal) => signal.score > 0), [exposureSignals]);

  const publicRates = useMemo(() => {
    if (!result) return null;
    return {
      trc: weightedRate(result.oshaRecords, "trcRate", "totalCases"),
      dart: weightedRate(result.oshaRecords, "dartRate", "dartCases"),
      daysAway: weightedRate(result.oshaRecords, "daysAwayRate", "daysAwayCases"),
    };
  }, [result]);

  const rateChartData = useMemo(() => {
    if (!result || !publicRates) return [];
    return [
      { metric: "TRC", selected: publicRates.trc, benchmark: result.blsBenchmark?.trcRate },
      { metric: "DART", selected: publicRates.dart, benchmark: result.blsBenchmark?.dartRate },
      { metric: "Days away", selected: publicRates.daysAway, benchmark: result.blsBenchmark?.daysAwayRate },
    ];
  }, [publicRates, result]);

  const exposureChartData = useMemo(
    () => exposureSignals.slice(0, 8).map((signal) => ({ name: signal.label, score: signal.score })),
    [exposureSignals],
  );

  const visibleEstablishments = useMemo(() => {
    const query = establishmentFilter.trim().toLowerCase();
    if (!result || !query) return result?.oshaRecords ?? [];
    return result.oshaRecords.filter((record) => [
      record.establishmentName,
      record.companyName,
      record.dbaName,
      record.address,
      record.city,
      record.state,
      record.naics,
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [establishmentFilter, result]);

  async function runAnalysis() {
    const company = companyName.trim();
    const role = jobTitle.trim();
    if (!company || !role) {
      setError("Enter both a company name and a job title before running the analysis.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedEvidence(null);
    setEstablishmentFilter("");
    sessionStorage.setItem(SESSION_COMPANY_KEY, company);
    sessionStorage.setItem(SESSION_JOB_KEY, role);

    try {
      const [entitySettled, oshaSettled, onetSettled] = await Promise.all([
        settle(() => resolveEmployer({ companyName: company, state: state.trim() || undefined, naics: normalizeNaics(naics) })),
        settle(() => fetchOshaEstablishments({ company, state: state.trim() || undefined, naics: normalizeNaics(naics) })),
        settle(() => normalizeJob({ jobTitle: role, company, location: state.trim() || undefined })),
      ]);

      const entity = entitySettled.data?.ok ? entitySettled.data.entity : null;
      const oshaRecords = oshaSettled.data?.ok ? oshaSettled.data.records : [];
      const onetMapping = onetSettled.data?.ok ? onetSettled.data : null;
      const resolvedNaics = normalizeNaics(naics)
        || mostCommonNaics(oshaRecords)
        || entity?.naicsCodes?.map(normalizeNaics).find(Boolean);

      const blsSettled = resolvedNaics
        ? await settle(() => fetchBlsBenchmark({ naics: resolvedNaics }))
        : { data: null, error: "No NAICS code was available for BLS benchmarking." };
      const blsBenchmark = blsSettled.data?.ok ? blsSettled.data.benchmark : null;

      const opportunitySettled = await settle(() => scoreOpportunity({
        companyName: company,
        oshaEstablishments: oshaRecords,
        blsBenchmark,
        onetMapping,
        locationContext: state.trim() || undefined,
        entityConfidence: entity?.confidence,
      }));
      const opportunity = opportunitySettled.data?.ok ? opportunitySettled.data : null;

      const messages = [
        entitySettled.error,
        entitySettled.data && !entitySettled.data.ok ? entitySettled.data.error : undefined,
        oshaSettled.error,
        oshaSettled.data && !oshaSettled.data.ok ? oshaSettled.data.error || oshaSettled.data.warning : undefined,
        onetSettled.error,
        onetSettled.data && !onetSettled.data.ok ? onetSettled.data.error : undefined,
        blsSettled.error,
        blsSettled.data && !blsSettled.data.ok ? blsSettled.data.error || blsSettled.data.message : undefined,
        opportunitySettled.error,
        opportunitySettled.data && !opportunitySettled.data.ok ? opportunitySettled.data.error : undefined,
      ].filter((message): message is string => Boolean(message));

      setResult({
        employerName: company,
        jobTitle: role,
        state: state.trim() || undefined,
        naics: resolvedNaics,
        entity,
        oshaRecords,
        blsBenchmark,
        onetMapping,
        opportunity,
        messages: [...new Set(messages)],
        completedAt: new Date().toISOString(),
      });
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "The public-source analysis could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  function clearWorkspace() {
    setCompanyName("");
    setJobTitle("");
    setState("");
    setNaics("");
    setResult(null);
    setError(null);
    setSelectedEvidence(null);
    setEstablishmentFilter("");
    sessionStorage.removeItem(SESSION_COMPANY_KEY);
    sessionStorage.removeItem(SESSION_JOB_KEY);
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <HeaderBar
          eyebrow="Standalone Intelligence Tool"
          title="Injury & Workforce Exposure"
          subtitle="Compare public establishment injury records with industry benchmarks and modeled occupation-task exposure signals—without restoring static employer profiles."
        />

        <GlassCard className="mb-5 p-5 md:p-6">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.2fr_1.1fr_.55fr_.65fr_auto] xl:items-end">
            <Field label="Company or legal entity">
              <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                <Building2 size={17} className="text-cyan-100/45" />
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Company name"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/30"
                />
              </div>
            </Field>
            <Field label="Position or occupation">
              <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                <BriefcaseBusiness size={17} className="text-cyan-100/45" />
                <input
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") runAnalysis(); }}
                  placeholder="Job title"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/30"
                />
              </div>
            </Field>
            <Field label="State">
              <input
                value={state}
                onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))}
                placeholder="CA"
                className="min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-cyan-100/30 focus:border-cyan-200/30"
              />
            </Field>
            <Field label="NAICS optional">
              <input
                value={naics}
                onChange={(event) => setNaics(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Industry code"
                className="min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-cyan-100/30 focus:border-cyan-200/30"
              />
            </Field>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading || !companyName.trim() || !jobTitle.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-300/14 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Radar size={17} />}
              {loading ? "Analyzing…" : "Run analysis"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-100/8 pt-4">
            <p className="max-w-4xl text-xs leading-5 text-cyan-100/48">Manual run only. Company and position values remain in browser session storage and are not committed as a client roster.</p>
            {(result || companyName || jobTitle) && (
              <button type="button" onClick={clearWorkspace} className="text-xs font-semibold text-cyan-100/45 transition hover:text-cyan-50">Clear workspace</button>
            )}
          </div>
        </GlassCard>

        <GlassCard className="mb-5 border-amber-200/14 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-amber-100">Interpretation boundary</p>
              <p className="mt-1 text-xs leading-5 text-amber-100/62">{INTERPRETATION_WARNING}</p>
            </div>
          </div>
        </GlassCard>

        {error && (
          <GlassCard className="mb-5 border-rose-300/20 p-4">
            <div className="flex items-start gap-3 text-rose-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Analysis could not run</p>
                <p className="mt-1 text-xs leading-5 text-rose-100/65">{error}</p>
              </div>
            </div>
          </GlassCard>
        )}

        {!result && !loading && (
          <GlassCard className="p-10 text-center md:p-14">
            <Microscope className="mx-auto h-10 w-10 text-cyan-200/35" />
            <h2 className="mt-4 text-xl font-black text-white">One company. One role. Three evidence layers.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-cyan-100/52">Run a manual analysis to compare selected OSHA establishment records with BLS industry rates and O*NET-derived task context.</p>
          </GlassCard>
        )}

        {result && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<Database size={18} />} label="Public establishments" value={String(result.oshaRecords.length)} detail={`Latest import ${sourceDate(result.oshaRecords)}`} />
              <MetricCard icon={<BarChart3 size={18} />} label="Industry benchmark" value={result.blsBenchmark ? `${result.blsBenchmark.year}` : "Unavailable"} detail={result.blsBenchmark?.industryTitle || result.naics || "NAICS not resolved"} />
              <MetricCard icon={<Gauge size={18} />} label="Occupation confidence" value={result.onetMapping ? `${Math.round(result.onetMapping.confidence * 100)}%` : "Unavailable"} detail={result.onetMapping?.occupationFamily || result.onetMapping?.socCode || "O*NET mapping missing"} />
              <MetricCard icon={<Sparkles size={18} />} label="Service-fit signal" value={result.opportunity ? `${result.opportunity.score}` : "Unavailable"} detail={result.opportunity?.label || "Modeled opportunity score not returned"} />
            </div>

            {result.messages.length > 0 && (
              <GlassCard className="border-amber-200/12 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100/55">Partial-source notices</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {result.messages.map((message) => <p key={message} className="text-xs leading-5 text-amber-100/65">• {message}</p>)}
                </div>
              </GlassCard>
            )}

            <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
              <GlassCard className="p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Public injury-rate comparison</p>
                    <h2 className="mt-1 text-xl font-black text-white">Selected records vs. industry benchmark</h2>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-cyan-100/50">Selected-record rates are weighted from reported cases and hours when possible. They are not an employer-wide rate or safety grade.</p>
                  </div>
                  {result.blsBenchmark && (
                    <button type="button" onClick={() => setSelectedEvidence({ kind: "benchmark", value: result.blsBenchmark! })} className="rounded-xl border border-cyan-100/12 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-cyan-100/60 transition hover:text-white">View benchmark evidence</button>
                  )}
                </div>
                <div className="mt-5 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rateChartData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(165,243,252,.08)" vertical={false} />
                      <XAxis dataKey="metric" tick={{ fill: "rgba(207,250,254,.58)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(207,250,254,.45)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(165,243,252,.18)", borderRadius: 14, color: "white" }} />
                      <Bar dataKey="selected" name="Selected public records" fill="rgba(34,211,238,.72)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="benchmark" name="BLS industry benchmark" fill="rgba(52,211,153,.62)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <RateSummary label="TRC" selected={publicRates?.trc} benchmark={result.blsBenchmark?.trcRate} />
                  <RateSummary label="DART" selected={publicRates?.dart} benchmark={result.blsBenchmark?.dartRate} />
                  <RateSummary label="Days away" selected={publicRates?.daysAway} benchmark={result.blsBenchmark?.daysAwayRate} />
                </div>
              </GlassCard>

              <GlassCard className="p-5 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Source coverage</p>
                <h2 className="mt-1 text-xl font-black text-white">What this run actually found</h2>
                <div className="mt-5 space-y-3">
                  <CoverageRow label="Employer identity" available={Boolean(result.entity)} detail={result.entity ? `${result.entity.canonicalName} · ${Math.round(result.entity.confidence * 100)}% match confidence` : "No resolved entity returned"} />
                  <CoverageRow label="OSHA establishment data" available={result.oshaRecords.length > 0} detail={result.oshaRecords.length ? `${result.oshaRecords.length} public record${result.oshaRecords.length === 1 ? "" : "s"}` : "No matching public establishment records"} />
                  <CoverageRow label="BLS industry benchmark" available={Boolean(result.blsBenchmark)} detail={result.blsBenchmark ? `${result.blsBenchmark.industryTitle} · ${result.blsBenchmark.year}` : "Benchmark unavailable or NAICS unresolved"} />
                  <CoverageRow label="O*NET occupation context" available={Boolean(result.onetMapping)} detail={result.onetMapping ? `${result.onetMapping.socCode || "SOC not stated"} · ${Math.round(result.onetMapping.confidence * 100)}% confidence` : "Occupation mapping unavailable"} />
                </div>
                <div className="mt-5 rounded-2xl border border-cyan-100/10 bg-black/18 p-4">
                  <p className="text-xs font-semibold text-cyan-50">Resolved context</p>
                  <dl className="mt-3 grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 text-xs">
                    <dt className="text-cyan-100/40">Company</dt><dd className="text-cyan-50/80">{result.entity?.canonicalName || result.employerName}</dd>
                    <dt className="text-cyan-100/40">Role</dt><dd className="text-cyan-50/80">{result.jobTitle}</dd>
                    <dt className="text-cyan-100/40">NAICS</dt><dd className="text-cyan-50/80">{result.naics || "Not resolved"}</dd>
                    <dt className="text-cyan-100/40">Completed</dt><dd className="text-cyan-50/80">{new Date(result.completedAt).toLocaleString()}</dd>
                  </dl>
                </div>
              </GlassCard>
            </div>

            <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
              <GlassCard className="p-5 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Modeled task exposure</p>
                <h2 className="mt-1 text-xl font-black text-white">Which work contexts stand out</h2>
                <p className="mt-2 text-xs leading-5 text-cyan-100/50">Scores summarize matched O*NET indicators and any compatible OSHA case-category text. They are not injury probabilities.</p>
                <div className="mt-5 h-[330px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={exposureChartData} margin={{ top: 0, right: 14, left: 25, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(165,243,252,.08)" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: "rgba(207,250,254,.45)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={115} tick={{ fill: "rgba(207,250,254,.62)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip contentStyle={{ background: "#07111d", border: "1px solid rgba(165,243,252,.18)", borderRadius: 14, color: "white" }} />
                      <Bar dataKey="score" name="Modeled exposure signal" fill="rgba(129,140,248,.72)" radius={[0, 7, 7, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard className="p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Task-to-exposure review</p>
                    <h2 className="mt-1 text-xl font-black text-white">Evidence behind each signal</h2>
                  </div>
                  <span className="rounded-full border border-cyan-100/12 bg-white/[0.03] px-3 py-1 text-xs text-cyan-100/55">{supportedExposureSignals.length} supported</span>
                </div>
                <div className="mt-4 divide-y divide-cyan-100/8">
                  {exposureSignals.map((signal) => (
                    <button key={signal.id} type="button" onClick={() => setSelectedEvidence({ kind: "exposure", value: signal })} className="grid w-full grid-cols-[1fr_auto] gap-4 py-4 text-left transition hover:bg-white/[0.025]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{signal.label}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${confidenceTone(signal.confidence)}`}>{signal.confidence} confidence</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-cyan-100/48">{signal.description}</p>
                        <p className="mt-2 text-[11px] text-cyan-100/40">{signal.evidence.length + signal.caseEvidence.length} supporting evidence item{signal.evidence.length + signal.caseEvidence.length === 1 ? "" : "s"}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100/10 bg-black/20 text-sm font-black text-cyan-100">{signal.score}</div>
                    </button>
                  ))}
                </div>
              </GlassCard>
            </div>

            <GlassCard className="overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-cyan-100/9 p-5 md:flex-row md:items-end md:justify-between md:p-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Public establishment evidence</p>
                  <h2 className="mt-1 text-xl font-black text-white">Records included in the comparison</h2>
                  <p className="mt-2 text-xs leading-5 text-cyan-100/48">Click a row to inspect its source, year, hours, cases, and calculated rates.</p>
                </div>
                <div className="flex min-h-11 w-full max-w-sm items-center gap-2 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                  <Search size={15} className="text-cyan-100/40" />
                  <input value={establishmentFilter} onChange={(event) => setEstablishmentFilter(event.target.value)} placeholder="Filter records" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/30" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-black/20 text-[10px] uppercase tracking-[0.15em] text-cyan-100/38">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Establishment</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Year</th>
                      <th className="px-4 py-3 font-semibold">NAICS</th>
                      <th className="px-4 py-3 font-semibold">Hours</th>
                      <th className="px-4 py-3 font-semibold">TRC</th>
                      <th className="px-4 py-3 font-semibold">DART</th>
                      <th className="px-4 py-3 font-semibold">Days away</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-100/7">
                    {visibleEstablishments.map((record, index) => (
                      <tr key={`${record.establishmentName}-${record.address}-${record.year}-${index}`} onClick={() => setSelectedEvidence({ kind: "establishment", value: record })} className="cursor-pointer transition hover:bg-cyan-200/[0.035]">
                        <td className="px-5 py-4"><p className="font-semibold text-cyan-50">{record.establishmentName || record.companyName}</p><p className="mt-1 text-cyan-100/38">{record.dbaName || record.datasetName}</p></td>
                        <td className="px-4 py-4 text-cyan-100/60">{[record.city, record.state].filter(Boolean).join(", ") || record.address}</td>
                        <td className="px-4 py-4 text-cyan-100/60">{record.year}</td>
                        <td className="px-4 py-4 text-cyan-100/60">{record.naics || "—"}</td>
                        <td className="px-4 py-4 text-cyan-100/60">{record.totalHoursWorked?.toLocaleString() || "—"}</td>
                        <td className="px-4 py-4 font-semibold text-cyan-50">{formatRate(record.trcRate)}</td>
                        <td className="px-4 py-4 font-semibold text-cyan-50">{formatRate(record.dartRate)}</td>
                        <td className="px-4 py-4 font-semibold text-cyan-50">{formatRate(record.daysAwayRate)}</td>
                      </tr>
                    ))}
                    {visibleEstablishments.length === 0 && (
                      <tr><td colSpan={8} className="px-5 py-10 text-center text-cyan-100/45">No public establishment records matched this run or filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <div className="grid gap-5 xl:grid-cols-[1fr_.75fr]">
              <GlassCard className="p-5 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Service opportunity interpretation</p>
                <h2 className="mt-1 text-xl font-black text-white">Public-data-informed service fit</h2>
                <p className="mt-2 text-xs leading-5 text-cyan-100/48">These are modeled business-development signals, not medical recommendations or proof that a service is required.</p>
                <div className="mt-4 divide-y divide-cyan-100/8">
                  {(result.opportunity?.matchedServices ?? []).slice(0, 8).map((service) => (
                    <div key={`${service.service}-${service.reason}`} className="grid grid-cols-[1fr_auto] gap-4 py-4">
                      <div><p className="text-sm font-semibold text-white">{service.service}</p><p className="mt-1 text-xs leading-5 text-cyan-100/50">{service.reason}</p></div>
                      <div className="flex h-11 min-w-11 items-center justify-center rounded-xl border border-emerald-200/15 bg-emerald-300/8 px-3 text-xs font-black text-emerald-100">{service.fitScore}</div>
                    </div>
                  ))}
                  {!result.opportunity?.matchedServices?.length && <p className="py-8 text-sm text-cyan-100/45">No modeled service matches were returned.</p>}
                </div>
              </GlassCard>

              <GlassCard className="p-5 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Limitations & missing data</p>
                <h2 className="mt-1 text-xl font-black text-white">What still needs human review</h2>
                <div className="mt-4 space-y-3">
                  {(result.opportunity?.missingData ?? []).map((item) => <LimitationRow key={item} text={item} />)}
                  {(result.opportunity?.warnings ?? []).map((item) => <LimitationRow key={item} text={item} />)}
                  {!result.opportunity?.missingData?.length && !result.opportunity?.warnings?.length && <LimitationRow text="Confirm establishment identity, job duties, worksite conditions, and applicable medical-surveillance requirements before acting on modeled signals." />}
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </section>

      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/48 backdrop-blur-sm" onClick={() => setSelectedEvidence(null)}>
          <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-cyan-100/14 bg-[#050b15]/98 p-6 shadow-[-24px_0_80px_rgba(0,0,0,.48)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/42">Evidence drawer</p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {selectedEvidence.kind === "exposure" ? selectedEvidence.value.label : selectedEvidence.kind === "establishment" ? selectedEvidence.value.establishmentName : selectedEvidence.value.industryTitle}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedEvidence(null)} className="rounded-xl border border-cyan-100/12 bg-white/[0.03] p-2 text-cyan-100/55 transition hover:text-white"><X size={18} /></button>
            </div>

            {selectedEvidence.kind === "exposure" && <ExposureEvidence signal={selectedEvidence.value} />}
            {selectedEvidence.kind === "establishment" && <EstablishmentEvidence record={selectedEvidence.value} />}
            {selectedEvidence.kind === "benchmark" && <BenchmarkEvidence benchmark={selectedEvidence.value} />}
          </aside>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">{label}</span><div className="mt-2">{children}</div></label>;
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-100/10 bg-cyan-300/8 text-cyan-200">{icon}</div><CheckCircle2 size={16} className="text-emerald-300/50" /></div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-cyan-100/45">{detail}</p>
    </GlassCard>
  );
}

function RateSummary({ label, selected, benchmark }: { label: string; selected: number | undefined; benchmark: number | undefined }) {
  return (
    <div className="rounded-2xl border border-cyan-100/9 bg-black/18 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/40">{label}</p>
      <div className="mt-2 flex items-end gap-3"><p className="text-xl font-black text-cyan-50">{formatRate(selected)}</p><p className="pb-0.5 text-xs text-emerald-100/60">BLS {formatRate(benchmark)}</p></div>
      <p className="mt-2 text-[11px] text-cyan-100/40">{metricDelta(selected, benchmark)}</p>
    </div>
  );
}

function CoverageRow({ label, available, detail }: { label: string; available: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-cyan-100/9 bg-black/16 p-4">
      <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${available ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.5)]" : "bg-amber-300"}`} />
      <div><p className="text-sm font-semibold text-white">{label}</p><p className="mt-1 text-xs leading-5 text-cyan-100/48">{detail}</p></div>
    </div>
  );
}

function LimitationRow({ text }: { text: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-amber-200/10 bg-amber-300/[0.035] p-4"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300/70" /><p className="text-xs leading-5 text-amber-100/62">{text}</p></div>;
}

function ExposureEvidence({ signal }: { signal: ExposureSignal }) {
  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-2 gap-3"><EvidenceStat label="Signal" value={`${signal.score}/100`} /><EvidenceStat label="Confidence" value={signal.confidence} /></div>
      <EvidenceSection title="Interpretation"><p className="text-sm leading-6 text-cyan-100/62">{signal.description}</p></EvidenceSection>
      <EvidenceSection title="O*NET-derived indicators">
        {signal.evidence.length ? <ul className="space-y-2">{signal.evidence.map((item) => <li key={item} className="text-xs leading-5 text-cyan-100/65">• {item}</li>)}</ul> : <p className="text-xs text-cyan-100/42">No matching O*NET indicator was returned.</p>}
      </EvidenceSection>
      <EvidenceSection title="Compatible OSHA case-category text">
        {signal.caseEvidence.length ? <ul className="space-y-2">{signal.caseEvidence.map((item) => <li key={item} className="text-xs leading-5 text-cyan-100/65">• {item}</li>)}</ul> : <p className="text-xs text-cyan-100/42">No compatible case-category text was returned.</p>}
      </EvidenceSection>
      <EvidenceSection title="Possible service alignment"><div className="flex flex-wrap gap-2">{signal.serviceExamples.map((item) => <span key={item} className="rounded-full border border-cyan-100/12 bg-cyan-300/7 px-3 py-1.5 text-xs text-cyan-100/65">{item}</span>)}</div></EvidenceSection>
      <a href="https://www.onetonline.org/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-white">Open official O*NET source <ExternalLink size={15} /></a>
    </div>
  );
}

function EstablishmentEvidence({ record }: { record: OshaEstablishment }) {
  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-2 gap-3"><EvidenceStat label="Year" value={String(record.year)} /><EvidenceStat label="NAICS" value={record.naics || "—"} /></div>
      <EvidenceSection title="Establishment"><p className="text-sm leading-6 text-cyan-100/65">{record.companyName}{record.dbaName ? ` · DBA ${record.dbaName}` : ""}</p><p className="mt-2 text-xs leading-5 text-cyan-100/48">{[record.address, record.city, record.state, record.zip].filter(Boolean).join(", ")}</p></EvidenceSection>
      <EvidenceSection title="Reported activity">
        <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-2 text-xs">
          <dt className="text-cyan-100/40">Hours worked</dt><dd className="text-cyan-50/75">{record.totalHoursWorked?.toLocaleString() || "—"}</dd>
          <dt className="text-cyan-100/40">Total cases</dt><dd className="text-cyan-50/75">{record.totalCases ?? "—"}</dd>
          <dt className="text-cyan-100/40">DART cases</dt><dd className="text-cyan-50/75">{record.dartCases ?? "—"}</dd>
          <dt className="text-cyan-100/40">Days-away cases</dt><dd className="text-cyan-50/75">{record.daysAwayCases ?? "—"}</dd>
          <dt className="text-cyan-100/40">TRC rate</dt><dd className="text-cyan-50/75">{formatRate(record.trcRate)}</dd>
          <dt className="text-cyan-100/40">DART rate</dt><dd className="text-cyan-50/75">{formatRate(record.dartRate)}</dd>
          <dt className="text-cyan-100/40">Days-away rate</dt><dd className="text-cyan-50/75">{formatRate(record.daysAwayRate)}</dd>
        </dl>
      </EvidenceSection>
      <EvidenceSection title="Provenance"><p className="text-xs leading-5 text-cyan-100/55">{record.datasetName} · dataset year {record.datasetYear} · imported {record.lastImportedDate}</p></EvidenceSection>
      <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-white">Open official source <ExternalLink size={15} /></a>
    </div>
  );
}

function BenchmarkEvidence({ benchmark }: { benchmark: BlsBenchmark }) {
  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-2 gap-3"><EvidenceStat label="Year" value={String(benchmark.year)} /><EvidenceStat label="NAICS" value={benchmark.naics} /></div>
      <EvidenceSection title="Benchmark rates">
        <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-2 text-xs">
          <dt className="text-cyan-100/40">TRC rate</dt><dd className="text-cyan-50/75">{formatRate(benchmark.trcRate)}</dd>
          <dt className="text-cyan-100/40">DART rate</dt><dd className="text-cyan-50/75">{formatRate(benchmark.dartRate)}</dd>
          <dt className="text-cyan-100/40">Days-away rate</dt><dd className="text-cyan-50/75">{formatRate(benchmark.daysAwayRate)}</dd>
          <dt className="text-cyan-100/40">Fatality rate</dt><dd className="text-cyan-50/75">{formatRate(benchmark.fatalityRate)}</dd>
        </dl>
      </EvidenceSection>
      <EvidenceSection title="Source metadata"><p className="text-xs leading-5 text-cyan-100/55">{benchmark.sourceMetadata}</p></EvidenceSection>
      <EvidenceSection title="Limitation"><p className="text-xs leading-5 text-amber-100/62">{benchmark.limitation}</p></EvidenceSection>
      <a href={benchmark.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-white">Open official BLS source <ExternalLink size={15} /></a>
    </div>
  );
}

function EvidenceSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-cyan-100/10 bg-black/18 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">{title}</p><div className="mt-3">{children}</div></section>;
}

function EvidenceStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-cyan-100/10 bg-black/18 p-4"><p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/38">{label}</p><p className="mt-1 text-lg font-black capitalize text-white">{value}</p></div>;
}
