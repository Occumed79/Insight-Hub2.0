type TooltipEntry = {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
  color?: string;
};

type Props = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatter?: "currencyM" | "currencyK" | "percent" | "hoursM" | "plain";
  headline?: string;
};

function formatMetric(value: string | number | undefined, formatter: Props["formatter"] = "plain") {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return `${value ?? ""}`;
  if (formatter === "currencyM") return `$${numeric.toLocaleString()}M`;
  if (formatter === "currencyK") return `$${numeric.toLocaleString()}K`;
  if (formatter === "percent") return `${numeric}%`;
  if (formatter === "hoursM") return `${numeric}M hrs`;
  return Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(2);
}

export function LuminousChartTooltip({ active, payload, label, formatter = "plain", headline }: Props) {
  if (!active || !payload?.length) return null;

  return (
    <div className="relative min-w-44 overflow-hidden rounded-2xl border border-cyan-200/30 bg-slate-950/90 px-4 py-3 text-left shadow-xl backdrop-blur-2xl">
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 left-4 h-20 w-20 rounded-full bg-blue-500/20 blur-2xl" />
      <div className="relative">
        <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/55">{headline ?? "data focus"}</p>
        <p className="mt-1 text-sm font-semibold text-white">{label}</p>
        <div className="mt-3 space-y-2">
          {payload.map((entry) => (
            <div key={`${entry.dataKey}-${entry.name}`} className="flex items-center justify-between gap-5 text-xs">
              <span className="flex items-center gap-2 text-cyan-100/70">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? "#67e8f9" }} />
                {entry.name}
              </span>
              <span className="font-semibold text-white">{formatMetric(entry.value, formatter)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
        <p className="mt-2 text-[10px] text-cyan-100/45">Hover or tap to inspect exact values.</p>
      </div>
    </div>
  );
}
