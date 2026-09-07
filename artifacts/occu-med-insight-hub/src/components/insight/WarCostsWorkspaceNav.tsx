import { Activity, BarChart3, Calculator, Database, FileText, MapPinned } from "lucide-react";
import { Link, useLocation } from "wouter";

const items = [
  { href: "/war-costs-intelligence", label: "Overview", icon: Database },
  { href: "/war-costs-map", label: "War Map", icon: MapPinned },
  { href: "/war-costs-tools", label: "Tools", icon: Activity },
  { href: "/war-costs-special-tools", label: "Specialized", icon: Calculator },
  { href: "/war-costs-visualizations", label: "Visualizations", icon: BarChart3 },
  { href: "/war-costs-site-evidence", label: "Evidence", icon: FileText },
] as const;

export function WarCostsWorkspaceNav() {
  const [location] = useLocation();
  const current = location.split("?")[0];
  return (
    <nav aria-label="WarCosts workspace" className="flex min-h-12 items-end gap-6 overflow-x-auto border-b border-slate-300/10">
      {items.map((item) => {
        const Icon = item.icon;
        const active = current === item.href || (item.href === "/war-costs-intelligence" && current === "/war-costs");
        return (
          <Link key={item.href} href={item.href} className={`group inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-0.5 text-[13px] font-semibold transition ${active ? "border-cyan-200/85 text-white" : "border-transparent text-slate-400 hover:text-slate-100"}`}>
            <Icon size={14} className={active ? "text-cyan-200" : "text-slate-500 group-hover:text-slate-300"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
