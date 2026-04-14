import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { GlassCard } from "./GlassCard";
import type { ReactNode } from "react";

export function SectionPanel({ title, narrative, children, defaultOpen = false }: { title: string; narrative: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <GlassCard className="overflow-hidden">
      <button className="flex w-full items-center justify-between gap-6 p-6 text-left" onClick={() => setOpen((value) => !value)}>
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-cyan-100/55">{narrative}</p>
        </div>
        <ChevronDown className={open ? "shrink-0 rotate-180 text-cyan-200 transition" : "shrink-0 text-cyan-200 transition"} />
      </button>
      {open ? <div className="border-t border-cyan-200/10 px-6 pb-6 pt-5">{children}</div> : null}
    </GlassCard>
  );
}
