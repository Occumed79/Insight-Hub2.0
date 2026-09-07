import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  ExternalLink,
  FileSearch,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import {
  loadSecFilingsFeed,
  searchSecIssuers,
  type SecFiling,
  type SecFilingsFeedResponse,
  type SecTrackedIssuer,
} from "@/data/secFilingsApi";

const SESSION_KEY = "insight-hub:tracked-sec-issuers:v1";
const DEFAULT_FORMS = ["8-K", "10-Q", "10-K", "6-K", "20-F", "40-F", "DEF 14A", "S-1", "S-3"];
const KNOWN_ISSUER_MAPPINGS: SecTrackedIssuer[] = [
  { cik: "0001601548", name: "V2X, Inc.", ticker: "VVX", exchange: "NYSE" },
  { cik: "0001792580", name: "Amentum Holdings, Inc.", ticker: "AMTM", exchange: "NYSE" },
  { cik: "0000885725", name: "Jacobs Solutions Inc.", ticker: "J", exchange: "NYSE" },
];

function readTrackedIssuers(): SecTrackedIssuer[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return KNOWN_ISSUER_MAPPINGS;
    return parsed.flatMap((value): SecTrackedIssuer[] => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const record = value as Record<string, unknown>;
      const cik = typeof record.cik === "string" ? record.cik : "";
      const name = typeof record.name === "string" ? record.name : "";
      if (!cik || !name) return [];
      return [{ cik, name, ticker: typeof record.ticker === "string" ? record.ticker : undefined, exchange: typeof record.exchange === "string" ? record.exchange : undefined }];
    });
  } catch {
    return KNOWN_ISSUER_MAPPINGS;
  }
}

function formatDate(value?: string) {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function FilingRow({ filing, selected, onSelect }: { filing: SecFiling; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`grid w-full grid-cols-[78px_92px_minmax(0,1fr)_115px] items-start gap-3 border-b border-white/[.055] px-4 py-3 text-left transition ${selected ? "bg-sky-400/[.055]" : "hover:bg-white/[.018]"}`}>
      <span className="text-[11px] font-black text-sky-100/82">{filing.form}</span>
      <span className="text-[10px] text-slate-500">{formatDate(filing.filingDate)}</span>
      <span className="min-w-0"><strong className="block truncate text-[11px] text-slate-100">{filing.companyName}</strong><span className="mt-1 block truncate text-[10px] text-slate-600">{filing.primaryDocumentDescription || filing.primaryDocument || filing.items || filing.accessionNumber}</span></span>
      <span className="truncate text-right text-[9px] uppercase tracking-[.08em] text-slate-600">{filing.ticker || filing.exchange || `CIK ${filing.cik}`}</span>
    </button>
  );
}

export default function SecFilings() {
  const [trackedIssuers, setTrackedIssuers] = useState<SecTrackedIssuer[]>(readTrackedIssuers);
  const [issuerQuery, setIssuerQuery] = useState("");
  const [filingQuery, setFilingQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SecTrackedIssuer[]>([]);
  const [loading, setLoading] = useState(false);
  const [feed, setFeed] = useState<SecFilingsFeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formFilter, setFormFilter] = useState("all");
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [selectedFiling, setSelectedFiling] = useState<SecFiling | null>(null);
  const autoLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/entities/roster", { cache: "no-store" }).then((response) => response.json()).then(async (payload) => {
      const names = Array.isArray(payload?.entities) ? payload.entities.map((entity: { name?: unknown }) => typeof entity.name === "string" ? entity.name : "").filter(Boolean).slice(0, 20) : [];
      const resolved: SecTrackedIssuer[] = [];
      for (const name of names) {
        const known = KNOWN_ISSUER_MAPPINGS.find((issuer) => issuer.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(issuer.name.replace(/,?\s+(inc\.?|holdings|solutions).*$/i, "").toLowerCase()));
        if (known) { resolved.push(known); continue; }
        try {
          const result = await searchSecIssuers(name);
          const exact = result.issuers.find((issuer) => issuer.name.toLowerCase() === name.toLowerCase());
          if (exact) resolved.push(exact);
        } catch { /* One unresolved private entity must not block the roster. */ }
      }
      if (cancelled || !resolved.length) return;
      autoLoaded.current = false;
      setTrackedIssuers((current) => [...current, ...resolved].filter((issuer, index, all) => all.findIndex((candidate) => candidate.cik === issuer.cik) === index));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(trackedIssuers)); }, [trackedIssuers]);

  const returnedForms = useMemo(() => Array.from(new Set(feed?.filings.map((filing) => filing.form) ?? [])).sort(), [feed]);
  const visibleFilings = useMemo(() => {
    const needle = filingQuery.trim().toLowerCase();
    return (feed?.filings || []).filter((filing) => {
      if (formFilter !== "all" && filing.form !== formFilter) return false;
      if (issuerFilter !== "all" && filing.cik !== issuerFilter) return false;
      if (!needle) return true;
      return [filing.companyName, filing.ticker, filing.form, filing.items, filing.primaryDocument, filing.primaryDocumentDescription, filing.accessionNumber]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [feed, filingQuery, formFilter, issuerFilter]);

  async function runIssuerSearch() {
    const trimmed = issuerQuery.trim();
    if (trimmed.length < 2) { setError("Enter at least two characters of a ticker or public company name."); return; }
    setSearching(true);
    setError(null);
    try {
      const result = await searchSecIssuers(trimmed);
      setSearchResults(result.issuers);
    } catch (caught) {
      setSearchResults([]);
      setError(caught instanceof Error ? caught.message : "SEC issuer search failed.");
    } finally {
      setSearching(false);
    }
  }

  function addIssuer(issuer: SecTrackedIssuer) {
    setTrackedIssuers((current) => current.some((item) => item.cik === issuer.cik) ? current : [...current, issuer]);
  }

  function removeIssuer(cik: string) {
    setTrackedIssuers((current) => current.filter((issuer) => issuer.cik !== cik));
    if (issuerFilter === cik) setIssuerFilter("all");
    setSelectedFiling(null);
  }

  async function refreshFeed() {
    if (!trackedIssuers.length) { setError("Track at least one public issuer before refreshing SEC filings."); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await loadSecFilingsFeed(trackedIssuers, DEFAULT_FORMS);
      setFeed(result);
      setFormFilter("all");
      setSelectedFiling((current) => current && result.filings.some((filing) => filing.id === current.id) ? current : result.filings[0] || null);
    } catch (caught) {
      setFeed(null);
      setSelectedFiling(null);
      setError(caught instanceof Error ? caught.message : "SEC filing refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoLoaded.current || trackedIssuers.length === 0) return;
    autoLoaded.current = true;
    void refreshFeed();
  }, [trackedIssuers]);

  return (
    <main className="reviewer-native-page min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 min-h-screen lg:ml-[210px]">
        <div className="px-6 pt-7"><HeaderBar eyebrow="Employer Intelligence" title="SEC Filings" subtitle="Tracked public entities load into a dense EDGAR timeline; issuer discovery is secondary, while filing inspection stays persistent." /></div>

        {error ? <div className="mx-6 mb-3 flex items-start gap-2 border-l-2 border-rose-300/35 pl-3 text-xs leading-5 text-rose-100/74"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</div> : null}

        <div className="grid min-h-[calc(100vh-122px)] border-y border-white/8 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <aside className="border-r border-white/8 bg-[#0a0e13]/78">
            <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-slate-500">Tracked issuers</p><h2 className="mt-1 text-lg font-black">{trackedIssuers.length} companies</h2></div><Building2 className="h-5 w-5 text-sky-100/38" /></div>
              <div className="relative mt-4"><div className="flex min-h-10 items-center gap-2 rounded-md border border-white/9 bg-black/18 px-3"><Search className="h-3.5 w-3.5 text-slate-600" /><input value={issuerQuery} onChange={(event) => setIssuerQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void runIssuerSearch()} placeholder="Add ticker / company" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />{issuerQuery ? <button onClick={() => { setIssuerQuery(""); setSearchResults([]); }} className="text-slate-600 hover:text-white"><X className="h-3 w-3" /></button> : null}</div><button onClick={() => void runIssuerSearch()} disabled={searching || issuerQuery.trim().length < 2} className="mt-2 inline-flex h-8 items-center gap-2 rounded-md border border-sky-300/15 px-3 text-[9px] font-black uppercase tracking-[.08em] text-sky-100/68 disabled:opacity-40">{searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}Search SEC</button></div>
              {searchResults.length ? <div className="mt-3 divide-y divide-white/7 border-y border-white/7">{searchResults.slice(0, 12).map((issuer) => { const tracked = trackedIssuers.some((item) => item.cik === issuer.cik); return <div key={`${issuer.cik}-${issuer.ticker || "issuer"}`} className="flex items-start gap-3 py-3"><button onClick={() => addIssuer(issuer)} disabled={tracked} className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border border-white/10 text-sky-100/60 disabled:text-emerald-200">{tracked ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}</button><div className="min-w-0"><p className="truncate text-[11px] font-bold">{issuer.name}</p><p className="mt-1 text-[9px] text-slate-600">{issuer.ticker || "No ticker"} · CIK {issuer.cik}</p></div></div>; })}</div> : null}

              <div className="mt-5 divide-y divide-white/7 border-y border-white/7">{trackedIssuers.map((issuer) => <div key={issuer.cik} className={`group flex items-center gap-3 py-3 ${issuerFilter === issuer.cik ? "text-white" : "text-slate-400"}`}><button onClick={() => setIssuerFilter(issuerFilter === issuer.cik ? "all" : issuer.cik)} className="min-w-0 flex-1 text-left"><p className="truncate text-[11px] font-bold">{issuer.name}</p><p className="mt-1 text-[9px] text-slate-600">{issuer.ticker || issuer.exchange || `CIK ${issuer.cik}`}</p></button><button aria-label={`Remove ${issuer.name}`} onClick={() => removeIssuer(issuer.cik)} className="text-slate-700 opacity-0 hover:text-white group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
              <button onClick={() => void refreshFeed()} disabled={loading || !trackedIssuers.length} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/9 bg-white/[.025] text-[10px] font-black text-slate-300 disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh EDGAR feed</button>
              <div className="mt-4 flex items-start gap-2 text-[9px] leading-5 text-slate-600"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Official SEC submissions data. Known public Insight Hub entities are preloaded when resolvable.</div>
            </div>
          </aside>

          <section className="min-w-0 bg-[#090c10]/64">
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-white/8 bg-[#0a0e13]/94 px-4 py-3 backdrop-blur-xl">
              <label className="relative min-w-[240px] flex-1"><FileSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" /><input value={filingQuery} onChange={(event) => setFilingQuery(event.target.value)} placeholder="Search filings, items, descriptions, accession" className="h-9 w-full rounded-md border border-white/9 bg-[#101419] pl-9 pr-3 text-[11px] outline-none placeholder:text-slate-700" /></label>
              <select value={formFilter} onChange={(event) => setFormFilter(event.target.value)} className="h-9 rounded-md border border-white/9 bg-[#101419] px-2 text-[10px] text-slate-300 outline-none"><option value="all">All forms</option>{returnedForms.map((form) => <option key={form} value={form}>{form}</option>)}</select>
              <select value={issuerFilter} onChange={(event) => setIssuerFilter(event.target.value)} className="h-9 max-w-[190px] rounded-md border border-white/9 bg-[#101419] px-2 text-[10px] text-slate-300 outline-none"><option value="all">All issuers</option>{trackedIssuers.map((issuer) => <option key={issuer.cik} value={issuer.cik}>{issuer.ticker || issuer.name}</option>)}</select>
              <span className="text-[9px] uppercase tracking-[.1em] text-slate-600">{visibleFilings.length} filings</span>
            </div>

            <div className="grid grid-cols-[78px_92px_minmax(0,1fr)_115px] gap-3 border-b border-white/8 bg-[#0c1015] px-4 py-2 text-[8px] font-black uppercase tracking-[.11em] text-slate-650"><span>Form</span><span>Filed</span><span>Issuer / document</span><span className="text-right">Market</span></div>
            {loading && !feed ? <div className="grid min-h-[520px] place-items-center"><div className="text-center text-xs text-slate-500"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading recent official filings…</div></div> : visibleFilings.length ? <div>{visibleFilings.map((filing) => <FilingRow key={filing.id} filing={filing} selected={selectedFiling?.id === filing.id} onSelect={() => setSelectedFiling(filing)} />)}</div> : <div className="grid min-h-[520px] place-items-center text-center"><div><FileSearch className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-4 text-sm font-bold text-slate-300">No filings match the current filters.</p><p className="mt-2 text-xs text-slate-600">Adjust form, issuer, or filing text search.</p></div></div>}
          </section>

          <aside className="border-l border-white/8 bg-[#0d1014]/88">
            <div className="sticky top-0 max-h-screen overflow-y-auto p-5">
              {selectedFiling ? <>
                <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-sky-100/38">Selected filing</p><div className="mt-2 flex items-center gap-2"><span className="rounded border border-sky-300/20 bg-sky-400/[.06] px-2 py-1 text-[10px] font-black text-sky-100">{selectedFiling.form}</span><span className="text-[9px] text-slate-600">{formatDate(selectedFiling.filingDate)}</span></div><h2 className="mt-3 text-xl font-black leading-6 tracking-[-0.025em]">{selectedFiling.companyName}</h2><p className="mt-1 text-[10px] text-slate-500">{selectedFiling.ticker || selectedFiling.exchange || `CIK ${selectedFiling.cik}`}</p></div><button onClick={() => setSelectedFiling(null)} className="rounded-md border border-white/9 p-2 text-slate-600 hover:text-white"><X className="h-3.5 w-3.5" /></button></div>

                <div className="mt-5 divide-y divide-white/7 border-y border-white/7 text-[10px]"><Info label="Accession" value={selectedFiling.accessionNumber} /><Info label="Report date" value={formatDate(selectedFiling.reportDate)} /><Info label="Accepted" value={selectedFiling.acceptanceDateTime || "Not reported"} /><Info label="Document" value={selectedFiling.primaryDocumentDescription || selectedFiling.primaryDocument || "Not reported"} /><Info label="Items" value={selectedFiling.items || "Not reported"} /><Info label="Inline XBRL" value={selectedFiling.isInlineXbrl ? "Yes" : "No"} /></div>

                <div className="mt-5 space-y-2"><a href={selectedFiling.documentUrl || selectedFiling.filingUrl} target="_blank" rel="noreferrer" className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-sky-300/16 bg-sky-400/[.045] px-3 text-[10px] font-black text-sky-100"><span>Open primary SEC document</span><ExternalLink className="h-3.5 w-3.5" /></a><a href={selectedFiling.filingUrl} target="_blank" rel="noreferrer" className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-white/9 px-3 text-[10px] font-black text-slate-400"><span>Open filing index</span><ExternalLink className="h-3.5 w-3.5" /></a></div>

                <section className="mt-6 border-t border-white/8 pt-4"><p className="text-[9px] font-black uppercase tracking-[.13em] text-slate-600">Reader boundary</p><p className="mt-2 text-[10px] leading-5 text-slate-500">Insight Hub indexes filing metadata and routes directly to the official EDGAR document. This pane does not pretend the full filing text has been locally parsed when it has not.</p></section>
              </> : <div className="grid min-h-[520px] place-items-center text-center"><div><FileSearch className="mx-auto h-8 w-8 text-slate-700" /><h2 className="mt-4 text-lg font-black">Select a filing</h2><p className="mx-auto mt-2 max-w-[260px] text-xs leading-5 text-slate-600">Metadata, dates, filing items, XBRL state, and official document links stay visible here.</p></div></div>}

              {feed ? <section className="mt-6 border-t border-white/8 pt-4"><p className="text-[8px] font-black uppercase tracking-[.12em] text-slate-650">Feed status</p><p className="mt-2 text-[9px] leading-5 text-slate-600">{feed.filingCount} filings · {feed.issuerCount} issuers · {feed.freshness}</p>{feed.errors.length ? <p className="mt-2 text-[9px] leading-5 text-amber-100/58">{feed.errors.length} issuer request{feed.errors.length === 1 ? "" : "s"} returned errors.</p> : null}</section> : null}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-3 py-3"><span className="text-slate-650">{label}</span><strong className="break-words font-semibold text-slate-300">{value}</strong></div>;
}
