import {
  BarChart3,
  BookOpenCheck,
  Building2,
  Calculator,
  CircleDollarSign,
  Database,
  FileSearch,
  GitBranch,
  Home,
  Landmark,
  Map,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/entities", label: "Entities", icon: Building2 },
  { href: "/competitors", label: "Competitors", icon: Target },
  { href: "/federal-agencies", label: "Federal Agencies", icon: Landmark },
  { href: "/state-agencies", label: "State Agencies", icon: Map },
  { href: "/sec-filings", label: "SEC Filings", icon: FileSearch },
  { href: "/leadership-map", label: "Organizational Chart", icon: GitBranch },
  { href: "/dba-intelligence", label: "DBA Data Hub", icon: ShieldCheck },
  { href: "/fec-filings", label: "FEC Filings", icon: Landmark },
  {
    href: "/onet-master-tool",
    label: "O*NET Master Tool",
    icon: BookOpenCheck,
  },
  {
    href: "/occupational-data-explorer",
    label: "Occupational Data Explorer",
    icon: Database,
  },
  {
    href: "/industry-impact-calculator",
    label: "Industry Impact Calculator",
    icon: BarChart3,
  },
  {
    href: "/occupational-calculators",
    label: "Occupational Calculators",
    icon: Calculator,
  },
  {
    href: "/industry-injury-benchmarks",
    label: "Industry Injury Benchmarks",
    icon: BarChart3,
  },
  {
    href: "/occupational-demands",
    label: "Occupational Demands",
    icon: BookOpenCheck,
  },
  { href: "/federal-awards", label: "Federal Awards", icon: CircleDollarSign },
  {
    href: "/public-legal-references",
    label: "Public Legal References",
    icon: Scale,
  },
  {
    href: "/aor-risk-intelligence",
    label: "AOR Risk Intelligence",
    icon: ShieldAlert,
  },
];

const CORE_OWNERSHIP_NOTICE =
  "Entities, Competitors, Federal Agencies, and State Agencies are owned by Insight Hub 2. Global Locations and Location Overlap remain available from their portal cards.";

function isActivePath(itemHref: string, currentPath: string) {
  if (currentPath === itemHref) return true;
  return (
    itemHref === "/entities" && ["/prospects", "/clients"].includes(currentPath)
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const currentPath = location.split("?")[0];

  return (
    <>
      <aside className="insight-sidebar fixed left-0 top-0 z-30 hidden h-screen w-[210px] overflow-y-auto overscroll-contain border-r border-cyan-100/16 bg-[#030813]/96 px-4 py-5 shadow-[18px_0_70px_rgba(0,0,0,.46),inset_-1px_0_0_rgba(255,255,255,.07)] backdrop-blur-3xl lg:block">
        <Link
          href="/"
          className="block py-1 focus-visible:rounded-2xl"
          aria-label="Insight Hub 2 home"
        >
          <div className="flex h-16 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-100/16 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,.10),0_0_24px_rgba(34,211,238,.06)]">
              <span className="h-3 w-6 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,.32)]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white">
                Occu-Med
              </p>
              <p className="text-[9px] uppercase tracking-[0.28em] text-cyan-100/38">
                Insight Hub 2
              </p>
            </div>
          </div>
        </Link>

        <div className="mt-8 pb-8">
          <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.25em] text-cyan-100/38">
            Intelligence Tools
          </p>
          <nav
            className="space-y-1"
            aria-label="Insight Hub intelligence tools"
          >
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.href, currentPath);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] leading-5 transition duration-300",
                    active
                      ? "border-cyan-200/22 bg-cyan-300/12 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.08)]"
                      : "border-transparent bg-transparent text-cyan-100/58 hover:border-cyan-100/12 hover:bg-white/[0.045] hover:text-cyan-50",
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 border-t border-cyan-100/8 pt-4 text-[9px] leading-4 text-cyan-100/26">
            {CORE_OWNERSHIP_NOTICE}
          </div>
        </div>
      </aside>

      <nav
        className="insight-mobile-nav fixed inset-x-0 top-0 z-[900] flex gap-2 overflow-x-auto border-b border-cyan-100/14 bg-[#030813]/94 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] shadow-[0_16px_44px_rgba(0,0,0,.36)] backdrop-blur-2xl lg:hidden"
        aria-label="Insight Hub intelligence tools"
      >
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(item.href, currentPath);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition",
                active
                  ? "border-cyan-200/24 bg-cyan-300/14 text-white"
                  : "border-white/8 bg-white/[0.035] text-cyan-50/64 hover:border-cyan-100/18 hover:text-white",
              )}
            >
              <Icon size={15} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
