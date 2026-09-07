import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { wcCivilianDeaths, wcConflictId, wcConflictName, wcInteger, wcMoney, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

const DATASETS = ["conflicts.json", "military-spending.json", "overseas-presence.json", "base-countries.json", "drone-strikes.json"] as const;

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
  const years = useMemo(() => Array.from({ length: current - 1940 + 1 }, (_value, index) => 1940 + index), [current]);
  const counts = useMemo(() => new Map(years.map((year) => [year, conflicts.filter((row) => activeInYear(row, year)).length])), [conflicts, years]);
  const [selected, setSelected] = useState(current);
  const selectedConflicts = conflicts.filter((row) => activeInYear(row, selected));
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><CalendarDays size={18} className="text-cyan-200/70" /><div><h3 className="text-lg font-black">Conflict Activity Calendar</h3><p className="mt-1 text-xs text-cyan-100/42">Tracked conflicts active in each year.</p></div></div><div className="mt-4 grid grid-cols-8 gap-1 sm:grid-cols-12 md:grid-cols-16 xl:grid-cols-20">{years.map((year) => { const count = counts.get(year) ?? 0; return <button type="button" key={year} title={`${year}: ${count} active conflict${count === 1 ? "" : "s"}`} onClick={() => setSelected(year)} className={`min-h-8 rounded-md border text-[9px] font-bold transition ${count ? "border-rose-200/14 bg-rose-300/[.10] text-rose-50" : "border-emerald-200/10 bg-emerald-300/[.035] text-emerald-100/45"} ${selected === year ? "ring-2 ring-cyan-100/60" : ""}`}>{String(year).slice(-2)}</button>; })}</div><div className="mt-5 rounded-2xl border border-cyan-100/10 bg-black/15 p-4"><p className="text-[10px] uppercase tracking-wider text-cyan-100/35">{selected}</p><div className="mt-2 flex flex-wrap gap-2">{selectedConflicts.length ? selectedConflicts.map((row) => <span key={wcConflictId(row)} className="rounded-full border border-cyan-100/10 px-3 py-1.5 text-[10px] text-cyan-50/70">{wcConflictName(row)}</span>) : <span className="text-xs text-emerald-100/55">No tracked conflict active.</span>}</div></div></GlassCard>;
}

function SpendingTimeline({ rows }: { rows: WarCostsRow[] }) {
  const points = useMemo(() => rows.map((row) => ({ year: wcNumber(row, "year"), value: adjustedSpending(row) })).filter((point) => point.year && point.value).sort((a, b) => a.year - b.year), [rows]);
  const width = 1000, height = 300, pad = 28;
  const max = Math.max(...points.map((point) => point.value), 1);
  const minYear = points[0]?.year ?? 1940, maxYear = points.at(-1)?.year ?? 2026;
  const x = (year: number) => pad + ((year - minYear) / Math.max(1, maxYear - minYear)) * (width - pad * 2);
  const y = (value: number) => height - pad - (value / max) * (height - pad * 2);
  const polyline = points.map((point) => `${x(point.year)},${y(point.value)}`).join(" ");
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><TrendingUp size={18} className="text-cyan-200/70" /><div><h3 className="text-lg font-black">Military Spending Over Time</h3><p className="mt-1 text-xs text-cyan-100/42">Observed source-driven spending history; no taxpayer or personal-cost calculator.</p></div></div><div className="mt-4 overflow-x-auto rounded-xl border border-white/8 bg-black/15 p-3"><svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] min-w-[760px] w-full" role="img" aria-label="Military spending over time line chart"><line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="currentColor" className="text-cyan-100/15" /><polyline fill="none" stroke="currentColor" strokeWidth="3" points={polyline} className="text-cyan-200/70" />{points.filter((_point, index) => index % 10 === 0 || index === points.length - 1).map((point) => <g key={point.year}><circle cx={x(point.year)} cy={y(point.value)} r="4" fill="currentColor" className="text-white" /><text x={x(point.year)} y={height-6} textAnchor="middle" fontSize="12" fill="currentColor" className="text-cyan-100/45">{point.year}</text></g>)}</svg></div><div className="mt-3 flex flex-wrap gap-2">{[...points].sort((a,b)=>b.value-a.value).slice(0,5).map((point) => <span key={point.year} className="rounded-full border border-white/8 px-3 py-1 text-[10px] text-cyan-50/60">{point.year}: {wcMoney(point.value)}</span>)}</div></GlassCard>;
}

function CivilianImpact({ conflicts, strikes }: { conflicts: WarCostsRow[]; strikes: WarCostsRow[] }) {
  const conflictRows = conflicts.map((row) => ({ name: wcConflictName(row), location: wcText(row, "region", "country", "location"), value: wcCivilianDeaths(row), kind: "Conflict" })).filter((item) => item.value > 0);
  const strikeRows = strikes.map((row) => ({ name: wcText(row, "name", "title", "target", "location") || "Strike activity", location: wcText(row, "country", "location", "region"), value: wcNumber(row, "civilianDeaths", "civilianCasualties", "civiliansKilled", "deaths", "casualties"), kind: "Strike / drone" })).filter((item) => item.value > 0);
  const ranked = [...conflictRows, ...strikeRows].sort((a, b) => b.value - a.value).slice(0, 20);
  const max = Math.max(...ranked.map((item) => item.value), 1);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Instability · Civilian Impact Signals</h3><p className="mt-1 text-xs text-cyan-100/42">Civilian casualty/death values are treated as part of instability, including strike/drone records.</p><div className="mt-4 space-y-3">{ranked.map((item, index) => <div key={`${item.kind}-${item.name}-${index}`}><div className="flex justify-between gap-3 text-xs"><span className="truncate"><strong>{item.name}</strong> <span className="text-cyan-100/35">· {item.kind}{item.location ? ` · ${item.location}` : ""}</span></span><strong>{wcInteger(item.value)}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-rose-200/55" style={{ width: `${Math.max(2, item.value / max * 100)}%` }} /></div></div>)}</div></GlassCard>;
}

function PresenceComparison({ rows }: { rows: WarCostsRow[] }) {
  const ranked = [...rows].map((row) => ({ name: wcText(row, "country", "countryName", "location", "name"), value: wcNumber(row, "personnel", "troops", "count") })).filter((item) => item.name && item.value > 0).sort((a, b) => b.value - a.value).slice(0, 20);
  const max = Math.max(...ranked.map((item) => item.value), 1);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Personnel / Troop Posture</h3><p className="mt-1 text-xs text-cyan-100/42">Largest source-recorded personnel footprints.</p><div className="mt-4 space-y-3">{ranked.map((item) => <div key={item.name}><div className="flex justify-between gap-3 text-xs"><span>{item.name}</span><strong>{item.value.toLocaleString()}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-emerald-200/55" style={{ width: `${Math.max(2, item.value / max * 100)}%` }} /></div></div>)}</div></GlassCard>;
}

export default function WarCostsVisualizations() {
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const pairs = await Promise.all(DATASETS.map(async (name) => { try { return [name, await getWarCostsDataset(name, force)] as const; } catch { return [name, null] as const; } }));
      const next: Record<string, WarCostsDatasetResponse> = {};
      for (const [name, response] of pairs) if (response) next[name] = response;
      setResponses(next);
      if (!Object.keys(next).length) setError("Visualization datasets are unavailable.");
    } finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { void load(false); }, []);
  const data = useMemo(() => Object.fromEntries(Object.entries(responses).map(([name, response]) => [name, response.data])) as Record<string, unknown>, [responses]);
  const conflicts = wcRows(data["conflicts.json"]);
  return <main className="aurora-bg min-h-screen text-white"><Sidebar /><section className="relative z-10 px-5 py-8 pb-24 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Visualizations" subtitle="Conflict activity, instability, spending history and personnel posture. Weapons and military-hardware visualizations are removed." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button></div><WarCostsWorkspaceNav />{error ? <p className="mt-4 text-xs text-rose-100">{error}</p> : null}<div className="mt-5 space-y-5">{loading ? <GlassCard className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-cyan-200" /></GlassCard> : <><WarCalendar conflicts={conflicts} /><SpendingTimeline rows={wcRows(data["military-spending.json"])} /><div className="grid gap-5 xl:grid-cols-2"><CivilianImpact conflicts={conflicts} strikes={wcRows(data["drone-strikes.json"])} /><PresenceComparison rows={wcRows(data["overseas-presence.json"])} /></div></>}</div></section></main>;
}
