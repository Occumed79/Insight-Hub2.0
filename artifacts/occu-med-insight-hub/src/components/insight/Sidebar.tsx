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
  Radar,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Home };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/injuries-medical-conditions", label: "Injuries & Medical Conditions", icon: Activity },
      { href: "/job-intelligence", label: "Job Intelligence", icon: BriefcaseBusiness },
      { href: "/aor-factors", label: "AOR Factors", icon: ShieldAlert },
      { href: "/drug-checker", label: "Drug Checker", icon: Pill },
      { href: "/clinical-calculators", label: "Clinical Calculators", icon: Calculator },
      { href: "/standards-intelligence", label: "Standards Intelligence", icon: Stethoscope },
    ],
  },
  {
    label: "Public Intelligence",
    items: [
      { href: "/federal-agencies", label: "Federal Agencies", icon: Landmark },
      { href: "/state-agencies", label: "State Agencies", icon: Map },
      { href: "/sec-filings", label: "SEC Filings", icon: FileSearch },
      { href: "/leadership-map", label: "Organizational Chart", icon: GitBranch },
      { href: "/dba-intelligence", label: "DBA Data Hub", icon: ShieldCheck },
      { href: "/onet-master-tool", label: "O*NET Master Tool", icon: BookOpenCheck },
      { href: "/occupational-data-explorer", label: "Occupational Data Explorer", icon: Database },
      { href: "/industry-impact-calculator", label: "Industry Impact Calculator", icon: BarChart3 },
      { href: "/occupational-calculators", label: "Occupational Calculators", icon: Calculator },
    ],
  },
  {
    label: "Defense & Legal",
    items: [
      { href: "/war-costs-intelligence", label: "WarCosts Intelligence", icon: Radar },
      { href: "/federal-awards", label: "Federal Awards Intelligence", icon: CircleDollarSign },
      { href: "/public-legal-references", label: "Legal & Injury Intelligence", icon: Scale },
    ],
  },
];

const nav: NavItem[] = navGroups.flatMap((group) => group.items);
const DESKTOP_SIDEBAR_BACKGROUND = "linear-gradient(180deg, rgba(2,6,17,.99) 0%, rgba(3,8,19,.985) 48%, rgba(2,5,13,.995) 100%)";
const MOBILE_SIDEBAR_BACKGROUND = "linear-gradient(180deg, #020611 0%, #030813 100%)";

function isWarCostsPath(path: string) {
  return ["/war-costs-intelligence", "/war-costs", "/war-costs-map", "/war-costs-tools", "/war-costs-special-tools", "/war-costs-visualizations", "/war-costs-accountability", "/war-costs-site-evidence"].includes(path);
}

function isActivePath(itemHref: string, currentPath: string) {
  if (currentPath === itemHref) return true;
  if (itemHref === "/aor-factors" && currentPath === "/aor-risk-intelligence") return true;
  if (itemHref === "/industry-impact-calculator" && currentPath === "/industry-injury-benchmarks") return true;
  if (itemHref === "/job-intelligence" && currentPath === "/occupational-demands") return true;
  if (itemHref === "/war-costs-intelligence" && isWarCostsPath(currentPath)) return true;
  return false;
}

export function Sidebar() {
  const [location] = useLocation();
  const currentPath = location.split("?")[0];
  const entitiesCompatibilityActive = ["/entities", "/prospects", "/clients"].includes(currentPath);

  return (
    <>
      <aside
        className="insight-sidebar fixed left-0 top-0 z-30 hidden h-screen w-[210px] overflow-y-auto overscroll-contain border-r border-slate-300/10 px-3.5 py-5 shadow-[18px_0_60px_rgba(0,0,0,.44),inset_-1px_0_0_rgba(255,255,255,.035)] lg:block"
        style={{ background: DESKTOP_SIDEBAR_BACKGROUND, backgroundColor: "#020611" }}
      >
        {entitiesCompatibilityActive ? <Link href="/entities" aria-current="page" className="sr-only">Entities</Link> : null}

        <Link href="/" className="block rounded-2xl px-1 py-1 focus-visible:outline-none" aria-label="Insight Hub 2 home">
          <div className="flex h-14 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200/12 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,.07)]">
              <span className="h-2.5 w-6 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,.20)]" />
            </div>
            <div>
              <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-white">Occu-Med</p>
              <p className="mt-0.5 text-[11px] font-medium tracking-[0.08em] text-slate-400">Insight Hub 2</p>
            </div>
          </div>
        </Link>

        <nav className="mt-6 pb-7" aria-label="Insight Hub intelligence tools">
          {navGroups.map((group, groupIndex) => (
            <section key={group.label} className={groupIndex === 0 ? "" : "mt-6 border-t border-slate-300/8 pt-5"}>
              <p className="mb-2.5 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400/78">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(item.href, currentPath);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-[14px] font-medium leading-5 transition duration-200",
                        active
                          ? "border-cyan-200/20 bg-white/[0.065] text-white shadow-[inset_2px_0_0_rgba(103,232,249,.72),inset_0_1px_0_rgba(255,255,255,.045)]"
                          : "border-transparent bg-transparent text-slate-300/70 hover:border-slate-200/8 hover:bg-white/[0.035] hover:text-white",
                      )}
                    >
                      <Icon size={16} className={cn("shrink-0 transition", active ? "text-cyan-200/90" : "text-slate-400/70 group-hover:text-slate-200")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div className="fixed inset-x-0 top-0 z-[900] lg:hidden">
        <nav className="insight-mobile-nav flex gap-2 overflow-x-auto border-b border-cyan-100/14 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] shadow-[0_16px_44px_rgba(0,0,0,.42)]" style={{ background: MOBILE_SIDEBAR_BACKGROUND, backgroundColor: "#020611" }} aria-label="Insight Hub intelligence tools">
          {entitiesCompatibilityActive ? <Link href="/entities" aria-current="page" className="sr-only">Entities</Link> : null}
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href, currentPath);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition", active ? "border-cyan-200/24 bg-cyan-300/14 text-white" : "border-white/8 bg-white/[0.035] text-cyan-50/64 hover:border-cyan-100/18 hover:text-white")}><Icon size={15} className="shrink-0" /><span>{item.label}</span></Link>;
          })}
        </nav>
      </div>
    </>
  );
}
