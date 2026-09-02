import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Database,
  ExternalLink,
  Globe2,
  HeartPulse,
  Landmark,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  Shield,
  Swords,
  Users,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import {
  getWarCostsContractorIntelligence,
  getWarCostsDataset,
  getWarCostsOverview,
  searchWarCosts,
  type WarCostsContractor,
  type WarCostsDatasetResponse,
  type WarCostsDatasetStatus,
  type WarCostsOverview,
  type WarCostsSearchResponse,
} from "@/data/warCostsApi";

type SurfaceKey =
  | "coverage"
  | "Conflicts & Wars"
  | "Military Spending"
  | "Foreign Aid"
  | "Arms Sales"
  | "Bases & Deployments"
  | "Veterans"
  | "Weapons & Defense Industry"
  | "Presidents & Politics"
  | "iran";

type LoadedDatasets = Record<string, WarCostsDatasetResponse | undefined>;
type LoadingDatasets = Record<string, boolean | undefined>;

const SURFACES: Array<{ key: SurfaceKey; label: string; note: string; icon: typeof Database }> = [
  { key: "coverage", label: "Coverage Audit", note: "Every source feed and mirror status", icon: Database },
  { key: "Conflicts & Wars", label: "Conflicts & Wars", note: "Wars, operations, votes, ROI, casualties and blowback", icon: Swords },
  { key: "Military Spending", label: "Military Spending", note: "Historical, global, state, audit and opportunity-cost data", icon: CircleDollarSign },
  { key: "Foreign Aid", label: "Foreign Aid", note: "Recipients and country-level aid profiles", icon: Globe2 },
  { key: "Arms Sales", label: "Arms Sales", note: "Buyers, deals, weapon categories and context", icon: Shield },
  { key: "Bases & Deployments", label: "Bases & Deployments", note: "Installations, countries, states, branches and troop presence", icon: Landmark },
  { key: "Veterans", label: "Veterans", note: "Population, health, costs, eras and draft history", icon: HeartPulse },
  { key: "Weapons & Defense Industry", label: "Defense Industry", note: "Contractors, subsidiaries, weapons, sanctions and war links", icon: Building2 },
  { key: "Presidents & Politics", label: "Presidents & Politics", note: "Presidential records, country profiles and site-wide statistics", icon: Users },
  { key: "iran", label: "Iran Live", note: "Current conflict and strike records", icon: Activity },
];

const DATASET_EXPLANATIONS: Record<string, string> = {
  "conflicts.json": "Complete US-conflict records with costs, casualties, authorization, outcomes, regions and analysis.",
  "operations.json": "Documented US military interventions and operations since 1798.",
  "war-votes.json": "Congressional authorization, declarations, vote counts and constitutional details.",
  "war-roi.json": "Conflict return-on-investment assessments, objectives and strategic outcomes.",
  "cost-per-life.json": "Cost per US death and civilian death by conflict.",
  "blowback-chains.json": "Intervention-to-consequence chains and long-term blowback relationships.",
  "constitutional-scores.json": "War-powers and constitutional-compliance scoring by conflict.",
  "revolutionary-war.json": "Deep Revolutionary War record with battles, costs and historical context.",
  "drone-strikes.json": "Drone and air-strike records, including current Iran operations.",
  "military-spending.json": "Annual US military spending history with GDP share and president.",
  "yearly-spending.json": "Detailed annual defense-budget breakdown and historical context.",
  "global-spending.json": "Country-by-country global military expenditure data.",
  "spending-per-capita.json": "State-level military spending per capita.",
  "opportunity-costs.json": "Alternative public uses for major military expenditures.",
  "audit-timeline.json": "Pentagon audit history and failure timeline.",
  "jobs-data.json": "Jobs created per $1M across military and civilian sectors.",
  "foreign-aid.json": "Top US foreign-aid recipients, cumulative totals and military/economic split.",
  "aid-countries-index.json": "Country-level foreign-aid profiles and year-by-year coverage index.",
  "arms-sales.json": "Top US arms-sale buyers and major weapon-system deals.",
  "arms-sales-countries.json": "Detailed country arms-sales records, deal types, weapon categories and context.",
  "base-index.json": "Complete global index of known US military installations.",
  "base-countries.json": "US military presence by country, including bases, troops and annual costs.",
  "base-states.json": "Domestic military installations summarized by state.",
  "base-components.json": "Military-base distribution by service branch.",
  "base-stats.json": "Summary statistics for the US military-base network.",
  "overseas-presence.json": "Major overseas troop deployments, costs and strategic context.",
  "state-footprint.json": "State defense footprint: bases, personnel, contracts, VA facilities and economic dependence.",
  "state-military-index.json": "State and territory military-profile index.",
  "veterans-stats.json": "Veteran population, VA budget, suicide, PTSD, homelessness and healthcare metrics.",
  "veterans-by-war.json": "Veteran populations and projected VA costs by conflict era.",
  "draft-analysis.json": "Draft history, deferments, resistance and demographic disparities.",
  "weapons.json": "Major US weapon systems, costs, contractors, capabilities and controversies.",
  "weapons-detail.json": "Extended weapon-program specifications, deployment history and cost overruns.",
  "contractors.json": "Defense-contractor awards, subsidiaries, award history and related company records.",
  "contractor-by-war.json": "Contractor involvement and estimated value by conflict.",
  "sanctions.json": "US sanctions programs, targeted countries, economic impact and effectiveness.",
  "presidents.json": "Presidential war records, costs, deaths and constitutional-compliance data.",
  "country-profiles-index.json": "Country profiles covering US military relationships, aid, bases, arms sales and interventions.",
  "stats.json": "Site-wide WarCosts aggregate statistics.",
};

function money(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatDate(value?: string): string {
  if (!value) return "Not yet mirrored";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function rowsFrom(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({ key, value }));
  return data === undefined || data === null ? [] : [data];
}

function labelForRecord(record: unknown): string {
  if (!record || typeof record !== "object" || Array.isArray(record)) return String(record ?? "Record");
  const row = record as Record<string, unknown>;
  for (const key of ["name", "title", "country", "countryName", "contractor", "conflict", "conflictId", "operation", "state", "stateName", "slug", "year", "president", "id", "key"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "Data record";
}

function subtitleForRecord(record: unknown): string {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "";
  const row = record as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["region", "status", "service", "branch", "category", "role", "description", "outcome", "location"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
    if (parts.length >= 2) break;
  }
  return parts.join(" · ");
}

function refreshTone(kind: "live" | "frequent" | "periodic"): string {
  if (kind === "live") return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  if (kind === "frequent") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-100/70";
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <GlassCard className="p-4"><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p><p className="mt-1 text-[11px] leading-5 text-cyan-100/42">{note}</p></GlassCard>;
}

function DatasetBlock({ status, response, loading, onRetry }: { status: WarCostsDatasetStatus; response?: WarCostsDatasetResponse; loading: boolean; onRetry: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => rowsFrom(response?.data), [response?.data]);
  const visible = showAll ? rows : rows.slice(0, 60);
  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="border-b border-cyan-100/8 px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-white">{status.name}</h3><span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${refreshTone(status.refreshClass)}`}>{status.refreshClass}</span>{status.ok ? <CheckCircle2 size={14} className="text-emerald-300/70" /> : <AlertTriangle size={14} className="text-rose-300/75" />}</div><p className="mt-2 max-w-4xl text-xs leading-5 text-cyan-100/46">{DATASET_EXPLANATIONS[status.name] ?? "Additional dataset discovered from the live WarCosts downloads manifest."}</p></div><div className="text-right"><p className="text-lg font-black text-white">{status.count.toLocaleString()}</p><p className="text-[10px] text-cyan-100/35">source records</p></div></div><div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-cyan-100/34"><span>{status.source === "database" ? "Neon snapshot" : status.source === "live" ? "Live source" : "Source pending"}</span><span>·</span><span>{formatDate(status.fetchedAt)}</span></div></div>
      <div className="px-5 py-4">
        {loading && !response ? <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-cyan-100/45"><Loader2 size={16} className="animate-spin" /> Loading the complete feed…</div> : !status.ok && !response ? <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.06] p-4"><p className="text-xs font-bold text-rose-100">This source did not mirror successfully.</p><p className="mt-1 text-[11px] text-rose-100/55">{status.error || "No source response was retained."}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-rose-200/20 px-3 py-2 text-[10px] font-bold text-rose-50">Retry feed</button></div> : rows.length === 0 ? <div className="rounded-xl border border-dashed border-cyan-100/12 p-6 text-center text-xs text-cyan-100/38">The source returned no records.</div> : <><div className="space-y-2">{visible.map((row, index) => <details key={index} className="rounded-xl border border-cyan-100/8 bg-black/10 px-3 py-2.5"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-cyan-50">{labelForRecord(row)}</p><p className="mt-1 truncate text-[10px] text-cyan-100/35">{subtitleForRecord(row) || `Record ${index + 1}`}</p></div><ChevronRight size={14} className="shrink-0 text-cyan-100/25" /></div></summary><pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-cyan-100/8 bg-black/25 p-3 text-[10px] leading-5 text-cyan-50/68">{JSON.stringify(row, null, 2)}</pre></details>)}</div>{rows.length > 60 && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-4 min-h-10 rounded-xl border border-cyan-200/14 bg-cyan-300/[0.06] px-4 text-[11px] font-bold text-cyan-50 transition hover:bg-cyan-300/10">{showAll ? "Collapse records" : `Show all ${rows.length.toLocaleString()} records`}</button>}</>}
      </div>
    </GlassCard>
  );
}

function ContractorWorkspace({ contractors }: { contractors: WarCostsContractor[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<WarCostsContractor | null>(contractors[0] ?? null);
  useEffect(() => {
    setSelected((current) => {
      if (!contractors.length) return null;
      if (!current) return contractors[0];
      return contractors.find((contractor) => contractor.name === current.name) ?? contractors[0];
    });
  }, [contractors]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contractors;
    return contractors.filter((contractor) => [contractor.name, ...(contractor.subsidiaries ?? []).map((item) => item.name)].some((name) => name.toLowerCase().includes(needle)));
  }, [contractors, query]);
  return (
    <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <GlassCard className="p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Defense contractor directory</p><h2 className="mt-1 text-lg font-black">All contractor entities</h2></div><Building2 size={20} className="text-cyan-200/50" /></div><div className="relative mt-4"><Search size={15} className="absolute left-3 top-3.5 text-cyan-100/30" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Optional contractor filter…" className="min-h-11 w-full rounded-xl border border-cyan-100/12 bg-black/20 pl-9 pr-3 text-sm text-white outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/30" /></div><div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">{filtered.map((contractor) => <button key={`${contractor.slug ?? contractor.name}-${contractor.rank ?? "x"}`} type="button" onClick={() => setSelected(contractor)} className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${selected?.name === contractor.name ? "border-cyan-200/22 bg-cyan-300/10" : "border-cyan-100/8 bg-black/10 hover:bg-white/[0.035]"}`}><div className="min-w-0"><p className="truncate text-sm font-bold text-cyan-50">{contractor.name}</p><p className="mt-1 text-[11px] text-cyan-100/40">Rank #{contractor.rank ?? "—"} · {(contractor.subsidiaries ?? []).length} subsidiary/award entities</p></div><span className="shrink-0 text-sm font-black text-white">{money(contractor.amount)}</span></button>)}</div></GlassCard>
      <GlassCard className="p-5">{selected ? <><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Selected contractor</p><h2 className="mt-2 text-2xl font-black text-white">{selected.name}</h2><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl border border-cyan-100/10 bg-black/15 p-3"><p className="text-[10px] uppercase text-cyan-100/34">FY2024 awards</p><p className="mt-1 text-lg font-black">{money(selected.amount)}</p></div><div className="rounded-xl border border-cyan-100/10 bg-black/15 p-3"><p className="text-[10px] uppercase text-cyan-100/34">Rank</p><p className="mt-1 text-lg font-black">#{selected.rank ?? "—"}</p></div></div>{Object.keys(selected.yearly ?? {}).length > 0 && <div className="mt-5"><p className="text-xs font-bold text-cyan-50">Award history</p><div className="mt-3 space-y-2">{Object.entries(selected.yearly ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([year, value]) => { const max = Math.max(...Object.values(selected.yearly ?? {}), 1); return <div key={year} className="grid grid-cols-[58px_1fr_84px] items-center gap-2 text-[11px]"><span className="text-cyan-100/42">{year}</span><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-cyan-200/55" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} /></div><span className="text-right font-bold text-cyan-50">{money(value)}</span></div>; })}</div></div>}<div className="mt-5"><p className="text-xs font-bold text-cyan-50">Subsidiaries / award entities</p><div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">{(selected.subsidiaries ?? []).map((item) => <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border border-cyan-100/8 bg-black/10 px-3 py-2 text-[11px]"><span className="text-cyan-50/80">{item.name}</span><span className="font-bold text-white">{money(item.amount)}</span></div>)}</div></div>{(selected.wars ?? []).length > 0 && <div className="mt-5"><p className="text-xs font-bold text-cyan-50">Conflict involvement</p><div className="mt-2 space-y-2">{selected.wars?.map((war, index) => <div key={`${war.conflictId}-${index}`} className="rounded-xl border border-amber-200/12 bg-amber-300/[0.05] p-3"><p className="text-xs font-bold text-amber-50">{war.conflictId ?? "Conflict"}</p><p className="mt-1 text-[11px] text-amber-100/60">{war.role ?? "Role not specified"} · {money(war.estimatedValue)}</p>{war.notes && <p className="mt-1 text-[10px] leading-4 text-amber-100/38">{war.notes}</p>}</div>)}</div></div>}{(selected.weaponSystems ?? []).length > 0 && <div className="mt-5"><p className="text-xs font-bold text-cyan-50">Linked weapon systems</p><div className="mt-2 space-y-2">{selected.weaponSystems?.map((weapon) => <div key={weapon.slug ?? weapon.name} className="rounded-xl border border-rose-200/12 bg-rose-300/[0.05] p-3"><p className="text-xs font-bold text-rose-50">{weapon.name ?? weapon.slug}</p><p className="mt-1 text-[11px] text-rose-100/60">Program cost {typeof weapon.currentCostBillions === "number" ? `$${weapon.currentCostBillions}B` : "—"} · Overrun {weapon.costOverrunPct ?? "—"}%</p></div>)}</div></div>}</> : <p className="text-sm text-cyan-100/45">No contractor records are available.</p>}</GlassCard>
    </section>
  );
}

export default function WarCostsIntelligence() {
  const [overview, setOverview] = useState<WarCostsOverview | null>(null);
  const [contractors, setContractors] = useState<WarCostsContractor[]>([]);
  const [activeSurface, setActiveSurface] = useState<SurfaceKey>("coverage");
  const [loaded, setLoaded] = useState<LoadedDatasets>({});
  const [loadingFeeds, setLoadingFeeds] = useState<LoadingDatasets>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<WarCostsSearchResponse | null>(null);

  async function load(force = false): Promise<void> {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [nextOverview, contractorIntel] = await Promise.all([getWarCostsOverview(force), getWarCostsContractorIntelligence(undefined, force)]);
      setOverview(nextOverview);
      setContractors(contractorIntel.contractors);
      if (force) setLoaded({});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "WarCosts mirror could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadDataset(name: string, force = false): Promise<void> {
    if (!force && (loaded[name] || loadingFeeds[name])) return;
    setLoadingFeeds((current) => ({ ...current, [name]: true }));
    try {
      const response = await getWarCostsDataset(name, force);
      setLoaded((current) => ({ ...current, [name]: response }));
    } catch (datasetError) {
      setError(datasetError instanceof Error ? datasetError.message : `Could not load ${name}.`);
    } finally {
      setLoadingFeeds((current) => ({ ...current, [name]: false }));
    }
  }

  useEffect(() => { void load(false); }, []);

  const activeFeeds = useMemo(() => {
    if (!overview) return [];
    if (activeSurface === "iran") return overview.datasets.filter((item) => item.name === "conflicts.json" || item.name === "drone-strikes.json" || item.name === "stats.json");
    if (activeSurface === "coverage") return [];
    return overview.datasets.filter((item) => item.category === activeSurface);
  }, [activeSurface, overview]);

  useEffect(() => { for (const feed of activeFeeds) void loadDataset(feed.name); }, [activeFeeds]);

  async function runSearch(): Promise<void> {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    setSearching(true);
    try { setSearchResults(await searchWarCosts(query)); }
    catch (searchError) { setError(searchError instanceof Error ? searchError.message : "WarCosts search failed."); }
    finally { setSearching(false); }
  }

  const failedFeeds = overview?.datasets.filter((item) => !item.ok) ?? [];
  const complete = Boolean(
    overview
      && overview.summary.failedDatasets === 0
      && overview.summary.mirroredDatasets === overview.summary.discoveredDatasets
      && overview.coverage.liveManifestHealthy
      && overview.coverage.missingKnownFromLive.length === 0,
  );

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Defense ecosystem intelligence" title="WarCosts Intelligence" subtitle="The complete WarCosts downloadable data surface is mirrored inside Insight Hub and organized into first-class intelligence views — no search required to discover what the source contains." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/18 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-50 transition hover:bg-cyan-300/16 disabled:opacity-50">{refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}{refreshing ? "Auditing and refreshing…" : "Refresh + audit every feed"}</button></div>
        <WarCostsWorkspaceNav />
        <GlassCard className={`mt-5 p-4 ${complete ? "border-emerald-300/16" : "border-amber-300/18"}`}><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-start gap-3">{complete ? <CheckCircle2 className="mt-0.5 text-emerald-300/75" size={21} /> : <AlertTriangle className="mt-0.5 text-amber-300/75" size={21} />}<div><p className="text-sm font-black text-white">Live source coverage audit</p><p className="mt-1 max-w-4xl text-xs leading-5 text-cyan-100/48">The API reads WarCosts’ current Downloads manifest, merges it with the known catalog, exposes persisted snapshots immediately, refreshes them from the source, and reports any live-manifest drift. WarCosts currently advertises 40 entries; the duplicate Iran listing of conflicts.json means the catalog resolves to 39 unique files.</p></div></div>{overview && <div className="text-right"><p className={`text-xl font-black ${complete ? "text-emerald-100" : "text-amber-100"}`}>{overview.summary.mirroredDatasets}/{overview.summary.discoveredDatasets}</p><p className="text-[10px] text-cyan-100/35">unique feeds available</p></div>}</div></GlassCard>
        {error && <GlassCard className="mt-5 border-rose-300/20 p-4 text-sm text-rose-100">{error}</GlassCard>}
        {loading ? <GlassCard className="mt-5 grid min-h-[360px] place-items-center p-10"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-200/60" /><p className="mt-4 text-sm font-bold text-cyan-50">Loading the WarCosts mirror…</p><p className="mt-2 text-xs text-cyan-100/40">Persisted snapshots appear immediately while source freshness is reconciled.</p></div></GlassCard> : overview ? <div className="mt-5 space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Unique feeds" value={overview.summary.discoveredDatasets} note={`${overview.summary.advertisedDatasets} advertised entries`} /><Metric label="Available" value={overview.summary.mirroredDatasets} note={`${overview.summary.failedDatasets} failures`} /><Metric label="Contractors" value={overview.summary.contractors} note="Defense award entities" /><Metric label="Weapons" value={overview.summary.weaponSystems} note="Program records" /><Metric label="Military bases" value={overview.summary.militaryBases.toLocaleString()} note="Global installation index" /><Metric label="Countries" value={overview.summary.countryProfiles} note={`${overview.summary.activeConflicts} active conflicts`} /></section>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{SURFACES.map((surface) => { const Icon = surface.icon; const count = surface.key === "coverage" ? overview.summary.discoveredDatasets : surface.key === "iran" ? 3 : overview.categoryCounts[surface.key] ?? 0; return <button key={surface.key} type="button" onClick={() => setActiveSurface(surface.key)} className={`rounded-2xl border p-4 text-left transition ${activeSurface === surface.key ? "border-cyan-200/28 bg-cyan-300/12 shadow-[0_0_35px_rgba(34,211,238,.08)]" : "border-cyan-100/8 bg-black/10 hover:border-cyan-100/18 hover:bg-white/[0.035]"}`}><div className="flex items-start justify-between gap-3"><Icon size={19} className={activeSurface === surface.key ? "text-cyan-100" : "text-cyan-100/45"} /><span className="text-[10px] font-bold text-cyan-100/32">{count} feeds</span></div><p className="mt-3 text-sm font-black text-white">{surface.label}</p><p className="mt-1 text-[10px] leading-4 text-cyan-100/40">{surface.note}</p></button>; })}</section>
          {activeSurface === "coverage" ? <><GlassCard className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Source audit</p><h2 className="mt-1 text-lg font-black">Every discovered WarCosts dataset</h2></div><a href="https://www.warcosts.org/downloads" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[11px] font-bold text-cyan-100/55 hover:text-cyan-50">Source manifest <ExternalLink size={13} /></a></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{overview.datasets.map((item) => <div key={item.name} className={`rounded-xl border p-3 ${item.ok ? "border-emerald-300/10 bg-emerald-300/[0.035]" : "border-rose-300/18 bg-rose-300/[0.06]"}`}><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-bold text-cyan-50">{item.name}</p>{item.ok ? <CheckCircle2 size={14} className="text-emerald-300/65" /> : <AlertTriangle size={14} className="text-rose-300/75" />}</div><p className="mt-1 text-[10px] text-cyan-100/34">{item.category} · {item.count.toLocaleString()} records</p><p className="mt-1 text-[10px] text-cyan-100/28">{item.source ?? "pending"} · {item.refreshClass}</p></div>)}</div>{failedFeeds.length > 0 && <div className="mt-4 rounded-xl border border-rose-300/18 bg-rose-300/[0.06] p-4"><p className="text-xs font-black text-rose-100">Feeds needing attention</p>{failedFeeds.map((item) => <p key={item.name} className="mt-1 text-[10px] text-rose-100/55">{item.name}: {item.error || "source failed"}</p>)}</div>}</GlassCard><GlassCard className="p-5"><div className="flex items-center gap-3"><Scale size={19} className="text-cyan-200/55" /><div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Interpretation preserved</p><h2 className="mt-1 text-lg font-black">Source context and methodology</h2></div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-cyan-100/8 bg-black/10 p-4"><p className="text-xs font-bold text-cyan-50">Dollar basis</p><p className="mt-1 text-[11px] leading-5 text-cyan-100/42">WarCosts states that downloaded costs are generally inflation-adjusted to 2024 dollars unless a feed notes otherwise.</p></div><div className="rounded-xl border border-cyan-100/8 bg-black/10 p-4"><p className="text-xs font-bold text-cyan-50">Attribution</p><p className="mt-1 text-[11px] leading-5 text-cyan-100/42">Every mirrored response retains “Source: warcosts.org” attribution and the source payload is stored without stripping fields.</p></div><div className="rounded-xl border border-cyan-100/8 bg-black/10 p-4"><p className="text-xs font-bold text-cyan-50">Primary-source lineage</p><p className="mt-1 text-[11px] leading-5 text-cyan-100/42">WarCosts compiles CRS, DoD, SIPRI, OMB, Brown Costs of War, USAID, Airwars and other cited sources. Source fields inside the JSON remain intact.</p></div></div></GlassCard><GlassCard className="p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Optional cross-feed search</p><h2 className="mt-1 text-lg font-black">Search after the data is already exposed</h2><p className="mt-1 text-xs text-cyan-100/40">This is supplemental. Every dataset and category is available above without knowing what to search for.</p></div><div className="flex w-full max-w-xl gap-2"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3.5 text-cyan-100/30" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} placeholder="Search all mirrored records…" className="min-h-11 w-full rounded-xl border border-cyan-100/12 bg-black/20 pl-9 pr-3 text-sm text-white outline-none placeholder:text-cyan-100/25" /></div><button type="button" onClick={() => void runSearch()} disabled={searching || searchQuery.trim().length < 2} className="min-h-11 rounded-xl border border-cyan-200/18 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-50 disabled:opacity-40">{searching ? <Loader2 size={15} className="animate-spin" /> : "Search"}</button></div></div>{searchResults && <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">{searchResults.results.map((result, index) => <details key={`${result.dataset}-${index}`} className="rounded-xl border border-cyan-100/8 bg-black/10 p-3"><summary className="cursor-pointer list-none"><p className="text-xs font-bold text-cyan-50">{labelForRecord(result.row)}</p><p className="mt-1 text-[10px] text-cyan-100/34">{result.category} · {result.dataset}</p></summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-[10px] leading-5 text-cyan-50/65">{JSON.stringify(result.row, null, 2)}</pre></details>)}</div>}</GlassCard></> : activeSurface === "iran" ? <><section className="grid gap-5 xl:grid-cols-2"><GlassCard className="p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-rose-100/45">Live conflict feed</p><h2 className="mt-1 text-lg font-black">Current conflict records</h2></div><Swords size={20} className="text-rose-200/55" /></div><div className="mt-4 space-y-2">{overview.highlights.activeConflicts.map((record, index) => <details key={index} className="rounded-xl border border-rose-200/10 bg-rose-300/[0.045] p-3"><summary className="cursor-pointer list-none text-xs font-bold text-rose-50">{labelForRecord(record)}</summary><pre className="mt-2 whitespace-pre-wrap break-words text-[10px] leading-4 text-rose-100/50">{JSON.stringify(record, null, 2)}</pre></details>)}</div></GlassCard><GlassCard className="p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-amber-100/45">Live strike feed</p><h2 className="mt-1 text-lg font-black">Recent drone / air-strike records</h2></div><Activity size={20} className="text-amber-200/55" /></div><div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">{overview.highlights.recentStrikes.map((record, index) => <details key={index} className="rounded-xl border border-amber-200/10 bg-amber-300/[0.045] p-3"><summary className="cursor-pointer list-none text-xs font-bold text-amber-50">{labelForRecord(record)}</summary><pre className="mt-2 whitespace-pre-wrap break-words text-[10px] leading-4 text-amber-100/50">{JSON.stringify(record, null, 2)}</pre></details>)}</div></GlassCard></section><div className="space-y-5">{activeFeeds.map((status) => <DatasetBlock key={status.name} status={status} response={loaded[status.name]} loading={Boolean(loadingFeeds[status.name])} onRetry={() => void loadDataset(status.name, true)} />)}</div></> : <><GlassCard className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">{SURFACES.find((item) => item.key === activeSurface)?.label}</p><h2 className="mt-1 text-xl font-black">Every feed in this intelligence domain</h2><p className="mt-2 max-w-4xl text-xs leading-5 text-cyan-100/42">All source feeds in this category load automatically. Expand any record for the complete original JSON; large feeds can be expanded to every record without requiring a search.</p></div><p className="text-sm font-black text-white">{activeFeeds.reduce((sum, item) => sum + item.count, 0).toLocaleString()} source records</p></div></GlassCard>{activeSurface === "Weapons & Defense Industry" && <ContractorWorkspace contractors={contractors} />}<div className="space-y-5">{activeFeeds.map((status) => <DatasetBlock key={status.name} status={status} response={loaded[status.name]} loading={Boolean(loadingFeeds[status.name])} onRetry={() => void loadDataset(status.name, true)} />)}</div></>}
        </div> : null}
      </section>
    </main>
  );
}
