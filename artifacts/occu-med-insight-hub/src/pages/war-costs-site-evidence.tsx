import { useEffect, useMemo, useState } from "react";
import { Database, ExternalLink, FileText, Loader2, RefreshCw, Search } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import {
  getWarCostsPageCatalog,
  getWarCostsPageEvidence,
  getWarCostsPageOverview,
  refreshWarCostsPages,
  searchWarCostsPages,
  type WarCostsPageCatalogItem,
  type WarCostsPageEvidence,
  type WarCostsPageOverview,
} from "@/data/warCostsApi";

const APPROVED_TYPES = new Set(["index", "conflict", "country", "state", "base", "contractor", "methodology", "data-page"]);
const REJECTED_PATTERN = /(weapon|weapons|missile|fighter|bomber|tank|arms[- ]?sales|draft|conscription|taxpayer|personal[- ]?cost|war[- ]?cost calculator|budget simulator|opportunity[- ]?cost|president|politic|accountability|audit)/i;
const TYPE_LABELS: Record<string, string> = {
  index: "Indexes & Discovery",
  conflict: "Conflict & Instability",
  country: "Country Profiles",
  state: "State Profiles",
  base: "Base & Installation Pages",
  contractor: "Contractor Pages",
  methodology: "Methodology & Sources",
  "data-page": "Other Approved Data Pages",
};

function approvedPage(page: WarCostsPageCatalogItem) {
  if (!APPROVED_TYPES.has(page.page_type)) return false;
  return !REJECTED_PATTERN.test(`${page.path} ${page.title} ${page.description}`);
}

export default function WarCostsSiteEvidence() {
  const [overview, setOverview] = useState<WarCostsPageOverview | null>(null);
  const [catalog, setCatalog] = useState<WarCostsPageCatalogItem[]>([]);
  const [activeType, setActiveType] = useState("all");
  const [selected, setSelected] = useState<WarCostsPageEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<WarCostsPageCatalogItem[] | null>(null);

  async function load() {
    setError("");
    try {
      const [nextOverview, nextCatalog] = await Promise.all([getWarCostsPageOverview(), getWarCostsPageCatalog(undefined, 2_000)]);
      setOverview(nextOverview);
      setCatalog(nextCatalog.pages.filter(approvedPage));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "WarCosts evidence could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!overview?.crawl.running) return;
    const timer = window.setInterval(() => void load(), 8_000);
    return () => window.clearInterval(timer);
  }, [overview?.crawl.running]);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const page of catalog) counts.set(page.page_type, (counts.get(page.page_type) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [catalog]);
  const visiblePages = useMemo(() => {
    const source = searchResults ?? catalog;
    return activeType === "all" ? source : source.filter((page) => page.page_type === activeType);
  }, [activeType, catalog, searchResults]);

  async function selectPage(path: string) {
    const source = catalog.find((page) => page.path === path) || searchResults?.find((page) => page.path === path);
    if (!source || !approvedPage(source)) return;
    setLoadingEvidence(true);
    try {
      const response = await getWarCostsPageEvidence(path);
      if (REJECTED_PATTERN.test(`${response.page.path} ${response.page.title} ${response.page.description}`)) {
        setSelected(null);
        return;
      }
      setSelected(response.page);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Evidence could not be opened."); }
    finally { setLoadingEvidence(false); }
  }

  async function startRefresh() {
    setRefreshing(true);
    try { await refreshWarCostsPages(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Evidence refresh failed."); }
    finally { setRefreshing(false); }
  }

  async function runSearch() {
    const value = query.trim();
    if (value.length < 2) { setSearchResults(null); return; }
    if (REJECTED_PATTERN.test(value)) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const response = await searchWarCostsPages(value);
      setSearchResults(response.results.filter(approvedPage));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Evidence search failed."); }
    finally { setSearching(false); }
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pb-24 lg:ml-[210px] lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts supplemental mirror" title="WarCosts Site Evidence" subtitle="Approved conflict, installation, country, contractor and methodology evidence. Weapon/hardware, draft, taxpayer/personal-cost, political and accountability pages are excluded." /><button type="button" onClick={() => void startRefresh()} disabled={refreshing || overview?.crawl.running} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/18 bg-cyan-300/10 px-4 text-xs font-bold disabled:opacity-45">{refreshing || overview?.crawl.running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}Refresh evidence</button></div>
        <WarCostsWorkspaceNav />
        {error ? <p className="mt-4 text-xs text-rose-100">{error}</p> : null}

        {loading ? <GlassCard className="mt-5 grid min-h-[360px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-200/60" /></GlassCard> : (
          <div className="mt-5 space-y-5">
            <section className="flex gap-2 overflow-x-auto"><button type="button" onClick={() => setActiveType("all")} className={`min-w-[150px] rounded-xl border p-3 text-left ${activeType === "all" ? "border-cyan-200/28 bg-cyan-300/12" : "border-white/8 bg-black/10"}`}><Database size={15} /><p className="mt-2 text-xs font-black">All approved</p><p className="mt-1 text-[10px] text-cyan-100/35">{catalog.length.toLocaleString()} pages</p></button>{types.map(([type, count]) => <button key={type} type="button" onClick={() => setActiveType(type)} className={`min-w-[150px] rounded-xl border p-3 text-left ${activeType === type ? "border-cyan-200/28 bg-cyan-300/12" : "border-white/8 bg-black/10"}`}><FileText size={15} /><p className="mt-2 text-xs font-black">{TYPE_LABELS[type] || type}</p><p className="mt-1 text-[10px] text-cyan-100/35">{count.toLocaleString()} pages</p></button>)}</section>

            <section className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
              <GlassCard className="p-5">
                <div className="relative"><Search size={15} className="absolute left-3 top-3.5 text-cyan-100/30" /><input value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) setSearchResults(null); }} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} placeholder="Search approved evidence…" className="min-h-11 w-full rounded-xl border border-cyan-100/12 bg-black/20 pl-9 pr-20 text-sm outline-none" /><button type="button" onClick={() => void runSearch()} className="absolute right-2 top-2 min-h-7 rounded-lg border border-cyan-100/10 px-2.5 text-[10px] font-bold">{searching ? "…" : "Search"}</button></div>
                <div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto">{visiblePages.map((page) => <button key={page.path} type="button" onClick={() => void selectPage(page.path)} className={`w-full rounded-xl border px-4 py-3 text-left ${selected?.path === page.path ? "border-cyan-200/24 bg-cyan-300/10" : "border-white/8 bg-black/10"}`}><p className="truncate text-xs font-black">{page.title}</p><p className="mt-1 truncate text-[10px] text-cyan-100/34">{page.path}</p><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-cyan-100/38">{page.description}</p></button>)}{!visiblePages.length ? <div className="p-8 text-center text-xs text-cyan-100/40">No approved evidence matches this view.</div> : null}</div>
              </GlassCard>

              <GlassCard className="p-5">
                {loadingEvidence ? <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-200/55" /></div> : selected ? <><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wider text-cyan-100/38">{TYPE_LABELS[selected.page_type] || selected.page_type}</p><h2 className="mt-2 text-xl font-black">{selected.title}</h2><p className="mt-2 text-xs leading-5 text-cyan-100/42">{selected.description}</p></div><a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold">Source <ExternalLink size={13} /></a></div><pre className="mt-5 max-h-[720px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 p-4 text-[10px] leading-5 text-cyan-50/68">{selected.evidence_text}</pre></> : <div className="grid min-h-[420px] place-items-center text-center text-xs text-cyan-100/38"><div><FileText size={26} className="mx-auto mb-3" />Select an approved evidence page.</div></div>}
              </GlassCard>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
