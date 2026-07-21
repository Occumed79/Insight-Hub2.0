import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Database,
  Gauge,
  Grid3X3,
  Loader2,
  Radar,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
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

const INTERPRETATION_WARNING =
  "O*NET provides generalized occupational context. BLS values are industry benchmarks. OSHA records are establishment-level public records that may be incomplete or delayed. Exposure and service-fit scores are modeled research signals for business-development review, not worksite facts, medical determinations, safety ratings, compliance conclusions, or legal findings.";

type ConfidenceBand = "high" | "moderate" | "low";

type ServiceDefinition = {
  id: string;
  name: string;
  tags: string[];
  shortReason: string;
};

type ExposureDefinition = {
  id: string;
  label: string;
  description: string;
  pattern: RegExp;
  baseWeight: number;
  serviceIds: string[];
};

type ServiceFit = {
  serviceId: string;
  serviceName: string;
  fit: number;
  reason: string;
  evidence: string[];
};

type ExposureSignal = {
  id: string;
  label: string;
  description: string;
  signal: number;
  confidence: ConfidenceBand;
  confidenceScore: number;
  evidence: string[];
  missingEvidence: string[];
  serviceFits: ServiceFit[];
};

type RankedService = {
  serviceId: string;
  serviceName: string;
  fit: number;
  confidence: ConfidenceBand;
  contributingExposures: string[];
  evidence: string[];
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

type SettledValue<T> = { data: T | null; error?: string };

const services: ServiceDefinition[] = [
  {
    id: "physical-exams",
    name: "Occupational Physical Exams",
    tags: ["physical-exams", "annual-exams"],
    shortReason: "Baseline and periodic occupational-health evaluation",
  },
  {
    id: "fitness-for-duty",
    name: "Fitness-for-Duty Evaluations",
    tags: ["fitness-for-duty"],
    shortReason: "Role-specific physical and functional readiness review",
  },
  {
    id: "functional-capacity",
    name: "Functional Capacity Evaluations",
    tags: ["functional-capacity", "return-to-work"],
    shortReason: "Functional demand, recovery, and work-capacity assessment",
  },
  {
    id: "respirator",
    name: "Respirator Clearance & PFT",
    tags: ["respirator-clearance", "respirator-evaluations", "pulmonary-function"],
    shortReason: "Respiratory clearance, spirometry, and surveillance support",
  },
  {
    id: "hearing",
    name: "Audiograms & Hearing Conservation",
    tags: ["audiograms", "hearing-conservation"],
    shortReason: "Noise-exposure monitoring and hearing-conservation support",
  },
  {
    id: "dot",
    name: "DOT / FMCSA Exams",
    tags: ["dot-exams", "sleep-apnea-screening"],
    shortReason: "Transportation medical qualification and documentation",
  },
  {
    id: "drug-screening",
    name: "Drug & Alcohol Screening",
    tags: ["drug-screens"],
    shortReason: "Safety-sensitive and transportation screening support",
  },
  {
    id: "medical-surveillance",
    name: "Medical Surveillance",
    tags: ["osha-medical-surveillance", "occupational-medical-surveillance", "labs"],
    shortReason: "Hazard-specific exams, labs, and periodic monitoring",
  },
  {
    id: "heat-stress",
    name: "Heat-Stress Surveillance",
    tags: ["heat-stress-surveillance", "annual-exams"],
    shortReason: "Outdoor and temperature-exposure medical monitoring",
  },
  {
    id: "return-to-work",
    name: "Return-to-Work Evaluations",
    tags: ["return-to-work", "fitness-for-duty"],
    shortReason: "Evidence-informed work-status and recovery review",
  },
];

const exposureDefinitions: ExposureDefinition[] = [
  {
    id: "manual-handling",
    label: "Manual material handling",
    description: "Lifting, carrying, moving, strength, and material-handling context.",
    pattern: /lifting|carrying|material handling|strength|heavy objects|moving objects|handling objects/i,
    baseWeight: 0.94,
    serviceIds: ["physical-exams", "fitness-for-duty", "functional-capacity", "return-to-work"],
  },
  {
    id: "repetition-posture",
    label: "Repetition and posture",
    description: "Repeated motion, bending, reaching, standing, walking, kneeling, or constrained posture.",
    pattern: /repetitive|bending|kneeling|crawling|reaching|using hands|standing|walking|awkward posture/i,
    baseWeight: 0.8,
    serviceIds: ["physical-exams", "functional-capacity", "return-to-work"],
  },
  {
    id: "respiratory",
    label: "Respiratory exposure",
    description: "Dust, fumes, contaminants, chemicals, respiratory protection, or airborne exposure context.",
    pattern: /respirator|respiratory|contaminants|chemical|fumes|dust|airborne|vapors/i,
    baseWeight: 0.91,
    serviceIds: ["respirator", "medical-surveillance", "physical-exams"],
  },
  {
    id: "noise",
    label: "Noise and hearing",
    description: "Noise, auditory demand, hearing protection, or loud-equipment context.",
    pattern: /noise|hearing|auditory|loud|ear protection/i,
    baseWeight: 0.78,
    serviceIds: ["hearing", "medical-surveillance", "physical-exams"],
  },
  {
    id: "driving",
    label: "Driving and transportation",
    description: "Vehicle operation, transportation, commercial driving, or sustained road-duty context.",
    pattern: /driving|vehicle|transportation|truck|bus|commercial driver|motor vehicle/i,
    baseWeight: 0.76,
    serviceIds: ["dot", "drug-screening", "physical-exams"],
  },
  {
    id: "heights-equipment",
    label: "Heights and hazardous equipment",
    description: "Climbing, balance, high places, dangerous equipment, or protective-equipment context.",
    pattern: /high places|hazardous equipment|dangerous equipment|protective equipment|keeping.*balance|climbing|heights/i,
    baseWeight: 0.9,
    serviceIds: ["fitness-for-duty", "physical-exams", "medical-surveillance", "drug-screening"],
  },
  {
    id: "weather-temperature",
    label: "Weather and temperature",
    description: "Outdoor work, heat, cold, weather, or temperature-extreme context.",
    pattern: /outdoors|weather|heat|hot|cold|temperature extremes/i,
    baseWeight: 0.66,
    serviceIds: ["heat-stress", "physical-exams", "medical-surveillance"],
  },
  {
    id: "infection",
    label: "Biological and infectious exposure",
    description: "Disease, infection, blood, pathogens, biohazards, or close-contact exposure context.",
    pattern: /disease|infection|biohazard|blood|pathogen|biological|infectious/i,
    baseWeight: 0.84,
    serviceIds: ["medical-surveillance", "physical-exams"],
  },
];

async function settle<T>(operation: () => Promise<T>): Promise<SettledValue<T>> {
  try {
    return { data: await operation() };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Request failed" };
  }
}

function errorMessage(value: { ok: boolean; error?: string } | null): string | undefined {
  return value && !value.ok ? value.error : undefined;
}

function mostCommonNaics(records: OshaEstablishment[]): string | undefined {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (!record.naics) continue;
    counts.set(record.naics, (counts.get(record.naics) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function parseProminence(indicator: string): number {
  const value = indicator.toLowerCase();
  if (/continually|almost continually|every day|daily|more than half the time/.test(value)) return 1;
  if (/once a week|weekly|about half the time|several times/.test(value)) return 0.8;
  if (/once a month|monthly|less than half the time|occasionally/.test(value)) return 0.6;
  if (/once a year|yearly|rarely/.test(value)) return 0.35;
  if (/never/.test(value)) return 0;
  return 0.55;
}

function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.7) return "high";
  if (score >= 0.45) return "moderate";
  return "low";
}

function confidenceTone(confidence: ConfidenceBand): string {
  if (confidence === "high") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (confidence === "moderate") return "border-amber-200/20 bg-amber-300/10 text-amber-100";
  return "border-rose-200/20 bg-rose-300/10 text-rose-100";
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
  const tags = onet?.serviceRelevanceTags ?? [];
  const benchmarkRate = Math.max(
    analysis.blsBenchmark?.trcRate ?? 0,
    analysis.blsBenchmark?.dartRate ?? 0,
    analysis.blsBenchmark?.daysAwayRate ?? 0,
  );
  const oshaRates = analysis.oshaRecords
    .map((record) => Math.max(record.trcRate ?? 0, record.dartRate ?? 0, record.daysAwayRate ?? 0))
    .filter((value) => value > 0);
  const averageOshaRate = oshaRates.length > 0
    ? oshaRates.reduce((sum, value) => sum + value, 0) / oshaRates.length
    : 0;

  return exposureDefinitions.map((definition) => {
    const indicatorEvidence = indicators.filter((indicator) => definition.pattern.test(indicator));
    const categoryEvidence = caseCategories.filter((category) => definition.pattern.test(category));
    const relatedServices = services.filter((service) => definition.serviceIds.includes(service.id));
    const matchedTags = relatedServices.flatMap((service) => service.tags.filter((tag) => tags.includes(tag)));
    const evidence = [...new Set([...indicatorEvidence, ...categoryEvidence])].slice(0, 8);
    const supported = evidence.length > 0 || matchedTags.length > 0;
    const prominence = indicatorEvidence.length > 0
      ? indicatorEvidence.reduce((sum, indicator) => sum + parseProminence(indicator), 0) / indicatorEvidence.length
      : 0;
    const sourceConfidence = Math.min(
      1,
      (onet?.confidence ?? 0) * 0.55
        + (analysis.blsBenchmark ? 0.15 : 0)
        + (analysis.oshaRecords.length > 0 ? 0.15 : 0)
        + (analysis.entity?.confidence ?? 0) * 0.15,
    );
    const signal = supported
      ? Math.min(
        100,
        Math.round(
          definition.baseWeight * 30
            + prominence * 28
            + Math.min(evidence.length * 7, 21)
            + Math.min(matchedTags.length * 6, 12)
            + Math.min(benchmarkRate / 8, 1) * 5
            + Math.min(averageOshaRate / 10, 1) * 4,
        ),
      )
      : 0;

    const serviceFits = relatedServices.map((service) => {
      const directTagSupport = service.tags.some((tag) => tags.includes(tag));
      const fit = supported
        ? Math.min(
          100,
          Math.round(
            signal * 0.68
              + (directTagSupport ? 18 : 6)
              + (analysis.blsBenchmark ? 6 : 0)
              + (analysis.oshaRecords.length > 0 ? 6 : 0),
          ),
        )
        : 0;
      return {
        serviceId: service.id,
        serviceName: service.name,
        fit,
        reason: directTagSupport
          ? `${service.shortReason}; directly supported by returned O*NET service tags.`
          : `${service.shortReason}; modeled from the exposure category and available source context.`,
        evidence: evidence.slice(0, 4),
      };
    });

    const missingEvidence = [
      !onet ? "No usable O*NET occupation context was returned." : undefined,
      !analysis.blsBenchmark ? "No BLS industry benchmark was available." : undefined,
      analysis.oshaRecords.length === 0 ? "No matched OSHA establishment records were available." : undefined,
      !supported ? "No returned task, work-context, case-category, or service-tag evidence matched this exposure." : undefined,
    ].filter((value): value is string => Boolean(value));

    return {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      signal,
      confidence: confidenceBand(sourceConfidence),
      confidenceScore: sourceConfidence,
      evidence,
      missingEvidence,
      serviceFits,
    };
  });
}

function buildRankedServices(signals: ExposureSignal[]): RankedService[] {
  return services
    .map((service) => {
      const contributions = signals
        .map((signal) => ({
          exposure: signal,
          fit: signal.serviceFits.find((item) => item.serviceId === service.id),
        }))
        .filter((item): item is { exposure: ExposureSignal; fit: ServiceFit } => Boolean(item.fit && item.fit.fit > 0));

      if (contributions.length === 0) {
        return {
          serviceId: service.id,
          serviceName: service.name,
          fit: 0,
          confidence: "low" as const,
          contributingExposures: [],
          evidence: [],
        };
      }

      const sorted = contributions.sort((a, b) => b.fit.fit - a.fit.fit);
      const primary = sorted[0].fit.fit;
      const supportingAverage = sorted.length > 1
        ? sorted.slice(1).reduce((sum, item) => sum + item.fit.fit, 0) / (sorted.length - 1)
        : primary;
      const fit = Math.min(100, Math.round(primary * 0.75 + supportingAverage * 0.25));
      const confidenceScore = sorted.reduce((sum, item) => sum + item.exposure.confidenceScore, 0) / sorted.length;

      return {
        serviceId: service.id,
        serviceName: service.name,
        fit,
        confidence: confidenceBand(confidenceScore),
        contributingExposures: sorted.slice(0, 4).map((item) => item.exposure.label),
        evidence: [...new Set(sorted.flatMap((item) => item.fit.evidence))].slice(0, 6),
      };
    })
    .sort((a, b) => b.fit - a.fit);
}

function formatRate(value?: number): string {
  return value === undefined ? "—" : value.toFixed(2);
}

function formatNumber(value?: number): string {
  return value === undefined ? "—" : value.toLocaleString();
}

export default function OccupationalExposure() {
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [state, setState] = useState("");
  const [naics, setNaics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedExposure, setSelectedExposure] = useState("all");
  const [selectedService, setSelectedService] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | ConfidenceBand>("all");

  const exposureSignals = useMemo(
    () => analysis ? buildExposureSignals(analysis) : [],
    [analysis],
  );
  const rankedServices = useMemo(
    () => buildRankedServices(exposureSignals),
    [exposureSignals],
  );

  const visibleSignals = exposureSignals.filter((signal) => {
    if (selectedExposure !== "all" && signal.id !== selectedExposure) return false;
    if (confidenceFilter !== "all" && signal.confidence !== confidenceFilter) return false;
    if (selectedService !== "all" && !signal.serviceFits.some((fit) => fit.serviceId === selectedService && fit.fit > 0)) return false;
    return true;
  });

  const visibleServices = selectedService === "all"
    ? rankedServices.slice(0, 8)
    : rankedServices.filter((service) => service.serviceId === selectedService);

  const focusedExposure = exposureSignals.find((signal) => signal.id === selectedExposure)
    ?? exposureSignals.slice().sort((a, b) => b.signal - a.signal)[0]
    ?? null;
  const focusedService = rankedServices.find((service) => service.serviceId === selectedService)
    ?? rankedServices[0]
    ?? null;

  async function runAnalysis(): Promise<void> {
    const employer = companyName.trim();
    const position = jobTitle.trim();
    if (!employer || !position) {
      setError("Enter both an employer and a position / job title.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setSelectedExposure("all");
    setSelectedService("all");
    setConfidenceFilter("all");

    const stateCode = state.trim().toUpperCase();
    const requestedNaics = naics.trim();

    try {
      const [entityCall, oshaCall, onetCall] = await Promise.all([
        settle(() => resolveEmployer({
          companyName: employer,
          state: stateCode || undefined,
          naics: requestedNaics || undefined,
        })),
        settle(() => fetchOshaEstablishments({
          company: employer,
          state: stateCode || undefined,
          naics: requestedNaics || undefined,
        })),
        settle(() => normalizeJob({
          jobTitle: position,
          company: employer,
          location: stateCode || undefined,
        })),
      ] as const);

      const entity = entityCall.data?.ok ? entityCall.data.entity : null;
      const oshaRecords = oshaCall.data?.ok ? oshaCall.data.records : [];
      const onetMapping = onetCall.data?.ok ? onetCall.data : null;
      const resolvedNaics = requestedNaics || entity?.naicsCodes?.[0] || mostCommonNaics(oshaRecords);

      const blsCall: SettledValue<Awaited<ReturnType<typeof fetchBlsBenchmark>>> = resolvedNaics
        ? await settle(() => fetchBlsBenchmark({ naics: resolvedNaics }))
        : { data: null };
      const blsBenchmark = blsCall.data?.ok ? blsCall.data.benchmark : null;

      const scoreCall = await settle(() => scoreOpportunity({
        companyName: employer,
        oshaEstablishments: oshaRecords,
        blsBenchmark,
        onetMapping,
        locationContext: stateCode || undefined,
        entityConfidence: entity?.confidence,
      }));
      const opportunity = scoreCall.data?.ok ? scoreCall.data : null;

      const messages = [
        entityCall.error,
        errorMessage(entityCall.data),
        oshaCall.error,
        errorMessage(oshaCall.data),
        oshaCall.data?.warning,
        onetCall.error,
        errorMessage(onetCall.data),
        blsCall.error,
        errorMessage(blsCall.data),
        blsCall.data?.message,
        scoreCall.error,
        errorMessage(scoreCall.data),
      ].filter((message): message is string => Boolean(message));

      setAnalysis({
        employerName: employer,
        jobTitle: position,
        state: stateCode || undefined,
        naics: resolvedNaics,
        entity,
        oshaRecords,
        blsBenchmark,
        onetMapping,
        opportunity,
        messages: [...new Set(messages)],
        completedAt: new Date().toISOString(),
      });
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Exposure analysis could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Employer Intelligence"
          title="Occupational Exposure & Service Fit Matrix"
          subtitle="Translate occupation context, establishment evidence, and industry benchmarks into transparent, reviewable Occu-Med service-fit signals."
        />

        <GlassCard className="mb-6 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/70">{INTERPRETATION_WARNING}</p>
          </div>
        </GlassCard>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[34px] border border-cyan-100/12 bg-[radial-gradient(circle_at_78%_18%,rgba(99,102,241,.18),transparent_34%),radial-gradient(circle_at_16%_76%,rgba(13,148,136,.18),transparent_36%),rgba(2,8,23,.80)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.35)] backdrop-blur-2xl md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,.04),transparent)]" />
          <div className="relative grid gap-7 xl:grid-cols-[1.15fr_.85fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-100/42">Position-to-service intelligence</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
                See which occupational-health services align with the position context.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-cyan-100/55">
                The matrix preserves the evidence trail behind every modeled exposure and service-fit score, including missing sources and low-confidence results.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <Field label="Employer or DBA" value={companyName} onChange={setCompanyName} placeholder="Example: V2X" />
                <Field label="Position / job title" value={jobTitle} onChange={setJobTitle} placeholder="Example: Aircraft mechanic" />
                <Field label="State" value={state} onChange={setState} placeholder="Example: VA" />
                <Field label="NAICS override" value={naics} onChange={setNaics} placeholder="Optional industry code" />
              </div>

              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={loading || !companyName.trim() || !jobTitle.trim()}
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/20 bg-cyan-200/12 px-5 text-sm font-bold text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.10)] transition hover:bg-cyan-200/18 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
                {loading ? "Building exposure matrix…" : "Build exposure matrix"}
              </button>

              {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
            </div>

            <div className="grid content-start gap-3 sm:grid-cols-2">
              <HeroPrinciple icon={<BriefcaseBusiness size={18} />} label="Occupation" value="O*NET context" note="Tasks, physical demand, environment, and safety-sensitive indicators" />
              <HeroPrinciple icon={<Database size={18} />} label="Observed" value="OSHA + BLS" note="Establishment evidence and industry benchmark context" />
              <HeroPrinciple icon={<Grid3X3 size={18} />} label="Modeled" value="Service Fit Matrix" note="Explainable exposure-to-service alignment, never a direct worksite fact" />
              <HeroPrinciple icon={<ShieldCheck size={18} />} label="Guardrail" value="Human review" note="No safety, compliance, medical, or legal determination" />
            </div>
          </div>
        </motion.section>

        {!analysis && !loading && (
          <GlassCard className="mt-6 p-8 text-center">
            <Radar className="mx-auto h-9 w-9 text-cyan-200/35" />
            <p className="mt-3 text-sm font-semibold text-cyan-50">Ready to build the first exposure matrix</p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-100/45">
              Employer and position are required. State and NAICS improve establishment matching and benchmark context.
            </p>
          </GlassCard>
        )}

        {analysis && (
          <div className="mt-8 space-y-8">
            <AnalysisSummary analysis={analysis} signals={exposureSignals} rankedServices={rankedServices} />

            <section className="overflow-hidden rounded-[34px] border border-violet-200/12 bg-[radial-gradient(circle_at_72%_16%,rgba(139,92,246,.15),transparent_34%),rgba(3,7,18,.74)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.30)] md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-violet-100/42">Interactive exposure matrix</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Exposure signals mapped to Occu-Med services.</h2>
                  <p className="mt-3 text-xs leading-6 text-violet-100/48">
                    Select a row, service, or confidence band to narrow the matrix. A zero cell means no returned evidence supported that modeled connection in this run.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-violet-100/12 bg-white/[0.035] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-violet-100/48">
                  <SlidersHorizontal size={13} /> Review filters
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <SelectField
                  label="Exposure"
                  value={selectedExposure}
                  onChange={setSelectedExposure}
                  options={[{ value: "all", label: "All exposures" }, ...exposureSignals.map((signal) => ({ value: signal.id, label: signal.label }))]}
                />
                <SelectField
                  label="Service"
                  value={selectedService}
                  onChange={setSelectedService}
                  options={[{ value: "all", label: "All services" }, ...rankedServices.map((service) => ({ value: service.serviceId, label: service.serviceName }))]}
                />
                <SelectField
                  label="Confidence"
                  value={confidenceFilter}
                  onChange={(value) => setConfidenceFilter(value as "all" | ConfidenceBand)}
                  options={[
                    { value: "all", label: "All confidence bands" },
                    { value: "high", label: "High confidence" },
                    { value: "moderate", label: "Moderate confidence" },
                    { value: "low", label: "Low confidence" },
                  ]}
                />
              </div>

              <div className="mt-5 overflow-x-auto rounded-3xl border border-violet-100/10 bg-black/18">
                <div className="min-w-[1080px] p-4">
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `250px repeat(${Math.max(visibleServices.length, 1)}, minmax(92px, 1fr))` }}
                  >
                    <div className="flex items-end px-3 pb-2 text-[9px] uppercase tracking-[0.18em] text-violet-100/32">Exposure signal</div>
                    {visibleServices.map((service) => (
                      <button
                        key={service.serviceId}
                        type="button"
                        onClick={() => setSelectedService(service.serviceId)}
                        className="min-h-24 rounded-2xl border border-violet-100/8 bg-white/[0.025] p-2 text-left transition hover:border-violet-100/18 hover:bg-white/[0.05]"
                      >
                        <p className="text-[9px] font-semibold leading-4 text-violet-50/72">{service.serviceName}</p>
                        <p className="mt-2 text-xl font-black text-white">{service.fit || "—"}</p>
                      </button>
                    ))}

                    {visibleSignals.map((signal) => (
                      <MatrixRow
                        key={signal.id}
                        signal={signal}
                        services={visibleServices}
                        onSelectExposure={() => setSelectedExposure(signal.id)}
                        onSelectCell={(serviceId) => {
                          setSelectedExposure(signal.id);
                          setSelectedService(serviceId);
                        }}
                      />
                    ))}
                  </div>

                  {visibleSignals.length === 0 && (
                    <p className="p-8 text-center text-xs text-violet-100/38">No exposure rows match the active filters.</p>
                  )}
                </div>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
              <ExposureDrilldown signal={focusedExposure} />
              <ServiceDrilldown service={focusedService} />
            </div>

            <RankedServiceSection services={rankedServices} onSelect={setSelectedService} />
            <SourceEvidenceSection analysis={analysis} />
          </div>
        )}

        <footer className="mt-10 border-t border-cyan-100/10 pt-4">
          <p className="text-[10px] leading-5 text-cyan-100/35">
            This workspace uses only Insight Hub’s existing server-side employer, OSHA, BLS, O*NET, and opportunity-scoring adapters. Procurement, provider feasibility, healthcare catalogs, authentication, and multi-user architecture are excluded.
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
        placeholder={placeholder}
        className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-cyan-50 outline-none transition placeholder:text-cyan-100/25 focus:border-cyan-200/30 focus:bg-black/28"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-violet-100/38">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-2xl border border-violet-100/10 bg-[#070b16] px-3 text-xs text-violet-50 outline-none focus:border-violet-100/25"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function HeroPrinciple({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
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

function AnalysisSummary({ analysis, signals, rankedServices }: { analysis: AnalysisResult; signals: ExposureSignal[]; rankedServices: RankedService[] }) {
  const supportedSignals = signals.filter((signal) => signal.signal > 0);
  const topSignal = supportedSignals.slice().sort((a, b) => b.signal - a.signal)[0];
  const topService = rankedServices[0];
  const totalCases = analysis.oshaRecords.reduce((sum, record) => sum + (record.totalCases ?? 0), 0);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/42">Matrix complete</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">{analysis.jobTitle}</h2>
          <p className="mt-2 text-xs text-cyan-100/45">
            {analysis.entity?.canonicalName ?? analysis.employerName}
            {analysis.state ? ` · ${analysis.state}` : ""}
            {analysis.naics ? ` · NAICS ${analysis.naics}` : ""}
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/30">{new Date(analysis.completedAt).toLocaleString()}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={<Activity size={17} />} label="Supported exposures" value={String(supportedSignals.length)} note={`of ${signals.length} modeled categories`} />
        <MetricCard icon={<Radar size={17} />} label="Top exposure signal" value={topSignal ? String(topSignal.signal) : "—"} note={topSignal?.label ?? "No evidence-supported category"} />
        <MetricCard icon={<Sparkles size={17} />} label="Top service fit" value={topService?.fit ? String(topService.fit) : "—"} note={topService?.serviceName ?? "No supported service"} />
        <MetricCard icon={<Building2 size={17} />} label="OSHA establishments" value={String(analysis.oshaRecords.length)} note={`${formatNumber(totalCases)} recorded cases`} />
        <MetricCard icon={<Gauge size={17} />} label="BLS TRC benchmark" value={formatRate(analysis.blsBenchmark?.trcRate)} note={analysis.blsBenchmark?.year ? String(analysis.blsBenchmark.year) : "Unavailable"} />
        <MetricCard icon={<ShieldCheck size={17} />} label="Opportunity signal" value={analysis.opportunity ? String(analysis.opportunity.score) : "—"} note={analysis.opportunity?.label ?? "Not scored"} />
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

function MetricCard({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
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

function MatrixRow({ signal, services, onSelectExposure, onSelectCell }: { signal: ExposureSignal; services: RankedService[]; onSelectExposure: () => void; onSelectCell: (serviceId: string) => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onSelectExposure}
        className="rounded-2xl border border-violet-100/8 bg-white/[0.025] p-3 text-left transition hover:border-violet-100/18 hover:bg-white/[0.05]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-white">{signal.label}</p>
            <p className="mt-1 text-[10px] leading-4 text-violet-100/38">{signal.description}</p>
          </div>
          <span className={`rounded-full border px-2 py-1 text-[8px] uppercase tracking-[0.12em] ${confidenceTone(signal.confidence)}`}>
            {signal.confidence}
          </span>
        </div>
        <p className="mt-3 text-2xl font-black text-violet-50">{signal.signal || "—"}</p>
      </button>

      {services.map((service) => {
        const fit = signal.serviceFits.find((item) => item.serviceId === service.serviceId)?.fit ?? 0;
        const alpha = fit > 0 ? Math.max(0.08, fit / 230) : 0.02;
        return (
          <button
            key={`${signal.id}-${service.serviceId}`}
            type="button"
            onClick={() => onSelectCell(service.serviceId)}
            title={`${signal.label} → ${service.serviceName}: ${fit || "no supported fit"}`}
            className="group relative min-h-24 overflow-hidden rounded-2xl border border-violet-100/8 text-center transition hover:border-violet-100/24"
            style={{
              background: fit > 0
                ? `radial-gradient(circle at 50% 30%, rgba(255,255,255,.18), rgba(139,92,246,${alpha}) 42%, rgba(14,116,144,${alpha * 0.55}) 100%)`
                : "rgba(255,255,255,.018)",
            }}
          >
            <span className="text-xl font-black text-white">{fit || "—"}</span>
            <span className="absolute inset-x-2 bottom-2 text-[8px] uppercase tracking-[0.11em] text-violet-100/30 opacity-0 transition group-hover:opacity-100">Review evidence</span>
          </button>
        );
      })}
    </>
  );
}

function ExposureDrilldown({ signal }: { signal: ExposureSignal | null }) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/38">Exposure drill-down</p>
          <h3 className="mt-2 text-2xl font-black text-white">{signal?.label ?? "No exposure selected"}</h3>
        </div>
        {signal && <span className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] ${confidenceTone(signal.confidence)}`}>{signal.confidence} confidence</span>}
      </div>

      {signal ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-3xl border border-cyan-100/8 bg-white/[0.025] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/32">Modeled exposure signal</p>
                <p className="mt-2 text-5xl font-black text-white">{signal.signal || "—"}</p>
              </div>
              <p className="max-w-sm text-right text-xs leading-5 text-cyan-100/45">{signal.description}</p>
            </div>
          </div>

          <EvidenceList title="Returned evidence" values={signal.evidence} empty="No direct task, context, or case-category evidence supported this exposure." />
          <EvidenceList title="Limitations / missing evidence" values={signal.missingEvidence} empty="No additional missing-source warning was generated." />
        </div>
      ) : <p className="mt-5 text-xs text-cyan-100/38">Run an analysis to view exposure evidence.</p>}
    </GlassCard>
  );
}

function ServiceDrilldown({ service }: { service: RankedService | null }) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/38">Service opportunity drill-down</p>
          <h3 className="mt-2 text-2xl font-black text-white">{service?.serviceName ?? "No service selected"}</h3>
        </div>
        {service && <span className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] ${confidenceTone(service.confidence)}`}>{service.confidence} confidence</span>}
      </div>

      {service ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-3xl border border-cyan-100/8 bg-white/[0.025] p-5">
            <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/32">Modeled service fit</p>
            <p className="mt-2 text-5xl font-black text-white">{service.fit || "—"}</p>
          </div>
          <EvidenceList title="Contributing exposure categories" values={service.contributingExposures} empty="No evidence-supported exposure category contributed to this service." />
          <EvidenceList title="Evidence carried into fit" values={service.evidence} empty="No direct evidence was carried into this service fit." />
        </div>
      ) : <p className="mt-5 text-xs text-cyan-100/38">Run an analysis to view service-fit evidence.</p>}
    </GlassCard>
  );
}

function EvidenceList({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/32">{title}</p>
      <div className="mt-2 space-y-2">
        {values.length > 0
          ? values.map((value) => (
            <div key={value} className="flex items-start gap-2 rounded-2xl border border-cyan-100/7 bg-black/12 px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200/50" />
              <p className="text-[11px] leading-5 text-cyan-100/52">{value}</p>
            </div>
          ))
          : <p className="rounded-2xl border border-cyan-100/7 bg-black/12 p-3 text-[11px] leading-5 text-cyan-100/35">{empty}</p>}
      </div>
    </div>
  );
}

function RankedServiceSection({ services: ranked, onSelect }: { services: RankedService[]; onSelect: (serviceId: string) => void }) {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/42">Ranked Occu-Med service opportunities</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Highest supported service fits from this position context.</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ranked.slice(0, 9).map((service, index) => (
          <button key={service.serviceId} type="button" onClick={() => onSelect(service.serviceId)} className="text-left">
            <GlassCard className="h-full p-5 transition hover:-translate-y-0.5 hover:border-cyan-100/18">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/32">Rank {index + 1}</p>
                  <h3 className="mt-2 text-lg font-black text-white">{service.serviceName}</h3>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[8px] uppercase tracking-[0.12em] ${confidenceTone(service.confidence)}`}>{service.confidence}</span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-4">
                <p className="text-4xl font-black text-cyan-50">{service.fit || "—"}</p>
                <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/30">Modeled fit</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {service.contributingExposures.slice(0, 3).map((exposure) => <span key={exposure} className="rounded-full border border-cyan-100/8 bg-white/[0.025] px-2.5 py-1 text-[9px] text-cyan-100/45">{exposure}</span>)}
              </div>
            </GlassCard>
          </button>
        ))}
      </div>
    </section>
  );
}

function SourceEvidenceSection({ analysis }: { analysis: AnalysisResult }) {
  const onet = analysis.onetMapping;
  const bls = analysis.blsBenchmark;
  const totalHours = analysis.oshaRecords.reduce((sum, record) => sum + (record.totalHoursWorked ?? 0), 0);

  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/42">Observed source evidence</p>
      <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Modeled results remain traceable to each source layer.</h2>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <SourceCard icon={<BriefcaseBusiness size={18} />} title="O*NET occupation context" source="O*NET Web Services">
          <KeyValue label="Normalized occupation" value={onet?.occupationMatches[0]?.title ?? "Unavailable"} />
          <KeyValue label="SOC / family" value={onet ? `${onet.socCode ?? "Unknown"} · ${onet.occupationFamily ?? "Unknown family"}` : "Unavailable"} />
          <KeyValue label="Mapping confidence" value={onet ? `${Math.round(onet.confidence * 100)}%` : "Unavailable"} />
          <KeyValue label="Returned indicators" value={onet ? String(onet.physicalDemandIndicators.length + onet.environmentalIndicators.length + onet.safetySensitiveIndicators.length) : "0"} />
        </SourceCard>

        <SourceCard icon={<Building2 size={18} />} title="OSHA establishment evidence" source="OSHA ITA cached import">
          <KeyValue label="Matched records" value={String(analysis.oshaRecords.length)} />
          <KeyValue label="Hours represented" value={formatNumber(totalHours)} />
          <KeyValue label="Average TRC" value={analysis.oshaRecords.length > 0 ? formatRate(analysis.oshaRecords.reduce((sum, record) => sum + (record.trcRate ?? 0), 0) / analysis.oshaRecords.length) : "—"} />
          <KeyValue label="Data role" value="Observed establishment context; not a position-level prediction" />
        </SourceCard>

        <SourceCard icon={<Gauge size={18} />} title="BLS industry benchmark" source={bls?.source ?? "BLS IIF/SOII"}>
          <KeyValue label="Industry" value={bls?.industryTitle ?? "Unavailable"} />
          <KeyValue label="NAICS / year" value={bls ? `${bls.naics} · ${bls.year}` : "Unavailable"} />
          <KeyValue label="TRC / DART" value={bls ? `${formatRate(bls.trcRate)} / ${formatRate(bls.dartRate)}` : "Unavailable"} />
          <KeyValue label="Data role" value="Observed industry benchmark; not an employer-specific rate prediction" />
        </SourceCard>
      </div>
    </section>
  );
}

function SourceCard({ icon, title, source, children }: { icon: ReactNode; title: string; source: string; children: ReactNode }) {
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
        <span className="text-[10px] text-cyan-100/30">{source}</span>
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
