import type { ReactNode } from "react";

export function HeaderBar({ eyebrow, title, subtitle, actions, status }: { eyebrow?: string; title: string; subtitle: string; actions?: ReactNode; status?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-4 border-b border-cyan-100/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-200/58">{eyebrow}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">{title}</h1>
          {status}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-100/56">{subtitle}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
