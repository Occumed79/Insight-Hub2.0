import { useEffect, useMemo, useState } from "react";
import { Database, ExternalLink, FileText, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
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

const DIRECT_TYPES = new Set(["base", "contractor", "instability", "naval", "methodology"]);
const REVIEWABLE_TYPES = new Set(["country", "index"]);
const RELEVANT_PATTERN = /(base|installation|garrison|facility|construction|personnel|troop|contractor|company|recipient|provider|medical|health|clinic|hospital|network|workforce|location|footprint|conflict|instability|strike|drone|civilian\s+(?:death|casualt)|navy|naval|fleet|carrier|maritime|deployment)/i;
const REJECTED_PATTERN = /(covert|clandestine|classified|secret\s+operation|cia\s+operation|special\s+operations?|special\s+forces|weapon|missile|fighter|bomber|tank|arms[- ]?sales|draft|conscription|taxpayer|personal[- ]?cost|war[- ]?cost|budget\s+simulator|military\s+spending|foreign\s+aid|veteran|president|politic|accountability|war\s+roi|cost[- ]?per[- ]?life|blowback|constitutional|regime\s+change)/i;

const TYPE_LABELS: Record<string, string> = {
  base: "Installation Evidence",
  contractor: "Contractor Evidence",
  instability: "Instability Evidence",
  naval: "Naval Deployment Evidence",
  country: "Country Evidence",
  index: "Relevant Indexes",
  methodology: "Methods & Sources",
};

function identity(page: Pick<WarCostsPageCatalogItem, "path" | "title" | "description" | "page_type">) {
  return `${page.path} ${page.title} ${page.description} ${page.page_type}`;
}

function approvedPage(page: WarCostsPageCatalogItem) {
  const text = identity(page);
  if (REJECTED_PATTERN.test(text)) return false;
  if (DIRECT_TYPES.has(page.page_type)) return true;
  return REVIEWABLE_TYPES.has(page.page_type) && RELEVANT_PATTERN.test(text);
}

function approvedEvidence(page: WarCostsPageEvidence) {
  const text = `${page.path} ${page.title} ${page.description} ${(page.headings || []).join(" ")}`;
  if (REJECTED_PATTERN.test(text)) return false;
  if (DIRECT_TYPES.has(page.page_type)) return true;
  return REVIEWABLE_TYPES.has(page.page_type) && (RELEVANT_PATTERN.test(text) || RELEVANT_PATTERN.test((page.evidence_text || "").slice(0, 20_000)));
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
      setError(reason instanceof Error ? reason.message : "Defense source evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
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
    setError("");
    try {
      const response = await getWarCostsPageEvidence(path);
      if (!approvedEvidence(response.page)) {
        setSelected(null);
        setError("That page is outside the approved defense-intelligence scope.");
        return;
      }
      setSelected(response.page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evidence could not be opened.");
    } finally {
      setLoadingEvidence(false);
    }
  }

  async function startRefresh() {
    setRefreshing(true);
    setError("");
    try {
      await refreshWarCostsPages();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evidence refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function runSearch() {
    const value = query.trim();
    if (value.length < 2) { setSearchResults(null); return; }
    if (REJECTED_PATTERN.test(value)) { setSearchResults([]); return; }
    setSearching(true);
    setError("");
    try {
      const response = await searchWarCostsPages(value);
      setSearchResults(response.results.filter(approvedPage));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evidence search failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#06090d] pb-24 text-white">
      <Sidebar />
      <section className="px-5 py-8 lg:ml-[210px] lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <HeaderBar eyebrow="Occu-Med · Defense intelligence" title="Defense Source Evidence" subtitle="Inspect the evidence behind installations, personnel/location context, military construction, instability, naval deployments, and contractor signals. Removed weapons, covert, political, taxpayer-cost, and draft content stays outside this workspace." />
          <button type="button" onClick={() => void startRefresh()} disabled={refreshing || overview?.crawl.running} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/18 bg-cyan-300/[.08] px-4 text-xs font-bold disabled:opacity-45">
            {refreshing || overview?.crawl.running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}Refresh evidence
          </button>
        </div>
        <WarCostsWorkspaceNav />
        {error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs leading-5 text-amber-100/75">{error}</div> : null}

        {loading ? <div className="mt-5 grid min-h-[520px] place-items-center border border-white/10 bg-[#080c12]"><Loader2 className="h-8 w-8 animate-spin text-cyan-200/60" /></div> : (
          <div className="mt-5 grid min-h-[720px] grid-cols-[250px_360px_minmax(0,1fr)] border border-white/10 bg-[#070b10]">
            <aside className="border-r border-white/10">
              <div className="border-b border-white/10 p-4">
                <div className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-200/60" /><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Approved evidence</p></div>
                <p className="mt-2 text-[10px] leading-5 text-slate-600">{overview?.crawl.pagesRejected ? `${overview.crawl.pagesRejected.toLocaleString()} non-approved pages were rejected during the last crawl.` : "Only approved War Map evidence classes are retained."}</p>
              </div>
              <button type="button" onClick={() => setActiveType("all")} className={`w-full border-b border-white/[.06] p-4 text-left ${activeType === "all" ? "bg-white/[.04] text-white" : "text-slate-400"}`}>
                <Database size={14} /><p className="mt-2 text-xs font-black">All approved evidence</p><p className="mt-1 text-[10px] text-slate-600">{catalog.length.toLocaleString()} pages</p>
              </button>
              {types.map(([type, count]) => <button key={type} type="button" onClick={() => setActiveType(type)} className={`w-full border-b border-white/[.06] p-4 text-left ${activeType === type ? "bg-white/[.04] text-white" : "text-slate-400"}`}><FileText size={14} /><p className="mt-2 text-xs font-black">{TYPE_LABELS[type] || type}</p><p className="mt-1 text-[10px] text-slate-600">{count.toLocaleString()} pages</p></button>)}
            </aside>

            <section className="border-r border-white/10">
              <div className="border-b border-white/10 p-4">
                <div className="flex min-h-11 items-center gap-2 border border-white/10 bg-black/25 px-3"><Search size={15} className="text-slate-500" /><input value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) setSearchResults(null); }} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} placeholder="Search approved defense evidence…" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" /><button type="button" onClick={() => void runSearch()} className="text-[10px] font-black text-cyan-100/65">{searching ? "…" : "Search"}</button></div>
              </div>
              <div className="max-h-[760px] overflow-y-auto divide-y divide-white/[.06]">{visiblePages.map((page) => <button key={page.path} type="button" onClick={() => void selectPage(page.path)} className={`w-full p-4 text-left transition ${selected?.path === page.path ? "bg-cyan-300/[.055]" : "hover:bg-white/[.02]"}`}><p className="text-sm font-black leading-5 text-white">{page.title}</p><p className="mt-1 truncate text-[10px] text-slate-600">{page.path}</p><p className="mt-2 line-clamp-2 text-[10px] leading-5 text-slate-500">{page.description}</p></button>)}{!visiblePages.length ? <div className="p-8 text-center text-xs leading-6 text-slate-500">No approved evidence matches this view.</div> : null}</div>
            </section>

            <section className="min-w-0 bg-[#080c12]">
              {loadingEvidence ? <div className="grid min-h-[620px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-200/55" /></div> : selected ? <>
                <header className="border-b border-white/10 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">{TYPE_LABELS[selected.page_type] || selected.page_type}</p><h2 className="mt-2 text-2xl font-black tracking-[-.025em] text-white">{selected.title}</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">{selected.description}</p></div><a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 border border-white/10 px-3 py-2 text-[10px] font-bold text-slate-300">Open source <ExternalLink size={13} /></a></div></header>
                <div className="p-5"><div className="border-l border-cyan-200/20 pl-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Source evidence</p><pre className="mt-3 max-h-[690px] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-6 text-slate-300">{selected.evidence_text}</pre></div></div>
              </> : <div className="grid min-h-[620px] place-items-center px-8 text-center"><div><FileText size={30} className="mx-auto text-slate-700" /><h2 className="mt-4 text-base font-black text-slate-300">Select source evidence</h2><p className="mt-2 max-w-sm text-[11px] leading-5 text-slate-600">Choose an installation, contractor, instability, naval, country, or methods page to inspect its retained evidence.</p></div></div>}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
