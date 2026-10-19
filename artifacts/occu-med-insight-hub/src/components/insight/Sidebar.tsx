import { Activity, ArrowLeft, BookOpenCheck, Database, ShieldAlert } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/injuries-medical-conditions", label: "Injuries & Medical Conditions", icon: Activity },
  { href: "/aor-factors", label: "AOR Factors", icon: ShieldAlert },
  { href: "/onet-master-tool", label: "O*NET Master Tool", icon: BookOpenCheck },
  { href: "/occupational-data-explorer", label: "Occupational Data Explorer", icon: Database },
] as const;

const DESKTOP_SIDEBAR_BACKGROUND = "linear-gradient(180deg, rgba(2,6,17,.99) 0%, rgba(3,8,19,.985) 48%, rgba(2,5,13,.995) 100%)";
const MOBILE_SIDEBAR_BACKGROUND = "linear-gradient(180deg, #020611 0%, #030813 100%)";

function isActivePath(href: string, path: string) {
  return href === path || (href === "/aor-factors" && path === "/aor-risk-intelligence");
}

export function Sidebar() {
  const [location] = useLocation();
  const currentPath = location.split("?")[0];

  return (
    <>
      <aside
        className="insight-sidebar fixed left-0 top-0 z-30 hidden h-screen w-[210px] overflow-y-auto overscroll-contain border-r border-slate-300/10 px-3.5 py-5 shadow-[18px_0_60px_rgba(0,0,0,.44),inset_-1px_0_0_rgba(255,255,255,.035)] lg:block"
        style={{ background: DESKTOP_SIDEBAR_BACKGROUND, backgroundColor: "#020611" }}
      >
        <Link href="/" aria-label="Back to landing page" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.045] px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-200/30 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
          <ArrowLeft size={17} aria-hidden="true" />
          Back
        </Link>
        <nav className="mt-7 space-y-1 pb-7" aria-label="Insight Hub intelligence tools">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href, currentPath);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-[14px] font-medium leading-5 transition duration-200", active ? "border-cyan-200/20 bg-white/[0.065] text-white shadow-[inset_2px_0_0_rgba(103,232,249,.72),inset_0_1px_0_rgba(255,255,255,.045)]" : "border-transparent bg-transparent text-slate-300/70 hover:border-slate-200/8 hover:bg-white/[0.035] hover:text-white")}>
                <Icon size={16} className={cn("shrink-0 transition", active ? "text-cyan-200/90" : "text-slate-400/70 group-hover:text-slate-200")} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="fixed inset-x-0 top-0 z-[900] lg:hidden">
        <nav className="insight-mobile-nav flex gap-2 overflow-x-auto border-b border-cyan-100/14 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] shadow-[0_16px_44px_rgba(0,0,0,.42)]" style={{ background: MOBILE_SIDEBAR_BACKGROUND, backgroundColor: "#020611" }} aria-label="Insight Hub intelligence tools">
          <Link href="/" aria-label="Back to landing page" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs font-semibold text-white"><ArrowLeft size={15} aria-hidden="true" />Back</Link>
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href, currentPath);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition", active ? "border-cyan-200/24 bg-cyan-300/14 text-white" : "border-white/8 bg-white/[0.035] text-cyan-50/64 hover:border-cyan-100/18 hover:text-white")}><Icon size={15} className="shrink-0" aria-hidden="true" /><span>{item.label}</span></Link>;
          })}
        </nav>
      </div>
    </>
  );
}
