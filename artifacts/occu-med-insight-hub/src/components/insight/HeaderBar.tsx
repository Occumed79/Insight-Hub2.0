import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function HeaderBar({ eyebrow, title, subtitle, actions, status }: { eyebrow?: string; title: string; subtitle: string; actions?: ReactNode; status?: ReactNode }) {
  const aorDefaultModeNote = title === "AOR Factors" ? "No AOR is selected by default." : "";

  return (
    <motion.header
      className="insight-cinematic-header relative mb-8 flex flex-col gap-6 overflow-hidden border-b border-slate-300/10 pb-7 lg:flex-row lg:items-end lg:justify-between"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: .72, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .12, duration: .5 }} className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-100/66">{eyebrow}</motion.p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="max-w-5xl text-[clamp(2.2rem,4vw,4.7rem)] font-black leading-[.94] tracking-[-0.065em] text-white">{title}</h1>
          {status}
        </div>
        <p className="mt-4 max-w-4xl text-[15px] leading-7 text-slate-300/82">{subtitle}</p>
        {aorDefaultModeNote ? <p className="mt-2 text-[11px] font-semibold tracking-[.02em] text-cyan-100/52">{aorDefaultModeNote}</p> : null}
      </div>
      {actions ? <div className="shrink-0 pb-1">{actions}</div> : null}
      <motion.div
        aria-hidden="true"
        className="absolute bottom-[-1px] left-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-100/80 to-cyan-200/0"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: "68%", opacity: 1 }}
        transition={{ duration: 1.05, delay: .18, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.header>
  );
}
