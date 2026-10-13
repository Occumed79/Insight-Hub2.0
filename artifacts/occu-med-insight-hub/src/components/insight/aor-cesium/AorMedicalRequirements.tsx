import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, BadgeCheck, ChevronDown, CircleHelp, GitFork, Loader2, MinusCircle, RotateCw, ShieldAlert } from "lucide-react";
import { COMMAND_VIEW, EVIDENCE_CLASS_LABEL, type DirectoryIndex, type DirectoryLocation, type SplitParent } from "./aor-directory";
import {
  CIVILIAN_CATEGORY_OPTIONS, EMPTY_MEDICAL_INPUTS, POPULATION_OPTIONS, REQUIREMENT_STATUSES, TRAVEL_KIND_OPTIONS,
  type AuthorityLayer, type MedicalInputs, type RequirementCategory, type RequirementItem, type RequirementStatus, type Tri,
} from "./aor-medical-types";
import type { MedicalState } from "./use-medical-applicability";

const STATUS_STYLE: Record<RequirementStatus, { label: string; meaning: string; chip: string; card: string; Icon: typeof ShieldAlert }> = {
  REQUIRED: { label: "Required", meaning: "A cited authority requires this for the details entered.", chip: "border-rose-300/60 bg-rose-400/15 text-rose-50", card: "border-l-rose-300/80", Icon: ShieldAlert },
  RECOMMENDED: { label: "Recommended", meaning: "Recommended by a cited authority. Not a legal or command requirement.", chip: "border-emerald-300/50 bg-emerald-400/10 text-emerald-50", card: "border-l-emerald-300/70", Icon: BadgeCheck },
  CONDITIONAL: { label: "Conditional", meaning: "Applies only if a stated condition is met.", chip: "border-amber-300/55 bg-amber-300/10 text-amber-50", card: "border-l-amber-300/75", Icon: GitFork },
  NOT_APPLICABLE: { label: "Not applicable", meaning: "A cited rule does not reach this assignment.", chip: "border-slate-400/35 bg-slate-400/10 text-slate-200", card: "border-l-slate-400/50", Icon: MinusCircle },
  UNKNOWN: { label: "Unknown", meaning: "Cannot be determined — an input or a source is missing. This is not the same as “not required”.", chip: "border-dashed border-violet-300/60 bg-violet-400/10 text-violet-50", card: "border-l-violet-300/60", Icon: CircleHelp },
};

const LAYER_LABEL: Record<AuthorityLayer, string> = { combatant_command: "Combatant Command", dod_issuance: "DoD issuance", host_nation: "Host nation", public_health: "CDC / WHO guidance" };
const LAYER_TONE: Record<AuthorityLayer, string> = { combatant_command: "border-pink-300/35 text-pink-100", dod_issuance: "border-fuchsia-300/35 text-fuchsia-100", host_nation: "border-sky-300/35 text-sky-100", public_health: "border-teal-300/35 text-teal-100" };
const CATEGORY_LABEL: Record<RequirementCategory, string> = {
  immunization: "Immunizations", malaria_chemoprophylaxis: "Malaria chemoprophylaxis", infectious_disease_screening: "Infectious-disease screening", medical_screening: "Medical screening",
  medical_examination: "Medical examination", medication_equipment: "Medication / equipment", waiver_disqualifying_condition: "Waivers & disqualifying conditions", documentation: "Documentation",
  clearance_process: "Clearance process", other: "Other",
};
const EFFECTIVE_LABEL = { in_effect: "In effect", not_yet_effective: "Not yet effective", effective_date_not_established: "Effective date not established", withdrawn: "Withdrawn" } as const;
const CONTRACTOR_LABEL: Record<RequirementItem["appliesToContractors"], string> = {
  named_in_source: "Contractors are named in the source",
  as_directed_by_command_or_contract: "Reaches contractors only as directed by the command or the contract / SOW",
  not_named_in_source: "Contractors are not named in the source",
  all_travelers: "Applies to all travelers",
  not_applicable_to_layer: "Not a contractor-specific question for this layer",
};
const COVERAGE_LABEL: Record<string, string> = {
  evaluated: "Evaluated", no_public_policy: "No public policy", partial: "Partial", not_supplied: "Not supplied", unavailable: "Unavailable", not_integrated: "Not integrated", no_rule_in_source_set: "No rule in the source set", not_evaluated: "Not evaluated",
};

const pretty = (value: string) => value.replace(/_/g, " ");
function fmtDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function safeUrl(value: string | null | undefined) {
  try { const url = new URL(String(value)); return url.protocol === "https:" ? url.toString() : ""; } catch { return ""; }
}

export function StatusBadge({ status, size = "sm" }: { status: RequirementStatus; size?: "sm" | "md" }) {
  const style = STATUS_STYLE[status];
  const Icon = style.Icon;
  return <span data-testid={`aor-status-${status}`} className={`inline-flex items-center gap-1 rounded-full border font-semibold ${size === "md" ? "px-2.5 py-1 text-footnote" : "px-2 py-0.5 text-caption"} ${style.chip}`}><Icon size={size === "md" ? 13 : 11} aria-hidden />{style.label}</span>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[100px_1fr] gap-3 border-b border-white/[.05] py-1.5 text-footnote leading-5 last:border-b-0"><dt className="text-footnote text-slate-500">{label}</dt><dd className="break-words text-slate-200">{children}</dd></div>;
}

function RequirementCard({ item, hideCaveat = false }: { item: RequirementItem; hideCaveat?: boolean }) {
  const url = safeUrl(item.authority.sourceUrl);
  const trigger = item.trigger;
  const triggerRows: Array<[string, string | null]> = [
    ["Applies to", trigger.populations || null],
    ["Minimum stay", trigger.minimumStay],
    ["Maximum stay", trigger.maximumStay],
    ["Component", trigger.component],
    ["Travel scope", trigger.travelScope],
    ["Threshold / rule", trigger.thresholdOrRule],
  ];
  const exemptions = item.exceptions;
  const verification = item.verification;
  return (
    <article data-testid="aor-requirement-card" data-status={item.status} data-layer={item.layer} data-requirement-id={item.id} id={`req-${item.id.replace(/[^a-z0-9_-]/gi, "_")}`} className={`group/card lg-section rounded-[12px] border-l-[3px] px-4 py-3.5 ${STATUS_STYLE[item.status].card}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-headline font-semibold leading-5 text-white">{item.title}</h4>
        <span className="shrink-0 pt-0.5 text-footnote text-slate-500">{LAYER_LABEL[item.layer]}</span>
      </div>
      <p className="mt-1 line-clamp-3 text-body leading-[1.45] text-slate-300 group-has-[details[open]]/card:line-clamp-none">{item.requirement}</p>
      {item.assignmentCaveat && !hideCaveat ? <p className="mt-2 flex gap-1.5 text-callout leading-5 text-amber-100/90"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{item.assignmentCaveat}</p> : null}
      {item.missingInputs.length ? (
        <p data-testid="aor-requirement-missing" className="mt-2 text-callout leading-5 text-violet-100/90">
          <span className="font-semibold">To decide this, add:</span> {item.missingInputs.join("; ")}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-slate-500">
        <span>{item.authority.issuer}{item.authority.policyId ? ` · ${item.authority.policyId}` : ""}</span>
        {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-cyan-200/90 hover:text-cyan-100">Source<ArrowUpRight size={12} /></a> : null}
        {item.verification?.state === "unconfirmed_historical" ? <span className="text-amber-200/90">Older baseline, not confirmed</span> : null}
      </div>

      <details className="group mt-2">
        <summary className="cursor-pointer list-none text-footnote font-medium text-slate-400 hover:text-slate-200"><span className="group-open:hidden">Show details</span><span className="hidden group-open:inline">Hide details</span></summary>
        {item.why.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-callout leading-5 text-slate-400">{item.why.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : null}
        <dl className="mt-2 rounded-[6px] bg-white/[.03] px-3">
          <Row label="Category">{CATEGORY_LABEL[item.category]}</Row>
          <Row label="Authority">{item.authority.issuer}{item.authority.policyId ? ` · ${item.authority.policyId}` : ""}{item.authority.sourceSection ? ` · ${item.authority.sourceSection}` : ""}</Row>
          <Row label="Source">{url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-cyan-200/90 hover:text-cyan-100">{item.authority.policyTitle || "Open source"}<ArrowUpRight size={12} /></a> : item.authority.policyTitle || "Source link not available"}</Row>
          <Row label="Published">{fmtDate(item.authority.publishedDate) ?? <span className="text-slate-500">Not stated by the source</span>} <span className="text-slate-500">· {item.authority.verificationStatus}</span></Row>
          <Row label="Effective">{EFFECTIVE_LABEL[item.effective.status]}{item.effective.effectiveFrom ? ` from ${fmtDate(item.effective.effectiveFrom)}` : ""}{item.effective.effectiveTo ? ` to ${fmtDate(item.effective.effectiveTo)}` : ""}<span className="mt-0.5 block text-slate-500">{item.effective.note}</span></Row>
          <Row label="Contractors">{CONTRACTOR_LABEL[item.appliesToContractors]}{item.contractualNote ? <span className="mt-0.5 block text-slate-500">{item.contractualNote}</span> : null}</Row>
        </dl>
        <dl className="mt-1 rounded-[6px] border border-white/[.05] bg-white/[.015] px-2">
          {triggerRows.filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => <Row key={label} label={label}>{value}</Row>)}
          {trigger.conditions.length ? <Row label="Conditions"><ul className="list-disc space-y-0.5 pl-3.5">{trigger.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></Row> : null}
          {exemptions.exemptDestinations.length ? <Row label="Exempt">{exemptions.exemptDestinations.join(", ")}{exemptions.exemptionCondition ? ` — ${exemptions.exemptionCondition}` : ""}</Row> : null}
          {exemptions.waiverAuthority ? <Row label="Waiver">{exemptions.waiverAuthority}</Row> : null}
          {exemptions.policyStatus ? <Row label="Policy status">{exemptions.policyStatus}</Row> : null}
          {exemptions.notes.length ? <Row label="Notes">{exemptions.notes.join(" ")}</Row> : null}
          {item.authority.citedDodInstructions.length ? <Row label="Cites">{item.authority.citedDodInstructions.join(", ")}</Row> : null}
        </dl>
        {verification ? (
          <div className="mt-1.5 rounded-[6px] border border-amber-300/20 bg-amber-300/[.04] px-2 py-1.5 text-footnote leading-4 text-amber-50/85">
            <b>{verification.state === "unconfirmed_historical" ? "Verification gap" : "Verified against a current source"}</b>
            {verification.possibleRequirement ? <p className="mt-0.5">Possible requirement (not confirmed): {verification.possibleRequirement}</p> : null}
            {verification.gap ? <p className="mt-0.5">{verification.gap}</p> : null}
            {verification.historicalEvidence ? <p className="mt-0.5 text-amber-100/70">Historical evidence: {verification.historicalEvidence.authority} ({verification.historicalEvidence.verificationStatus}){verification.historicalEvidence.sourcePublishedAt ? `, published ${fmtDate(verification.historicalEvidence.sourcePublishedAt)}` : ""}; retrieved {fmtDate(verification.historicalEvidence.retrievedAt)}{verification.historicalEvidence.productionVerificationRequired ? "; re-read the source before operational use" : ""}.</p> : null}
            {verification.liveCorroboration.length ? <ul className="mt-0.5 list-disc pl-4 text-amber-100/70">{verification.liveCorroboration.map((entry) => <li key={entry.itemId}>{entry.authority}: {entry.text}{entry.retrievedAt ? ` (retrieved ${fmtDate(entry.retrievedAt)})` : ""}</li>)}</ul> : null}
          </div>
        ) : null}
        {item.evidence.sourceWording ? <p className="mt-1.5 whitespace-pre-wrap rounded-[6px] border border-white/[.05] px-2 py-1.5 text-footnote leading-4 text-slate-400"><b className="text-slate-300">Source wording: </b>{item.evidence.sourceWording}</p> : null}
        {item.evidence.sourceProvenance ? <p className="mt-1 text-caption leading-3 text-slate-500">Provenance: {item.evidence.sourceProvenance}</p> : null}
        {item.evidence.sourceGaps.length ? <p className="mt-1 text-caption leading-3 text-amber-100/70"><b>SOURCE_GAP</b> — in the source, not extracted: {item.evidence.sourceGaps.join("; ")}.</p> : null}
        {item.evidence.caveats.map((caveat) => <p key={caveat} className="mt-1 text-caption leading-3 text-amber-100/60">{caveat}</p>)}
        {item.displacedEvidence.length ? <p className="mt-1 text-caption leading-3 text-slate-500"><b>Earlier or conflicting evidence kept, not applied:</b> {item.displacedEvidence.join(" ")}</p> : null}
      </details>
    </article>
  );
}

const selectClass = "h-10 w-full rounded-[10px] bg-white/[.07] px-3 text-callout text-white outline-none ring-cyan-300/50 focus:ring-2";
const inputClass = "h-10 w-full rounded-[10px] bg-white/[.07] px-3 text-callout text-white outline-none ring-cyan-300/50 placeholder:text-slate-500 focus:ring-2";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-1 block text-footnote font-medium text-slate-400">{label}</span>{children}{hint ? <span className="mt-1 block text-caption leading-4 text-slate-500">{hint}</span> : null}</label>;
}

function TriField({ label, value, onChange, testId }: { label: string; value: Tri; onChange: (value: Tri) => void; testId: string }) {
  return (
    <div role="group" aria-label={label}>
      <span className="mb-1 block text-footnote font-medium text-slate-400">{label}</span>
      <div className="inline-flex rounded-full bg-white/[.07] p-0.5">
        {([["", "Not set"], ["yes", "Yes"], ["no", "No"]] as Array<[Tri, string]>).map(([option, text]) => (
          <button key={option || "unset"} type="button" data-testid={`${testId}-${option || "unset"}`} aria-pressed={value === option} onClick={() => onChange(option)} className={`lg-press h-7 rounded-full px-3.5 text-footnote font-medium ${value === option ? "lg-lens" : "text-slate-400 hover:text-white"}`}>{text}</button>
        ))}
      </div>
    </div>
  );
}

type Props = {
  location: DirectoryLocation | null;
  split: SplitParent | null;
  directory: DirectoryIndex | null;
  inputs: MedicalInputs;
  setInputs: (updater: (current: MedicalInputs) => MedicalInputs) => void;
  state: MedicalState;
  onPickLocation: (id: string) => void;
};

/** Order of the summary tiles: what the reader must act on first. */
const TILE_ORDER: RequirementStatus[] = ["REQUIRED", "CONDITIONAL", "RECOMMENDED", "UNKNOWN", "NOT_APPLICABLE"];
const TILE_NUMBER: Record<RequirementStatus, string> = { REQUIRED: "text-rose-200", CONDITIONAL: "text-amber-200", RECOMMENDED: "text-emerald-200", UNKNOWN: "text-violet-200", NOT_APPLICABLE: "text-slate-300" };
const TILE_LABEL: Record<RequirementStatus, string> = { REQUIRED: "Required", CONDITIONAL: "Conditional", RECOMMENDED: "Recommended", UNKNOWN: "Unknown", NOT_APPLICABLE: "N/A" };
const SECTION_HEADING = "text-callout font-semibold text-slate-300";

export function AorMedicalRequirements({ location, split, directory, inputs, setInputs, state, onPickLocation }: Props) {
  const [filter, setFilter] = useState<RequirementStatus | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const update = <K extends keyof MedicalInputs>(key: K, value: MedicalInputs[K]) => setInputs((current) => ({ ...current, [key]: value }));
  const result = state.result;
  const command = location?.command ?? null;
  const components = useMemo(() => (directory?.directory.supportComponents ?? []).filter((entry) => !command || entry.command === command), [directory, command]);
  const arrivingChoices = useMemo(() => (directory?.directory.locations ?? []).filter((entry) => entry.entityType === "sovereign" && entry.iso3), [directory]);
  const detailsSet = (Object.keys(inputs) as Array<keyof MedicalInputs>).filter((key) => inputs[key] !== EMPTY_MEDICAL_INPUTS[key]).length;

  // Kept visible on every result (tests and policy both require it), but as one quiet line rather than a warning box.
  const disclaimer = (
    <p data-testid="aor-medical-disclaimer" className="flex gap-1.5 text-footnote leading-5 text-slate-500">
      <AlertTriangle size={13} className="mt-1 shrink-0 text-amber-300/70" /><span>Planning information only. <b className="font-semibold text-slate-300">This is not a medical clearance</b> and does not clear, approve or disqualify anyone. Suitability, waivers and theater clearance are decided by the responsible clinician, the command and, for contractors, the contract.</span>
    </p>
  );

  if (split) {
    return (
      <div data-testid="aor-medical-split" className="space-y-4">
        <div>
          <h3 className="text-title-3 font-semibold text-white">{split.name} is split across commands</h3>
          <p className="mt-1 text-body leading-6 text-slate-300">{split.message}</p>
        </div>
        <div>
          <p className={SECTION_HEADING}>Choose a Location</p>
          <ul className="mt-2 space-y-1.5">
            {split.constituentIds.map((id) => {
              const entry = directory?.byId.get(id);
              if (!entry) return null;
              return <li key={id}><button type="button" onClick={() => onPickLocation(id)} className="lg-section lg-press flex w-full items-center justify-between rounded-[12px] px-4 py-3 text-left text-body text-white/90 hover:bg-white/[.06]"><span>{entry.name}</span><span className="text-footnote text-slate-500">{entry.command ? COMMAND_VIEW[entry.command].short : ""}</span></button></li>;
            })}
          </ul>
        </div>
        {disclaimer}
      </div>
    );
  }
  if (!location) return null;

  const visible = (result?.requirements ?? []).filter((item) => !filter || item.status === filter);
  const grouped = TILE_ORDER.map((status) => [status, visible.filter((item) => item.status === status)] as const).filter(([, items]) => items.length);
  const evaluated = result && result.status === "EVALUATED";
  // When every caveated item carries the same caveat (e.g. a regionally inferred AOR), say it once above the list instead of on every card.
  const caveats = [...new Set((result?.requirements ?? []).map((item) => item.assignmentCaveat).filter((text): text is string => Boolean(text)))];
  const sharedCaveat = caveats.length === 1 ? caveats[0] : null;

  return (
    <div data-testid="aor-medical-requirements" aria-busy={state.loading} className="space-y-5">
      {/* 1. The answer. */}
      <div aria-live="polite">
        {state.loading && !evaluated ? (
          <div data-testid="aor-medical-loading" className="space-y-3">
            <p className="flex items-center gap-2 text-body text-slate-300"><Loader2 size={16} className="animate-spin" />Calculating requirements for {location.name}…</p>
            <div className="grid grid-cols-[1fr_1fr_1.25fr_1fr_.75fr] gap-1.5">{TILE_ORDER.map((status) => <div key={status} className="lg-section h-[68px] animate-pulse rounded-[12px]" />)}</div>
            <div className="lg-section h-24 animate-pulse rounded-[12px]" />
          </div>
        ) : null}
        {state.loading && evaluated ? <p data-testid="aor-medical-loading" className="mb-2 flex items-center gap-2 text-footnote text-slate-400"><Loader2 size={13} className="animate-spin" />Updating…</p> : null}
        {state.error ? (
          <div data-testid="aor-medical-error" className="lg-section rounded-[12px] px-4 py-3.5">
            <p className="flex items-center gap-2 text-body font-semibold text-white"><AlertTriangle size={15} className="text-amber-300" />Requirements could not be loaded</p>
            <p className="mt-1 text-callout leading-5 text-slate-300">{state.error} Close and reopen this location to retry.</p>
          </div>
        ) : null}
      </div>

      {result && result.status === "LOCATION_AMBIGUOUS" ? <p className="text-body leading-6 text-slate-300">{result.location.message ?? result.location.ambiguity?.message}</p> : null}

      {evaluated ? (
        <div className={`space-y-5 ${state.loading ? "opacity-60 transition-opacity" : "transition-opacity"}`} data-testid="aor-medical-result" data-revision={state.revision}>
          <section aria-label="Requirement status summary">
            <div className="grid grid-cols-[1fr_1fr_1.25fr_1fr_.75fr] gap-1.5">
              {TILE_ORDER.map((status) => {
                const count = result.byStatus[status] ?? 0;
                const active = filter === status;
                return (
                  <button key={status} type="button" data-testid={`aor-filter-${status}`} aria-pressed={active} title={`${STATUS_STYLE[status].label}: ${STATUS_STYLE[status].meaning}`} aria-label={`${count} ${STATUS_STYLE[status].label}`} onClick={() => setFilter((current) => (current === status ? null : status))} disabled={!count}
                    className={`lg-press rounded-[12px] px-2 py-2.5 text-left disabled:cursor-default disabled:opacity-40 ${active ? "lg-lens" : "lg-section hover:bg-white/[.06]"}`}>
                    <span data-testid={`aor-count-${status}`} className={`block text-title-1 font-semibold leading-7 tabular-nums ${TILE_NUMBER[status]}`}>{count}</span>
                    <span className="mt-0.5 block truncate whitespace-nowrap text-caption font-medium leading-4 tracking-[-.01em] text-slate-400">{TILE_LABEL[status]}</span>
                  </button>
                );
              })}
            </div>
            {filter ? <button type="button" onClick={() => setFilter(null)} className="mt-2 text-footnote font-medium text-cyan-200/90 hover:text-cyan-100">Showing {STATUS_STYLE[filter].label.toLowerCase()} only · show all</button> : null}
          </section>

          {result.missingInformation.length ? (
            <section data-testid="aor-missing-information" aria-label="Missing information" className="lg-section rounded-[12px] px-4 py-3.5">
              <p className="flex items-center gap-2 text-body font-semibold text-white"><span className="h-2 w-2 rounded-full bg-violet-300" />Add assignment details to sharpen this result</p>
              <p className="mt-1 text-callout leading-5 text-slate-300">{[...new Set(result.missingInformation.map((entry) => entry.input.replace(/\s*\(.*$/, "").trim()))].join(" · ")}</p>
              <button type="button" onClick={() => setRefineOpen(true)} className="lg-press mt-3 rounded-full bg-white/[.1] px-3.5 py-1.5 text-callout font-semibold text-white hover:bg-white/[.16]">Add details</button>
            </section>
          ) : null}

          <section aria-label="Requirements" className="space-y-5">
            {sharedCaveat ? <p data-testid="aor-shared-caveat" className="flex gap-2 text-callout leading-5 text-amber-100/90"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{sharedCaveat}</p> : null}
            {grouped.length === 0 ? <p className="text-body text-slate-500">No items match this filter.</p> : null}
            {grouped.map(([status, items]) => (
              <div key={status} data-testid={`aor-group-${status}`}>
                <div className="mb-2 flex items-center gap-2"><StatusBadge status={status} size="md" /><span className="text-footnote tabular-nums text-slate-500">{items.length} item{items.length === 1 ? "" : "s"}</span></div>
                <div className="space-y-2">{items.map((item) => <RequirementCard key={item.id} item={item} hideCaveat={Boolean(sharedCaveat)} />)}</div>
              </div>
            ))}
          </section>
        </div>
      ) : null}

      {/* 2. Refine — optional, out of the way until wanted. */}
      <section aria-label="Assignment details" className="lg-section rounded-[12px]">
        <button type="button" data-testid="aor-refine-toggle" aria-expanded={refineOpen} onClick={() => setRefineOpen((open) => !open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span>
            <span className="block text-body font-semibold text-white">Refine for this assignment</span>
            <span className="block text-footnote text-slate-400">{detailsSet ? `${detailsSet} detail${detailsSet === 1 ? "" : "s"} set` : "Personnel type, length, travel and more. Nothing is assumed."}</span>
          </span>
          <ChevronDown size={18} className={`text-slate-400 transition ${refineOpen ? "rotate-180" : ""}`} />
        </button>
        {refineOpen ? (
          <div className="border-t border-white/[.07] px-4 pb-4 pt-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <div className="col-span-2"><Field label="Personnel type"><select data-testid="aor-input-population" value={inputs.population} onChange={(event) => update("population", event.target.value)} className={selectClass}><option value="">Not set</option>{POPULATION_OPTIONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></Field></div>
              {inputs.population === "dod_civilian" ? <div className="col-span-2"><Field label="Civilian category"><select data-testid="aor-input-civilian" value={inputs.civilianCategory} onChange={(event) => update("civilianCategory", event.target.value)} className={selectClass}><option value="">Not set</option>{CIVILIAN_CATEGORY_OPTIONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></Field></div> : null}
              {inputs.population === "dod_contractor" ? <>
                <div className="col-span-2" role="group" aria-label="Contractor status"><span className="mb-1 block text-footnote font-medium text-slate-400">Contractor status</span><div className="inline-flex rounded-full bg-white/[.07] p-0.5">{([["", "Not set"], ["caaf", "CAAF"], ["non_caaf", "Non-CAAF"]] as Array<[MedicalInputs["contractorAuthorization"], string]>).map(([id, text]) => <button key={id || "unset"} type="button" data-testid={`aor-input-caaf-${id || "unset"}`} aria-pressed={inputs.contractorAuthorization === id} onClick={() => update("contractorAuthorization", id)} className={`lg-press h-7 rounded-full px-3.5 text-footnote font-medium ${inputs.contractorAuthorization === id ? "lg-lens" : "text-slate-400 hover:text-white"}`}>{text}</button>)}</div></div>
                <div className="col-span-2"><TriField testId="aor-input-sow" label="Contract / SOW incorporates the command requirement" value={inputs.contractRequirementsApply} onChange={(value) => update("contractRequirementsApply", value)} /></div>
              </> : null}
              <Field label="Travel type"><select data-testid="aor-input-travel" value={inputs.travelKind} onChange={(event) => update("travelKind", event.target.value)} className={selectClass}><option value="">Not set</option>{TRAVEL_KIND_OPTIONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></Field>
              <Field label="Length (days)"><input data-testid="aor-input-days" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done" value={inputs.stayDays} onChange={(event) => update("stayDays", event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="e.g. 120" className={inputClass} /></Field>
              <div className="col-span-2 -mt-1 flex flex-wrap gap-1.5" aria-label="Common durations">{[14, 30, 90, 180, 365].map((days) => <button key={days} type="button" onClick={() => update("stayDays", String(days))} className={`rounded-full border px-2.5 py-0.5 text-footnote ${inputs.stayDays === String(days) ? "border-cyan-300/50 bg-cyan-300/10 text-white" : "border-white/[.08] text-slate-400 hover:text-white"}`}>{days}d</button>)}</div>
              <Field label="Component / JTF" hint={components.length ? undefined : "No component-specific policy is integrated for this command."}><select data-testid="aor-input-component" value={inputs.component} onChange={(event) => update("component", event.target.value)} className={selectClass}><option value="">Not set</option>{components.map((entry) => <option key={entry.id} value={entry.id}>{entry.id}</option>)}</select></Field>
              <Field label="Installation / site"><input data-testid="aor-input-installation" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" value={inputs.installation} onChange={(event) => update("installation", event.target.value.slice(0, 80))} placeholder="e.g. Camp Humphreys" className={inputClass} /></Field>
              <Field label="Arriving from"><input data-testid="aor-input-origin" list="aor-origin-list" autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} maxLength={3} enterKeyHint="done" value={inputs.arrivingFrom} onChange={(event) => update("arrivingFrom", event.target.value.toUpperCase().slice(0, 3))} placeholder="ISO3, e.g. USA" className={inputClass} /><datalist id="aor-origin-list">{arrivingChoices.map((entry) => <option key={entry.id} value={entry.iso3 ?? entry.id}>{entry.name}</option>)}</datalist></Field>
              <Field label="Age"><input data-testid="aor-input-age" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done" value={inputs.ageYears} onChange={(event) => update("ageYears", event.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="optional" className={inputClass} /></Field>
              <div className="col-span-2"><Field label="Permanent assignment"><select data-testid="aor-input-permanent" value={inputs.permanentAssignment} onChange={(event) => update("permanentAssignment", event.target.value as MedicalInputs["permanentAssignment"])} className={selectClass}><option value="">Not set</option><option value="none">Not permanently assigned abroad</option><option value="destination">Permanently assigned in {location.name}</option></select></Field></div>
              <div className="col-span-2 grid gap-3">
                <TriField testId="aor-input-orders" label="On deployment orders" value={inputs.onDeploymentOrders} onChange={(value) => update("onDeploymentOrders", value)} />
                <TriField testId="aor-input-highrisk" label="High-risk or live-fire activity" value={inputs.highRiskOrLiveFire} onChange={(value) => update("highRiskOrLiveFire", value)} />
                <TriField testId="aor-input-layover" label="Layover in a yellow-fever-endemic country" value={inputs.layoverInYfEndemicCountry} onChange={(value) => update("layoverInYfEndemicCountry", value)} />
              </div>
            </div>
            <button type="button" data-testid="aor-medical-reset" onClick={() => setInputs(() => EMPTY_MEDICAL_INPUTS)} className="mt-4 inline-flex items-center gap-1.5 text-footnote font-medium text-slate-400 hover:text-white"><RotateCw size={13} />Clear all details</button>
          </div>
        ) : null}
      </section>

      {/* 3. Background — how the result was reached. */}
      <details className="group lg-section rounded-[12px]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-body font-semibold text-white">About this result<ChevronDown size={18} className="text-slate-400 transition group-open:rotate-180" /></summary>
        <div className="space-y-4 border-t border-white/[.07] px-4 pb-4 pt-3 text-callout leading-5 text-slate-300">
          <div aria-label="Assignment of this location">
            <p className={SECTION_HEADING}>Area of Responsibility</p>
            <p className="mt-1">{location.name} → {location.command ? COMMAND_VIEW[location.command].label : "AOR unavailable"}{location.evidenceClass ? <span className="text-slate-500"> · {EVIDENCE_CLASS_LABEL[location.evidenceClass]}</span> : null}</p>
            {location.contested ? <p className="mt-1 text-rose-200/90">Sources disagree on this assignment.</p> : null}
            {location.disputedSovereignty ? <p className="mt-1 text-rose-200/90">Sovereignty is disputed.</p> : null}
            {location.assignmentNote ? <details data-testid="aor-assignment-note" className="mt-1 text-slate-400"><summary className="cursor-pointer select-none font-medium text-slate-300">Assignment basis</summary><p className="mt-1">{location.assignmentNote}</p></details> : null}
            {result?.commandPolicy ? <p className="mt-1 text-slate-400">Command policy: {result.commandPolicy.title ?? result.commandPolicy.policyId} ({pretty(result.commandPolicy.status)}{result.commandPolicy.sourceDate ? `, dated ${fmtDate(result.commandPolicy.sourceDate)}` : ""}){result.commandPolicy.qualifiers.length ? ` · ${result.commandPolicy.qualifiers.join("; ")}` : ""}</p> : null}
            {evaluated && !result.commandPolicy ? <p className="mt-1 text-amber-100/80">No published command medical policy was found for this command in the integrated sources. That is a source gap, not a finding that nothing is required.</p> : null}
          </div>

          {evaluated ? (
            <div aria-label="Requirement categories">
              <p className={SECTION_HEADING}>By Category</p>
              <ul className="mt-2 divide-y divide-white/[.05]">
                {(["immunization", "malaria_chemoprophylaxis", "infectious_disease_screening", "medical_screening", "medical_examination", "waiver_disqualifying_condition"] as RequirementCategory[]).map((category) => {
                  const summary = result.categories[category];
                  if (!summary) return null;
                  return <li key={category} data-testid={`aor-category-${category}`} className="flex items-start justify-between gap-3 py-2"><div><p className="font-medium text-white/90">{CATEGORY_LABEL[category]}</p><p className="text-footnote text-slate-500">{summary.note}</p></div><StatusBadge status={summary.status} /></li>;
                })}
              </ul>
            </div>
          ) : null}

          {evaluated ? (
            <div aria-label="Authority layers and source coverage" data-testid="aor-layer-coverage">
              <p className={SECTION_HEADING}>Sources and Coverage</p>
              <p className="mt-1 text-footnote text-slate-500">Four rule classes are kept apart. None replaces another, and CDC/WHO guidance never becomes a requirement.</p>
              <ul className="mt-2 space-y-2">
                {(Object.keys(LAYER_LABEL) as AuthorityLayer[]).map((layer) => {
                  const coverage = result.layers[layer];
                  if (!coverage) return null;
                  return (
                    <li key={layer}>
                      <p><span className={`font-medium ${LAYER_TONE[layer].split(" ").find((token) => token.startsWith("text-")) ?? ""}`}>{LAYER_LABEL[layer]}</span><span className="text-slate-400"> · {COVERAGE_LABEL[coverage.coverage] ?? pretty(coverage.coverage)} · {coverage.items} item{coverage.items === 1 ? "" : "s"}</span></p>
                      <p className="text-footnote text-slate-500">{coverage.note}</p>
                      {coverage.sources?.length ? (
                        <ul className="mt-1 space-y-0.5">
                          {coverage.sources.map((source) => {
                            const href = safeUrl(source.sourceUrl);
                            return (
                              <li key={source.sourceId} data-testid="aor-public-health-source" className="text-footnote text-slate-500">
                                {href ? <a href={href} target="_blank" rel="noreferrer" className="font-medium text-cyan-200/90 hover:text-cyan-100">{source.sourceName}</a> : <b className="text-slate-300">{source.sourceName}</b>} · <span className={source.status === "ok" ? "text-emerald-300" : "text-amber-300"}>{pretty(source.status)}</span>
                                {source.lastSuccessfulFetch ? ` · updated ${fmtDate(source.lastSuccessfulFetch)}` : source.lastAttemptedFetch ? " · never fetched successfully" : ""}
                                {source.sourceError && source.status !== "ok" ? ` · ${source.sourceError}` : ""}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {result?.scopeRules.length ? (
            <details><summary className="cursor-pointer font-medium text-slate-300">Scope definitions ({result.scopeRules.length})</summary>
              <ul className="mt-2 space-y-2">{result.scopeRules.map((rule) => <li key={rule.id} className="text-slate-400"><b className="font-medium text-slate-300">{rule.title}</b>{rule.sourceSection ? <span className="text-slate-500"> · {rule.sourceSection}</span> : null}<p>{rule.text}</p></li>)}</ul>
            </details>
          ) : null}
          {result?.limitations.length ? (
            <details><summary className="cursor-pointer font-medium text-slate-300">Limitations</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-400">{result.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            </details>
          ) : null}
        </div>
      </details>

      {disclaimer}
    </div>
  );
}
