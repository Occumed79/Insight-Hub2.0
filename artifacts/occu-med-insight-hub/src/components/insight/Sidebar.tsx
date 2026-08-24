import {
  Activity,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Calculator,
  CircleDollarSign,
  Database,
  FileSearch,
  GitBranch,
  Home,
  Landmark,
  Map,
  Pill,
  Scale,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Reviewer Intelligence",
    items: [
      { href: "/injuries-medical-conditions", label: "Injuries & Medical Conditions", icon: Activity },
      { href: "/job-intelligence", label: "Job Intelligence", icon: BriefcaseBusiness },
      { href: "/aor-factors", label: "AOR Factors", icon: ShieldAlert },
      { href: "/drug-checker", label: "Drug Checker", icon: Pill },
      { href: "/clinical-calculators", label: "Clinical Calculators", icon: Calculator },
      { href: "/standards-intelligence", label: "Standards Intelligence", icon: Stethoscope },
    ],
  },
  {
    label: "Government Intelligence",
    items: [
      { href: "/federal-agencies", label: "Federal Agencies", icon: Landmark },
      { href: "/state-agencies", label: "State Agencies", icon: Map },
      { href: "/federal-awards", label: "Federal Awards", icon: CircleDollarSign },
      { href: "/public-legal-references", label: "Legal & Injury", icon: Scale },
      { href: "/sec-filings", label: "SEC Filings", icon: FileSearch },
    ],
  },
  {
    label: "Occupational Modeling",
    items: [
      { href: "/onet-master-tool", label: "O*NET Master Tool", icon: BookOpenCheck },
      { href: "/occupational-data-explorer", label: "Occupational Data Explorer", icon: Database },
      { href: "/industry-impact-calculator", label: "Industry Impact Calculator", icon: BarChart3 },
      { href: "/occupational-calculators", label: "Occupational Calculators", icon: Calculator },
    ],
  },
  {
    label: "Organization",
    items: [{ href: "/leadership-map", label: "Organizational Chart", icon: GitBranch }],
  },
] as const;

const FLAT_NAV = [{ href: "/", label: "Home", icon: Home }, ...NAV_GROUPS.flatMap((group) => group.items)];
const DESKTOP_SIDEBAR_BACKGROUND = "linear-gradient(180deg, #020611 0%, #030813 42%, #02050d 100%)";
const MOBILE_SIDEBAR_BACKGROUND = "linear-gradient(180deg, #020611 0%, #030813 100%)";

function isActivePath(itemHref: string, currentPath: string) {
  if (currentPath === itemHref) return true;
  if (itemHref === "/aor-factors" && currentPath === "/aor-risk-intelligence") return true;
  if (itemHref === "/industry-impact-calculator" && currentPath === "/industry-injury-benchmarks") return true;
  if (itemHref === "/job-intelligence" && currentPath === "/occupational-demands") return true;
  return false;
}

function NavLink({ item, currentPath }: { item: (typeof FLAT_NAV)[number]; currentPath: string }) {
  const Icon = item.icon;
  const active = isActivePath(item.href, currentPath);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-2xl border px-3 py-2.5 text-[13px] leading-5 transition duration-300",
        active
          ? "border-cyan-200/25 bg-[linear-gradient(135deg,rgba(34,211,238,.13),rgba(99,102,241,.08))] text-white shadow-[0_0_28px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.10)]"
          : "border-transparent text-cyan-100/58 hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-xl transition", active ? "bg-cyan-300/10 text-cyan-50" : "text-cyan-100/42 group-hover:bg-white/[0.035] group-hover:text-cyan-50")}>
        <Icon size={15} />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const currentPath = location.split("?")[0];
  const entitiesCompatibilityActive = ["/entities", "/prospects", "/clients"].includes(currentPath);

  return (
    <>
      <aside
        className="insight-sidebar fixed left-0 top-0 z-30 hidden h-screen w-[224px] overflow-y-auto overscroll-contain border-r border-cyan-100/14 px-4 py-5 shadow-[18px_0_70px_rgba(0,0,0,.52),inset_-1px_0_0_rgba(255,255,255,.07)] lg:block"
        style={{ background: DESKTOP_SIDEBAR_BACKGROUND, backgroundColor: "#020611" }}
      >
        {entitiesCompatibilityActive ? <Link href="/entities" aria-current="page" className="sr-only">Entities</Link> : null}
        <Link href="/" className="block py-1 focus-visible:rounded-2xl" aria-label="Insight Hub 2 home">
          <div className="flex h-16 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-100/16 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_24px_rgba(34,211,238,.06)]"><span className="h-3 w-6 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,.32)]" /></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white">Occu-Med</p><p className="text-[9px] uppercase tracking-[0.28em] text-cyan-100/38">Insight Hub 2</p></div>
          </div>
        </Link>

        <div className="mt-6 pb-8">
          <NavLink item={FLAT_NAV[0]} currentPath={currentPath} />
          <div className="mt-5 space-y-5">
            {NAV_GROUPS.map((group) => (
              <section key={group.label}>
                <p className="mb-2 px-2 text-[8px] font-black uppercase tracking-[0.23em] text-cyan-100/30">{group.label}</p>
                <nav className="space-y-1" aria-label={group.label}>
                  {group.items.map((item) => <NavLink key={item.href} item={item} currentPath={currentPath} />)}
                </nav>
              </section>
            ))}
          </div>
        </div>
      </aside>

      <nav
        className="insight-mobile-nav fixed inset-x-0 top-0 z-[900] flex gap-2 overflow-x-auto border-b border-cyan-100/14 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] shadow-[0_16px_44px_rgba(0,0,0,.42)] lg:hidden"
        style={{ background: MOBILE_SIDEBAR_BACKGROUND, backgroundColor: "#020611" }}
        aria-label="Insight Hub intelligence tools"
      >
        {entitiesCompatibilityActive ? <Link href="/entities" aria-current="page" className="sr-only">Entities</Link> : null}
        {FLAT_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(item.href, currentPath);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition", active ? "border-cyan-200/24 bg-cyan-300/14 text-white" : "border-white/8 bg-white/[0.035] text-cyan-50/64 hover:border-cyan-100/18 hover:text-white")}><Icon size={15} className="shrink-0" /><span>{item.label}</span></Link>;
        })}
      </nav>
    </>
  );
}
