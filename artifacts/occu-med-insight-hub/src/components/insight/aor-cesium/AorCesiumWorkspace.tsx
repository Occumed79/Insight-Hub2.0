import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Globe2, Loader2, Search } from "lucide-react";
import { intelligenceJson as getJson } from "@/lib/intelligence-request";
import { Sidebar } from "@/components/insight/Sidebar";
import { AorCommandPanel } from "./AorCommandPanel";
import { AorFlatMap } from "./AorFlatMap";
import { AorIntelPanel, type PanelTab } from "./AorIntelPanel";
import {
  buildDirectoryIndex, COMMAND_ORDER, COMMAND_VIEW, degradedDirectory, searchLocal, type AorDirectory, type CommandId, type DirectoryIndex, type DirectoryLocation, type SplitParent,
} from "./aor-directory";
import { indexBoundaries, type CountryIndex } from "./aor-geo";
import { EMPTY_MEDICAL_INPUTS } from "./aor-medical-types";
import type { MapView } from "./aor-view";
import { useMedicalApplicability } from "./use-medical-applicability";
import { DIMENSIONS, type CountryIntel, type Dimension, type EvidenceRecord, type SynthesisResponse, type WorldEvent } from "./aor-intel-types";

type SearchResults = { locations: DirectoryLocation[]; splitParents: SplitParent[] };

const errorText = (error: unknown) => (error instanceof Error ? error.message : "Request failed.");

export default function AorCesiumWorkspace() {
  const [index, setIndex] = useState<CountryIndex | null>(null);
  const [boundaryError, setBoundaryError] = useState("");
  const [directory, setDirectory] = useState<DirectoryIndex | null>(null);
  const [directoryError, setDirectoryError] = useState("");
  const [view, setView] = useState<MapView>({ level: "world", aorId: null, locationId: null, splitIso3: null, nonce: 0 });
  const [intel, setIntel] = useState<CountryIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState("");
  const [intelUnavailable, setIntelUnavailable] = useState<string | null>(null);
  // Selection displays source-backed details, following Apple’s map callout interaction:
  // https://developer.apple.com/documentation/mapkitjs/annotations
  // Map overlays load automatically; this workspace has no assignment/configuration form.
  const activeLayers = useRef<Set<Dimension>>(new Set(DIMENSIONS)).current;
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
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const options = { signal: controller.signal };
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
        // Keep repeated source rows from creating duplicate map markers.
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

  const location = view.locationId ? directory?.byId.get(view.locationId) ?? null : null;
  const split = view.splitIso3 ? directory?.splitByIso3.get(view.splitIso3) ?? null : null;
  const selectedAorId: CommandId | null = view.aorId;
  const displayName = split?.name || location?.name || intel?.country.name || view.locationId || "";

  const medical = useMedicalApplicability(location ? location.id : null, location ? location.iso3 ?? location.id : null, EMPTY_MEDICAL_INPUTS);

  const resetSelection = useCallback(() => {
    requestRef.current += 1;
    selectionRequest.current?.abort();
    setFocusEvidence(null);
    setIntel(null); setIntelError(""); setIntelLoading(false); setIntelUnavailable(null); setHighlightedId(null); setSynthesis(null); setSynthesisLoading(false);
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

  const crumb = (label: string, onClick?: () => void, current = false) => <button type="button" onClick={onClick} disabled={!onClick || current} className={`lg-press rounded-full px-2.5 py-1 text-callout font-semibold ${current ? "text-white" : "text-slate-300 hover:text-white"}`}>{label}</button>;
  const commandSummary = (id: CommandId) => directory?.directory.commands.find((entry) => entry.id === id);
  const searchHasResults = results.locations.length > 0 || results.splitParents.length > 0;
  const noMatch = query.trim().length > 1 && !searchHasResults;

  return (
    <main className="min-h-screen overflow-hidden bg-[#01050a] text-white" data-workspace="aor-factors-map" data-map-mode="2d">
      <Sidebar />
      <section className="fixed bottom-0 left-0 right-0 top-[4.5rem] overflow-hidden bg-[#01050a] lg:left-[210px] lg:top-0" aria-label="AOR Factors two-dimensional map workspace">
        {index && directory ? (
          <AorFlatMap
            index={index}
            directory={directory}
            view={view}
            evidence={intel?.evidence ?? []}
            activeLayers={activeLayers}
            worldEvents={worldEvents}
            focusEvidence={focusEvidence}
            showAorShading
            showMarkers
            rightInsetPx={panelOpen ? 536 : view.level === "aor" ? 376 : 0}
            onPickLocation={goLocation}
            onPickSplit={goSplit}
            onPickEvidence={pickEvidence}
            onHover={setHoverName}
          />
        ) : null}

        {(!index || !directory) && !boundaryError && !directoryError ? <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-100/55" size={22} /><p className="mt-3 text-callout text-slate-400">Loading map boundaries and locations…</p></div></div> : null}
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
            synthesis={synthesis}
            synthesisLoading={synthesisLoading}
            medical={medical}
          />
        ) : null}
      </section>
    </main>
  );
}
