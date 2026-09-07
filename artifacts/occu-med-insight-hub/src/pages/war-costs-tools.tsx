import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Loader2, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { WarCostsIranTrackers } from "./war-costs-iran-trackers";
import { wcCivilianDeaths, wcConflictName, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

type ToolKey = "instability" | "timeline" | "contractors" | "deployments" | "iran";

const DATASETS = [
  "conflicts.json",
  "drone-strikes.json",
  "operations.json",
  "contractors.json",
  "overseas-presence.json",
  "base-countries.json",
] as const;

const TOOLS: Array<{ key: ToolKey; label: string; note: string; icon: typeof Search }> = [
  { key: "instability", label: "Instability Explorer", note: "Conflicts, strikes and civilian impact", icon: Search },
  { key: "timeline", label: "Operational Timeline", note: "Conflict and military-operation chronology", icon: CalendarDays },
  { key: "contractors", label: "Defense Contractors", note: "Contractor records without weapons inventory", icon: Users },
  { key: "deployments", label: "Deployments", note: "Personnel and naval presence", icon: ShieldCheck },
  { key: "iran", label: "Iran Live", note: "Operational instability trackers", icon: Activity },
];

function place(row: WarCostsRow) {
  return wcText(row, "country", "countryName", "location", "region", "targetCountry", "hostCountry", "aor");
}

function isActiveConflict(row: WarCostsRow) {
  const status = wcText(row, "status", "outcome").toLowerCase();
  if (/(ongoing|active|current|in progress)/.test(status)) return true;
  return !wcNumber(row, "endYear") && wcNumber(row, "startYear", "year") >= 2022;
}

function InstabilityExplorer({ conflicts, strikes }: { conflicts: WarCostsRow[]; strikes: WarCostsRow[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const conflictRows = conflicts.filter(isActiveConflict).map((row) => ({
      type: "Active conflict",
      title: wcConflictName(row),
      location: place(row),
      civilian: wcCivilianDeaths(row),
      year: wcNumber(row, "startYear", "year"),
      source: row,
    }));
    const strikeRows = [...strikes].reverse().slice(0, 100).map((row) => ({
      type: "Strike / drone signal",
      title: wcText(row, "name", "title", "target", "location") || "Strike activity",
      location: place(row),
      civilian: wcNumber(row, "civilianDeaths", "civilianCasualties", "civiliansKilled", "deaths", "casualties"),
      year: wcNumber(row, "year", "date"),
      source: row,
    }));
    return [...conflictRows, ...strikeRows]
      .filter((item) => !needle || JSON.stringify(item.source).toLowerCase().includes(needle) || item.title.toLowerCase().includes(needle) || item.location.toLowerCase().includes(needle))
      .sort((a, b) => b.year - a.year);
  }, [conflicts, query, strikes]);

  return (
    <GlassCard className="p-5">
      <div className="flex items-end gap-3">
        <label className="min-w-[280px] flex-1"><span className="text-[10px] uppercase text-cyan-100/38">Search instability signals</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Country, conflict, strike, region…" className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none" /></label>
        <div className="pb-3 text-xs text-cyan-100/45">{rows.length} signals</div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="text-[9px] uppercase tracking-wider text-cyan-100/35"><tr><th className="p-2">Signal</th><th className="p-2">Location</th><th className="p-2">Year</th><th className="p-2">Civilian impact signal</th></tr></thead>
          <tbody>{rows.slice(0, 150).map((item, index) => <tr key={`${item.type}-${item.title}-${index}`} className="border-t border-white/7"><td className="p-2"><strong>{item.title}</strong><div className="mt-0.5 text-[9px] text-rose-100/55">{item.type}</div></td><td className="p-2 text-cyan-50/55">{item.location || "—"}</td><td className="p-2">{item.year || "—"}</td><td className="p-2">{item.civilian ? item.civilian.toLocaleString() : "—"}</td></tr>)}</tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function OperationalTimeline({ conflicts, operations }: { conflicts: WarCostsRow[]; operations: WarCostsRow[] }) {
  const events = useMemo(() => [
    ...conflicts.map((row) => ({ year: wcNumber(row, "startYear", "year"), type: "Conflict", title: wcConflictName(row), location: place(row) })),
    ...operations.map((row) => ({ year: wcNumber(row, "year", "startYear"), type: "Operation", title: wcText(row, "name", "operation", "title") || "Military operation", location: place(row) })),
  ].filter((event) => event.year > 0).sort((a, b) => b.year - a.year), [conflicts, operations]);

  return <GlassCard className="p-5"><h3 className="text-lg font-black">Operational Timeline</h3><div className="mt-4 divide-y divide-white/7">{events.slice(0, 160).map((event, index) => <div key={`${event.year}-${event.title}-${index}`} className="grid grid-cols-[70px_100px_1fr] gap-3 py-3 text-xs"><strong>{event.year}</strong><span className="text-cyan-100/45">{event.type}</span><div><strong>{event.title}</strong>{event.location ? <div className="mt-0.5 text-[10px] text-cyan-100/38">{event.location}</div> : null}</div></div>)}</div></GlassCard>;
}

function ContractorDirectory({ contractors }: { contractors: WarCostsRow[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contractors.filter((row) => !needle || JSON.stringify(row).toLowerCase().includes(needle));
  }, [contractors, query]);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Defense Contractors</h3><p className="mt-1 text-xs text-cyan-100/42">Contractor/entity intelligence only. Weapons and military-hardware inventory content is excluded.</p><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contractor…" className="mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none" /><div className="mt-4 divide-y divide-white/7">{visible.slice(0, 150).map((row, index) => { const name = wcText(row, "name", "contractor", "company", "recipient") || `Contractor ${index + 1}`; return <div key={`${name}-${index}`} className="grid gap-2 py-3 md:grid-cols-[1fr_180px_180px] text-xs"><strong>{name}</strong><span className="text-cyan-100/45">{wcText(row, "country", "location", "headquarters") || "—"}</span><span className="text-cyan-100/45">{wcText(row, "sector", "industry", "category") || "Defense contractor"}</span></div>; })}</div></GlassCard>;
}

function DeploymentDirectory({ deployments, countries }: { deployments: WarCostsRow[]; countries: WarCostsRow[] }) {
  const rows = useMemo(() => deployments.length ? deployments : countries, [countries, deployments]);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Deployment & Presence Directory</h3><p className="mt-1 text-xs text-cyan-100/42">Personnel posture and naval/deployment records remain available for operational context.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="text-[9px] uppercase tracking-wider text-cyan-100/35"><tr><th className="p-2">Location</th><th className="p-2">Type</th><th className="p-2">Personnel / signal</th><th className="p-2">Year</th></tr></thead><tbody>{rows.slice(0, 180).map((row, index) => <tr key={`${place(row)}-${index}`} className="border-t border-white/7"><td className="p-2 font-bold">{place(row) || wcText(row, "name", "title") || "—"}</td><td className="p-2 text-cyan-100/45">{wcText(row, "type", "category", "deploymentType") || "Presence"}</td><td className="p-2">{wcNumber(row, "personnel", "troops", "count") || "—"}</td><td className="p-2">{wcNumber(row, "year") || "—"}</td></tr>)}</tbody></table></div></GlassCard>;
}

export default function WarCostsTools() {
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [active, setActive] = useState<ToolKey>("instability");
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
      if (!Object.keys(next).length) setError("Operational WarCosts datasets are unavailable.");
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
        <div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Interactive Tools" subtitle="Operational conflict, instability, contractor and deployment tools. Taxpayer-cost, personal-cost, weapons and political tools are excluded." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh tool data</button></div>
        <WarCostsWorkspaceNav />
        {error ? <p className="mt-4 text-xs text-rose-100">{error}</p> : null}
        <div className="mt-5 flex gap-2 overflow-x-auto">{TOOLS.map((tool) => { const Icon = tool.icon; return <button key={tool.key} type="button" onClick={() => setActive(tool.key)} className={`min-w-[150px] rounded-xl border p-3 text-left ${active === tool.key ? "border-cyan-200/30 bg-cyan-300/10" : "border-white/8 bg-black/10"}`}><div className="flex items-center gap-2"><Icon size={14} /><strong className="text-xs">{tool.label}</strong></div><p className="mt-1 text-[9px] text-cyan-100/38">{tool.note}</p></button>; })}</div>
        <div className="mt-5">
          {loading ? <GlassCard className="grid min-h-64 place-items-center p-6"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-cyan-100/45">Loading operational data…</p></div></GlassCard> : null}
          {!loading && active === "instability" ? <InstabilityExplorer conflicts={data["conflicts.json"] || []} strikes={data["drone-strikes.json"] || []} /> : null}
          {!loading && active === "timeline" ? <OperationalTimeline conflicts={data["conflicts.json"] || []} operations={data["operations.json"] || []} /> : null}
          {!loading && active === "contractors" ? <ContractorDirectory contractors={data["contractors.json"] || []} /> : null}
          {!loading && active === "deployments" ? <DeploymentDirectory deployments={data["overseas-presence.json"] || []} countries={data["base-countries.json"] || []} /> : null}
          {!loading && active === "iran" ? <WarCostsIranTrackers /> : null}
        </div>
      </section>
    </main>
  );
}
