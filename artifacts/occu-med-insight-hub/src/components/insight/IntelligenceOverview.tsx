import { useState } from "react";
import { GlassCard } from "@/components/insight/GlassCard";
import type { CompanyIntelligence, IngestDiagnostics, SourceDiagnostic } from "@/data/types";
import { intelligenceSummary, intelligenceFactsByCategory } from "@/data/intelligenceCharts";
import { topSignal, suggestedAction } from "@/data/intelligenceActions";
import { ingestCompanyIntelligence } from "@/data/intelligenceApi";

interface OverviewProps {
  companyName: string;
  companyId: string;
  intelligence: CompanyIntelligence | undefined;
  onIngestComplete: (intelligence: CompanyIntelligence) => void;
}

export function IntelligenceOverview({ companyName, companyId, intelligence, onIngestComplete }: OverviewProps) {
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestDiagnostics, setIngestDiagnostics] = useState<IngestDiagnostics | null>(null);
  const summary = intelligenceSummary(intelligence);
  const facts = intelligence?.facts ?? [];
  const liveFacts = facts.filter((f) => f.confidence !== "link-only");
  const sourceLeads = facts.filter((f) => f.confidence === "link-only");
  const byCategory = intelligenceFactsByCategory(liveFacts);
  const top = topSignal(liveFacts);
  const lastRun = intelligence?.runs[0];
  const hasLive = liveFacts.length > 0;
  const connected = summary.totalFacts > 0;

  const handleIngest = async () => {
    setIngesting(true);
    setIngestError(null);
    setIngestDiagnostics(null);
    try {
      const result = await ingestCompanyIntelligence(companyId, companyName);
      if (result.ok && result.facts && result.chartReady) {
        onIngestComplete({
          companyId,
          facts: result.facts,
          runs: intelligence?.runs ?? [],
          chartReady: result.chartReady,
          diagnostics: result.diagnostics
            ? { liveFacts: result.diagnostics.liveFactsInserted, sourceLeads: result.diagnostics.sourceLeadsInserted, total: result.diagnostics.totalInserted }
            : undefined,
        });
        if (result.diagnostics) {
          setIngestDiagnostics(result.diagnostics);
        }
        if (result.errors && result.errors.length > 0) {
          setIngestError(result.errors.join("; "));
        }
      } else if (!result.ok) {
        setIngestError(result.error ?? "Ingestion failed");
      }
    } catch (e) {
      setIngestError(e instanceof Error ? e.message : "Ingestion request failed");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="mb-5 space-y-4">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${hasLive ? "bg-emerald-400/15" : connected ? "bg-amber-400/15" : "bg-cyan-100/10"}`}>
              <span className={`text-lg ${hasLive ? "text-emerald-300" : connected ? "text-amber-300" : "text-cyan-100/60"}`}>
                {hasLive ? "●" : connected ? "◐" : "○"}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/45">Live Intelligence Status</p>
              <p className={`text-sm font-bold ${hasLive ? "text-emerald-200" : connected ? "text-amber-200" : "text-cyan-100/70"}`}>
                {hasLive ? `${liveFacts.length} live facts` : connected ? "Source leads only" : "No intelligence loaded"}
              </p>
            </div>
          </div>

          <button
            onClick={handleIngest}
            disabled={ingesting}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
              ingesting
                ? "border-cyan-100/10 bg-cyan-100/5 text-cyan-100/40"
                : "border-emerald-200/25 bg-emerald-200/10 text-emerald-100 hover:bg-emerald-200/20"
            }`}
          >
            {ingesting ? "Ingesting..." : "Run Intelligence Ingest"}
          </button>
        </div>

        {ingesting && (
          <div className="mt-3 flex items-center gap-2 text-xs text-cyan-100/60">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
            Querying USASpending, SEC EDGAR, and source leads...
          </div>
        )}

        {ingestError && (
          <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-xs text-rose-200/80">
            Ingestion issue: {ingestError}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Stat label="Live Facts" value={liveFacts.length} accent={hasLive ? "text-emerald-200" : "text-cyan-100/50"} />
          <Stat label="Source Leads" value={sourceLeads.length} accent="text-amber-200/80" />
          <Stat label="No-Result Diagnostics" value={ingestDiagnostics?.sources.filter((s) => s.status === "no-results").length ?? 0} accent="text-rose-300/70" />
          <Stat label="Source Types" value={summary.sourcesQueried.length} accent="text-cyan-50" />
          <Stat label="Categories" value={Object.keys(byCategory).length} accent="text-cyan-50" />
          <Stat
            label="Last Run"
            value={summary.lastRun ? new Date(summary.lastRun).toLocaleDateString() : "—"}
            accent="text-cyan-100/70"
            isText
          />
        </div>

        {/* Per-source diagnostics after ingest */}
        {ingestDiagnostics && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/45">Per-Source Results</p>
            {ingestDiagnostics.sources.map((diag) => (
              <SourceResultRow key={diag.source} diag={diag} />
            ))}
            {ingestDiagnostics.aliasesUsed.length > 1 && (
              <p className="text-[10px] text-cyan-100/40">
                Aliases queried: {ingestDiagnostics.aliasesUsed.join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Live source summary */}
        {hasLive && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(
              liveFacts.reduce<Record<string, number>>((acc, f) => {
                acc[f.sourceType] = (acc[f.sourceType] ?? 0) + 1;
                return acc;
              }, {})
            ).map(([source, count]) => (
              <span key={source} className="rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-200/80">
                {source}: {count} fact{count !== 1 ? "s" : ""}
              </span>
            ))}
          </div>
        )}

        {/* Needs-key indicators */}
        {sourceLeads.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {sourceLeads.filter((f) => f.metadata?.needsKey).map((f) => (
              <span key={f.id} className="rounded-full bg-amber-400/10 px-3 py-1 text-[11px] text-amber-200/70">
                Needs API key: {f.sourceName}
              </span>
            ))}
          </div>
        )}

        {hasLive && top && (
          <div className="mt-3 rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200/50">Recommended Next Action</p>
            <p className="mt-1 text-xs leading-5 text-cyan-100/75">
              {suggestedAction(top.category, top.confidence, top.sourceType, top.value, companyName)}
            </p>
          </div>
        )}

        {lastRun && (
          <div className="mt-3 flex items-center gap-2 text-xs text-cyan-100/50">
            <span className="text-[10px] uppercase tracking-[0.2em]">Last Ingestion:</span>
            <span>{new Date(lastRun.completedAt).toLocaleString()}</span>
            <span className="text-cyan-100/30">—</span>
            <span className={lastRun.status === "completed" ? "text-emerald-200/70" : "text-amber-200/70"}>{lastRun.status}</span>
          </div>
        )}
      </GlassCard>

      {!hasLive && (
        <GlassCard className="border-amber-400/20 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg text-amber-400">⚠</span>
            <div>
              <p className="text-sm font-bold text-amber-200">
                {connected ? "No live intelligence facts — source leads only" : "No live intelligence facts yet"}
              </p>
              <p className="mt-1 text-xs leading-5 text-cyan-100/60">
                {connected
                  ? "This workspace has source leads (link-only records) but no live facts from automated ingestion. Run Intelligence Ingest to fetch real data from USASpending and SEC EDGAR. If ingest returns no live facts, the company may not have federal contract awards or SEC filings under the queried aliases."
                  : "This workspace is using static profile data and source leads. Run Intelligence Ingest to fetch live facts from USASpending and SEC EDGAR."}
              </p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function SourceResultRow({ diag }: { diag: SourceDiagnostic }) {
  const statusColor =
    diag.status === "success"
      ? "text-emerald-300 bg-emerald-400/10"
      : diag.status === "no-results"
        ? "text-amber-300 bg-amber-400/10"
        : diag.status === "error"
          ? "text-rose-300 bg-rose-400/10"
          : diag.status === "needs-key"
            ? "text-amber-200/70 bg-amber-400/5"
            : "text-cyan-100/50 bg-cyan-100/5";

  const statusLabel =
    diag.status === "success" ? "SUCCESS"
      : diag.status === "no-results" ? "NO RESULTS"
      : diag.status === "error" ? "ERROR"
      : diag.status === "needs-key" ? "NEEDS KEY"
      : diag.status === "not-applicable" ? "N/A"
      : "UNKNOWN";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-cyan-100/8 bg-white/[0.02] px-3 py-2">
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${statusColor}`}>
        {statusLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-cyan-50">{diag.source}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-cyan-100/55">{diag.message}</p>
        {diag.aliasesQueried.length > 1 && (
          <p className="mt-0.5 text-[10px] text-cyan-100/35">
            Aliases: {diag.aliasesQueried.join(", ")}
          </p>
        )}
      </div>
      <span className="shrink-0 text-xs font-bold text-cyan-100/70">{diag.factsFound}</span>
    </div>
  );
}

function Stat({ label, value, accent, isText }: { label: string; value: number | string; accent: string; isText?: boolean }) {
  return (
    <div className="rounded-lg border border-cyan-100/8 bg-white/[0.02] px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/40">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${accent}`}>{isText ? value : value}</p>
    </div>
  );
}
