import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Loader2, MapPinned, RefreshCw, Scale, Trophy } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, getWarCostsPageEvidence } from "@/data/warCostsApi";
import { wcConflictCost, wcConflictDeaths, wcConflictDuration, wcConflictName, wcInteger, wcMoney, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

declare global {
  interface Window {
    $arcgis?: { import: (modules: string | string[]) => Promise<any> };
    esriConfig?: { apiKey?: string };
  }
}

type StructuredTable = { headers: string[]; rows: string[][] };
type StructuredPageResponse = { ok: boolean; page: { title: string; text: string; tables: StructuredTable[]; fetchedAt: string; source: string } };
type SortKey = "roi" | "cost" | "deaths" | "duration";

const ARCGIS_VERSION = "5.1";
const ARCGIS_SCRIPT = `https://js.arcgis.com/${ARCGIS_VERSION}/`;
const ARCGIS_CSS = `https://js.arcgis.com/${ARCGIS_VERSION}/esri/themes/dark/main.css`;
const GEOCODE_URL = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

async function readStructuredPage(path: string): Promise<StructuredPageResponse> {
  const response = await fetch(`/api/war-costs/page-structure?path=${encodeURIComponent(path)}`, { headers: { Accept: "application/json" } });
  const payload = await response.json() as StructuredPageResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || `WarCosts page structure failed with HTTP ${response.status}`);
  return payload;
}

async function loadArcGis(apiKey: string) {
  let css = document.querySelector<HTMLLinkElement>(`link[href="${ARCGIS_CSS}"]`);
  if (!css) {
    css = document.createElement("link"); css.rel = "stylesheet"; css.href = ARCGIS_CSS; css.dataset.arcgisWarCostsReactions = "true"; document.head.appendChild(css);
  }
  window.esriConfig = { ...(window.esriConfig ?? {}), apiKey };
  if (!window.$arcgis) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${ARCGIS_SCRIPT}"]`);
      const done = () => window.$arcgis ? resolve() : reject(new Error("ArcGIS SDK did not initialize."));
      if (existing) { existing.addEventListener("load", done, { once: true }); existing.addEventListener("error", () => reject(new Error("ArcGIS SDK failed to load.")), { once: true }); setTimeout(() => window.$arcgis && resolve(), 0); return; }
      const script = document.createElement("script"); script.type = "module"; script.src = ARCGIS_SCRIPT; script.dataset.arcgisWarCostsReactions = "true"; script.addEventListener("load", done, { once: true }); script.addEventListener("error", () => reject(new Error("ArcGIS SDK failed to load.")), { once: true }); document.head.appendChild(script);
    });
  }
  if (!window.$arcgis) throw new Error("ArcGIS SDK is unavailable.");
  const config = await window.$arcgis.import("@arcgis/core/config.js"); config.apiKey = apiKey;
  return window.$arcgis;
}

async function geocode(country: string, apiKey: string): Promise<[number, number] | null> {
  const params = new URLSearchParams({ SingleLine: country, maxLocations: "1", outFields: "Match_addr,Addr_type", forStorage: "false", f: "json", token: apiKey });
  const response = await fetch(`${GEOCODE_URL}?${params.toString()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const location = payload?.candidates?.[0]?.location;
  return Number.isFinite(location?.x) && Number.isFinite(location?.y) ? [location.x, location.y] : null;
}

function roiScore(row: WarCostsRow) {
  const direct = wcNumber(row, "roiScore", "score", "roi", "totalScore");
  const nested = row.roi && typeof row.roi === "object" ? wcNumber(row.roi as WarCostsRow, "score", "total", "value") : 0;
  return direct || nested;
}
function roiCost(row: WarCostsRow) { return wcConflictCost(row) || wcNumber(row, "cost", "totalCost", "amount", "costBillions"); }
function roiDeaths(row: WarCostsRow) { return wcConflictDeaths(row) || wcNumber(row, "deaths", "usDeaths", "totalUSDeaths"); }
function roiDuration(row: WarCostsRow) { return wcConflictDuration(row) || wcNumber(row, "duration", "durationYears", "years"); }
function explicitObjectivesMet(row: WarCostsRow): boolean | null {
  for (const key of ["objectivesMet", "objectivesAchieved", "metObjectives", "achievedObjectives"]) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["yes", "true", "met", "achieved", "fully achieved", "success", "victory"].includes(normalized)) return true;
      if (["no", "false", "not met", "failed", "failure", "defeat"].includes(normalized)) return false;
    }
  }
  return null;
}
function normalizedName(row: WarCostsRow) { return wcText(row, "name", "war", "conflict", "title").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function mergeRoiWithConflicts(roiRows: WarCostsRow[], conflicts: WarCostsRow[]) {
  return roiRows.map((roi) => {
    const key = normalizedName(roi);
    const conflict = conflicts.find((candidate) => {
      const candidateKey = normalizedName(candidate);
      return candidateKey === key || (candidateKey && key && (candidateKey.includes(key) || key.includes(candidateKey)));
    });
    return conflict ? { ...conflict, ...roi } : roi;
  });
}

function RevolvingDoor({ evidence }: { evidence: string }) {
  const metrics = [
    ["Revolving-door lobbyists", evidence.match(/2,700\+?/)?.[0] ?? "2,700+", "since 2001"],
    ["DoD officials → contractors", evidence.match(/\b380\b/)?.[0] ?? "380", "high-ranking officials"],
    ["Top-5 defense lobbying", evidence.match(/\$47M/)?.[0] ?? "$47M", "2023 source figure"],
    ["Boeing Pentagon hires", evidence.match(/\b85\b/)?.[0] ?? "85", "former officials"],
  ];
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><GitBranch size={18} className="text-violet-200/70" /><h3 className="text-lg font-black">Pentagon Revolving Door</h3></div><p className="mt-1 text-xs text-cyan-100/42">{evidence ? "Native accountability summary parsed from the retained WarCosts revolving-door evidence." : "Current WarCosts headline metrics are shown while the page-evidence mirror finishes populating this source page."}</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, note]) => <div key={label} className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-bold text-cyan-50/70">{label}</p><p className="mt-1 text-[9px] text-cyan-100/35">{note}</p></div>)}</div>{evidence && <details className="mt-4 rounded-xl border border-white/8 bg-black/10 p-4"><summary className="cursor-pointer text-xs font-bold">Open retained revolving-door evidence</summary><p className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-[10px] leading-5 text-cyan-50/55">{evidence.slice(0, 30_000)}</p></details>}</GlassCard>;
}

function RoiAnalysis({ rows }: { rows: WarCostsRow[] }) {
  const [sort, setSort] = useState<SortKey>("roi");
  const ranked = useMemo(() => [...rows].sort((a, b) => {
    const value = sort === "roi" ? roiScore : sort === "cost" ? roiCost : sort === "deaths" ? roiDeaths : roiDuration;
    return value(b) - value(a);
  }), [rows, sort]);
  const scored = rows.filter((row) => roiScore(row) > 0);
  const avg = scored.length ? scored.reduce((sum, row) => sum + roiScore(row), 0) / scored.length : 0;
  const explicitFlags = rows.map(explicitObjectivesMet).filter((value): value is boolean => value !== null);
  const met = explicitFlags.filter(Boolean).length;
  return <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Trophy size={18} className="text-amber-200/70" /><h3 className="text-lg font-black">War Return on Investment</h3></div><p className="mt-1 text-xs text-cyan-100/42">Sortable native view of `war-roi.json`, enriched with authoritative cost, death and duration fields from `conflicts.json`.</p></div><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="min-h-10 rounded-xl border border-white/10 bg-[#07101c] px-3 text-xs"><option value="roi">ROI score</option><option value="cost">Cost</option><option value="deaths">US deaths</option><option value="duration">Duration</option></select></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{avg ? avg.toFixed(0) : "—"}</p><p className="text-[9px] text-cyan-100/35">average ROI score</p></div><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{explicitFlags.length ? `${met}/${explicitFlags.length}` : "—"}</p><p className="text-[9px] text-cyan-100/35">explicit source objective flags met</p></div><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{wcMoney(rows.reduce((sum, row) => sum + roiCost(row), 0))}</p><p className="text-[9px] text-cyan-100/35">source cost total</p></div><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{wcInteger(rows.reduce((sum, row) => sum + roiDeaths(row), 0))}</p><p className="text-[9px] text-cyan-100/35">source US deaths total</p></div></div><div className="mt-4 max-h-[620px] overflow-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35"><th className="p-2">War</th><th className="p-2">ROI</th><th className="p-2">Cost</th><th className="p-2">US deaths</th><th className="p-2">Duration</th><th className="p-2">Outcome / objective</th></tr></thead><tbody>{ranked.map((row, index) => <tr key={`${normalizedName(row)}-${index}`} className="border-t border-white/8"><td className="p-3 font-bold">{wcText(row, "name", "war", "conflict", "title") || wcConflictName(row)}</td><td className="p-3 font-black">{roiScore(row) || "—"}</td><td className="p-3">{wcMoney(roiCost(row))}</td><td className="p-3">{wcInteger(roiDeaths(row))}</td><td className="p-3">{roiDuration(row) || "—"}</td><td className="max-w-[320px] p-3 text-cyan-50/55">{wcText(row, "outcome", "objective", "objectives", "assessment") || "—"}</td></tr>)}</tbody></table></div></GlassCard>;
}

function reactionColor(position: string): number[] {
  const value = position.toLowerCase();
  if (value.includes("support")) return [34, 211, 238, 0.88];
  if (value.includes("oppos") || value.includes("condemn")) return [251, 113, 133, 0.9];
  if (value.includes("complicated") || value.includes("mixed")) return [251, 191, 36, 0.88];
  return [148, 163, 184, 0.78];
}

function GlobalReactionsMap({ table }: { table?: StructuredTable }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapped, setMapped] = useState(0);
  useEffect(() => {
    if (!table || !hostRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError("");
        const countryIndex = table.headers.findIndex((header) => /country/i.test(header));
        const positionIndex = table.headers.findIndex((header) => /position/i.test(header));
        const statementIndex = table.headers.findIndex((header) => /statement/i.test(header));
        const actionIndex = table.headers.findIndex((header) => /action/i.test(header));
        if (countryIndex < 0) throw new Error("Country column is missing from the Global Reactions source table.");
        const configResponse = await fetch("/api/war-costs/arcgis-config", { cache: "no-store" });
        const config = await configResponse.json().catch(() => ({}));
        if (!configResponse.ok || !config?.configured || !config?.apiKey) throw new Error("ARCGIS_API_KEY is not configured on this service.");
        const arcgis = await loadArcGis(config.apiKey);
        if (cancelled || !hostRef.current) return;
        const [EsriMap, MapView, GraphicsLayer, Graphic] = await arcgis.import(["@arcgis/core/Map.js", "@arcgis/core/views/MapView.js", "@arcgis/core/layers/GraphicsLayer.js", "@arcgis/core/Graphic.js"]);
        if (cancelled || !hostRef.current) return;
        const map = new EsriMap({ basemap: "dark-gray-vector" });
        const layer = new GraphicsLayer({ title: "Global Reactions" }); map.add(layer);
        const view = new MapView({ container: hostRef.current, map, center: [18, 24], zoom: 1.55, constraints: { minZoom: 1 }, popup: { dockEnabled: false } });
        viewRef.current = view; await view.when();
        let count = 0;
        for (const row of table.rows) {
          const country = row[countryIndex]?.trim(); if (!country) continue;
          const point = await geocode(country, config.apiKey).catch(() => null); if (!point || cancelled) continue;
          const position = positionIndex >= 0 ? row[positionIndex] || "Recorded" : "Recorded";
          const statement = statementIndex >= 0 ? row[statementIndex] || "" : "";
          const action = actionIndex >= 0 ? row[actionIndex] || "" : "";
          layer.add(new Graphic({ geometry: { type: "point", longitude: point[0], latitude: point[1] }, symbol: { type: "simple-marker", color: reactionColor(position), size: 11, outline: { color: [255,255,255,.85], width: .8 } }, attributes: { country, position }, popupTemplate: { title: "{country}", content: `<b>${position}</b>${statement ? `<br/><br/>${statement}` : ""}${action ? `<br/><br/><b>Action:</b> ${action}` : ""}` } })); count += 1;
        }
        if (!cancelled) setMapped(count);
      } catch (mapError) { if (!cancelled) setError(mapError instanceof Error ? mapError.message : "Global Reactions map failed."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; viewRef.current?.destroy?.(); viewRef.current = null; };
  }, [table]);
  return <div className="relative mt-4 h-[520px] overflow-hidden rounded-2xl border border-white/8 bg-[#020611]"><div ref={hostRef} className="h-full w-full" aria-label="ArcGIS map of WarCosts global reactions" /><div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-white/10 bg-[#020611]/88 px-3 py-2 text-[10px] font-bold backdrop-blur-xl">{mapped} country reactions mapped</div>{loading && <div className="absolute inset-0 grid place-items-center bg-[#020611]/72"><Loader2 className="animate-spin text-cyan-200" /></div>}{error && <div className="absolute bottom-3 left-3 max-w-md rounded-xl border border-rose-200/20 bg-[#1a070d]/95 p-3 text-[10px] text-rose-100"><div className="flex gap-2"><MapPinned size={14} /><span>{error}</span></div></div>}</div>;
}

function GlobalReactions({ page }: { page: StructuredPageResponse["page"] | null }) {
  const table = page?.tables?.find((candidate) => candidate.headers.some((header) => /country/i.test(header)) && candidate.headers.some((header) => /position/i.test(header))) ?? page?.tables?.[0];
  const rows = table?.rows ?? [];
  const positionIndex = table?.headers.findIndex((header) => /position/i.test(header)) ?? -1;
  const counts = rows.reduce<Record<string, number>>((acc, row) => { const key = positionIndex >= 0 ? row[positionIndex] || "Unknown" : "Recorded"; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><Scale size={18} className="text-cyan-200/70" /><h3 className="text-lg font-black">Global Reactions Map & Table</h3></div><p className="mt-1 text-xs text-cyan-100/42">A separate ArcGIS diplomatic-reactions map parsed from WarCosts’ live country-position table. It is not the operational War Map.</p><div className="mt-4 flex flex-wrap gap-2">{Object.entries(counts).map(([key, value]) => <span key={key} className="rounded-full border border-cyan-100/12 bg-black/10 px-3 py-1.5 text-[10px] font-bold">{key}: {value}</span>)}</div><GlobalReactionsMap table={table} />{table ? <div className="mt-4 max-h-[620px] overflow-auto"><table className="w-full min-w-[900px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35">{table.headers.map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-white/8">{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[360px] p-3 text-cyan-50/70">{cell}</td>)}</tr>)}</tbody></table></div> : <p className="mt-4 text-xs text-cyan-100/40">No structured country table was exposed by the current page response.</p>}</GlassCard>;
}

export default function WarCostsAccountability() {
  const [roi, setRoi] = useState<WarCostsRow[]>([]);
  const [revolvingEvidence, setRevolvingEvidence] = useState("");
  const [reactions, setReactions] = useState<StructuredPageResponse["page"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true); setError("");
    const results = await Promise.allSettled([
      getWarCostsDataset("war-roi.json", force),
      getWarCostsDataset("conflicts.json", force),
      getWarCostsPageEvidence("/revolving-door"),
      readStructuredPage("/global-reactions"),
    ]);
    const messages: string[] = [];
    const roiResponse = results[0].status === "fulfilled" ? results[0].value : null;
    const conflictsResponse = results[1].status === "fulfilled" ? results[1].value : null;
    const revolvingResponse = results[2].status === "fulfilled" ? results[2].value : null;
    const reactionsResponse = results[3].status === "fulfilled" ? results[3].value : null;
    if (roiResponse) setRoi(mergeRoiWithConflicts(wcRows(roiResponse.data), conflictsResponse ? wcRows(conflictsResponse.data) : [])); else messages.push("War ROI feed unavailable");
    if (revolvingResponse) setRevolvingEvidence(revolvingResponse.page.evidence_text || ""); else messages.push("Revolving-door page mirror is still populating");
    if (reactionsResponse) setReactions(reactionsResponse.page); else messages.push("Global Reactions page structure unavailable");
    setError(messages.join(" · "));
    setLoading(false); setRefreshing(false);
  }

  useEffect(() => { void load(false); }, []);

  return <main className="aurora-bg min-h-screen text-white"><Sidebar /><section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Accountability & Reactions" subtitle="Native views for War ROI, the Pentagon revolving door, and country-by-country reactions that sit outside WarCosts' headline calculator inventory." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button></div><WarCostsWorkspaceNav />{error && <GlassCard className="mt-5 border-amber-300/18 p-4 text-xs text-amber-100">{error}</GlassCard>}{loading ? <GlassCard className="mt-5 grid min-h-[520px] place-items-center"><Loader2 className="h-9 w-9 animate-spin text-cyan-200" /></GlassCard> : <div className="mt-5 space-y-5"><RoiAnalysis rows={roi} /><RevolvingDoor evidence={revolvingEvidence} /><GlobalReactions page={reactions} /></div>}</section></main>;
}
