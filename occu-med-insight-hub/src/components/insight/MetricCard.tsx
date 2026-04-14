import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { GlassCard } from "./GlassCard";
import type { Metric } from "@/data/types";

function formatValue(value: number, unit: Metric["unit"]) {
  if (unit === "usd") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (unit === "percent") return `${value.toFixed(0)}%`;
  if (unit === "score") return `${value.toFixed(0)}/100`;
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatMetricValue(metric: Metric) {
  return formatValue(metric.value, metric.unit);
}

export function MetricCard({ metric }: { metric: Metric }) {
  const [displayValue, setDisplayValue] = useState(metric.value);

  useEffect(() => {
    const startValue = displayValue;
    const delta = metric.value - startValue;
    const start = performance.now();
    const duration = 850;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + delta * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [metric.value]);

  return (
    <GlassCard className="metric-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/45">{metric.category}</p>
          <h3 className="mt-2 text-sm font-semibold text-white/80">{metric.label}</h3>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 p-2 text-emerald-200"><ArrowUpRight size={15} /></span>
      </div>
      <div className="mt-5 text-2xl font-bold tracking-tight text-white tabular-nums drop-shadow-[0_0_16px_rgba(103,232,249,.18)]">{formatValue(displayValue, metric.unit)}</div>
      <p className="mt-2 text-xs text-cyan-100/55">{metric.trend ? `${metric.trend.toFixed(1)}% directional signal` : "Structured source signal"}</p>
    </GlassCard>
  );
}
