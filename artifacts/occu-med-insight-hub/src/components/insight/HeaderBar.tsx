import type { ReactNode } from "react";

export function HeaderBar({ eyebrow, title, subtitle, actions, status }: { eyebrow?: string; title: string; subtitle: string; actions?: ReactNode; status?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-col gap-5 border-b border-slate-300/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-cyan-100/66">{eyebrow}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-[34px] font-black tracking-[-0.04em] text-white md:text-[36px]">{title}</h1>
          {status}
        </div>
        <p className="mt-2 max-w-4xl text-[15px] leading-7 text-slate-300/86">{subtitle}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
