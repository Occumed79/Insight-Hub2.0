import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { GlassCard } from "../insight/GlassCard";
import type { CompanyProfile, Metric } from "../../data/types";
import { MetricCard } from "../insight/MetricCard";

function DossierSection({ section, metrics, defaultOpen }: { section: CompanyProfile["sections"][number]; metrics: Metric[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionMetrics = metrics.filter((m) => section.metrics.includes(m.id));

  return (
    <GlassCard className="p-5">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <h3 className="text-lg font-bold text-white">{section.title}</h3>
        <ChevronDown className={`h-5 w-5 text-cyan-100/55 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
            <p className="mt-3 text-sm leading-6 text-cyan-100/55">{section.narrative}</p>
            {section.bullets.length > 0 && (
              <ul className="mt-3 space-y-1">
                {section.bullets.map((bullet, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-6 text-cyan-100/55">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/50" />
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
            {sectionMetrics.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {sectionMetrics.map((m) => <MetricCard key={m.id} metric={m} />)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

export function CompanyDossierRenderer({ profile, metrics }: { profile: CompanyProfile | undefined; metrics: Metric[] }) {
  if (!profile || !profile.sections.length) return null;
  return (
    <div className="mt-5 space-y-4">
      {profile.sections.map((section, i) => (
        <DossierSection key={section.id} section={section} metrics={metrics} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
