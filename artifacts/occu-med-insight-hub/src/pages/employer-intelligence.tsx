import { useState, useEffect, type ReactNode } from "react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  normalizeJob,
  resolveEmployer,
  fetchOshaEstablishments,
  fetchBlsBenchmark,
  fetchWorkersCompSources,
  scoreOpportunity,
  fetchSourcesStatus,
  type OshaEstablishment,
  type BlsBenchmark,
  type WorkersCompSource,
  type EntityMatch,
  type JobNormalization,
  type OpportunityScore,
  type SourceStatus,
} from "@/data/employerIntelligenceApi";
import {
  Search, Loader2, AlertTriangle, Info, Building2, Network, Table, TrendingUp,
  Briefcase, MapPin, Grid3x3, ShieldCheck, ChevronRight, Activity, HeartPulse,
  Wind, ListChecks, FileWarning, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";

const DATA_WARNING = "Public injury, illness, workers' compensation, and litigation data may be incomplete, delayed, jurisdiction-specific, or affected by reporting rules. Insight Hub 2.0 uses these sources to identify occupational health service opportunity signals for review. It does not determine legal liability, safety compliance, negligence, or whether an employer is unsafe.";

const ONET_WARNING = "O*NET data provides generalized occupational context and does not replace employer-specific job descriptions or actual worksite information.";

const SCORE_WARNING = "The Occu-Med opportunity score is a business development and research signal, not a safety rating or compliance determination.";

type TabId = "injury" | "resolver" | "osha" | "bls" | "onet" | "workerscomp" | "matrix" | "heatmap" | "sources";

const TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: "injury", label: "Employer Injury Intelligence", icon: Activity },
  { id: "resolver", label: "DBA / Entity Resolver", icon: Network },
  { id: "osha", label: "OSHA Establishment Explorer", icon: Table },
  { id: "bls", label: "BLS Industry Benchmark Lens", icon: TrendingUp },
  { id: "onet", label: "O*NET Occupation Mapping", icon: Briefcase },
  { id: "workerscomp", label: "Workers' Comp Source Coverage", icon: ShieldCheck },
  { id: "matrix", label: "Occu-Med Service Opportunity Matrix", icon: Grid3x3 },
  { id: "heatmap", label: "Geographic Opportunity Heatmap", icon: MapPin },
  { id: "sources", label: "Source Confidence / Data Limitations", icon: FileWarning },
];

export default function EmployerIntelligence() {
  const [activeTab, setActiveTab] = useState<TabId>("injury");

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Intelligence Module"
          title="Employer Injury & Opportunity Intelligence"
          subtitle="Identify companies, DBAs, industries, job families, and geographic areas where Occu-Med may offer occupational health services based on injury/illness signals, OSHA data, BLS benchmarks, O*NET mapping, and service-fit scoring."
        />

        {/* Data Warning */}
        <GlassCard className="mb-5 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/70">{DATA_WARNING}</p>
          </div>
        </GlassCard>

        {/* Tab Navigation */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition duration-300 ${
                  active
                    ? "border-cyan-200/25 bg-cyan-300/14 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,.12)]"
                    : "border-cyan-100/8 bg-white/[0.02] text-cyan-100/50 hover:border-cyan-100/15 hover:bg-white/[0.04] hover:text-cyan-100/80"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "injury" && <InjuryIntelligenceTab />}
        {activeTab === "resolver" && <EntityResolverTab />}
        {activeTab === "osha" && <OshaExplorerTab />}
        {activeTab === "bls" && <BlsBenchmarkTab />}
        {activeTab === "onet" && <OnetMappingTab />}
        {activeTab === "workerscomp" && <WorkersCompTab />}
        {activeTab === "matrix" && <ServiceMatrixTab />}
        {activeTab === "heatmap" && <HeatmapTab />}
        {activeTab === "sources" && <SourcesStatusTab />}

        {/* Footer Attribution */}
        <footer className="mt-10 border-t border-cyan-100/10 pt-4">
          <p className="text-[10px] leading-5 text-cyan-100/35">
            This application incorporates information from O*NET Web Services by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). O*NET® is a trademark of USDOL/ETA. Additional data from OSHA, BLS, SAM.gov, SEC EDGAR, CourtListener, USAspending, CDC/NIOSH, CMS, and HRSA.
          </p>
        </footer>
      </section>
    </main>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function LoadingCard({ message }: { message: string }) {
  return (
    <GlassCard className="p-8 text-center">
      <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-300/60" />
      <p className="mt-3 text-xs text-cyan-100/50">{message}</p>
    </GlassCard>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <GlassCard className="border-rose-400/20 p-4">
      <div className="flex items-start gap-3 text-rose-200">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Error</p>
          <p className="mt-1 text-xs leading-5 text-rose-200/70">{message}</p>
        </div>
      </div>
    </GlassCard>
  );
}

function EmptyCard({ message, hint }: { message: string; hint?: string }) {
  return (
    <GlassCard className="p-10 text-center">
      <Info className="mx-auto h-8 w-8 text-cyan-100/20" />
      <p className="mt-3 text-sm text-cyan-100/40">{message}</p>
      {hint && <p className="mt-2 text-xs text-cyan-100/25">{hint}</p>}
    </GlassCard>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence > 0.7 ? "emerald" : confidence > 0.4 ? "amber" : "rose";
  const label = confidence > 0.7 ? "High" : confidence > 0.4 ? "Moderate" : "Low";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
      color === "emerald" ? "bg-emerald-400/15 text-emerald-200" :
      color === "amber" ? "bg-amber-400/15 text-amber-200" :
      "bg-rose-400/15 text-rose-200"
    }`}>
      {label} ({(confidence * 100).toFixed(0)}%)
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 60 ? "emerald" : score >= 35 ? "amber" : score >= 15 ? "cyan" : "rose";
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-black ${
      color === "emerald" ? "bg-emerald-400/15 text-emerald-200" :
      color === "amber" ? "bg-amber-400/15 text-amber-200" :
      color === "cyan" ? "bg-cyan-400/15 text-cyan-200" :
      "bg-rose-400/15 text-rose-200"
    }`}>
      {score}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/45">{children}</p>;
}

function SourceChip({ label, configured }: { label: string; configured: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
      configured ? "bg-emerald-400/10 text-emerald-200/80" : "bg-rose-400/10 text-rose-200/60"
    }`}>
      {configured ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {label}
    </span>
  );
}

// ─── Tab 1: Employer Injury Intelligence ─────────────────────────────────────

function InjuryIntelligenceTab() {
  const [companyName, setCompanyName] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oshaRecords, setOshaRecords] = useState<OshaEstablishment[]>([]);
  const [blsBenchmark, setBlsBenchmark] = useState<BlsBenchmark | null>(null);
  const [entityMatch, setEntityMatch] = useState<EntityMatch | null>(null);
  const [opportunityScore, setOpportunityScore] = useState<OpportunityScore | null>(null);
  const [scoring, setScoring] = useState(false);

  async function handleSearch() {
    const query = companyName.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    setOshaRecords([]);
    setBlsBenchmark(null);
    setEntityMatch(null);
    setOpportunityScore(null);
    try {
      const entityResult = await resolveEmployer({ companyName: query, state: state.trim() || undefined });
      if (entityResult.ok && entityResult.entity) {
        setEntityMatch(entityResult.entity);
      }

      const oshaResult = await fetchOshaEstablishments({ company: query, state: state.trim() || undefined });
      if (oshaResult.ok) {
        setOshaRecords(oshaResult.records);
      }

      const naics = entityResult.entity?.naicsCodes?.[0];
      if (naics) {
        const blsResult = await fetchBlsBenchmark({ naics });
        if (blsResult.ok && blsResult.benchmark) {
          setBlsBenchmark(blsResult.benchmark);
        }
      }

      setScoring(true);
      const scoreResult = await scoreOpportunity({
        companyName: query,
        oshaEstablishments: oshaResult.ok ? oshaResult.records : [],
        blsBenchmark,
        entityConfidence: entityResult.entity?.confidence,
        locationContext: state.trim() || undefined,
      });
      if (scoreResult.ok) {
        setOpportunityScore(scoreResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
      setScoring(false);
    }
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <SectionLabel>Employer search</SectionLabel>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Company name or DBA..."
            className="min-h-12 flex-1 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35"
          />
          <input
            value={state}
            onChange={(e) => setState(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="State (optional)..."
            className="min-h-12 w-full rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35 md:w-40"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !companyName.trim()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/15 bg-cyan-200/12 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search size={16} />}
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </GlassCard>

      {error && <ErrorCard message={error} />}
      {loading && <LoadingCard message="Resolving entity, fetching OSHA records, BLS benchmarks, and scoring opportunity..." />}

      {!loading && entityMatch && (
        <GlassCard className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <SectionLabel>Entity Resolution</SectionLabel>
              <h2 className="mt-1 text-xl font-black text-white">{entityMatch.canonicalName}</h2>
              {entityMatch.aliases.length > 1 && (
                <p className="mt-1 text-xs text-cyan-100/50">Aliases: {entityMatch.aliases.join(", ")}</p>
              )}
              {entityMatch.dbaNames.length > 0 && (
                <p className="mt-1 text-xs text-cyan-100/50">DBAs: {entityMatch.dbaNames.join(", ")}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <ConfidenceBadge confidence={entityMatch.confidence} />
              <span className="text-xs text-cyan-100/40">{entityMatch.matchType} match</span>
            </div>
          </div>
          {entityMatch.evidenceFields.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {entityMatch.evidenceFields.map((field, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-cyan-100/60">
                  <ChevronRight size={12} className="mt-0.5 shrink-0 text-cyan-300/40" />
                  {field}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {!loading && oshaRecords.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>OSHA Establishment Records ({oshaRecords.length})</SectionLabel>
          {oshaRecords.map((rec, i) => (
            <GlassCard key={i} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{rec.establishmentName}</h3>
                  <p className="text-xs text-cyan-100/45">{rec.address}, {rec.city}, {rec.state} {rec.zip}</p>
                  <p className="mt-1 text-xs text-cyan-100/40">NAICS: {rec.naics} | Year: {rec.year}</p>
                </div>
                <div className="flex gap-2">
                  {rec.trcRate !== undefined && (
                    <div className="rounded-lg border border-cyan-100/10 bg-white/[0.02] px-3 py-1.5 text-center">
                      <p className="text-[9px] uppercase text-cyan-100/40">TRC Rate</p>
                      <p className="text-sm font-bold text-cyan-50">{rec.trcRate}</p>
                    </div>
                  )}
                  {rec.dartRate !== undefined && (
                    <div className="rounded-lg border border-cyan-100/10 bg-white/[0.02] px-3 py-1.5 text-center">
                      <p className="text-[9px] uppercase text-cyan-100/40">DART Rate</p>
                      <p className="text-sm font-bold text-cyan-50">{rec.dartRate}</p>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {!loading && oshaRecords.length === 0 && entityMatch && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-cyan-100/40" />
            <p className="text-xs text-cyan-100/50">No OSHA establishment records found. OSHA ITA import may not be enabled or no data matches this employer.</p>
          </div>
        </GlassCard>
      )}

      {!loading && blsBenchmark && (
        <GlassCard className="p-5">
          <SectionLabel>BLS Industry Benchmark</SectionLabel>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{blsBenchmark.industryTitle}</p>
              <p className="text-xs text-cyan-100/45">NAICS {blsBenchmark.naics} | {blsBenchmark.year}</p>
            </div>
            {blsBenchmark.trcRate !== undefined && (
              <div className="rounded-lg border border-cyan-100/10 bg-white/[0.02] px-4 py-2 text-center">
                <p className="text-[9px] uppercase text-cyan-100/40">Benchmark TRC</p>
                <p className="text-lg font-black text-cyan-50">{blsBenchmark.trcRate}</p>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {scoring && <LoadingCard message="Calculating service opportunity score..." />}

      {!loading && !scoring && opportunityScore && (
        <GlassCard className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <SectionLabel>Occu-Med Service Opportunity Score</SectionLabel>
              <div className="mt-2 flex items-center gap-3">
                <ScoreBadge score={opportunityScore.score} />
                <span className="text-sm font-bold text-white">{opportunityScore.label}</span>
              </div>
              <p className="mt-2 text-xs text-cyan-100/50">Source confidence: {(opportunityScore.sourceConfidence * 100).toFixed(0)}%</p>
            </div>
          </div>
          {opportunityScore.topFactors.length > 0 && (
            <div className="mt-5">
              <SectionLabel>Top Contributing Factors</SectionLabel>
              <div className="mt-2 space-y-1.5">
                {opportunityScore.topFactors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-cyan-100/65">{f.factor}</span>
                    <span className="font-bold text-cyan-300/70">+{f.contribution}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {opportunityScore.matchedServices.length > 0 && (
            <div className="mt-5">
              <SectionLabel>Matched Occu-Med Services</SectionLabel>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {opportunityScore.matchedServices.map((s, i) => (
                  <div key={i} className="rounded-lg border border-emerald-100/10 bg-emerald-950/10 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-cyan-50">{s.service}</p>
                      <span className="text-xs font-bold text-emerald-300/70">{s.fitScore}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-cyan-100/40">{s.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {opportunityScore.missingData.length > 0 && (
            <div className="mt-5">
              <SectionLabel>Missing Data</SectionLabel>
              <div className="mt-2 space-y-1">
                {opportunityScore.missingData.map((d, i) => (
                  <p key={i} className="text-xs text-amber-200/50">{d}</p>
                ))}
              </div>
            </div>
          )}
          <div className="mt-5 rounded-lg border border-amber-100/10 bg-amber-950/10 px-3 py-2">
            <p className="text-xs text-amber-100/60">{SCORE_WARNING}</p>
          </div>
        </GlassCard>
      )}

      {!loading && !error && !entityMatch && !opportunityScore && (
        <EmptyCard message="Enter a company name to begin injury intelligence analysis." hint="Try: Acme Construction, Global Logistics Inc, Delta Manufacturing..." />
      )}
    </div>
  );
}

// ─── Tab 2: DBA / Entity Resolver ────────────────────────────────────────────

function EntityResolverTab() {
  const [companyName, setCompanyName] = useState("");
  const [dbaInput, setDbaInput] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<EntityMatch | null>(null);

  async function handleResolve() {
    if (!companyName.trim()) return;
    setLoading(true);
    setError(null);
    setEntity(null);
    try {
      const dbaNames = dbaInput.trim() ? dbaInput.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      const result = await resolveEmployer({
        companyName: companyName.trim(),
        dbaNames,
        state: state.trim() || undefined,
      });
      if (result.ok) {
        setEntity(result.entity);
      } else {
        setError(result.error || "Entity resolution failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolution failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <SectionLabel>Entity / DBA Resolver</SectionLabel>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleResolve()}
            placeholder="Legal company name..."
            className="min-h-12 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35"
          />
          <input
            value={dbaInput}
            onChange={(e) => setDbaInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleResolve()}
            placeholder="DBA names (comma-separated)..."
            className="min-h-12 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35"
          />
          <input
            value={state}
            onChange={(e) => setState(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleResolve()}
            placeholder="State (optional)..."
            className="min-h-12 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35"
          />
          <button
            onClick={handleResolve}
            disabled={loading || !companyName.trim()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/15 bg-cyan-200/12 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network size={16} />}
            {loading ? "Resolving..." : "Resolve Entity"}
          </button>
        </div>
      </GlassCard>

      {error && <ErrorCard message={error} />}
      {loading && <LoadingCard message="Resolving entity across SAM.gov, SEC EDGAR, OSHA, CourtListener..." />}

      {!loading && entity && (
        <div className="space-y-4">
          <GlassCard className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <SectionLabel>Canonical Entity</SectionLabel>
                <h2 className="mt-1 text-2xl font-black text-white">{entity.canonicalName}</h2>
              </div>
              <div className="flex flex-col items-end gap-2">
                <ConfidenceBadge confidence={entity.confidence} />
                <span className="rounded-full bg-cyan-100/10 px-2.5 py-1 text-xs font-semibold text-cyan-100/60">{entity.matchType}</span>
              </div>
            </div>

            {/* Relationship Graph Visualization */}
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="rounded-2xl border border-cyan-200/25 bg-cyan-300/12 px-6 py-3 text-center shadow-[0_0_30px_rgba(34,211,238,.15)]">
                <Building2 className="mx-auto h-5 w-5 text-cyan-300" />
                <p className="mt-1 text-sm font-bold text-white">{entity.canonicalName}</p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {entity.dbaNames.map((dba, i) => (
                  <div key={`dba-${i}`} className="rounded-xl border border-violet-100/15 bg-violet-950/15 px-3 py-2 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-violet-300/50">DBA</p>
                    <p className="text-xs font-semibold text-cyan-50">{dba}</p>
                  </div>
                ))}
                {entity.subsidiaryNames.map((sub, i) => (
                  <div key={`sub-${i}`} className="rounded-xl border border-sky-100/15 bg-sky-950/15 px-3 py-2 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-sky-300/50">Subsidiary</p>
                    <p className="text-xs font-semibold text-cyan-50">{sub}</p>
                  </div>
                ))}
                {entity.legacyNames.map((leg, i) => (
                  <div key={`leg-${i}`} className="rounded-xl border border-amber-100/15 bg-amber-950/15 px-3 py-2 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-amber-300/50">Legacy / Former</p>
                    <p className="text-xs font-semibold text-cyan-50">{leg}</p>
                  </div>
                ))}
                {entity.aliases.filter(a => a !== entity.canonicalName && !entity.dbaNames.includes(a)).map((alias, i) => (
                  <div key={`alias-${i}`} className="rounded-xl border border-cyan-100/10 bg-white/[0.02] px-3 py-2 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-cyan-100/40">Alias</p>
                    <p className="text-xs font-semibold text-cyan-50">{alias}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionLabel>Entity Identifiers</SectionLabel>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {entity.cage && <IdentifierChip label="CAGE" value={entity.cage} />}
              {entity.uei && <IdentifierChip label="UEI" value={entity.uei} />}
              {entity.cik && <IdentifierChip label="SEC CIK" value={entity.cik} />}
              {entity.ticker && <IdentifierChip label="Ticker" value={entity.ticker} />}
              {entity.naicsCodes && entity.naicsCodes.map((n, i) => (
                <IdentifierChip key={i} label="NAICS" value={n} />
              ))}
              {entity.address && <IdentifierChip label="Address" value={entity.address} />}
            </div>
          </GlassCard>

          {entity.evidenceFields.length > 0 && (
            <GlassCard className="p-5">
              <SectionLabel>Source Evidence</SectionLabel>
              <div className="mt-3 space-y-2">
                {entity.evidenceFields.map((field, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-cyan-100/8 bg-white/[0.02] px-3 py-2 text-xs text-cyan-100/65">
                    <ChevronRight size={12} className="mt-0.5 shrink-0 text-cyan-300/40" />
                    {field}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {entity.matchedEstablishments && entity.matchedEstablishments.length > 0 && (
            <GlassCard className="p-5">
              <SectionLabel>Matched Establishments ({entity.matchedEstablishments.length})</SectionLabel>
              <div className="mt-3 space-y-2">
                {entity.matchedEstablishments.map((est, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-emerald-100/10 bg-emerald-950/10 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-cyan-50">{est.name}</p>
                      <p className="text-xs text-cyan-100/40">{est.address}</p>
                    </div>
                    <span className="text-xs text-emerald-300/60">{est.source}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {entity.unmatchedEstablishments && entity.unmatchedEstablishments.length > 0 && (
            <GlassCard className="p-5">
              <SectionLabel>Possible Establishments (Require Review)</SectionLabel>
              <div className="mt-3 space-y-2">
                {entity.unmatchedEstablishments.map((est, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-amber-100/10 bg-amber-950/10 px-3 py-2">
                    <p className="text-sm text-cyan-50">{est.name}</p>
                    <span className="text-xs text-amber-300/60">{est.source}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {entity.warnings.length > 0 && (
            <GlassCard className="border-amber-200/15 p-4">
              {entity.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-200/70">{w}</p>
              ))}
            </GlassCard>
          )}
        </div>
      )}

      {!loading && !error && !entity && (
        <EmptyCard message="Enter a company name to resolve entities, DBAs, and aliases across SAM.gov, SEC, and OSHA." />
      )}
    </div>
  );
}

function IdentifierChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-cyan-100/10 bg-white/[0.02] px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-cyan-100/40">{label}</p>
      <p className="text-sm font-semibold text-cyan-50">{value}</p>
    </div>
  );
}

// ─── Tab 3: OSHA Establishment Explorer ──────────────────────────────────────

function OshaExplorerTab() {
  const [company, setCompany] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [naicsFilter, setNaicsFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<OshaEstablishment[]>([]);
  const [importEnabled, setImportEnabled] = useState(false);
  const [warning, setWarning] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const result = await fetchOshaEstablishments({
        company: company.trim() || undefined,
        state: stateFilter.trim() || undefined,
        naics: naicsFilter.trim() || undefined,
        year: yearFilter.trim() || undefined,
      });
      if (result.ok) {
        setRecords(result.records);
        setImportEnabled(result.importEnabled);
        setWarning(result.warning);
      } else {
        setError(result.error || "OSHA query failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "OSHA query failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <SectionLabel>OSHA Establishment Explorer</SectionLabel>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Company..." className="min-h-12 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35" />
          <input value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="State..." className="min-h-12 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35" />
          <input value={naicsFilter} onChange={(e) => setNaicsFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="NAICS..." className="min-h-12 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35" />
          <input value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Year..." className="min-h-12 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35" />
        </div>
        <button onClick={handleSearch} disabled={loading} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-100/15 bg-cyan-200/12 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search size={16} />}
          {loading ? "Searching..." : "Search OSHA Records"}
        </button>
      </GlassCard>

      {error && <ErrorCard message={error} />}
      {loading && <LoadingCard message="Querying OSHA establishment data..." />}

      {!loading && searched && !importEnabled && (
        <GlassCard className="border-amber-200/15 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-amber-200">OSHA ITA Import Not Enabled</p>
              <p className="mt-1 text-xs text-amber-100/60">Set OSHA_ITA_IMPORT_ENABLED=true on the server to enable cached OSHA establishment-level injury/illness data.</p>
            </div>
          </div>
        </GlassCard>
      )}

      {!loading && records.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>OSHA Records ({records.length})</SectionLabel>
          {records.map((rec, i) => (
            <GlassCard key={i} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{rec.establishmentName}</h3>
                  <p className="text-xs text-cyan-100/45">{rec.address}, {rec.city}, {rec.state} {rec.zip}</p>
                  <p className="mt-1 text-xs text-cyan-100/40">NAICS: {rec.naics} | Year: {rec.year} | Dataset: {rec.datasetName}</p>
                  {rec.totalCases !== undefined && <p className="mt-1 text-xs text-cyan-100/40">Total Cases: {rec.totalCases} | DART: {rec.dartCases ?? "N/A"} | Days Away: {rec.daysAwayCases ?? "N/A"}</p>}
                </div>
                <div className="flex gap-2">
                  {rec.trcRate !== undefined && <MetricChip label="TRC" value={String(rec.trcRate)} />}
                  {rec.dartRate !== undefined && <MetricChip label="DART" value={String(rec.dartRate)} />}
                  {rec.daysAwayRate !== undefined && <MetricChip label="Days Away" value={String(rec.daysAwayRate)} />}
                </div>
              </div>
              {rec.sourceUrl && (
                <a href={rec.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300/60 hover:text-cyan-200">
                  <ExternalLink size={11} /> Source
                </a>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {!loading && searched && records.length === 0 && importEnabled && (
        <EmptyCard message="No OSHA establishment records found matching your filters." />
      )}

      {!loading && searched && warning && (
        <GlassCard className="border-amber-200/10 p-3">
          <p className="text-xs text-amber-100/50">{warning}</p>
        </GlassCard>
      )}

      {!loading && !searched && !error && (
        <EmptyCard message="Search OSHA establishment-level injury and illness records." hint="Filter by company, state, NAICS, or year. OSHA ITA import must be enabled on the server." />
      )}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-cyan-100/10 bg-white/[0.02] px-3 py-1.5 text-center">
      <p className="text-[9px] uppercase text-cyan-100/40">{label}</p>
      <p className="text-sm font-bold text-cyan-50">{value}</p>
    </div>
  );
}

// ─── Tab 4: BLS Industry Benchmark Lens ──────────────────────────────────────

function BlsBenchmarkTab() {
  const [naics, setNaics] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState<BlsBenchmark | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!naics.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setBenchmark(null);
    setMessage(null);
    try {
      const result = await fetchBlsBenchmark({ naics: naics.trim(), year: year.trim() || undefined });
      if (result.ok) {
        setBenchmark(result.benchmark);
        setMessage(result.message || null);
        setConfigured(result.configured ?? true);
      } else {
        setError(result.error || "BLS query failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "BLS query failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <SectionLabel>BLS Industry Benchmark Lookup</SectionLabel>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input value={naics} onChange={(e) => setNaics(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="NAICS code (e.g., 238100)..." className="min-h-12 flex-1 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35" />
          <input value={year} onChange={(e) => setYear(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Year (optional)..." className="min-h-12 w-full rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35 md:w-40" />
          <button onClick={handleSearch} disabled={loading || !naics.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/15 bg-cyan-200/12 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp size={16} />}
            {loading ? "Fetching..." : "Get Benchmark"}
          </button>
        </div>
      </GlassCard>

      {error && <ErrorCard message={error} />}
      {loading && <LoadingCard message="Fetching BLS industry benchmark data..." />}

      {!loading && searched && !configured && (
        <GlassCard className="border-amber-200/15 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-amber-200">BLS Not Configured</p>
              <p className="mt-1 text-xs text-amber-100/60">Set BLS_API_KEY or enable BLS_IMPORT_ENABLED on the server to fetch industry benchmark data.</p>
            </div>
          </div>
        </GlassCard>
      )}

      {!loading && benchmark && (
        <GlassCard className="p-6">
          <SectionLabel>BLS IIF Benchmark</SectionLabel>
          <h2 className="mt-2 text-xl font-black text-white">{benchmark.industryTitle}</h2>
          <p className="text-xs text-cyan-100/45">NAICS {benchmark.naics} | Year {benchmark.year}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {benchmark.trcRate !== undefined && <MetricChip label="TRC Rate" value={String(benchmark.trcRate)} />}
            {benchmark.dartRate !== undefined && <MetricChip label="DART Rate" value={String(benchmark.dartRate)} />}
            {benchmark.daysAwayRate !== undefined && <MetricChip label="Days Away Rate" value={String(benchmark.daysAwayRate)} />}
            {benchmark.fatalityRate !== undefined && <MetricChip label="Fatality Rate" value={String(benchmark.fatalityRate)} />}
          </div>

          <div className="mt-5">
            <p className="text-xs text-cyan-100/40">{benchmark.sourceMetadata}</p>
            <a href={benchmark.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300/60 hover:text-cyan-200">
              <ExternalLink size={11} /> BLS IIF Source
            </a>
          </div>
        </GlassCard>
      )}

      {!loading && searched && !benchmark && message && (
        <EmptyCard message={message} />
      )}

      {!loading && !searched && !error && (
        <EmptyCard message="Enter a NAICS code to fetch BLS industry injury/illness benchmark rates." hint="Try: 238100 (Construction), 484000 (Transportation), 561000 (Administrative Support)..." />
      )}
    </div>
  );
}

// ─── Tab 5: O*NET Occupation Mapping ─────────────────────────────────────────

function OnetMappingTab() {
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JobNormalization | null>(null);

  async function handleNormalize() {
    if (!jobTitle.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await normalizeJob({ jobTitle: jobTitle.trim() });
      if (data.ok) {
        setResult(data);
      } else {
        setError(data.error || "Normalization failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Normalization failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <SectionLabel>Job Title Normalizer</SectionLabel>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleNormalize()} placeholder="Enter a job title (e.g., Material Handler, Warehouse Associate)..." className="min-h-12 flex-1 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35" />
          <button onClick={handleNormalize} disabled={loading || !jobTitle.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/15 bg-cyan-200/12 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase size={16} />}
            {loading ? "Normalizing..." : "Normalize"}
          </button>
        </div>
        <p className="mt-3 text-xs text-cyan-100/40">{ONET_WARNING}</p>
      </GlassCard>

      {error && <ErrorCard message={error} />}
      {loading && <LoadingCard message="Normalizing job title via O*NET Web Services..." />}

      {!loading && result && (
        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <SectionLabel>Normalized Occupation</SectionLabel>
                <h2 className="mt-1 text-xl font-black text-white">{result.occupationMatches[0]?.title || "No match"}</h2>
                {result.socCode && <p className="text-xs text-cyan-100/45">SOC: {result.socCode}</p>}
                {result.occupationFamily && <p className="mt-1 text-xs text-cyan-100/50">Family: {result.occupationFamily}</p>}
              </div>
              <ConfidenceBadge confidence={result.confidence} />
            </div>
          </GlassCard>

          {result.occupationMatches.length > 1 && (
            <GlassCard className="p-5">
              <SectionLabel>All Occupation Matches</SectionLabel>
              <div className="mt-3 space-y-2">
                {result.occupationMatches.map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-cyan-100/8 bg-white/[0.02] px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-cyan-50">{m.title}</p>
                      <p className="text-xs text-cyan-100/40">{m.code}</p>
                    </div>
                    {m.score !== undefined && <span className="text-xs text-cyan-300/60">{m.score}%</span>}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {result.physicalDemandIndicators.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-rose-300" />
                <SectionLabel>Physical Demand Indicators</SectionLabel>
              </div>
              <ul className="mt-3 space-y-1.5">
                {result.physicalDemandIndicators.map((ind, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-cyan-100/65">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    {ind}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {result.environmentalIndicators.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-sky-300" />
                <SectionLabel>Environmental Indicators</SectionLabel>
              </div>
              <ul className="mt-3 space-y-1.5">
                {result.environmentalIndicators.map((ind, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-cyan-100/65">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    {ind}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {result.safetySensitiveIndicators.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-300" />
                <SectionLabel>Safety-Sensitive Indicators</SectionLabel>
              </div>
              <ul className="mt-3 space-y-1.5">
                {result.safetySensitiveIndicators.map((ind, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-cyan-100/65">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {ind}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {result.serviceRelevanceTags.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-emerald-300" />
                <SectionLabel>Service Relevance Tags</SectionLabel>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.serviceRelevanceTags.map((tag, i) => (
                  <span key={i} className="rounded-full border border-emerald-100/15 bg-emerald-950/15 px-3 py-1 text-xs font-semibold text-emerald-200/80">
                    {tag}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {!loading && !error && !result && (
        <EmptyCard message="Enter a job title to normalize it to O*NET occupations and extract demand indicators." hint="Try: Material Handler, Bus Driver, Heavy Equipment Operator, Registered Nurse..." />
      )}
    </div>
  );
}

// ─── Tab 6: Workers' Comp Source Coverage ────────────────────────────────────

function WorkersCompTab() {
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<WorkersCompSource | null>(null);

  async function handleSearch() {
    if (!state.trim()) return;
    setLoading(true);
    setError(null);
    setSource(null);
    try {
      const result = await fetchWorkersCompSources(state.trim());
      if (result.ok) {
        setSource(result);
      } else {
        setError(result.error || "Query failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <SectionLabel>Workers' Compensation Source Coverage</SectionLabel>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input value={state} onChange={(e) => setState(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="State abbreviation (e.g., CA, TX, NY)..." className="min-h-12 flex-1 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35" />
          <button onClick={handleSearch} disabled={loading || !state.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/15 bg-cyan-200/12 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck size={16} />}
            {loading ? "Checking..." : "Check Coverage"}
          </button>
        </div>
      </GlassCard>

      {error && <ErrorCard message={error} />}
      {loading && <LoadingCard message="Checking workers' compensation source availability..." />}

      {!loading && source && (
        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <SectionLabel>{source.state} Workers' Comp Sources</SectionLabel>
                <div className="mt-2 flex gap-2">
                  {source.claimLevel && <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-200">Claim-Level Data</span>}
                  {source.aggregate && <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-xs font-bold text-cyan-200">Aggregate Data</span>}
                  {source.unavailable && <span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-xs font-bold text-rose-200">No Sources Indexed</span>}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-cyan-100/55">{source.coverageNotes}</p>
          </GlassCard>

          {source.availableDatasets.length > 0 && (
            <GlassCard className="p-5">
              <SectionLabel>Available Datasets</SectionLabel>
              <div className="mt-3 space-y-2">
                {source.availableDatasets.map((ds, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-cyan-100/8 bg-white/[0.02] px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-cyan-50">{ds.name}</p>
                      <p className="text-xs text-cyan-100/40">Type: {ds.type}</p>
                    </div>
                    <a href={ds.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-300/60 hover:text-cyan-200">
                      <ExternalLink size={11} /> Visit
                    </a>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          <GlassCard className="border-amber-200/10 p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-xs text-amber-100/60">{source.dataLimitations}</p>
            </div>
          </GlassCard>
        </div>
      )}

      {!loading && !error && !source && (
        <EmptyCard message="Enter a state abbreviation to check workers' compensation data source availability." hint="Try: CA, TX, NY, FL, WA, OH..." />
      )}
    </div>
  );
}

// ─── Tab 7: Occu-Med Service Opportunity Matrix ──────────────────────────────

const SERVICE_MATRIX: { signal: string; services: string[]; description: string }[] = [
  { signal: "High DART / Musculoskeletal", services: ["Fitness-for-Duty", "Return-to-Work", "Functional Capacity", "Physical Exams"], description: "Elevated DART rates with lifting/material handling indicators" },
  { signal: "Respiratory Exposure", services: ["Respirator Clearance", "PFT/Spirometry", "OSHA Medical Surveillance"], description: "Contaminant, chemical, fume, or dust exposure context" },
  { signal: "Noise / Hearing Exposure", services: ["Audiograms", "Hearing Conservation"], description: "Noisy work environments or auditory safety requirements" },
  { signal: "Driving / Transportation", services: ["DOT/FMCSA Exams", "Drug Screens", "Sleep Apnea Screening"], description: "Vehicle operation, trucking, or transportation roles" },
  { signal: "Heat / Outdoor Labor", services: ["Heat Stress Surveillance", "Annual Exams", "Medical Monitoring"], description: "Outdoor work, heat exposure, weather-dependent operations" },
  { signal: "Hazardous Material Exposure", services: ["Occupational Medical Surveillance", "Labs", "Respirator Evaluations"], description: "Hazardous equipment, PPE requirements, chemical exposure" },
  { signal: "Security / Emergency Roles", services: ["Fitness-for-Duty", "Readiness Exams", "Physical/Cardio Review"], description: "Protective service, emergency response, safety-critical roles" },
  { signal: "Overseas / Deployment / Remote", services: ["Deployment Exams", "Vaccines", "Labs", "Medical Readiness"], description: "Remote, austere, or overseas work environments" },
  { signal: "Geographic Gap / Low Provider Density", services: ["Network Expansion", "Mobile Services", "Telehealth"], description: "Underserved areas with limited occupational health access" },
];

function ServiceMatrixTab() {
  return (
    <div className="space-y-5">
      <GlassCard className="border-amber-200/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <p className="text-xs text-amber-100/60">{SCORE_WARNING}</p>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <SectionLabel>Occu-Med Service Opportunity Matrix</SectionLabel>
        <p className="mt-2 text-xs text-cyan-100/50">Injury/exposure signals mapped to recommended Occu-Med services. Use this matrix to identify service-fit opportunities from O*NET and OSHA indicators.</p>

        <div className="mt-5 space-y-3">
          {SERVICE_MATRIX.map((row, i) => (
            <div key={i} className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="lg:w-1/3">
                  <p className="text-sm font-bold text-white">{row.signal}</p>
                  <p className="mt-1 text-xs text-cyan-100/40">{row.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:w-2/3">
                  {row.services.map((svc, j) => (
                    <span key={j} className="rounded-lg border border-emerald-100/12 bg-emerald-950/12 px-3 py-1.5 text-xs font-semibold text-emerald-200/80">
                      {svc}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Tab 8: Geographic Opportunity Heatmap ───────────────────────────────────

function HeatmapTab() {
  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <SectionLabel>Geographic Opportunity Heatmap</SectionLabel>
        <p className="mt-2 text-xs text-cyan-100/50">
          Visualizes employer establishments, injury signal density, provider/service feasibility, workers' comp source coverage, and Occu-Med opportunity signal by area.
        </p>

        <div className="mt-6 rounded-2xl border border-cyan-100/10 bg-[#07111d] p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-cyan-300/30" />
          <p className="mt-3 text-sm text-cyan-100/40">Geographic heatmap requires OSHA establishment data and provider density data.</p>
          <p className="mt-2 text-xs text-cyan-100/30">Enable OSHA_ITA_IMPORT_ENABLED and configure CMS_DATA_API_KEY / HRSA_API_KEY for full geographic intelligence.</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-cyan-100/40">Employer Establishments</p>
            <p className="mt-1 text-2xl font-black text-cyan-50">--</p>
            <p className="text-xs text-cyan-100/30">From OSHA ITA</p>
          </div>
          <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-cyan-100/40">Provider Density</p>
            <p className="mt-1 text-2xl font-black text-cyan-50">--</p>
            <p className="text-xs text-cyan-100/30">From CMS / HRSA</p>
          </div>
          <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-cyan-100/40">Workers' Comp Coverage</p>
            <p className="mt-1 text-2xl font-black text-cyan-50">--</p>
            <p className="text-xs text-cyan-100/30">State-by-state index</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="border-amber-200/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <p className="text-xs text-amber-100/60">{DATA_WARNING}</p>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Tab 9: Source Confidence / Data Limitations ─────────────────────────────

function SourcesStatusTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceStatus[]>([]);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSourcesStatus();
      if (result.ok) {
        setSources(result.sources);
      } else {
        setError(result.error || "Failed to fetch source status");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch source status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>Source Configuration & Health</SectionLabel>
            <p className="mt-2 text-xs text-cyan-100/50">Real-time status of all external data source connectors. Missing keys result in graceful degradation, not crashes.</p>
          </div>
          <button onClick={loadStatus} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-100/15 bg-cyan-200/10 px-4 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity size={14} />}
            Refresh
          </button>
        </div>
      </GlassCard>

      {error && <ErrorCard message={error} />}
      {loading && <LoadingCard message="Checking source configuration..." />}

      {!loading && sources.length > 0 && (
        <div className="space-y-3">
          {sources.map((src, i) => (
            <GlassCard key={i} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SourceChip label={src.source} configured={src.configured && src.enabled} />
                  <div>
                    <p className="text-sm font-semibold text-cyan-50">{src.source}</p>
                    <p className="text-xs text-cyan-100/40">{src.notes}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {src.configured ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-200/70">
                      <CheckCircle2 size={14} /> Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-rose-200/60">
                      <XCircle size={14} /> Not Configured
                    </span>
                  )}
                  {src.enabled ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-200/70">
                      <CheckCircle2 size={14} /> Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-200/60">
                      <XCircle size={14} /> Disabled
                    </span>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {!loading && !error && sources.length === 0 && (
        <EmptyCard message="Click refresh to check source configuration status." />
      )}
    </div>
  );
}
