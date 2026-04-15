import type { ReactNode } from "react";

export function HeaderBar({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-5 border-b border-cyan-100/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/60">{eyebrow}</p> : null}
        <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-100/58">{subtitle}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
