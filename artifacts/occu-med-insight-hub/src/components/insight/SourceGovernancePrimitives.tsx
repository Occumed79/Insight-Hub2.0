import type { ReactNode } from "react";
import { CheckCircle2, CircleOff, Clock3, ShieldAlert, ShieldCheck } from "lucide-react";
import type { GovernedConfidenceTier, GovernedSourceState } from "@/data/sourceGovernanceApi";
import { cn } from "@/lib/utils";

const STATE_LABELS: Record<GovernedSourceState, string> = {
  ready: "Ready",
  partial: "Partial",
  disabled: "Disabled",
  "not-configured": "Not configured",
};

const CONFIDENCE_LABELS: Record<GovernedConfidenceTier, string> = {
  high: "High confidence",
  moderate: "Moderate confidence",
  "context-only": "Context only",
};

function stateTone(state: GovernedSourceState): string {
  if (state === "ready") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (state === "partial") return "border-amber-200/20 bg-amber-300/10 text-amber-100";
  if (state === "disabled") return "border-slate-200/10 bg-slate-300/[0.05] text-slate-300";
  return "border-rose-200/20 bg-rose-300/10 text-rose-100";
}

function confidenceTone(tier: GovernedConfidenceTier): string {
  if (tier === "high") return "border-cyan-200/20 bg-cyan-300/10 text-cyan-100";
  if (tier === "moderate") return "border-violet-200/20 bg-violet-300/10 text-violet-100";
  return "border-amber-200/20 bg-amber-300/10 text-amber-100";
}

function StateIcon({ state }: { state: GovernedSourceState }) {
  if (state === "ready") return <CheckCircle2 size={14} />;
  if (state === "partial") return <Clock3 size={14} />;
  if (state === "disabled") return <CircleOff size={14} />;
  return <ShieldAlert size={14} />;
}

export function SourceStateBadge({ state }: { state: GovernedSourceState }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", stateTone(state))}>
      <StateIcon state={state} />
      {STATE_LABELS[state]}
    </span>
  );
}

export function ConfidenceBadge({ tier }: { tier: GovernedConfidenceTier }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", confidenceTone(tier))}>
      <ShieldCheck size={14} />
      {CONFIDENCE_LABELS[tier]}
    </span>
  );
}

export function GovernancePill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-cyan-100/12 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-cyan-100/65", className)}>
      {children}
    </span>
  );
}

export function GovernanceMetric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-cyan-100/42">{note}</p>
    </div>
  );
}
