import { motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Flag,
  Globe2,
  Hash,
  MapPin,
  Network,
  Play,
  RotateCcw,
  Route,
  Sparkles,
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
  getMissingRequiredFields,
  workflowContextLabel,
  type EmployerWorkflowContext,
  type WorkflowStep,
} from "@/data/employerWorkflow";
import { cn } from "@/lib/utils";

const SCOPE_LABELS: Record<WorkflowStep["scope"], string> = {
  employer: "Employer-specific",
  "employer-position": "Employer + position",
  state: "State context",
  country: "Country / DBA context",
  system: "System-wide",
};

const CONTEXT_FIELDS: Array<{
  key: keyof EmployerWorkflowContext;
  label: string;
  placeholder: string;
  icon: typeof Building2;
}> = [
  { key: "employer", label: "Employer / searched name", placeholder: "Example: V2X", icon: Building2 },
  { key: "legalName", label: "Canonical / legal name", placeholder: "Add after entity resolution", icon: Network },
  { key: "state", label: "State", placeholder: "Example: VA", icon: MapPin },
  { key: "jobTitle", label: "Position / job title", placeholder: "Example: Aircraft mechanic", icon: BriefcaseBusiness },
  { key: "naics", label: "NAICS", placeholder: "Optional industry code", icon: Hash },
  { key: "country", label: "Country", placeholder: "Example: Kuwait", icon: Globe2 },
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

  const nextStep = WORKFLOW_STEPS.find((step) => !completedStepIds.includes(step.id)) ?? WORKFLOW_STEPS[0];
  const completedCount = completedStepIds.length;
  const progress = Math.round((completedCount / WORKFLOW_STEPS.length) * 100);
  const contextFieldsComplete = CONTEXT_FIELDS.filter((field) => context[field.key].trim()).length;
  const contextProgress = Math.round((contextFieldsComplete / CONTEXT_FIELDS.length) * 100);
  const hasEmployer = Boolean(context.employer.trim());

  function handleClear(): void {
    if (typeof window !== "undefined" && !window.confirm("Clear the current employer workflow and completion history?")) return;
    clearWorkflow();
  }

  return (
    <main className="aurora-bg min-h-screen pb-32 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Unified Employer Workflow"
          title="One employer context across every intelligence workspace"
          subtitle="Enter the employer once, preserve the working context locally, and move through entity, exposure, live-company, workers’ compensation, DBA, and source-governance intelligence in a deliberate sequence."
        />

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[34px] border border-cyan-100/14 bg-[radial-gradient(circle_at_78%_18%,rgba(124,58,237,.17),transparent_34%),radial-gradient(circle_at_14%_78%,rgba(8,145,178,.18),transparent_36%),rgba(2,8,23,.82)] p-5 shadow-[0_30px_100px_rgba(0,0,0,.42)] backdrop-blur-2xl md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.035),transparent)]" />
          <div className="relative grid gap-7 xl:grid-cols-[1.2fr_.8fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/14 bg-cyan-300/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/65">
                  <Route size={13} />
                  Employer journey
                </span>
                {hasEmployer && (
                  <span className="rounded-full border border-emerald-200/14 bg-emerald-300/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/65">
                    Resume available
                  </span>
                )}
              </div>
              <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-[-0.045em] text-white md:text-5xl">
                {hasEmployer ? context.employer : "Start with one employer. Keep the evidence connected."}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-100/58">
                Navigation never launches external requests automatically. Each intelligence workspace keeps its existing manual controls, while this workflow preserves the employer context and your place in the review.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={buildWorkflowHref(nextStep.route, context)}
                  className={cn(
                    "inline-flex min-h-12 items-center gap-2 rounded-2xl border px-5 text-sm font-bold transition",
                    hasEmployer || nextStep.requiredFields.length === 0
                      ? "border-cyan-200/22 bg-cyan-300/14 text-cyan-50 hover:bg-cyan-300/20"
                      : "pointer-events-none border-cyan-100/8 bg-white/[0.03] text-cyan-100/25",
                  )}
                >
                  <Play size={17} />
                  {completedCount > 0 ? `Resume at ${nextStep.shortLabel}` : "Begin workflow"}
                </Link>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-rose-200/12 bg-rose-300/[0.045] px-4 text-xs font-semibold text-rose-100/65 transition hover:bg-rose-300/[0.08]"
                >
                  <Trash2 size={15} />
                  Clear workflow
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ProgressCard label="Workflow progress" value={`${completedCount}/${WORKFLOW_STEPS.length}`} progress={progress} note={`${progress}% of review steps marked complete`} />
              <ProgressCard label="Context depth" value={`${contextFieldsComplete}/${CONTEXT_FIELDS.length}`} progress={contextProgress} note="More context improves handoffs between modules" />
              <GlassCard className="p-4 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/40">Last workflow update</p>
                    <p className="mt-2 text-sm font-semibold text-cyan-50">{new Date(updatedAt).toLocaleString()}</p>
                  </div>
                  <ClipboardCheck className="h-6 w-6 text-cyan-100/35" />
                </div>
              </GlassCard>
            </div>
          </div>
        </motion.section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[.92fr_1.08fr]">
          <GlassCard className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-100/42">Shared context</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Employer working record</h2>
              </div>
              <Sparkles className="h-5 w-5 text-cyan-200/40" />
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
                      onChange={(event) => updateContext({ [field.key]: field.key === "state" ? event.target.value.toUpperCase() : event.target.value })}
                      placeholder={field.placeholder}
                      className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-cyan-50 outline-none transition placeholder:text-cyan-100/24 focus:border-cyan-200/30 focus:bg-black/28"
                    />
                  </label>
                );
              })}
            </div>

            <label className="mt-4 block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/42">Workflow notes</span>
              <textarea
                value={context.notes}
                onChange={(event) => updateContext({ notes: event.target.value })}
                placeholder="Record identity questions, source gaps, follow-up needs, or decisions for this employer."
                rows={4}
                className="mt-2 w-full resize-y rounded-2xl border border-cyan-100/12 bg-black/20 px-4 py-3 text-sm leading-6 text-cyan-50 outline-none transition placeholder:text-cyan-100/24 focus:border-cyan-200/30 focus:bg-black/28"
              />
            </label>

            <div className="mt-4 rounded-2xl border border-cyan-100/10 bg-cyan-300/[0.035] p-4">
              <p className="text-xs leading-6 text-cyan-100/48">
                This context is stored only in this browser. It contains no API keys or source secrets and is not sent to the server until an existing workspace’s manual action is used.
              </p>
            </div>
          </GlassCard>

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-100/42">Guided sequence</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Connected intelligence journey</h2>
              </div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/32">Manual navigation · no auto-run</p>
            </div>

            <div className="relative space-y-3 before:absolute before:bottom-8 before:left-[23px] before:top-8 before:w-px before:bg-gradient-to-b before:from-cyan-300/30 before:via-violet-300/20 before:to-transparent">
              {WORKFLOW_STEPS.map((step) => (
                <WorkflowStepCard
                  key={step.id}
                  step={step}
                  context={context}
                  complete={completedStepIds.includes(step.id)}
                  onComplete={() => markStepComplete(step.id)}
                  onReopen={() => reopenStep(step.id)}
                />
              ))}
            </div>
          </section>
        </section>

        <GlassCard className="mt-8 border-violet-200/12 p-5 md:p-6">
          <div className="grid gap-5 md:grid-cols-3">
            <Principle icon={<Flag size={18} />} title="Deliberate sequence" text="Start broad, resolve identity, model exposure, add live context, then review state, DBA, and source-governance layers." />
            <Principle icon={<CheckCircle2 size={18} />} title="Human completion" text="A step is complete only when you mark it complete. Navigation alone never implies that evidence was reviewed." />
            <Principle icon={<RotateCcw size={18} />} title="Reopen anytime" text="Employer names, states, positions, and sources change. Reopen any step without losing the rest of the workflow." />
          </div>
        </GlassCard>

        <footer className="mt-8 border-t border-cyan-100/10 pt-4">
          <p className="text-[10px] leading-5 text-cyan-100/34">
            The workflow connects existing intelligence modules without changing their source contracts, evidence standards, manual-run behavior, or limitations. Completion status is an organizational aid, not a legal, safety, compliance, medical, or claims determination.
          </p>
        </footer>
      </section>
    </main>
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

function WorkflowStepCard({
  step,
  context,
  complete,
  onComplete,
  onReopen,
}: {
  step: WorkflowStep;
  context: EmployerWorkflowContext;
  complete: boolean;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const missing = getMissingRequiredFields(step, context);
  const ready = missing.length === 0;

  return (
    <GlassCard className={cn("relative ml-12 overflow-hidden p-4 transition", complete && "border-emerald-200/16 bg-emerald-300/[0.035]") }>
      <div className={cn(
        "absolute -left-[41px] top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black shadow-[0_0_22px_rgba(34,211,238,.12)]",
        complete
          ? "border-emerald-200/30 bg-emerald-300/18 text-emerald-100"
          : ready
            ? "border-cyan-200/24 bg-cyan-300/14 text-cyan-50"
            : "border-amber-200/18 bg-amber-300/10 text-amber-100/65",
      )}>
        {complete ? <Check size={15} /> : step.number}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-white">{step.label}</p>
            <span className="rounded-full border border-cyan-100/10 bg-white/[0.035] px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-cyan-100/42">
              {SCOPE_LABELS[step.scope]}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-cyan-100/48">{step.purpose}</p>
          <p className="mt-2 text-[10px] leading-5 text-violet-100/42"><span className="font-semibold text-violet-100/60">Expected output:</span> {step.output}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {missing.length > 0 ? missing.map((field) => (
              <span key={field} className="rounded-full border border-amber-200/14 bg-amber-300/[0.055] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-100/60">
                Needs {workflowContextLabel(field)}
              </span>
            )) : (
              <span className="rounded-full border border-emerald-200/14 bg-emerald-300/[0.055] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100/60">
                Context ready
              </span>
            )}
            {step.optionalFields.filter((field) => !context[field].trim()).slice(0, 2).map((field) => (
              <span key={field} className="rounded-full border border-cyan-100/10 bg-cyan-300/[0.035] px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-cyan-100/38">
                Optional: {workflowContextLabel(field)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={complete ? onReopen : onComplete}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[10px] font-semibold transition",
              complete
                ? "border-emerald-200/16 bg-emerald-300/[0.07] text-emerald-100/70 hover:bg-emerald-300/[0.11]"
                : "border-cyan-100/12 bg-white/[0.035] text-cyan-100/55 hover:bg-white/[0.07]",
            )}
          >
            {complete ? <CheckCircle2 size={14} /> : <Circle size={14} />}
            {complete ? "Completed" : "Mark complete"}
          </button>
          <Link
            href={buildWorkflowHref(step.route, context)}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[10px] font-bold transition",
              ready
                ? "border-cyan-200/20 bg-cyan-300/12 text-cyan-50 hover:bg-cyan-300/18"
                : "border-amber-200/14 bg-amber-300/[0.055] text-amber-100/65 hover:bg-amber-300/[0.09]",
            )}
          >
            Open
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}

function Principle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100/9 bg-white/[0.025] p-4">
      <div className="text-cyan-100/48">{icon}</div>
      <p className="mt-3 text-sm font-bold text-white">{title}</p>
      <p className="mt-2 text-xs leading-5 text-cyan-100/42">{text}</p>
    </div>
  );
}
