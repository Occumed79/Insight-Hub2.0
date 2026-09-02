import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Database,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Swords,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  getWarCostsContractorIntelligence,
  getWarCostsDataset,
  getWarCostsOverview,
  searchWarCosts,
  type WarCostsContractor,
  type WarCostsDatasetResponse,
  type WarCostsOverview,
  type WarCostsSearchResponse,
} from "@/data/warCostsApi";

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

function labelForRecord(record: unknown): string {
  if (!record || typeof record !== "object" || Array.isArray(record)) return String(record ?? "Record");
  const row = record as Record<string, unknown>;
  for (const key of ["name", "title", "country", "contractor", "conflict", "state", "slug", "year", "id", "key"]) {
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
  for (const key of ["region", "status", "service", "category", "role", "description", "outcome"]) {
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
  return (
    <GlassCard className="p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-cyan-100/42">{note}</p>
    </GlassCard>
  );
}

export default function WarCostsIntelligence() {
  const [overview, setOverview] = useState<WarCostsOverview | null>(null);
  const [contractors, setContractors] = useState<WarCostsContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [contractorQuery, setContractorQuery] = useState("");
  const [selectedContractor, setSelectedContractor] = useState<WarCostsContractor | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [dataset, setDataset] = useState<WarCostsDatasetResponse | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<WarCostsSearchResponse | null>(null);

  async function load(force = false): Promise<void> {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [nextOverview, contractorIntel] = await Promise.all([
        getWarCostsOverview(force),
        getWarCostsContractorIntelligence(),
      ]);
      setOverview(nextOverview);
      setContractors(contractorIntel.contractors);
      if (!selectedContractor && contractorIntel.contractors.length > 0) setSelectedContractor(contractorIntel.contractors[0]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "WarCosts mirror could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  const filteredContractors = useMemo(() => {
    const needle = contractorQuery.trim().toLowerCase();
    if (!needle) return contractors;
    return contractors.filter((contractor) => {
      const names = [contractor.name, ...(contractor.subsidiaries ?? []).map((item) => item.name)];
      return names.some((name) => name.toLowerCase().includes(needle));
    });
  }, [contractorQuery, contractors]);

  const groupedDatasets = useMemo(() => {
    const groups = new Map<string, NonNullable<WarCostsOverview["datasets"]>>();
    for (const item of overview?.datasets ?? []) {
      const current = groups.get(item.category) ?? [];
      current.push(item);
      groups.set(item.category, current);
    }
    return [...groups.entries()];
  }, [overview]);

  async function openDataset(name: string): Promise<void> {
    setSelectedDataset(name);
    setDatasetLoading(true);
    try {
      setDataset(await getWarCostsDataset(name));
    } catch (datasetError) {
      setError(datasetError instanceof Error ? datasetError.message : "Dataset could not be loaded.");
    } finally {
      setDatasetLoading(false);
    }
  }

  async function runSearch(): Promise<void> {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    setSearching(true);
    try {
      setSearchResults(await searchWarCosts(query));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "WarCosts search failed.");
    } finally {
      setSearching(false);
    }
  }

  const datasetRows = useMemo(() => {
    const data = dataset?.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({ key, value }));
    return data === undefined ? [] : [data];
  }, [dataset]);

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <HeaderBar
            eyebrow="Defense ecosystem intelligence"
            title="WarCosts Intelligence"
            subtitle="A native mirror of WarCosts contractor, conflict, weapons, spending, bases, aid, arms-sales, veteran, sanctions, political, and country-profile data — retained inside Insight Hub and refreshed from the live JSON feeds."
          />
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/18 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-50 transition hover:bg-cyan-300/16 disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {refreshing ? "Refreshing full mirror…" : "Refresh every dataset"}
          </button>
        </div>

        <GlassCard className="mt-5 border-cyan-100/12 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Database className="text-cyan-200/70" size={20} />
              <div>
                <p className="text-sm font-bold text-white">Full-source mirror</p>
                <p className="mt-1 text-xs leading-5 text-cyan-100/48">
                  Every discovered JSON dataset is fetched into Insight Hub, cached, and retained in Neon. Live feeds refresh every 5 minutes while the API service is awake; the whole mirror refreshes every 6 hours.
                </p>
              </div>
            </div>
            {overview && <p className="text-[11px] text-cyan-100/42">Latest source pull: {formatDate(overview.fetchedAt)}</p>}
          </div>
        </GlassCard>

        {error && <GlassCard className="mt-5 border-rose-300/20 p-4 text-sm text-rose-100">{error}</GlassCard>}

        {loading ? (
          <GlassCard className="mt-5 grid min-h-[340px] place-items-center p-10">
            <div className="text-center">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-200/60" />
              <p className="mt-4 text-sm font-bold text-cyan-50">Mirroring the WarCosts data surface…</p>
              <p className="mt-2 text-xs text-cyan-100/40">The first load pulls the complete discovered JSON catalog, not a sample.</p>
            </div>
          </GlassCard>
        ) : overview ? (
          <div className="mt-5 space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Mirrored datasets" value={`${overview.summary.mirroredDatasets}/${overview.summary.discoveredDatasets}`} note={`${overview.summary.failedDatasets} source failures`} />
              <Metric label="Contractors" value={overview.summary.contractors} note="Defense award entities" />
              <Metric label="Weapons" value={overview.summary.weaponSystems} note="Program-level records" />
              <Metric label="Military bases" value={overview.summary.militaryBases.toLocaleString()} note="Global installation index" />
              <Metric label="Countries" value={overview.summary.countryProfiles} note="Military relationship profiles" />
              <Metric label="Active conflicts" value={overview.summary.activeConflicts} note={`${overview.summary.strikeRecords.toLocaleString()} strike records`} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Defense contractor directory</p>
                    <h2 className="mt-1 text-lg font-black text-white">Contractor footprint</h2>
                  </div>
                  <Building2 size={20} className="text-cyan-200/50" />
                </div>
                <div className="relative mt-4">
                  <Search size={15} className="absolute left-3 top-3.5 text-cyan-100/30" />
                  <input
                    value={contractorQuery}
                    onChange={(event) => setContractorQuery(event.target.value)}
                    placeholder="Filter contractor or subsidiary…"
                    className="min-h-11 w-full rounded-xl border border-cyan-100/12 bg-black/20 pl-9 pr-3 text-sm text-white outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/30"
                  />
                </div>
                <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {filteredContractors.map((contractor) => (
                    <button
                      key={`${contractor.slug ?? contractor.name}-${contractor.rank ?? "x"}`}
                      type="button"
                      onClick={() => setSelectedContractor(contractor)}
                      className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${selectedContractor?.name === contractor.name ? "border-cyan-200/22 bg-cyan-300/10" : "border-cyan-100/8 bg-black/10 hover:border-cyan-100/16 hover:bg-white/[0.035]"}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-cyan-50">{contractor.name}</p>
                        <p className="mt-1 text-[11px] text-cyan-100/40">Rank #{contractor.rank ?? "—"} · {(contractor.subsidiaries ?? []).length} named subsidiary/award entities</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-black text-white">{money(contractor.amount)}</span>
                        <ChevronRight size={15} className="text-cyan-100/30" />
                      </div>
                    </button>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                {selectedContractor ? (
                  <>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Selected contractor</p>
                    <h2 className="mt-2 text-2xl font-black text-white">{selectedContractor.name}</h2>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-cyan-100/10 bg-black/15 p-3"><p className="text-[10px] uppercase text-cyan-100/34">FY2024 awards</p><p className="mt-1 text-lg font-black">{money(selectedContractor.amount)}</p></div>
                      <div className="rounded-xl border border-cyan-100/10 bg-black/15 p-3"><p className="text-[10px] uppercase text-cyan-100/34">Rank</p><p className="mt-1 text-lg font-black">#{selectedContractor.rank ?? "—"}</p></div>
                    </div>

                    <div className="mt-5">
                      <p className="text-xs font-bold text-cyan-50">Five-year award trend</p>
                      <div className="mt-3 space-y-2">
                        {Object.entries(selectedContractor.yearly ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([year, value]) => {
                          const max = Math.max(...Object.values(selectedContractor.yearly ?? {}), 1);
                          return <div key={year} className="grid grid-cols-[58px_1fr_84px] items-center gap-2 text-[11px]"><span className="text-cyan-100/42">{year}</span><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-cyan-200/55" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} /></div><span className="text-right font-bold text-cyan-50">{money(value)}</span></div>;
                        })}
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-xs font-bold text-cyan-50">Named award entities / subsidiaries</p>
                      <div className="mt-2 space-y-2">
                        {(selectedContractor.subsidiaries ?? []).slice(0, 12).map((subsidiary) => <div key={subsidiary.name} className="flex items-center justify-between gap-3 rounded-lg border border-cyan-100/8 bg-black/10 px-3 py-2 text-[11px]"><span className="text-cyan-50/80">{subsidiary.name}</span><span className="shrink-0 font-bold text-white">{money(subsidiary.amount)}</span></div>)}
                      </div>
                    </div>

                    {(selectedContractor.wars ?? []).length > 0 && <div className="mt-5"><p className="text-xs font-bold text-cyan-50">Conflict involvement</p><div className="mt-2 space-y-2">{selectedContractor.wars?.map((war, index) => <div key={`${war.conflictId}-${index}`} className="rounded-xl border border-amber-200/12 bg-amber-300/[0.05] p-3"><p className="text-xs font-bold text-amber-50">{war.conflictId ?? "Conflict"}</p><p className="mt-1 text-[11px] text-amber-100/60">{war.role ?? "Role not specified"} · {money(war.estimatedValue)}</p>{war.notes && <p className="mt-1 text-[10px] leading-4 text-amber-100/38">{war.notes}</p>}</div>)}</div></div>}

                    {(selectedContractor.weaponSystems ?? []).length > 0 && <div className="mt-5"><p className="text-xs font-bold text-cyan-50">Linked weapon systems</p><div className="mt-2 space-y-2">{selectedContractor.weaponSystems?.map((weapon) => <div key={weapon.slug ?? weapon.name} className="rounded-xl border border-rose-200/12 bg-rose-300/[0.05] p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-rose-50">{weapon.name ?? weapon.slug}</p><span className="text-[10px] text-rose-100/50">{weapon.status}</span></div><p className="mt-1 text-[11px] text-rose-100/60">Program cost {typeof weapon.currentCostBillions === "number" ? `$${weapon.currentCostBillions}B` : "—"} · Overrun {weapon.costOverrunPct ?? "—"}%</p></div>)}</div></div>}
                  </>
                ) : <p className="text-sm text-cyan-100/45">Select a contractor to inspect its linked WarCosts records.</p>}
              </GlassCard>
            </section>

            <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Complete data catalog</p><h2 className="mt-1 text-lg font-black">Every discovered feed</h2></div>
                  <Database size={20} className="text-cyan-200/50" />
                </div>
                <p className="mt-2 text-xs leading-5 text-cyan-100/42">WarCosts advertises {overview.summary.advertisedDatasets} datasets; Insight Hub currently discovers {overview.summary.discoveredDatasets} unique JSON endpoints from the live manifest and known catalog.</p>
                <div className="mt-4 max-h-[650px] space-y-4 overflow-y-auto pr-1">
                  {groupedDatasets.map(([category, items]) => (
                    <div key={category}>
                      <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-bold text-cyan-50/75">{category}</p><span className="text-[10px] text-cyan-100/30">{items.length}</span></div>
                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <button key={item.name} type="button" onClick={() => void openDataset(item.name)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selectedDataset === item.name ? "border-cyan-200/22 bg-cyan-300/10" : "border-cyan-100/8 bg-black/10 hover:bg-white/[0.035]"}`}>
                            <div className="min-w-0"><p className="truncate text-xs font-bold text-cyan-50">{item.name}</p><p className="mt-1 text-[10px] text-cyan-100/34">{item.count.toLocaleString()} records · {item.source ?? "pending"}</p></div>
                            <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${refreshTone(item.refreshClass)}`}>{item.refreshClass}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Dataset browser</p><h2 className="mt-1 text-lg font-black">{selectedDataset || "Choose any dataset"}</h2></div>
                  {datasetLoading && <Loader2 size={18} className="animate-spin text-cyan-200/60" />}
                </div>
                {!selectedDataset && <div className="mt-8 rounded-2xl border border-dashed border-cyan-100/12 p-10 text-center text-sm text-cyan-100/38">Choose a feed from the catalog. The complete JSON record set is available here — not just a preselected summary.</div>}
                {dataset && selectedDataset === dataset.dataset && <>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px]"><span className="rounded-full border border-cyan-100/10 bg-white/[0.03] px-2.5 py-1 text-cyan-100/55">{dataset.category}</span><span className={`rounded-full border px-2.5 py-1 ${refreshTone(dataset.refreshClass)}`}>{dataset.refreshClass}</span><span className="rounded-full border border-cyan-100/10 bg-white/[0.03] px-2.5 py-1 text-cyan-100/55">{dataset.itemCount.toLocaleString()} records</span></div>
                  <div className="mt-4 max-h-[610px] space-y-2 overflow-y-auto pr-1">
                    {datasetRows.slice(0, 250).map((row, index) => <details key={index} className="rounded-xl border border-cyan-100/8 bg-black/10 px-3 py-2"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-cyan-50">{labelForRecord(row)}</p><p className="mt-1 truncate text-[10px] text-cyan-100/35">{subtitleForRecord(row) || `Record ${index + 1}`}</p></div><ChevronRight size={14} className="shrink-0 text-cyan-100/25" /></div></summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-cyan-100/8 bg-black/25 p-3 text-[10px] leading-5 text-cyan-50/65">{JSON.stringify(row, null, 2)}</pre></details>)}
                  </div>
                  {datasetRows.length > 250 && <p className="mt-3 text-[10px] text-cyan-100/35">Showing the first 250 of {datasetRows.length.toLocaleString()} records in-browser. The API retains the entire dataset.</p>}
                </>}
              </GlassCard>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-rose-100/45">Live conflict feed</p><h2 className="mt-1 text-lg font-black">Active conflict records</h2></div><Swords size={20} className="text-rose-200/55" /></div>
                <div className="mt-4 space-y-2">{overview.highlights.activeConflicts.slice(0, 10).map((conflict, index) => <div key={index} className="rounded-xl border border-rose-200/10 bg-rose-300/[0.045] p-3"><p className="text-xs font-bold text-rose-50">{labelForRecord(conflict)}</p><p className="mt-1 text-[10px] leading-4 text-rose-100/42">{subtitleForRecord(conflict) || "Live WarCosts conflict record"}</p></div>)}</div>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-amber-100/45">Live strike feed</p><h2 className="mt-1 text-lg font-black">Recent strike records</h2></div><Activity size={20} className="text-amber-200/55" /></div>
                <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">{overview.highlights.recentStrikes.slice(0, 25).map((strike, index) => <details key={index} className="rounded-xl border border-amber-200/10 bg-amber-300/[0.045] p-3"><summary className="cursor-pointer list-none text-xs font-bold text-amber-50">{labelForRecord(strike)}</summary><pre className="mt-2 whitespace-pre-wrap break-words text-[10px] leading-4 text-amber-100/45">{JSON.stringify(strike, null, 2)}</pre></details>)}</div>
              </GlassCard>
            </section>

            <GlassCard className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Search the entire mirror</p><h2 className="mt-1 text-lg font-black">Cross-dataset search</h2><p className="mt-1 text-xs text-cyan-100/40">Search contractor names, countries, bases, conflicts, weapons, sanctions, programs, states, presidents, or any text present anywhere in the mirrored WarCosts JSON.</p></div>
                <div className="flex w-full max-w-xl gap-2"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-3.5 text-cyan-100/30" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} placeholder="Search all WarCosts data…" className="min-h-11 w-full rounded-xl border border-cyan-100/12 bg-black/20 pl-9 pr-3 text-sm text-white outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/30" /></div><button type="button" onClick={() => void runSearch()} disabled={searching || searchQuery.trim().length < 2} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/18 bg-cyan-300/10 px-4 text-xs font-bold disabled:opacity-40">{searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}Search</button></div>
              </div>
              {searchResults && <div className="mt-5"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold text-cyan-50">{searchResults.total} matching records{searchResults.truncated ? "+" : ""}</p><p className="text-[10px] text-cyan-100/35">Across the complete mirrored catalog</p></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{searchResults.results.map((result, index) => <details key={`${result.dataset}-${index}`} className="rounded-xl border border-cyan-100/8 bg-black/10 p-3"><summary className="cursor-pointer list-none"><p className="text-xs font-bold text-cyan-50">{labelForRecord(result.row)}</p><p className="mt-1 text-[10px] text-cyan-100/35">{result.dataset} · {result.category}</p></summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-cyan-50/55">{JSON.stringify(result.row, null, 2)}</pre></details>)}</div></div>}
            </GlassCard>

            <GlassCard className="border-cyan-100/10 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="flex items-center gap-3"><Globe2 size={18} className="text-cyan-200/45" /><div><p className="text-[10px] uppercase text-cyan-100/30">Source</p><p className="text-xs font-bold">WarCosts.org JSON</p></div></div>
                <div className="flex items-center gap-3"><ShieldAlert size={18} className="text-cyan-200/45" /><div><p className="text-[10px] uppercase text-cyan-100/30">Live refresh</p><p className="text-xs font-bold">Every {overview.refreshPolicy.liveMinutes} min</p></div></div>
                <div className="flex items-center gap-3"><CircleDollarSign size={18} className="text-cyan-200/45" /><div><p className="text-[10px] uppercase text-cyan-100/30">Frequent feeds</p><p className="text-xs font-bold">Every {overview.refreshPolicy.frequentMinutes} min</p></div></div>
                <div className="flex items-center gap-3"><Database size={18} className="text-cyan-200/45" /><div><p className="text-[10px] uppercase text-cyan-100/30">Persistence</p><p className="text-xs font-bold">Neon snapshot fallback</p></div></div>
              </div>
            </GlassCard>
          </div>
        ) : null}
      </section>
    </main>
  );
}
