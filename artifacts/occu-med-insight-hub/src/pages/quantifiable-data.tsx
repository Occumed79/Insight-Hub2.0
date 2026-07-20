import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Calculator, Equal, Gauge, Layers3, SlidersHorizontal } from "lucide-react";
import { MetricCard } from "@/components/insight/MetricCard";
import { ChartBlock } from "@/components/insight/ChartBlock";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { ReportView } from "@/components/insight/ReportView";
import { CinematicPortalHero, CinematicSection, CostAperture } from "@/components/insight/CinematicPortal";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import type { Assumption, Metric } from "@/data/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compactCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

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

  const directMetric = modeledMetrics[0];
  const burdenedMetric = modeledMetrics[1];
  const totalMetric = modeledMetrics[2];
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
      <section className="relative z-10 px-4 py-6 lg:ml-[210px] lg:px-8 xl:px-10">
        <CinematicPortalHero
          eyebrow="Portal 02 · Scenario intelligence"
          title="Make the assumptions visible."
          subtitle="A source-aware modeling environment that separates observed company facts from editable scenario inputs. Every output is explicitly modeled, and the interface never manufactures a future trend when the evidence only supports a current-state estimate."
          actions={
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="rounded-full border border-violet-100/18 bg-[#070512]/86 px-4 py-2.5 text-sm text-violet-50 outline-none backdrop-blur-xl transition focus:border-violet-200/40">
              {dataset.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          }
          stats={[
            { label: "Source headcount", value: headcount === undefined ? "—" : headcount.toLocaleString(), note: employeeMetric ? "Metric record" : "Company profile" },
            { label: "Annual hours", value: hours.toLocaleString(), note: "Editable model input" },
            { label: "WC cost / hour", value: currency.format(wcRate), note: "Editable model input" },
            { label: "Impact multiplier", value: `${(burden * indirect).toFixed(2)}×`, note: "Burden × indirect" },
          ]}
          visual={
            <CostAperture
              direct={directMetric?.value}
              burdened={burdenedMetric?.value}
              total={totalMetric?.value}
              formatter={(value) => compactCurrency.format(value)}
            />
          }
        />

        <CinematicSection
          index="01"
          eyebrow="Modeled outputs"
          title="Three layers of the same scenario."
          description="Direct cost, economic burden, and total modeled impact are shown as related layers. They are not independent observations and they are never presented as an unsupported time series."
        >
          {modeledMetrics.length ? (
            <div className="grid gap-4 md:grid-cols-3">{modeledMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>
          ) : (
            <GlassCard className="p-7"><h3 className="text-xl font-bold text-white">Model unavailable</h3><p className="mt-3 text-sm leading-7 text-slate-200/52">No source-backed headcount is available for this entity. The model will not substitute zero or create a projection.</p></GlassCard>
          )}
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <ChartBlock title="Current modeled cost components" subtitle="Direct, burdened, and total scenario values in USD millions. No unsupported year-over-year growth is applied.">
              <BarChart data={modelComponents}><CartesianGrid stroke="rgba(255,255,255,.07)" /><XAxis dataKey="name" stroke="rgba(226,232,240,.38)" tick={{ fontSize: 11 }} /><YAxis stroke="rgba(226,232,240,.38)" tickFormatter={(value: number) => `$${value}M`} /><Bar dataKey="value" fill="#a78bfa" radius={[12, 12, 0, 0]} /></BarChart>
            </ChartBlock>
            <ChartBlock title="Peer modeled proxy comparison" subtitle="The same assumptions applied to source-backed peer headcounts. This remains a scenario comparison, not an observed cost series.">
              <BarChart data={comparisonData}><CartesianGrid stroke="rgba(255,255,255,.07)" /><XAxis dataKey="name" stroke="rgba(226,232,240,.38)" tick={{ fontSize: 11 }} /><YAxis stroke="rgba(226,232,240,.38)" tickFormatter={(value: number) => `$${value}M`} /><Bar dataKey="value" fill="#67e8f9" radius={[12, 12, 0, 0]} /></BarChart>
            </ChartBlock>
          </div>
        </CinematicSection>

        <CinematicSection
          index="02"
          eyebrow="Assumption studio"
          title="Change the model without hiding the inputs."
          description="Every editable value remains visible beside its unit and definition. The controls feel like a model console, but they preserve the same transparent calculations underneath."
        >
          <GlassCard className="overflow-hidden p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-100/15 bg-violet-200/8 text-violet-100"><SlidersHorizontal className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-violet-200/45">Live scenario controls</p><h3 className="mt-1 text-xl font-bold text-white">Editable assumptions</h3></div></div>
              <span className="rounded-full border border-amber-200/16 bg-amber-200/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-amber-100/65">Modeled · not observed</span>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {activeAssumptions.map((assumption, index) => (
                <label key={assumption.id} className="group rounded-[24px] border border-violet-100/10 bg-white/[0.028] p-5 transition duration-500 hover:-translate-y-1 hover:border-violet-100/22 hover:bg-violet-100/[0.045]">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-violet-100/36">Input {String(index + 1).padStart(2, "0")}</p><span className="mt-2 block text-sm font-semibold text-slate-50">{assumption.label}</span></div><span className="rounded-full border border-violet-100/10 bg-violet-100/[0.04] px-2.5 py-1 text-[10px] text-violet-100/50">{assumption.unit}</span></div>
                  <input type="number" step="0.01" value={assumption.value} onChange={(event) => updateAssumption(assumption.id, Number(event.target.value))} className="mt-5 w-full rounded-2xl border border-violet-100/13 bg-[#03020a]/84 px-4 py-3 text-xl font-black tracking-[-.03em] text-white outline-none transition focus:border-violet-200/42 focus:shadow-[0_0_28px_rgba(139,92,246,.12)]" />
                  <p className="mt-3 text-xs leading-6 text-slate-200/44">{assumption.description}</p>
                </label>
              ))}
            </div>
          </GlassCard>
        </CinematicSection>

        <CinematicSection
          index="03"
          eyebrow="Calculation architecture"
          title="The formula, staged as a decision path."
          description="The page explains where the number comes from before presenting a polished report. Each step has a distinct role, and the final output remains traceable to the source-backed headcount."
          compact
        >
          <GlassCard className="p-6 md:p-8">
            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
              {[
                { label: "Source-backed headcount", value: headcount === undefined ? "Unavailable" : headcount.toLocaleString(), icon: Gauge },
                { label: "Annual hours", value: hours.toLocaleString(), icon: Calculator },
                { label: "WC cost/hour", value: currency.format(wcRate), icon: Layers3 },
                { label: "Burden multipliers", value: `${burden}× · ${indirect}×`, icon: SlidersHorizontal },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="contents">
                    <div className="rounded-[22px] border border-violet-100/10 bg-white/[0.025] p-5 text-center"><Icon className="mx-auto h-5 w-5 text-violet-100/48" /><p className="mt-4 text-[9px] uppercase tracking-[.18em] text-slate-200/34">Step {index + 1}</p><p className="mt-2 text-sm font-bold text-white">{step.label}</p><p className="mt-2 font-mono text-xs text-violet-100/62">{step.value}</p></div>
                    {index < 3 ? <Equal className="mx-auto hidden h-4 w-4 text-violet-100/24 md:block" /> : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-7 text-sm leading-7 text-slate-200/54">For {company?.shortName}, the current scenario uses {headcount === undefined ? "no available" : headcount.toLocaleString()} employees, {hours.toLocaleString()} hours per employee, {currency.format(wcRate)} per hour, {burden}× economic burden, and {indirect}× indirect cost. Every output on this page remains labeled modeled.</p>
          </GlassCard>
        </CinematicSection>

        {company && report && directCost !== undefined ? (
          <CinematicSection index="04" eyebrow="Executive output" title="The polished report keeps the assumptions attached." description="The final narrative is generated only when the required source-backed headcount exists, and it remains connected to the active inputs shown above." compact>
            <ReportView company={company} report={report} assumptions={activeAssumptions} directCost={directCost} />
          </CinematicSection>
        ) : null}
      </section>
    </main>
  );
}
