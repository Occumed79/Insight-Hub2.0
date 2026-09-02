import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
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

const TYPE_LABELS: Record<string, string> = {
  index: "Indexes & Discovery",
  conflict: "Conflict Pages",
  country: "Country Profiles",
  state: "State Profiles",
  base: "Base Pages",
  contractor: "Contractor Pages",
  weapon: "Weapon Pages",
  "arms-sales": "Arms Sales Pages",
  analysis: "Analysis",
  tool: "Tools & Calculators",
  perspective: "Perspectives",
  methodology: "Methodology & Sources",
  "data-page": "Other Data Pages",
};

function formatDate(value?: string): string {
  if (!value) return "Not yet available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function TypeCard({ type, count, active, onClick }: { type: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-200/28 bg-cyan-300/12" : "border-cyan-100/8 bg-black/10 hover:border-cyan-100/18 hover:bg-white/[0.035]"}`}>
      <div className="flex items-center justify-between gap-3"><FileText size={17} className={active ? "text-cyan-100" : "text-cyan-100/40"} /><span className="text-sm font-black text-white">{count.toLocaleString()}</span></div>
      <p className="mt-3 text-xs font-black text-cyan-50">{TYPE_LABELS[type] ?? type}</p>
      <p className="mt-1 text-[10px] text-cyan-100/35">mirrored public pages</p>
    </button>
  );
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
  const [showFullEvidence, setShowFullEvidence] = useState(false);

  async function load(): Promise<void> {
    setError("");
    try {
      const [nextOverview, nextCatalog] = await Promise.all([getWarCostsPageOverview(), getWarCostsPageCatalog(undefined, 2_000)]);
      setOverview(nextOverview);
      setCatalog(nextCatalog.pages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "WarCosts page evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!overview?.crawl.running) return;
    const timer = window.setInterval(() => { void load(); }, 8_000);
    return () => window.clearInterval(timer);
  }, [overview?.crawl.running]);

  const types = useMemo(() => Object.entries(overview?.summary.byType ?? {}).sort((a, b) => b[1] - a[1]), [overview?.summary.byType]);
  const visiblePages = useMemo(() => {
    const source = searchResults ?? catalog;
    if (activeType === "all") return source;
    return source.filter((page) => page.page_type === activeType);
  }, [activeType, catalog, searchResults]);

  async function selectPage(path: string): Promise<void> {
    setLoadingEvidence(true);
    setShowFullEvidence(false);
    try {
      const response = await getWarCostsPageEvidence(path);
      setSelected(response.page);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "WarCosts page evidence could not be opened.");
    } finally {
      setLoadingEvidence(false);
    }
  }

  async function startRefresh(): Promise<void> {
    setRefreshing(true);
    setError("");
    try {
      await refreshWarCostsPages();
      await load();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "WarCosts page mirror refresh could not be started.");
    } finally {
      setRefreshing(false);
    }
  }

  async function runSearch(): Promise<void> {
    const value = query.trim();
    if (value.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const response = await searchWarCostsPages(value);
      setSearchResults(response.results);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "WarCosts page search failed.");
    } finally {
      setSearching(false);
    }
  }

  const crawlHealthy = Boolean(overview && !overview.crawl.lastError && overview.crawl.pagesFailed === 0);
  const evidencePreview = selected?.evidence_text ?? "";
  const evidenceText = showFullEvidence ? evidencePreview : evidencePreview.slice(0, 20_000);

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <HeaderBar eyebrow="WarCosts supplemental mirror" title="WarCosts Site Evidence" subtitle="Captures data-bearing public pages, analyses, perspectives, calculators and detail views that WarCosts does not package as separate JSON datasets." />
          <button type="button" onClick={() => void startRefresh()} disabled={refreshing || overview?.crawl.running} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/18 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-50 disabled:opacity-45">
            {refreshing || overview?.crawl.running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {overview?.crawl.running ? "Mirror running" : "Refresh site evidence"}
          </button>
        </div>

        {error && <GlassCard className="mt-5 border-rose-300/20 p-4 text-sm text-rose-100">{error}</GlassCard>}

        {loading ? (
          <GlassCard className="mt-5 grid min-h-[360px] place-items-center p-10"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-200/60" /><p className="mt-4 text-sm font-bold text-cyan-50">Loading WarCosts site evidence…</p></div></GlassCard>
        ) : overview ? (
          <div className="mt-5 space-y-5">
            <GlassCard className={`p-5 ${crawlHealthy ? "border-emerald-300/12" : "border-amber-300/16"}`}>
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex max-w-4xl items-start gap-3">
                  {crawlHealthy ? <CheckCircle2 size={21} className="mt-0.5 text-emerald-300/70" /> : <AlertTriangle size={21} className="mt-0.5 text-amber-300/75" />}
                  <div><p className="text-sm font-black text-white">Second-layer page mirror</p><p className="mt-1 text-xs leading-5 text-cyan-100/45">The structured JSON mirror remains the source of truth for WarCosts’ 39 unique downloadable datasets. This layer separately retains page-only evidence so analysis tables, perspective statistics, tool assumptions and detail-page facts are not lost.</p></div>
                </div>
                <div className="grid grid-cols-2 gap-5 text-right"><div><p className="text-2xl font-black text-white">{overview.summary.total.toLocaleString()}</p><p className="text-[10px] text-cyan-100/35">pages retained</p></div><div><p className="text-2xl font-black text-white">{overview.crawl.pagesStored.toLocaleString()}</p><p className="text-[10px] text-cyan-100/35">this crawl</p></div></div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-cyan-100/8 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-wide text-cyan-100/32">Latest stored</p><p className="mt-1 text-xs font-bold text-cyan-50">{formatDate(overview.summary.latestFetchedAt)}</p></div>
                <div className="rounded-xl border border-cyan-100/8 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-wide text-cyan-100/32">Visited</p><p className="mt-1 text-xs font-bold text-cyan-50">{overview.crawl.pagesVisited.toLocaleString()}</p></div>
                <div className="rounded-xl border border-cyan-100/8 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-wide text-cyan-100/32">Failed</p><p className="mt-1 text-xs font-bold text-cyan-50">{overview.crawl.pagesFailed.toLocaleString()}</p></div>
                <div className="rounded-xl border border-cyan-100/8 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-wide text-cyan-100/32">Mirror ceiling</p><p className="mt-1 text-xs font-bold text-cyan-50">{overview.maxPages.toLocaleString()} pages</p></div>
              </div>
              {overview.crawl.running && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full animate-pulse rounded-full bg-cyan-200/55" style={{ width: `${Math.min(100, Math.max(2, (overview.crawl.pagesVisited / Math.max(overview.crawl.queueSize, 1)) * 100))}%` }} /></div><p className="mt-2 text-[10px] text-cyan-100/35">Discovering same-domain pages recursively · {overview.crawl.queueSize.toLocaleString()} currently discovered</p></div>}
            </GlassCard>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <TypeCard type="all" count={overview.summary.total} active={activeType === "all"} onClick={() => setActiveType("all")} />
              {types.map(([type, count]) => <TypeCard key={type} type={type} count={count} active={activeType === type} onClick={() => setActiveType(type)} />)}
            </section>

            <section className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
              <GlassCard className="p-5">
                <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">Automatically discovered catalog</p><h2 className="mt-1 text-lg font-black">{activeType === "all" ? "All page evidence" : TYPE_LABELS[activeType] ?? activeType}</h2></div><span className="text-xs font-bold text-cyan-100/42">{visiblePages.length.toLocaleString()} loaded</span></div>
                <div className="relative mt-4"><Search size={15} className="absolute left-3 top-3.5 text-cyan-100/30" /><input value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) setSearchResults(null); }} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} placeholder="Optional search across page-only evidence…" className="min-h-11 w-full rounded-xl border border-cyan-100/12 bg-black/20 pl-9 pr-20 text-sm text-white outline-none placeholder:text-cyan-100/25" /><button type="button" onClick={() => void runSearch()} className="absolute right-2 top-2 min-h-7 rounded-lg border border-cyan-100/10 px-2.5 text-[10px] font-bold text-cyan-50/70">{searching ? "…" : "Search"}</button></div>
                <div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto pr-1">
                  {visiblePages.map((page) => <button key={page.path} type="button" onClick={() => void selectPage(page.path)} className={`w-full rounded-xl border px-4 py-3 text-left transition ${selected?.path === page.path ? "border-cyan-200/24 bg-cyan-300/10" : "border-cyan-100/8 bg-black/10 hover:border-cyan-100/16 hover:bg-white/[0.035]"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-black text-cyan-50">{page.title}</p><p className="mt-1 truncate text-[10px] text-cyan-100/34">{page.path}</p><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-cyan-100/38">{page.description || `${page.char_count.toLocaleString()} characters of page evidence`}</p></div><span className="shrink-0 rounded-full border border-cyan-100/10 px-2 py-1 text-[9px] text-cyan-100/40">{TYPE_LABELS[page.page_type] ?? page.page_type}</span></div></button>)}
                  {!visiblePages.length && <div className="rounded-xl border border-dashed border-cyan-100/12 p-8 text-center"><Database size={22} className="mx-auto text-cyan-100/25" /><p className="mt-3 text-xs text-cyan-100/40">{overview.crawl.running ? "The first crawl is still populating this category." : "No mirrored pages in this category yet."}</p></div>}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                {loadingEvidence ? <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-200/55" /></div> : selected ? <>
                  <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/38">{TYPE_LABELS[selected.page_type] ?? selected.page_type}</p><h2 className="mt-2 text-xl font-black text-white">{selected.title}</h2><p className="mt-2 text-xs leading-5 text-cyan-100/42">{selected.description}</p></div><a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-100/12 px-3 text-[10px] font-bold text-cyan-50/65 hover:text-white">Source page <ExternalLink size={13} /></a></div>
                  {selected.headings.length > 0 && <div className="mt-5"><p className="text-xs font-black text-cyan-50">Page sections</p><div className="mt-2 flex flex-wrap gap-2">{selected.headings.slice(0, 30).map((heading, index) => <span key={`${heading}-${index}`} className="rounded-full border border-cyan-100/9 bg-black/10 px-2.5 py-1 text-[9px] text-cyan-100/42">{heading}</span>)}</div></div>}
                  <div className="mt-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-cyan-50">Retained page evidence</p><p className="mt-1 text-[10px] text-cyan-100/32">{selected.char_count.toLocaleString()} characters · {selected.link_count} internal links · {formatDate(selected.fetched_at)}</p></div><BookOpen size={18} className="text-cyan-200/45" /></div><div className="mt-3 max-h-[720px] overflow-auto rounded-xl border border-cyan-100/8 bg-black/20 p-4"><p className="whitespace-pre-wrap break-words text-[11px] leading-6 text-cyan-50/62">{evidenceText}</p></div>{evidencePreview.length > 20_000 && <button type="button" onClick={() => setShowFullEvidence((value) => !value)} className="mt-3 min-h-10 rounded-xl border border-cyan-100/12 px-3 text-[10px] font-bold text-cyan-50/65">{showFullEvidence ? "Show shorter preview" : `Show full retained evidence (${evidencePreview.length.toLocaleString()} chars)`}</button>}</div>
                </> : <div className="grid min-h-[520px] place-items-center text-center"><div><Globe2 size={34} className="mx-auto text-cyan-100/22" /><p className="mt-4 text-sm font-black text-cyan-50">Select any mirrored page</p><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-cyan-100/38">The page catalog is already populated by the crawler. You do not need to know a search term to see what WarCosts contains outside its downloadable JSON datasets.</p></div></div>}
              </GlassCard>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
