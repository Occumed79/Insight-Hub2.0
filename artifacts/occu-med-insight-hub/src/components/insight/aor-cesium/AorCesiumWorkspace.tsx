import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Box, Globe2, Layers, Loader2, Map as MapIcon, Search } from "lucide-react";
import { intelligenceJson as getJson } from "@/lib/intelligence-request";
import { Sidebar } from "@/components/insight/Sidebar";
import { AorCesiumGlobe } from "./AorCesiumGlobe";
import { AorCommandPanel } from "./AorCommandPanel";
import { AorFlatMap } from "./AorFlatMap";
import { AorIntelPanel, type PanelTab } from "./AorIntelPanel";
import {
  buildDirectoryIndex, COMMAND_ORDER, COMMAND_VIEW, degradedDirectory, searchLocal, type AorDirectory, type CommandId, type DirectoryIndex, type DirectoryLocation, type SplitParent,
} from "./aor-directory";
import { indexBoundaries, type CountryIndex } from "./aor-geo";
import { EMPTY_MEDICAL_INPUTS, type MedicalInputs } from "./aor-medical-types";
import type { GlobeStatus, GlobeView } from "./aor-view";
import { useMedicalApplicability } from "./use-medical-applicability";
import { DIMENSIONS, DIMENSION_COLORS, DIMENSION_LABELS, ENVIRONMENT_KEYS, ENVIRONMENT_LABELS, type CountryIntel, type Dimension, type EnvironmentKey, type EvidenceRecord, type SynthesisResponse, type WorldEvent } from "./aor-intel-types";

type CesiumConfig = { configured: boolean; token: string; fallbackToken?: string | null; requiredEnv?: string; error?: string };
type LensResponse = { ok: boolean; classification: string; considerations: Array<{ ruleId: string; classification: string; summary: string; matchedTerms: string[]; countrySignals: string[]; evidenceText: string }> };
type SearchResults = { locations: DirectoryLocation[]; splitParents: SplitParent[] };

const errorText = (error: unknown) => (error instanceof Error ? error.message : "Request failed.");

export default function AorCesiumWorkspace() {
  const [config, setConfig] = useState<CesiumConfig | null>(null);
  // A single automatic retry is allowed with the second Cesium ion account.
  // If both tokens fail, preserve the existing 2D-map fallback.
  const [usingBackupIon, setUsingBackupIon] = useState(false);
  const [index, setIndex] = useState<CountryIndex | null>(null);
  const [boundaryError, setBoundaryError] = useState("");
  const [directory, setDirectory] = useState<DirectoryIndex | null>(null);
  const [directoryError, setDirectoryError] = useState("");
  const [status, setStatus] = useState<GlobeStatus>({ state: "loading" });
  const [mapMode, setMapMode] = useState<"3d" | "2d">("3d");
  const [mapNotice, setMapNotice] = useState("");
  const [view, setView] = useState<GlobeView>({ level: "world", aorId: null, locationId: null, splitIso3: null, nonce: 0 });
  const [intel, setIntel] = useState<CountryIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState("");
  const [intelUnavailable, setIntelUnavailable] = useState<string | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<Dimension>>(new Set(DIMENSIONS));
  const [showAorShading, setShowAorShading] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!layersOpen) return;
    const close = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent) { if (event.key === "Escape") setLayersOpen(false); return; }
      if (layersRef.current && !layersRef.current.contains(event.target as Node)) setLayersOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", close); };
  }, [layersOpen]);
  const [activeTab, setActiveTab] = useState<PanelTab>("medical");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [focusEvidence, setFocusEvidence] = useState<{ id: string; nonce: number } | null>(null);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ locations: [], splitParents: [] });
  const [panelOpen, setPanelOpen] = useState(false);
  const requestRef = useRef(0);
  const selectionRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { requestRef.current += 1; selectionRequest.current?.abort(); }, []);
  const [synthesis, setSynthesis] = useState<SynthesisResponse | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [environment, setEnvironment] = useState<Record<EnvironmentKey, boolean>>({ heat: false, cold: false, altitude: false, poorAir: false, fatigue: false, ppe: false, night: false });
  const [medicalInputs, setMedicalInputsState] = useState<MedicalInputs>(EMPTY_MEDICAL_INPUTS);
  const setMedicalInputs = useCallback((updater: (current: MedicalInputs) => MedicalInputs) => setMedicalInputsState(updater), []);

  // Lens (retained from the earlier AOR build): transient medical-condition x deployment-context evaluation.
  const [condition, setCondition] = useState("");
  const [medication, setMedication] = useState("");
  const [workContext, setWorkContext] = useState("");
  const [lens, setLens] = useState<LensResponse | null>(null);
  const [lensError, setLensError] = useState("");
  const [lensLoading, setLensLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    getJson<CesiumConfig>("/api/aor/cesium-config", options).then((payload) => { if (active) setConfig(payload); }).catch((error) => { if (active) setConfig({ configured: false, token: "", error: errorText(error) }); });
    getJson<{ features: never[] }>("/api/aor/boundaries", options).then((payload) => { if (active) setIndex(indexBoundaries(payload as never)); }).catch((error) => { if (active) setBoundaryError(errorText(error)); });
    getJson<AorDirectory & { ok?: boolean }>("/api/aor/directory", options)
      .then((payload) => { if (!active) return; if (!Array.isArray(payload.locations)) throw new Error("The location directory response was empty."); setDirectory(buildDirectoryIndex(payload)); })
      .catch((error) => { if (active) setDirectoryError(errorText(error)); });
    getJson<{ earthquakes?: Array<{ id: string; title?: string; magnitude?: number; latitude?: number; longitude?: number; place?: string; url?: string }>; disasters?: Array<{ id?: string; eventId?: string; title?: string; name?: string; eventType?: string; alertLevel?: string; latitude?: number; longitude?: number; url?: string; sourceUrl?: string }> }>("/api/aor/global-watch", options)
      .then((payload) => {
        if (!active) return;
        const events: WorldEvent[] = [];
        for (const quake of payload.earthquakes ?? []) if (Number.isFinite(quake.latitude) && Number.isFinite(quake.longitude)) events.push({ id: `eq-${quake.id}`, kind: "earthquake", title: quake.title || "Earthquake", lon: quake.longitude as number, lat: quake.latitude as number, detail: quake.place || "", url: quake.url || "" });
        // /api/aor/global-watch returns GDACS rows as { eventType, eventId, name, sourceUrl } (not id/title/url).
        (payload.disasters ?? []).forEach((disaster, position) => {
          if (!Number.isFinite(disaster.latitude) || !Number.isFinite(disaster.longitude)) return;
          const key = disaster.eventId || disaster.id || disaster.name || disaster.title || `row${position}`;
          events.push({ id: `gd-${disaster.eventType || "event"}-${key}`, kind: "disaster", title: disaster.name || disaster.title || "GDACS event", lon: disaster.longitude as number, lat: disaster.latitude as number, detail: disaster.alertLevel || "", url: disaster.sourceUrl || disaster.url || "" });
        });
        // Cesium throws on duplicate entity ids; a repeated feed row must never take the whole view down.
        const seenIds = new Set<string>();
        setWorldEvents(events.filter((event) => (seenIds.has(event.id) ? false : (seenIds.add(event.id), true))));
      })
      .catch(() => { /* world watch is optional context; absence is shown by the empty layer */ });
    return () => { active = false; controller.abort(); };
  }, []);

  // If the backend directory is unavailable the polygons still work, but no AOR is shown or invented.
  useEffect(() => {
    if (directory || !directoryError || !index) return;
    setDirectory(buildDirectoryIndex(degradedDirectory(index)));
  }, [directory, directoryError, index]);

  // Without a Cesium ion token the 3D globe cannot run; the 2D map is used and the reason stays visible.
  useEffect(() => {
    if (config && !config.configured) setMapMode("2d");
  }, [config]);
  useEffect(() => {
    if (status.state !== "error" || !status.fatal) return;
    if (status.retryable && !usingBackupIon && config?.fallbackToken) {
      // Fatal Cesium ion imagery/auth/rate-limit failure: remount once with the
      // separately configured second-account token rather than falling straight to 2D.
      setUsingBackupIon(true);
      setStatus({ state: "loading" });
      return;
    }
    setMapMode("2d");
    setMapNotice(`The 3D globe could not start (${status.message || "WebGL or Cesium error"}). Showing the 2D map.`);
  }, [status, usingBackupIon, config?.fallbackToken]);

  const location = view.locationId ? directory?.byId.get(view.locationId) ?? null : null;
  const split = view.splitIso3 ? directory?.splitByIso3.get(view.splitIso3) ?? null : null;
  const selectedAorId: CommandId | null = view.aorId;
  const displayName = split?.name || location?.name || intel?.country.name || view.locationId || "";
  const intelIso2 = location?.countryIntelIso2 ?? null;

  const medical = useMedicalApplicability(location ? location.id : null, location ? location.iso3 ?? location.id : null, medicalInputs);

  const resetSelection = useCallback(() => {
    requestRef.current += 1;
    selectionRequest.current?.abort();
    setLensLoading(false); setFocusEvidence(null);
    setIntel(null); setIntelError(""); setIntelLoading(false); setIntelUnavailable(null); setHighlightedId(null); setLens(null); setLensError(""); setSynthesis(null); setSynthesisLoading(false);
  }, []);

  const goWorld = useCallback(() => {
    resetSelection(); setPanelOpen(false);
    setView((current) => ({ level: "world", aorId: null, locationId: null, splitIso3: null, nonce: current.nonce + 1 }));
  }, [resetSelection]);

  const goAor = useCallback((aorId: CommandId) => {
    resetSelection(); setPanelOpen(false);
    setView((current) => ({ level: "aor", aorId, locationId: null, splitIso3: null, nonce: current.nonce + 1 }));
  }, [resetSelection]);

  const goSplit = useCallback((iso3: string) => {
    resetSelection();
    setPanelOpen(true); setActiveTab("medical");
    setView((current) => ({ level: "country", aorId: current.aorId, locationId: null, splitIso3: iso3, nonce: current.nonce + 1 }));
  }, [resetSelection]);

  const goLocation = useCallback((id: string) => {
    const target = directory?.byId.get(id);
    if (!target) return;
    resetSelection();
    const request = requestRef.current;
    const controller = new AbortController();
    selectionRequest.current = controller;
    setPanelOpen(true); setActiveTab("medical");
    setView((current) => ({ level: "country", aorId: target.command ?? current.aorId, locationId: target.id, splitIso3: null, nonce: current.nonce + 1 }));
    const iso2 = target.countryIntelIso2;
    if (!iso2) {
      setIntelUnavailable(`The per-country intelligence engines (CDC, WHO, State Department, GDACS, USGS, CrisisWatch, malaria, environment) are keyed to country profiles and boundary polygons, and none exists for ${target.name}. Those layers are not evaluated for it, and nothing is substituted.`);
      return;
    }
    setIntelLoading(true);
    getJson<CountryIntel>(`/api/aor/country-intel?iso2=${encodeURIComponent(iso2)}`, { signal: controller.signal })
      .then((payload) => {
        if (requestRef.current !== request) return;
        setIntel(payload);
        if (payload.whatMattersNow.llmSynthesis !== "available") return;
        // The AI briefing is requested only after the evidence is on screen and is validated server-side.
        setSynthesisLoading(true);
        getJson<SynthesisResponse>(`/api/aor/country-intel/synthesis?iso2=${encodeURIComponent(iso2)}`, { signal: controller.signal })
          .then((briefing) => { if (requestRef.current === request) setSynthesis(briefing); })
          .catch(() => { /* the deterministic summary stays; briefing is optional */ })
          .finally(() => { if (requestRef.current === request) setSynthesisLoading(false); });
      })
      .catch((error) => { if (requestRef.current === request) setIntelError(errorText(error)); })
      .finally(() => { if (requestRef.current === request) setIntelLoading(false); });
  }, [directory, resetSelection]);

  const selectEvidence = useCallback((id: string) => {
    const record = intel?.evidence.find((item) => item.id === id);
    if (!record) return;
    setPanelOpen(true); setActiveTab(record.dimension); setHighlightedId(id);
    window.setTimeout(() => document.getElementById(`evidence-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
  }, [intel]);

  const focusRecord = useCallback((record: EvidenceRecord) => {
    setHighlightedId(record.id);
    setFocusEvidence((current) => ({ id: record.id, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);

  const pickEvidence = useCallback((id: string) => { selectEvidence(id); setFocusEvidence((current) => ({ id, nonce: (current?.nonce ?? 0) + 1 })); }, [selectEvidence]);

  // Search: the server resolves names, aliases, ISO codes and split ISO entities against the 285-location registry; the local index is the offline fallback.
  useEffect(() => {
    const text = query.trim();
    if (!text) { setResults({ locations: [], splitParents: [] }); return; }
    let active = true;
    const controller = new AbortController();
    if (directory) setResults(searchLocal(directory, text));
    const timer = window.setTimeout(() => {
      getJson<SearchResults & { ok?: boolean }>(`/api/aor/directory?q=${encodeURIComponent(text)}&limit=10`, { signal: controller.signal })
        .then((payload) => {
          if (!active || !directory) return;
          // Keep only ids the loaded directory knows, so every result is selectable.
          setResults({ locations: (payload.locations ?? []).filter((entry) => directory.byId.has(entry.id)).map((entry) => directory.byId.get(entry.id)!), splitParents: (payload.splitParents ?? []).filter((entry) => directory.splitByIso3.has(entry.iso3)).map((entry) => directory.splitByIso3.get(entry.iso3)!) });
        })
        .catch(() => { if (active && directory) setResults(searchLocal(directory, text)); });
    }, 120);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [query, directory]);

  const toggleLayer = (dimension: Dimension) => setActiveLayers((current) => { const next = new Set(current); if (next.has(dimension)) next.delete(dimension); else next.add(dimension); return next; });
  const layerCounts = useMemo(() => { const counts = new Map<Dimension, number>(); for (const record of intel?.evidence ?? []) counts.set(record.dimension, (counts.get(record.dimension) ?? 0) + 1); return counts; }, [intel]);

  async function runLens() {
    const context = [workContext.trim(), ...ENVIRONMENT_KEYS.filter((key) => environment[key]).map((key) => ENVIRONMENT_LABELS[key])].filter(Boolean).join("; ");
    if (!intelIso2 || (!condition.trim() && !medication.trim() && !context)) return;
    const request = requestRef.current;
    setLensLoading(true); setLensError("");
    try {
      const payload = await getJson<LensResponse>("/api/aor/country-condition-lens", {
        method: "POST", signal: selectionRequest.current?.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iso2: intelIso2, condition: condition.trim(), medication: medication.trim(), workContext: context }),
      });
      if (requestRef.current === request) setLens(payload);
    } catch (error) { if (requestRef.current === request) { setLens(null); setLensError(errorText(error)); } }
    finally { if (requestRef.current === request) setLensLoading(false); }
  }

  const lensBlock = intelIso2 ? (
    <details className="mt-3 border-t border-white/[.06] pt-3">
      <summary className="cursor-pointer text-caption font-semibold text-slate-500">Medical condition × deployment context (transient, not stored)</summary>
      {ENVIRONMENT_KEYS.some((key) => environment[key]) ? <p className="mt-1.5 text-footnote leading-4 text-slate-400">Environment factors included: {ENVIRONMENT_KEYS.filter((key) => environment[key]).map((key) => ENVIRONMENT_LABELS[key]).join(", ")}</p> : null}
      <div className="mt-2 space-y-1.5">
        {([["Condition", condition, setCondition], ["Medication", medication, setMedication], ["Work context", workContext, setWorkContext]] as const).map(([label, value, setter]) => (
          <input key={label} value={value} onChange={(event) => setter(event.target.value)} placeholder={label} aria-label={label} autoComplete="off" className="min-h-8 w-full rounded-[10px] border border-white/[.08] bg-black/25 px-3 text-callout text-white outline-none placeholder:text-slate-600" />
        ))}
        <button type="button" onClick={() => void runLens()} disabled={lensLoading || (!condition.trim() && !medication.trim() && !workContext.trim() && !ENVIRONMENT_KEYS.some((key) => environment[key]))} className="min-h-8 w-full rounded-[10px] border border-cyan-100/15 bg-cyan-200/[.06] text-callout font-bold text-cyan-50/80 disabled:opacity-40">{lensLoading ? "Evaluating…" : "Evaluate considerations"}</button>
        {lensError ? <p className="text-footnote text-amber-100/70">{lensError}</p> : null}
        {lens ? <div className="pt-1"><p className="text-callout font-bold text-white/85">{lens.classification}</p>{lens.considerations.map((item) => <div key={item.ruleId} className="mt-1.5 border-t border-white/[.05] pt-1.5 text-footnote leading-4 text-slate-400"><b className="text-white/75">{item.classification}</b> — {item.summary}{item.evidenceText ? <p className="mt-0.5 text-slate-500">{item.evidenceText}</p> : null}</div>)}</div> : null}
      </div>
    </details>
  ) : null;

  const altitudeLimitMeters = useMemo(() => {
    if (!activeLayers.has("malaria")) return null;
    const record = intel?.evidence.find((item) => item.dimension === "malaria" && item.category === "malaria");
    const limit = ((record?.extra?.malaria ?? {}) as { altitudeLimitMeters?: number | null }).altitudeLimitMeters;
    return typeof limit === "number" && limit > 0 ? limit : null;
  }, [intel, activeLayers]);

  const activeIonToken = (usingBackupIon && config?.fallbackToken) || config?.token || "";
  const globeReady = Boolean(config?.configured && activeIonToken);
  const use3d = globeReady && mapMode === "3d";
  const crumb = (label: string, onClick?: () => void, current = false) => <button type="button" onClick={onClick} disabled={!onClick || current} className={`lg-press rounded-full px-2.5 py-1 text-callout font-semibold ${current ? "text-white" : "text-slate-300 hover:text-white"}`}>{label}</button>;
  const commandSummary = (id: CommandId) => directory?.directory.commands.find((entry) => entry.id === id);
  const searchHasResults = results.locations.length > 0 || results.splitParents.length > 0;
  const noMatch = query.trim().length > 1 && !searchHasResults;

  return (
    <main className="min-h-screen overflow-hidden bg-[#01050a] text-white" data-workspace="aor-factors-cesium" data-map-mode={use3d ? "3d" : "2d"}>
      <Sidebar />
      <section className="fixed bottom-0 left-0 right-0 top-[4.5rem] overflow-hidden bg-[#01050a] lg:left-[210px] lg:top-0" aria-label="AOR Factors CesiumJS globe workspace">
        {use3d ? (
          <AorCesiumGlobe
            token={activeIonToken}
            index={index}
            directory={directory}
            view={view}
            evidence={intel?.evidence ?? []}
            activeLayers={activeLayers}
            worldEvents={worldEvents}
            focusEvidence={focusEvidence}
            centerFallback={intel?.country.center ?? null}
            altitudeLimitMeters={altitudeLimitMeters}
            showAorShading={showAorShading}
            showMarkers={showMarkers}
            rightInsetPx={view.level === "world" ? 0 : view.level === "aor" ? 376 : 436}
            onPickLocation={goLocation}
            onPickSplit={goSplit}
            onPickEvidence={pickEvidence}
            onHoverCountry={setHoverName}
            onStatus={setStatus}
          />
        ) : index && directory ? (
          <AorFlatMap
            index={index}
            directory={directory}
            view={view}
            evidence={intel?.evidence ?? []}
            activeLayers={activeLayers}
            worldEvents={worldEvents}
            showAorShading={showAorShading}
            showMarkers={showMarkers}
            rightInsetPx={view.level === "world" ? 0 : view.level === "aor" ? 376 : 436}
            onPickLocation={goLocation}
            onPickSplit={goSplit}
            onPickEvidence={pickEvidence}
            onHover={setHoverName}
          />
        ) : null}

        {(!config || (use3d && status.state === "loading")) ? <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-100/55" size={22} /><p className="mt-3 text-callout text-slate-400">Loading Cesium terrain and imagery…</p></div></div> : null}
        {boundaryError ? <div className="lg-glass absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full px-4 py-2 text-callout text-amber-100">Country boundaries failed to load: {boundaryError}</div> : null}
        {directoryError ? <div data-testid="aor-directory-error" className="lg-glass absolute left-1/2 top-24 z-30 max-w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 rounded-[20px] px-4 py-2.5 text-center text-callout leading-5 text-amber-100"><AlertTriangle size={11} className="mr-1 inline" />The location directory could not be loaded ({directoryError}). Countries can still be opened from the map, but their area of responsibility is not shown because it is not assumed.</div> : null}

        {/* Restrained floating controls: scope breadcrumb, AOR chips, location search */}
        <div className={`pointer-events-none absolute left-4 top-4 z-30 flex flex-col gap-2 ${panelOpen ? "max-w-[calc(100%-560px)]" : view.level === "aor" ? "max-w-[calc(100%-440px)]" : "max-w-[calc(100%-2rem)]"}`}>
          <nav aria-label="Scope" className="lg-glass pointer-events-auto relative flex w-fit items-center gap-0.5 rounded-full p-1">
            <Globe2 size={14} className="ml-2 text-slate-300" />
            {crumb("World", view.level === "world" ? undefined : goWorld, view.level === "world")}
            {selectedAorId ? <><span className="text-slate-600">›</span>{crumb(COMMAND_VIEW[selectedAorId].label, view.level === "country" ? () => goAor(selectedAorId) : undefined, view.level === "aor")}</> : null}
            {location || split || view.locationId ? <><span className="text-slate-600">›</span>{crumb(displayName, undefined, true)}</> : null}
          </nav>
          <div className="lg-glass pointer-events-auto relative flex w-fit max-w-full flex-wrap gap-0.5 rounded-full p-1" data-testid="aor-command-chips" role="group" aria-label="Combatant commands">
            {COMMAND_ORDER.filter((id) => directory && !directory.directory.degraded && commandSummary(id)).map((id) => <button key={id} type="button" data-testid={`aor-chip-${id}`} aria-pressed={selectedAorId === id} onClick={() => goAor(id)} title={commandSummary(id) ? `${commandSummary(id)!.total} locations` : undefined} className={`lg-press rounded-full px-3 py-1.5 text-footnote font-semibold ${selectedAorId === id ? "lg-lens" : "text-slate-300 hover:bg-white/[.06] hover:text-white"}`}><span className="mr-1.5 inline-block h-2 w-2 rounded-full align-[1px]" style={{ background: COMMAND_VIEW[id].color }} />{COMMAND_VIEW[id].label.replace("US", "")}</button>)}
          </div>
          <div className="pointer-events-auto relative z-10 w-80">
            <div className="lg-glass relative flex items-center gap-2 rounded-full px-3.5 transition focus-within:shadow-[0_0_0_2px_rgba(103,232,249,.45)]"><Search size={15} className="text-slate-300" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && results.locations[0]) { event.preventDefault(); setQuery(""); goLocation(results.locations[0].id); } else if (event.key === "Escape") setQuery(""); }} placeholder="Find a country or territory" aria-label="Find a country or territory" autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false} enterKeyHint="go" style={{ outline: "none" }} className="h-10 w-full bg-transparent text-body text-white placeholder:text-slate-400" /></div>
            {searchHasResults ? (
              <ul data-testid="aor-search-results" className="lg-glass-panel absolute left-0 right-0 top-12 max-h-80 overflow-y-auto rounded-[20px] p-1.5">
                {results.splitParents.map((entry) => <li key={entry.iso3}><button type="button" data-testid="aor-search-split" onClick={() => { setQuery(""); goSplit(entry.iso3); }} className="flex w-full items-center justify-between gap-2 rounded-[14px] px-3 py-2.5 text-left text-body text-white/90 hover:bg-white/[.08]"><span>{entry.name}</span><span className="text-footnote text-amber-200/80">split across {entry.commands.map((id) => COMMAND_VIEW[id].short).join(" / ")}</span></button></li>)}
                {results.locations.map((entry) => <li key={entry.id}><button type="button" data-testid="aor-search-result" data-location-id={entry.id} onClick={() => { setQuery(""); goLocation(entry.id); }} className="flex w-full items-center justify-between gap-2 rounded-[14px] px-3 py-2.5 text-left text-body text-white/90 hover:bg-white/[.08]"><span className="min-w-0"><span className="block truncate">{entry.name}</span>{entry.entityType === "entity" ? <span className="block truncate text-caption text-slate-500">{entry.categoryLabel}{entry.parentName ? ` · ${entry.parentName}` : ""}{!entry.boundaryIso2 ? " · point only" : ""}</span> : null}</span><span className="shrink-0 text-footnote text-slate-500">{entry.command ? COMMAND_VIEW[entry.command].short : entry.iso2}</span></button></li>)}
              </ul>
            ) : noMatch ? <p className="lg-glass-panel absolute left-0 right-0 top-12 rounded-[20px] px-4 py-3 text-callout text-slate-300">No directory location matches “{query.trim()}”.</p> : null}
          </div>
          {config && !config.configured ? (
          <div data-testid="aor-cesium-token-missing" role="status" className="lg-glass pointer-events-auto relative w-80 rounded-[20px] px-4 py-3 text-left">
            <p className="flex items-center gap-1.5 text-body font-semibold text-white"><AlertTriangle className="shrink-0 text-amber-300" size={15} />3D globe unavailable: no Cesium ion token</p>
            <p className="mt-1 text-callout leading-5 text-slate-300">Set <code className="rounded bg-white/10 px-1">{config.requiredEnv || "CESIUM_ION_ACCESS_TOKEN"}</code> on the API service to enable the CesiumJS globe with Cesium ion terrain and imagery. The same registry, search and requirements run on the 2D map meanwhile.</p>
          </div>
        ) : null}
          {use3d && usingBackupIon ? <div data-testid="aor-cesium-backup-active" role="status" className="lg-glass pointer-events-auto relative w-80 rounded-full px-4 py-2 text-callout text-slate-200">Using backup Cesium ion token.</div> : null}
          {use3d && status.state === "error" && !status.fatal ? <div className="lg-glass pointer-events-auto relative w-80 rounded-[20px] px-4 py-2.5 text-callout leading-5 text-amber-100"><AlertTriangle size={11} className="mr-1 inline" />{status.message || "Cesium reported an error."}</div> : null}
          {mapNotice && !use3d && globeReady ? <div data-testid="aor-map-notice" className="lg-glass pointer-events-auto relative w-80 rounded-[20px] px-4 py-2.5 text-callout leading-5 text-amber-100"><AlertTriangle size={11} className="mr-1 inline" />{mapNotice}</div> : null}
        </div>

        {/* Compact layer selector and map-mode toggle */}
        <div ref={layersRef} className="absolute bottom-5 left-4 z-30">
          {layersOpen ? <ul className="lg-glass-panel absolute bottom-12 left-0 w-72 overflow-hidden rounded-[20px] p-1.5" aria-label="Map layers">
              <li className="px-3 pb-1 pt-2 text-footnote font-semibold text-slate-400">Registry Overlays</li>
              <li><button type="button" data-testid="aor-toggle-shading" aria-pressed={showAorShading} onClick={() => setShowAorShading((value) => !value)} className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-callout text-white/90 hover:bg-white/[.08]"><span className="h-2 w-2 rounded-full border border-cyan-200" style={{ background: showAorShading ? "#67e8f9" : "transparent" }} /><span className="flex-1">AOR shading by command</span></button></li>
              <li><button type="button" data-testid="aor-toggle-markers" aria-pressed={showMarkers} onClick={() => setShowMarkers((value) => !value)} className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-callout text-white/90 hover:bg-white/[.08]"><span className="h-2 w-2 rounded-full border border-cyan-200" style={{ background: showMarkers ? "#67e8f9" : "transparent" }} /><span className="flex-1">Markers for locations without a boundary</span>{directory ? <span className="text-footnote tabular-nums text-slate-500">{directory.directory.withoutPolygonCount}</span> : null}</button></li>
              <li className="px-3 pb-1 pt-3 text-footnote font-semibold text-slate-400">Intelligence Layers</li>
              {DIMENSIONS.map((dimension) => <li key={dimension}><button type="button" aria-pressed={activeLayers.has(dimension)} onClick={() => toggleLayer(dimension)} className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-callout text-white/90 hover:bg-white/[.08]"><span className="h-2 w-2 rounded-full" style={{ background: activeLayers.has(dimension) ? DIMENSION_COLORS[dimension] : "transparent", border: `1px solid ${DIMENSION_COLORS[dimension]}` }} /><span className="flex-1">{DIMENSION_LABELS[dimension]}</span>{layerCounts.get(dimension) ? <span className="text-footnote tabular-nums text-slate-500">{layerCounts.get(dimension)}</span> : null}</button></li>)}
              <li className="mt-1 border-t border-white/[.08] px-3 py-2.5 text-footnote leading-4 text-slate-400">Points use real source coordinates. Country shading appears only where a source covers the whole country. Text-only geography is listed in the panel, not drawn. Locations without a boundary are points, never outlines.</li>
            </ul> : null}
          <div className="lg-glass pointer-events-auto relative flex items-center gap-0.5 rounded-full p-1" role="group" aria-label="Map controls">
            <button type="button" onClick={() => setLayersOpen((open) => !open)} aria-expanded={layersOpen} className={`lg-press inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-callout font-semibold ${layersOpen ? "lg-lens" : "text-slate-200 hover:bg-white/[.06]"}`}><Layers size={15} />Layers · {activeLayers.size}/{DIMENSIONS.length}</button>
            
            <span aria-hidden className="mx-0.5 h-5 w-px bg-white/15" />
            <button type="button" data-testid="aor-map-mode" onClick={() => { setMapNotice(""); setStatus({ state: "loading" }); if (mapMode === "2d") setUsingBackupIon(false); setMapMode((mode) => (mode === "3d" ? "2d" : "3d")); }} disabled={!globeReady && mapMode === "2d"} title={globeReady ? undefined : "The 3D globe needs a Cesium ion token"} className="lg-press inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-callout font-semibold text-slate-200 hover:bg-white/[.06] disabled:opacity-45 disabled:hover:bg-transparent">{use3d ? <><MapIcon size={15} />2D map</> : <><Box size={15} />3D globe</>}</button>
          </div>
        </div>

        {hoverName && view.level !== "country" ? <div className="lg-glass pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full px-4 py-1.5 text-callout font-semibold">{hoverName}</div> : null}
        {view.level === "world" && worldEvents.length && activeLayers.has("disasters") ? <div className="lg-glass pointer-events-none absolute bottom-5 right-4 z-20 rounded-full px-3.5 py-1.5 text-footnote text-slate-300">{worldEvents.length} recent global events (USGS M5.5+ and GDACS) at source coordinates</div> : null}

        {view.level === "aor" && selectedAorId && directory && !panelOpen ? <AorCommandPanel command={selectedAorId} directory={directory} onPick={goLocation} onClose={goWorld} /> : null}

        {panelOpen ? (
          <AorIntelPanel
            intel={intel}
            loading={intelLoading}
            error={intelError}
            intelUnavailable={intelUnavailable}
            location={location}
            split={split}
            directory={directory}
            displayName={displayName}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            highlightedId={highlightedId}
            onFocusEvidence={focusRecord}
            onSelectEvidence={selectEvidence}
            onPickLocation={goLocation}
            onClose={() => setPanelOpen(false)}
            lens={lensBlock}
            synthesis={synthesis}
            synthesisLoading={synthesisLoading}
            environment={environment}
            onToggleEnvironment={(key) => setEnvironment((current) => ({ ...current, [key]: !current[key] }))}
            medicalInputs={medicalInputs}
            setMedicalInputs={setMedicalInputs}
            medical={medical}
          />
        ) : null}
      </section>
    </main>
  );
}
