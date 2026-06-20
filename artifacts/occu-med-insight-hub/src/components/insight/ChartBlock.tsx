import { ResponsiveContainer } from "recharts";
import { GlassCard } from "./GlassCard";
import type { ReactElement } from "react";

export function ChartBlock({ title, subtitle, children, height = 256 }: { title: string; subtitle?: string; children: ReactElement; height?: number }) {
  return (
    <GlassCard className="p-5">
      <div className="mb-4">
        <h3 className="font-bold text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-cyan-100/55">{subtitle}</p> : null}
      </div>
      <div className="w-full" style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </GlassCard>
  );
}
