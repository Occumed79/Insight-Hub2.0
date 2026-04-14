import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { MetricCard } from "@/components/insight/MetricCard";
import { ChartBlock } from "@/components/insight/ChartBlock";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { ReportView } from "@/components/insight/ReportView";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import type { Assumption } from "@/data/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function QuantifiableData() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const [assumptions, setAssumptions] = useState<Assumption[]>(dataset.assumptions);
  const activeAssumptions = assumptions.length ? assumptions : dataset.assumptions;
  const companyMetrics = dataset.metrics.filter((metric) => metric.companyId === companyId);
  const employeeMetric = companyMetrics.find((metric) => metric.label === "Employees");
  const hours = activeAssumptions.find((item) => item.id === "hours")?.value || 2000;
  const wcRate = activeAssumptions.find((item) => item.id === "wcRate")?.value || 0.43;
  const burden = activeAssumptions.find((item) => item.id === "burden")?.value || 1.25;
  const indirect = activeAssumptions.find((item) => item.id === "indirect")?.value || 2.1;
  const directCost = (employeeMetric?.value || company?.employees || 0) * hours * wcRate;
  const modeledMetrics = useMemo(() => [
    { id: "direct", companyId, label: "Direct WC proxy", value: directCost, unit: "usd" as const, category: "financial" as const, trend: 4.8 },
    { id: "burdened", companyId, label: "Economic burden", value: directCost * burden, unit: "usd" as const, category: "financial" as const, trend: 6.2 },
    { id: "total", companyId, label: "Total impact model", value: directCost * burden * indirect, unit: "usd" as const, category: "risk" as const, trend: 8.7 },
  ], [burden, companyId, directCost, indirect]);
  const trendData = [2026, 2027, 2028, 2029].map((year, index) => ({ year, direct: Math.round(directCost * (1 + index * 0.055) / 1000000), burden: Math.round(directCost * burden * indirect * (1 + index * 0.07) / 1000000) }));
  const comparisonData = dataset.companies.slice(0, 8).map((item) => ({ name: item.shortName, value: Math.round(item.employees * hours * wcRate / 1000000) }));
  const report = dataset.reports.find((item) => item.companyId === companyId) || dataset.reports[0];
  function updateAssumption(id: string, value: number) {
    setAssumptions((current) => (current.length ? current : dataset.assumptions).map((item) => item.id === id ? { ...item, value } : item));
  }
  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar eyebrow="Portal 02" title="Quantifiable Data" subtitle="A reusable quant analysis system that converts attached methodology and proxy workbook rows into editable, source-aware executive cost signals." actions={<select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-sm text-cyan-50 outline-none">{dataset.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>} />
        <div className="grid gap-4 md:grid-cols-3">{modeledMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
          <GlassCard className="p-6">
            <h3 className="text-lg font-bold text-white">Editable assumptions</h3>
            <p className="mt-2 text-sm leading-6 text-cyan-100/55">Values are initialized from the methodology workbook and can be overridden for scenario planning.</p>
            <div className="mt-5 space-y-4">{activeAssumptions.map((assumption) => <label key={assumption.id} className="block rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4"><span className="text-sm font-semibold text-cyan-50">{assumption.label}</span><span className="ml-2 text-xs text-cyan-100/42">{assumption.unit}</span><input type="number" step="0.01" value={assumption.value} onChange={(event) => updateAssumption(assumption.id, Number(event.target.value))} className="mt-3 w-full rounded-xl border border-cyan-100/15 bg-[#020913] px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/50" /><p className="mt-2 text-xs leading-5 text-cyan-100/48">{assumption.description}</p></label>)}</div>
          </GlassCard>
          <div className="grid gap-5">
            <ChartBlock title="Projected cost trend" subtitle="Direct and total modeled burden in millions."><LineChart data={trendData}><CartesianGrid stroke="rgba(255,255,255,.08)" /><XAxis dataKey="year" stroke="rgba(207,250,254,.45)" /><YAxis stroke="rgba(207,250,254,.45)" /><Line type="monotone" dataKey="direct" stroke="#67e8f9" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="burden" stroke="#6ee7b7" strokeWidth={2} dot={false} /></LineChart></ChartBlock>
            <ChartBlock title="Peer proxy comparison" subtitle="Annual direct WC proxy by workbook headcount."><BarChart data={comparisonData}><CartesianGrid stroke="rgba(255,255,255,.08)" /><XAxis dataKey="name" stroke="rgba(207,250,254,.45)" tick={{ fontSize: 11 }} /><YAxis stroke="rgba(207,250,254,.45)" /><Bar dataKey="value" fill="#2dd4bf" radius={[10, 10, 0, 0]} /></BarChart></ChartBlock>
          </div>
        </div>
        <GlassCard className="mt-5 p-6">
          <h3 className="text-lg font-bold text-white">Formula explanation</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-4">{["Headcount", "Annual hours", "WC cost/hour", "Burden multipliers"].map((label, index) => <div key={label} className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.04] p-4"><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/38">Step {index + 1}</p><p className="mt-2 font-semibold text-cyan-50">{label}</p></div>)}</div>
          <p className="mt-5 text-sm leading-6 text-cyan-100/62">For {company?.shortName}, the current model calculates {(company?.employees || 0).toLocaleString()} employees as a headcount input, {hours.toLocaleString()} hours per employee, {currency.format(wcRate)} per hour, then applies {burden}x economic burden and {indirect}x indirect cost multipliers.</p>
        </GlassCard>
        {company ? <div className="mt-5"><ReportView company={company} report={report} assumptions={activeAssumptions} directCost={directCost} /></div> : null}
      </section>
    </main>
  );
}
