import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Globe2, Layers, Loader2, Search } from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { COMMANDS, COMMAND_BY_COUNTRY, type CommandId } from "@/components/insight/aor-command-registry";
import { AorCesiumGlobe, type GlobeStatus, type GlobeView } from "./AorCesiumGlobe";
import { AorIntelPanel } from "./AorIntelPanel";
import { indexBoundaries, searchCountries, type CountryIndex } from "./aor-geo";
import { DIMENSIONS, DIMENSION_COLORS, DIMENSION_LABELS, ENVIRONMENT_KEYS, ENVIRONMENT_LABELS, type CountryIntel, type Dimension, type EnvironmentKey, type EvidenceRecord, type SynthesisResponse, type WorldEvent } from "./aor-intel-types";

type CesiumConfig = { configured: boolean; token: string; requiredEnv?: string; error?: string };
type LensResponse = { ok: boolean; classification: string; considerations: Array<{ ruleId: string; classification: string; summary: string; matchedTerms: string[]; countrySignals: string[]; evidenceText: string }> };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !(payload as { configured?: boolean }).configured === false) throw new Error((payload as { error?: string }).error || `Request failed (${response.status}).`);
  return payload as T;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : "Request failed.");

export default function AorCesiumWorkspace() {
  const [config, setConfig] = useState<CesiumConfig | null>(null);
  const [index, setIndex] = useState<CountryIndex | null>(null);
  const [boundaryError, setBoundaryError] = useState("");
  const [status, setStatus] = useState<GlobeStatus>({ state: "loading" });
  const [view, setView] = useState<GlobeView>({ level: "world", aorId: null, iso2: null, nonce: 0 });
  const [intel, setIntel] = useState<CountryIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState("");
  const [activeLayers, setActiveLayers] = useState<Set<Dimension>>(new Set(DIMENSIONS));
  const [layersOpen, setLayersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Dimension | "summary" | "sources">("summary");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [focusEvidence, setFocusEvidence] = useState<{ id: string; nonce: number } | null>(null);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const requestRef = useRef(0);
  const [synthesis, setSynthesis] = useState<SynthesisResponse | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [environment, setEnvironment] = useState<Record<EnvironmentKey, boolean>>({ heat: false, cold: false, altitude: false, poorAir: false, fatigue: false, ppe: false, night: false });

  // Lens (retained from the earlier AOR build): transient medical-condition x deployment-context evaluation.
  const [condition, setCondition] = useState("");
  const [medication, setMedication] = useState("");
  const [workContext, setWorkContext] = useState("");
  const [lens, setLens] = useState<LensResponse | null>(null);
  const [lensError, setLensError] = useState("");
  const [lensLoading, setLensLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getJson<CesiumConfig>("/api/aor/cesium-config").then((payload) => { if (active) setConfig(payload); }).catch((error) => { if (active) setConfig({ configured: false, token: "", error: errorText(error) }); });
    getJson<{ features: never[] }>("/api/aor/boundaries").then((payload) => { if (active) setIndex(indexBoundaries(payload as never)); }).catch((error) => { if (active) setBoundaryError(errorText(error)); });
    getJson<{ earthquakes?: Array<{ id: string; title?: string; magnitude?: number; latitude?: number; longitude?: number; place?: string; url?: string }>; disasters?: Array<{ id?: string; title?: string; eventType?: string; alertLevel?: string; latitude?: number; longitude?: number; url?: string }> }>("/api/aor/global-watch")
      .then((payload) => {
        if (!active) return;
        const events: WorldEvent[] = [];
        for (const quake of payload.earthquakes ?? []) if (Number.isFinite(quake.latitude) && Number.isFinite(quake.longitude)) events.push({ id: `eq-${quake.id}`, kind: "earthquake", title: quake.title || "Earthquake", lon: quake.longitude as number, lat: quake.latitude as number, detail: quake.place || "", url: quake.url || "" });
        for (const disaster of payload.disasters ?? []) if (Number.isFinite(disaster.latitude) && Number.isFinite(disaster.longitude)) events.push({ id: `gd-${disaster.id || disaster.title}`, kind: "disaster", title: disaster.title || "GDACS event", lon: disaster.longitude as number, lat: disaster.latitude as number, detail: disaster.alertLevel || "", url: disaster.url || "" });
        setWorldEvents(events);
      })
      .catch(() => { /* world watch is optional context; absence is shown by the empty layer */ });
    return () => { active = false; };
  }, []);

  const selectedEntry = view.iso2 ? index?.byIso2.get(view.iso2) ?? null : null;
  const selectedAor = COMMANDS.find((item) => item.id === view.aorId) ?? null;

  const goWorld = useCallback(() => {
    requestRef.current += 1;
    setView((current) => ({ level: "world", aorId: null, iso2: null, nonce: current.nonce + 1 }));
    setIntel(null); setIntelError(""); setIntelLoading(false); setPanelOpen(false); setHighlightedId(null); setLens(null); setSynthesis(null); setSynthesisLoading(false);
  }, []);

  const goAor = useCallback((aorId: CommandId) => {
    requestRef.current += 1;
    setView((current) => ({ level: "aor", aorId, iso2: null, nonce: current.nonce + 1 }));
    setIntel(null); setIntelError(""); setIntelLoading(false); setPanelOpen(false); setHighlightedId(null); setLens(null); setSynthesis(null); setSynthesisLoading(false);
  }, []);

  const goCountry = useCallback((iso2: string) => {
    const code = iso2.toUpperCase();
    const request = (requestRef.current += 1);
    const mapped = COMMAND_BY_COUNTRY.get(code)?.id ?? null;
    setView((current) => ({ level: "country", aorId: mapped ?? current.aorId, iso2: code, nonce: current.nonce + 1 }));
    setPanelOpen(true); setActiveTab("summary"); setHighlightedId(null); setLens(null); setLensError("");
    setIntel(null); setIntelError(""); setIntelLoading(true); setSynthesis(null); setSynthesisLoading(false);
    getJson<CountryIntel>(`/api/aor/country-intel?iso2=${encodeURIComponent(code)}`)
      .then((payload) => {
        if (requestRef.current !== request) return;
        setIntel(payload);
        if (payload.whatMattersNow.llmSynthesis !== "available") return;
        // The AI briefing is requested only after the evidence is on screen and is validated server-side.
        setSynthesisLoading(true);
        getJson<SynthesisResponse>(`/api/aor/country-intel/synthesis?iso2=${encodeURIComponent(code)}`)
          .then((briefing) => { if (requestRef.current === request) setSynthesis(briefing); })
          .catch(() => { /* the deterministic summary stays; briefing is optional */ })
          .finally(() => { if (requestRef.current === request) setSynthesisLoading(false); });
      })
      .catch((error) => { if (requestRef.current === request) setIntelError(errorText(error)); })
      .finally(() => { if (requestRef.current === request) setIntelLoading(false); });
  }, []);

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

  const matches = useMemo(() => (index ? searchCountries(index, query) : []), [index, query]);
  const toggleLayer = (dimension: Dimension) => setActiveLayers((current) => { const next = new Set(current); if (next.has(dimension)) next.delete(dimension); else next.add(dimension); return next; });
  const layerCounts = useMemo(() => { const counts = new Map<Dimension, number>(); for (const record of intel?.evidence ?? []) counts.set(record.dimension, (counts.get(record.dimension) ?? 0) + 1); return counts; }, [intel]);

  async function runLens() {
    const context = [workContext.trim(), ...ENVIRONMENT_KEYS.filter((key) => environment[key]).map((key) => ENVIRONMENT_LABELS[key])].filter(Boolean).join("; ");
    if (!view.iso2 || (!condition.trim() && !medication.trim() && !context)) return;
    setLensLoading(true); setLensError("");
    try {
      const response = await fetch("/api/aor/country-condition-lens", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ iso2: view.iso2, condition: condition.trim(), medication: medication.trim(), workContext: context }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
      setLens(payload as LensResponse);
    } catch (error) { setLens(null); setLensError(errorText(error)); }
    finally { setLensLoading(false); }
  }

  const lensBlock = view.iso2 ? (
    <details className="mt-3 border-t border-white/[.06] pt-3">
      <summary className="cursor-pointer text-[8px] font-black uppercase tracking-[.12em] text-slate-500">Medical condition × deployment context (transient, not stored)</summary>
      {ENVIRONMENT_KEYS.some((key) => environment[key]) ? <p className="mt-1.5 text-[9px] leading-4 text-slate-400">Environment factors included: {ENVIRONMENT_KEYS.filter((key) => environment[key]).map((key) => ENVIRONMENT_LABELS[key]).join(", ")}</p> : null}
      <div className="mt-2 space-y-1.5">
        {([["Condition", condition, setCondition], ["Medication", medication, setMedication], ["Work context", workContext, setWorkContext]] as const).map(([label, value, setter]) => (
          <input key={label} value={value} onChange={(event) => setter(event.target.value)} placeholder={label} className="min-h-8 w-full rounded-lg border border-white/[.08] bg-black/25 px-3 text-[10px] text-white outline-none placeholder:text-slate-600" />
        ))}
        <button type="button" onClick={() => void runLens()} disabled={lensLoading || (!condition.trim() && !medication.trim() && !workContext.trim() && !ENVIRONMENT_KEYS.some((key) => environment[key]))} className="min-h-8 w-full rounded-lg border border-cyan-100/15 bg-cyan-200/[.06] text-[10px] font-bold text-cyan-50/80 disabled:opacity-40">{lensLoading ? "Evaluating…" : "Evaluate considerations"}</button>
        {lensError ? <p className="text-[9px] text-amber-100/70">{lensError}</p> : null}
        {lens ? <div className="pt-1"><p className="text-[10px] font-bold text-white/85">{lens.classification}</p>{lens.considerations.map((item) => <div key={item.ruleId} className="mt-1.5 border-t border-white/[.05] pt-1.5 text-[9px] leading-4 text-slate-400"><b className="text-white/75">{item.classification}</b> — {item.summary}{item.evidenceText ? <p className="mt-0.5 text-slate-500">{item.evidenceText}</p> : null}</div>)}</div> : null}
      </div>
    </details>
  ) : null;

  const altitudeLimitMeters = useMemo(() => {
    if (!activeLayers.has("malaria")) return null;
    const record = intel?.evidence.find((item) => item.dimension === "malaria" && item.category === "malaria");
    const limit = ((record?.extra?.malaria ?? {}) as { altitudeLimitMeters?: number | null }).altitudeLimitMeters;
    return typeof limit === "number" && limit > 0 ? limit : null;
  }, [intel, activeLayers]);

  const globeReady = Boolean(config?.configured && config.token);
  const crumb = (label: string, onClick?: () => void, current = false) => <button type="button" onClick={onClick} disabled={!onClick || current} className={`rounded-full px-2 py-1 text-[10px] font-bold ${current ? "text-white" : "text-cyan-100/70 hover:text-white"}`}>{label}</button>;

  return (
    <main className="min-h-screen overflow-hidden bg-[#01050a] text-white" data-workspace="aor-factors-cesium">
      <Sidebar />
      <section className="fixed inset-y-0 left-0 right-0 overflow-hidden bg-[#01050a] lg:left-[210px]" aria-label="AOR Factors CesiumJS globe workspace">
        {globeReady ? (
          <AorCesiumGlobe
            token={config!.token}
            index={index}
            view={view}
            evidence={intel?.evidence ?? []}
            activeLayers={activeLayers}
            worldEvents={worldEvents}
            focusEvidence={focusEvidence}
            centerFallback={intel?.country.center ?? null}
            altitudeLimitMeters={altitudeLimitMeters}
            onPickCountry={goCountry}
            onPickEvidence={pickEvidence}
            onHoverCountry={setHoverName}
            onStatus={setStatus}
          />
        ) : null}

        {config && !config.configured ? (
          <div data-testid="aor-cesium-token-missing" className="absolute inset-0 z-20 grid place-items-center bg-[#01050a] px-6 text-center">
            <div className="max-w-md">
              <AlertTriangle className="mx-auto text-amber-300" size={22} />
              <h2 className="mt-3 text-sm font-bold">Cesium ion token is not configured</h2>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">AOR Factors runs on CesiumJS with Cesium ion terrain and imagery. Set <code className="rounded bg-white/10 px-1">{config.requiredEnv || "CESIUM_ION_ACCESS_TOKEN"}</code> on the API service and redeploy. The map engine is intentionally not replaced when the token is missing.</p>
            </div>
          </div>
        ) : null}

        {(!config || (globeReady && status.state === "loading")) ? <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-100/55" size={22} /><p className="mt-3 text-[10px] text-slate-400">Loading Cesium terrain and imagery…</p></div></div> : null}
        {status.state === "error" ? <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full border border-amber-300/25 bg-black/60 px-4 py-2 text-[10px] text-amber-100/80 backdrop-blur-xl"><AlertTriangle size={11} className="mr-1 inline" />{status.message || "Cesium reported an error."}</div> : null}
        {boundaryError ? <div className="absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full border border-amber-300/25 bg-black/60 px-4 py-2 text-[10px] text-amber-100/80 backdrop-blur-xl">Country boundaries failed to load: {boundaryError}</div> : null}

        {/* Restrained floating controls: scope breadcrumb, AOR chips, country search */}
        <div className="pointer-events-none absolute left-4 top-4 z-30 flex max-w-[calc(100%-2rem)] flex-col gap-2">
          <nav aria-label="Scope" className="pointer-events-auto flex w-fit items-center gap-0.5 rounded-full border border-white/[.09] bg-black/45 px-1.5 py-1 backdrop-blur-xl">
            <Globe2 size={12} className="ml-1.5 text-cyan-100/60" />
            {crumb("World", view.level === "world" ? undefined : goWorld, view.level === "world")}
            {selectedAor ? <><span className="text-slate-600">›</span>{crumb(selectedAor.label, view.level === "country" ? () => goAor(selectedAor.id) : undefined, view.level === "aor")}</> : null}
            {selectedEntry || view.iso2 ? <><span className="text-slate-600">›</span>{crumb(intel?.country.name || selectedEntry?.name || view.iso2 || "", undefined, true)}</> : null}
          </nav>
          <div className="pointer-events-auto flex max-w-full flex-wrap gap-1">
            {COMMANDS.map((command) => <button key={command.id} type="button" aria-pressed={view.aorId === command.id} onClick={() => goAor(command.id)} className={`rounded-full border px-2.5 py-1 text-[9px] font-bold backdrop-blur-xl transition ${view.aorId === command.id ? "border-white/25 bg-white/[.12] text-white" : "border-white/[.08] bg-black/40 text-slate-300 hover:text-white"}`}><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: command.color }} />{command.label.replace("US", "")}</button>)}
          </div>
          <div className="pointer-events-auto relative w-64">
            <div className="flex items-center gap-2 rounded-full border border-white/[.09] bg-black/45 px-3 backdrop-blur-xl"><Search size={12} className="text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a country" aria-label="Find a country" className="min-h-8 w-full bg-transparent text-[11px] text-white outline-none placeholder:text-slate-600" /></div>
            {matches.length ? <ul className="absolute left-0 right-0 top-9 overflow-hidden rounded-2xl border border-white/[.09] bg-[#050d14]/95 backdrop-blur-2xl">{matches.map((entry) => <li key={entry.iso2}><button type="button" onClick={() => { setQuery(""); goCountry(entry.iso2); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] text-white/85 hover:bg-white/[.06]"><span>{entry.name}</span><span className="text-[9px] text-slate-500">{COMMAND_BY_COUNTRY.get(entry.iso2)?.label.replace("US", "") ?? entry.iso2}</span></button></li>)}</ul> : null}
          </div>
        </div>

        {/* Compact layer selector */}
        <div className="absolute bottom-5 left-4 z-30">
          <button type="button" onClick={() => setLayersOpen((open) => !open)} aria-expanded={layersOpen} className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/[.09] bg-black/45 px-3 py-1.5 text-[10px] font-bold text-white/80 backdrop-blur-xl"><Layers size={12} />Layers · {activeLayers.size}/{DIMENSIONS.length}</button>
          {layersOpen ? <ul className="pointer-events-auto mt-2 w-56 overflow-hidden rounded-2xl border border-white/[.09] bg-[#050d14]/92 backdrop-blur-2xl" aria-label="Map layers">
            {DIMENSIONS.map((dimension) => <li key={dimension}><button type="button" aria-pressed={activeLayers.has(dimension)} onClick={() => toggleLayer(dimension)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-white/85 hover:bg-white/[.05]"><span className="h-2 w-2 rounded-full" style={{ background: activeLayers.has(dimension) ? DIMENSION_COLORS[dimension] : "transparent", border: `1px solid ${DIMENSION_COLORS[dimension]}` }} /><span className="flex-1">{DIMENSION_LABELS[dimension]}</span>{layerCounts.get(dimension) ? <span className="text-[9px] text-slate-500">{layerCounts.get(dimension)}</span> : null}</button></li>)}
            <li className="border-t border-white/[.06] px-3 py-2 text-[8px] leading-4 text-slate-500">Points use real source coordinates. Country shading appears only where a source covers the whole country. Text-only geography is listed in the panel, not drawn.</li>
          </ul> : null}
        </div>

        {hoverName && view.level !== "country" ? <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/[.09] bg-black/55 px-3 py-1 text-[10px] font-bold text-white/85 backdrop-blur-xl">{hoverName}</div> : null}
        {view.level === "world" && worldEvents.length && activeLayers.has("disasters") ? <div className="pointer-events-none absolute bottom-5 right-4 z-20 rounded-full border border-white/[.08] bg-black/40 px-3 py-1 text-[9px] text-slate-400 backdrop-blur-xl">{worldEvents.length} recent global events (USGS M5.5+ and GDACS) at source coordinates</div> : null}

        {panelOpen ? (
          <AorIntelPanel
            intel={intel}
            loading={intelLoading}
            error={intelError}
            countryName={intel?.country.name || selectedEntry?.name || view.iso2 || ""}
            aorLabel={selectedAor?.label ?? null}
            hasPolygon={Boolean(selectedEntry)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            highlightedId={highlightedId}
            onFocusEvidence={focusRecord}
            onSelectEvidence={selectEvidence}
            onClose={() => setPanelOpen(false)}
            lens={lensBlock}
            synthesis={synthesis}
            synthesisLoading={synthesisLoading}
            environment={environment}
            onToggleEnvironment={(key) => setEnvironment((current) => ({ ...current, [key]: !current[key] }))}
          />
        ) : null}
      </section>
    </main>
  );
}
