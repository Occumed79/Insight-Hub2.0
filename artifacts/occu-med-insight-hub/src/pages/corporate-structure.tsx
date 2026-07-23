import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  GitBranch,
  Globe2,
  Loader2,
  Network,
  Search,
  ShieldCheck,
  Tags,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  analyzeCorporateStructure,
  type CorporateConfidence,
  type CorporateEntity,
  type CorporateRelationship,
  type CorporateStructureResponse,
} from "@/data/corporateStructureApi";

const SESSION_COMPANY_KEY = "insight-hub.corporate-structure.company";
const SESSION_URL_KEY = "insight-hub.corporate-structure.url";

const relationshipOrder: CorporateRelationship[] = ["subsidiary", "division", "brand", "dba", "affiliate", "unknown"];
const relationshipLabels: Record<CorporateRelationship, string> = {
  parent: "Parent company",
  subsidiary: "Subsidiaries",
  division: "Divisions & business units",
  brand: "Brands",
  dba: "DBA names",
  affiliate: "Affiliates & related organizations",
  unknown: "Unclassified relationships",
};

function confidenceClass(value: CorporateConfidence): string {
  if (value === "confirmed") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (value === "probable") return "border-cyan-200/20 bg-cyan-300/10 text-cyan-100";
  return "border-amber-200/20 bg-amber-300/10 text-amber-100";
}

function relationshipIcon(value: CorporateRelationship) {
  if (value === "brand" || value === "dba") return Tags;
  if (value === "affiliate") return Network;
  if (value === "division") return GitBranch;
  return Building2;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Building2 }) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/40">{label}</p>
        <Icon size={15} className="text-cyan-200/45" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

export default function CorporateStructure() {
  const [companyName, setCompanyName] = useState(() => sessionStorage.getItem(SESSION_COMPANY_KEY) || "");
  const [primaryUrl, setPrimaryUrl] = useState(() => sessionStorage.getItem(SESSION_URL_KEY) || "");
  const [tickerOrCik, setTickerOrCik] = useState("");
  const [supportingUrls, setSupportingUrls] = useState("");
  const [result, setResult] = useState<CorporateStructureResponse | null>(null);
  const [selected, setSelected] = useState<CorporateEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState<CorporateRelationship | "all">("all");
  const [confidenceFilter, setConfidenceFilter] = useState<CorporateConfidence | "all">("all");

  const parent = useMemo(() => result?.entities.find((entity) => entity.relationship === "parent") ?? null, [result]);

  const filteredEntities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (result?.entities ?? []).filter((entity) => {
      if (entity.relationship === "parent") return false;
      if (relationshipFilter !== "all" && entity.relationship !== relationshipFilter) return false;
      if (confidenceFilter !== "all" && entity.confidence !== confidenceFilter) return false;
      if (!normalizedQuery) return true;
      return [entity.name, entity.jurisdiction, entity.description, entity.relationship]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    });
  }, [confidenceFilter, query, relationshipFilter, result]);

  const grouped = useMemo(() => relationshipOrder.map((relationship) => ({
    relationship,
    entities: filteredEntities.filter((entity) => entity.relationship === relationship),
  })).filter((group) => group.entities.length > 0), [filteredEntities]);

  async function runAnalysis() {
    const company = companyName.trim();
    if (!company) {
      setError("Enter a company name before running corporate-structure analysis.");
      return;
    }
    const urls = supportingUrls.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(null);
    setQuery("");
    setRelationshipFilter("all");
    setConfidenceFilter("all");
    sessionStorage.setItem(SESSION_COMPANY_KEY, company);
    if (primaryUrl.trim()) sessionStorage.setItem(SESSION_URL_KEY, primaryUrl.trim());
    else sessionStorage.removeItem(SESSION_URL_KEY);
    try {
      const response = await analyzeCorporateStructure({
        companyName: company,
        primaryUrl: primaryUrl.trim() || undefined,
        tickerOrCik: tickerOrCik.trim() || undefined,
        supportingUrls: urls,
      });
      setResult(response);
      setSelected(response.entities.find((entity) => entity.relationship !== "parent") ?? null);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Corporate structure analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function clearWorkspace() {
    setCompanyName("");
    setPrimaryUrl("");
    setTickerOrCik("");
    setSupportingUrls("");
    setResult(null);
    setSelected(null);
    setError(null);
    setQuery("");
    sessionStorage.removeItem(SESSION_COMPANY_KEY);
    sessionStorage.removeItem(SESSION_URL_KEY);
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <HeaderBar
          eyebrow="Standalone Intelligence Tool"
          title="Corporate Structure"
          subtitle="Map public subsidiaries, divisions, brands, DBAs, and affiliates from official company pages and SEC subsidiary exhibits."
        />

        <GlassCard className="mb-6 p-5 md:p-6">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr_.7fr_auto] xl:items-end">
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Company name</span>
              <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                <Building2 size={17} className="shrink-0 text-cyan-200/45" />
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") void runAnalysis(); }}
                  placeholder="Company or legal entity"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/25"
                />
              </div>
            </label>
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Official company or investor-relations URL</span>
              <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                <Globe2 size={17} className="shrink-0 text-cyan-200/45" />
                <input
                  value={primaryUrl}
                  onChange={(event) => setPrimaryUrl(event.target.value)}
                  placeholder="https://company.com/about"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/25"
                />
              </div>
            </label>
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Ticker or CIK</span>
              <input
                value={tickerOrCik}
                onChange={(event) => setTickerOrCik(event.target.value)}
                placeholder="Optional"
                className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/30"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={loading}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/25 bg-cyan-300/15 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/22 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Network size={17} />}
                Analyze structure
              </button>
              {(result || companyName || primaryUrl) && (
                <button type="button" onClick={clearWorkspace} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/60 hover:bg-white/[0.08] hover:text-white">
                  Clear
                </button>
              )}
            </div>
          </div>
          <label className="mt-4 block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Supporting public URLs — one per line</span>
            <textarea
              value={supportingUrls}
              onChange={(event) => setSupportingUrls(event.target.value)}
              rows={2}
              placeholder="Optional subsidiary, brand, portfolio, or corporate-structure pages"
              className="mt-2 w-full resize-y rounded-2xl border border-cyan-100/12 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/30"
            />
          </label>
          <p className="mt-3 text-xs leading-5 text-cyan-100/35">The tool runs only when you press Analyze structure. It does not save a company roster or run background crawls.</p>
        </GlassCard>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200/20 bg-rose-300/10 p-4 text-sm text-rose-100">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!result && !loading && (
          <GlassCard className="p-8 text-center">
            <Network size={30} className="mx-auto text-cyan-200/40" />
            <h2 className="mt-4 text-lg font-semibold">Build a public corporate-family map</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-cyan-100/45">Enter a company and at least one useful public source. Public companies can also be enriched from the latest available SEC annual filing and Exhibit 21.</p>
          </GlassCard>
        )}

        {result && (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Related entities" value={result.summary.totalEntities} icon={Building2} />
              <Metric label="Subsidiaries" value={result.summary.relationshipCounts.subsidiary ?? 0} icon={GitBranch} />
              <Metric label="Brands / DBAs" value={(result.summary.relationshipCounts.brand ?? 0) + (result.summary.relationshipCounts.dba ?? 0)} icon={Tags} />
              <Metric label="Jurisdictions" value={result.summary.jurisdictions} icon={Globe2} />
              <Metric label="Confirmed" value={result.summary.confidenceCounts.confirmed ?? 0} icon={ShieldCheck} />
              <Metric label="Sources analyzed" value={result.summary.analyzedSources} icon={Database} />
            </div>

            {(result.warnings.length > 0 || result.gaps.length > 0) && (
              <div className="mb-6 grid gap-3 lg:grid-cols-2">
                {result.warnings.length > 0 && (
                  <div className="rounded-2xl border border-amber-200/16 bg-amber-300/[0.07] p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-100"><AlertTriangle size={16} /> Source warnings</p>
                    <div className="mt-3 space-y-2 text-xs leading-5 text-amber-50/65">
                      {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                    </div>
                  </div>
                )}
                {result.gaps.length > 0 && (
                  <div className="rounded-2xl border border-cyan-100/12 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-cyan-50">Visible gaps</p>
                    <div className="mt-3 space-y-2 text-xs leading-5 text-cyan-100/50">
                      {result.gaps.map((gap) => <p key={gap}>• {gap}</p>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <GlassCard className="mb-6 p-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="flex min-h-11 flex-1 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4">
                  <Search size={16} className="text-cyan-200/40" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entities, jurisdictions, or descriptions" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/25" />
                </div>
                <select value={relationshipFilter} onChange={(event) => setRelationshipFilter(event.target.value as CorporateRelationship | "all")} className="min-h-11 rounded-2xl border border-cyan-100/12 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none">
                  <option value="all">All relationships</option>
                  {relationshipOrder.map((relationship) => <option key={relationship} value={relationship}>{relationshipLabels[relationship]}</option>)}
                </select>
                <select value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value as CorporateConfidence | "all")} className="min-h-11 rounded-2xl border border-cyan-100/12 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none">
                  <option value="all">All confidence levels</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="probable">Probable</option>
                  <option value="inferred">Inferred</option>
                </select>
              </div>
            </GlassCard>

            <GlassCard className="mb-6 overflow-hidden p-5 md:p-6">
              <div className="mx-auto max-w-xl rounded-3xl border border-cyan-200/22 bg-cyan-300/10 p-5 text-center shadow-[0_0_40px_rgba(34,211,238,.09)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/40">Research root</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{parent?.name ?? result.companyName}</h2>
                <p className="mt-2 text-xs text-cyan-100/45">Public-source corporate relationship map</p>
              </div>
              <div className="mx-auto h-8 w-px bg-gradient-to-b from-cyan-200/35 to-transparent" />

              {grouped.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-cyan-100/15 bg-black/15 p-8 text-center text-sm text-cyan-100/45">No entities match the current filters.</div>
              ) : (
                <div className="space-y-7">
                  {grouped.map((group) => {
                    const Icon = relationshipIcon(group.relationship);
                    return (
                      <section key={group.relationship}>
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100/12 bg-white/[0.04]"><Icon size={15} className="text-cyan-200/55" /></div>
                          <div>
                            <h3 className="text-sm font-semibold text-cyan-50">{relationshipLabels[group.relationship]}</h3>
                            <p className="text-[11px] text-cyan-100/35">{group.entities.length} public-source result{group.entities.length === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                          {group.entities.map((entity) => (
                            <button
                              key={entity.id}
                              type="button"
                              onClick={() => setSelected(entity)}
                              className="min-h-36 rounded-2xl border border-cyan-100/10 bg-black/20 p-4 text-left transition hover:border-cyan-200/25 hover:bg-cyan-300/[0.07]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="font-semibold leading-5 text-white">{entity.name}</p>
                                <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${confidenceClass(entity.confidence)}`}>{entity.confidence}</span>
                              </div>
                              {entity.jurisdiction && <p className="mt-3 flex items-center gap-2 text-xs text-cyan-100/50"><Globe2 size={13} /> {entity.jurisdiction}</p>}
                              <p className="mt-3 line-clamp-3 text-xs leading-5 text-cyan-100/38">{entity.description || `${entity.evidence.length} evidence record${entity.evidence.length === 1 ? "" : "s"}`}</p>
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Source coverage</h2>
                  <p className="mt-1 text-xs text-cyan-100/40">Every analyzed or failed source remains visible.</p>
                </div>
                <span className="text-xs text-cyan-100/35">Completed {new Date(result.completedAt).toLocaleString()}</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-cyan-100/10 text-[10px] uppercase tracking-[0.18em] text-cyan-100/35">
                    <tr><th className="px-3 py-3">Source</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Note</th><th className="px-3 py-3">Open</th></tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-100/[0.07]">
                    {result.sources.map((source) => (
                      <tr key={`${source.url}-${source.label}`}>
                        <td className="px-3 py-3 font-medium text-white">{source.label}</td>
                        <td className="px-3 py-3 text-cyan-100/50">{source.sourceType}</td>
                        <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] ${source.status === "analyzed" ? "border-emerald-200/20 bg-emerald-300/10 text-emerald-100" : "border-rose-200/20 bg-rose-300/10 text-rose-100"}`}>{source.status === "analyzed" ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}{source.status}</span></td>
                        <td className="max-w-xl px-3 py-3 text-xs leading-5 text-cyan-100/42">{source.note}</td>
                        <td className="px-3 py-3"><a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-200/70 hover:text-cyan-100">Open <ExternalLink size={12} /></a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-5 rounded-2xl border border-amber-200/14 bg-amber-300/[0.06] p-4 text-xs leading-5 text-amber-50/65">{result.limitation}</p>
            </GlassCard>
          </>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-cyan-100/14 bg-[#050d18]/96 p-6 shadow-[-30px_0_90px_rgba(0,0,0,.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/40">{relationshipLabels[selected.relationship]}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selected.name}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/55 hover:text-white"><X size={18} /></button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${confidenceClass(selected.confidence)}`}>{selected.confidence}</span>
              {selected.jurisdiction && <span className="rounded-full border border-cyan-100/12 bg-white/[0.04] px-3 py-1 text-[10px] text-cyan-100/60">{selected.jurisdiction}</span>}
            </div>
            {selected.description && <p className="mt-5 text-sm leading-6 text-cyan-50/65">{selected.description}</p>}
            <div className="mt-7 space-y-4">
              <h3 className="text-sm font-semibold text-cyan-50">Evidence</h3>
              {selected.evidence.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-cyan-100/15 p-4 text-sm text-cyan-100/40">No detailed evidence was attached.</p>
              ) : selected.evidence.map((evidence, index) => (
                <div key={`${evidence.url}-${index}`} className="rounded-2xl border border-cyan-100/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{evidence.label}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/35">{evidence.sourceType}</p>
                    </div>
                    <a href={evidence.url} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-100/12 bg-white/[0.04] p-2 text-cyan-200/65 hover:text-cyan-100"><ExternalLink size={15} /></a>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-cyan-100/52">{evidence.snippet}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
