import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, BookOpen, History, Loader2, RadioTower, ShieldCheck, Stethoscope, Syringe } from "lucide-react";

type LayerMode = "current" | "notices" | "destination" | "frequency" | "lisa" | "yellowbook";
type HistoricalRow = { country?: string; iso2: string; outbreakCount: number | null; uniqueDiseases?: number; firstYear?: number; lastYear?: number; diseaseCounts?: Record<string, number>; topDiseases?: Array<{ disease: string; count: number }>; lisa?: "high-high" | "low-high" | "not-significant"; neighboringPressure?: string };
type HistoricalPayload = { ok: boolean; partial?: boolean; rows: HistoricalRow[]; diseases?: string[]; methodology?: { period?: string; globalMoransI?: number; pValue?: string; limitation?: string; lisa?: string }; error?: string };
type TrackerPayload = { ok: boolean; trackers: Array<{ disease: string; status?: string; location?: string; summary?: string; url?: string }>; error?: string };
type SourceLink = { label: string; url: string };
type TravelRecommendation = { name: string; recommendation: string; status?: string; diseaseLinks?: SourceLink[]; recommendationLinks?: SourceLink[]; clinicalGuidance?: SourceLink[] };
type TravelDisease = { name: string; transmission?: string; advice?: string; category?: string; diseaseLinks?: SourceLink[]; adviceLinks?: SourceLink[]; clinicalGuidance?: SourceLink[] };
type TravelHealthPayload = { ok: boolean; available?: boolean; country?: string; source?: string; sourceUrl?: string; sourceUpdated?: string | null; vaccines?: TravelRecommendation[]; malaria?: TravelRecommendation | null; yellowFever?: TravelRecommendation | null; diseases?: TravelDisease[]; notices?: string[]; clinicalGuidanceLinks?: SourceLink[]; sourceNotice?: string; limitation?: string };
type TravelNotice = { level: number; levelLabel: string; action: string; title: string; date?: string | null; summary?: string; url: string; countries: string[]; status?: "new" | "updated" | "active" };
type TravelNoticesPayload = { ok: boolean; source?: string; sourceUrl?: string; retrievedAt?: string; notices: TravelNotice[]; counts?: Record<string, number>; error?: string; limitation?: string };
type YellowBookProfile = { title: string; aliases: string[]; pages: [number, number]; sourceDate: string; agent: string; endemicity: string; atRisk: string; prevention: string; diagnosticSupport: string; transmission: string; clinical: string; diagnosis: string; treatment: string; keyNotes: string[]; operationalRules?: string[]; flags: Record<string, boolean> };
type YellowBookPayload = { ok: boolean; source?: { publication?: string; edition?: number; bookletPages?: number; diseaseChapters?: number; currentGuidanceBoundary?: string }; profiles: YellowBookProfile[]; error?: string };
type Props = { map: any; mapStatus: "loading" | "ready" | "error"; selectedCountry?: { name: string; iso2: string } | null; travelHealth?: any };

const HISTORY_FILL = "aor-epidemic-history-fill";
const HISTORY_LINE = "aor-epidemic-history-line";
const NOTICE_FILL = "aor-cdc-notice-fill";
const NOTICE_LINE = "aor-cdc-notice-line";
const FLAG_LABELS: Record<string, string> = { vaccinePreventable: "Vaccine", mosquitoBorne: "Mosquito", tickBorne: "Tick", foodWater: "Food / water", respiratory: "Respiratory", animalExposure: "Animal", freshwater: "Freshwater", sexualTransmission: "Sexual", notifiable: "Notifiable", postExposure: "PEP" };
const NOTICE_COLORS: Record<number, string> = { 4: "#ef4444", 3: "#f97316", 2: "#facc15", 1: "#38bdf8" };

async function loadJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}
function normalize(value: unknown) { return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function frequencyColor(count: number) { if (count >= 40) return "#ef4444"; if (count >= 30) return "#f97316"; if (count >= 20) return "#f59e0b"; if (count >= 10) return "#eab308"; if (count >= 5) return "#84cc16"; if (count > 0) return "#22c55e"; return "rgba(255,255,255,0)"; }
function matchExpression(rows: Array<{ iso2: string; color: string }>, fallback = "rgba(255,255,255,0)") { const expression: any[] = ["match", ["get", "iso_a2"]]; for (const row of rows) expression.push(row.iso2, row.color); expression.push(fallback); return expression; }
function noticeNameExpression(notices: TravelNotice[]) {
  const highest = new Map<string, { name: string; level: number }>();
  for (const notice of notices) for (const name of notice.countries || []) {
    const key = normalize(name);
    if (!key) continue;
    const previous = highest.get(key);
    if (!previous || notice.level > previous.level) highest.set(key, { name, level: notice.level });
  }
  const expression: any[] = ["match", ["coalesce", ["get", "name_en"], ["get", "name"], ""]];
  for (const row of highest.values()) expression.push(row.name, NOTICE_COLORS[row.level] || "#38bdf8");
  expression.push("rgba(255,255,255,0)");
  return { expression, count: highest.size };
}
function diseaseCount(row: HistoricalRow, disease: string) { return disease ? Number(row.diseaseCounts?.[disease] ?? 0) : Number(row.outbreakCount ?? 0); }
function destinationDiseaseNames(travelHealth: any) {
  const values: string[] = [];
  for (const item of travelHealth?.diseases || []) if (item?.name) values.push(String(item.name));
  for (const item of travelHealth?.vaccines || []) if (item?.name) values.push(String(item.name));
  if (travelHealth?.malaria) values.push(String(travelHealth.malaria.name || "Malaria"));
  if (travelHealth?.yellowFever) values.push(String(travelHealth.yellowFever.name || "Yellow Fever"));
  return [...new Set(values.map(normalize).filter(Boolean))];
}
function profileMatchesDestination(profile: YellowBookProfile, names: string[]) { const terms = [profile.title, ...(profile.aliases || [])].map(normalize).filter(Boolean); return names.some((name) => terms.some((term) => name === term || name.includes(term) || term.includes(name))); }
function InfoBlock({ label, children }: { label: string; children?: string }) { if (!children) return null; return <div className="rounded-xl border border-white/8 bg-white/[0.025] p-2.5"><p className="text-[8px] font-black uppercase tracking-[0.12em] text-cyan-100/34">{label}</p><p className="mt-1 text-[9px] leading-4 text-cyan-50/62">{children}</p></div>; }
function LinkChips({ links }: { links?: SourceLink[] }) { if (!links?.length) return null; return <div className="mt-1.5 flex flex-wrap gap-1">{links.slice(0, 5).map((link) => <a key={`${link.url}-${link.label}`} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-cyan-100/10 bg-cyan-300/[0.035] px-2 py-1 text-[7px] font-bold text-cyan-50/55 hover:border-cyan-100/25"><ArrowUpRight size={8} />{link.label}</a>)}</div>; }

export function AorEpidemicOverlay({ map, mapStatus, selectedCountry, travelHealth }: Props) {
  const [mode, setMode] = useState<LayerMode>("current");
  const [history, setHistory] = useState<HistoricalPayload | null>(null);
  const [tracker, setTracker] = useState<TrackerPayload | null>(null);
  const [notices, setNotices] = useState<TravelNoticesPayload | null>(null);
  const [yellowBook, setYellowBook] = useState<YellowBookPayload | null>(null);
  const [countryTravelHealth, setCountryTravelHealth] = useState<TravelHealthPayload | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [trackerError, setTrackerError] = useState("");
  const [noticesError, setNoticesError] = useState("");
  const [yellowBookError, setYellowBookError] = useState("");
  const [disease, setDisease] = useState("");
  const [yellowBookDisease, setYellowBookDisease] = useState("");

  useEffect(() => {
    let active = true;
    loadJson("/api/aor/epidemic-history").then((payload) => { if (active) setHistory(payload); }).catch((reason) => { if (active) setHistoryError(reason instanceof Error ? reason.message : "Historical epidemic source failed."); });
    loadJson("/api/aor/outbreak-tracker").then((payload) => { if (active) setTracker(payload); }).catch((reason) => { if (active) setTrackerError(reason instanceof Error ? reason.message : "Outbreak Tracker failed."); });
    loadJson("/api/aor/travel-notices").then((payload) => { if (active) setNotices(payload); }).catch((reason) => { if (active) setNoticesError(reason instanceof Error ? reason.message : "CDC Travel Health Notices failed."); });
    loadJson("/api/aor/yellow-book").then((payload) => { if (active) setYellowBook(payload); }).catch((reason) => { if (active) setYellowBookError(reason instanceof Error ? reason.message : "CDC Yellow Book catalog failed."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedCountry?.name) { setCountryTravelHealth(null); return; }
    let active = true;
    loadJson(`/api/aor/travel-health?country=${encodeURIComponent(selectedCountry.name)}`).then((payload) => { if (active) setCountryTravelHealth(payload); }).catch(() => { if (active) setCountryTravelHealth(null); });
    return () => { active = false; };
  }, [selectedCountry?.name]);

  const effectiveTravelHealth: TravelHealthPayload | null = countryTravelHealth || travelHealth || null;
  const selectedHistorical = useMemo(() => { const iso2 = selectedCountry?.iso2?.toUpperCase(); return iso2 ? history?.rows?.find((row) => row.iso2 === iso2) ?? null : null; }, [history?.rows, selectedCountry?.iso2]);
  const destinationNames = useMemo(() => destinationDiseaseNames(effectiveTravelHealth), [effectiveTravelHealth]);
  const relevantProfiles = useMemo(() => (yellowBook?.profiles || []).filter((profile) => profileMatchesDestination(profile, destinationNames)), [destinationNames, yellowBook?.profiles]);
  const selectedYellowBook = useMemo(() => { const profiles = yellowBook?.profiles || []; if (yellowBookDisease) return profiles.find((profile) => profile.title === yellowBookDisease) || null; return relevantProfiles[0] || profiles[0] || null; }, [relevantProfiles, yellowBook?.profiles, yellowBookDisease]);
  const selectedNotices = useMemo(() => {
    const country = normalize(selectedCountry?.name);
    if (!country) return notices?.notices || [];
    return (notices?.notices || []).filter((notice) => (notice.countries || []).some((name) => normalize(name) === country));
  }, [notices?.notices, selectedCountry?.name]);
  const noticeMap = useMemo(() => noticeNameExpression(notices?.notices || []), [notices?.notices]);

  useEffect(() => { setYellowBookDisease(""); }, [selectedCountry?.iso2]);
  useEffect(() => { if (mode === "yellowbook" && !yellowBookDisease && relevantProfiles.length) setYellowBookDisease(relevantProfiles[0].title); }, [mode, relevantProfiles, yellowBookDisease]);

  const colorRows = useMemo(() => {
    if (!history?.rows?.length) return [];
    if (mode === "lisa") return history.rows.flatMap((row) => row.lisa === "high-high" ? [{ iso2: row.iso2, color: "#f97316" }] : row.lisa === "low-high" ? [{ iso2: row.iso2, color: "#38bdf8" }] : []);
    if (mode === "frequency") return history.rows.map((row) => ({ iso2: row.iso2, color: frequencyColor(diseaseCount(row, disease)) }));
    return [];
  }, [disease, history?.rows, mode]);

  useEffect(() => {
    if (!map || mapStatus !== "ready" || !map.getSource?.("aor-countries")) return;
    const sourceLayer = "administrative";
    const firstSymbol = map.getStyle?.()?.layers?.find((layer: any) => layer.type === "symbol")?.id;
    if (!map.getLayer?.(HISTORY_FILL)) map.addLayer({ id: HISTORY_FILL, type: "fill", source: "aor-countries", "source-layer": sourceLayer, filter: ["==", "level", 0], paint: { "fill-color": "rgba(255,255,255,0)", "fill-opacity": 0 } }, firstSymbol || undefined);
    if (!map.getLayer?.(HISTORY_LINE)) map.addLayer({ id: HISTORY_LINE, type: "line", source: "aor-countries", "source-layer": sourceLayer, filter: ["==", "level", 0], paint: { "line-color": "rgba(255,255,255,0)", "line-width": 1.1, "line-opacity": 0 } }, firstSymbol || undefined);
    if (!map.getLayer?.(NOTICE_FILL)) map.addLayer({ id: NOTICE_FILL, type: "fill", source: "aor-countries", "source-layer": sourceLayer, filter: ["==", "level", 0], paint: { "fill-color": "rgba(255,255,255,0)", "fill-opacity": 0 } }, firstSymbol || undefined);
    if (!map.getLayer?.(NOTICE_LINE)) map.addLayer({ id: NOTICE_LINE, type: "line", source: "aor-countries", "source-layer": sourceLayer, filter: ["==", "level", 0], paint: { "line-color": "rgba(255,255,255,0)", "line-width": 1.5, "line-opacity": 0 } }, firstSymbol || undefined);
  }, [map, mapStatus]);

  useEffect(() => {
    if (!map || mapStatus !== "ready" || !map.getLayer?.(HISTORY_FILL)) return;
    const active = (mode === "frequency" || mode === "lisa") && colorRows.length > 0;
    const expression = matchExpression(colorRows);
    map.setPaintProperty?.(HISTORY_FILL, "fill-color", expression);
    map.setPaintProperty?.(HISTORY_FILL, "fill-opacity", active ? (mode === "lisa" ? 0.48 : 0.42) : 0);
    map.setPaintProperty?.(HISTORY_LINE, "line-color", expression);
    map.setPaintProperty?.(HISTORY_LINE, "line-opacity", active ? 0.82 : 0);
    map.setPaintProperty?.(HISTORY_LINE, "line-width", mode === "lisa" ? 1.7 : 1.05);
  }, [colorRows, map, mapStatus, mode]);

  useEffect(() => {
    if (!map || mapStatus !== "ready" || !map.getLayer?.(NOTICE_FILL)) return;
    const active = mode === "notices" && noticeMap.count > 0;
    map.setPaintProperty?.(NOTICE_FILL, "fill-color", noticeMap.expression);
    map.setPaintProperty?.(NOTICE_FILL, "fill-opacity", active ? 0.43 : 0);
    map.setPaintProperty?.(NOTICE_LINE, "line-color", noticeMap.expression);
    map.setPaintProperty?.(NOTICE_LINE, "line-opacity", active ? 0.9 : 0);
    map.setPaintProperty?.(NOTICE_LINE, "line-width", active ? 1.7 : 1.1);
  }, [map, mapStatus, mode, noticeMap]);

  const selectedDiseaseCount = selectedHistorical ? diseaseCount(selectedHistorical, disease) : 0;
  const currentTrackers = tracker?.trackers ?? [];
  const activeFlags = selectedYellowBook ? Object.entries(selectedYellowBook.flags || {}).filter(([, value]) => value) : [];
  const vaccineRows = effectiveTravelHealth?.vaccines || [];
  const nonVaccineRows = effectiveTravelHealth?.diseases || [];

  return <>
    <div className="absolute left-3 top-3 z-10 w-[min(94%,980px)] rounded-2xl border border-white/14 bg-[#020812]/88 p-3 shadow-[0_18px_50px_rgba(0,0,0,.38)] backdrop-blur-2xl" data-testid="aor-epidemic-layer-control">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-50/62"><Activity size={12} />Health intelligence</span>
        {([ ["current", "Current outbreaks", RadioTower], ["notices", "CDC Travel Notices", AlertTriangle], ["destination", "CDC Destination", ShieldCheck], ["frequency", "Historical frequency", History], ["lisa", "Epidemic hotspots / LISA", Activity], ["yellowbook", "CDC Yellow Book", BookOpen] ] as const).map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={mode === key} className={`inline-flex min-h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[9px] font-black transition ${mode === key ? "border-cyan-100/38 bg-cyan-300/[0.13] text-white" : "border-white/10 bg-white/[0.025] text-cyan-100/50 hover:border-white/20"}`}><Icon size={11} />{label}</button>)}
        {mode === "frequency" && history?.diseases?.length ? <select aria-label="Historical disease filter" value={disease} onChange={(event) => setDisease(event.target.value)} className="min-h-8 max-w-[220px] rounded-xl border border-white/12 bg-[#071421] px-2 text-[9px] font-bold text-cyan-50/72 outline-none"><option value="">All diseases</option>{history.diseases.map((name) => <option key={name} value={name}>{name}</option>)}</select> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[8px] leading-4 text-cyan-100/42">
        {mode === "current" ? <><span>OutbreakTracker awareness: {tracker ? `${currentTrackers.length} trackers` : trackerError ? "unavailable" : "loading…"}</span><span>Official WHO / hazard feeds remain authoritative.</span></> : mode === "notices" ? <><span>Live CDC Travel Health Notices</span><span>{notices ? `${notices.notices.length} active notices · ${noticeMap.count} named destinations` : noticesError ? "unavailable" : "loading…"}</span><span>Levels 1–4 shown on map where CDC names a destination.</span></> : mode === "destination" ? <><span>Live CDC Travelers' Health destination guidance</span><span>{selectedCountry ? selectedCountry.name : "Select a country"}</span><span>Vaccines · medicines · non-vaccine diseases · clinical guidance</span></> : mode === "frequency" ? <><span>WHO DON historical occurrence, 1996–Mar 2022</span><span>{disease ? `Disease: ${disease}` : "All 70 diseases"}</span><span>Occurrence ≠ severity.</span></> : mode === "lisa" ? <><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-orange-500" />High–High</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-sky-400" />Low–High</span><span>Published 99% LISA clusters · Moran's I 0.336, p&lt;0.001</span></> : <><span>CDC Yellow Book 2026 · {yellowBook?.source?.diseaseChapters || 22} infectious-disease chapters</span><span>{selectedCountry ? `${relevantProfiles.length} destination guidance matches for ${selectedCountry.name}` : "Select a country to cross-match live CDC destination guidance."}</span></>}
      </div>
    </div>

    {(mode !== "current" || selectedCountry || currentTrackers.length > 0) ? <div className={`absolute right-3 top-[102px] z-10 rounded-2xl border border-white/12 bg-[#020812]/90 p-3 shadow-[0_18px_50px_rgba(0,0,0,.34)] backdrop-blur-2xl ${(mode === "yellowbook" || mode === "destination" || mode === "notices") ? "max-h-[560px] w-[min(92%,430px)] overflow-y-auto" : "w-[min(88%,310px)]"}`}>
      {mode === "current" ? <>
        <div className="flex items-center justify-between gap-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-50/58">OutbreakTracker · current awareness</p>{!tracker && !trackerError ? <Loader2 size={12} className="animate-spin text-cyan-200/60" /> : null}</div>
        {trackerError ? <p className="mt-2 text-[9px] leading-4 text-amber-100/68"><AlertTriangle size={10} className="mr-1 inline" />{trackerError}</p> : <div className="mt-2 space-y-1.5">{currentTrackers.slice(0, 6).map((item) => <a key={item.url || item.disease} href={item.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/8 bg-white/[0.025] p-2 hover:border-cyan-100/20"><div className="flex items-start justify-between gap-2"><strong className="text-[9px] text-white/82">{item.disease}</strong><ArrowUpRight size={9} className="shrink-0 text-cyan-100/42" /></div><p className="mt-1 line-clamp-2 text-[8px] leading-3 text-cyan-100/38">{item.location || item.summary}</p></a>)}</div>}
        <p className="mt-2 text-[8px] leading-3 text-cyan-100/32">Awareness aggregator only. Consequential health decisions remain grounded in WHO, CDC and local public-health sources.</p>
      </> : mode === "notices" ? <>
        <div className="flex items-center justify-between gap-2"><p className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-50/58"><AlertTriangle size={12} />CDC Travel Health Notices</p>{!notices && !noticesError ? <Loader2 size={12} className="animate-spin text-cyan-200/60" /> : null}</div>
        <div className="mt-2 grid grid-cols-4 gap-1">{[4,3,2,1].map((level) => <div key={level} className="rounded-lg border border-white/8 p-1.5 text-center"><span className="mx-auto block h-2 w-2 rounded-full" style={{ background: NOTICE_COLORS[level] }} /><p className="mt-1 text-[7px] font-black text-white/55">L{level}</p><p className="text-[8px] text-cyan-100/42">{notices?.counts?.[String(level)] || 0}</p></div>)}</div>
        {noticesError ? <p className="mt-2 text-[9px] leading-4 text-amber-100/68">{noticesError}</p> : <div className="mt-2 space-y-2">{(selectedCountry ? selectedNotices : notices?.notices || []).slice(0, 18).map((notice) => <a key={notice.url} href={notice.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/9 bg-white/[0.025] p-2.5 hover:border-cyan-100/20"><div className="flex items-start justify-between gap-2"><div><p className="text-[7px] font-black uppercase tracking-[0.12em]" style={{ color: NOTICE_COLORS[notice.level] }}>Level {notice.level} · {notice.levelLabel}{notice.status && notice.status !== "active" ? ` · ${notice.status.toUpperCase()}` : ""}</p><p className="mt-1 text-[9px] font-bold text-white/78">{notice.title}</p></div><ArrowUpRight size={10} className="shrink-0 text-cyan-100/40" /></div>{notice.date ? <p className="mt-1 text-[7px] text-cyan-100/30">{notice.date}</p> : null}{notice.summary ? <p className="mt-1 text-[8px] leading-3.5 text-cyan-50/48">{notice.summary}</p> : null}{notice.countries?.length ? <p className="mt-1 text-[7px] leading-3 text-cyan-100/30">{notice.countries.slice(0, 12).join(" · ")}</p> : null}</a>)}</div>}
        {selectedCountry && !selectedNotices.length && notices ? <p className="mt-2 rounded-xl border border-emerald-200/10 bg-emerald-300/[0.025] p-2 text-[8px] leading-3.5 text-emerald-50/48">No active CDC Travel Health Notice was matched specifically to {selectedCountry.name}. This does not mean the destination is risk-free; review its destination guidance and other AOR feeds.</p> : null}
        <p className="mt-2 text-[8px] leading-3 text-cyan-100/30">CDC THNs can cover outbreaks, unusual disease events, disasters, infrastructure disruption and mass gatherings. Notice level is not a general country danger score.</p>
      </> : mode === "destination" ? <>
        <div className="flex items-center justify-between gap-2"><p className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-50/58"><ShieldCheck size={12} />CDC destination guidance</p>{selectedCountry && !effectiveTravelHealth ? <Loader2 size={12} className="animate-spin text-cyan-200/60" /> : null}</div>
        {!selectedCountry ? <p className="mt-2 text-[9px] leading-4 text-cyan-100/45">Select a country on the AOR map to load its live CDC vaccine, medicine, disease-prevention and clinician-guidance matrix.</p> : effectiveTravelHealth?.available === false ? <p className="mt-2 text-[9px] leading-4 text-amber-100/58">{effectiveTravelHealth.sourceNotice || "CDC destination guidance could not be structured for this destination."}</p> : effectiveTravelHealth ? <div className="mt-2 space-y-3">
          <div className="rounded-xl border border-cyan-100/12 bg-cyan-300/[0.035] p-2.5"><div className="flex items-start justify-between gap-2"><div><p className="text-[8px] uppercase tracking-[0.12em] text-cyan-100/35">Live CDC Travelers' Health</p><h3 className="mt-1 text-base font-black text-white">{selectedCountry.name}</h3>{effectiveTravelHealth.sourceUpdated ? <p className="mt-1 text-[8px] text-cyan-100/35">Source update: {effectiveTravelHealth.sourceUpdated}</p> : null}</div>{effectiveTravelHealth.sourceUrl ? <a href={effectiveTravelHealth.sourceUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 p-2 text-cyan-100/50 hover:text-white"><ArrowUpRight size={12} /></a> : null}</div></div>
          <section><p className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-100/50">Vaccines & medicines · {vaccineRows.length}</p><div className="mt-1.5 space-y-2">{[...(effectiveTravelHealth.malaria ? [effectiveTravelHealth.malaria] : []), ...vaccineRows].map((row) => <div key={`${row.name}-${row.recommendation}`} className="rounded-xl border border-white/8 bg-white/[0.025] p-2.5"><div className="flex items-start justify-between gap-2"><strong className="text-[9px] text-white/78">{row.name}</strong>{row.status ? <span className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase ${row.status === "recommended" ? "border-emerald-200/15 text-emerald-100/60" : row.status === "consider" ? "border-amber-200/15 text-amber-100/60" : "border-white/10 text-cyan-100/40"}`}>{row.status.replace(/-/g, " ")}</span> : null}</div><p className="mt-1 text-[8px] leading-3.5 text-cyan-50/52">{row.recommendation}</p><LinkChips links={[...(row.diseaseLinks || []), ...(row.recommendationLinks || []), ...(row.clinicalGuidance || [])]} /></div>)}</div></section>
          <section><p className="text-[8px] font-black uppercase tracking-[0.12em] text-amber-100/50">Non-vaccine-preventable diseases · {nonVaccineRows.length}</p><div className="mt-1.5 space-y-2">{nonVaccineRows.map((row) => <div key={row.name} className="rounded-xl border border-white/8 bg-white/[0.025] p-2.5"><div className="flex items-start justify-between gap-2"><strong className="text-[9px] text-white/78">{row.name}</strong>{row.category ? <span className="rounded-full border border-white/9 px-1.5 py-0.5 text-[7px] text-cyan-100/40">{row.category}</span> : null}</div>{row.transmission ? <p className="mt-1 text-[8px] leading-3.5 text-cyan-50/48"><b className="text-cyan-100/55">Spread:</b> {row.transmission}</p> : null}{row.advice ? <p className="mt-1 text-[8px] leading-3.5 text-cyan-50/48"><b className="text-cyan-100/55">Advice:</b> {row.advice}</p> : null}<LinkChips links={[...(row.diseaseLinks || []), ...(row.adviceLinks || []), ...(row.clinicalGuidance || [])]} /></div>)}</div></section>
          {effectiveTravelHealth.clinicalGuidanceLinks?.length ? <div className="rounded-xl border border-violet-100/10 bg-violet-300/[0.025] p-2.5"><p className="text-[8px] font-black uppercase tracking-[0.12em] text-violet-100/45">Clinical guidance library</p><LinkChips links={effectiveTravelHealth.clinicalGuidanceLinks} /></div> : null}
          <p className="border-t border-white/8 pt-2 text-[8px] leading-3.5 text-cyan-100/30">Recommendations vary by itinerary, duration, activities, age, pregnancy, immune status and medical history. Current entry requirements and clinician judgment remain controlling.</p>
        </div> : <p className="mt-2 text-[9px] text-cyan-100/42">Loading CDC destination guidance…</p>}
      </> : mode === "yellowbook" ? <>
        <div className="flex items-center justify-between gap-2"><p className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-50/58"><BookOpen size={12} />CDC Yellow Book reference</p>{!yellowBook && !yellowBookError ? <Loader2 size={12} className="animate-spin text-cyan-200/60" /> : null}</div>
        {yellowBookError ? <p className="mt-2 text-[9px] leading-4 text-amber-100/68"><AlertTriangle size={10} className="mr-1 inline" />{yellowBookError}</p> : yellowBook && selectedYellowBook ? <div className="mt-2 space-y-2.5">
          {selectedCountry && relevantProfiles.length ? <div className="rounded-xl border border-emerald-200/12 bg-emerald-300/[0.035] p-2"><p className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-100/55">CDC destination guidance matches · {selectedCountry.name}</p><div className="mt-1.5 flex flex-wrap gap-1">{relevantProfiles.slice(0, 8).map((profile) => <button key={profile.title} type="button" onClick={() => setYellowBookDisease(profile.title)} className={`rounded-full border px-2 py-1 text-[8px] font-bold ${selectedYellowBook.title === profile.title ? "border-emerald-100/35 bg-emerald-300/10 text-white" : "border-white/9 bg-white/[0.025] text-emerald-50/58"}`}>{profile.title}</button>)}</div></div> : null}
          <select aria-label="CDC Yellow Book disease" value={selectedYellowBook.title} onChange={(event) => setYellowBookDisease(event.target.value)} className="min-h-9 w-full rounded-xl border border-cyan-100/14 bg-[#071421] px-2.5 text-[9px] font-bold text-cyan-50/78 outline-none">{yellowBook.profiles.map((profile) => <option key={profile.title} value={profile.title}>{profile.title}</option>)}</select>
          <div className="rounded-xl border border-cyan-100/12 bg-cyan-300/[0.04] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[8px] uppercase tracking-[0.12em] text-cyan-100/35">Pages {selectedYellowBook.pages?.[0]}–{selectedYellowBook.pages?.[1]} · reviewed {selectedYellowBook.sourceDate}</p><h3 className="mt-1 text-base font-black text-white">{selectedYellowBook.title}</h3><p className="mt-1 text-[9px] text-cyan-100/45">{selectedYellowBook.agent}</p></div><Stethoscope size={16} className="shrink-0 text-cyan-100/48" /></div>{activeFlags.length ? <div className="mt-2 flex flex-wrap gap-1">{activeFlags.map(([key]) => <span key={key} className="rounded-full border border-cyan-100/10 bg-cyan-300/[0.035] px-2 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-cyan-50/55">{FLAG_LABELS[key] || key}</span>)}</div> : null}</div>
          <InfoBlock label="Endemicity">{selectedYellowBook.endemicity}</InfoBlock>
          <InfoBlock label="Higher-risk travelers / exposures">{selectedYellowBook.atRisk}</InfoBlock>
          <InfoBlock label="Transmission">{selectedYellowBook.transmission}</InfoBlock>
          <InfoBlock label="Prevention">{selectedYellowBook.prevention}</InfoBlock>
          <div className="grid gap-2 sm:grid-cols-2"><InfoBlock label="Clinical recognition">{selectedYellowBook.clinical}</InfoBlock><InfoBlock label="Diagnosis / testing">{selectedYellowBook.diagnosis}</InfoBlock></div>
          <InfoBlock label="Treatment / immediate management">{selectedYellowBook.treatment}</InfoBlock>
          {selectedYellowBook.diagnosticSupport ? <div className="rounded-xl border border-violet-100/10 bg-violet-300/[0.03] p-2.5"><p className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] text-violet-100/45"><ShieldCheck size={10} />Diagnostic support</p><p className="mt-1 text-[9px] leading-4 text-violet-50/60">{selectedYellowBook.diagnosticSupport}</p></div> : null}
          {(selectedYellowBook.operationalRules?.length || selectedYellowBook.keyNotes?.length) ? <div className="rounded-xl border border-amber-200/10 bg-amber-300/[0.025] p-2.5"><p className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] text-amber-100/48"><Syringe size={10} />Operational notes</p><div className="mt-1.5 space-y-1.5">{[...(selectedYellowBook.operationalRules || []), ...(selectedYellowBook.keyNotes || [])].slice(0, 5).map((note, index) => <p key={`${index}-${note.slice(0, 20)}`} className="text-[8px] leading-3.5 text-amber-50/58">• {note}</p>)}</div></div> : null}
          <p className="border-t border-white/8 pt-2 text-[8px] leading-3.5 text-cyan-100/30">A guidance match means the selected country’s current CDC destination page references that disease or vaccine; it does not by itself mean current transmission or elevated risk. Yellow Book content is durable reference context. Live country recommendations, notices, vaccine entry requirements and outbreak status remain tied to current CDC/WHO/local sources.</p>
        </div> : <p className="mt-2 text-[9px] text-cyan-100/42">Loading the 22-chapter CDC Yellow Book catalog…</p>}
      </> : <>
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-50/58">Historical epidemic exposure</p>
        {historyError ? <p className="mt-2 text-[9px] leading-4 text-amber-100/68">{historyError}</p> : !history ? <p className="mt-2 inline-flex items-center gap-2 text-[9px] text-cyan-100/45"><Loader2 size={11} className="animate-spin" />Loading WHO/Figshare history…</p> : selectedCountry && selectedHistorical ? <div className="mt-2 space-y-2"><div className="rounded-xl border border-white/9 bg-white/[0.025] p-2.5"><p className="text-[8px] uppercase tracking-[0.12em] text-cyan-100/36">{selectedCountry.name}</p><p className="mt-1 text-lg font-black">{mode === "frequency" ? selectedDiseaseCount : selectedHistorical.lisa === "high-high" ? "HIGH–HIGH" : selectedHistorical.lisa === "low-high" ? "LOW–HIGH" : "Not significant"}</p><p className="mt-1 text-[8px] leading-3 text-cyan-100/40">{mode === "frequency" ? `${disease || "All diseases"} · historical outbreak occurrences` : selectedHistorical.neighboringPressure}</p></div>{mode === "frequency" && selectedHistorical.topDiseases?.length ? <div><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-cyan-100/34">Most recurrent diseases</p><div className="mt-1 flex flex-wrap gap-1">{selectedHistorical.topDiseases.slice(0, 5).map((item) => <span key={item.disease} className="rounded-full border border-white/9 bg-white/[0.025] px-2 py-1 text-[8px] text-cyan-50/54">{item.disease} · {item.count}</span>)}</div></div> : null}</div> : <p className="mt-2 text-[9px] leading-4 text-cyan-100/42">Click a country to inspect its historical recurrence and published LISA context.</p>}
        {history?.partial || history?.error ? <p className="mt-2 text-[8px] leading-3 text-amber-100/52">{history.error || history.methodology?.limitation}</p> : null}
        <p className="mt-2 text-[8px] leading-3 text-cyan-100/30">Historical layer records disease-country-year occurrence, not cases, deaths or current intensity.</p>
      </>}
    </div> : null}
  </>;
}
