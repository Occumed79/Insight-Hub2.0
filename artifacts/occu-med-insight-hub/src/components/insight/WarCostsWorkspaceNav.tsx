import { Activity, Calculator, Database, FileText } from "lucide-react";
import { Link, useLocation } from "wouter";

const items = [
  { href: "/war-costs-intelligence", label: "Overview & Data", note: "Full live mirror", icon: Database },
  { href: "/war-costs-tools", label: "Interactive Tools", note: "Maps, rankings & core calculators", icon: Activity },
  { href: "/war-costs-special-tools", label: "Specialized Tools", note: "Aid, countries, Hormuz & Iran/Iraq", icon: Calculator },
  { href: "/war-costs-site-evidence", label: "Site Evidence", note: "Page-only facts & analyses", icon: FileText },
] as const;

export function WarCostsWorkspaceNav() {
  const [location] = useLocation();
  const current = location.split("?")[0];
  return (
    <nav aria-label="WarCosts workspace" className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        const active = current === item.href || (item.href === "/war-costs-intelligence" && current === "/war-costs");
        return (
          <Link key={item.href} href={item.href} className={`rounded-2xl border p-4 transition ${active ? "border-cyan-200/30 bg-cyan-300/12 shadow-[0_0_32px_rgba(34,211,238,.08)]" : "border-cyan-100/8 bg-black/10 hover:border-cyan-100/18 hover:bg-white/[.035]"}`}>
            <div className="flex items-center gap-3"><Icon size={17} className={active ? "text-cyan-100" : "text-cyan-100/42"} /><div><p className="text-xs font-black text-white">{item.label}</p><p className="mt-1 text-[9px] text-cyan-100/38">{item.note}</p></div></div>
          </Link>
        );
      })}
    </nav>
  );
}
