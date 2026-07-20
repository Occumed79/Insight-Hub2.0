import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { MetricCard } from "@/components/insight/MetricCard";
import { ChartBlock } from "@/components/insight/ChartBlock";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { ReportView } from "@/components/insight/ReportView";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import type { Assumption, Metric } from "@/data/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export default function QuantifiableData() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const [assumptions, setAssumptions] = useState<Assumption[]>(dataset.assumptions);

  useEffect(() => { setAssumptions(dataset.assumptions); }, [dataset.assumptions]);

  const activeAssumptions = assumptions.length ? assumptions : dataset.assumptions;
  const companyMetrics = dataset.metrics.filter((metric) => metric.companyId === companyId);
  const employeeMetric = companyMetrics.find((metric) => metric.label === "Employees");
  const assumptionValue = (id: string, fallback: number) => activeAssumptions.find((item) => item.id === id)?.value ?? fallback;
  const hours = assumptionValue("hours", 2000);
  const wcRate = assumptionValue("wcRate", 0.43);
  const burden = assumptionValue("burden", 1.25);
  const indirect = assumptionValue("indirect", 2.1);
  const headcount = employeeMetric?.value ?? company?.employees;
  const directCost = headcount === undefined ? undefined : headcount * hours * wcRate;

  const modeledMetrics = useMemo<Metric[]>(() => directCost === undefined ? [] : [
    { id: "direct", companyId, label: "Direct WC proxy", value: directCost, unit: "usd", category: "financial", status: "modeled" },
    { id: "burdened", companyId, label: "Economic burden", value: directCost * burden, unit: "usd", category: "financial", status: "modeled" },
    { id: "total", companyId, label: "Total impact model", value: directCost * burden * indirect, unit: "usd", category: "risk", status: "modeled" },
  ], [burden, companyId, directCost, indirect]);

  const modelComponents = modeledMetrics.map((metric) => ({ name: metric.label, value: metric.value / 1_000_000 }));
  const comparisonData = dataset.companies
    .filter((item) => (!item.entityType || item.entityType === "company") && item.id !== companyId)
    .map((item) => {
      const employee = dataset.metrics.find((metric) => metric.companyId === item.id && metric.label === "Employees")?.value ?? item.employees;
      return employee > 0 ? { name: item.shortName, value: employee * hours * wcRate / 1_000_000 } : null;
    })
    .filter((item): item is { name: string; value: number } => item !== null)
    .slice(0, 8);
  const report = dataset.reports.find((item) => item.companyId === companyId);

  function updateAssumption(id: string, value: number) {
    if (!Number.isFinite(value)) return;
    setAssumptions((current) => (current.length ? current : dataset.assumptions).map((item) => item.id === id ? { ...item, value } : item));
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar eyebrow="Portal 02" title="Quantifiable Data" subtitle="Source-aware scenario modeling. Modeled values are explicitly separated from observed company metrics and unsupported time projections are not manufactured." actions={<select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-sm text-cyan-50 outline-none">{dataset.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>} />
        {modeledMetrics.length ? <div className="grid gap-4 md:grid-cols-3">{modeledMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div> : <GlassCard className="p-6"><h3 className="text-lg font-bold text-white">Model unavailable</h3><p className="mt-2 text-sm text-cyan-100/60">No source-backed headcount is available for this entity. The model will not substitute zero or create a projection.</p></GlassCard>}
        <div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
          <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-white">Editable assumptions</h3>
            <p className="mt-2 text-sm leading-6 text-cyan-100/55">These inputs drive a current scenario only. They do not imply a future growth rate.</p>
            <div className="mt-5 space-y-4">{activeAssumptions.map((assumption) => <label key={assumption.id} className="block rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4"><span className="text-sm font-semibold text-cyan-50">{assumption.label}</span><span className="ml-2 text-xs text-cyan-100/42">{assumption.unit}</span><input type="number" step="0.01" value={assumption.value} onChange={(event) => updateAssumption(assumption.id, Number(event.target.value))} className="mt-3 w-full rounded-xl border border-cyan-100/15 bg-[#020913] px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/50" /><p className="mt-2 text-xs leading-5 text-cyan-100/48">{assumption.description}</p></label>)}</div>
          </GlassCard>
          <div className="grid gap-5">
            <ChartBlock title="Current modeled cost components" subtitle="Direct, burdened, and total scenario values in USD millions. No unsupported year-over-year growth is applied."><BarChart data={modelComponents}><CartesianGrid stroke="rgba(255,255,255,.08)" /><XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} /><YAxis stroke="rgba(207,250,254,.45)" tickFormatter={(value: number) => `$${value}M`} /><Bar dataKey="value" fill="#67e8f9" radius={[10, 10, 0, 0]} /></BarChart></ChartBlock>
            <ChartBlock title="Peer modeled proxy comparison" subtitle="Same assumptions applied to source-backed peer headcounts; this is a scenario comparison, not an observed cost series."><BarChart data={comparisonData}><CartesianGrid stroke="rgba(255,255,255,.08)" /><XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} /><YAxis stroke="rgba(207,250,254,.45)" tickFormatter={(value: number) => `$${value}M`} /><Bar dataKey="value" fill="#2dd4bf" radius={[10, 10, 0, 0]} /></BarChart></ChartBlock>
          </div>
        </div>
        <GlassCard className="mt-5 p-6">
          <h3 className="text-lg font-bold text-white">Formula explanation</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-4">{["Source-backed headcount", "Annual hours", "WC cost/hour", "Burden multipliers"].map((label, index) => <div key={label} className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.04] p-4"><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/38">Step {index + 1}</p><p className="mt-2 font-semibold text-cyan-50">{label}</p></div>)}</div>
          <p className="mt-5 text-sm leading-6 text-cyan-100/62">For {company?.shortName}, the current scenario uses {headcount === undefined ? "no available" : headcount.toLocaleString()} employees, {hours.toLocaleString()} hours per employee, {currency.format(wcRate)} per hour, {burden}x economic burden, and {indirect}x indirect cost. Every output on this page is labeled modeled.</p>
        </GlassCard>
        {company && report && directCost !== undefined ? <div className="mt-5"><ReportView company={company} report={report} assumptions={activeAssumptions} directCost={directCost} /></div> : null}
      </section>
    </main>
  );
}
