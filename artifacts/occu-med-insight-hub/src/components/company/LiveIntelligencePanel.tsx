import { useState } from "react";
import { GlassCard } from "../insight/GlassCard";
import { CompanyChartRenderer } from "./CompanyChartRenderer";
import { intelligenceFactsByCategory, intelligenceSummary, intelligenceFactsToCharts } from "../../data/intelligenceCharts";
import { ingestCompanyIntelligence } from "../../data/intelligenceApi";
import type { CompanyIntelligence } from "../../data/types";

const CATEGORY_LABELS: Record<string, string> = {
  contractAwards: "Contract Awards",
  opportunities: "Opportunities",
  secFilings: "SEC Filings",
  jobSignals: "Job Signals",
  sourceFacts: "Source Facts",
  sourceConfidence: "Source Confidence",
  timelineEvents: "Timeline Events",
  locationExposure: "Location Exposure",
  medicalNetworkGaps: "Medical Network Gaps",
  competitorSignals: "Competitor Signals",
  renewalOrExpirationEvents: "Renewal / Expiration Events",
};

export function LiveIntelligencePanel({ intelligence, companyId, companyName }: { intelligence: CompanyIntelligence | undefined; companyId: string; companyName: string }) {
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<{ ok: boolean; message: string } | undefined>();

  const summary = intelligenceSummary(intelligence);
  const charts = intelligenceFactsToCharts(intelligence);
  const factsByCategory = intelligence ? intelligenceFactsByCategory(intelligence.facts) : {};

  async function handleIngest() {
    setIngesting(true);
    setIngestResult(undefined);
    try {
      const result = await ingestCompanyIntelligence(companyId, companyName);
      if (result.ok) {
        setIngestResult({
          ok: true,
          message: `Ingestion complete: ${result.factsCollected ?? 0} facts collected from ${result.sourcesQueried?.length ?? 0} sources. Status: ${result.status}.`,
        });
      } else {
        setIngestResult({ ok: false, message: result.error || "Ingestion failed" });
      }
    } catch (error) {
      setIngestResult({ ok: false, message: error instanceof Error ? error.message : "Ingestion failed" });
    } finally {
      setIngesting(false);
    }
  }

  return (
    <GlassCard className="mt-5 p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">Live Intelligence</p>
          <h2 className="mt-2 text-2xl font-black text-white">Ingested Intelligence</h2>
        </div>
        <button
          type="button"
          onClick={handleIngest}
          disabled={ingesting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-100/20 bg-emerald-200/12 px-5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-200/18 disabled:opacity-45"
        >
          {ingesting ? "Ingesting..." : "Run Ingestion"}
        </button>
      </div>

      {ingestResult && (
        <div className={`mb-4 rounded-2xl border p-3 text-sm ${ingestResult.ok ? "border-emerald-200/20 bg-emerald-200/8 text-emerald-100" : "border-amber-200/20 bg-amber-200/8 text-amber-100"}`}>
          {ingestResult.message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Total Facts</p>
          <p className="mt-2 text-lg font-black text-cyan-50">{summary.totalFacts}</p>
        </div>
        <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Live Facts</p>
          <p className="mt-2 text-lg font-black text-cyan-50">{summary.liveFacts}</p>
        </div>
        <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Link-Only</p>
          <p className="mt-2 text-lg font-black text-cyan-50">{summary.linkOnlyFacts}</p>
        </div>
        <div className="rounded-2xl border border-cyan-100/12 bg-black/18 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Sources</p>
          <p className="mt-2 text-lg font-black text-cyan-50">{summary.sourcesQueried.length}</p>
        </div>
      </div>

      {Object.keys(factsByCategory).length > 0 && (
        <div className="mt-5 space-y-3">
          {Object.entries(factsByCategory).map(([category, facts]) => (
            <div key={category} className="rounded-2xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-sm font-semibold text-cyan-50">{CATEGORY_LABELS[category] ?? category}</p>
              <div className="mt-2 space-y-1">
                {facts.slice(0, 5).map((fact) => (
                  <div key={fact.id} className="flex items-start gap-2 text-xs leading-5 text-cyan-100/55">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${fact.confidence === "high" ? "bg-emerald-400" : fact.confidence === "medium" ? "bg-cyan-400" : fact.confidence === "low" ? "bg-amber-400" : "bg-cyan-100/30"}`} />
                    <span>{fact.title} — {fact.summary.slice(0, 120)}</span>
                    {fact.sourceUrl && (
                      <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 text-cyan-300/60 underline hover:text-cyan-200">
                        source
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {charts.length > 0 && <CompanyChartRenderer charts={charts} />}

      {!intelligence && (
        <p className="mt-4 text-sm text-cyan-100/45">
          No live intelligence ingested yet. Click "Run Ingestion" to fetch data from USASpending.gov, SEC EDGAR, and other public sources.
        </p>
      )}
    </GlassCard>
  );
}
