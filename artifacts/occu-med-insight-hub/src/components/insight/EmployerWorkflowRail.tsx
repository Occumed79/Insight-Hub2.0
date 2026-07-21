import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Route,
  RotateCcw,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEmployerWorkflow } from "@/components/insight/EmployerWorkflowContext";
import { WORKFLOW_STEPS, buildWorkflowHref } from "@/data/employerWorkflow";

const CONNECTED_PATHS = new Set([
  "/employer-workflow",
  ...WORKFLOW_STEPS.map((step) => step.route),
]);

export function EmployerWorkflowRail() {
  const [location] = useLocation();
  const currentPath = location.split("?")[0];
  const { context, completedStepIds, currentStep } = useEmployerWorkflow();

  if (!CONNECTED_PATHS.has(currentPath)) return null;

  const currentIndex = currentStep
    ? WORKFLOW_STEPS.findIndex((step) => step.id === currentStep.id)
    : -1;
  const previousStep = currentIndex > 0 ? WORKFLOW_STEPS[currentIndex - 1] : null;
  const nextStep = currentIndex >= 0 && currentIndex < WORKFLOW_STEPS.length - 1
    ? WORKFLOW_STEPS[currentIndex + 1]
    : WORKFLOW_STEPS.find((step) => !completedStepIds.includes(step.id)) ?? null;
  const currentComplete = currentStep ? completedStepIds.includes(currentStep.id) : false;
  const completedCount = completedStepIds.length;
  const contextBits = [
    context.state,
    context.jobTitle,
    context.naics ? `NAICS ${context.naics}` : "",
    context.country,
  ].filter(Boolean);

  return (
    <aside className="fixed bottom-3 left-3 right-3 z-50 rounded-[24px] border border-cyan-100/16 bg-[#030813]/92 p-3 shadow-[0_22px_70px_rgba(0,0,0,.58),0_0_35px_rgba(34,211,238,.08)] backdrop-blur-2xl lg:left-[226px] lg:right-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={buildWorkflowHref("/employer-workflow", context)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-cyan-100/10 bg-white/[0.035] px-3 py-2 transition hover:border-cyan-100/20 hover:bg-white/[0.06] md:min-w-[320px]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-100/14 bg-cyan-300/10 text-cyan-100">
            <Route size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate text-sm font-bold text-white">
                {context.employer.trim() || "Open public-source employer brief"}
              </p>
              <span className="rounded-full border border-cyan-100/12 bg-cyan-200/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
                {completedCount}/{WORKFLOW_STEPS.length} source runs
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-cyan-100/42">
              {contextBits.length > 0 ? contextBits.join(" · ") : "Tab-scoped context · never placed in the URL"}
            </p>
          </div>
        </Link>

        {currentStep && (
          <div className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold ${
            currentComplete
              ? "border-emerald-200/20 bg-emerald-300/10 text-emerald-100"
              : "border-cyan-100/12 bg-white/[0.035] text-cyan-100/45"
          }`}>
            {currentComplete ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            {currentComplete ? "Public-source run complete" : "Not run from brief"}
          </div>
        )}

        <div className="flex items-center gap-2">
          {previousStep && (
            <Link
              href={buildWorkflowHref(previousStep.route, context)}
              aria-label={`Previous: ${previousStep.label}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/12 bg-white/[0.035] text-cyan-100/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft size={17} />
            </Link>
          )}
          {nextStep && (
            <Link
              href={buildWorkflowHref(nextStep.route, context)}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-300/12 px-4 text-xs font-bold text-cyan-50 transition hover:bg-cyan-300/18"
            >
              Open {nextStep.shortLabel}
              <ArrowRight size={16} />
            </Link>
          )}
          {!nextStep && completedCount === WORKFLOW_STEPS.length && (
            <Link
              href={buildWorkflowHref("/employer-workflow", context)}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-violet-200/18 bg-violet-300/10 px-4 text-xs font-bold text-violet-100 transition hover:bg-violet-300/16"
            >
              <RotateCcw size={15} />
              Review brief
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
