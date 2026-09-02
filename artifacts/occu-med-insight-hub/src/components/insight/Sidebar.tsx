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

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/injuries-medical-conditions", label: "Injuries & Medical Conditions", icon: Activity },
  { href: "/job-intelligence", label: "Job Intelligence", icon: BriefcaseBusiness },
  { href: "/aor-factors", label: "AOR Factors", icon: ShieldAlert },
  { href: "/drug-checker", label: "Drug Checker", icon: Pill },
  { href: "/clinical-calculators", label: "Clinical Calculators", icon: Calculator },
  { href: "/standards-intelligence", label: "Standards Intelligence", icon: Stethoscope },
  { href: "/federal-agencies", label: "Federal Agencies", icon: Landmark },
  { href: "/state-agencies", label: "State Agencies", icon: Map },
  { href: "/sec-filings", label: "SEC Filings", icon: FileSearch },
  { href: "/leadership-map", label: "Organizational Chart", icon: GitBranch },
  { href: "/dba-intelligence", label: "DBA Data Hub", icon: ShieldCheck },
  { href: "/onet-master-tool", label: "O*NET Master Tool", icon: BookOpenCheck },
  { href: "/occupational-data-explorer", label: "Occupational Data Explorer", icon: Database },
  { href: "/industry-impact-calculator", label: "Industry Impact Calculator", icon: BarChart3 },
  { href: "/occupational-calculators", label: "Occupational Calculators", icon: Calculator },
  { href: "/war-costs-intelligence", label: "WarCosts Intelligence", icon: Radar },
  { href: "/federal-awards", label: "Federal Awards Intelligence", icon: CircleDollarSign },
  { href: "/public-legal-references", label: "Legal & Injury Intelligence", icon: Scale },
];

const WAR_COSTS_SUBNAV = [
  { href: "/war-costs-intelligence", label: "Overview & Data" },
  { href: "/war-costs-map", label: "War Map" },
  { href: "/war-costs-tools", label: "Interactive Tools" },
  { href: "/war-costs-special-tools", label: "Specialized Tools" },
  { href: "/war-costs-visualizations", label: "Visualizations" },
  { href: "/war-costs-accountability", label: "Accountability" },
  { href: "/war-costs-site-evidence", label: "Site Evidence" },
] as const;

const CORE_OWNERSHIP_NOTICE =
  "Entities remains a compatibility workspace but is no longer a primary tab. Industry Injury Benchmarks are folded into Industry Impact. Occupational Demands are folded into Job Intelligence. FEC intelligence remains entity-linked rather than a primary navigation destination.";

const DESKTOP_SIDEBAR_BACKGROUND = "linear-gradient(180deg, #020611 0%, #030813 42%, #02050d 100%)";
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
  const warCostsActive = isWarCostsPath(currentPath);

  return (
    <>
      <aside className="insight-sidebar fixed left-0 top-0 z-30 hidden h-screen w-[210px] overflow-y-auto overscroll-contain border-r border-cyan-100/16 px-4 py-5 shadow-[18px_0_70px_rgba(0,0,0,.52),inset_-1px_0_0_rgba(255,255,255,.07)] lg:block" style={{ background: DESKTOP_SIDEBAR_BACKGROUND, backgroundColor: "#020611" }}>
        {entitiesCompatibilityActive ? <Link href="/entities" aria-current="page" className="sr-only">Entities</Link> : null}
        <Link href="/" className="block py-1 focus-visible:rounded-2xl" aria-label="Insight Hub 2 home">
          <div className="flex h-16 items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-100/16 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_24px_rgba(34,211,238,.06)]"><span className="h-3 w-6 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,.32)]" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white">Occu-Med</p><p className="text-[9px] uppercase tracking-[0.28em] text-cyan-100/38">Insight Hub 2</p></div></div>
        </Link>
        <div className="mt-8 pb-8"><p className="mb-2 px-1 text-[10px] uppercase tracking-[0.25em] text-cyan-100/38">Intelligence Tools</p><nav className="space-y-1" aria-label="Insight Hub intelligence tools">{nav.map((item) => { const Icon = item.icon; const active = isActivePath(item.href, currentPath); const warCostsItem = item.href === "/war-costs-intelligence"; return <div key={item.href}><Link href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] leading-5 transition duration-300", active ? "border-cyan-200/22 bg-cyan-300/12 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.08)]" : "border-transparent bg-transparent text-cyan-100/58 hover:border-cyan-100/12 hover:bg-white/[0.045] hover:text-cyan-50")}><Icon size={16} className="shrink-0" /><span>{item.label}</span></Link>{warCostsItem && warCostsActive ? <div className="mb-2 ml-7 mt-1 space-y-1 border-l border-cyan-100/12 pl-2">{WAR_COSTS_SUBNAV.map((sub) => { const selected = currentPath === sub.href || (sub.href === "/war-costs-intelligence" && currentPath === "/war-costs"); return <Link key={sub.href} href={sub.href} className={cn("block rounded-lg px-2 py-1.5 text-[10px] font-semibold transition", selected ? "bg-cyan-300/10 text-cyan-50" : "text-cyan-100/38 hover:bg-white/[0.035] hover:text-cyan-50/80")}>{sub.label}</Link>; })}</div> : null}</div>; })}</nav><div className="mt-6 border-t border-cyan-100/8 pt-4 text-[9px] leading-4 text-cyan-100/26">{CORE_OWNERSHIP_NOTICE}</div></div>
      </aside>

      <div className="fixed inset-x-0 top-0 z-[900] lg:hidden">
        <nav className="insight-mobile-nav flex gap-2 overflow-x-auto border-b border-cyan-100/14 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] shadow-[0_16px_44px_rgba(0,0,0,.42)]" style={{ background: MOBILE_SIDEBAR_BACKGROUND, backgroundColor: "#020611" }} aria-label="Insight Hub intelligence tools">
          {entitiesCompatibilityActive ? <Link href="/entities" aria-current="page" className="sr-only">Entities</Link> : null}
          {nav.map((item) => { const Icon = item.icon; const active = isActivePath(item.href, currentPath); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition", active ? "border-cyan-200/24 bg-cyan-300/14 text-white" : "border-white/8 bg-white/[0.035] text-cyan-50/64 hover:border-cyan-100/18 hover:text-white")}><Icon size={15} className="shrink-0" /><span>{item.label}</span></Link>; })}
        </nav>
        {warCostsActive ? <nav className="flex gap-2 overflow-x-auto border-b border-cyan-100/10 bg-[#020611]/96 px-3 py-2" aria-label="WarCosts workspace">{WAR_COSTS_SUBNAV.map((sub) => { const selected = currentPath === sub.href || (sub.href === "/war-costs-intelligence" && currentPath === "/war-costs"); return <Link key={sub.href} href={sub.href} className={cn("shrink-0 rounded-lg border px-3 py-2 text-[10px] font-bold", selected ? "border-cyan-200/24 bg-cyan-300/12 text-white" : "border-white/8 bg-white/[0.025] text-cyan-100/45")}>{sub.label}</Link>; })}</nav> : null}
      </div>
    </>
  );
}
