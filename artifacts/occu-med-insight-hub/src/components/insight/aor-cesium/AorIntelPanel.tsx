import { useMemo, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, ChevronRight, Crosshair, Loader2, X } from "lucide-react";
import {
  DIMENSIONS, DIMENSION_COLORS, DIMENSION_LABELS, FRESHNESS_LABELS, STATUS_LABELS,
  type CountryIntel, type Dimension, type EvidenceRecord, type Freshness, type Observation, type SourceStatus,
} from "./aor-intel-types";

const FRESHNESS_TONE: Record<Freshness, string> = {
  NEAR_REAL_TIME: "border-emerald-300/30 text-emerald-200",
  CURRENT_NOTICE: "border-cyan-300/30 text-cyan-200",
  WEEKLY_SURVEILLANCE: "border-sky-300/30 text-sky-200",
  CURRENT_GUIDANCE: "border-teal-300/30 text-teal-200",
  HISTORICAL_CLIMATOLOGICAL: "border-amber-300/30 text-amber-200",
  STRUCTURAL_DATA: "border-slate-300/25 text-slate-300",
  STALE_CACHE: "border-rose-300/40 text-rose-200",
};
const STATUS_TONE: Record<SourceStatus, string> = {
  ok: "text-emerald-300", no_current_matching_finding: "text-slate-300", source_returned_no_data: "text-amber-300",
  source_unavailable: "text-rose-300", not_configured: "text-rose-300", not_applicable: "text-slate-500", not_evaluated: "text-slate-500", stale_cache: "text-rose-300",
};

export function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function safeUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : ""; } catch { return ""; }
}

export function FreshnessBadge({ freshness }: { freshness: Freshness | null }) {
  if (!freshness) return null;
  return <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.08em] ${FRESHNESS_TONE[freshness]}`}>{FRESHNESS_LABELS[freshness]}</span>;
}

function Chip({ children, tone = "border-white/10 text-slate-300" }: { children: ReactNode; tone?: string }) {
  return <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${tone}`}>{children}</span>;
}

const pretty = (value: string) => value.replace(/_/g, " ");

function EvidenceCard({ record, highlighted, onFocus }: { record: EvidenceRecord; highlighted: boolean; onFocus: (record: EvidenceRecord) => void }) {
  const url = safeUrl(record.sourceUrl);
  const hasPoint = record.geometry.type === "Point";
  return (
    <article id={`evidence-${record.id}`} data-testid="aor-evidence-card" className={`border-b border-white/[.06] py-3 last:border-b-0 ${highlighted ? "bg-cyan-200/[.05]" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <FreshnessBadge freshness={record.freshness} />
        {record.recommendationType ? <Chip tone="border-teal-300/25 text-teal-100">Recommendation: {pretty(record.recommendationType)}</Chip> : null}
        {record.requirementType ? <Chip tone="border-amber-300/35 text-amber-100">Entry requirement: {pretty(record.requirementType)}</Chip> : null}
        {record.severity ? <Chip>{record.severity}</Chip> : null}
      </div>
      <h4 className="mt-1.5 text-[11px] font-bold leading-4 text-white/90">{record.title}</h4>
      {record.summary ? <p className="mt-1 text-[10px] leading-4 text-slate-300">{record.summary}</p> : null}
      {record.geographyNote ? <p className="mt-1 text-[9px] leading-4 text-slate-500">Geography ({pretty(record.geographyLevel)}): {record.geographyNote}</p> : <p className="mt-1 text-[9px] text-slate-500">Geography: {pretty(record.geographyLevel)}</p>}
      {record.evidence ? <details className="mt-1"><summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.12em] text-cyan-100/45">Source evidence</summary><p className="mt-1 whitespace-pre-wrap text-[9px] leading-4 text-slate-400">{record.evidence}</p></details> : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] text-slate-500">
        {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-cyan-100/70 hover:text-cyan-50">{record.sourceName}<ArrowUpRight size={9} /></a> : <span className="font-bold text-slate-400">{record.sourceName}</span>}
        {record.publishedAt ? <span>Published {formatDate(record.publishedAt)}</span> : null}
        {record.updatedAt && record.updatedAt !== record.publishedAt ? <span>Updated {formatDate(record.updatedAt)}</span> : null}
        <span>Retrieved {formatDate(record.retrievedAt)}</span>
        {hasPoint ? <button type="button" onClick={() => onFocus(record)} className="inline-flex items-center gap-1 font-bold text-cyan-100/70 hover:text-cyan-50"><Crosshair size={9} />Fly to location</button> : null}
      </div>
    </article>
  );
}

function MalariaModel({ record }: { record: EvidenceRecord }) {
  const model = (record.extra?.malaria ?? {}) as { riskScope?: string; areasMentioned?: string | null; seasonality?: string | null; altitudeNote?: string | null; preventionDrugs?: string[]; preventionStatement?: string | null };
  const row = (label: string, value: ReactNode) => <div className="grid grid-cols-[92px_1fr] gap-2 border-b border-white/[.05] py-1.5 text-[10px] leading-4"><dt className="text-[8px] font-black uppercase tracking-[.1em] text-slate-500">{label}</dt><dd className="text-slate-200">{value}</dd></div>;
  const stated = (value?: string | null) => value || <span className="text-slate-500">Not stated in the retrieved source text</span>;
  return (
    <dl className="mb-2 rounded-xl border border-amber-200/10 bg-amber-200/[.03] px-3 py-1">
      {row("Risk scope", pretty(model.riskScope || "unspecified"))}
      {row("Risk areas", model.riskScope === "parts_of_country" ? stated(model.areasMentioned) : model.riskScope === "country_wide" ? "Country-wide, per source text" : model.riskScope === "none_stated" ? "No transmission stated by source" : stated(null))}
      {row("Seasonality", stated(model.seasonality))}
      {row("Altitude limits", stated(model.altitudeNote))}
      {row("Prevention drugs", model.preventionDrugs?.length ? model.preventionDrugs.join(", ") : stated(null))}
      {row("Prevention text", stated(model.preventionStatement))}
      {row("Source date", formatDate(record.updatedAt) || <span className="text-slate-500">Not stated</span>)}
    </dl>
  );
}

type Props = {
  intel: CountryIntel | null;
  loading: boolean;
  error: string;
  countryName: string;
  aorLabel: string | null;
  hasPolygon: boolean;
  activeTab: Dimension | "summary" | "sources";
  setActiveTab: (tab: Dimension | "summary" | "sources") => void;
  highlightedId: string | null;
  onFocusEvidence: (record: EvidenceRecord) => void;
  onSelectEvidence: (id: string) => void;
  onClose: () => void;
  lens: ReactNode;
};

export function AorIntelPanel({ intel, loading, error, countryName, aorLabel, hasPolygon, activeTab, setActiveTab, highlightedId, onFocusEvidence, onSelectEvidence, onClose, lens }: Props) {
  const byDimension = useMemo(() => {
    const map = new Map<Dimension, EvidenceRecord[]>();
    for (const record of intel?.evidence ?? []) map.set(record.dimension, [...(map.get(record.dimension) ?? []), record]);
    return map;
  }, [intel]);

  const observationCard = (observation: Observation) => (
    <li key={observation.id} className="border-b border-white/[.06] py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: DIMENSION_COLORS[observation.dimension] }} />
        <span className="text-[8px] font-black uppercase tracking-[.1em] text-slate-500">{DIMENSION_LABELS[observation.dimension]}</span>
        <Chip tone={observation.kind === "gap" ? "border-rose-300/30 text-rose-200" : observation.kind === "caveat" ? "border-amber-300/25 text-amber-200" : "border-emerald-300/25 text-emerald-200"}>{observation.kind}</Chip>
        <FreshnessBadge freshness={observation.freshness} />
      </div>
      <p className="mt-1 text-[11px] font-bold leading-4 text-white/90">{observation.headline}</p>
      <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{observation.detail}</p>
      {observation.evidenceIds.length ? <div className="mt-1 flex flex-wrap gap-1">{observation.evidenceIds.slice(0, 6).map((id, i) => <button key={id} type="button" onClick={() => onSelectEvidence(id)} className="inline-flex items-center gap-0.5 rounded-full border border-cyan-200/15 px-1.5 py-0.5 text-[8px] font-bold text-cyan-100/70 hover:bg-cyan-200/10">Evidence {i + 1}<ChevronRight size={8} /></button>)}</div> : null}
    </li>
  );

  const body = () => {
    if (loading) return <p className="flex items-center gap-2 py-6 text-[10px] text-slate-400"><Loader2 size={12} className="animate-spin" />Retrieving sources for {countryName}…</p>;
    if (error) return <p className="py-4 text-[10px] leading-4 text-amber-100/70"><AlertTriangle size={11} className="mr-1 inline" />{error}</p>;
    if (!intel) return null;
    if (activeTab === "summary") {
      return <div>
        <p data-testid="aor-what-matters-now" className="rounded-xl border border-cyan-200/10 bg-cyan-200/[.04] px-3 py-2 text-[11px] leading-5 text-white/90">{intel.whatMattersNow.summary}</p>
        <p className="mt-1 text-[8px] leading-4 text-slate-500">Assembled by {intel.whatMattersNow.method.replace(/-/g, " ")} from the evidence below. Language-model synthesis is {intel.whatMattersNow.llmSynthesis.replace(/_/g, " ")}. No composite risk score is calculated.</p>
        <ul className="mt-2">{intel.whatMattersNow.observations.map(observationCard)}</ul>
        {intel.limitations.length ? <details className="mt-3"><summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.12em] text-slate-500">How to read this</summary><ul className="mt-1 list-disc space-y-1 pl-4 text-[9px] leading-4 text-slate-500">{intel.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
        {lens}
      </div>;
    }
    if (activeTab === "sources") {
      return <ul>{intel.sources.map((source) => (
        <li key={source.sourceId} className="border-b border-white/[.06] py-2.5 text-[10px] last:border-b-0">
          <div className="flex items-center justify-between gap-2"><span className="font-bold text-white/85">{source.sourceName}</span><span className={`text-[9px] font-bold ${STATUS_TONE[source.status]}`}>{STATUS_LABELS[source.status]}</span></div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5"><FreshnessBadge freshness={source.freshness} />{source.recordCount ? <Chip>{source.recordCount} record{source.recordCount === 1 ? "" : "s"}</Chip> : null}</div>
          {source.note ? <p className="mt-1 text-[9px] leading-4 text-slate-500">{source.note}</p> : null}
        </li>
      ))}</ul>;
    }
    const records = byDimension.get(activeTab) ?? [];
    const statuses = intel.sources.filter((source) => source.dimension === activeTab || (source.dimension === "multi" && (activeTab === "health_vaccines" || activeTab === "malaria")));
    const empty = !records.length ? <div className="py-3 text-[10px] leading-4 text-slate-400"><p>No evidence records for {DIMENSION_LABELS[activeTab].toLowerCase()}. This is not proof of absence — source status:</p><ul className="mt-2 space-y-1">{statuses.map((source) => <li key={source.sourceId} className="text-[9px]"><b className="text-white/70">{source.sourceName}</b> — <span className={STATUS_TONE[source.status]}>{STATUS_LABELS[source.status]}</span>{source.note ? <span className="text-slate-500"> · {source.note}</span> : null}</li>)}</ul></div> : null;

    if (activeTab === "health_vaccines") {
      const group = (title: string, items: EvidenceRecord[], note?: string) => items.length ? <section className="mb-3"><h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">{title}</h3>{note ? <p className="mb-1 text-[9px] leading-4 text-slate-500">{note}</p> : null}{items.map((record) => <EvidenceCard key={record.id} record={record} highlighted={record.id === highlightedId} onFocus={onFocusEvidence} />)}</section> : null;
      return <div>{empty}
        {group("Routine vaccines", records.filter((r) => r.category === "routine_vaccine"))}
        {group("Travel vaccines — CDC recommendations", records.filter((r) => r.category === "travel_vaccine"), "Recommendations only. These are not legal entry requirements.")}
        {group("Entry requirements — legal, kept separate", records.filter((r) => r.category === "entry_requirement"), "Language found in CDC destination text. Verify with the destination government.")}
        {intel.sources.find((s) => s.sourceId === "destination-entry-requirements")?.status === "not_evaluated" && !records.some((r) => r.category === "entry_requirement") ? <p className="mb-3 rounded-lg border border-rose-300/15 bg-rose-300/[.04] px-3 py-2 text-[10px] leading-4 text-rose-100/80">Entry vaccination requirements were not evaluated: no destination-government source is connected. Requirements based on previous travel or transit are not assessed.</p> : null}
        {group("Destination disease risks (CDC)", records.filter((r) => r.category === "destination_disease_risk"))}
        {group("Other health guidance", records.filter((r) => !["routine_vaccine", "travel_vaccine", "entry_requirement", "destination_disease_risk"].includes(r.category)))}
      </div>;
    }
    if (activeTab === "malaria") {
      return <div>{empty}{records.map((record) => <div key={record.id}><MalariaModel record={record} /><EvidenceCard record={record} highlighted={record.id === highlightedId} onFocus={onFocusEvidence} /></div>)}</div>;
    }
    const sorted = [...records].sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0));
    return <div>{empty}{sorted.map((record) => <EvidenceCard key={record.id} record={record} highlighted={record.id === highlightedId} onFocus={onFocusEvidence} />)}</div>;
  };

  return (
    <aside data-testid="aor-intel-panel" className="pointer-events-auto absolute bottom-4 right-4 top-4 z-30 flex w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[22px] border border-white/[.09] bg-[#050d14]/82 text-white shadow-[0_18px_60px_rgba(0,0,0,.5)] backdrop-blur-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-white/[.07] px-4 py-3">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[.16em] text-cyan-100/45">{aorLabel ?? "Country"}</p>
          <h2 className="text-[15px] font-bold leading-5">{countryName}</h2>
          {!hasPolygon ? <p className="mt-0.5 text-[9px] text-amber-200/70">No 50m boundary polygon exists for this territory; camera uses its reference point.</p> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Close country panel" className="rounded-full border border-white/10 p-1.5 text-slate-400 hover:text-white"><X size={13} /></button>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-white/[.06] px-3 py-2" aria-label="Intelligence categories">
        {([["summary", "What matters now"], ...DIMENSIONS.map((d) => [d, DIMENSION_LABELS[d]]), ["sources", "Sources"]] as Array<[Dimension | "summary" | "sources", string]>).map(([id, label]) => {
          const count = id === "summary" || id === "sources" ? null : byDimension.get(id)?.length ?? 0;
          return <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setActiveTab(id)} className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold transition ${activeTab === id ? "border-cyan-200/25 bg-cyan-200/10 text-white" : "border-white/[.06] text-slate-400 hover:text-white"}`}>{label}{count ? <span className="ml-1 text-slate-500">{count}</span> : null}</button>;
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{body()}</div>
      {intel ? <footer className="border-t border-white/[.06] px-4 py-2 text-[8px] text-slate-600">Generated {formatDate(intel.generatedAt)} · evidence is retrieved server-side and cached; each record shows its own retrieval date.</footer> : null}
    </aside>
  );
}
