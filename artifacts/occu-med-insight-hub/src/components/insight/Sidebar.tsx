import { BarChart3, Building2, Globe2, Home, Layers, Library, Search, ShieldCheck, CheckCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
const occuMedLogo = "https://base44.app/api/apps/69f08d58f2a02a258d395477/files/mp/public/69f08d58f2a02a258d395477/ac708dd5f_logo-transparent.png"; // Updated to new Occu-Med branding

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/data-profiles", label: "Data Profiles", icon: Building2 },
  { href: "/quantifiable-data", label: "Quantifiable Data", icon: BarChart3 },
  { href: "/geographic-data", label: "Geographic Data", icon: Globe2 },
  { href: "/entity-discovery", label: "Add Entity", icon: Search },
  { href: "/entity-review", label: "Entity Review", icon: CheckCircle },
];

const aux = ["Entity Intelligence", "Entity Discovery", "Federal Agencies"];

export function Sidebar() {
  const [location] = useLocation();
  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[210px] border-r border-cyan-100/14 bg-[#030813]/91 px-4 py-5 shadow-[18px_0_70px_rgba(0,0,0,.35)] backdrop-blur-2xl lg:block">
      <Link href="/" className="sidebar-logo block py-1">
        <img src={occuMedLogo} alt="Occu-Med" className="h-16 w-auto object-contain drop-shadow-[0_0_14px_rgba(255,255,255,0.30)]" />
      </Link>
      <p className="mt-3 px-1 text-[10px] uppercase tracking-[0.28em] text-cyan-100/35">Insight Hub</p>
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
      <div className="mt-8">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.25em] text-cyan-100/35">Configured Links</p>
        <div className="space-y-2">
          {aux.map((label, index) => {
            const Icon = [Layers, ShieldCheck, Library][index];
            return <div key={label} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-cyan-100/42"><Icon size={15} />{label}</div>;
          })}
        </div>
      </div>
    </aside>
  );
}
