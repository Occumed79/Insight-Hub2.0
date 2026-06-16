import { MetricCard } from "../insight/MetricCard";
import type { Metric } from "../../data/types";

export function CompanyMetricRenderer({ metrics }: { metrics: Metric[] }) {
  if (!metrics.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </div>
  );
}
