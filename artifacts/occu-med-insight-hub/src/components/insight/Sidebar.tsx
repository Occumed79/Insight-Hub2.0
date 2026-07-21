import { Activity, BarChart3, Building2, ClipboardList, Globe2, Grid3X3, Home, Network, RadioTower, Route, ScatterChart, ServerCog, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/employer-workflow", label: "Employer Workflow", icon: Route },
  { href: "/data-profiles", label: "Data Profiles", icon: Building2 },
  { href: "/data-visualization", label: "Data Visualization", icon: ScatterChart },
  { href: "/quantifiable-data", label: "Quantifiable Data", icon: BarChart3 },
  { href: "/geographic-data", label: "Geographic Data", icon: Globe2 },
  { href: "/employer-intelligence", label: "Employer Intelligence", icon: Activity },
  { href: "/entity-resolution", label: "Entity Resolution", icon: Network },
  { href: "/occupational-exposure", label: "Exposure Matrix", icon: Grid3X3 },
  { href: "/company-live-intelligence", label: "Company Live Intel", icon: RadioTower },
  { href: "/workers-comp-coverage", label: "Workers’ Comp Coverage", icon: ClipboardList },
  { href: "/dba-intelligence", label: "DBA Intelligence", icon: ShieldCheck },
  { href: "/source-governance", label: "Source Governance", icon: ServerCog },
];

export function Sidebar() {
  const [location] = useLocation();
  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[210px] border-r border-cyan-100/14 bg-[#030813]/91 px-4 py-5 shadow-[18px_0_70px_rgba(0,0,0,.35)] backdrop-blur-2xl lg:block">
      <Link href="/" className="block py-1">
        <div className="flex h-16 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-100/14 bg-white/[0.04]">
            <span className="h-3 w-6 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,.32)]" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white">Occu-Med</p>
            <p className="text-[9px] uppercase tracking-[0.28em] text-cyan-100/35">Insight Hub</p>
          </div>
        </div>
      </Link>
      <div className="mt-8">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.25em] text-cyan-100/35">Intelligence</p>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-300", active ? "border border-cyan-200/20 bg-cyan-300/16 text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,.14),inset_0_0_26px_rgba(34,211,238,.1)]" : "border border-transparent text-cyan-100/55 hover:border-cyan-100/10 hover:bg-white/[0.05] hover:text-cyan-50")}>
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
