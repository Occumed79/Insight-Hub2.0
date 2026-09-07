import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, MapPinned, RefreshCw, Search, Users } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { wcMoney, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

type ToolKey = "country-priority" | "expansion" | "contractors";

type DefensePresence = {
  ok: boolean;
  partial?: boolean;
  latestYear?: number | null;
  current?: WarCostsRow[];
  construction?: WarCostsRow[];
  warnings?: string[];
};

const DATASETS = ["base-index.json", "contractors.json"] as const;

const TOOLS: Array<{ key: ToolKey; label: string; note: string; icon: typeof Search }> = [
  { key: "country-priority", label: "Country Priority", note: "Personnel + installation + expansion evidence", icon: Users },
  { key: "expansion", label: "Expansion Watch", note: "New sites that may require provider recruitment", icon: MapPinned },
  { key: "contractors", label: "Contractor Directory", note: "Potential defense-client and opportunity context", icon: Building2 },
];

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

function country(row: WarCostsRow): string {
  return wcText(row, "country", "countryName", "hostCountry", "location") || "Unknown";
}

function CountryPriority({ personnel, bases, construction, year }: { personnel: WarCostsRow[]; bases: WarCostsRow[]; construction: WarCostsRow[]; year?: number | null }) {
  const rows = useMemo(() => {
    const byCountry = new Map<string, { country: string; personnel: number; installations: number; expansions: number; expansionValue: number }>();
    const get = (name: string) => {
      const key = name.trim() || "Unknown";
      const current = byCountry.get(key) || { country: key, personnel: 0, installations: 0, expansions: 0, expansionValue: 0 };
      byCountry.set(key, current);
      return current;
    };
    personnel.forEach((row) => { const item = get(country(row)); item.personnel = Math.max(item.personnel, wcNumber(row, "personnel", "troops")); });
    bases.forEach((row) => { get(country(row)).installations += 1; });
    construction.forEach((row) => { const item = get(country(row)); item.expansions += 1; item.expansionValue += wcNumber(row, "spending", "amount", "cost", "total"); });
    return [...byCountry.values()].filter((item) => item.country !== "Unknown").sort((a, b) => b.personnel - a.personnel || b.expansions - a.expansions || b.installations - a.installations);
  }, [bases, construction, personnel]);

  return <section className="border border-white/10 bg-[#080c12]">
    <header className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Network-priority evidence</p><h2 className="mt-1 text-xl font-black text-white">Countries where medical-network capacity may matter most</h2><p className="mt-2 max-w-4xl text-xs leading-6 text-slate-400">Sorted primarily by U.S. personnel footprint, then by expansion and installation evidence. This is planning context, not an Occu-Med demand forecast or a claim that personnel counts equal contractor medical volume.{year ? ` Personnel source year: ${year}.` : ""}</p></header>
    <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-xs"><thead className="border-b border-white/8 text-[9px] uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">Country</th><th className="p-3 text-right">Personnel</th><th className="p-3 text-right">Installations</th><th className="p-3 text-right">Expansion sites</th><th className="p-3 text-right">Expansion value</th><th className="p-3">Occu-Med use</th></tr></thead><tbody>{rows.slice(0, 120).map((item) => <tr key={item.country} className="border-b border-white/[.055]"><td className="p-3 font-black text-white">{item.country}</td><td className="p-3 text-right font-bold text-slate-200">{item.personnel ? item.personnel.toLocaleString() : "—"}</td><td className="p-3 text-right text-slate-300">{item.installations.toLocaleString()}</td><td className="p-3 text-right text-slate-300">{item.expansions.toLocaleString()}</td><td className="p-3 text-right text-slate-300">{item.expansionValue ? wcMoney(item.expansionValue) : "—"}</td><td className="p-3 text-[11px] leading-5 text-slate-500">{item.expansions ? "Emerging provider-network / referral-capacity review" : item.installations ? "Existing provider-network coverage review" : "Country-level network context"}</td></tr>)}</tbody></table></div>
  </section>;
}

function ExpansionWatch({ construction }: { construction: WarCostsRow[] }) {
  const rows = useMemo(() => [...construction].sort((a, b) => wcNumber(b, "year") - wcNumber(a, "year") || wcNumber(b, "spending", "amount", "cost", "total") - wcNumber(a, "spending", "amount", "cost", "total")), [construction]);
  return <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Expansion watch</p><h2 className="mt-1 text-xl font-black text-white">New or expanding defense sites</h2><p className="mt-2 text-xs leading-6 text-slate-400">Use construction records as an early signal to investigate whether contractor medical support, provider recruitment, travel-health capability, diagnostics, dental, audiology, PFT, labs, or vaccination capacity will be needed.</p></header><div className="divide-y divide-white/[.06]">{rows.slice(0, 180).map((row, index) => { const location = wcText(row, "location", "site", "facility") || `Expansion site ${index + 1}`; const nation = country(row); const year = wcNumber(row, "year"); const spending = wcNumber(row, "spending", "amount", "cost", "total"); return <article key={`${location}-${nation}-${index}`} className="grid gap-2 p-4 md:grid-cols-[1.3fr_.8fr_110px_130px_1.6fr]"><strong className="text-sm text-white">{location}</strong><span className="text-xs text-slate-400">{nation}</span><span className="text-xs text-slate-300">{year || "—"}</span><span className="text-xs font-bold text-slate-200">{spending ? wcMoney(spending) : "—"}</span><span className="text-[11px] leading-5 text-slate-500">Investigate local provider depth and client/contractor footprint before the site reaches steady-state operations.</span></article>; })}</div></section>;
}

function ContractorDirectory({ contractors }: { contractors: WarCostsRow[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contractors.filter((row) => !needle || JSON.stringify(row).toLowerCase().includes(needle));
  }, [contractors, query]);
  return <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Defense contractor context</p><h2 className="mt-1 text-xl font-black text-white">Contractor directory</h2><p className="mt-2 text-xs leading-6 text-slate-400">Use this only to identify possible clients, incumbents, competitors, or operating footprints that warrant follow-up in the rest of Insight Hub. Weapons and military-hardware inventory content is excluded.</p><div className="mt-4 flex min-h-11 items-center gap-2 border border-white/10 bg-black/25 px-3"><Search size={15} className="text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contractor, country, sector…" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" /><span className="text-[10px] font-black text-slate-500">{visible.length}</span></div></header><div className="divide-y divide-white/[.06]">{visible.slice(0, 180).map((row, index) => { const name = wcText(row, "name", "contractor", "company", "recipient") || `Contractor ${index + 1}`; return <article key={`${name}-${index}`} className="grid gap-2 p-4 md:grid-cols-[1.4fr_1fr_1fr_1.4fr]"><strong className="text-sm text-white">{name}</strong><span className="text-xs text-slate-400">{wcText(row, "country", "location", "headquarters") || "Location not reported"}</span><span className="text-xs text-slate-400">{wcText(row, "sector", "industry", "category") || "Defense contractor"}</span><span className="text-[11px] leading-5 text-slate-500">Potential entity/opportunity context only; validate relationship and current operating footprint before action.</span></article>; })}</div></section>;
}

export default function WarCostsTools() {
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [active, setActive] = useState<ToolKey>("country-priority");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [pairs, defense] = await Promise.all([
        Promise.all(DATASETS.map(async (name) => { try { return [name, await getWarCostsDataset(name, force)] as const; } catch { return [name, null] as const; } })),
        getDefensePresence(force).catch((reason) => ({ ok: false, partial: true, current: [], construction: [], warnings: [reason instanceof Error ? reason.message : "Defense-presence feed failed."] } as DefensePresence)),
      ]);
      const next: Record<string, WarCostsDatasetResponse> = {};
      for (const [name, response] of pairs) if (response) next[name] = response;
      setResponses(next);
      setDefensePresence(defense);
      const warnings = [...(defense.warnings || []), !next["base-index.json"] ? "Installation data unavailable." : "", !next["contractors.json"] ? "Contractor data unavailable." : ""].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);
  const data = useMemo(() => Object.fromEntries(Object.entries(responses).map(([name, response]) => [name, wcRows(response.data)])) as Record<string, WarCostsRow[]>, [responses]);

  return <main className="min-h-screen bg-[#06090d] pb-24 text-white"><Sidebar /><section className="px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Occu-Med · Defense network planning" title="Network Priority Tools" subtitle="Task-specific planning tools for countries, site expansion, and contractor context. Generic conflict, strike, naval, weapons, taxpayer-cost, and political tools are excluded." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.08] px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh data</button></div><WarCostsWorkspaceNav />{error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs text-amber-100/75">{error}</div> : null}<div className="mt-5 grid grid-cols-[220px_minmax(0,1fr)] border border-white/10 bg-[#070b10]"><aside className="border-r border-white/10"><div className="border-b border-white/10 p-4 text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Planning tools</div>{TOOLS.map((tool) => { const Icon = tool.icon; return <button key={tool.key} type="button" onClick={() => setActive(tool.key)} className={`w-full border-b border-white/[.06] p-4 text-left transition ${active === tool.key ? "bg-white/[.04] text-white" : "text-slate-400 hover:bg-white/[.02]"}`}><div className="flex items-center gap-2"><Icon size={14} /><strong className="text-xs">{tool.label}</strong></div><p className="mt-1.5 text-[9px] leading-4 text-slate-600">{tool.note}</p></button>; })}</aside><div className="min-w-0 p-5">{loading ? <div className="grid min-h-[520px] place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-slate-500">Loading Occu-Med-relevant defense data…</p></div></div> : null}{!loading && active === "country-priority" ? <CountryPriority personnel={defensePresence?.current || []} bases={data["base-index.json"] || []} construction={defensePresence?.construction || []} year={defensePresence?.latestYear} /> : null}{!loading && active === "expansion" ? <ExpansionWatch construction={defensePresence?.construction || []} /> : null}{!loading && active === "contractors" ? <ContractorDirectory contractors={data["contractors.json"] || []} /> : null}</div></div></section></main>;
}
