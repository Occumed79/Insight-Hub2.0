import { useMemo, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, ChevronRight, Crosshair, Loader2, X } from "lucide-react";
import {
  DIMENSIONS, DIMENSION_COLORS, DIMENSION_LABELS, ENVIRONMENT_KEYS, ENVIRONMENT_LABELS, FRESHNESS_LABELS, STATUS_LABELS,
  type CountryIntel, type Dimension, type EnvironmentKey, type EvidenceRecord, type Freshness, type Observation, type SourceStatus, type SynthesisResponse,
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

const REQUIREMENT_LABELS: Record<string, string> = {
  entry_required: "Entry requirement: all arrivals",
  entry_required_conditional: "Entry requirement: conditional",
  entry_required_after_transit: "Entry requirement: after prior travel / transit",
  exit_required: "Exit / departure requirement",
  declaration_only: "Declaration only — entry not refused",
  not_required: "Authority: requirement withdrawn",
  not_evaluated: "Not verified",
};
const STATUS_CHIP_TONE: Record<string, string> = {
  "DESTINATION-GOVERNMENT VERIFIED": "border-emerald-300/35 text-emerald-100",
  "EMBASSY VERIFIED": "border-emerald-300/35 text-emerald-100",
  "WHO VERIFIED": "border-sky-300/35 text-sky-100",
  "CDC CORROBORATED": "border-teal-300/30 text-teal-100",
  "OLDER GLOBAL BASELINE": "border-amber-300/35 text-amber-100",
  "NOT CURRENTLY VERIFIED": "border-rose-300/40 text-rose-200",
  "COMMAND PUBLICATION (PACK-EXTRACTED)": "border-pink-300/35 text-pink-100",
  "COMMAND PUBLICATION — UNDER REWRITE": "border-amber-300/35 text-amber-100",
  "COMMAND PUBLICATION — SUPERSEDED": "border-slate-400/30 text-slate-300",
  "NOT PUBLICLY VERIFIED": "border-rose-300/40 text-rose-200",
  "PUBLIC-SOURCE BASELINE": "border-pink-300/25 text-pink-100",
  "PUBLIC-SOURCE BASELINE — LIVE VERIFY": "border-amber-300/35 text-amber-100",
};

type ConditionRow = { label: string; value: string };
type SupportingSource = { authority: string; url: string; note: string };

/** Conditions, authority and provenance for a vaccine entry / exit / transit / event rule. */
function RuleDetails({ record }: { record: EvidenceRecord }) {
  const extra = (record.extra ?? {}) as { conditions?: ConditionRow[]; supportingSources?: SupportingSource[]; alsoStatedBy?: Array<{ authority: string; sourceUrl: string; publishedAt: string | null; verificationStatus: string; statement: string }>; productionVerificationRequired?: boolean };
  if (!extra.conditions?.length) return null;
  return (
    <div className="mt-1.5">
      <details open={false}>
        <summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.12em] text-cyan-100/55">Rule conditions, authority and freshness</summary>
        <dl className="mt-1 rounded-lg border border-white/[.06] bg-white/[.02] px-2">
          {extra.conditions.map((condition) => <div key={condition.label} className="grid grid-cols-[96px_1fr] gap-2 border-b border-white/[.04] py-1 text-[9px] leading-4 last:border-b-0"><dt className="text-[8px] font-black uppercase tracking-[.08em] text-slate-500">{condition.label}</dt><dd className="break-words text-slate-200">{condition.value}</dd></div>)}
        </dl>
        {extra.alsoStatedBy?.length ? <div className="mt-1.5 text-[9px] leading-4 text-slate-400"><b className="text-slate-300">Also stated, not shown as current:</b>{extra.alsoStatedBy.map((other) => <p key={other.sourceUrl + other.statement} className="mt-0.5">{other.authority} ({other.verificationStatus}{other.publishedAt ? `, ${other.publishedAt.slice(0, 10)}` : ""}): {other.statement}</p>)}</div> : null}
        {extra.supportingSources?.length ? <ul className="mt-1.5 space-y-0.5 text-[9px] leading-4 text-slate-500">{extra.supportingSources.map((source) => { const href = safeUrl(source.url); return <li key={source.url}>{href ? <a href={href} target="_blank" rel="noreferrer" className="font-bold text-cyan-100/65 hover:text-cyan-50">{source.authority}</a> : source.authority} — {source.note}</li>; })}</ul> : null}
      </details>
      {extra.productionVerificationRequired ? <p className="mt-1 text-[8px] leading-3 text-amber-100/60">Re-read the source page before operational use; rules change without notice.</p> : null}
    </div>
  );
}

type CommandRuleView = {
  domain: string; kind: string; status: string | null; populationText: string; applicabilityPopulation: string[]; directedPopulations: string[];
  minimumStay: { days: number; inclusive: boolean; basis: string } | null; maximumStayDaysExclusive: number | null; pcsOnly: boolean;
  thresholdOrRule: string | null; waiverAuthority: string | null; requiredEvaluation: string | null; requiredDocumentation: string | null;
  medicationOrEquipmentRule: string | null; immunizationOrProphylaxisRule: string | null; sourceSection: string; sourceGaps: string[]; caveats: string[];
  scope: { level: string; component: string | null; countries: string[] };
};
const COMMAND_KIND_LABEL: Record<string, string> = { requirement: "Command requirement", recommendation: "Command recommendation (not a requirement)", process: "Command process / routing" };

/** Detail rows for a U.S. Combatant Command policy rule. Never shown for host-nation or CDC/WHO records. */
function CommandRuleDetails({ record }: { record: EvidenceRecord }) {
  const rule = record.extra?.commandRule as CommandRuleView | undefined;
  if (!rule) return null;
  const rows: Array<[string, string | null]> = [
    ["Scope", rule.scope.level === "command" ? "Command-wide" : rule.scope.level === "component" ? `Component: ${rule.scope.component}` : `Country supplement${rule.scope.component ? ` (${rule.scope.component})` : ""}`],
    ["Applies to", rule.populationText || rule.applicabilityPopulation.map(pretty).join(", ") || null],
    ["Only if directed", rule.directedPopulations.length ? rule.directedPopulations.map(pretty).join(", ") : null],
    ["Duration trigger", rule.minimumStay ? `${rule.minimumStay.inclusive ? "At least" : "More than"} ${rule.minimumStay.days} days — ${rule.minimumStay.basis}` : rule.maximumStayDaysExclusive !== null ? `Under ${rule.maximumStayDaysExclusive} days` : null],
    ["PCS only", rule.pcsOnly ? "Yes" : null],
    ["Threshold / rule", rule.thresholdOrRule],
    ["Waiver authority", rule.waiverAuthority],
    ["Evaluation", rule.requiredEvaluation],
    ["Documentation", rule.requiredDocumentation],
    ["Medication / equipment", rule.medicationOrEquipmentRule],
    ["Immunization / prophylaxis", rule.immunizationOrProphylaxisRule],
    ["Source section", rule.sourceSection],
  ];
  const shown = rows.filter((row): row is [string, string] => Boolean(row[1]));
  return (
    <div className="mt-1.5">
      <details>
        <summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.12em] text-pink-100/60">Command rule detail</summary>
        <dl className="mt-1 rounded-lg border border-white/[.06] bg-white/[.02] px-2">
          {shown.map(([label, value]) => <div key={label} className="grid grid-cols-[96px_1fr] gap-2 border-b border-white/[.04] py-1 text-[9px] leading-4 last:border-b-0"><dt className="text-[8px] font-black uppercase tracking-[.08em] text-slate-500">{label}</dt><dd className="text-slate-300">{value}</dd></div>)}
        </dl>
      </details>
      {rule.sourceGaps.length ? <p className="mt-1 text-[8px] leading-3 text-amber-100/70"><b>SOURCE_GAP</b> — in the source document, not extracted: {rule.sourceGaps.join("; ")}.</p> : null}
      {rule.caveats.map((caveat) => <p key={caveat} className="mt-1 text-[8px] leading-3 text-amber-100/60">{caveat}</p>)}
    </div>
  );
}

function EvidenceCard({ record, highlighted, onFocus }: { record: EvidenceRecord; highlighted: boolean; onFocus: (record: EvidenceRecord) => void }) {
  const url = safeUrl(record.sourceUrl);
  const hasPoint = record.geometry.type === "Point";
  return (
    <article id={`evidence-${record.id}`} data-testid="aor-evidence-card" className={`border-b border-white/[.06] py-3 last:border-b-0 ${highlighted ? "bg-cyan-200/[.05]" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <FreshnessBadge freshness={record.freshness} />
        {record.recommendationType ? <Chip tone="border-teal-300/25 text-teal-100">Recommendation: {pretty(record.recommendationType)}</Chip> : null}
        {record.requirementType ? <Chip tone="border-amber-300/35 text-amber-100">{REQUIREMENT_LABELS[record.requirementType] ?? `Entry requirement: ${pretty(record.requirementType)}`}</Chip> : null}
        {record.category === "ihr_temporary_recommendation" ? <Chip tone="border-sky-300/35 text-sky-100">WHO IHR — addressed to the State, not national law</Chip> : null}
        {typeof record.extra?.verificationStatus === "string" ? <Chip tone={STATUS_CHIP_TONE[record.extra.verificationStatus] ?? "border-white/10 text-slate-300"}>{record.extra.verificationStatus}</Chip> : null}
        {Array.isArray(record.extra?.qualifiers) ? (record.extra.qualifiers as string[]).map((flag) => <Chip key={flag} tone="border-rose-300/30 text-rose-100">{flag}</Chip>) : null}
        {record.extra?.ruleClass === "combatant_command" ? <Chip tone="border-pink-300/35 text-pink-100">U.S. Combatant Command policy — not host-nation law, not CDC/WHO</Chip> : null}
        {(record.extra?.commandRule as CommandRuleView | undefined)?.kind ? <Chip tone="border-pink-300/20 text-pink-100/80">{COMMAND_KIND_LABEL[(record.extra?.commandRule as CommandRuleView).kind] ?? pretty((record.extra?.commandRule as CommandRuleView).kind)}</Chip> : null}
        {(record.extra?.commandRule as CommandRuleView | undefined)?.status ? <Chip>{pretty((record.extra?.commandRule as CommandRuleView).status as string)}</Chip> : null}
        {record.severity ? <Chip>{record.severity}</Chip> : null}
      </div>
      <h4 className="mt-1.5 text-[11px] font-bold leading-4 text-white/90">{record.title}</h4>
      {record.summary ? <p className="mt-1 text-[10px] leading-4 text-slate-300">{record.summary}</p> : null}
      {record.geographyNote ? <p className="mt-1 text-[9px] leading-4 text-slate-500">Geography ({pretty(record.geographyLevel)}): {record.geographyNote}</p> : <p className="mt-1 text-[9px] text-slate-500">Geography: {pretty(record.geographyLevel)}</p>}
      <RuleDetails record={record} />
      <CommandRuleDetails record={record} />
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
  const model = (record.extra?.malaria ?? {}) as { riskScope?: string; areasMentioned?: string | null; places?: Array<{ name: string; kind: string; risk: "risk" | "no_risk"; seasonality: string | null; elevationLimitMeters: number | null }>; seasonality?: string | null; altitudeNote?: string | null; altitudeLimitMeters?: number | null; altitudeScope?: string | null; altitudeScopeNote?: string | null; preventionDrugs?: string[]; preventionStatement?: string | null };
  const row = (label: string, value: ReactNode) => <div className="grid grid-cols-[92px_1fr] gap-2 border-b border-white/[.05] py-1.5 text-[10px] leading-4"><dt className="text-[8px] font-black uppercase tracking-[.1em] text-slate-500">{label}</dt><dd className="text-slate-200">{value}</dd></div>;
  const stated = (value?: string | null) => value || <span className="text-slate-500">Not stated in the retrieved source text</span>;
  return (
    <dl className="mb-2 rounded-xl border border-amber-200/10 bg-amber-200/[.03] px-3 py-1">
      {row("Risk scope", pretty(model.riskScope || "unspecified"))}
      {row("Risk areas", model.riskScope === "parts_of_country" ? <>{stated(model.areasMentioned)}<span className="mt-1 block text-slate-500">Named areas are quoted from the source text; no authoritative admin-level geometry is connected, so they are not drawn.</span></> : model.riskScope === "country_wide" ? "Country-wide, per source text" : model.riskScope === "none_stated" ? "No transmission stated by source" : stated(null))}
      {model.places?.length ? row("Named places", <><ul className="space-y-1">{model.places.map((place) => <li key={place.name + place.risk}><b className="text-white/85">{place.name}</b> <span className="text-slate-500">({pretty(place.kind)})</span> — {place.risk === "no_risk" ? <span className="text-emerald-200/80">source states no risk</span> : <span className="text-amber-100/90">risk named</span>}{place.seasonality ? <span className="text-slate-400">; {place.seasonality}</span> : null}{place.elevationLimitMeters ? <span className="text-slate-400">; elevation limit {place.elevationLimitMeters.toLocaleString()} m stated for this place</span> : null}</li>)}</ul><span className="mt-1 block text-slate-500">Listed from the CDC sentences, not drawn: no authoritative sub-national boundary is connected, and an outline would overstate what the text says.</span></>) : null}
      {row("Seasonality", stated(model.seasonality))}
      {row("Altitude limits", model.altitudeNote ? <>{model.altitudeNote}{model.altitudeLimitMeters ? <span className="mt-1 block text-amber-100/80">Terrain above {model.altitudeLimitMeters.toLocaleString()} m is tinted on the globe because the source text states a transmission limit at that elevation (heights from Cesium World Terrain).</span> : <span className="mt-1 block text-slate-500">{model.altitudeScopeNote ?? "No explicit elevation limit could be read from this text, so no terrain tint is drawn."}</span>}</> : stated(null))}
      {row("Prevention drugs", model.preventionDrugs?.length ? model.preventionDrugs.join(", ") : stated(null))}
      {row("Prevention text", stated(model.preventionStatement))}
      {row("Source date", formatDate(record.updatedAt) || <span className="text-slate-500">Not stated</span>)}
    </dl>
  );
}

function YellowBookCard({ record, evidenceById, onSelectEvidence }: { record: EvidenceRecord; evidenceById: Map<string, EvidenceRecord>; onSelectEvidence: (id: string) => void }) {
  const extra = (record.extra ?? {}) as { endemicity?: string; atRisk?: string; prevention?: string; keyNotes?: string[]; operationalRules?: string[]; sourceAssets?: Array<{ type: string; id: string; page: number; title: string; excerpt: string }>; pages?: [number, number]; linkedEvidence?: Array<{ evidenceId: string }> };
  const rules = extra.operationalRules ?? [];
  const assets = extra.sourceAssets ?? [];
  const links = (extra.linkedEvidence ?? []).filter((link) => evidenceById.has(link.evidenceId));
  return (
    <article id={`evidence-${record.id}`} data-testid="aor-yellow-book-card" className="border-b border-white/[.06] py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-1.5"><Chip tone="border-slate-300/25 text-slate-300">Reference</Chip><FreshnessBadge freshness={record.freshness} /></div>
      <h4 className="mt-1 text-[11px] font-bold text-white/90">{record.title}</h4>
      <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{record.summary}</p>
      {links.length ? <div className="mt-1 flex flex-wrap gap-1"><span className="text-[8px] text-slate-500">Linked to:</span>{links.slice(0, 5).map((link) => <button key={link.evidenceId} type="button" onClick={() => onSelectEvidence(link.evidenceId)} className="rounded-full border border-cyan-200/15 px-1.5 py-0.5 text-[8px] font-bold text-cyan-100/70 hover:bg-cyan-200/10">{evidenceById.get(link.evidenceId)?.title.slice(0, 34)}</button>)}</div> : null}
      {rules.length || assets.length || extra.keyNotes?.length ? <details className="mt-1.5">
        <summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.1em] text-slate-500">Chapter rules and source tables (pp. {extra.pages?.[0]}–{extra.pages?.[1]})</summary>
        {rules.length ? <ul className="mt-1 list-disc space-y-1 pl-4 text-[9px] leading-4 text-slate-300">{rules.map((rule) => <li key={rule}>{rule}</li>)}</ul> : null}
        {assets.length ? <ul className="mt-1.5 space-y-1 text-[9px] leading-4 text-slate-400">{assets.map((asset) => <li key={`${asset.type}-${asset.id}`}><b className="text-slate-300">{asset.title}</b> (p. {asset.page}) — {asset.excerpt}</li>)}</ul> : null}
      </details> : null}
      <p className="mt-1 text-[8px] leading-3 text-slate-500">{record.geographyNote}</p>
    </article>
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
  synthesis: SynthesisResponse | null;
  synthesisLoading: boolean;
  environment: Record<EnvironmentKey, boolean>;
  onToggleEnvironment: (key: EnvironmentKey) => void;
};

export function AorIntelPanel({ intel, loading, error, countryName, aorLabel, hasPolygon, activeTab, setActiveTab, highlightedId, onFocusEvidence, onSelectEvidence, onClose, lens, synthesis, synthesisLoading, environment, onToggleEnvironment }: Props) {
  const byDimension = useMemo(() => {
    const map = new Map<Dimension, EvidenceRecord[]>();
    for (const record of intel?.evidence ?? []) map.set(record.dimension, [...(map.get(record.dimension) ?? []), record]);
    return map;
  }, [intel]);

  const evidenceById = useMemo(() => new Map((intel?.evidence ?? []).map((record) => [record.id, record])), [intel]);

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
        {synthesisLoading ? <p className="mt-2 flex items-center gap-2 text-[9px] text-slate-500"><Loader2 size={10} className="animate-spin" />Preparing evidence-checked AI briefing…</p> : null}
        {synthesis?.status === "applied" ? <section data-testid="aor-ai-briefing" className="mt-2 rounded-xl border border-violet-200/12 bg-violet-200/[.035] px-3 py-2">
          <h3 className="text-[8px] font-black uppercase tracking-[.12em] text-violet-200/80">AI briefing — every line cites evidence</h3>
          <ol className="mt-1.5 space-y-2">{synthesis.statements.map((statement, index) => (
            <li key={index} className="text-[10px] leading-4 text-slate-200">{statement.text}
              <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">{statement.evidenceIds.filter((id) => evidenceById.has(id)).slice(0, 4).map((id, i) => <button key={id} type="button" onClick={() => onSelectEvidence(id)} title={evidenceById.get(id)?.title} className="rounded-full border border-violet-200/20 px-1.5 text-[8px] font-bold text-violet-100/80 hover:bg-violet-200/10">[{i + 1}]</button>)}</span>
            </li>
          ))}</ol>
          <p className="mt-1.5 text-[8px] leading-3 text-slate-500">{synthesis.note}</p>
        </section> : synthesis && synthesis.status !== "not_configured" ? <p className="mt-2 text-[9px] leading-4 text-slate-500">AI briefing not shown: {synthesis.note}</p> : null}
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
          {source.lastAttemptedFetch || source.lastSuccessfulFetch || source.sourceUpdatedAt ? <p className="mt-1 text-[8px] leading-3 text-slate-600">{source.lastAttemptedFetch ? `Last attempt ${formatDate(source.lastAttemptedFetch)}` : ""}{source.lastSuccessfulFetch ? ` · last success ${formatDate(source.lastSuccessfulFetch)}` : source.lastAttemptedFetch ? " · never fetched successfully" : ""}{source.sourceUpdatedAt ? ` · source dated ${formatDate(source.sourceUpdatedAt)}` : ""}{source.sourceError && source.status !== "ok" ? ` · error: ${source.sourceError}` : ""}{source.status === "stale_cache" ? " · showing last-known data" : ""}</p> : null}
        </li>
      ))}</ul>;
    }
    const records = byDimension.get(activeTab) ?? [];
    const statuses = intel.sources.filter((source) => source.dimension === activeTab || (source.dimension === "multi" && (activeTab === "health_vaccines" || activeTab === "malaria")));
    const empty = !records.length ? <div className="py-3 text-[10px] leading-4 text-slate-400"><p>No evidence records for {DIMENSION_LABELS[activeTab].toLowerCase()}. This is not proof of absence — source status:</p><ul className="mt-2 space-y-1">{statuses.map((source) => <li key={source.sourceId} className="text-[9px]"><b className="text-white/70">{source.sourceName}</b> — <span className={STATUS_TONE[source.status]}>{STATUS_LABELS[source.status]}</span>{source.note ? <span className="text-slate-500"> · {source.note}</span> : null}</li>)}</ul></div> : null;

    if (activeTab === "health_vaccines") {
      const group = (title: string, items: EvidenceRecord[], note?: string) => items.length ? <section className="mb-3"><h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">{title}</h3>{note ? <p className="mb-1 text-[9px] leading-4 text-slate-500">{note}</p> : null}{items.map((record) => <EvidenceCard key={record.id} record={record} highlighted={record.id === highlightedId} onFocus={onFocusEvidence} />)}</section> : null;
      const entry = intel.sources.find((s) => s.sourceId === "destination-entry-requirements");
      const isRule = (r: EvidenceRecord) => Boolean(r.extra?.vaccineRule);
      const ruleRecords = records.filter((r) => (r.category === "entry_requirement" || r.category === "exit_requirement") && isRule(r));
      const cdcText = records.filter((r) => r.category === "entry_requirement" && !isRule(r));
      const whoPolio = records.filter((r) => r.category === "ihr_temporary_recommendation");
      const conflicts = records.filter((r) => r.category === "entry_rule_conflict");
      const coverage = records.filter((r) => r.category === "entry_requirement_coverage");
      const sourceChecks = records.filter((r) => r.category === "rule_source_check");
      const yellowBook = records.filter((r) => r.category === "yellow_book_reference");
      return <div>{empty}
        {group("Routine vaccines", records.filter((r) => r.category === "routine_vaccine"))}
        {group("Travel vaccines — CDC recommendations", records.filter((r) => r.category === "travel_vaccine"), "Medical recommendations only. These are not legal entry requirements.")}
        {group("Entry / exit / transit / event requirements — legal rules", ruleRecords, "Destination authority first, then WHO, then CDC/WHO baselines. Each rule shows who it applies to (origin, transit, age, residents, event), the certificate, the authority and when it was published and last verified. Never inferred from recommendations.")}
        {group("WHO polio IHR temporary recommendations — not national law", whoPolio, "Addressed by WHO to the listed State for residents and long-term visitors leaving it. Whether the State enforces them is a separate fact.")}
        {group("Source disagreements — preserved", conflicts, "The newer, higher-authority statement is shown above; the older statement is kept here so the change is visible.")}
        {group("Entry-requirement wording in the CDC destination text — corroboration only", cdcText, "Quoted from the CDC page for this country. CDC is a medical authority; the destination government controls the legal rule.")}
        {group("Rule coverage and sources to check", coverage)}
        {coverage.map((record) => { const links = (record.extra?.sourcesToCheck ?? []) as Array<{ authority: string; check: string; url: string }>; return links.length ? <ul key={record.id} className="mb-3 space-y-1 text-[9px] leading-4 text-slate-400">{links.map((link) => { const href = safeUrl(link.url); return <li key={link.url}>{href ? <a href={href} target="_blank" rel="noreferrer" className="font-bold text-cyan-100/65 hover:text-cyan-50">{link.authority}</a> : link.authority} — {link.check}</li>; })}</ul> : null; })}
        {group("Official rule pages — reachability and change check", sourceChecks, "Last-known details are labelled when a page could not be reached.")}
        {entry && entry.status !== "ok" && !ruleRecords.length && !coverage.length ? <p className="mb-3 rounded-lg border border-amber-300/15 bg-amber-300/[.04] px-3 py-2 text-[10px] leading-4 text-amber-100/80">{entry.note || "Entry requirements were not evaluated."}</p> : null}
        {group("Destination disease risks (CDC)", records.filter((r) => r.category === "destination_disease_risk"))}
        {group("Childhood immunization coverage (WHO/UNICEF WUENIC)", records.filter((r) => r.category === "immunization_coverage"), "Annual national programme estimates for the resident population — not a traveler recommendation and not current conditions.")}
        {yellowBook.length ? <section className="mb-3"><h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">CDC Yellow Book reference</h3><p className="mb-1 text-[9px] leading-4 text-slate-500">Clinical and operational chapters for diseases named above. Reference context, not current country guidance.</p>{yellowBook.map((record) => <YellowBookCard key={record.id} record={record} evidenceById={evidenceById} onSelectEvidence={onSelectEvidence} />)}</section> : null}
        {group("Other health guidance", records.filter((r) => !["routine_vaccine", "travel_vaccine", "entry_requirement", "exit_requirement", "ihr_temporary_recommendation", "entry_rule_conflict", "entry_requirement_coverage", "rule_source_check", "destination_disease_risk", "immunization_coverage", "yellow_book_reference"].includes(r.category)))}
      </div>;
    }
    if (activeTab === "command_policy") {
      const group = (title: string, items: EvidenceRecord[], note?: string) => items.length ? <section className="mb-3"><h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">{title}</h3>{note ? <p className="mb-1 text-[9px] leading-4 text-slate-500">{note}</p> : null}{items.map((record) => <EvidenceCard key={record.id} record={record} highlighted={record.id === highlightedId} onFocus={onFocusEvidence} />)}</section> : null;
      const ruleRecords = records.filter((r) => r.category === "command_rule");
      const domainOf = (r: EvidenceRecord) => String((r.extra?.commandRule as CommandRuleView | undefined)?.domain ?? "");
      const waiver = ruleRecords.filter((r) => domainOf(r) === "waiver");
      const supplements = ruleRecords.filter((r) => ["supplement", "guidance"].includes(domainOf(r)));
      const conditions = ruleRecords.filter((r) => domainOf(r) === "condition");
      const pcs = ruleRecords.filter((r) => domainOf(r) === "pcs");
      const clearance = ruleRecords.filter((r) => domainOf(r) === "clearance");
      const grouped = new Set([...waiver, ...supplements, ...conditions, ...pcs, ...clearance].map((r) => r.id));
      const core = ruleRecords.filter((r) => !grouped.has(r.id));
      return <div>{empty}
        <p className="mb-3 rounded-lg border border-pink-300/15 bg-pink-300/[.04] px-3 py-2 text-[10px] leading-4 text-pink-50/80">U.S. Combatant Command deployment policy for DoD-affiliated travelers. It is a separate rule class from host-nation entry law and from CDC/WHO recommendations; none of the three replaces another.</p>
        {group("Area of responsibility", records.filter((r) => r.category === "command_assignment"), "Built from public DoD and command material; the Unified Command Plan itself is classified. Superseded assignments are kept as history.")}
        {group("Command medical policy", records.filter((r) => r.category === "command_policy"))}
        {group("Superseded policy — history only", records.filter((r) => r.category === "command_policy_superseded"), "Kept so the change is visible; no superseded rule text is shown.")}
        {group("Core theater medical rules", core)}
        {group("Medical conditions (command standards)", conditions, "Applies only if the person has the condition described.")}
        {group("Waiver authority and routing", waiver, "The evaluating clinic or local commander is not necessarily the final waiver authority.")}
        {group("PCS rules", pcs)}
        {group("Command supplements and guidance", supplements, "Each item carries its own force: a command recommendation is not a requirement.")}
        {group("Theater clearance — separate from medical suitability", clearance)}
        {group("Official command pages — reachability and change check", records.filter((r) => r.category === "command_source_check"), "A changed page is flagged for review; extracted rules are never rewritten automatically.")}
      </div>;
    }
    if (activeTab === "malaria") {
      return <div>{empty}{records.map((record) => record.category === "yellow_book_reference" ? <YellowBookCard key={record.id} record={record} evidenceById={evidenceById} onSelectEvidence={onSelectEvidence} /> : <div key={record.id}><MalariaModel record={record} /><EvidenceCard record={record} highlighted={record.id === highlightedId} onFocus={onFocusEvidence} /></div>)}</div>;
    }
    if (activeTab === "environment") {
      const sortedEnv = [...records].sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0));
      const malariaRecord = (byDimension.get("malaria") ?? []).find((r) => r.category === "malaria");
      const altitudeLimit = ((malariaRecord?.extra?.malaria ?? {}) as { altitudeLimitMeters?: number | null }).altitudeLimitMeters ?? null;
      const related = (key: EnvironmentKey): { text: string; ids: string[] } => {
        const climate = records.filter((r) => r.category === "climatology");
        const air = records.filter((r) => r.category === "air_quality_station");
        if (key === "heat" || key === "cold") return climate.length ? { text: `Climatological reference: ${climate[0].summary}`, ids: [climate[0].id] } : { text: "No climatology record is available for this country (see source status).", ids: [] };
        if (key === "poorAir") return air.length ? { text: `${air.length} station reading${air.length === 1 ? "" : "s"} from OpenAQ (latest values, not an AQI).`, ids: air.slice(0, 1).map((r) => r.id) } : { text: "No fresh station reading is available (OpenAQ key, coverage or recency). Dust and smoke are not otherwise evaluated.", ids: [] };
        if (key === "altitude") return malariaRecord && altitudeLimit ? { text: `CDC malaria text states a transmission limit at ${altitudeLimit.toLocaleString()} m; terrain above it is tinted when the Malaria layer is on. Country elevation itself is not evaluated.`, ids: [malariaRecord.id] } : { text: "No elevation data source is connected for this country. Review terrain on the globe.", ids: [] };
        return { text: "Deployment-context factor with no country data source; it only feeds the condition × deployment review.", ids: [] };
      };
      const active = ENVIRONMENT_KEYS.filter((key) => environment[key]);
      return <div>
        <section className="mb-3" aria-label="Deployment environment factors">
          <h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Deployment environment</h3>
          <p className="mb-1.5 text-[9px] leading-4 text-slate-500">Select factors that apply to the assignment. They are shown against the evidence below and carried into the condition × deployment review.</p>
          <div className="grid grid-cols-2 gap-1.5">{ENVIRONMENT_KEYS.map((key) => <button key={key} type="button" aria-pressed={environment[key]} onClick={() => onToggleEnvironment(key)} className={`min-h-9 rounded-[11px] border px-2 text-left text-[9px] font-bold transition ${environment[key] ? "border-amber-100/20 bg-amber-200/[.08] text-amber-50" : "border-white/[.06] bg-white/[.02] text-slate-400 hover:bg-white/[.045]"}`}>{ENVIRONMENT_LABELS[key]}</button>)}</div>
          {active.length ? <ul className="mt-2 space-y-1.5">{active.map((key) => { const info = related(key); return <li key={key} className="rounded-lg border border-white/[.06] px-2.5 py-1.5 text-[9px] leading-4 text-slate-300"><b className="text-white/85">{ENVIRONMENT_LABELS[key]}</b> — {info.text}{info.ids.map((id) => <button key={id} type="button" onClick={() => onSelectEvidence(id)} className="ml-1 rounded-full border border-cyan-200/15 px-1.5 text-[8px] font-bold text-cyan-100/70 hover:bg-cyan-200/10">evidence</button>)}</li>; })}</ul> : null}
        </section>
        {empty}{sortedEnv.map((record) => <EvidenceCard key={record.id} record={record} highlighted={record.id === highlightedId} onFocus={onFocusEvidence} />)}
      </div>;
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
