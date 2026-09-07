import { useEffect, useMemo, useState } from "react";
import { Activity, Globe2, Loader2, RefreshCw, ShipWheel } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { wcConflictName, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

type Tool = "countries" | "naval" | "regional";

const DATASETS = ["base-countries.json", "overseas-presence.json", "operations.json", "conflicts.json"] as const;

const TOOLS: Array<{ key: Tool; label: string; note: string; icon: typeof Globe2 }> = [
  { key: "countries", label: "Country Footprint", note: "Installations and personnel context", icon: Globe2 },
  { key: "naval", label: "Naval Context", note: "Maritime deployment records", icon: ShipWheel },
  { key: "regional", label: "Regional Instability", note: "Conflict and operational context", icon: Activity },
];

function place(row: WarCostsRow) {
  return wcText(row, "country", "countryName", "location", "region", "hostCountry", "aor");
}

function CountryFootprint({ countries, deployments }: { countries: WarCostsRow[]; deployments: WarCostsRow[] }) {
  const [query, setQuery] = useState("");
  const merged = useMemo(() => {
    const map = new Map<string, { country: string; bases: number; personnel: number; records: number }>();
    for (const row of countries) {
      const country = place(row) || wcText(row, "name");
      if (!country) continue;
      map.set(country, {
        country,
        bases: wcNumber(row, "bases", "baseCount", "installations", "count"),
        personnel: wcNumber(row, "personnel", "troops"),
        records: 1,
      });
    }
    for (const row of deployments) {
      const country = place(row);
      if (!country) continue;
      const current = map.get(country) || { country, bases: 0, personnel: 0, records: 0 };
      current.personnel = Math.max(current.personnel, wcNumber(row, "personnel", "troops", "count"));
      current.records += 1;
      map.set(country, current);
    }
    const needle = query.trim().toLowerCase();
    return [...map.values()].filter((item) => !needle || item.country.toLowerCase().includes(needle)).sort((a, b) => (b.personnel + b.bases * 100) - (a.personnel + a.bases * 100));
  }, [countries, deployments, query]);

  return <GlassCard className="p-5"><h3 className="text-lg font-black">Country Defense Footprint</h3><p className="mt-1 text-xs text-cyan-100/42">Country-level installation and personnel context.</p><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search country…" className="mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none" /><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="text-[9px] uppercase tracking-wider text-cyan-100/35"><tr><th className="p-2">Country</th><th className="p-2">Installations</th><th className="p-2">Personnel signal</th><th className="p-2">Source records</th></tr></thead><tbody>{merged.map((item) => <tr key={item.country} className="border-t border-white/7"><td className="p-2 font-bold">{item.country}</td><td className="p-2">{item.bases || "—"}</td><td className="p-2">{item.personnel ? item.personnel.toLocaleString() : "—"}</td><td className="p-2">{item.records}</td></tr>)}</tbody></table></div></GlassCard>;
}

function NavalContext({ deployments, operations }: { deployments: WarCostsRow[]; operations: WarCostsRow[] }) {
  const keyword = /(navy|naval|carrier|fleet|warship|ship|maritime|red sea|arabian sea|persian gulf|strait|sea of oman|mediterranean)/i;
  const rows = useMemo(() => [...deployments, ...operations].filter((row) => keyword.test(JSON.stringify(row))).slice(0, 180), [deployments, operations]);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Naval Deployment Context</h3><p className="mt-1 text-xs text-cyan-100/42">Maritime deployment and naval operational records remain available as an approved defense-intelligence category.</p><div className="mt-4 divide-y divide-white/7">{rows.map((row, index) => <div key={`${place(row)}-${index}`} className="grid gap-2 py-3 md:grid-cols-[1fr_220px_100px] text-xs"><strong>{wcText(row, "name", "title", "operation", "deployment") || `Naval record ${index + 1}`}</strong><span className="text-cyan-100/45">{place(row) || "—"}</span><span>{wcNumber(row, "year") || "—"}</span></div>)}</div></GlassCard>;
}

function RegionalInstability({ conflicts, operations }: { conflicts: WarCostsRow[]; operations: WarCostsRow[] }) {
  const rows = useMemo(() => [
    ...conflicts.map((row) => ({ year: wcNumber(row, "startYear", "year"), title: wcConflictName(row), location: place(row), type: "Conflict" })),
    ...operations.map((row) => ({ year: wcNumber(row, "year", "startYear"), title: wcText(row, "name", "title", "operation") || "Operation", location: place(row), type: "Operation" })),
  ].filter((item) => item.year >= 2001).sort((a, b) => b.year - a.year), [conflicts, operations]);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Regional Instability Context</h3><p className="mt-1 text-xs text-cyan-100/42">Operational and conflict chronology for regional context. Covert-operations content is excluded.</p><div className="mt-4 divide-y divide-white/7">{rows.slice(0, 180).map((item, index) => <div key={`${item.year}-${item.title}-${index}`} className="grid gap-2 py-3 md:grid-cols-[80px_100px_1fr_200px] text-xs"><strong>{item.year}</strong><span className="text-rose-100/55">{item.type}</span><strong>{item.title}</strong><span className="text-cyan-100/45">{item.location || "—"}</span></div>)}</div></GlassCard>;
}

export default function WarCostsSpecialTools() {
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [active, setActive] = useState<Tool>("countries");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const pairs = await Promise.all(DATASETS.map(async (name) => {
        try { return [name, await getWarCostsDataset(name, force)] as const; }
        catch { return [name, null] as const; }
      }));
      const next: Record<string, WarCostsDatasetResponse> = {};
      for (const [name, response] of pairs) if (response) next[name] = response;
      setResponses(next);
      if (!Object.keys(next).length) setError("Specialized operational datasets are unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);
  const data = useMemo(() => Object.fromEntries(Object.entries(responses).map(([name, response]) => [name, wcRows(response.data)])) as Record<string, WarCostsRow[]>, [responses]);

  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Specialized Tools" subtitle="Country footprint, naval context and regional instability only. Personal-cost, taxpayer-cost, draft and weapons tools are removed." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh data</button></div>
        <WarCostsWorkspaceNav />
        {error ? <p className="mt-4 text-xs text-rose-100">{error}</p> : null}
        <div className="mt-5 flex gap-2 overflow-x-auto">{TOOLS.map((tool) => { const Icon = tool.icon; return <button key={tool.key} type="button" onClick={() => setActive(tool.key)} className={`min-w-[180px] rounded-xl border p-3 text-left ${active === tool.key ? "border-cyan-200/30 bg-cyan-300/10" : "border-white/8 bg-black/10"}`}><div className="flex items-center gap-2"><Icon size={14} /><strong className="text-xs">{tool.label}</strong></div><p className="mt-1 text-[9px] text-cyan-100/38">{tool.note}</p></button>; })}</div>
        <div className="mt-5">
          {loading ? <GlassCard className="grid min-h-64 place-items-center p-6"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-cyan-100/45">Loading specialized data…</p></div></GlassCard> : null}
          {!loading && active === "countries" ? <CountryFootprint countries={data["base-countries.json"] || []} deployments={data["overseas-presence.json"] || []} /> : null}
          {!loading && active === "naval" ? <NavalContext deployments={data["overseas-presence.json"] || []} operations={data["operations.json"] || []} /> : null}
          {!loading && active === "regional" ? <RegionalInstability conflicts={data["conflicts.json"] || []} operations={data["operations.json"] || []} /> : null}
        </div>
      </section>
    </main>
  );
}
