import type { MouseEvent as ReactMouseEvent } from "react";
import { CircleDollarSign, Landmark, Scale, X } from "lucide-react";
import { Link } from "wouter";
import { useEmployerWorkflow } from "@/components/insight/EmployerWorkflowContext";
import { EntitiesPage } from "@/pages/entities";

export function ContextualEntitiesPage({ defaultTab = "prospects" }: { defaultTab?: "prospects" | "clients" }) {
  const { context, updateContext } = useEmployerWorkflow();
  const selected = (context.legalName || context.employer || "").trim();

  function captureEntity(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest<HTMLButtonElement>('button[aria-label^="Open details for "]');
    if (!trigger) return;
    const label = trigger.getAttribute("aria-label") || "";
    const name = label.replace(/^Open details for\s+/, "").trim();
    if (!name) return;
    updateContext({ employer: name, legalName: name });
  }

  return <div onClickCapture={captureEntity}>
    <EntitiesPage defaultTab={defaultTab} />
    {selected ? <aside className="fixed bottom-5 right-5 z-[1200] w-[min(92vw,420px)] rounded-[22px] border border-cyan-100/18 bg-[#04101d]/95 p-3 text-white shadow-[0_24px_80px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3 px-1 pb-2">
        <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/42">Selected Entity</p><p className="mt-1 truncate text-sm font-black">{selected}</p></div>
        <button type="button" onClick={() => updateContext({ employer: "", legalName: "" })} aria-label="Clear selected entity" className="rounded-lg border border-white/8 p-1.5 text-cyan-100/45 hover:text-white"><X size={14} /></button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Link href="/federal-awards" className="rounded-xl border border-emerald-200/14 bg-emerald-300/[0.055] p-3 text-center transition hover:border-emerald-200/26"><CircleDollarSign size={16} className="mx-auto text-emerald-200/70" /><p className="mt-1 text-[9px] font-black">Federal Awards</p></Link>
        <Link href="/public-legal-references" className="rounded-xl border border-violet-200/14 bg-violet-300/[0.055] p-3 text-center transition hover:border-violet-200/26"><Scale size={16} className="mx-auto text-violet-200/70" /><p className="mt-1 text-[9px] font-black">Legal & Injury</p></Link>
        <Link href="/fec-filings" className="rounded-xl border border-cyan-200/14 bg-cyan-300/[0.055] p-3 text-center transition hover:border-cyan-200/26"><Landmark size={16} className="mx-auto text-cyan-200/70" /><p className="mt-1 text-[9px] font-black">FEC Relationship</p></Link>
      </div>
    </aside> : null}
  </div>;
}
