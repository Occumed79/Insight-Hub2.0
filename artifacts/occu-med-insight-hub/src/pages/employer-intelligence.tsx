import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  FileWarning,
  Gauge,
  Loader2,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  fetchBlsBenchmark,
  fetchOshaEstablishments,
  fetchSourcesStatus,
  fetchWorkersCompSources,
  normalizeJob,
  resolveEmployer,
  scoreOpportunity,
  type BlsBenchmark,
  type EntityMatch,
  type JobNormalization,
  type OpportunityScore,
  type OshaEstablishment,
  type SourceStatus,
  type WorkersCompSource,
} from "@/data/employerIntelligenceApi";

const DATA_WARNING =
  "Public injury, illness, workers’ compensation, litigation, and occupational-context data may be incomplete, delayed, jurisdiction-specific, or affected by reporting rules. This module identifies occupational-health service opportunity signals for review. It does not determine legal liability, negligence, safety compliance, or whether an employer is unsafe.";

const MODEL_WARNING =
  "BLS values are observed industry benchmarks when available. O*NET provides generalized occupation and work-context information. Task-level injury likelihood is a modeled interpretation for service planning, not a direct prediction for an individual worker or worksite.";

const SOURCE_EXCLUSIONS = /cms|provider data|hrsa|healthdata|hhs/i;

const RISK_COLORS = ["#38bdf8", "#2dd4bf", "#a78bfa", "#f59e0b", "#fb7185", "#34d399", "#60a5fa", "#c084fc"];

const exposureDefinitions = [
  {
    id: "manual-handling",
    label: "Manual material handling",
    pattern: /lifting|carrying|material handling|strength|heavy objects|moving objects/i,
    servicePattern: /fitness-for-duty|return-to-work|functional-capacity|physical-exams/i,
    weight: 0.94,
  },
  {
    id: "repetition-posture",
    label: "Repetition and posture",
    pattern: /repetitive|bending|kneeling|crawling|reaching|using hands|standing|walking/i,
    servicePattern: /functional-capacity|physical-exams|return-to-work/i,
    weight: 0.8,
  },
  {
    id: "driving",
    label: "Driving and vehicle operation",
    pattern: /driving|vehicle|transportation|truck|bus/i,
    servicePattern: /dot-exams|drug-screens|sleep-apnea/i,
    weight: 0.76,
  },
  {
    id: "respiratory",
    label: "Respiratory exposure",
    pattern: /respirator|respiratory|contaminants|chemical|fumes|dust/i,
    servicePattern: /respirator|pulmonary|medical-surveillance/i,
    weight: 0.91,
  },
  {
    id: "noise",
    label: "Noise and hearing exposure",
    pattern: /noise|hearing|auditory/i,
    servicePattern: /audiogram|hearing-conservation/i,
    weight: 0.78,
  },
  {
    id: "heights-equipment",
    label: "Heights and hazardous equipment",
    pattern: /high places|hazardous equipment|dangerous|protective equipment|keeping.*balance|climbing/i,
    servicePattern: /occupational-medical-surveillance|fitness-for-duty|physical-exams/i,
    weight: 0.9,
  },
  {
    id: "weather-temperature",
    label: "Weather and temperature",
    pattern: /outdoors|weather|heat|hot|cold/i,
    servicePattern: /heat-stress|annual-exams/i,
    weight: 0.66,
  },
  {
    id: "infection",
    label: "Disease and infection exposure",
    pattern: /disease|infection|biohazard|blood|pathogen/i,
    servicePattern: /medical-surveillance|labs|annual-exams/i,
    weight: 0.84,
  },
] as const;

type AnalysisResult = {
  employerName: string;
  state?: string;
  jobTitle?: string;
  naics?: string;
  entity: EntityMatch | null;
  oshaRecords: OshaEstablishment[];
  oshaWarning?: string;
  blsBenchmark: BlsBenchmark | null;
  onetMapping: JobNormalization | null;
  workersComp: WorkersCompSource | null;
  opportunity: OpportunityScore | null;
  messages: string[];
  completedAt: string;
};

type RiskPoint = {
  id: string;
  category: string;
  prominence: number;
  likelihood: number;
  serviceFit: number;
  confidence: "high" | "moderate" | "low";
  evidence: string[];
  sourceLabel: string;
};

type SettledValue<T> = { data: T | null; error?: string };

async function settle<T>(operation: () => Promise<T>): Promise<SettledValue<T>> {
  try {
    return { data: await operation() };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Request failed" };
  }
}

function mostCommonNaics(records: OshaEstablishment[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (!record.naics) continue;
    counts.set(record.naics, (counts.get(record.naics) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function parseProminence(indicator: string) {
  const value = indicator.toLowerCase();
  if (/continually|almost continually|every day|daily|more than half the time/.test(value)) return 5;
  if (/once a week|weekly|about half the time|several times/.test(value)) return 4;
  if (/once a month|monthly|less than half the time|occasionally/.test(value)) return 3;
  if (/once a year|yearly|rarely/.test(value)) return 2;
  if (/never/.test(value)) return 1;
  return 3;
}

function buildRiskPoints(onet: JobNormalization | null, bls: BlsBenchmark | null): RiskPoint[] {
  if (!onet) return [];

  const indicators = [
    ...onet.physicalDemandIndicators,
    ...onet.environmentalIndicators,
    ...onet.safetySensitiveIndicators,
  ];
  const tags = onet.serviceRelevanceTags;
  const benchmarkRate = Math.max(bls?.trcRate ?? 0, bls?.dartRate ?? 0, bls?.daysAwayRate ?? 0);
  const benchmarkIntensity = Math.min(benchmarkRate / 8, 1);

  return exposureDefinitions.flatMap((definition) => {
    const evidence = indicators.filter((indicator) => definition.pattern.test(indicator));
    const relatedTags = tags.filter((tag) => definition.servicePattern.test(tag));
    if (evidence.length === 0 && relatedTags.length === 0) return [];

    const prominence = evidence.length
      ? Math.round((evidence.reduce((sum, indicator) => sum + parseProminence(indicator), 0) / evidence.length) * 10) / 10
      : 2.5;
    const likelihood = Math.min(
      100,
      Math.round((prominence / 5) * 45 + definition.weight * 35 + benchmarkIntensity * 20),
    );
    const serviceFit = Math.min(100, Math.round(55 + relatedTags.length * 11 + definition.weight * 18));
    const confidence = bls && onet.confidence >= 0.65 ? "high" : onet.confidence >= 0.45 ? "moderate" : "low";

    return [{
      id: definition.id,
      category: definition.label,
      prominence,
      likelihood,
      serviceFit,
      confidence,
      evidence: evidence.length ? evidence.slice(0, 4) : relatedTags.map((tag) => `Service relevance: ${tag}`),
      sourceLabel: bls ? "O*NET work context + BLS industry benchmark" : "O*NET work context only",
    }];
  }).sort((a, b) => b.likelihood - a.likelihood);
}

function formatRate(value?: number) {
  return value === undefined ? "—" : value.toFixed(2);
}

function formatNumber(value?: number) {
  return value === undefined ? "—" : value.toLocaleString();
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.7) return "text-emerald-200 border-emerald-200/20 bg-emerald-300/10";
  if (confidence >= 0.4) return "text-amber-200 border-amber-200/20 bg-amber-300/10";
  return "text-rose-200 border-rose-200/20 bg-rose-300/10";
}

export default function EmployerIntelligence() {
  const [companyName, setCompanyName] = useState("");
  const [state, setState] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [naics, setNaics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);

  useEffect(() => {
    let active = true;
    void fetchSourcesStatus()
      .then((result) => {
        if (active && result.ok) setSourceStatuses(result.sources.filter((source) => !SOURCE_EXCLUSIONS.test(source.source)));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const riskPoints = useMemo(
    () => buildRiskPoints(analysis?.onetMapping ?? null, analysis?.blsBenchmark ?? null),
    [analysis?.onetMapping, analysis?.blsBenchmark],
  );

  async function runAnalysis() {
    const employer = companyName.trim();
    if (!employer) {
      setError("Enter an employer or DBA name.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    const stateCode = state.trim().toUpperCase();
    const requestedNaics = naics.trim();
    const requestedJob = jobTitle.trim();

    const [entityCall, oshaCall, onetCall, workersCompCall] = await Promise.all([
      settle(() => resolveEmployer({ companyName: employer, state: stateCode || undefined, naics: requestedNaics || undefined })),
      settle(() => fetchOshaEstablishments({ company: employer, state: stateCode || undefined, naics: requestedNaics || undefined })),
      requestedJob
        ? settle(() => normalizeJob({ jobTitle: requestedJob, company: employer, location: stateCode || undefined }))
        : Promise.resolve({ data: null } as SettledValue<JobNormalization>),
      stateCode
        ? settle(() => fetchWorkersCompSources(stateCode))
        : Promise.resolve({ data: null } as SettledValue<WorkersCompSource>),
    ]);

    const entity = entityCall.data?.ok ? entityCall.data.entity : null;
    const oshaRecords = oshaCall.data?.ok ? oshaCall.data.records : [];
    const onetMapping = onetCall.data?.ok ? onetCall.data : null;
    const workersComp = workersCompCall.data?.ok ? workersCompCall.data : null;
    const resolvedNaics = requestedNaics || entity?.naicsCodes?.[0] || mostCommonNaics(oshaRecords);

    const blsCall = resolvedNaics
      ? await settle(() => fetchBlsBenchmark({ naics: resolvedNaics }))
      : ({ data: null } as SettledValue<Awaited<ReturnType<typeof fetchBlsBenchmark>>>);
    const blsBenchmark = blsCall.data?.ok ? blsCall.data.benchmark : null;

    const scoreCall = await settle(() => scoreOpportunity({
      companyName: employer,
      oshaEstablishments: oshaRecords,
      blsBenchmark,
      onetMapping,
      workersCompNotes: workersComp,
      locationContext: stateCode || undefined,
      entityConfidence: entity?.confidence,
    }));
    const opportunity = scoreCall.data?.ok ? scoreCall.data : null;

    const messages = [
      entityCall.error,
      entityCall.data && !entityCall.data.ok ? entityCall.data.error : undefined,
      oshaCall.error,
      oshaCall.data && !oshaCall.data.ok ? oshaCall.data.error : undefined,
      onetCall.error,
      onetCall.data && !onetCall.data.ok ? onetCall.data.error : undefined,
      workersCompCall.error,
      workersCompCall.data && !workersCompCall.data.ok ? workersCompCall.data.error : undefined,
      blsCall.error,
      blsCall.data && !blsCall.data.ok ? blsCall.data.error : undefined,
      scoreCall.error,
      scoreCall.data && !scoreCall.data.ok ? scoreCall.data.error : undefined,
      oshaCall.data?.warning,
      blsCall.data?.message,
    ].filter((message): message is string => Boolean(message));

    setAnalysis({
      employerName: employer,
      state: stateCode || undefined,
      jobTitle: requestedJob || undefined,
      naics: resolvedNaics,
      entity,
      oshaRecords,
      oshaWarning: oshaCall.data?.warning,
      blsBenchmark,
      onetMapping,
      workersComp,
      opportunity,
      messages: [...new Set(messages)],
      completedAt: new Date().toISOString(),
    });
    setLoading(false);
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Employer Intelligence"
          title="Employer Injury & Service Opportunity Intelligence"
          subtitle="Resolve an employer, examine establishment injury records, compare industry benchmarks, translate a position through O*NET, and identify evidence-backed Occu-Med service opportunities in one analysis."
        />

        <GlassCard className="mb-6 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/70">{DATA_WARNING}</p>
          </div>
        </GlassCard>

        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[34px] border border-cyan-100/12 bg-[radial-gradient(circle_at_80%_20%,rgba(124,58,237,.18),transparent_32%),radial-gradient(circle_at_18%_70%,rgba(8,145,178,.18),transparent_34%),rgba(2,8,23,.78)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.35)] backdrop-blur-2xl md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,.04),transparent)]" />
          <div className="relative grid gap-7 xl:grid-cols-[1.15fr_.85fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-100/45">Unified evidence run</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
                One employer. One position. One source-aware opportunity lens.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-cyan-100/58">
                The analysis calls only Insight Hub’s server-side adapters. External credentials remain on the server, and partial source failures do not erase successful evidence.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <Field label="Employer or DBA" value={companyName} onChange={setCompanyName} placeholder="Example: V2X" />
                <Field label="Position / job title" value={jobTitle} onChange={setJobTitle} placeholder="Example: Aircraft mechanic" />
                <Field label="State" value={state} onChange={setState} placeholder="Example: VA" />
                <Field label="NAICS override" value={naics} onChange={setNaics} placeholder="Optional industry code" />
              </div>

              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading || !companyName.trim()}
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/20 bg-cyan-200/12 px-5 text-sm font-bold text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.10)] transition hover:bg-cyan-200/18 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
                {loading ? "Running source analysis…" : "Run employer analysis"}
              </button>

              {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
            </div>

            <div className="grid content-start gap-3 sm:grid-cols-2">
              <HeroPrinciple icon={<Database size={18} />} label="Observed" value="OSHA + BLS" note="Establishment records and industry benchmark values" />
              <HeroPrinciple icon={<BriefcaseBusiness size={18} />} label="Context" value="O*NET" note="Generalized occupation and work-context evidence" />
              <HeroPrinciple icon={<Sparkles size={18} />} label="Modeled" value="Task lens" note="Transparent interpretation, never presented as a direct fact" />
              <HeroPrinciple icon={<ShieldCheck size={18} />} label="Guardrail" value="Review signal" note="No legal, compliance, or unsafe-employer determination" />
            </div>
          </div>
        </motion.section>

        {!analysis && !loading && (
          <GlassCard className="mt-6 p-8 text-center">
            <Radar className="mx-auto h-9 w-9 text-cyan-200/35" />
            <p className="mt-3 text-sm font-semibold text-cyan-50">Ready for the first employer analysis</p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-100/45">
              Employer name is required. Position, state, and NAICS improve the O*NET, workers’ compensation, and benchmark layers.
            </p>
          </GlassCard>
        )}

        {analysis && (
          <div className="mt-8 space-y-8">
            <AnalysisSummary analysis={analysis} />

            {riskPoints.length > 0 ? (
              <PositionRiskLens analysis={analysis} points={riskPoints} />
            ) : analysis.jobTitle ? (
              <GlassCard className="border-amber-200/15 p-6">
                <div className="flex items-start gap-3">
                  <FileWarning className="mt-0.5 h-5 w-5 text-amber-300" />
                  <div>
                    <p className="font-semibold text-amber-100">Position Risk Lens unavailable</p>
                    <p className="mt-1 text-xs leading-6 text-amber-100/55">
                      No usable O*NET work-context indicators were returned for this position. The employer evidence remains available below.
                    </p>
                  </div>
                </div>
              </GlassCard>
            ) : null}

            <EvidenceGrid analysis={analysis} />
            <OpportunitySection analysis={analysis} />
            <SourceStatusSection statuses={sourceStatuses} />
          </div>
        )}

        <footer className="mt-10 border-t border-cyan-100/10 pt-4">
          <p className="text-[10px] leading-5 text-cyan-100/35">
            Sources and adapters in this module include OSHA ITA imports, BLS IIF/SOII benchmarks, O*NET Web Services, SAM.gov entity information, SEC EDGAR, CourtListener supporting signals, USAspending supporting context, and state workers’ compensation source indexes. Provider feasibility and procurement systems are excluded.
          </p>
        </footer>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/42">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder={placeholder}
        className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-cyan-50 outline-none transition placeholder:text-cyan-100/25 focus:border-cyan-200/30 focus:bg-black/28"
      />
    </label>
  );
}

function HeroPrinciple({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-cyan-100/10 bg-white/[0.035] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between text-cyan-100/50">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="mt-4 text-xl font-black text-white">{value}</p>
      <p className="mt-2 text-[11px] leading-5 text-cyan-100/42">{note}</p>
    </div>
  );
}

function AnalysisSummary({ analysis }: { analysis: AnalysisResult }) {
  const score = analysis.opportunity?.score;
  const confidence = analysis.opportunity?.sourceConfidence ?? analysis.entity?.confidence ?? 0;
  const totalCases = analysis.oshaRecords.reduce((sum, record) => sum + (record.totalCases ?? 0), 0);
  const totalHours = analysis.oshaRecords.reduce((sum, record) => sum + (record.totalHoursWorked ?? 0), 0);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/42">Analysis complete</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">{analysis.employerName}</h2>
          <p className="mt-2 text-xs text-cyan-100/45">
            {analysis.entity?.canonicalName ?? "Unresolved legal entity"}
            {analysis.state ? ` · ${analysis.state}` : ""}
            {analysis.naics ? ` · NAICS ${analysis.naics}` : ""}
            {analysis.jobTitle ? ` · ${analysis.jobTitle}` : ""}
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/30">
          {new Date(analysis.completedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={<Gauge size={17} />} label="Opportunity signal" value={score === undefined ? "—" : String(score)} note={analysis.opportunity?.label ?? "Not scored"} />
        <MetricCard icon={<ShieldCheck size={17} />} label="Source confidence" value={`${Math.round(confidence * 100)}%`} note={confidence >= 0.7 ? "High" : confidence >= 0.4 ? "Moderate" : "Low"} />
        <MetricCard icon={<Building2 size={17} />} label="OSHA establishments" value={String(analysis.oshaRecords.length)} note={`${formatNumber(totalCases)} recorded cases`} />
        <MetricCard icon={<Activity size={17} />} label="Hours represented" value={formatNumber(totalHours)} note="Across matched OSHA records" />
        <MetricCard icon={<Radar size={17} />} label="BLS TRC benchmark" value={formatRate(analysis.blsBenchmark?.trcRate)} note={analysis.blsBenchmark?.year ? String(analysis.blsBenchmark.year) : "Unavailable"} />
        <MetricCard icon={<BriefcaseBusiness size={17} />} label="Occupation match" value={analysis.onetMapping?.socCode ?? "—"} note={analysis.onetMapping?.occupationFamily ?? "No position supplied"} />
      </div>

      {analysis.messages.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200/12 bg-amber-200/[0.035] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/55">Partial-result and source notes</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {analysis.messages.map((message) => <p key={message} className="text-xs leading-5 text-amber-100/55">{message}</p>)}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between text-cyan-100/42">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-cyan-100/38">{note}</p>
    </GlassCard>
  );
}

function PositionRiskLens({ analysis, points }: { analysis: AnalysisResult; points: RiskPoint[] }) {
  return (
    <section className="overflow-hidden rounded-[34px] border border-violet-200/12 bg-[radial-gradient(circle_at_70%_20%,rgba(139,92,246,.16),transparent_36%),rgba(3,7,18,.72)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.30)] md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-violet-200/50">Position Risk Lens</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Injury likelihood vs. task and exposure profile</h2>
          <p className="mt-3 text-sm leading-7 text-cyan-100/52">{MODEL_WARNING}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${confidenceTone(analysis.onetMapping?.confidence ?? 0)}`}>
          O*NET confidence {Math.round((analysis.onetMapping?.confidence ?? 0) * 100)}%
        </span>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <div className="h-[430px] rounded-3xl border border-cyan-100/10 bg-black/18 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 24, right: 28, bottom: 30, left: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" strokeDasharray="4 5" />
              <XAxis
                type="number"
                dataKey="prominence"
                domain={[0, 5.4]}
                ticks={[1, 2, 3, 4, 5]}
                stroke="rgba(207,250,254,.35)"
                tick={{ fontSize: 10 }}
                label={{ value: "O*NET work-context prominence →", position: "insideBottom", offset: -18, fill: "rgba(207,250,254,.40)", fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="likelihood"
                domain={[0, 100]}
                stroke="rgba(207,250,254,.35)"
                tick={{ fontSize: 10 }}
                label={{ value: "Modeled injury-exposure likelihood →", angle: -90, position: "insideLeft", fill: "rgba(207,250,254,.40)", fontSize: 10 }}
              />
              <ZAxis type="number" dataKey="serviceFit" range={[180, 900]} />
              <Tooltip cursor={{ stroke: "rgba(167,139,250,.28)", strokeDasharray: "4 4" }} content={<RiskTooltip />} />
              <Scatter data={points}>
                {points.map((point, index) => <Cell key={point.id} fill={RISK_COLORS[index % RISK_COLORS.length]} fillOpacity={0.82} stroke="rgba(255,255,255,.55)" strokeWidth={1} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {points.slice(0, 6).map((point, index) => (
            <motion.article
              key={point.id}
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              className="rounded-3xl border border-cyan-100/10 bg-white/[0.035] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-cyan-50">{point.category}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100/35">{point.sourceLabel}</p>
                </div>
                <span className="text-xl font-black text-white">{point.likelihood}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300/70 via-violet-300/75 to-rose-300/75" style={{ width: `${point.likelihood}%` }} />
              </div>
              <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-cyan-100/45">{point.evidence[0]}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RiskTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: RiskPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="max-w-xs rounded-2xl border border-violet-200/20 bg-[#080b17]/95 p-4 shadow-2xl backdrop-blur-xl">
      <p className="text-sm font-bold text-white">{point.category}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <TooltipStat label="Prominence" value={point.prominence.toFixed(1)} />
        <TooltipStat label="Likelihood" value={String(point.likelihood)} />
        <TooltipStat label="Service fit" value={String(point.serviceFit)} />
      </div>
      <p className="mt-3 text-[10px] leading-5 text-cyan-100/48">{point.evidence.join(" · ")}</p>
      <p className="mt-2 text-[9px] uppercase tracking-[0.16em] text-violet-200/45">Modeled interpretation · {point.confidence} confidence</p>
    </div>
  );
}

function TooltipStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-2">
      <p className="text-[8px] uppercase tracking-[0.14em] text-cyan-100/35">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function EvidenceGrid({ analysis }: { analysis: AnalysisResult }) {
  const entity = analysis.entity;
  const bls = analysis.blsBenchmark;
  const onet = analysis.onetMapping;
  const workersComp = analysis.workersComp;

  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/42">Evidence layers</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Observed sources stay separate from modeled interpretation.</h2>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <EvidenceCard title="Employer identity" icon={<Building2 size={18} />} source={entity?.source ?? "Entity adapters"}>
          {entity ? (
            <div className="space-y-3">
              <KeyValue label="Canonical name" value={entity.canonicalName} />
              <KeyValue label="Match type" value={`${entity.matchType} · ${Math.round(entity.confidence * 100)}% confidence`} />
              <KeyValue label="DBA / aliases" value={[...entity.dbaNames, ...entity.aliases].filter((value, index, array) => array.indexOf(value) === index).slice(0, 8).join(", ") || "None returned"} />
              <KeyValue label="Identifiers" value={[entity.uei && `UEI ${entity.uei}`, entity.cage && `CAGE ${entity.cage}`, entity.cik && `CIK ${entity.cik}`, entity.ticker && `Ticker ${entity.ticker}`].filter(Boolean).join(" · ") || "None returned"} />
              {entity.evidenceFields.slice(0, 4).map((evidence) => <p key={evidence} className="text-[11px] leading-5 text-cyan-100/45">{evidence}</p>)}
            </div>
          ) : <EmptyEvidence text="No entity match was returned. Employer evidence may still exist under the exact search name." />}
        </EvidenceCard>

        <EvidenceCard title="BLS industry benchmark" icon={<Gauge size={18} />} source={bls?.source ?? "BLS IIF/SOII"} sourceUrl={bls?.sourceUrl}>
          {bls ? (
            <div>
              <div className="grid grid-cols-3 gap-3">
                <EvidenceMetric label="TRC rate" value={formatRate(bls.trcRate)} />
                <EvidenceMetric label="DART rate" value={formatRate(bls.dartRate)} />
                <EvidenceMetric label="Days-away rate" value={formatRate(bls.daysAwayRate)} />
              </div>
              <KeyValue label="Industry" value={bls.industryTitle} />
              <KeyValue label="NAICS / year" value={`${bls.naics} · ${bls.year}`} />
              <p className="mt-3 text-[11px] leading-5 text-amber-100/55">{bls.limitation}</p>
            </div>
          ) : <EmptyEvidence text="No BLS benchmark was returned. Provide a valid NAICS code or improve entity/OSHA matching." />}
        </EvidenceCard>

        <EvidenceCard title="O*NET occupation context" icon={<BriefcaseBusiness size={18} />} source="O*NET Web Services">
          {onet ? (
            <div className="space-y-3">
              <KeyValue label="Normalized occupation" value={onet.occupationMatches[0]?.title ?? onet.inputTitle} />
              <KeyValue label="SOC / family" value={`${onet.socCode ?? "Unknown"} · ${onet.occupationFamily ?? "Unknown family"}`} />
              <IndicatorGroup label="Physical demand" values={onet.physicalDemandIndicators} />
              <IndicatorGroup label="Environmental" values={onet.environmentalIndicators} />
              <IndicatorGroup label="Safety-sensitive" values={onet.safetySensitiveIndicators} />
            </div>
          ) : <EmptyEvidence text="No position was supplied or O*NET is not configured." />}
        </EvidenceCard>

        <EvidenceCard title="Workers’ compensation source coverage" icon={<ShieldCheck size={18} />} source={workersComp?.source ?? "State source index"}>
          {workersComp ? (
            <div className="space-y-3">
              <KeyValue label="State" value={workersComp.state} />
              <KeyValue label="Coverage" value={workersComp.coverageNotes} />
              <KeyValue label="Data level" value={workersComp.claimLevel ? "Claim-level source available" : workersComp.aggregate ? "Aggregate sources available" : "No indexed source"} />
              <p className="text-[11px] leading-5 text-amber-100/55">{workersComp.dataLimitations}</p>
              {workersComp.availableDatasets.map((dataset) => (
                <a key={dataset.url} href={dataset.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-cyan-100/8 bg-white/[0.025] px-3 py-2 text-xs text-cyan-100/60 hover:text-cyan-50">
                  <span>{dataset.name}</span><ExternalLink size={12} />
                </a>
              ))}
            </div>
          ) : <EmptyEvidence text="Enter a state to load workers’ compensation source coverage." />}
        </EvidenceCard>
      </div>

      <GlassCard className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">OSHA establishment records</p>
            <p className="mt-1 text-sm font-semibold text-cyan-50">{analysis.oshaRecords.length} matched record{analysis.oshaRecords.length === 1 ? "" : "s"}</p>
          </div>
          <a href="https://www.osha.gov/establishment-specific-injury-and-illness-data" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-cyan-200/60 hover:text-cyan-100">
            OSHA source <ExternalLink size={12} />
          </a>
        </div>
        {analysis.oshaRecords.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/35">
                <tr>
                  <th className="px-3 py-2">Establishment</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">NAICS</th>
                  <th className="px-3 py-2">TRC</th>
                  <th className="px-3 py-2">DART</th>
                  <th className="px-3 py-2">Cases</th>
                </tr>
              </thead>
              <tbody>
                {analysis.oshaRecords.slice(0, 20).map((record, index) => (
                  <tr key={`${record.establishmentName}-${record.year}-${index}`} className="border-t border-cyan-100/7 text-cyan-100/58">
                    <td className="px-3 py-3 font-semibold text-cyan-50">{record.establishmentName}</td>
                    <td className="px-3 py-3">{record.city}, {record.state}</td>
                    <td className="px-3 py-3">{record.year}</td>
                    <td className="px-3 py-3">{record.naics}</td>
                    <td className="px-3 py-3">{formatRate(record.trcRate)}</td>
                    <td className="px-3 py-3">{formatRate(record.dartRate)}</td>
                    <td className="px-3 py-3">{formatNumber(record.totalCases)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyEvidence text="No imported OSHA establishment records matched this employer and filter set." />}
      </GlassCard>
    </section>
  );
}

function EvidenceCard({ title, icon, source, sourceUrl, children }: { title: string; icon: React.ReactNode; source: string; sourceUrl?: string; children: React.ReactNode }) {
  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-200/8 text-cyan-200/70">{icon}</span>
          <div>
            <p className="font-bold text-cyan-50">{title}</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-cyan-100/32">Observed / source-backed</p>
          </div>
        </div>
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-cyan-200/45 hover:text-cyan-100">{source}<ExternalLink size={10} /></a>
        ) : <span className="text-[10px] text-cyan-100/30">{source}</span>}
      </div>
      {children}
    </GlassCard>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-cyan-100/7 py-2 first:border-t-0">
      <span className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/32">{label}</span>
      <span className="text-xs leading-5 text-cyan-100/62">{value}</span>
    </div>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100/8 bg-white/[0.025] p-3 text-center">
      <p className="text-[8px] uppercase tracking-[0.15em] text-cyan-100/32">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function IndicatorGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/32">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length ? values.slice(0, 6).map((value) => <span key={value} className="rounded-full border border-cyan-100/8 bg-white/[0.025] px-2.5 py-1 text-[10px] text-cyan-100/50">{value}</span>) : <span className="text-[10px] text-cyan-100/28">No indicators returned</span>}
      </div>
    </div>
  );
}

function EmptyEvidence({ text }: { text: string }) {
  return <p className="rounded-2xl border border-cyan-100/7 bg-black/12 p-4 text-xs leading-6 text-cyan-100/38">{text}</p>;
}

function OpportunitySection({ analysis }: { analysis: AnalysisResult }) {
  const opportunity = analysis.opportunity;
  if (!opportunity) return null;

  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/42">Occu-Med service opportunity</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <GlassCard className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/38">Business-development signal</p>
              <p className="mt-3 text-5xl font-black text-white">{opportunity.score}</p>
              <p className="mt-2 text-sm font-semibold text-cyan-100/65">{opportunity.label}</p>
            </div>
            <Gauge className="h-8 w-8 text-cyan-200/45" />
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-300/75 via-violet-300/75 to-emerald-300/75" style={{ width: `${opportunity.score}%` }} />
          </div>
          <p className="mt-4 text-xs leading-6 text-amber-100/55">{opportunity.warnings[0]}</p>
          {opportunity.missingData.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200/12 bg-amber-200/[0.03] p-3">
              <p className="text-[9px] uppercase tracking-[0.18em] text-amber-200/45">Missing evidence</p>
              {opportunity.missingData.map((item) => <p key={item} className="mt-1 text-[11px] leading-5 text-amber-100/48">{item}</p>)}
            </div>
          )}
        </GlassCard>

        <div className="grid gap-4 md:grid-cols-2">
          <GlassCard className="p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/38">Top evidence factors</p>
            <div className="mt-4 space-y-3">
              {opportunity.topFactors.map((factor) => (
                <div key={factor.factor} className="rounded-2xl border border-cyan-100/7 bg-white/[0.025] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs leading-5 text-cyan-100/58">{factor.factor}</p>
                    <span className="text-sm font-black text-cyan-50">+{factor.contribution}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/38">Matched Occu-Med services</p>
            <div className="mt-4 space-y-3">
              {opportunity.matchedServices.length ? opportunity.matchedServices.slice(0, 10).map((service) => (
                <div key={`${service.service}-${service.reason}`} className="rounded-2xl border border-emerald-100/8 bg-emerald-200/[0.025] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-emerald-50">{service.service}</p>
                      <p className="mt-1 text-[10px] leading-4 text-emerald-100/42">{service.reason}</p>
                    </div>
                    <span className="text-sm font-black text-emerald-100/75">{Math.round(service.fitScore)}</span>
                  </div>
                </div>
              )) : <EmptyEvidence text="No service mappings were produced. A position title usually improves this layer." />}
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}

function SourceStatusSection({ statuses }: { statuses: SourceStatus[] }) {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/42">Source registry</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Configuration, freshness, and limitations remain visible.</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {statuses.map((status) => (
          <GlassCard key={status.source} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-50">{status.source}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-cyan-100/32">{status.dataType}</p>
              </div>
              {status.configured && status.enabled ? <CheckCircle2 size={17} className="text-emerald-300/75" /> : <FileWarning size={17} className="text-amber-300/65" />}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-cyan-100/45">{status.notes}</p>
            {status.lastSync && <p className="mt-2 text-[9px] text-cyan-100/28">Last sync: {new Date(status.lastSync).toLocaleString()}</p>}
            {status.lastError && <p className="mt-2 text-[10px] text-rose-200/55">{status.lastError}</p>}
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
