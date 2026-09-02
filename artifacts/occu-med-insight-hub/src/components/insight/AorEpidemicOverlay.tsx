import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, History, Loader2, RadioTower } from "lucide-react";

type LayerMode = "current" | "frequency" | "lisa";
type HistoricalRow = {
  country?: string;
  iso2: string;
  outbreakCount: number | null;
  uniqueDiseases?: number;
  firstYear?: number;
  lastYear?: number;
  diseaseCounts?: Record<string, number>;
  topDiseases?: Array<{ disease: string; count: number }>;
  lisa?: "high-high" | "low-high" | "not-significant";
  neighboringPressure?: string;
};
type HistoricalPayload = {
  ok: boolean;
  partial?: boolean;
  rows: HistoricalRow[];
  diseases?: string[];
  methodology?: { period?: string; globalMoransI?: number; pValue?: string; limitation?: string; lisa?: string };
  error?: string;
};
type TrackerPayload = {
  ok: boolean;
  trackers: Array<{ disease: string; status?: string; location?: string; summary?: string; url?: string }>;
  error?: string;
};

type Props = {
  map: any;
  mapStatus: "loading" | "ready" | "error";
  selectedCountry?: { name: string; iso2: string } | null;
};

const HISTORY_FILL = "aor-epidemic-history-fill";
const HISTORY_LINE = "aor-epidemic-history-line";

async function loadJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

function frequencyColor(count: number) {
  if (count >= 40) return "#ef4444";
  if (count >= 30) return "#f97316";
  if (count >= 20) return "#f59e0b";
  if (count >= 10) return "#eab308";
  if (count >= 5) return "#84cc16";
  if (count > 0) return "#22c55e";
  return "rgba(255,255,255,0)";
}

function matchExpression(rows: Array<{ iso2: string; color: string }>, fallback = "rgba(255,255,255,0)") {
  const expression: any[] = ["match", ["get", "iso_a2"]];
  for (const row of rows) expression.push(row.iso2, row.color);
  expression.push(fallback);
  return expression;
}

function diseaseCount(row: HistoricalRow, disease: string) {
  if (!disease) return Number(row.outbreakCount ?? 0);
  return Number(row.diseaseCounts?.[disease] ?? 0);
}

export function AorEpidemicOverlay({ map, mapStatus, selectedCountry }: Props) {
  const [mode, setMode] = useState<LayerMode>("current");
  const [history, setHistory] = useState<HistoricalPayload | null>(null);
  const [tracker, setTracker] = useState<TrackerPayload | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [trackerError, setTrackerError] = useState("");
  const [disease, setDisease] = useState("");

  useEffect(() => {
    let active = true;
    loadJson("/api/aor/epidemic-history")
      .then((payload) => { if (active) setHistory(payload); })
      .catch((reason) => { if (active) setHistoryError(reason instanceof Error ? reason.message : "Historical epidemic source failed."); });
    loadJson("/api/aor/outbreak-tracker")
      .then((payload) => { if (active) setTracker(payload); })
      .catch((reason) => { if (active) setTrackerError(reason instanceof Error ? reason.message : "Outbreak Tracker failed."); });
    return () => { active = false; };
  }, []);

  const selectedHistorical = useMemo(() => {
    const iso2 = selectedCountry?.iso2?.toUpperCase();
    return iso2 ? history?.rows?.find((row) => row.iso2 === iso2) ?? null : null;
  }, [history?.rows, selectedCountry?.iso2]);

  const colorRows = useMemo(() => {
    if (!history?.rows?.length) return [];
    if (mode === "lisa") return history.rows.flatMap((row) => {
      if (row.lisa === "high-high") return [{ iso2: row.iso2, color: "#f97316" }];
      if (row.lisa === "low-high") return [{ iso2: row.iso2, color: "#38bdf8" }];
      return [];
    });
    if (mode === "frequency") return history.rows.map((row) => ({ iso2: row.iso2, color: frequencyColor(diseaseCount(row, disease)) }));
    return [];
  }, [disease, history?.rows, mode]);

  useEffect(() => {
    if (!map || mapStatus !== "ready" || !map.getSource?.("aor-countries")) return;
    const sourceLayer = "administrative";
    const firstSymbol = map.getStyle?.()?.layers?.find((layer: any) => layer.type === "symbol")?.id;
    if (!map.getLayer?.(HISTORY_FILL)) {
      map.addLayer({
        id: HISTORY_FILL,
        type: "fill",
        source: "aor-countries",
        "source-layer": sourceLayer,
        filter: ["==", "level", 0],
        paint: { "fill-color": "rgba(255,255,255,0)", "fill-opacity": 0 },
      }, firstSymbol || undefined);
    }
    if (!map.getLayer?.(HISTORY_LINE)) {
      map.addLayer({
        id: HISTORY_LINE,
        type: "line",
        source: "aor-countries",
        "source-layer": sourceLayer,
        filter: ["==", "level", 0],
        paint: { "line-color": "rgba(255,255,255,0)", "line-width": 1.1, "line-opacity": 0 },
      }, firstSymbol || undefined);
    }
  }, [map, mapStatus]);

  useEffect(() => {
    if (!map || mapStatus !== "ready" || !map.getLayer?.(HISTORY_FILL)) return;
    const active = mode !== "current" && colorRows.length > 0;
    const expression = matchExpression(colorRows);
    map.setPaintProperty?.(HISTORY_FILL, "fill-color", expression);
    map.setPaintProperty?.(HISTORY_FILL, "fill-opacity", active ? (mode === "lisa" ? 0.48 : 0.42) : 0);
    map.setPaintProperty?.(HISTORY_LINE, "line-color", expression);
    map.setPaintProperty?.(HISTORY_LINE, "line-opacity", active ? 0.82 : 0);
    map.setPaintProperty?.(HISTORY_LINE, "line-width", mode === "lisa" ? 1.7 : 1.05);
  }, [colorRows, map, mapStatus, mode]);

  const selectedDiseaseCount = selectedHistorical ? diseaseCount(selectedHistorical, disease) : 0;
  const currentTrackers = tracker?.trackers ?? [];

  return <>
    <div className="absolute left-3 top-3 z-10 w-[min(94%,720px)] rounded-2xl border border-white/14 bg-[#020812]/88 p-3 shadow-[0_18px_50px_rgba(0,0,0,.38)] backdrop-blur-2xl" data-testid="aor-epidemic-layer-control">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-50/62"><Activity size={12} />Health intelligence</span>
        {([
          ["current", "Current outbreaks", RadioTower],
          ["frequency", "Historical frequency", History],
          ["lisa", "Epidemic hotspots / LISA", Activity],
        ] as const).map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={mode === key} className={`inline-flex min-h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[9px] font-black transition ${mode === key ? "border-cyan-100/38 bg-cyan-300/[0.13] text-white" : "border-white/10 bg-white/[0.025] text-cyan-100/50 hover:border-white/20"}`}><Icon size={11} />{label}</button>)}
        {mode === "frequency" && history?.diseases?.length ? <select aria-label="Historical disease filter" value={disease} onChange={(event) => setDisease(event.target.value)} className="min-h-8 max-w-[220px] rounded-xl border border-white/12 bg-[#071421] px-2 text-[9px] font-bold text-cyan-50/72 outline-none"><option value="">All diseases</option>{history.diseases.map((name) => <option key={name} value={name}>{name}</option>)}</select> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[8px] leading-4 text-cyan-100/42">
        {mode === "current" ? <><span>OutbreakTracker awareness feed: {tracker ? `${currentTrackers.length} trackers` : trackerError ? "unavailable" : "loading…"}</span><span>Map points remain tied to existing official WHO / hazard feeds.</span></> : mode === "frequency" ? <><span>WHO DON historical occurrence, 1996–Mar 2022</span><span>{disease ? `Disease: ${disease}` : "All 70 diseases"}</span><span>Occurrence ≠ severity.</span></> : <><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-orange-500" />High–High</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-sky-400" />Low–High</span><span>Published 99% LISA clusters · Moran's I 0.336, p&lt;0.001</span></>}
      </div>
    </div>

    {(mode !== "current" || selectedCountry || currentTrackers.length > 0) ? <div className="absolute right-3 top-[102px] z-10 w-[min(88%,310px)] rounded-2xl border border-white/12 bg-[#020812]/86 p-3 shadow-[0_18px_50px_rgba(0,0,0,.34)] backdrop-blur-2xl">
      {mode === "current" ? <>
        <div className="flex items-center justify-between gap-2"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-50/58">OutbreakTracker · current awareness</p>{!tracker && !trackerError ? <Loader2 size={12} className="animate-spin text-cyan-200/60" /> : null}</div>
        {trackerError ? <p className="mt-2 text-[9px] leading-4 text-amber-100/68"><AlertTriangle size={10} className="mr-1 inline" />{trackerError}</p> : <div className="mt-2 space-y-1.5">{currentTrackers.slice(0, 4).map((item) => <a key={item.url || item.disease} href={item.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-white/8 bg-white/[0.025] p-2 hover:border-cyan-100/20"><div className="flex items-start justify-between gap-2"><strong className="text-[9px] text-white/82">{item.disease}</strong><ArrowUpRight size={9} className="shrink-0 text-cyan-100/42" /></div><p className="mt-1 line-clamp-2 text-[8px] leading-3 text-cyan-100/38">{item.location || item.summary}</p></a>)}</div>}
        <p className="mt-2 text-[8px] leading-3 text-cyan-100/32">Awareness aggregator only. Consequential health decisions remain grounded in WHO, CDC and local public-health sources.</p>
      </> : <>
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-50/58">Historical epidemic exposure</p>
        {historyError ? <p className="mt-2 text-[9px] leading-4 text-amber-100/68">{historyError}</p> : !history ? <p className="mt-2 inline-flex items-center gap-2 text-[9px] text-cyan-100/45"><Loader2 size={11} className="animate-spin" />Loading WHO/Figshare history…</p> : selectedCountry && selectedHistorical ? <div className="mt-2 space-y-2"><div className="rounded-xl border border-white/9 bg-white/[0.025] p-2.5"><p className="text-[8px] uppercase tracking-[0.12em] text-cyan-100/36">{selectedCountry.name}</p><p className="mt-1 text-lg font-black">{mode === "frequency" ? selectedDiseaseCount : selectedHistorical.lisa === "high-high" ? "HIGH–HIGH" : selectedHistorical.lisa === "low-high" ? "LOW–HIGH" : "Not significant"}</p><p className="mt-1 text-[8px] leading-3 text-cyan-100/40">{mode === "frequency" ? `${disease || "All diseases"} · historical outbreak occurrences` : selectedHistorical.neighboringPressure}</p></div>{mode === "frequency" && selectedHistorical.topDiseases?.length ? <div><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-cyan-100/34">Most recurrent diseases</p><div className="mt-1 flex flex-wrap gap-1">{selectedHistorical.topDiseases.slice(0, 5).map((item) => <span key={item.disease} className="rounded-full border border-white/9 bg-white/[0.025] px-2 py-1 text-[8px] text-cyan-50/54">{item.disease} · {item.count}</span>)}</div></div> : null}</div> : <p className="mt-2 text-[9px] leading-4 text-cyan-100/42">Click a country to inspect its historical recurrence and published LISA context.</p>}
        {history?.partial || history?.error ? <p className="mt-2 text-[8px] leading-3 text-amber-100/52">{history.error || history.methodology?.limitation}</p> : null}
        <p className="mt-2 text-[8px] leading-3 text-cyan-100/30">Historical layer records disease-country-year occurrence, not cases, deaths or current intensity.</p>
      </>}
    </div> : null}
  </>;
}
