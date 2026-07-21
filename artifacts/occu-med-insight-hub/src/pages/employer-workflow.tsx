import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Circle,
  FileSearch,
  Globe2,
  Hash,
  Loader2,
  MapPin,
  Network,
  Play,
  Radar,
  RefreshCcw,
  Route,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Link } from "wouter";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { useEmployerWorkflow } from "@/components/insight/EmployerWorkflowContext";
import {
  WORKFLOW_STEPS,
  buildWorkflowHref,
  type EmployerWorkflowContext,
  type WorkflowStepId,
} from "@/data/employerWorkflow";
import {
  runPublicEmployerBrief,
  type PublicEmployerBrief,
} from "@/data/publicEmployerBriefApi";
import {
  runCompanyLiveIntelligence,
  type CompanyLiveResponse,
} from "@/data/companyLiveIntelligenceApi";
import {
  runDbaIntelligence,
  type DbaIntelligenceResponse,
} from "@/data/dbaIntelligenceApi";
import {
  loadSourceGovernance,
  type SourceGovernanceResponse,
} from "@/data/sourceGovernanceApi";
import { cn } from "@/lib/utils";

const PUBLIC_SOURCE_NOTICE =
  "Public-source research only. Do not enter client, applicant, referral, pricing, provider-network, scheduling, case-management, medical, employee, or other internal operational information. Employer context stays in this browser tab and is never placed in the page URL.";

const INTERPRETATION_NOTICE =
  "Results are public-source research signals. They may be incomplete, delayed, suppressed, jurisdiction-specific, or affected by name matching. They do not establish liability, negligence, compliance, claim validity, employer safety, or medical necessity.";

const CONTEXT_FIELDS: Array<{
  key: keyof EmployerWorkflowContext;
  label: string;
  placeholder: string;
  icon: typeof Building2;
}> = [
  { key: "employer", label: "Public employer name", placeholder: "Enter the public company or organization name", icon: Building2 },
  { key: "legalName", label: "Resolved legal name", placeholder: "Populates after public entity resolution", icon: Network },
  { key: "state", label: "State code", placeholder: "Optional two-letter state code", icon: MapPin },
  { key: "jobTitle", label: "Public job title", placeholder: "Optional occupation or position title", icon: BriefcaseBusiness },
  { key: "naics", label: "NAICS", placeholder: "Optional public industry code", icon: Hash },
  { key: "country", label: "Country", placeholder: "Optional country for DBA context", icon: Globe2 },
];

const CORE_STEP_IDS: WorkflowStepId[] = [
  "employer-intelligence",
  "entity-resolution",
];

export default function EmployerWorkflow() {
  const {
    context,
    completedStepIds,
    updatedAt,
    updateContext,
    markStepComplete,
    reopenStep,
    clearWorkflow,
  } = useEmployerWorkflow();

  const [coreBrief, setCoreBrief] = useState<PublicEmployerBrief | null>(null);
  const [companyLive, setCompanyLive] = useState<CompanyLiveResponse | null>(null);
  const [dba, setDba] = useState<DbaIntelligenceResponse | null>(null);
  const [governance, setGovernance] = useState<SourceGovernanceResponse | null>(null);
  const [coreLoading, setCoreLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [dbaLoading, setDbaLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const completedCount = completedStepIds.length;
  const progress = Math.round((completedCount / WORKFLOW_STEPS.length) * 100);
  const hasEmployer = Boolean(context.employer.trim());

  const totalOshaCases = useMemo(
    () => coreBrief?.oshaRecords.reduce((sum, record) => sum + (record.totalCases ?? 0), 0) ?? 0,
    [coreBrief],
  );
  const totalOshaHours = useMemo(
    () => coreBrief?.oshaRecords.reduce((sum, record) => sum + (record.totalHoursWorked ?? 0), 0) ?? 0,
    [coreBrief],
  );

  function invalidateResults(): void {
    setCoreBrief(null);
    setCompanyLive(null);
    setDba(null);
    setGovernance(null);
    setErrors({});
    for (const step of WORKFLOW_STEPS) reopenStep(step.id);
  }

  function setContextField(key: keyof EmployerWorkflowContext, value: string): void {
    invalidateResults();
    updateContext({ [key]: key === "state" ? value.toUpperCase() : value });
  }

  async function runCoreBrief(): Promise<void> {
    if (!context.employer.trim()) {
      setErrors((current) => ({ ...current, core: "Enter a public employer name first." }));
      return;
    }

    setCoreLoading(true);
    setErrors((current) => ({ ...current, core: "" }));
    try {
      const [briefResult, governanceResult] = await Promise.all([
        runPublicEmployerBrief({
          employer: context.employer,
          state: context.state || undefined,
          jobTitle: context.jobTitle || undefined,
          naics: context.naics || undefined,
        }),
        loadSourceGovernance(),
      ]);

      setCoreBrief(briefResult);
      setGovernance(governanceResult);
      updateContext({
        legalName: briefResult.entity?.canonicalName || context.legalName,
        naics: briefResult.naics || context.naics,
      });

      for (const stepId of CORE_STEP_IDS) markStepComplete(stepId);
      if (context.jobTitle.trim()) markStepComplete("occupational-exposure");
      if (context.state.trim()) markStepComplete("workers-comp-coverage");
      markStepComplete("source-governance");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        core: error instanceof Error ? error.message : "Public-source brief failed.",
      }));
    } finally {
      setCoreLoading(false);
    }
  }

  async function runLiveScan(): Promise<void> {
    if (!context.employer.trim()) {
      setErrors((current) => ({ ...current, live: "Enter a public employer name first." }));
      return;
    }

    setLiveLoading(true);
    setErrors((current) => ({ ...current, live: "" }));
    try {
      const result = await runCompanyLiveIntelligence({
        companyName: context.legalName.trim() || context.employer.trim(),
        state: context.state.trim() || undefined,
      });
      setCompanyLive(result);
      markStepComplete("company-live-intelligence");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        live: error instanceof Error ? error.message : "Company live-intelligence scan failed.",
      }));
    } finally {
      setLiveLoading(false);
    }
  }

  async function runDbaScan(): Promise<void> {
    if (!context.employer.trim()) {
      setErrors((current) => ({ ...current, dba: "Enter a public employer name first." }));
      return;
    }

    setDbaLoading(true);
    setErrors((current) => ({ ...current, dba: "" }));
    try {
      const result = await runDbaIntelligence(context.legalName.trim() || context.employer.trim());
      setDba(result);
      markStepComplete("dba-intelligence");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        dba: error instanceof Error ? error.message : "Defense Base Act scan failed.",
      }));
    } finally {
      setDbaLoading(false);
    }
  }

  function handleClear(): void {
    if (typeof window !== "undefined" && !window.confirm("Clear this tab-scoped public-source workflow and all displayed results?")) return;
    clearWorkflow();
    setCoreBrief(null);
    setCompanyLive(null);
    setDba(null);
    setGovernance(null);
    setErrors({});
  }

  return (
    <main className="aurora-bg min-h-screen pb-32 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Unified Employer Workflow"
          title="Public-Source Employer Intelligence Brief"
          subtitle="Run substantive employer, entity, occupation, workers’ compensation, company-live, DBA, and source-governance intelligence from one command center, then open any detailed workspace for deeper review."
        />

        <GlassCard className="mb-6 border-rose-200/18 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
            <div>
              <p className="text-xs font-semibold text-rose-100">Public-source boundary</p>
              <p className="mt-1 text-xs leading-6 text-rose-100/62">{PUBLIC_SOURCE_NOTICE}</p>
            </div>
          </div>
        </GlassCard>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[34px] border border-cyan-100/14 bg-[radial-gradient(circle_at_78%_18%,rgba(124,58,237,.17),transparent_34%),radial-gradient(circle_at_14%_78%,rgba(8,145,178,.18),transparent_36%),rgba(2,8,23,.82)] p-5 shadow-[0_30px_100px_rgba(0,0,0,.42)] backdrop-blur-2xl md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.035),transparent)]" />
          <div className="relative grid gap-7 xl:grid-cols-[1.15fr_.85fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/14 bg-cyan-300/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/65">
                  <Route size={13} />
                  Substantive public-source run
                </span>
                <span className="rounded-full border border-emerald-200/14 bg-emerald-300/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/65">
                  Manual only
                </span>
              </div>
              <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-[-0.045em] text-white md:text-5xl">
                {hasEmployer ? context.employer : "Enter one public employer and build an evidence brief."}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-100/58">
                The baseline run resolves public entity evidence, searches imported OSHA records, compares BLS industry benchmarks, normalizes the occupation through O*NET, reviews state workers’ compensation source coverage, scores service-fit context, and verifies source governance. Company-live and DBA scans remain separate explicit actions.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <ActionButton
                  onClick={() => void runCoreBrief()}
                  loading={coreLoading}
                  disabled={!hasEmployer}
                  icon={<Play size={17} />}
                  label={coreBrief ? "Rerun public-source baseline" : "Run public-source baseline"}
                />
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-rose-200/12 bg-rose-300/[0.045] px-4 text-xs font-semibold text-rose-100/65 transition hover:bg-rose-300/[0.08]"
                >
                  <Trash2 size={15} />
                  Clear tab workflow
                </button>
              </div>
              {errors.core && <p className="mt-3 text-sm text-rose-200">{errors.core}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ProgressCard label="Public-source runs" value={`${completedCount}/${WORKFLOW_STEPS.length}`} progress={progress} note="Only successful manual runs count" />
              <ProgressCard label="Core evidence" value={coreBrief ? String(coreBrief.oshaRecords.length + (coreBrief.entity ? 1 : 0) + (coreBrief.blsBenchmark ? 1 : 0) + (coreBrief.onetMapping ? 1 : 0)) : "—"} progress={coreBrief ? Math.min(100, 25 + coreBrief.oshaRecords.length * 8) : 0} note="Entity, OSHA, BLS, and occupation evidence units" />
              <GlassCard className="p-4 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/40">Tab-scoped workflow</p>
                    <p className="mt-2 text-sm font-semibold text-cyan-50">{new Date(updatedAt).toLocaleString()}</p>
                    <p className="mt-1 text-[10px] text-cyan-100/36">No employer values are written to navigation URLs.</p>
                  </div>
                  <ShieldCheck className="h-6 w-6 text-cyan-100/35" />
                </div>
              </GlassCard>
            </div>
          </div>
        </motion.section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[.82fr_1.18fr]">
          <GlassCard className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-100/42">Public lookup context</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Employer research inputs</h2>
              </div>
              <Search className="h-5 w-5 text-cyan-200/40" />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {CONTEXT_FIELDS.map((field) => {
                const Icon = field.icon;
                return (
                  <label key={field.key} className="block">
                    <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/42">
                      <Icon size={13} />
                      {field.label}
                    </span>
                    <input
                      value={context[field.key]}
                      onChange={(event) => setContextField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-cyan-50 outline-none transition placeholder:text-cyan-100/24 focus:border-cyan-200/30 focus:bg-black/28"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-100/10 bg-cyan-300/[0.035] p-4">
              <p className="text-xs leading-6 text-cyan-100/48">
                Inputs are held in sessionStorage for this tab only. Closing the tab clears them. The former persistent workflow record is deleted automatically.
              </p>
            </div>
          </GlassCard>

          <section className="space-y-5">
            <SectionHeading eyebrow="Baseline results" title="Actual cross-workspace intelligence" note="Populates only after the manual baseline run" />
            {!coreBrief && !coreLoading ? (
              <GlassCard className="p-8 text-center">
                <Radar className="mx-auto h-10 w-10 text-cyan-100/30" />
                <p className="mt-3 text-sm font-semibold text-cyan-50">No public-source baseline has been run</p>
                <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-100/42">
                  Enter a public employer name, then run the baseline to generate real entity, injury-record, benchmark, occupation, state-source, service-fit, and source-governance summaries.
                </p>
              </GlassCard>
            ) : coreLoading ? (
              <LoadingCard label="Resolving and aggregating public sources…" />
            ) : coreBrief ? (
              <CoreBriefResults brief={coreBrief} governance={governance} totalCases={totalOshaCases} totalHours={totalOshaHours} />
            ) : null}
          </section>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <ManualScanPanel
            eyebrow="Current company signals"
            title="Company Live Intelligence"
            description="Manually scan configured public entity, filing, litigation-reference, and federal-award sources. This does not run with the baseline or during navigation."
            icon={<Activity size={20} />}
            loading={liveLoading}
            disabled={!hasEmployer}
            actionLabel={companyLive ? "Rerun company-live scan" : "Run company-live scan"}
            onRun={() => void runLiveScan()}
            error={errors.live}
          >
            {companyLive && <CompanyLiveSummary result={companyLive} />}
          </ManualScanPanel>

          <ManualScanPanel
            eyebrow="Defense Base Act"
            title="DOL DBA Intelligence"
            description="Manually scan official public DOL employer, carrier, country, waiver, jurisdiction, and performance sources. Suppressed values remain unknown, never zero."
            icon={<Globe2 size={20} />}
            loading={dbaLoading}
            disabled={!hasEmployer}
            actionLabel={dba ? "Rerun DBA scan" : "Run DBA scan"}
            onRun={() => void runDbaScan()}
            error={errors.dba}
          >
            {dba && <DbaSummary result={dba} country={context.country} />}
          </ManualScanPanel>
        </section>

        <section className="mt-8">
          <SectionHeading eyebrow="Detailed workspaces" title="Open the evidence, not another empty section" note="Routes open without employer values in the URL" />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {WORKFLOW_STEPS.map((step) => {
              const complete = completedStepIds.includes(step.id);
              return (
                <Link
                  key={step.id}
                  href={buildWorkflowHref(step.route, context)}
                  className="group rounded-3xl border border-cyan-100/10 bg-white/[0.035] p-4 transition hover:border-cyan-100/22 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/38">{step.number.toString().padStart(2, "0")}</span>
                    {complete ? <CheckCircle2 size={16} className="text-emerald-200" /> : <Circle size={16} className="text-cyan-100/24" />}
                  </div>
                  <p className="mt-4 text-sm font-bold text-white">{step.shortLabel}</p>
                  <p className="mt-2 text-[11px] leading-5 text-cyan-100/42">{step.output}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100/48 transition group-hover:text-cyan-50">
                    Open detail
                    <ArrowRight size={13} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <GlassCard className="mt-8 border-amber-200/14 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-6 text-amber-100/62">{INTERPRETATION_NOTICE}</p>
          </div>
        </GlassCard>
      </section>
    </main>
  );
}

function ActionButton({
  onClick,
  loading,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/14 px-5 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? <Loader2 size={17} className="animate-spin" /> : icon}
      {loading ? "Running public sources…" : label}
    </button>
  );
}

function ProgressCard({ label, value, progress, note }: { label: string; value: string; progress: number; note: string }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/40">{label}</p>
        <p className="text-xl font-black text-white">{value}</p>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cyan-100/8">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300/70 to-violet-300/70 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-[10px] leading-4 text-cyan-100/38">{note}</p>
    </GlassCard>
  );
}

function SectionHeading({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-100/42">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{title}</h2>
      </div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/30">{note}</p>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <GlassCard className="p-8 text-center">
      <Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-200/60" />
      <p className="mt-3 text-sm font-semibold text-cyan-50">{label}</p>
    </GlassCard>
  );
}

function CoreBriefResults({
  brief,
  governance,
  totalCases,
  totalHours,
}: {
  brief: PublicEmployerBrief;
  governance: SourceGovernanceResponse | null;
  totalCases: number;
  totalHours: number;
}) {
  const topServices = brief.opportunity?.matchedServices.slice(0, 5) ?? [];
  const topFactors = brief.opportunity?.topFactors.slice(0, 5) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Network size={16} />} label="Resolved entity" value={brief.entity?.canonicalName ?? "Unresolved"} note={`${Math.round((brief.entity?.confidence ?? 0) * 100)}% match confidence`} />
        <Metric icon={<Building2 size={16} />} label="OSHA establishments" value={String(brief.oshaRecords.length)} note={`${totalCases.toLocaleString()} reported cases · ${totalHours.toLocaleString()} hours`} />
        <Metric icon={<Activity size={16} />} label="BLS TRC benchmark" value={brief.blsBenchmark?.trcRate?.toFixed(2) ?? "—"} note={brief.blsBenchmark ? `${brief.blsBenchmark.industryTitle} · ${brief.blsBenchmark.year}` : "No benchmark returned"} />
        <Metric icon={<BriefcaseBusiness size={16} />} label="Occupation match" value={brief.onetMapping?.socCode ?? "—"} note={brief.onetMapping?.occupationFamily ?? "No position supplied or matched"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/38">Service opportunity context</p>
              <p className="mt-2 text-3xl font-black text-white">{brief.opportunity?.score ?? "—"}</p>
              <p className="mt-1 text-xs text-cyan-100/48">{brief.opportunity?.label ?? "No score returned"}</p>
            </div>
            <Radar className="h-8 w-8 text-violet-200/45" />
          </div>
          <div className="mt-4 space-y-2">
            {topServices.length > 0 ? topServices.map((service) => (
              <div key={service.service} className="rounded-2xl border border-violet-100/10 bg-violet-300/[0.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-violet-50">{service.service}</p>
                  <span className="text-xs font-black text-violet-100">{Math.round(service.fitScore)}</span>
                </div>
                <p className="mt-1 text-[10px] leading-5 text-violet-100/42">{service.reason}</p>
              </div>
            )) : <p className="text-xs text-cyan-100/38">No matched services returned.</p>}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/38">Evidence factors</p>
              <p className="mt-2 text-sm font-bold text-white">What moved the signal</p>
            </div>
            <FileSearch className="h-6 w-6 text-cyan-100/35" />
          </div>
          <div className="mt-4 space-y-2">
            {topFactors.length > 0 ? topFactors.map((factor) => (
              <div key={factor.factor} className="flex items-center justify-between gap-4 rounded-2xl border border-cyan-100/9 bg-white/[0.025] p-3">
                <p className="text-xs leading-5 text-cyan-50/72">{factor.factor}</p>
                <span className="shrink-0 text-xs font-black text-cyan-100">+{Math.round(factor.contribution)}</span>
              </div>
            )) : <p className="text-xs text-cyan-100/38">No scoring factors returned.</p>}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-5">
          <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/38">Workers’ compensation coverage</p>
          <p className="mt-3 text-lg font-black text-white">{brief.workersComp?.state || "No state"}</p>
          <p className="mt-2 text-xs leading-6 text-cyan-100/48">{brief.workersComp?.coverageNotes ?? "Add a state to inspect public source coverage."}</p>
          {brief.workersComp && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge label={brief.workersComp.claimLevel ? "Claim-oriented source" : "No claim-level source indexed"} active={brief.workersComp.claimLevel} />
              <Badge label={brief.workersComp.aggregate ? "Aggregate source" : "No aggregate source indexed"} active={brief.workersComp.aggregate} />
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/38">Source governance</p>
          <p className="mt-3 text-lg font-black text-white">{governance ? `${governance.summary.readySources}/${governance.summary.totalSources} ready` : "Unavailable"}</p>
          <p className="mt-2 text-xs leading-6 text-cyan-100/48">
            {governance ? `${governance.summary.partialSources} partial · ${governance.summary.disabledSources} disabled · ${governance.summary.notConfiguredSources} not configured` : "The governance overview did not return."}
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/38">Source status</p>
          <p className="mt-3 text-lg font-black text-white">{brief.sourceStatuses.filter((source) => source.enabled).length}/{brief.sourceStatuses.length} enabled</p>
          <div className="mt-3 space-y-2">
            {brief.sourceStatuses.slice(0, 5).map((source) => (
              <div key={source.source} className="flex items-center justify-between gap-3 text-[10px]">
                <span className="truncate text-cyan-100/52">{source.source}</span>
                <span className={source.enabled ? "text-emerald-200" : "text-amber-200"}>{source.enabled ? "Enabled" : "Unavailable"}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {brief.messages.length > 0 && (
        <GlassCard className="border-amber-200/14 p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200/55">Partial-source notes</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {brief.messages.map((message) => <p key={message} className="text-[11px] leading-5 text-amber-100/52">{message}</p>)}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function ManualScanPanel({
  eyebrow,
  title,
  description,
  icon,
  loading,
  disabled,
  actionLabel,
  onRun,
  error,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  loading: boolean;
  disabled: boolean;
  actionLabel: string;
  onRun: () => void;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <GlassCard className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/42">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{title}</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-100/12 bg-cyan-300/[0.07] text-cyan-100/55">{icon}</div>
      </div>
      <p className="mt-3 text-xs leading-6 text-cyan-100/48">{description}</p>
      <button
        type="button"
        onClick={onRun}
        disabled={loading || disabled}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cyan-100/18 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-50 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
        {loading ? "Running…" : actionLabel}
      </button>
      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
      {children && <div className="mt-5">{children}</div>}
    </GlassCard>
  );
}

function CompanyLiveSummary({ result }: { result: CompanyLiveResponse }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MiniMetric label="Signals" value={String(result.summary.signalCount)} />
        <MiniMetric label="Successful sources" value={`${result.summary.successfulSources}/${result.summary.attemptedSources}`} />
      </div>
      <div className="space-y-2">
        {result.sources.map((source) => (
          <div key={source.source} className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-100/9 bg-white/[0.025] p-3">
            <div>
              <p className="text-xs font-semibold text-cyan-50">{source.source}</p>
              <p className="mt-1 text-[10px] text-cyan-100/38">{source.resultCount} results · {source.latencyMs} ms</p>
            </div>
            <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", source.state === "success" ? "text-emerald-200" : source.state === "error" ? "text-rose-200" : "text-amber-200")}>{source.state}</span>
          </div>
        ))}
      </div>
      {result.signals.slice(0, 4).map((signal) => (
        <div key={signal.id} className="rounded-2xl border border-violet-100/10 bg-violet-300/[0.035] p-3">
          <p className="text-xs font-semibold text-violet-50">{signal.title}</p>
          <p className="mt-1 text-[10px] leading-5 text-violet-100/42">{signal.summary}</p>
        </div>
      ))}
    </div>
  );
}

function DbaSummary({ result, country }: { result: DbaIntelligenceResponse; country: string }) {
  const countryMatch = country.trim()
    ? result.caseReports.countries.find((record) => record.name.toLowerCase().includes(country.trim().toLowerCase()))
    : null;
  const employerMatches = result.caseReports.queryMatches.slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MiniMetric label="Employer matches" value={String(result.caseReports.queryMatches.length)} />
        <MiniMetric label="Active waivers" value={String(result.summary.activeWaivers)} />
      </div>
      {countryMatch && (
        <div className="rounded-2xl border border-cyan-100/10 bg-cyan-300/[0.035] p-3">
          <p className="text-xs font-semibold text-cyan-50">{countryMatch.name}</p>
          <p className="mt-1 text-[10px] text-cyan-100/42">Published cumulative cases: {countryMatch.counts.total ?? "Suppressed / unavailable"}</p>
        </div>
      )}
      {employerMatches.map((record) => (
        <div key={record.id} className="rounded-2xl border border-violet-100/10 bg-violet-300/[0.035] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-violet-50">{record.name}</p>
            <span className="text-xs font-black text-violet-100">{record.counts.total ?? "—"}</span>
          </div>
          <p className="mt-1 text-[10px] text-violet-100/42">Match {Math.round((record.matchScore ?? 0) * 100)}% · {record.suppressed ? "suppressed cells present" : "published values"}</p>
        </div>
      ))}
      {result.warnings.slice(0, 3).map((warning) => <p key={warning} className="text-[10px] leading-5 text-amber-100/48">{warning}</p>)}
    </div>
  );
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between text-cyan-100/42">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-4 truncate text-xl font-black text-white" title={value}>{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-cyan-100/38">{note}</p>
    </GlassCard>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100/9 bg-white/[0.025] p-3">
      <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/36">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function Badge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={cn(
      "rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]",
      active
        ? "border-emerald-200/18 bg-emerald-300/[0.08] text-emerald-100"
        : "border-cyan-100/10 bg-white/[0.025] text-cyan-100/38",
    )}>
      {label}
    </span>
  );
}
