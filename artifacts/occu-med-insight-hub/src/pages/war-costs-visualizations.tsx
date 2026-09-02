import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { wcConflictCost, wcConflictDeaths, wcConflictId, wcConflictName, wcInteger, wcMoney, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

const DATASETS = ["conflicts.json", "military-spending.json", "weapons.json", "weapons-detail.json"] as const;
type OverrunSort = "percent" | "total" | "waste";

function adjustedSpending(row: WarCostsRow) {
  return wcNumber(row, "inflationAdjusted", "adjusted2024", "adjusted2023", "adjusted2026", "spendingAdjusted", "realSpending", "amount", "spending", "total");
}

function activeInYear(row: WarCostsRow, year: number) {
  const start = wcNumber(row, "startYear", "year");
  const end = wcNumber(row, "endYear") || new Date().getFullYear();
  return start > 0 && start <= year && end >= year;
}

function WarCalendar({ conflicts }: { conflicts: WarCostsRow[] }) {
  const current = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: current - 1776 + 1 }, (_value, index) => 1776 + index), [current]);
  const counts = useMemo(() => new Map(years.map((year) => [year, conflicts.filter((row) => activeInYear(row, year)).length])), [conflicts, years]);
  const [selected, setSelected] = useState(current);
  const selectedConflicts = conflicts.filter((row) => activeInYear(row, selected));
  const warYears = years.filter((year) => (counts.get(year) ?? 0) > 0).length;
  const peaceYears = years.length - warYears;
  const longestPeace = useMemo(() => {
    let bestStart = 0, bestEnd = 0, runStart = 0;
    for (const year of years) {
      if ((counts.get(year) ?? 0) === 0) { if (!runStart) runStart = year; if (year - runStart > bestEnd - bestStart) { bestStart = runStart; bestEnd = year; } }
      else runStart = 0;
    }
    return bestStart ? `${bestStart}–${bestEnd} (${bestEnd - bestStart + 1} years)` : "—";
  }, [counts, years]);
  const tone = (count: number) => count === 0 ? "border-emerald-200/10 bg-emerald-300/[.045] text-emerald-100/55" : count === 1 ? "border-amber-200/12 bg-amber-300/[.08] text-amber-50/75" : count <= 3 ? "border-orange-200/14 bg-orange-300/[.12] text-orange-50" : "border-rose-200/18 bg-rose-300/[.18] text-rose-50";
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><CalendarDays size={18} className="text-cyan-200/70" /><div><h3 className="text-lg font-black">America’s War Calendar</h3><p className="mt-1 text-xs text-cyan-100/42">Click any year to see the mirrored conflicts active during that year.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{warYears}</p><p className="text-[9px] text-cyan-100/35">years with ≥1 tracked conflict</p></div><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-2xl font-black">{peaceYears}</p><p className="text-[9px] text-cyan-100/35">years with no tracked conflict</p></div><div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-lg font-black">{longestPeace}</p><p className="text-[9px] text-cyan-100/35">longest no-conflict run in mirrored data</p></div></div><div className="mt-4 flex flex-wrap gap-2 text-[9px]"><span className="rounded-full border border-emerald-200/10 px-2 py-1 text-emerald-100/55">Peace</span><span className="rounded-full border border-amber-200/10 px-2 py-1 text-amber-100/70">1 conflict</span><span className="rounded-full border border-orange-200/10 px-2 py-1 text-orange-100/75">2–3 conflicts</span><span className="rounded-full border border-rose-200/10 px-2 py-1 text-rose-100/80">4+ conflicts</span></div><div className="mt-4 grid grid-cols-8 gap-1 sm:grid-cols-12 md:grid-cols-16 xl:grid-cols-20">{years.map((year) => { const count = counts.get(year) ?? 0; return <button type="button" key={year} title={`${year}: ${count} active conflict${count === 1 ? "" : "s"}`} onClick={() => setSelected(year)} className={`min-h-8 rounded-md border text-[9px] font-bold transition ${tone(count)} ${selected === year ? "ring-2 ring-cyan-100/60" : ""}`}>{String(year).slice(-2)}</button>; })}</div><div className="mt-5 rounded-2xl border border-cyan-100/10 bg-black/15 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-cyan-100/35">Selected year</p><p className="text-2xl font-black">{selected}</p></div><strong className="text-sm">{selectedConflicts.length} active</strong></div><div className="mt-3 flex flex-wrap gap-2">{selectedConflicts.length ? selectedConflicts.map((row) => <span key={wcConflictId(row)} className="rounded-full border border-cyan-100/10 bg-cyan-300/[.05] px-3 py-1.5 text-[10px] text-cyan-50/70">{wcConflictName(row)}</span>) : <span className="text-xs text-emerald-100/55">No mirrored conflict active in this year.</span>}</div></div></GlassCard>;
}

function SpendingTimeline({ rows }: { rows: WarCostsRow[] }) {
  const points = useMemo(() => rows.map((row) => ({ year: wcNumber(row, "year"), value: adjustedSpending(row) })).filter((point) => point.year && point.value).sort((a, b) => a.year - b.year), [rows]);
  const width = 1000, height = 300, pad = 28;
  const max = Math.max(...points.map((point) => point.value), 1);
  const minYear = points[0]?.year ?? 1940, maxYear = points.at(-1)?.year ?? 2026;
  const x = (year: number) => pad + ((year - minYear) / Math.max(1, maxYear - minYear)) * (width - pad * 2);
  const y = (value: number) => height - pad - (value / max) * (height - pad * 2);
  const polyline = points.map((point) => `${x(point.year)},${y(point.value)}`).join(" ");
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><TrendingUp size={18} className="text-cyan-200/70" /><div><h3 className="text-lg font-black">Military Spending Over Time</h3><p className="mt-1 text-xs text-cyan-100/42">Source-driven annual inflation-adjusted spending history.</p></div></div><div className="mt-4 overflow-x-auto rounded-xl border border-white/8 bg-black/15 p-3"><svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] min-w-[760px] w-full" role="img" aria-label="Military spending over time line chart"><line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="currentColor" className="text-cyan-100/15" /><polyline fill="none" stroke="currentColor" strokeWidth="3" points={polyline} className="text-cyan-200/70" />{points.filter((_point, index) => index % 10 === 0 || index === points.length - 1).map((point) => <g key={point.year}><circle cx={x(point.year)} cy={y(point.value)} r="4" fill="currentColor" className="text-white" /><text x={x(point.year)} y={height-6} textAnchor="middle" fontSize="12" fill="currentColor" className="text-cyan-100/45">{point.year}</text></g>)}</svg></div><div className="mt-3 flex flex-wrap gap-2">{[...points].sort((a,b)=>b.value-a.value).slice(0,5).map((point) => <span key={point.year} className="rounded-full border border-white/8 px-3 py-1 text-[10px] text-cyan-50/60">{point.year}: {wcMoney(point.value)}</span>)}</div></GlassCard>;
}

function HorizontalComparison({ title, note, rows, value, formatter }: { title: string; note: string; rows: WarCostsRow[]; value: (row: WarCostsRow) => number; formatter: (value: number) => string }) {
  const ranked = [...rows].filter((row) => value(row) > 0).sort((a,b)=>value(b)-value(a)).slice(0,10);
  const max = Math.max(...ranked.map(value), 1);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">{title}</h3><p className="mt-1 text-xs text-cyan-100/42">{note}</p><div className="mt-4 space-y-3">{ranked.map((row, index) => <div key={wcConflictId(row)}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate"><strong>#{index+1}</strong> {wcConflictName(row)}</span><strong className="shrink-0">{formatter(value(row))}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-cyan-200/55" style={{ width: `${Math.max(2, value(row)/max*100)}%` }} /></div></div>)}</div></GlassCard>;
}

function weaponName(row: WarCostsRow) { return wcText(row, "name", "system", "program", "title", "slug") || "Unnamed system"; }
function currentWeaponCost(row: WarCostsRow) { return wcNumber(row, "currentCostBillions", "currentCost", "actualCost", "programCost", "totalProgramCost", "lifetimeCost", "cost"); }
function originalWeaponCost(row: WarCostsRow) { return wcNumber(row, "originalCostBillions", "originalCost", "originalEstimate", "initialCost", "baselineCost"); }
function overrunPercent(row: WarCostsRow) { const explicit = wcNumber(row, "costOverrunPct", "costOverrun", "overrunPct", "overrunPercent"); if (explicit) return explicit; const original = originalWeaponCost(row), current = currentWeaponCost(row); return original > 0 ? ((current-original)/original)*100 : 0; }
function wastedWeaponCost(row: WarCostsRow) { const explicit = wcNumber(row, "wasteBillions", "wastedBillions", "overrunBillions", "costGrowthBillions"); if (explicit) return explicit; return Math.max(0, currentWeaponCost(row)-originalWeaponCost(row)); }
function normalizeWeaponCost(value: number) { return value > 0 && value < 100_000 ? value * 1_000_000_000 : value; }

function CostOverruns({ broad, detail }: { broad: WarCostsRow[]; detail: WarCostsRow[] }) {
  const [sort, setSort] = useState<OverrunSort>("percent");
  const merged = useMemo(() => {
    const map = new Map<string, WarCostsRow>();
    for (const row of [...broad, ...detail]) { const key = weaponName(row).toLowerCase(); map.set(key, { ...(map.get(key) ?? {}), ...row }); }
    return [...map.values()].filter((row) => overrunPercent(row) > 0 || wastedWeaponCost(row) > 0);
  }, [broad, detail]);
  const ranked = useMemo(() => [...merged].sort((a,b) => sort === "percent" ? overrunPercent(b)-overrunPercent(a) : sort === "total" ? currentWeaponCost(b)-currentWeaponCost(a) : wastedWeaponCost(b)-wastedWeaponCost(a)).slice(0,30), [merged, sort]);
  const maxCost = Math.max(...ranked.map(currentWeaponCost), 1);
  return <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><BarChart3 size={18} className="text-rose-200/70" /><h3 className="text-lg font-black">Interactive Cost Overrun Leaderboard</h3></div><p className="mt-1 text-xs text-cyan-100/42">Original estimate versus current/actual program cost from the mirrored weapon datasets.</p></div><div className="flex flex-wrap gap-2">{([['percent','% Overrun'],['total','Total Cost'],['waste','$ Wasted']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setSort(key)} className={`min-h-9 rounded-xl border px-3 text-[10px] font-bold ${sort === key ? "border-rose-200/25 bg-rose-300/10" : "border-white/8 bg-black/10 text-cyan-100/45"}`}>{label}</button>)}</div></div><div className="mt-4 max-h-[720px] space-y-3 overflow-y-auto pr-1">{ranked.map((row,index) => { const current = currentWeaponCost(row), original = originalWeaponCost(row), currentNormalized = normalizeWeaponCost(current), originalNormalized = normalizeWeaponCost(original); return <div key={`${weaponName(row)}-${index}`} className="rounded-xl border border-white/8 bg-black/10 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black">#{index+1} {weaponName(row)}</p><p className="mt-1 text-[9px] text-cyan-100/38">{wcText(row,"contractor","manufacturer")} · {overrunPercent(row).toFixed(0)}% overrun</p></div><strong className="text-xs">{wcMoney(currentNormalized)}</strong></div><div className="mt-3 space-y-1.5"><div><div className="flex justify-between text-[9px] text-emerald-100/55"><span>Original</span><span>{original ? wcMoney(originalNormalized) : "—"}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-emerald-200/45" style={{ width: `${original ? Math.max(2, original/maxCost*100) : 0}%` }} /></div></div><div><div className="flex justify-between text-[9px] text-rose-100/65"><span>Current / actual</span><span>Waste: {wastedWeaponCost(row) ? wcMoney(normalizeWeaponCost(wastedWeaponCost(row))) : "—"}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-rose-200/55" style={{ width: `${Math.max(2, current/maxCost*100)}%` }} /></div></div></div></div>; })}</div></GlassCard>;
}

export default function WarCostsVisualizations() {
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState("");
  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true); setError("");
    try {
      const pairs = await Promise.all(DATASETS.map(async (name) => { try { return [name, await getWarCostsDataset(name, force)] as const; } catch { return [name, null] as const; } }));
      const next: Record<string, WarCostsDatasetResponse> = {}; for (const [name,response] of pairs) if (response) next[name] = response; setResponses(next);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "WarCosts visualizations could not load."); }
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { void load(false); }, []);
  const data = useMemo(() => Object.fromEntries(Object.entries(responses).map(([name,response]) => [name,response.data])) as Record<string,unknown>, [responses]);
  const conflicts = wcRows(data["conflicts.json"]);
  return <main className="aurora-bg min-h-screen text-white"><Sidebar /><section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Visualizations" subtitle="Native versions of WarCosts’ calendar, interactive charts, and cost-overrun comparison surfaces using the mirrored source data." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button></div><WarCostsWorkspaceNav />{error && <GlassCard className="mt-5 border-rose-300/20 p-4 text-xs text-rose-100">{error}</GlassCard>}{loading ? <GlassCard className="mt-5 grid min-h-[520px] place-items-center"><Loader2 className="h-9 w-9 animate-spin text-cyan-200" /></GlassCard> : <div className="mt-5 space-y-5"><WarCalendar conflicts={conflicts} /><SpendingTimeline rows={wcRows(data["military-spending.json"])} /><div className="grid gap-5 xl:grid-cols-2"><HorizontalComparison title="War Cost Comparison" note="Top 10 costliest mirrored conflicts." rows={conflicts} value={wcConflictCost} formatter={wcMoney} /><HorizontalComparison title="US Deaths by War" note="Top 10 conflicts by recorded US military deaths." rows={conflicts} value={wcConflictDeaths} formatter={wcInteger} /></div><CostOverruns broad={wcRows(data["weapons.json"])} detail={wcRows(data["weapons-detail.json"])} /></div>}</section></main>;
}
