import { CartesianGrid, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartBlock } from "../insight/ChartBlock";
import { LuminousChartTooltip } from "../insight/LuminousChartTooltip";
import type { RiskMatrixPoint } from "../../company-configs/types";

export function CompanyRiskRenderer({ data, companyName }: { data: RiskMatrixPoint[]; companyName: string }) {
  if (!data.length) return null;
  return (
    <div className="mt-5">
      <ChartBlock title={`${companyName} risk matrix`} subtitle="Revenue opportunity plotted against worker risk with workforce bubble size.">
        <ScatterChart>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="revenue" name="Revenue ($M)" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v}M`} />
          <YAxis dataKey="risk" name="Risk score" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 10]} />
          <ZAxis dataKey="workers" range={[80, 520]} />
          <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline="risk matrix" />} />
          <Scatter name="Region" data={data} fill="#22d3ee" />
        </ScatterChart>
      </ChartBlock>
    </div>
  );
}
