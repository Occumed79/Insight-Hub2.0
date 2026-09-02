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
import { GlassCard } from "@/components/insight/GlassCard";
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
      return [{
        cik,
        name,
        ticker: typeof record.ticker === "string" ? record.ticker : undefined,
        exchange: typeof record.exchange === "string" ? record.exchange : undefined,
      }];
    });
  } catch {
    return KNOWN_ISSUER_MAPPINGS;
  }
}

function formatDate(value?: string): string {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function SecFilings() {
  const [trackedIssuers, setTrackedIssuers] = useState<SecTrackedIssuer[]>(readTrackedIssuers);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SecTrackedIssuer[]>([]);
  const [loading, setLoading] = useState(false);
  const [feed, setFeed] = useState<SecFilingsFeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formFilter, setFormFilter] = useState("all");
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(trackedIssuers));
    }
  }, [trackedIssuers]);

  const visibleFilings = useMemo(() => {
    if (!feed) return [];
    return formFilter === "all"
      ? feed.filings
      : feed.filings.filter((filing) => filing.form === formFilter);
  }, [feed, formFilter]);

  const returnedForms = useMemo(
    () => Array.from(new Set(feed?.filings.map((filing) => filing.form) ?? [])).sort(),
    [feed],
  );

  async function runIssuerSearch(): Promise<void> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError("Enter at least two characters of a ticker or public company name.");
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const result = await searchSecIssuers(trimmed);
      setSearchResults(result.issuers);
    } catch (searchError) {
      setSearchResults([]);
      setError(searchError instanceof Error ? searchError.message : "SEC issuer search failed.");
    } finally {
      setSearching(false);
    }
  }

  function addIssuer(issuer: SecTrackedIssuer): void {
    setTrackedIssuers((current) => current.some((item) => item.cik === issuer.cik) ? current : [...current, issuer]);
  }

  function removeIssuer(cik: string): void {
    setTrackedIssuers((current) => current.filter((issuer) => issuer.cik !== cik));
    setFeed(null);
    setSelectedFiling(null);
  }

  async function refreshFeed(): Promise<void> {
    if (trackedIssuers.length === 0) {
      setError("Track at least one public issuer before refreshing SEC filings.");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedFiling(null);
    try {
      const result = await loadSecFilingsFeed(trackedIssuers, DEFAULT_FORMS);
      setFeed(result);
      setFormFilter("all");
    } catch (refreshError) {
      setFeed(null);
      setError(refreshError instanceof Error ? refreshError.message : "SEC filing refresh failed.");
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
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Employer Intelligence"
          title="SEC Filings"
          subtitle="Known public Insight Hub entities load automatically with recent official EDGAR filings; SEC search is a secondary add-company control."
        />

        <GlassCard className="mb-6 border-cyan-100/14 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
            <p className="text-xs leading-6 text-cyan-100/62">
              Known public-company mappings are preloaded for V2X, Amentum, and Jacobs. Filing data is retrieved from the official SEC submissions API and may be refreshed manually.
            </p>
          </div>
        </GlassCard>

        <section className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
          <GlassCard className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-100/42">Known public entity roster</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Tracked public companies</h2>
              </div>
              <Building2 className="h-5 w-5 text-cyan-200/45" />
            </div>

            <div className="mt-5 flex gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void runIssuerSearch();
                }}
                placeholder="Ticker or company name"
                className="min-h-12 flex-1 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-cyan-50 outline-none transition placeholder:text-cyan-100/25 focus:border-cyan-200/32"
              />
              <button
                type="button"
                onClick={() => void runIssuerSearch()}
                disabled={searching || query.trim().length < 2}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/12 px-4 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Search SEC
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {searchResults.map((issuer) => {
                  const tracked = trackedIssuers.some((item) => item.cik === issuer.cik);
                  return (
                    <div key={`${issuer.cik}-${issuer.ticker ?? "issuer"}`} className="flex items-center justify-between gap-4 rounded-2xl border border-cyan-100/10 bg-white/[0.035] p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{issuer.name}</p>
                        <p className="mt-1 text-[10px] text-cyan-100/42">
                          {issuer.ticker || "No ticker"} · {issuer.exchange || "Exchange unavailable"} · CIK {issuer.cik}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addIssuer(issuer)}
                        disabled={tracked}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-100/16 bg-cyan-300/[0.08] px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/14 disabled:opacity-45"
                      >
                        {tracked ? <Check size={14} /> : <Plus size={14} />}
                        {tracked ? "Tracked" : "Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 border-t border-cyan-100/10 pt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-white">Tracked issuers</h3>
                <span className="rounded-full border border-cyan-100/12 bg-cyan-300/[0.06] px-3 py-1 text-xs text-cyan-100/60">{trackedIssuers.length}</span>
              </div>

              {trackedIssuers.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-cyan-100/12 p-5 text-center text-xs leading-6 text-cyan-100/42">
                  Search the SEC directory and explicitly add each public issuer you want included in the feed.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {trackedIssuers.map((issuer) => (
                    <div key={issuer.cik} className="flex items-center justify-between gap-4 rounded-2xl border border-cyan-100/10 bg-black/15 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-cyan-50">{issuer.name}</p>
                        <p className="mt-1 text-[10px] text-cyan-100/38">{issuer.ticker || "—"} · {issuer.exchange || "—"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeIssuer(issuer.cik)}
                        className="rounded-xl border border-rose-200/12 p-2 text-rose-100/60 transition hover:bg-rose-300/[0.08] hover:text-rose-100"
                        aria-label={`Remove ${issuer.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

          <section className="space-y-5">
            <GlassCard className="p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-100/42">Official EDGAR submissions</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Live filing feed</h2>
                  <p className="mt-2 text-xs leading-6 text-cyan-100/45">No timer, cron job, startup fetch, or unattended refresh.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshFeed()}
                  disabled={loading || trackedIssuers.length === 0}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-200/20 bg-emerald-300/10 px-5 text-sm font-bold text-emerald-50 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                  {loading ? "Refreshing SEC…" : "Refresh SEC filings"}
                </button>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200/18 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </GlassCard>

            {!feed && !loading ? (
              <GlassCard className="p-10 text-center">
                <FileSearch className="mx-auto h-10 w-10 text-cyan-100/28" />
                <p className="mt-3 text-sm font-semibold text-cyan-50">No SEC feed has been refreshed</p>
                <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-cyan-100/42">Track one or more public issuers, then run the manual refresh.</p>
              </GlassCard>
            ) : loading ? (
              <GlassCard className="p-10 text-center">
                <Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-200/60" />
                <p className="mt-3 text-sm font-semibold text-cyan-50">Fetching official submissions for {trackedIssuers.length} issuer{trackedIssuers.length === 1 ? "" : "s"}…</p>
              </GlassCard>
            ) : feed ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryMetric label="Issuers checked" value={String(feed.issuerCount)} />
                  <SummaryMetric label="Filings returned" value={String(feed.filingCount)} />
                  <SummaryMetric label="Last refreshed" value={new Date(feed.completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} />
                </div>

                {feed.errors.length > 0 && (
                  <GlassCard className="border-amber-200/14 p-4">
                    <p className="text-xs font-semibold text-amber-100">Partial SEC refresh</p>
                    {feed.errors.map((item) => <p key={item.cik} className="mt-2 text-xs text-amber-100/60">{item.companyName}: {item.error}</p>)}
                  </GlassCard>
                )}

                <GlassCard className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-100/10 p-4">
                    <div>
                      <p className="text-sm font-bold text-white">Latest filings</p>
                      <p className="mt-1 text-[10px] text-cyan-100/38">Click View evidence for filing details. Rows themselves do not navigate.</p>
                      {returnedForms.length > 0 && (
                        <p className="mt-2 text-[10px] text-cyan-100/52">
                          Forms returned: {returnedForms.join(" · ")}
                        </p>
                      )}
                    </div>
                    <select
                      value={formFilter}
                      onChange={(event) => setFormFilter(event.target.value)}
                      className="rounded-xl border border-cyan-100/12 bg-[#07101d] px-3 py-2 text-xs text-cyan-50 outline-none"
                    >
                      <option value="all">All forms</option>
                      {returnedForms.map((form) => <option key={form} value={form}>{form}</option>)}
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-cyan-100/8 text-[10px] uppercase tracking-[0.16em] text-cyan-100/38">
                          <th className="px-4 py-3 font-semibold">Filed</th>
                          <th className="px-4 py-3 font-semibold">Company</th>
                          <th className="px-4 py-3 font-semibold">Form</th>
                          <th className="px-4 py-3 font-semibold">Description</th>
                          <th className="px-4 py-3 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleFilings.map((filing) => (
                          <tr key={filing.id} className="border-b border-cyan-100/[0.06] last:border-b-0">
                            <td className="whitespace-nowrap px-4 py-4 text-xs text-cyan-100/58">{formatDate(filing.filingDate)}</td>
                            <td className="px-4 py-4">
                              <p className="max-w-[230px] truncate text-sm font-semibold text-white">{filing.companyName}</p>
                              <p className="mt-1 text-[10px] text-cyan-100/36">{filing.ticker || filing.cik}</p>
                            </td>
                            <td className="px-4 py-4"><span className="rounded-full border border-violet-200/16 bg-violet-300/[0.08] px-3 py-1 text-xs font-bold text-violet-100">{filing.form}</span></td>
                            <td className="max-w-[300px] px-4 py-4 text-xs leading-5 text-cyan-100/48">{filing.primaryDocumentDescription || filing.items || filing.primaryDocument || "SEC filing"}</td>
                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedFiling(filing)}
                                className="inline-flex items-center gap-2 rounded-xl border border-cyan-100/14 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/13"
                              >
                                <FileSearch size={14} />
                                View evidence
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {visibleFilings.length === 0 && <p className="p-8 text-center text-xs text-cyan-100/42">No filings match this form filter.</p>}
                </GlassCard>
              </>
            ) : null}
          </section>
        </section>
      </section>

      {selectedFiling && <FilingDrawer filing={selectedFiling} onClose={() => setSelectedFiling(null)} />}
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/40">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </GlassCard>
  );
}

function FilingDrawer({ filing, onClose }: { filing: SecFiling; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-cyan-100/14 bg-[#050b15]/98 p-6 shadow-[-30px_0_90px_rgba(0,0,0,.5)]"
        role="dialog"
        aria-modal="true"
        aria-label="SEC filing evidence"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/60">SEC filing evidence</p>
            <h2 className="mt-2 text-2xl font-black text-white">{filing.form} · {filing.companyName}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-cyan-100/12 p-2 text-cyan-100/60 hover:text-white" aria-label="Close filing evidence">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <EvidenceRow label="Filed" value={formatDate(filing.filingDate)} />
          <EvidenceRow label="Report date" value={formatDate(filing.reportDate)} />
          <EvidenceRow label="Ticker / exchange" value={[filing.ticker, filing.exchange].filter(Boolean).join(" · ") || "Not reported"} />
          <EvidenceRow label="CIK" value={filing.cik} />
          <EvidenceRow label="Accession number" value={filing.accessionNumber} />
          <EvidenceRow label="Primary document" value={filing.primaryDocumentDescription || filing.primaryDocument || "Not reported"} />
          <EvidenceRow label="Items" value={filing.items || "Not reported"} />
          <EvidenceRow label="Structured data" value={filing.isInlineXbrl ? "Inline XBRL" : filing.isXbrl ? "XBRL" : "Not indicated"} />
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <a href={filing.filingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-50 hover:bg-cyan-300/16">
            Open SEC filing index
            <ExternalLink size={15} />
          </a>
          {filing.documentUrl && (
            <a href={filing.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-violet-200/18 bg-violet-300/[0.08] px-4 py-3 text-sm font-bold text-violet-50 hover:bg-violet-300/14">
              Open primary document
              <ExternalLink size={15} />
            </a>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-amber-200/12 bg-amber-300/[0.05] p-4 text-xs leading-6 text-amber-100/58">
          SEC filings are public disclosure evidence. They do not independently establish ownership relationships, workplace conditions, occupational risk, compliance, or liability.
        </div>
      </aside>
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4">
      <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/38">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-cyan-50/82">{value}</p>
    </div>
  );
}
