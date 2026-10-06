import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import HologramStage from "./HologramStage";
import { HEALTH_CONDITIONS } from "./conditions";
import { anchorZone, type GroupKey, type Zone } from "./anatomy";
import type { Phase } from "./choreography";
import {
  deriveCaseSignals,
  deriveConditionSignals,
  deriveDemandSignals,
  type OshaCaseProfile,
  type Signal,
  type SignalMode,
} from "./signals";
import { useOccupationLookup } from "./useOccupationLookup";
import "./health-intelligence.css";

type Workspace = "injury" | "conditions";

const BOOT_STEPS = ["CALIBRATING ANATOMY FIELD", "MAPPING BODY REGIONS", "LINKING EVIDENCE SOURCES"];
const BOOT_MS = 3600;
const SUGGESTED_CONDITIONS = ["diabetes", "hypertension", "migraine", "spine", "hearing", "obesity"];

export default function HealthIntelligencePage() {
  const [workspace, setWorkspace] = useState<Workspace>("injury");
  const [booting, setBooting] = useState(true);
  const [bootStep, setBootStep] = useState(0);
  const [thinking, setThinking] = useState(false);

  const [occupation, setOccupation] = useState("");
  const { state: lookupState, lookup, reset } = useOccupationLookup();

  const [conditionQuery, setConditionQuery] = useState("");
  const [conditionId, setConditionId] = useState<string | null>(null);

  const [hoverZone, setHoverZone] = useState<Zone | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupKey | null>(null);

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

  // ---- evidence -> signals ----------------------------------------------------------------
  const onetProfile = lookupState.onet?.profile ?? null;
  const caseProfile = (lookupState.osha ?? null) as OshaCaseProfile | null;
  const condition = useMemo(() => HEALTH_CONDITIONS.find((item) => item.id === conditionId) ?? null, [conditionId]);

  const { signals, signalMode } = useMemo<{ signals: Signal[]; signalMode: SignalMode }>(() => {
    if (workspace === "conditions") {
      return condition ? { signals: deriveConditionSignals(condition), signalMode: "condition" } : { signals: [], signalMode: "idle" };
    }
    if (lookupState.status !== "ready" && lookupState.status !== "mapping") return { signals: [], signalMode: "idle" };
    const caseSignals = deriveCaseSignals(caseProfile);
    if (caseSignals.length) return { signals: caseSignals, signalMode: "osha" };
    if (onetProfile) return { signals: deriveDemandSignals(onetProfile), signalMode: "onet" };
    return { signals: [], signalMode: "idle" };
  }, [workspace, condition, lookupState.status, caseProfile, onetProfile]);

  // Converge on the strongest region whenever fresh evidence lands.
  useEffect(() => {
    if (!signals.length || lookupState.status === "mapping") {
      if (!signals.length) setSelectedGroup(null);
      return;
    }
    setSelectedGroup(signals[0].groups[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals]);

  const analyzing = workspace === "injury" && ["resolving", "correlating", "mapping"].includes(lookupState.status);
  const activeGroup = hoverZone?.group ?? selectedGroup;
  const phase: Phase = analyzing || thinking ? "analyze" : booting ? "calibrate" : activeGroup ? "focus" : "idle";

  // ---- handlers -----------------------------------------------------------------------------
  const switchWorkspace = (next: Workspace) => {
    if (next === workspace) return;
    setWorkspace(next);
    setSelectedGroup(null);
    setHoverZone(null);
  };

  const pickCondition = useCallback((id: string, label: string) => {
    setConditionId(id);
    setConditionQuery(label);
    setSelectedGroup(null);
    setThinking(true);
    window.setTimeout(() => setThinking(false), 1400);
  }, []);

  const handleSelect = (zone: Zone) => setSelectedGroup((current) => (current === zone.group ? null : zone.group));

  const submitOccupation = (event: React.FormEvent) => {
    event.preventDefault();
    setSelectedGroup(null);
    void lookup(occupation);
  };

  const filteredConditions = useMemo(() => {
    const needle = conditionQuery.trim().toLowerCase();
    if (condition && needle === condition.label.toLowerCase()) return [];
    const pool = needle
      ? HEALTH_CONDITIONS.filter((item) => [item.label, item.category, ...item.terms].some((value) => value.toLowerCase().includes(needle)))
      : HEALTH_CONDITIONS.filter((item) => SUGGESTED_CONDITIONS.includes(item.id));
    return pool.slice(0, 6);
  }, [conditionQuery, condition]);

  // ---- HUD copy -----------------------------------------------------------------------------
  const subject =
    workspace === "conditions"
      ? condition?.label ?? null
      : lookupState.status === "ready" || lookupState.status === "mapping"
        ? onetProfile?.occupation?.title ?? caseProfile?.occupationTitle ?? lookupState.query
        : null;

  const status = (() => {
    if (booting) return { text: BOOT_STEPS[bootStep], busy: true };
    if (thinking) return { text: "CORRELATING CONDITION CONTEXT", busy: true };
    if (workspace === "injury") {
      if (lookupState.status === "resolving") return { text: "RESOLVING OCCUPATION · O*NET", busy: true };
      if (lookupState.status === "correlating") return { text: "CORRELATING OSHA CASE DATA", busy: true };
      if (lookupState.status === "mapping") return { text: "GENERATING HEALTH INTELLIGENCE", busy: true };
      if (lookupState.status === "error") return { text: lookupState.error.toUpperCase(), busy: false, error: true };
      if (signalMode === "osha") return { text: `OSHA CASE-LINKED PROJECTION · CY${caseProfile?.oiicsYear ?? caseProfile?.selectedYear ?? "—"}`, busy: false };
      if (signalMode === "onet") return { text: "O*NET JOB-DEMAND EVIDENCE · NO CODED CASE DATA", busy: false };
      return { text: "STANDBY · SEARCH AN OCCUPATION TO ENERGIZE THE FIELD", busy: false };
    }
    return condition
      ? { text: `ANATOMICAL ASSOCIATION · ${condition.category.toUpperCase()}`, busy: false }
      : { text: "STANDBY · CHOOSE A CONDITION TO MAP ITS ANATOMY", busy: false };
  })();

  const evidenceNote =
    workspace === "conditions"
      ? "Anatomical association for context only — not a diagnosis or fitness-for-duty determination."
      : signalMode === "osha"
        ? "Reported case distribution — not an individual injury probability."
        : signalMode === "onet"
          ? "Job-demand context — not an injury rate."
          : "Evidence view only — not a fitness-for-duty determination.";

  const caseCounts =
    signalMode === "osha" && caseProfile
      ? `${(caseProfile.totalCases ?? 0).toLocaleString()} cases · ${(caseProfile.codedBodyPartCases ?? 0).toLocaleString()} with coded body part`
      : null;

  const focusFromIndex = (group: GroupKey | null) => setSelectedGroup(group);

  return (
    <div className="hi-page" data-page-identity="injuries-medical-conditions" data-workspace="injuries-medical-conditions">
      <Sidebar />
      <main className="hi-main">
        <header className="hi-top">
          <p className="hi-eyebrow"><span>HEALTH INTELLIGENCE</span><span>HOLOGRAPHIC INJURY ANATOMY</span></p>
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

        <div className="hi-stage-wrap">
          <HologramStage
            phase={phase}
            mode={signalMode}
            signals={signals}
            activeGroup={activeGroup}
            activeZoneId={hoverZone?.id ?? null}
            onHover={setHoverZone}
            onSelect={handleSelect}
          />
        </div>

        <aside className="hi-index" aria-label="Region signal index">
          {signals.length ? (
            <>
              <span className="hi-index-title">{signalMode === "osha" ? "REPORTED BODY-PART SIGNALS" : signalMode === "onet" ? "DEMAND ATTENTION REGIONS" : "ASSOCIATED REGIONS"}</span>
              {signals.slice(0, 7).map((signal, index) => {
                const group = signal.groups[0];
                const active = activeGroup ? signal.groups.includes(activeGroup) : false;
                return (
                  <button
                    key={signal.id}
                    className={active ? "is-active" : ""}
                    onPointerEnter={() => setHoverZone(anchorZone(group) ?? null)}
                    onPointerLeave={() => setHoverZone(null)}
                    onClick={() => focusFromIndex(selectedGroup === group ? null : group)}
                  >
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <span>{signal.label}</span>
                    <em>{signalMode === "osha" ? `${Math.round(signal.score * 100)}%` : signalMode === "onet" ? `${signal.detail.length}` : signal.score >= 0.6 ? "P" : "S"}</em>
                    <i style={{ transform: `scaleX(${Math.max(0.04, signal.score)})` }} />
                  </button>
                );
              })}
            </>
          ) : null}
        </aside>

        <aside className="hi-telemetry" aria-label="Analysis telemetry">
          <span>ANATOMY VECTOR · ANTERIOR / POSTERIOR</span>
          <span>VOLUMETRIC POINT CLOUD · ACTIVE</span>
          {subject ? <h2 className="hi-subject">{subject}</h2> : null}
          {subject ? <span>{signalMode === "osha" ? "OSHA case-linked projection" : signalMode === "onet" ? "O*NET demand evidence" : "Condition reference"}</span> : null}
          {caseCounts ? <span>{caseCounts}</span> : null}
          {lookupState.oshaError && workspace === "injury" ? <span className="is-warn">OSHA case data unavailable</span> : null}
        </aside>

        {workspace === "conditions" && filteredConditions.length ? (
          <ul className="hi-suggest" aria-label="Condition suggestions">
            {filteredConditions.map((item) => (
              <li key={item.id}>
                <button onClick={() => pickCondition(item.id, item.label)}>
                  <span>{item.label}</span>
                  <small>{item.category}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <footer className="hi-bar">
          <p className={`hi-status${status.busy ? " is-busy" : ""}${(status as { error?: boolean }).error ? " is-error" : ""}`} role="status">
            <i aria-hidden="true" />
            {status.text}
          </p>

          {workspace === "injury" ? (
            <form className="hi-form" onSubmit={submitOccupation}>
              <input
                value={occupation}
                onChange={(event) => setOccupation(event.target.value)}
                placeholder="Firefighter, electrician, truck driver…"
                aria-label="Occupation"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={!occupation.trim() || analyzing}>
                Build injury profile <ArrowRight size={13} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <form className="hi-form" onSubmit={(event) => { event.preventDefault(); if (filteredConditions[0]) pickCondition(filteredConditions[0].id, filteredConditions[0].label); }}>
              <input
                value={conditionQuery}
                onChange={(event) => { setConditionQuery(event.target.value); if (condition) setConditionId(null); }}
                placeholder="Search diabetes, migraine, hearing, anticoagulation…"
                aria-label="Medical condition"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={!filteredConditions.length}>
                Map condition <ArrowRight size={13} aria-hidden="true" />
              </button>
            </form>
          )}


          <p className="hi-note">{evidenceNote}</p>
        </footer>
      </main>
    </div>
  );
}
