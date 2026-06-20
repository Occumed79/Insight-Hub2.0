import { cn } from "@/lib/utils";

export type IntelligenceSourceStatus = "live" | "cached" | "uploaded" | "modeled" | "directional" | "stale";

const STATUS_LABELS: Record<IntelligenceSourceStatus, string> = {
  live: "Live",
  cached: "Cached",
  uploaded: "Uploaded",
  modeled: "Modeled",
  directional: "Directional",
  stale: "Stale",
};

type Props = {
  status: IntelligenceSourceStatus;
  lastUpdated?: string;
  className?: string;
  showUpdated?: boolean;
};

export function IntelligenceStatusBadge({ status, lastUpdated, className, showUpdated = true }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-200/10 px-3 py-1.5 text-xs text-cyan-50/75",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/80 shadow-[0_0_8px_rgba(34,211,238,.45)]" />
      <span>{STATUS_LABELS[status]}</span>
      {showUpdated && lastUpdated ? <span className="text-cyan-100/45">· {lastUpdated}</span> : null}
    </span>
  );
}

export function DataQualityFlagBadge({ label = "Data quality flag", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1.5 text-xs text-amber-100/85",
        className,
      )}
    >
      {label}
    </span>
  );
}
