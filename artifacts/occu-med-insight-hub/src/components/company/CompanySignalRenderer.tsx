import type { SignalDefinition } from "../../company-configs/types";

export function CompanySignalRenderer({ signals }: { signals: SignalDefinition[] }) {
  if (!signals.length) return null;
  return (
    <div className="executive-strip mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {signals.map((signal) => (
        <div key={signal.label} className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] px-5 py-4 backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/55">{signal.label}</p>
          <p className="mt-1 text-lg font-bold text-white">{signal.value}</p>
          <p className="mt-2 text-xs leading-5 text-cyan-100/48">{signal.note}</p>
        </div>
      ))}
    </div>
  );
}
