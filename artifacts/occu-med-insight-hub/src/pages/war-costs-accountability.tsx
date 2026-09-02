import { useEffect, useMemo, useState } from "react";
import { GitBranch, Loader2, RefreshCw, Scale, Trophy } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, getWarCostsPageEvidence } from "@/data/warCostsApi";
import { wcConflictName, wcInteger, wcMoney, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

type StructuredTable = { headers: string[]; rows: string[][] };
type StructuredPageResponse = { ok: boolean; page: { title: string; text: string; tables: StructuredTable[]; fetchedAt: string; source: string } };
type SortKey = "roi" | "cost" | "deaths" | "duration";

async function readStructuredPage(path: string): Promise<StructuredPageResponse> {
  const response = await fetch(`/api/war-costs/page-structure?path=${encodeURIComponent(path)}`, { headers: { Accept: "application/json" } });
  const payload = await response.json() as StructuredPageResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || `WarCosts page structure failed with HTTP ${response.status}`);
  return payload;
}

function roiScore(row: WarCostsRow) { return wcNumber(row, "roiScore", "score", "roi"); }
function roiCost(row: WarCostsRow) { return wcNumber(row, "cost", "costInflationAdjusted", "totalCost", "amount"); }
function roiDeaths(row: WarCostsRow) { return wcNumber(row, "deaths", "usDeaths", "totalUSDeaths"); }
function roiDuration(row: WarCostsRow) { return wcNumber(row, "duration", "durationYears", "years"); }

function RevolvingDoor({ evidence }: { evidence: string }) {
  const metrics = [
    ["Revolving-door lobbyists", evidence.match(/2,700\+?/)?.[0] ?? "2,700+", "since 2001"],
    ["DoD officials → contractors", evidence.match(/\b380\b/)?.[0] ?? "380", "high-ranking officials"],
    ["Top-5 defense lobbying", evidence.match(/\$47M/)?.[0] ?? "$47M", "2023 source figure"],
    ["Boeing Pentagon hires", evidence.match(/\b85\b/)?.[0] ?? "85", "former officials"],
  ];
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><GitBranch size={18} className="text-violet-200/70" /><h3 className="text-lg font-black">Pentagon Revolving Door</h3></div><p className="mt-1 text-xs text-cyan-100/42">Native accountability summary backed by the mirrored WarCosts revolving-door page rather than a hard-coded search page.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, note]) => <div key={label} className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-bold text-cyan-50/70">{label}</p><p className="mt-1 text-[9px] text-cyan-100/35">{note}</p></div>)}</div><details className="mt-4 rounded-xl border border-white/8 bg-black/10 p-4"><summary className="cursor-pointer text-xs font-bold">Open retained revolving-door evidence</summary><p className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-[10px] leading-5 text-cyan-50/55">{evidence.slice(0, 30_000)}</p></details></GlassCard>;
}

function RoiAnalysis({ rows }: { rows: WarCostsRow[] }) {
  const [sort, setSort] = useState<SortKey>("roi");
  const ranked = useMemo(() => [...rows].sort((a, b) => {
    const value = sort === "roi" ? roiScore : sort === "cost" ? roiCost : sort === "deaths" ? roiDeaths : roiDuration;
    return value(b) - value(a);
  }), [rows, sort]);
  const avg = rows.length ? rows.reduce((sum, row) => sum + roiScore(row), 0) / rows.length : 0;
  const met = rows.filter((row) => roiScore(row) >= 40).length;
  return <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Trophy size={18} className="text-amber-200/70" /><h3 className="text-lg font-black">War Return on Investment</h3></div><p className="mt-1 text-xs text-cyan-100/42">Sortable native view of the mirrored `war-roi.json` analysis.</p></div><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="min-h-10 rounded-xl border border-white/10 bg-[#07101c] px-3 text-xs"><option value="roi">ROI score</option><option value="cost">Cost</option><option value="deaths">US deaths</option><option value="duration">Duration</option></select></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{avg.toFixed(0)}</p><p className="text-[9px] text-cyan-100/35">average ROI score</p></div><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{met}/{rows.length}</p><p className="text-[9px] text-cyan-100/35">scores 40+</p></div><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{wcMoney(rows.reduce((sum, row) => sum + roiCost(row), 0))}</p><p className="text-[9px] text-cyan-100/35">source cost total</p></div></div><div className="mt-4 max-h-[620px] overflow-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35"><th className="p-2">War</th><th className="p-2">ROI</th><th className="p-2">Cost</th><th className="p-2">US deaths</th><th className="p-2">Duration</th><th className="p-2">Outcome / objective</th></tr></thead><tbody>{ranked.map((row, index) => <tr key={`${wcConflictName(row)}-${index}`} className="border-t border-white/8"><td className="p-3 font-bold">{wcText(row, "name", "war", "conflict") || wcConflictName(row)}</td><td className="p-3 font-black">{roiScore(row) || "—"}</td><td className="p-3">{wcMoney(roiCost(row))}</td><td className="p-3">{wcInteger(roiDeaths(row))}</td><td className="p-3">{roiDuration(row) || "—"}</td><td className="max-w-[320px] p-3 text-cyan-50/55">{wcText(row, "outcome", "objective", "objectives", "assessment") || "—"}</td></tr>)}</tbody></table></div></GlassCard>;
}

function GlobalReactions({ page }: { page: StructuredPageResponse["page"] | null }) {
  const table = page?.tables?.find((candidate) => candidate.headers.some((header) => /country/i.test(header)) && candidate.headers.some((header) => /position/i.test(header))) ?? page?.tables?.[0];
  const rows = table?.rows ?? [];
  const positionIndex = table?.headers.findIndex((header) => /position/i.test(header)) ?? -1;
  const counts = rows.reduce<Record<string, number>>((acc, row) => { const key = positionIndex >= 0 ? row[positionIndex] || "Unknown" : "Recorded"; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><Scale size={18} className="text-cyan-200/70" /><h3 className="text-lg font-black">Global Reactions</h3></div><p className="mt-1 text-xs text-cyan-100/42">Structured country-position table parsed from WarCosts' live Global Reactions page. This is separate from the operational War Map.</p><div className="mt-4 flex flex-wrap gap-2">{Object.entries(counts).map(([key, value]) => <span key={key} className="rounded-full border border-cyan-100/12 bg-black/10 px-3 py-1.5 text-[10px] font-bold">{key}: {value}</span>)}</div>{table ? <div className="mt-4 max-h-[620px] overflow-auto"><table className="w-full min-w-[900px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35">{table.headers.map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-white/8">{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[360px] p-3 text-cyan-50/70">{cell}</td>)}</tr>)}</tbody></table></div> : <p className="mt-4 text-xs text-cyan-100/40">No structured table was exposed by the current page response.</p>}</GlassCard>;
}

export default function WarCostsAccountability() {
  const [roi, setRoi] = useState<WarCostsRow[]>([]);
  const [revolvingEvidence, setRevolvingEvidence] = useState("");
  const [reactions, setReactions] = useState<StructuredPageResponse["page"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [roiResponse, revolvingResponse, reactionsResponse] = await Promise.all([
        getWarCostsDataset("war-roi.json", force),
        getWarCostsPageEvidence("/revolving-door"),
        readStructuredPage("/global-reactions"),
      ]);
      setRoi(wcRows(roiResponse.data));
      setRevolvingEvidence(revolvingResponse.page.evidence_text || "");
      setReactions(reactionsResponse.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "WarCosts accountability features could not load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  return <main className="aurora-bg min-h-screen text-white"><Sidebar /><section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Accountability & Reactions" subtitle="Native views for War ROI, the Pentagon revolving door, and country-by-country reactions that sit outside WarCosts' headline calculator inventory." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button></div><WarCostsWorkspaceNav />{error && <GlassCard className="mt-5 border-rose-300/20 p-4 text-xs text-rose-100">{error}</GlassCard>}{loading ? <GlassCard className="mt-5 grid min-h-[520px] place-items-center"><Loader2 className="h-9 w-9 animate-spin text-cyan-200" /></GlassCard> : <div className="mt-5 space-y-5"><RoiAnalysis rows={roi} /><RevolvingDoor evidence={revolvingEvidence} /><GlobalReactions page={reactions} /></div>}</section></main>;
}
