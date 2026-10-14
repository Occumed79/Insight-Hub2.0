import { type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, ChevronDown, Loader2 } from "lucide-react";
import { COMMAND_VIEW, EVIDENCE_CLASS_LABEL, type DirectoryIndex, type DirectoryLocation, type SplitParent } from "./aor-directory";
import {
  type AuthorityLayer, type RequirementCategory, type RequirementItem, type RequirementStatus,
} from "./aor-medical-types";
import type { MedicalState } from "./use-medical-applicability";

const STATUS_STYLE: Record<RequirementStatus, { card: string }> = {
  REQUIRED: { card: "border-l-rose-300/80" },
  RECOMMENDED: { card: "border-l-emerald-300/70" },
  CONDITIONAL: { card: "border-l-amber-300/75" },
  NOT_APPLICABLE: { card: "border-l-slate-400/50" },
  UNKNOWN: { card: "border-l-violet-300/60" },
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
      <p className="mt-1 text-body leading-[1.45] text-slate-300">{item.requirement}</p>
      {item.assignmentCaveat && !hideCaveat ? <p className="mt-2 flex gap-1.5 text-callout leading-5 text-amber-100/90"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{item.assignmentCaveat}</p> : null}
      {item.missingInputs.length ? (
        <p data-testid="aor-requirement-missing" className="mt-2 text-callout leading-5 text-violet-100/90">
          <span className="font-semibold">Applicability depends on:</span> {item.missingInputs.join("; ")}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-slate-500">
        <span>{item.authority.issuer}{item.authority.policyId ? ` · ${item.authority.policyId}` : ""}</span>
        {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-cyan-200/90 hover:text-cyan-100">Source<ArrowUpRight size={12} /></a> : null}
        {item.verification?.state === "unconfirmed_historical" ? <span className="text-amber-200/90">Older baseline, not confirmed</span> : null}
      </div>

        <dl className="mt-1 rounded-[6px] border border-white/[.05] bg-white/[.015] px-2">
          {triggerRows.filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => <Row key={label} label={label}>{value}</Row>)}
          {trigger.conditions.length ? <Row label="Conditions"><ul className="list-disc space-y-0.5 pl-3.5">{trigger.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></Row> : null}
          {exemptions.exemptDestinations.length ? <Row label="Exempt">{exemptions.exemptDestinations.join(", ")}{exemptions.exemptionCondition ? ` — ${exemptions.exemptionCondition}` : ""}</Row> : null}
          {exemptions.waiverAuthority ? <Row label="Waiver">{exemptions.waiverAuthority}</Row> : null}
          {exemptions.policyStatus ? <Row label="Policy status">{exemptions.policyStatus}</Row> : null}
          {exemptions.notes.length ? <Row label="Notes">{exemptions.notes.join(" ")}</Row> : null}
          {item.authority.citedDodInstructions.length ? <Row label="Cites">{item.authority.citedDodInstructions.join(", ")}</Row> : null}
        </dl>

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

type Props = {
  location: DirectoryLocation | null;
  split: SplitParent | null;
  directory: DirectoryIndex | null;
  state: MedicalState;
  onPickLocation: (id: string) => void;
};

const SECTION_HEADING = "text-callout font-semibold text-slate-300";

export function AorMedicalRequirements({ location, split, directory, state, onPickLocation }: Props) {
  const result = state.result;

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

  const visible = result?.requirements ?? [];
  const grouped = (Object.keys(LAYER_LABEL) as AuthorityLayer[]).map((layer) => [layer, visible.filter((item) => item.layer === layer)] as const).filter(([, items]) => items.length);
  const evaluated = result && result.status === "EVALUATED";
  // Share a caveat only when it applies to every item currently displayed.
  const candidateCaveat = visible[0]?.assignmentCaveat;
  const sharedCaveat = candidateCaveat && visible.every((item) => item.assignmentCaveat === candidateCaveat) ? candidateCaveat : null;

  return (
    <div data-testid="aor-medical-requirements" aria-busy={state.loading} className="space-y-5">
      {/* 1. The answer. */}
      <div aria-live="polite">
        {state.loading && !evaluated ? (
          <div data-testid="aor-medical-loading" className="space-y-3">
            <p className="flex items-center gap-2 text-body text-slate-300"><Loader2 size={16} className="animate-spin" />Loading medical sources for {location.name}…</p>
            <div className="lg-section h-24 animate-pulse rounded-[12px]" />
          </div>
        ) : null}
        {state.loading && evaluated ? <p data-testid="aor-medical-loading" className="mb-2 flex items-center gap-2 text-footnote text-slate-400"><Loader2 size={13} className="animate-spin" />Updating…</p> : null}
        {state.error ? (
          <div data-testid="aor-medical-error" className="lg-section rounded-[12px] px-4 py-3.5">
            <p className="flex items-center gap-2 text-body font-semibold text-white"><AlertTriangle size={15} className="text-amber-300" />Requirements could not be loaded</p>
            <p className="mt-1 text-callout leading-5 text-slate-300">{state.error}</p>
            {state.retry ? <button type="button" data-testid="aor-medical-retry" onClick={state.retry} disabled={state.loading} className="lg-press mt-3 rounded-full bg-white/[.1] px-3.5 py-1.5 text-callout font-semibold text-white hover:bg-white/[.16] disabled:opacity-50">{state.loading ? "Retrying…" : "Retry"}</button> : null}
          </div>
        ) : null}
      </div>

      {result && result.status === "LOCATION_AMBIGUOUS" ? <p className="text-body leading-6 text-slate-300">{result.location.message ?? result.location.ambiguity?.message}</p> : null}

      {evaluated ? (
        <div className={`space-y-5 ${state.loading ? "opacity-60 transition-opacity" : "transition-opacity"}`} data-testid="aor-medical-result" data-revision={state.revision}>
          <section aria-label="Requirements" className="space-y-5">
            {sharedCaveat ? <p data-testid="aor-shared-caveat" className="flex gap-2 text-callout leading-5 text-amber-100/90"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{sharedCaveat}</p> : null}
            {grouped.length === 0 ? <p className="text-body text-slate-500">No medical source items were returned for this location.</p> : null}
            {grouped.map(([layer, items]) => (
              <div key={layer} data-testid={`aor-source-group-${layer}`}>
                <div className="mb-2 flex items-center gap-2"><h3 className="text-headline font-semibold text-slate-200">{LAYER_LABEL[layer]}</h3><span className="text-footnote tabular-nums text-slate-500">{items.length} item{items.length === 1 ? "" : "s"}</span></div>
                <div className="space-y-2">{items.map((item) => <RequirementCard key={item.id} item={item} hideCaveat={Boolean(sharedCaveat)} />)}</div>
              </div>
            ))}
          </section>
        </div>
      ) : null}

      {/* Source coverage and provenance. */}
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
