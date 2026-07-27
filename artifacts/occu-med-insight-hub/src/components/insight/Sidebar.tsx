import {
  BarChart3,
  BookOpenCheck,
  CircleDollarSign,
  FileSearch,
  GitBranch,
  Globe2,
  Home,
  Landmark,
  LibraryBig,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/data-profiles", label: "Company Library", icon: LibraryBig },
  { href: "/sec-filings", label: "SEC Filings", icon: FileSearch },
  { href: "/leadership-map", label: "Organizational Chart", icon: GitBranch },
  { href: "/dba-intelligence", label: "DBA Data Hub", icon: ShieldCheck },
  { href: "/fec-filings", label: "FEC Filings", icon: Landmark },
  { href: "/industry-injury-benchmarks", label: "Industry Injury Benchmarks", icon: BarChart3 },
  { href: "/occupational-demands", label: "Occupational Demands", icon: BookOpenCheck },
  { href: "/federal-awards", label: "Federal Awards", icon: CircleDollarSign },
  { href: "/public-legal-references", label: "Public Legal References", icon: Scale },
  { href: "/aor-risk-intelligence", label: "AOR Risk Intelligence", icon: ShieldAlert },
];

export function Sidebar() {
  const [location] = useLocation();
  const currentPath = location.split("?")[0];
  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[210px] overflow-y-auto overscroll-contain border-r border-cyan-100/14 bg-[#030813]/91 px-4 py-5 shadow-[18px_0_70px_rgba(0,0,0,.35)] backdrop-blur-2xl lg:block">
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
      <div className="mt-8 pb-8">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.25em] text-cyan-100/35">Intelligence Tools</p>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = currentPath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] leading-5 transition duration-300",
                  active
                    ? "border border-cyan-200/20 bg-cyan-300/16 text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,.14),inset_0_0_26px_rgba(34,211,238,.1)]"
                    : "border border-transparent text-cyan-100/55 hover:border-cyan-100/10 hover:bg-white/[0.05] hover:text-cyan-50",
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 border-t border-cyan-100/8 pt-4 text-[9px] leading-4 text-cyan-100/24">
          Global Locations and Location Overlap remain available from their portal cards.
        </div>
      </div>
    </aside>
  );
}
