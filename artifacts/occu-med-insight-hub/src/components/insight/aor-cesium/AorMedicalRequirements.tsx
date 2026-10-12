import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, BadgeCheck, CircleHelp, GitFork, Loader2, MinusCircle, RotateCw, ShieldAlert } from "lucide-react";
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
  return <span data-testid={`aor-status-${status}`} className={`inline-flex items-center gap-1 rounded-full border font-black uppercase tracking-[.08em] ${size === "md" ? "px-2.5 py-1 text-[10px]" : "px-1.5 py-0.5 text-[8px]"} ${style.chip}`}><Icon size={size === "md" ? 11 : 9} aria-hidden />{style.label}</span>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[88px_1fr] gap-2 border-b border-white/[.04] py-1 text-[9px] leading-4 last:border-b-0"><dt className="text-[8px] font-black uppercase tracking-[.08em] text-slate-500">{label}</dt><dd className="break-words text-slate-200">{children}</dd></div>;
}

function RequirementCard({ item }: { item: RequirementItem }) {
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
    <article data-testid="aor-requirement-card" data-status={item.status} data-layer={item.layer} data-requirement-id={item.id} id={`req-${item.id.replace(/[^a-z0-9_-]/gi, "_")}`} className={`mb-2 rounded-xl border border-white/[.07] border-l-[3px] bg-white/[.02] px-3 py-2.5 ${STATUS_STYLE[item.status].card}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={item.status} />
        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${LAYER_TONE[item.layer]}`}>{LAYER_LABEL[item.layer]}</span>
        <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[8px] font-bold text-slate-300">{CATEGORY_LABEL[item.category]}</span>
        {item.verification?.state === "unconfirmed_historical" ? <span className="rounded-full border border-amber-300/40 px-1.5 py-0.5 text-[8px] font-bold text-amber-100">Older baseline — not confirmed</span> : null}
      </div>
      <h4 className="mt-1.5 text-[11px] font-bold leading-4 text-white/90">{item.title}</h4>
      <p className="mt-1 text-[10px] leading-4 text-slate-300">{item.requirement}</p>
      {item.assignmentCaveat ? <p className="mt-1 rounded-md border border-amber-300/20 bg-amber-300/[.05] px-2 py-1 text-[9px] leading-4 text-amber-100/85"><AlertTriangle size={9} className="mr-1 inline" />{item.assignmentCaveat}</p> : null}
      {item.why.length ? <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[9px] leading-4 text-slate-400">{item.why.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : null}

      {item.missingInputs.length ? (
        <div data-testid="aor-requirement-missing" className="mt-1.5 rounded-md border border-violet-300/25 bg-violet-300/[.05] px-2 py-1 text-[9px] leading-4 text-violet-100/90">
          <b>Missing to decide this:</b> {item.missingInputs.join("; ")}
        </div>
      ) : null}

      <dl className="mt-1.5 rounded-lg border border-white/[.05] bg-black/15 px-2">
        <Row label="Authority">{item.authority.issuer}{item.authority.policyId ? ` · ${item.authority.policyId}` : ""}{item.authority.sourceSection ? ` · ${item.authority.sourceSection}` : ""}</Row>
        <Row label="Source">{url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-cyan-100/80 hover:text-cyan-50">{item.authority.policyTitle || "Open source"}<ArrowUpRight size={9} /></a> : item.authority.policyTitle || "Source link not available"}</Row>
        <Row label="Published">{fmtDate(item.authority.publishedDate) ?? <span className="text-slate-500">Not stated by the source</span>} <span className="text-slate-500">· {item.authority.verificationStatus}</span></Row>
        <Row label="Effective">{EFFECTIVE_LABEL[item.effective.status]}{item.effective.effectiveFrom ? ` from ${fmtDate(item.effective.effectiveFrom)}` : ""}{item.effective.effectiveTo ? ` to ${fmtDate(item.effective.effectiveTo)}` : ""}<span className="mt-0.5 block text-slate-500">{item.effective.note}</span></Row>
        <Row label="Contractors">{CONTRACTOR_LABEL[item.appliesToContractors]}{item.contractualNote ? <span className="mt-0.5 block text-slate-500">{item.contractualNote}</span> : null}</Row>
      </dl>

      <details className="mt-1.5">
        <summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.12em] text-cyan-100/55">Triggering conditions, exceptions and evidence</summary>
        <dl className="mt-1 rounded-lg border border-white/[.05] bg-white/[.015] px-2">
          {triggerRows.filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => <Row key={label} label={label}>{value}</Row>)}
          {trigger.conditions.length ? <Row label="Conditions"><ul className="list-disc space-y-0.5 pl-3.5">{trigger.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></Row> : null}
          {exemptions.exemptDestinations.length ? <Row label="Exempt">{exemptions.exemptDestinations.join(", ")}{exemptions.exemptionCondition ? ` — ${exemptions.exemptionCondition}` : ""}</Row> : null}
          {exemptions.waiverAuthority ? <Row label="Waiver">{exemptions.waiverAuthority}</Row> : null}
          {exemptions.policyStatus ? <Row label="Policy status">{exemptions.policyStatus}</Row> : null}
          {exemptions.notes.length ? <Row label="Notes">{exemptions.notes.join(" ")}</Row> : null}
          {item.authority.citedDodInstructions.length ? <Row label="Cites">{item.authority.citedDodInstructions.join(", ")}</Row> : null}
        </dl>
        {verification ? (
          <div className="mt-1.5 rounded-lg border border-amber-300/20 bg-amber-300/[.04] px-2 py-1.5 text-[9px] leading-4 text-amber-50/85">
            <b>{verification.state === "unconfirmed_historical" ? "Verification gap" : "Verified against a current source"}</b>
            {verification.possibleRequirement ? <p className="mt-0.5">Possible requirement (not confirmed): {verification.possibleRequirement}</p> : null}
            {verification.gap ? <p className="mt-0.5">{verification.gap}</p> : null}
            {verification.historicalEvidence ? <p className="mt-0.5 text-amber-100/70">Historical evidence: {verification.historicalEvidence.authority} ({verification.historicalEvidence.verificationStatus}){verification.historicalEvidence.sourcePublishedAt ? `, published ${fmtDate(verification.historicalEvidence.sourcePublishedAt)}` : ""}; retrieved {fmtDate(verification.historicalEvidence.retrievedAt)}{verification.historicalEvidence.productionVerificationRequired ? "; re-read the source before operational use" : ""}.</p> : null}
            {verification.liveCorroboration.length ? <ul className="mt-0.5 list-disc pl-4 text-amber-100/70">{verification.liveCorroboration.map((entry) => <li key={entry.itemId}>{entry.authority}: {entry.text}{entry.retrievedAt ? ` (retrieved ${fmtDate(entry.retrievedAt)})` : ""}</li>)}</ul> : null}
          </div>
        ) : null}
        {item.evidence.sourceWording ? <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-white/[.05] px-2 py-1.5 text-[9px] leading-4 text-slate-400"><b className="text-slate-300">Source wording: </b>{item.evidence.sourceWording}</p> : null}
        {item.evidence.sourceProvenance ? <p className="mt-1 text-[8px] leading-3 text-slate-500">Provenance: {item.evidence.sourceProvenance}</p> : null}
        {item.evidence.sourceGaps.length ? <p className="mt-1 text-[8px] leading-3 text-amber-100/70"><b>SOURCE_GAP</b> — in the source, not extracted: {item.evidence.sourceGaps.join("; ")}.</p> : null}
        {item.evidence.caveats.map((caveat) => <p key={caveat} className="mt-1 text-[8px] leading-3 text-amber-100/60">{caveat}</p>)}
        {item.displacedEvidence.length ? <p className="mt-1 text-[8px] leading-3 text-slate-500"><b>Earlier or conflicting evidence kept, not applied:</b> {item.displacedEvidence.join(" ")}</p> : null}
      </details>
    </article>
  );
}

const selectClass = "min-h-8 w-full rounded-lg border border-white/[.09] bg-black/30 px-2 text-[10px] text-white outline-none";
const inputClass = "min-h-8 w-full rounded-lg border border-white/[.09] bg-black/30 px-2.5 text-[10px] text-white outline-none placeholder:text-slate-600";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-0.5 block text-[8px] font-black uppercase tracking-[.1em] text-slate-500">{label}</span>{children}{hint ? <span className="mt-0.5 block text-[8px] leading-3 text-slate-600">{hint}</span> : null}</label>;
}

function TriField({ label, value, onChange, testId }: { label: string; value: Tri; onChange: (value: Tri) => void; testId: string }) {
  return (
    <div role="group" aria-label={label}>
      <span className="mb-0.5 block text-[8px] font-black uppercase tracking-[.1em] text-slate-500">{label}</span>
      <div className="flex gap-1">
        {([["", "Not specified"], ["yes", "Yes"], ["no", "No"]] as Array<[Tri, string]>).map(([option, text]) => (
          <button key={option || "unset"} type="button" data-testid={`${testId}-${option || "unset"}`} aria-pressed={value === option} onClick={() => onChange(option)} className={`min-h-7 flex-1 rounded-lg border px-1.5 text-[9px] font-bold transition ${value === option ? "border-cyan-200/35 bg-cyan-200/10 text-white" : "border-white/[.07] text-slate-400 hover:text-white"}`}>{text}</button>
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

export function AorMedicalRequirements({ location, split, directory, inputs, setInputs, state, onPickLocation }: Props) {
  const [filter, setFilter] = useState<RequirementStatus | null>(null);
  const update = <K extends keyof MedicalInputs>(key: K, value: MedicalInputs[K]) => setInputs((current) => ({ ...current, [key]: value }));
  const result = state.result;
  const command = location?.command ?? null;
  const components = useMemo(() => (directory?.directory.supportComponents ?? []).filter((entry) => !command || entry.command === command), [directory, command]);
  const arrivingChoices = useMemo(() => (directory?.directory.locations ?? []).filter((entry) => entry.entityType === "sovereign" && entry.iso3), [directory]);

  const disclaimer = (
    <p data-testid="aor-medical-disclaimer" className="rounded-lg border border-amber-200/20 bg-amber-200/[.05] px-3 py-2 text-[10px] leading-4 text-amber-50/90">
      <AlertTriangle size={11} className="mr-1 inline" />Planning information only — <b>this is not a medical clearance</b>. It does not clear, approve or disqualify anyone. Medical suitability, waivers and theater clearance are decided by the responsible clinician, the command and, for contractors, the contract.
    </p>
  );

  if (split) {
    return (
      <div data-testid="aor-medical-split">
        {disclaimer}
        <div className="mt-3 rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-2.5">
          <h3 className="text-[11px] font-bold text-white/90">{split.name} is split across commands</h3>
          <p className="mt-1 text-[10px] leading-4 text-slate-300">{split.message}</p>
          <p className="mt-2 text-[9px] font-black uppercase tracking-[.12em] text-slate-500">Choose a location</p>
          <ul className="mt-1 space-y-1">
            {split.constituentIds.map((id) => {
              const entry = directory?.byId.get(id);
              if (!entry) return null;
              return <li key={id}><button type="button" onClick={() => onPickLocation(id)} className="flex w-full items-center justify-between rounded-lg border border-white/[.07] px-2.5 py-1.5 text-left text-[10px] text-white/85 hover:bg-white/[.05]"><span>{entry.name}</span><span className="text-[9px] text-slate-500">{entry.command ? COMMAND_VIEW[entry.command].short : ""}</span></button></li>;
            })}
          </ul>
        </div>
      </div>
    );
  }
  if (!location) return null;

  const visible = (result?.requirements ?? []).filter((item) => !filter || item.status === filter);
  const grouped = REQUIREMENT_STATUSES.map((status) => [status, visible.filter((item) => item.status === status)] as const).filter(([, items]) => items.length);

  return (
    <div data-testid="aor-medical-requirements" aria-busy={state.loading}>
      {disclaimer}

      <section className="mt-3 rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2" aria-label="Assignment of this location">
        <p className="text-[8px] font-black uppercase tracking-[.14em] text-slate-500">Area of responsibility (from the geographic registry)</p>
        <p className="mt-0.5 text-[12px] font-bold text-white/90">{location.name} → {location.command ? COMMAND_VIEW[location.command].label : "AOR unavailable"}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[8px] font-bold text-slate-300">{location.categoryLabel}</span>
          {location.evidenceClass ? <span className="rounded-full border border-cyan-300/25 px-1.5 py-0.5 text-[8px] font-bold text-cyan-100">{EVIDENCE_CLASS_LABEL[location.evidenceClass]}</span> : null}
          {location.provisional ? <span className="rounded-full border border-amber-300/45 px-1.5 py-0.5 text-[8px] font-bold text-amber-100">Provisional assignment</span> : null}
          {location.contested ? <span className="rounded-full border border-rose-300/40 px-1.5 py-0.5 text-[8px] font-bold text-rose-100">Sources disagree</span> : null}
          {location.disputedSovereignty ? <span className="rounded-full border border-rose-300/30 px-1.5 py-0.5 text-[8px] font-bold text-rose-100">Sovereignty disputed</span> : null}
        </div>
        {location.assignmentNote ? <details data-testid="aor-assignment-note" className="mt-1 text-[9px] leading-4 text-slate-400"><summary className="cursor-pointer select-none font-bold text-slate-300">Assignment basis and notes</summary><p className="mt-0.5">{location.assignmentNote}</p></details> : null}
        {result?.commandPolicy ? <p className="mt-1 text-[9px] leading-4 text-slate-400">Command policy: {result.commandPolicy.title ?? result.commandPolicy.policyId} — {pretty(result.commandPolicy.status)}{result.commandPolicy.sourceDate ? `, source dated ${fmtDate(result.commandPolicy.sourceDate)}` : ""}{result.commandPolicy.qualifiers.length ? ` · ${result.commandPolicy.qualifiers.join("; ")}` : ""}</p> : null}
        {result && !result.commandPolicy && result.status === "EVALUATED" ? <p className="mt-1 text-[9px] leading-4 text-amber-100/80">No published command medical policy was found for this command in the integrated source set. That is a source gap, not a finding that nothing is required.</p> : null}
      </section>

      <section className="mt-3" aria-label="Assignment details">
        <div className="flex items-center justify-between">
          <h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Your assignment details</h3>
          <button type="button" data-testid="aor-medical-reset" onClick={() => setInputs(() => EMPTY_MEDICAL_INPUTS)} className="inline-flex items-center gap-1 text-[8px] font-bold text-cyan-100/65 hover:text-cyan-50"><RotateCw size={9} />Clear details</button>
        </div>
        <p className="mb-1.5 text-[9px] leading-4 text-slate-500">Anything left as “Not specified” is not assumed; requirements that depend on it show as Unknown or Conditional. Results recalculate as you change a detail.</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          <div className="col-span-2"><Field label="Personnel type"><select data-testid="aor-input-population" value={inputs.population} onChange={(event) => update("population", event.target.value)} className={selectClass}><option value="">Not specified</option>{POPULATION_OPTIONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></Field></div>
          {inputs.population === "dod_civilian" ? <div className="col-span-2"><Field label="Civilian category"><select data-testid="aor-input-civilian" value={inputs.civilianCategory} onChange={(event) => update("civilianCategory", event.target.value)} className={selectClass}><option value="">Not specified</option>{CIVILIAN_CATEGORY_OPTIONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></Field></div> : null}
          {inputs.population === "dod_contractor" ? <>
            <div className="col-span-2"><Field label="Contractor status"><div className="flex gap-1">{([["", "Not specified"], ["caaf", "CAAF"], ["non_caaf", "Non-CAAF"]] as Array<[MedicalInputs["contractorAuthorization"], string]>).map(([id, text]) => <button key={id || "unset"} type="button" data-testid={`aor-input-caaf-${id || "unset"}`} aria-pressed={inputs.contractorAuthorization === id} onClick={() => update("contractorAuthorization", id)} className={`min-h-8 flex-1 rounded-lg border px-1.5 text-[9px] font-bold transition ${inputs.contractorAuthorization === id ? "border-cyan-200/35 bg-cyan-200/10 text-white" : "border-white/[.07] text-slate-400 hover:text-white"}`}>{text}</button>)}</div></Field></div>
            <div className="col-span-2"><TriField testId="aor-input-sow" label="Contract / SOW incorporates the command requirement" value={inputs.contractRequirementsApply} onChange={(value) => update("contractRequirementsApply", value)} /></div>
          </> : null}
          <Field label="Travel type"><select data-testid="aor-input-travel" value={inputs.travelKind} onChange={(event) => update("travelKind", event.target.value)} className={selectClass}><option value="">Not specified</option>{TRAVEL_KIND_OPTIONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></Field>
          <Field label="Assignment length (days)"><input data-testid="aor-input-days" inputMode="numeric" value={inputs.stayDays} onChange={(event) => update("stayDays", event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="e.g. 120" className={inputClass} /></Field>
          <div className="col-span-2 flex flex-wrap gap-1" aria-label="Common durations">{[14, 30, 90, 180, 365].map((days) => <button key={days} type="button" onClick={() => update("stayDays", String(days))} className={`rounded-full border px-2 py-0.5 text-[8px] font-bold ${inputs.stayDays === String(days) ? "border-cyan-200/35 bg-cyan-200/10 text-white" : "border-white/[.07] text-slate-400 hover:text-white"}`}>{days} days</button>)}</div>
          <Field label="Supporting component / JTF" hint={components.length ? undefined : "No component-specific policy is integrated for this command."}><select data-testid="aor-input-component" value={inputs.component} onChange={(event) => update("component", event.target.value)} className={selectClass}><option value="">Not specified</option>{components.map((entry) => <option key={entry.id} value={entry.id}>{entry.id}</option>)}</select></Field>
          <Field label="Installation / site" hint="Matched only to component names the sources use."><input data-testid="aor-input-installation" value={inputs.installation} onChange={(event) => update("installation", event.target.value.slice(0, 80))} placeholder="e.g. Camp Humphreys (USFK)" className={inputClass} /></Field>
          <Field label="Arriving from"><input data-testid="aor-input-origin" list="aor-origin-list" value={inputs.arrivingFrom} onChange={(event) => update("arrivingFrom", event.target.value.toUpperCase().slice(0, 3))} placeholder="ISO3, e.g. USA" className={inputClass} /><datalist id="aor-origin-list">{arrivingChoices.map((entry) => <option key={entry.id} value={entry.iso3 ?? entry.id}>{entry.name}</option>)}</datalist></Field>
          <Field label="Age (years)"><input data-testid="aor-input-age" inputMode="numeric" value={inputs.ageYears} onChange={(event) => update("ageYears", event.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="optional" className={inputClass} /></Field>
          <div className="col-span-2"><Field label="Permanent assignment"><select data-testid="aor-input-permanent" value={inputs.permanentAssignment} onChange={(event) => update("permanentAssignment", event.target.value as MedicalInputs["permanentAssignment"])} className={selectClass}><option value="">Not specified</option><option value="none">Not permanently assigned abroad</option><option value="destination">Permanently assigned in {location.name}</option></select></Field></div>
          <div className="col-span-2"><TriField testId="aor-input-orders" label="On deployment orders" value={inputs.onDeploymentOrders} onChange={(value) => update("onDeploymentOrders", value)} /></div>
          <div className="col-span-2"><TriField testId="aor-input-highrisk" label="High-risk or live-fire activity" value={inputs.highRiskOrLiveFire} onChange={(value) => update("highRiskOrLiveFire", value)} /></div>
          <div className="col-span-2"><TriField testId="aor-input-layover" label="Layover in a yellow-fever-endemic country" value={inputs.layoverInYfEndemicCountry} onChange={(value) => update("layoverInYfEndemicCountry", value)} /></div>
        </div>
      </section>

      <div className="mt-3" aria-live="polite">
        {state.loading ? <p data-testid="aor-medical-loading" className="flex items-center gap-2 py-2 text-[10px] text-slate-400"><Loader2 size={12} className="animate-spin" />{result ? "Recalculating requirements…" : `Calculating requirements for ${location.name}…`}</p> : null}
        {state.error ? <p data-testid="aor-medical-error" className="rounded-lg border border-amber-300/25 bg-amber-300/[.05] px-3 py-2 text-[10px] leading-4 text-amber-100/90"><AlertTriangle size={11} className="mr-1 inline" />{state.error}</p> : null}
      </div>

      {result && result.status === "LOCATION_AMBIGUOUS" ? <p className="rounded-lg border border-white/10 px-3 py-2 text-[10px] leading-4 text-slate-300">{result.location.message ?? result.location.ambiguity?.message}</p> : null}

      {result && result.status === "EVALUATED" ? (
        <div className={state.loading ? "opacity-60 transition-opacity" : "transition-opacity"} data-testid="aor-medical-result" data-revision={state.revision}>
          <section aria-label="Requirement status summary">
            <h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Results for the details entered</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REQUIREMENT_STATUSES.map((status) => (
                <button key={status} type="button" data-testid={`aor-filter-${status}`} aria-pressed={filter === status} onClick={() => setFilter((current) => (current === status ? null : status))} disabled={!result.byStatus[status]} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold transition disabled:opacity-35 ${filter === status ? "ring-1 ring-white/50" : ""} ${STATUS_STYLE[status].chip}`}>
                  {(() => { const Icon = STATUS_STYLE[status].Icon; return <Icon size={10} aria-hidden />; })()}{STATUS_STYLE[status].label}<span data-testid={`aor-count-${status}`} className="rounded bg-black/30 px-1">{result.byStatus[status]}</span>
                </button>
              ))}
            </div>
            <dl className="mt-1.5 space-y-0.5 text-[8px] leading-3 text-slate-500">{REQUIREMENT_STATUSES.map((status) => <div key={status}><dt className="inline font-black uppercase text-slate-400">{STATUS_STYLE[status].label}: </dt><dd className="inline">{STATUS_STYLE[status].meaning}</dd></div>)}</dl>
          </section>

          <section className="mt-3" aria-label="Requirement categories">
            <h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">By category</h3>
            <ul className="mt-1 grid grid-cols-1 gap-1">
              {(["immunization", "malaria_chemoprophylaxis", "infectious_disease_screening", "medical_screening", "medical_examination", "waiver_disqualifying_condition"] as RequirementCategory[]).map((category) => {
                const summary = result.categories[category];
                if (!summary) return null;
                return <li key={category} data-testid={`aor-category-${category}`} className="flex items-start justify-between gap-2 rounded-lg border border-white/[.06] px-2.5 py-1.5"><div><p className="text-[10px] font-bold text-white/85">{CATEGORY_LABEL[category]}</p><p className="text-[8px] leading-3 text-slate-500">{summary.note}</p></div><StatusBadge status={summary.status} /></li>;
              })}
            </ul>
          </section>

          <section className="mt-3" aria-label="Requirements">
            <h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Requirements and guidance{filter ? ` — ${STATUS_STYLE[filter].label} only` : ""}</h3>
            {grouped.length === 0 ? <p className="py-2 text-[10px] text-slate-500">No items match this filter.</p> : null}
            {grouped.map(([status, items]) => (
              <div key={status} className="mt-2" data-testid={`aor-group-${status}`}>
                <div className="mb-1 flex items-center gap-2"><StatusBadge status={status} size="md" /><span className="text-[9px] text-slate-500">{items.length} item{items.length === 1 ? "" : "s"}</span></div>
                {items.map((item) => <RequirementCard key={item.id} item={item} />)}
              </div>
            ))}
          </section>

          {result.missingInformation.length ? (
            <section className="mt-3 rounded-xl border border-violet-300/20 bg-violet-300/[.04] px-3 py-2" aria-label="Missing information" data-testid="aor-missing-information">
              <h3 className="text-[9px] font-black uppercase tracking-[.14em] text-violet-100/80">Information that would change the result</h3>
              <ul className="mt-1 space-y-1">{result.missingInformation.map((entry) => <li key={entry.input} className="text-[9px] leading-4 text-slate-300"><b className="text-white/85">{entry.input}</b><span className="text-slate-500"> — needed for {entry.neededFor.length} item{entry.neededFor.length === 1 ? "" : "s"}</span></li>)}</ul>
            </section>
          ) : null}

          <section className="mt-3" aria-label="Authority layers and source coverage" data-testid="aor-layer-coverage">
            <h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Authority layers and source coverage</h3>
            <p className="mb-1 text-[9px] leading-4 text-slate-500">Four rule classes are kept apart. None of them replaces another, and CDC/WHO guidance never becomes a requirement.</p>
            <ul className="space-y-1.5">
              {(Object.keys(LAYER_LABEL) as AuthorityLayer[]).map((layer) => {
                const coverage = result.layers[layer];
                if (!coverage) return null;
                return (
                  <li key={layer} className="rounded-lg border border-white/[.06] px-2.5 py-1.5">
                    <div className="flex flex-wrap items-center gap-1.5"><span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${LAYER_TONE[layer]}`}>{LAYER_LABEL[layer]}</span><span className="text-[9px] font-bold text-white/80">{COVERAGE_LABEL[coverage.coverage] ?? pretty(coverage.coverage)}</span><span className="text-[8px] text-slate-500">{coverage.items} item{coverage.items === 1 ? "" : "s"}</span></div>
                    <p className="mt-0.5 text-[9px] leading-4 text-slate-400">{coverage.note}</p>
                    {coverage.sources?.length ? (
                      <ul className="mt-1 space-y-1 border-t border-white/[.05] pt-1">
                        {coverage.sources.map((source) => {
                          const href = safeUrl(source.sourceUrl);
                          return (
                            <li key={source.sourceId} data-testid="aor-public-health-source" className="text-[8px] leading-3 text-slate-500">
                              {href ? <a href={href} target="_blank" rel="noreferrer" className="font-bold text-cyan-100/70 hover:text-cyan-50">{source.sourceName}</a> : <b className="text-slate-300">{source.sourceName}</b>} — <span className={source.status === "ok" ? "text-emerald-300" : "text-amber-300"}>{pretty(source.status)}</span>
                              {source.freshness ? ` · ${pretty(source.freshness.toLowerCase())}` : ""} · {source.itemsMapped} item{source.itemsMapped === 1 ? "" : "s"} mapped of {source.recordCount} record{source.recordCount === 1 ? "" : "s"}
                              {source.lastSuccessfulFetch ? ` · last success ${fmtDate(source.lastSuccessfulFetch)}` : source.lastAttemptedFetch ? " · never fetched successfully" : ""}
                              {source.sourceUpdatedAt ? ` · source dated ${fmtDate(source.sourceUpdatedAt)}` : ""}{source.sourceError && source.status !== "ok" ? ` · ${source.sourceError}` : ""}
                              {source.note ? <span className="block text-slate-600">{source.note}</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {result.scopeRules.length ? (
            <details className="mt-3"><summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.12em] text-slate-500">Scope definitions that shaped this result ({result.scopeRules.length})</summary>
              <ul className="mt-1 space-y-1.5">{result.scopeRules.map((rule) => <li key={rule.id} className="text-[9px] leading-4 text-slate-400"><b className="text-slate-300">{rule.title}</b>{rule.sourceSection ? <span className="text-slate-600"> · {rule.sourceSection}</span> : null}<p>{rule.text}</p></li>)}</ul>
            </details>
          ) : null}
          {result.limitations.length ? (
            <details className="mt-2"><summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.12em] text-slate-500">Limitations of this calculation</summary>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[9px] leading-4 text-slate-500">{result.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
