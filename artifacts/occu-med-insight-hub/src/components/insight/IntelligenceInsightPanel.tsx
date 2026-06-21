import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/insight/GlassCard";
import type { ChartDatumSelection } from "@/pages/data-visualization";
import type { IntelligenceFact, CompanyIntelligence } from "@/data/types";
import {
  suggestedAction,
  suggestedQuestions,
  whyThisMatters,
  findRelatedFacts,
  categoryLabel,
} from "@/data/intelligenceActions";

interface InsightContext {
  companyName: string;
  intelligence: CompanyIntelligence | undefined;
  sourceRecords: any[];
  signals: { label: string; value: string; note?: string }[];
  dossierSections: { title: string; narrative?: string }[];
  metrics: { label: string; value: number; unit?: string }[];
  riskMatrix: any[];
  opportunityMatrix: any[];
}

function formatValue(value: number, formatter?: string, unit?: string) {
  const formatted =
    formatter === "currencyM" ? `$${value.toLocaleString()}M`
    : formatter === "currencyK" ? `$${value.toLocaleString()}K`
    : formatter === "percent" ? `${value}%`
    : formatter === "hoursM" ? `${value.toLocaleString()}M hrs`
    : value.toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">{label}</p>
      <div className="mt-1 text-sm leading-5 text-cyan-100/75">{children}</div>
    </div>
  );
}

export function IntelligenceInsightPanel({
  isOpen,
  onClose,
  selection,
  context,
}: {
  isOpen: boolean;
  onClose: () => void;
  selection: ChartDatumSelection | null;
  context: InsightContext;
}) {
  if (!selection) return null;

  const { intelligence, sourceRecords, signals, dossierSections, metrics, riskMatrix, opportunityMatrix, companyName } = context;
  const facts = intelligence?.facts ?? [];
  const relatedFacts = findRelatedFacts(facts, selection);
  const hasLiveMeta = !!(selection.intelligenceCategory || selection.confidence || selection.sourceType || selection.sourceUrl);

  const action = suggestedAction(selection.intelligenceCategory, selection.confidence, selection.sourceType, selection.value, companyName);
  const questions = suggestedQuestions(selection.intelligenceCategory, selection.confidence, selection.sourceType);
  const why = whyThisMatters(selection.intelligenceCategory, selection.confidence, selection.value, companyName, selection.chartTitle);

  const matchedSource = selection.sourceId
    ? sourceRecords.find((s) => s.id === selection.sourceId || s.sourceId === selection.sourceId)
    : null;
  const sourceName = matchedSource?.name ?? matchedSource?.sourceName ?? selection.sourceId ?? "Unknown source";

  const relatedSignals = hasLiveMeta ? signals.filter((s) => s.label.toLowerCase().includes((selection.intelligenceCategory ?? "").toLowerCase())) : signals.slice(0, 3);
  const relatedDossier = hasLiveMeta ? dossierSections.filter((d) => d.title.toLowerCase().includes((selection.intelligenceCategory ?? "").toLowerCase())) : dossierSections.slice(0, 2);
  const relatedMetrics = metrics.filter((m) => m.label.toLowerCase().includes((selection.category ?? "").toLowerCase().split(" ")[0])).slice(0, 3);
  const relatedRisk = riskMatrix.find((r) => r.name === selection.category);
  const relatedOpp = opportunityMatrix.find((o) => o.name === selection.category);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto border-l border-cyan-100/20 bg-[#030813]/96 backdrop-blur-xl"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cyan-100/10 bg-[#030813]/90 px-6 py-4 backdrop-blur-xl">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-200/60">Intelligence Insight</p>
              <h3 className="mt-1 text-lg font-black text-white">{selection.chartTitle}</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-cyan-100/20 bg-cyan-100/5 px-3 py-1.5 text-xs text-cyan-50 transition hover:bg-cyan-100/10"
            >
              Close
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            <Field label="What was clicked">
              <p className="font-semibold text-cyan-50">{selection.category}</p>
              <p className="mt-1 text-xs text-cyan-100/55">
                {selection.seriesName} — {formatValue(selection.value, selection.formatter, selection.unit)}
              </p>
            </Field>

            <div className="rounded-xl border border-emerald-200/15 bg-emerald-200/[0.04] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-200/50">Why this matters</p>
              <p className="mt-2 text-sm leading-6 text-cyan-100/80">{why}</p>
            </div>

            {hasLiveMeta && (
              <div className="grid gap-2">
                {selection.intelligenceCategory && (
                  <Field label="Intelligence Category">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(selection.intelligenceCategory) }} />
                      {categoryLabel(selection.intelligenceCategory)}
                    </span>
                  </Field>
                )}
                {selection.confidence && (
                  <Field label="Confidence">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: confidenceColor(selection.confidence) }} />
                      {selection.confidence}
                    </span>
                  </Field>
                )}
                {selection.date && <Field label="Date">{selection.date}</Field>}
                {selection.sourceType && <Field label="Source Type">{selection.sourceType}</Field>}
                {selection.sourceUrl && (
                  <Field label="Source URL">
                    <a href={selection.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-cyan-300/80 underline hover:text-cyan-200">
                      {selection.sourceUrl}
                    </a>
                  </Field>
                )}
                {selection.summary && <Field label="Summary">{selection.summary}</Field>}
                {selection.rawSnippet && <Field label="Raw Snippet"><p className="text-xs leading-5 text-cyan-100/60">{selection.rawSnippet}</p></Field>}
              </div>
            )}

            {!hasLiveMeta && matchedSource && (
              <Field label="Source">
                <p className="text-sm text-cyan-100/70">{sourceName}</p>
                {matchedSource?.url && (
                  <a href={matchedSource.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-xs text-cyan-300/60 underline">
                    {matchedSource.url}
                  </a>
                )}
              </Field>
            )}

            {!hasLiveMeta && !matchedSource && (relatedMetrics.length > 0 || relatedSignals.length > 0 || relatedDossier.length > 0) && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Static Profile Context</p>
                <div className="mt-2 space-y-2">
                  {relatedMetrics.map((m, i) => (
                    <div key={i} className="text-xs text-cyan-100/65">
                      <span className="font-semibold text-cyan-50">{m.label}</span>: {m.value}{m.unit ? ` ${m.unit}` : ""}
                    </div>
                  ))}
                  {relatedSignals.map((s, i) => (
                    <div key={i} className="text-xs text-cyan-100/65">
                      <span className="font-semibold text-cyan-50">{s.label}</span>: {s.value}
                    </div>
                  ))}
                  {relatedDossier.map((d, i) => (
                    <div key={i} className="text-xs text-cyan-100/65">
                      <span className="font-semibold text-cyan-50">{d.title}</span>
                      {d.narrative && <p className="mt-0.5 text-cyan-100/50">{d.narrative.slice(0, 120)}...</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {relatedRisk && (
              <Field label="Risk Matrix Match">
                <p className="text-xs">Risk: {relatedRisk.risk ?? "N/A"} — Workers: {relatedRisk.workers ?? "N/A"} — Revenue: {relatedRisk.revenue ?? "N/A"}</p>
              </Field>
            )}
            {relatedOpp && (
              <Field label="Opportunity Matrix Match">
                <p className="text-xs">Revenue Potential: {relatedOpp.revenuePotential ?? "N/A"} — Strategic Value: {relatedOpp.strategicValue ?? "N/A"}</p>
              </Field>
            )}

            {relatedFacts.length > 0 && (
              <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Related Intelligence Facts ({relatedFacts.length})</p>
                <div className="mt-2 space-y-2">
                  {relatedFacts.map((fact) => (
                    <div key={fact.id} className="flex items-start gap-2 text-xs leading-5 text-cyan-100/60">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: confidenceColor(fact.confidence) }} />
                      <div>
                        <p className="font-semibold text-cyan-50">{fact.title}</p>
                        <p className="mt-0.5 text-cyan-100/50">{fact.summary.slice(0, 120)}</p>
                        <p className="mt-0.5 text-[10px] text-cyan-100/40">{categoryLabel(fact.category)} — {fact.date} — {fact.sourceType}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/50">Suggested Occu-Med Action</p>
              <p className="mt-2 text-sm leading-6 text-cyan-100/80">{action}</p>
            </div>

            <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Questions to Ask Next</p>
              <ul className="mt-2 space-y-1.5">
                {questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-5 text-cyan-100/65">
                    <span className="mt-0.5 text-cyan-300/50">?</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            {selection.note && (
              <Field label="Additional Notes">{selection.note}</Field>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function confidenceColor(confidence: string): string {
  const c = confidence.toLowerCase();
  if (c === "high") return "#34d399";
  if (c === "medium") return "#fbbf24";
  if (c === "low") return "#fb7185";
  if (c === "link-only") return "#94a3b8";
  return "#22d3ee";
}

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    contractAwards: "#22d3ee",
    opportunities: "#a78bfa",
    secFilings: "#fbbf24",
    jobSignals: "#34d399",
    sourceFacts: "#f472b6",
    sourceConfidence: "#60a5fa",
    timelineEvents: "#fb7185",
    locationExposure: "#a3e635",
    medicalNetworkGaps: "#fb923c",
    competitorSignals: "#c084fc",
    renewalOrExpirationEvents: "#2dd4bf",
  };
  return map[category] ?? "#22d3ee";
}
