import { CartesianGrid, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartBlock } from "../insight/ChartBlock";
import { LuminousChartTooltip } from "../insight/LuminousChartTooltip";
import type { OpportunityMatrixPoint } from "../../company-configs/types";

export function CompanyOpportunityRenderer({ data, companyName }: { data: OpportunityMatrixPoint[]; companyName: string }) {
  if (!data.length) return null;
  return (
    <div className="mt-5">
      <ChartBlock title={`${companyName} opportunity matrix`} subtitle="Revenue potential vs implementation complexity with strategic value bubble size.">
        <ScatterChart>
          <CartesianGrid stroke="rgba(255,255,255,.08)" />
          <XAxis dataKey="revenuePotential" name="Revenue Potential ($K)" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v}K`} />
          <YAxis dataKey="implementationComplexity" name="Complexity" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} domain={[0, 10]} />
          <ZAxis dataKey="strategicValue" range={[80, 520]} />
          <Tooltip cursor={{ stroke: "rgba(34,211,238,.35)", strokeDasharray: "4 4" }} content={<LuminousChartTooltip headline="opportunity matrix" />} />
          <Scatter name="Opportunity" data={data} fill="#22c55e" />
        </ScatterChart>
      </ChartBlock>
    </div>
  );
}
