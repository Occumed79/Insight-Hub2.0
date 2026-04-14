import type { Assumption, Company, ReportRecord } from "@/data/types";
import { GlassCard } from "./GlassCard";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ReportView({ company, report, assumptions, directCost }: { company: Company; report?: ReportRecord; assumptions: Assumption[]; directCost: number }) {
  const burden = assumptions.find((item) => item.id === "burden")?.value || 1.25;
  const indirect = assumptions.find((item) => item.id === "indirect")?.value || 2.1;
  return (
    <GlassCard className="p-7 print:bg-white print:text-black">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/60">Report mode</p>
          <h2 className="mt-2 text-2xl font-black text-white print:text-black">{report?.title || `${company.shortName} executive signal report`}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-100/60 print:text-slate-700">{report?.summary || company.summary}</p>
        </div>
        <div className="rounded-2xl border border-cyan-100/15 bg-white/[0.04] px-4 py-3 text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">Modeled burden</p>
          <p className="mt-1 text-xl font-black text-white print:text-black">{currency.format(directCost * burden * indirect)}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {(report?.signals || company.tags).map((signal) => <div key={signal} className="rounded-2xl border border-cyan-100/10 bg-cyan-200/[0.04] p-4 text-sm text-cyan-50/78 print:border-slate-200 print:bg-slate-50 print:text-slate-800">{signal}</div>)}
      </div>
      <div className="mt-6 rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.04] p-4 text-sm leading-6 text-emerald-50/75 print:border-slate-200 print:bg-slate-50 print:text-slate-800">
        Formula: Headcount × annual hours × WC cost/hour × economic burden × indirect multiplier. Assumptions remain editable in the analysis panel and can be replaced when company-specific loss data is ingested.
      </div>
    </GlassCard>
  );
}
