import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ConstellisCharts } from "./ConstellisCharts";
import { GlassCard } from "./GlassCard";
import { IapCharts } from "./IapCharts";
import { V2XCharts } from "./V2XCharts";
import type { ReactNode } from "react";

export function SectionPanel({ title, narrative, children, defaultOpen = false }: { title: string; narrative: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const showV2XCharts = title === "Overview" && narrative.includes("V2X is the initial dossier company");
  const showIapCharts = title === "Overview" && narrative.includes("IAP Worldwide");
  const showConstellisCharts = title === "Overview" && narrative.includes("Constellis / Centerra");
  return (
    <GlassCard className="overflow-hidden">
      <button className="flex w-full items-center justify-between gap-6 p-6 text-left" onClick={() => setOpen((value) => !value)}>
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-cyan-100/55">{narrative}</p>
        </div>
        <ChevronDown className={open ? "shrink-0 rotate-180 text-cyan-200 transition" : "shrink-0 text-cyan-200 transition"} />
      </button>
      {open ? <div className="border-t border-cyan-200/10 px-6 pb-6 pt-5">{children}{showV2XCharts ? <V2XCharts /> : null}{showIapCharts ? <IapCharts /> : null}{showConstellisCharts ? <ConstellisCharts /> : null}</div> : null}
    </GlassCard>
  );
}
