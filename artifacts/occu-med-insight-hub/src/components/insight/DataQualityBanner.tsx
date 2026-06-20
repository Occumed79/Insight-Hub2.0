import { GlassCard } from "./GlassCard";
import { DataQualityFlagBadge } from "./IntelligenceStatusBadge";

export function DataQualityBanner({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;

  return (
    <GlassCard className="mb-5 border border-amber-200/20 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <DataQualityFlagBadge />
        <p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">Source reconciliation required</p>
      </div>
      <ul className="space-y-2 text-sm leading-6 text-cyan-100/68">
        {warnings.map((warning) => (
          <li key={warning} className="rounded-xl border border-amber-100/10 bg-black/15 px-4 py-3">
            {warning}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
