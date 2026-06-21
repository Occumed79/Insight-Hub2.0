import { useState } from "react";
import { GlassCard } from "@/components/insight/GlassCard";
import type { CompanyIntelligence } from "@/data/types";
import { intelligenceSummary, intelligenceFactsByCategory } from "@/data/intelligenceCharts";
import { topSignal, highestValueFact, categoryLabel, suggestedAction } from "@/data/intelligenceActions";
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
  const summary = intelligenceSummary(intelligence);
  const facts = intelligence?.facts ?? [];
  const byCategory = intelligenceFactsByCategory(facts);
  const top = topSignal(facts);
  const highestAward = highestValueFact(facts, "contractAwards");
  const highestRiskRegion = highestValueFact(facts, "medicalNetworkGaps");
  const lastRun = intelligence?.runs[0];
  const connected = summary.totalFacts > 0;

  const handleIngest = async () => {
    setIngesting(true);
    setIngestError(null);
    try {
      const result = await ingestCompanyIntelligence(companyId, companyName);
      if (result.ok && result.facts && result.chartReady) {
        onIngestComplete({
          companyId,
          facts: result.facts,
          runs: intelligence?.runs ?? [],
          chartReady: result.chartReady,
        });
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
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${connected ? "bg-emerald-400/15" : "bg-cyan-100/10"}`}>
              <span className={`text-lg ${connected ? "text-emerald-300" : "text-cyan-100/60"}`}>
                {connected ? "●" : "○"}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/45">Live Intelligence Status</p>
              <p className={`text-sm font-bold ${connected ? "text-emerald-200" : "text-cyan-100/70"}`}>
                {connected ? "Connected" : "No live facts loaded"}
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

        {ingestError && (
          <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-xs text-rose-200/80">
            Ingestion warning: {ingestError}. The API may be unavailable — static profile data is still shown.
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Stat label="Total Facts" value={summary.totalFacts} accent="text-cyan-50" />
          <Stat label="Live Sources" value={summary.liveFacts} accent="text-emerald-200" />
          <Stat label="Link-Only" value={summary.linkOnlyFacts} accent="text-slate-400" />
          <Stat label="Source Types" value={summary.sourcesQueried.length} accent="text-cyan-50" />
          <Stat label="Categories" value={Object.keys(byCategory).length} accent="text-cyan-50" />
          <Stat
            label="Last Run"
            value={summary.lastRun ? new Date(summary.lastRun).toLocaleDateString() : "—"}
            accent="text-cyan-100/70"
            isText
          />
        </div>

        {connected && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {top && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/45">Top Signal</p>
                <p className="mt-1 text-sm font-semibold text-cyan-50">{top.title}</p>
                <p className="mt-0.5 text-xs text-cyan-100/55">{categoryLabel(top.category)} — {top.confidence}</p>
              </div>
            )}
            {highestAward && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/45">Highest-Value Award</p>
                <p className="mt-1 text-sm font-semibold text-cyan-50">
                  {highestAward.value ? `$${highestAward.value.toLocaleString()}` : "N/A"}
                </p>
                <p className="mt-0.5 text-xs text-cyan-100/55">{highestAward.title.slice(0, 60)}</p>
              </div>
            )}
            {highestRiskRegion && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/45">Highest-Risk Region</p>
                <p className="mt-1 text-sm font-semibold text-cyan-50">{highestRiskRegion.title.slice(0, 60)}</p>
                <p className="mt-0.5 text-xs text-cyan-100/55">Gap Score: {highestRiskRegion.value ?? "N/A"}</p>
              </div>
            )}
          </div>
        )}

        {connected && lastRun && (
          <div className="mt-3 flex items-center gap-2 text-xs text-cyan-100/50">
            <span className="text-[10px] uppercase tracking-[0.2em]">Last Ingestion:</span>
            <span>{new Date(lastRun.completedAt).toLocaleString()}</span>
            <span className="text-cyan-100/30">—</span>
            <span>{lastRun.sourcesQueried.join(", ")}</span>
            <span className="text-cyan-100/30">—</span>
            <span className={lastRun.status === "completed" ? "text-emerald-200/70" : "text-amber-200/70"}>{lastRun.status}</span>
          </div>
        )}

        {connected && top && (
          <div className="mt-3 rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200/50">Recommended Next Action</p>
            <p className="mt-1 text-xs leading-5 text-cyan-100/75">
              {suggestedAction(top.category, top.confidence, top.sourceType, top.value, companyName)}
            </p>
          </div>
        )}
      </GlassCard>

      {!connected && (
        <GlassCard className="p-5">
          <p className="text-sm font-semibold text-cyan-50">No live facts loaded yet</p>
          <p className="mt-1 text-xs leading-5 text-cyan-100/55">
            Static profile intelligence is being used as fallback. Charts from static dossiers, metrics, and source records are shown below.
            Run Intelligence Ingest to fetch live facts from USASpending, SEC EDGAR, SAM.gov, and other sources. Live facts will enrich the panels and insight drawer after ingest.
          </p>
        </GlassCard>
      )}
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
