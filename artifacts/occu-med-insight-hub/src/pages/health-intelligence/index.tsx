import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import HologramStage from "./HologramStage";
import { HEALTH_CONDITIONS, type HealthCondition } from "./conditions";
import { GROUP_LABEL, anchorZone, type GroupKey, type Zone } from "./anatomy";
import {
  caseTotals,
  deriveCaseSignals,
  deriveConditionSignals,
  deriveDemandSignals,
  formatShare,
  signalsForGroups,
  type OshaCaseProfile,
  type Signal,
  type SignalKind,
  type SignalMode,
} from "./signals";
import { useOccupationLookup } from "./useOccupationLookup";
import "./health-intelligence.css";

type Workspace = "injury" | "conditions";

/** What the user is inspecting: one hovered/selected region, or one evidence row. */
interface Focus {
  groups: GroupKey[];
  zone: Zone | null;
  signalId: string | null;
}

const BOOT_STEPS = ["CALIBRATING ANATOMY FIELD", "MAPPING BODY REGIONS", "LINKING EVIDENCE SOURCES"];
const BOOT_MS = 3000;
const CONDITION_MS = 1600;

const zoneFocus = (zone: Zone): Focus => ({ groups: [zone.group], zone, signalId: null });
const signalFocus = (signal: Signal): Focus => ({
  groups: signal.groups,
  zone: signal.groups.length === 1 ? anchorZone(signal.groups[0]) : null,
  signalId: signal.id,
});

/** Short tag appended to an evidence row when its source category is not specific to one region. */
const KIND_TAG: Partial<Record<SignalKind, string>> = {
  regional: "broad category",
  nonspecific: "multiple / nonspecific",
  unmapped: "not mapped to a region",
};

const KIND_LABEL: Record<SignalKind, string> = {
  specific: "Source category names this region",
  regional: "Broad source category · shown across a wider region",
  nonspecific: "Multiple / nonspecific · not tied to one region",
  unmapped: "Not mapped to a body region",
  demand: "Job-demand context",
  primary: "Primary association",
  secondary: "Secondary association · not a confirmed finding",
};

function groupConditions(conditions: HealthCondition[]) {
  const map = new Map<string, HealthCondition[]>();
  for (const item of conditions) map.set(item.category, [...(map.get(item.category) ?? []), item]);
  return [...map.entries()];
}

export default function HealthIntelligencePage() {
  const [workspace, setWorkspace] = useState<Workspace>("injury");
  const [booting, setBooting] = useState(true);
  const [bootStep, setBootStep] = useState(0);
  const [thinking, setThinking] = useState(false);
  const thinkingTimer = useRef<number | undefined>(undefined);

  const [occupation, setOccupation] = useState("");
  const { state: lookupState, lookup } = useOccupationLookup();

  const [conditionQuery, setConditionQuery] = useState("");
  const [conditionId, setConditionId] = useState<string | null>(null);

  const [hover, setHover] = useState<Focus | null>(null);
  const [selected, setSelected] = useState<Focus | null>(null);

  // ---- boot sequence --------------------------------------------------------------------
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setBooting(false);
      return;
    }
    const steps = BOOT_STEPS.map((_, index) => window.setTimeout(() => setBootStep(index), (BOOT_MS / BOOT_STEPS.length) * index));
    const done = window.setTimeout(() => setBooting(false), BOOT_MS);
    return () => {
      steps.forEach(window.clearTimeout);
      window.clearTimeout(done);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(thinkingTimer.current), []);

  // ---- evidence -> signals ----------------------------------------------------------------
  const onetProfile = lookupState.onet?.profile ?? null;
  const caseProfile = (lookupState.osha ?? null) as OshaCaseProfile | null;
  const condition = useMemo(() => HEALTH_CONDITIONS.find((item) => item.id === conditionId) ?? null, [conditionId]);

  const { signals, signalMode } = useMemo<{ signals: Signal[]; signalMode: SignalMode }>(() => {
    if (workspace === "conditions") {
      return condition && !thinking
        ? { signals: deriveConditionSignals(condition), signalMode: "condition" }
        : { signals: [], signalMode: "idle" };
    }
    if (lookupState.status !== "ready") return { signals: [], signalMode: "idle" };
    const caseSignals = deriveCaseSignals(caseProfile);
    if (caseSignals.length) return { signals: caseSignals, signalMode: "osha" };
    if (onetProfile) {
      const demand = deriveDemandSignals(onetProfile);
      if (demand.length) return { signals: demand, signalMode: "onet" };
    }
    return { signals: [], signalMode: "idle" };
  }, [workspace, condition, thinking, lookupState.status, caseProfile, onetProfile]);

  // Fresh evidence selects its strongest row; clearing evidence clears the selection.
  useEffect(() => {
    setSelected(signals.length ? signalFocus(signals[0]) : null);
  }, [signals]);

  const analyzing = workspace === "injury" && ["resolving", "correlating", "mapping"].includes(lookupState.status);
  const scanning = booting || analyzing || thinking;
  const active = hover ?? selected;
  const totals = signalMode === "osha" ? caseTotals(caseProfile) : null;

  // ---- handlers -----------------------------------------------------------------------------
  const switchWorkspace = (next: Workspace) => {
    if (next === workspace) return;
    setWorkspace(next);
    setSelected(null);
    setHover(null);
  };

  const pickCondition = useCallback((item: HealthCondition) => {
    window.clearTimeout(thinkingTimer.current);
    setConditionId(item.id);
    setConditionQuery(item.label);
    setSelected(null);
    setThinking(true);
    thinkingTimer.current = window.setTimeout(() => setThinking(false), CONDITION_MS);
  }, []);

  const handleSelect = (zone: Zone) =>
    setSelected((current) => (current && !current.signalId && current.zone?.group === zone.group ? null : zoneFocus(zone)));

  const submitOccupation = (event: React.FormEvent) => {
    event.preventDefault();
    if (!occupation.trim() || analyzing) return;
    setSelected(null);
    void lookup(occupation);
  };

  const filteredConditions = useMemo(() => {
    const needle = conditionQuery.trim().toLowerCase();
    if (!needle || (condition && needle === condition.label.toLowerCase())) return HEALTH_CONDITIONS;
    return HEALTH_CONDITIONS.filter((item) => [item.label, item.category, ...item.terms].some((value) => value.toLowerCase().includes(needle)));
  }, [conditionQuery, condition]);

  // ---- HUD copy -----------------------------------------------------------------------------
  const subject =
    workspace === "conditions"
      ? condition && !thinking ? condition.label : null
      : lookupState.status === "ready"
        ? onetProfile?.occupation?.title ?? caseProfile?.occupationTitle ?? lookupState.query
        : null;

  const status = (() => {
    if (booting) return { text: BOOT_STEPS[bootStep], busy: true };
    if (thinking) return { text: "MAPPING CONDITION TO ANATOMICAL REGIONS", busy: true };
    if (workspace === "injury") {
      if (lookupState.status === "resolving") return { text: "RESOLVING OCCUPATION · O*NET", busy: true };
      if (lookupState.status === "correlating") return { text: "CORRELATING OSHA CASE DATA", busy: true };
      if (lookupState.status === "mapping") return { text: "GENERATING HEALTH INTELLIGENCE", busy: true };
      if (lookupState.status === "error") return { text: lookupState.error.toUpperCase(), busy: false, error: true };
      if (signalMode === "osha") return { text: `OSHA CASE-LINKED EVIDENCE · CY${totals?.year ?? "—"}`, busy: false };
      if (signalMode === "onet") return { text: "O*NET JOB-DEMAND EVIDENCE · NO CODED CASE DATA", busy: false };
      return { text: "STANDBY · ENTER AN OCCUPATION TO MAP EVIDENCE", busy: false };
    }
    return condition
      ? { text: `ANATOMICAL ASSOCIATION · ${condition.category.toUpperCase()}`, busy: false }
      : { text: "STANDBY · SEARCH OR SELECT A CONDITION", busy: false };
  })();

  const evidenceNote =
    workspace === "conditions"
      ? "Anatomical association for context only. Not a diagnosis or a fitness-for-duty determination."
      : signalMode === "osha"
        ? "Reported case distribution. Not an individual injury probability."
        : signalMode === "onet"
          ? "Job-demand context. Not an injury rate."
          : "Evidence view only. Not a fitness-for-duty determination.";

  const indexTitle =
    signalMode === "osha"
      ? `REPORTED BODY-PART CATEGORIES · SHARE OF ${(totals?.coded ?? 0).toLocaleString()} CODED CASES`
      : signalMode === "onet"
        ? "O*NET DEMAND EVIDENCE"
        : "ANATOMICAL ASSOCIATIONS";

  const readout = useMemo(() => {
    if (!active) return null;
    const rows = active.signalId ? signals.filter((signal) => signal.id === active.signalId) : signalsForGroups(signals, active.groups);
    const title = active.signalId ? rows[0]?.label ?? "" : GROUP_LABEL[active.groups[0]] ?? "";
    return { title, rows, byRegion: !active.signalId };
  }, [active, signals]);

  return (
    <div className="hi-page" data-page-identity="injuries-medical-conditions" data-workspace="injuries-medical-conditions">
      <Sidebar />
      <main className="hi-main">
        <div className="hi-stage-wrap">
          <aside className="hi-rail hi-rail-left" aria-label="Search and selection">
            <header className="hi-top">
              <p className="hi-eyebrow"><span>HEALTH INTELLIGENCE</span><span>ANATOMICAL EVIDENCE MAP</span></p>
              <h1 className="hi-title">Injuries &amp; Medical Conditions</h1>
              <div className="hi-tabs" role="tablist" aria-label="Health intelligence mode">
                <button role="tab" aria-selected={workspace === "injury"} className={workspace === "injury" ? "is-active" : ""} onClick={() => switchWorkspace("injury")}>
                  Injury Intelligence
                </button>
                <button role="tab" aria-selected={workspace === "conditions"} className={workspace === "conditions" ? "is-active" : ""} onClick={() => switchWorkspace("conditions")}>
                  Medical Conditions
                </button>
              </div>
            </header>

            {workspace === "injury" ? (
              <form className="hi-form" onSubmit={submitOccupation}>
                <label className="hi-label" htmlFor="hi-occupation">OCCUPATION</label>
                <input
                  id="hi-occupation"
                  value={occupation}
                  onChange={(event) => setOccupation(event.target.value)}
                  placeholder="Firefighter, electrician, truck driver…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="submit" disabled={!occupation.trim() || analyzing}>
                  Build injury profile <ArrowRight size={13} aria-hidden="true" />
                </button>
              </form>
            ) : (
              <form
                className="hi-form hi-form-conditions"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (filteredConditions.length === 1) pickCondition(filteredConditions[0]);
                }}
              >
                <label className="hi-label" htmlFor="hi-condition">MEDICAL CONDITION</label>
                <input
                  id="hi-condition"
                  value={conditionQuery}
                  onChange={(event) => setConditionQuery(event.target.value)}
                  placeholder="Search diabetes, migraine, hearing, anticoagulation…"
                  autoComplete="off"
                  spellCheck={false}
                  aria-controls="hi-condition-list"
                />
                <p className="hi-count" aria-live="polite">
                  {filteredConditions.length} {filteredConditions.length === 1 ? "condition" : "conditions"}
                  {condition ? "" : " · select one to map"}
                </p>
                <div className="hi-conditions" id="hi-condition-list" role="group" aria-label="Condition suggestions">
                  {filteredConditions.length ? (
                    groupConditions(filteredConditions).map(([category, items]) => (
                      <section key={category} aria-label={category}>
                        <h3>{category}</h3>
                        <ul>
                          {items.map((item) => (
                            <li key={item.id}>
                              <button type="button" className={item.id === conditionId ? "is-active" : ""} aria-pressed={item.id === conditionId} onClick={() => pickCondition(item)}>
                                {item.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))
                  ) : (
                    <p className="hi-empty">No condition in the reference list matches that search.</p>
                  )}
                </div>
              </form>
            )}
          </aside>

          <HologramStage
            mode={signalMode}
            scanning={scanning}
            signals={signals}
            focusGroups={active?.groups ?? []}
            reticleZone={active?.zone ?? null}
            onHover={(zone) => setHover(zone ? zoneFocus(zone) : null)}
            onSelect={handleSelect}
          />

          <aside className="hi-rail hi-rail-right" aria-label="Evidence">
            <section className="hi-telemetry" aria-label="Analysis summary">
              {subject ? <h2 className="hi-subject">{subject}</h2> : <p className="hi-eyebrow hi-eyebrow-quiet">NO EVIDENCE LOADED</p>}
              {subject ? (
                <p className="hi-source">
                  {signalMode === "osha" ? "OSHA case-linked evidence" : signalMode === "onet" ? "O*NET demand evidence" : "Condition reference"}
                </p>
              ) : null}
              {totals ? (
                <dl className="hi-counts">
                  <div><dt>Total reported cases</dt><dd>{totals.total.toLocaleString()}</dd></div>
                  <div><dt>With coded body part</dt><dd>{totals.coded.toLocaleString()}</dd></div>
                  <div><dt>Without coded body part</dt><dd>{totals.uncoded.toLocaleString()}</dd></div>
                </dl>
              ) : null}
              {lookupState.oshaError && workspace === "injury" ? <p className="hi-source is-warn">OSHA case data unavailable</p> : null}
            </section>

            {signals.length ? (
              <section className="hi-evidence" aria-label="Evidence index">
                <h3 className="hi-section-title">{indexTitle}</h3>
                <ol>
                  {signals.map((signal, index) => {
                    const isActive = active?.signalId ? active.signalId === signal.id : active ? signal.groups.some((group) => active.groups.includes(group)) : false;
                    return (
                      <li key={signal.id}>
                        <button
                          type="button"
                          className={`${isActive ? "is-active " : ""}kind-${signal.kind}`}
                          aria-pressed={selected?.signalId === signal.id}
                          onPointerEnter={() => setHover(signalFocus(signal))}
                          onPointerLeave={() => setHover(null)}
                          onFocus={() => setHover(signalFocus(signal))}
                          onBlur={() => setHover(null)}
                          onClick={() => setSelected((current) => (current?.signalId === signal.id ? null : signalFocus(signal)))}
                        >
                          <b>{String(index + 1).padStart(2, "0")}</b>
                          <span className="hi-ev-name">{signal.label}</span>
                          <em>
                            {signalMode === "osha" && signal.count != null && signal.denominator
                              ? formatShare(signal.count, signal.denominator)
                              : signal.kind === "primary" ? "Primary" : signal.kind === "secondary" ? "Secondary" : `${signal.detail.length} refs`}
                          </em>
                          <small>
                            {signalMode === "osha" && signal.count != null && signal.denominator
                              ? `${signal.count.toLocaleString()} of ${signal.denominator.toLocaleString()} coded cases${KIND_TAG[signal.kind] ? ` · ${KIND_TAG[signal.kind]}` : ""}`
                              : KIND_LABEL[signal.kind]}
                          </small>
                          <i style={{ transform: `scaleX(${Math.max(0.04, signal.score)})` }} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}

            <section className="hi-readout" aria-label="Region readout" aria-live="polite" data-testid="region-readout">
              {readout ? (
                <>
                  <h3 className="hi-section-title">{readout.byRegion ? "REGION" : "EVIDENCE CATEGORY"}</h3>
                  <p className="hi-readout-name">{readout.title}</p>
                  {readout.rows.length ? (
                    readout.rows.map((signal) => (
                      <div className="hi-readout-row" key={signal.id}>
                        {readout.byRegion ? <p className="hi-readout-cat">{signal.label}</p> : null}
                        {signal.count != null && signal.denominator ? (
                          <p className="hi-readout-value">
                            {signal.count.toLocaleString()} of {signal.denominator.toLocaleString()} coded cases · {formatShare(signal.count, signal.denominator)}
                          </p>
                        ) : (
                          <p className="hi-readout-value">{KIND_LABEL[signal.kind]}</p>
                        )}
                        {signal.count != null ? <p className="hi-readout-kind">{KIND_LABEL[signal.kind]}</p> : null}
                        {signal.note ? <p className="hi-readout-note">{signal.note}</p> : null}
                        {signal.kind === "demand" || signal.kind === "primary" || signal.kind === "secondary"
                          ? signal.detail.slice(0, 3).map((line) => <p className="hi-readout-note" key={line}>{line}</p>)
                          : null}
                      </div>
                    ))
                  ) : signals.length ? (
                    <p className="hi-readout-note">
                      No source category in this evidence is coded specifically to this region. A category that is not listed is not evidence that no injuries occurred here.
                    </p>
                  ) : (
                    <p className="hi-readout-note">Anatomical region. Search an occupation or select a condition to map evidence.</p>
                  )}
                </>
              ) : (
                <p className="hi-readout-note">{signals.length ? "Hover or select a region or evidence row to inspect it." : "Hover a region to inspect it. Evidence appears after an occupation search or condition selection."}</p>
              )}
            </section>
          </aside>
        </div>

        <footer className="hi-bar">
          <p className={`hi-status${status.busy ? " is-busy" : ""}${(status as { error?: boolean }).error ? " is-error" : ""}`} role="status">
            <i aria-hidden="true" />
            {status.text}
          </p>
          <p className="hi-note">{evidenceNote}</p>
        </footer>
      </main>
    </div>
  );
}
