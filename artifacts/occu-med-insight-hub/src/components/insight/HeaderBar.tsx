import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const COMPANY_LIVE_TABS = [
  { href: "/company-live-intelligence", label: "Live Signals" },
  { href: "/sec-filings", label: "SEC Filings" },
] as const;

export function HeaderBar({ eyebrow, title, subtitle, actions, status }: { eyebrow?: string; title: string; subtitle: string; actions?: ReactNode; status?: ReactNode }) {
  const [location] = useLocation();
  const currentPath = location.split("?")[0];
  const showCompanyLiveTabs = COMPANY_LIVE_TABS.some((tab) => tab.href === currentPath);

  return (
    <header className="mb-8 flex flex-col gap-5 border-b border-cyan-100/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/60">{eyebrow}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-black tracking-[-0.04em] text-white">{title}</h1>
          {status}
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-100/58">{subtitle}</p>
        {showCompanyLiveTabs && (
          <nav className="mt-5 inline-flex rounded-2xl border border-cyan-100/12 bg-black/20 p-1" aria-label="Company intelligence views">
            {COMPANY_LIVE_TABS.map((tab) => {
              const active = currentPath === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "rounded-xl px-4 py-2 text-xs font-semibold transition",
                    active
                      ? "border border-cyan-200/20 bg-cyan-300/14 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,.10)]"
                      : "border border-transparent text-cyan-100/45 hover:bg-white/[0.05] hover:text-cyan-50",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
