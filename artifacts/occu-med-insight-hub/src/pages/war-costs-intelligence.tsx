import { useEffect, useMemo, useState } from "react";
import { Activity, Building2, CircleDollarSign, Database, Globe2, HeartPulse, Landmark, Loader2, RefreshCw, Swords } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, getWarCostsOverview, type WarCostsDatasetResponse, type WarCostsOverview } from "@/data/warCostsApi";

type SurfaceKey = "coverage" | "instability" | "spending" | "aid" | "bases" | "veterans" | "contractors" | "iran";

type Surface = {
  key: SurfaceKey;
  label: string;
  note: string;
  icon: typeof Database;
  datasets: readonly string[];
};

const SURFACES: Surface[] = [
  { key: "coverage", label: "Coverage Audit", note: "Approved source feeds and mirror status", icon: Database, datasets: [] },
  { key: "instability", label: "Conflict & Instability", note: "Active conflicts, operations, strikes and civilian-impact context", icon: Swords, datasets: ["conflicts.json", "operations.json", "drone-strikes.json"] },
  { key: "spending", label: "Military Spending", note: "Observed historical and international spending data only", icon: CircleDollarSign, datasets: ["military-spending.json", "yearly-spending.json", "global-spending.json"] },
  { key: "aid", label: "Foreign Aid", note: "Country-level foreign-aid records", icon: Globe2, datasets: ["foreign-aid.json", "aid-countries-index.json"] },
  { key: "bases", label: "Bases & Deployments", note: "Installations, countries, branches and troop presence", icon: Landmark, datasets: ["base-index.json", "base-countries.json", "base-states.json", "base-components.json", "base-stats.json", "overseas-presence.json", "state-footprint.json", "state-military-index.json"] },
  { key: "veterans", label: "Veterans", note: "Veteran population, health and conflict-era records; no draft tools", icon: HeartPulse, datasets: ["veterans-stats.json", "veterans-by-war.json"] },
  { key: "contractors", label: "Defense Contractors", note: "Contractor and subsidiary intelligence without weapons inventories", icon: Building2, datasets: ["contractors.json", "contractor-by-war.json", "sanctions.json"] },
  { key: "iran", label: "Iran Live", note: "Current conflict and strike context", icon: Activity, datasets: ["conflicts.json", "drone-strikes.json"] },
];

const APPROVED_DATASETS = new Set(SURFACES.flatMap((surface) => surface.datasets));
const DATASET_EXPLANATIONS: Record<string, string> = {
  "conflicts.json": "Conflict records and civilian-impact context used for instability analysis.",
  "operations.json": "Documented military operations used for regional and operational context.",
  "drone-strikes.json": "Strike and drone records folded into the instability signal.",
  "military-spending.json": "Observed annual U.S. military-spending history.",
  "yearly-spending.json": "Detailed annual defense-budget history.",
  "global-spending.json": "Country-by-country military expenditure data.",
  "foreign-aid.json": "Foreign-aid recipients and cumulative totals.",
  "aid-countries-index.json": "Country-level foreign-aid coverage index.",
  "base-index.json": "Global index of known U.S. military installations.",
  "base-countries.json": "U.S. military presence by country.",
  "base-states.json": "Domestic military installations summarized by state.",
  "base-components.json": "Military-base distribution by service branch.",
  "base-stats.json": "Summary statistics for the installation network.",
  "overseas-presence.json": "Overseas troop and deployment presence.",
  "state-footprint.json": "State defense footprint and personnel context.",
  "state-military-index.json": "State and territory military-profile index.",
  "veterans-stats.json": "Veteran population, health and healthcare metrics.",
  "veterans-by-war.json": "Veteran populations by conflict era.",
  "contractors.json": "Defense-contractor awards, subsidiaries and company records.",
  "contractor-by-war.json": "Contractor involvement by conflict.",
  "sanctions.json": "Sanctions records retained as contractor/country context.",
};

function rowsFrom(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({ key, value }));
  return data === undefined || data === null ? [] : [data];
}

function recordLabel(record: unknown) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return String(record ?? "Record");
  const row = record as Record<string, unknown>;
  for (const key of ["name", "title", "country", "countryName", "contractor", "conflict", "operation", "state", "year", "id", "key"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "Data record";
}

function DatasetBlock({ name, response, loading, onRetry }: { name: string; response?: WarCostsDatasetResponse; loading: boolean; onRetry: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => rowsFrom(response?.data), [response?.data]);
  const visible = showAll ? rows : rows.slice(0, 50);
  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="border-b border-cyan-100/8 px-5 py-4">
        <div className="flex items-start justify-between gap-4"><div><h3 className="text-base font-black text-white">{name}</h3><p className="mt-1 max-w-4xl text-xs leading-5 text-cyan-100/46">{DATASET_EXPLANATIONS[name] || "Approved WarCosts source feed."}</p></div><div className="text-right"><p className="text-lg font-black">{response?.itemCount?.toLocaleString() ?? "—"}</p><p className="text-[9px] text-cyan-100/35">records</p></div></div>
      </div>
      <div className="px-5 py-4">
        {loading && !response ? <div className="flex min-h-20 items-center justify-center gap-2 text-xs text-cyan-100/45"><Loader2 size={15} className="animate-spin" />Loading feed…</div> : !response ? <div className="text-xs text-rose-100">Feed unavailable. <button type="button" onClick={onRetry} className="ml-2 underline">Retry</button></div> : <><div className="divide-y divide-white/7">{visible.map((row, index) => <details key={index} className="py-2.5"><summary className="cursor-pointer text-xs font-bold text-cyan-50">{recordLabel(row)}</summary><pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-[10px] leading-5 text-cyan-50/65">{JSON.stringify(row, null, 2)}</pre></details>)}</div>{rows.length > 50 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">{showAll ? "Collapse" : `Show all ${rows.length.toLocaleString()}`}</button> : null}</>}
      </div>
    </GlassCard>
  );
}

export default function WarCostsIntelligence() {
  const [overview, setOverview] = useState<WarCostsOverview | null>(null);
  const [active, setActive] = useState<SurfaceKey>("coverage");
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview(force = false) {
    setRefreshing(force);
    setError("");
    try { setOverview(await getWarCostsOverview(force)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "WarCosts overview unavailable."); }
    finally { setRefreshing(false); }
  }

  async function loadDataset(name: string, force = false) {
    setLoading((state) => ({ ...state, [name]: true }));
    try {
      const response = await getWarCostsDataset(name, force);
      setResponses((state) => ({ ...state, [name]: response }));
    } catch {
      setResponses((state) => { const next = { ...state }; delete next[name]; return next; });
    } finally { setLoading((state) => ({ ...state, [name]: false })); }
  }

  useEffect(() => { void loadOverview(false); }, []);
  const selected = SURFACES.find((surface) => surface.key === active) || SURFACES[0];
  useEffect(() => {
    if (active === "coverage") return;
    for (const name of selected.datasets) if (!responses[name] && !loading[name]) void loadDataset(name, false);
  }, [active]);

  const approvedStatuses = useMemo(() => (overview?.datasets || []).filter((status) => APPROVED_DATASETS.has(status.name)), [overview]);

  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Defense Intelligence Overview" subtitle="Approved defense, deployment, instability, veteran and contractor intelligence. Weapons inventories, draft tools, taxpayer/personal-cost tools and political/accountability content are excluded." /><button type="button" onClick={() => void loadOverview(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button></div>
        <WarCostsWorkspaceNav />
        {error ? <p className="mt-4 text-xs text-rose-100">{error}</p> : null}

        <div className="mt-5 flex gap-2 overflow-x-auto">{SURFACES.map((surface) => { const Icon = surface.icon; return <button key={surface.key} type="button" onClick={() => setActive(surface.key)} className={`min-w-[165px] rounded-xl border p-3 text-left ${active === surface.key ? "border-cyan-200/30 bg-cyan-300/10" : "border-white/8 bg-black/10"}`}><div className="flex items-center gap-2"><Icon size={14} /><strong className="text-xs">{surface.label}</strong></div><p className="mt-1 text-[9px] leading-4 text-cyan-100/38">{surface.note}</p></button>; })}</div>

        {active === "coverage" ? (
          <div className="mt-5">
            <GlassCard className="p-5"><h2 className="text-lg font-black">Approved source coverage</h2><p className="mt-1 text-xs text-cyan-100/42">This audit intentionally excludes removed weapons, draft, taxpayer-cost, political and accountability datasets.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="text-[9px] uppercase tracking-wider text-cyan-100/35"><tr><th className="p-2">Dataset</th><th className="p-2">Category</th><th className="p-2">Records</th><th className="p-2">Status</th></tr></thead><tbody>{approvedStatuses.map((status) => <tr key={status.name} className="border-t border-white/7"><td className="p-2 font-bold">{status.name}</td><td className="p-2 text-cyan-100/45">{status.category}</td><td className="p-2">{status.count.toLocaleString()}</td><td className="p-2">{status.ok ? "Available" : "Unavailable"}</td></tr>)}</tbody></table></div></GlassCard>
          </div>
        ) : (
          <div className="mt-5 space-y-4">{selected.datasets.map((name) => <DatasetBlock key={name} name={name} response={responses[name]} loading={Boolean(loading[name])} onRetry={() => void loadDataset(name, true)} />)}</div>
        )}
      </section>
    </main>
  );
}
