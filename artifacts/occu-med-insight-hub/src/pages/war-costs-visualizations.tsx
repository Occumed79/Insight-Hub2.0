import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { wcMoney, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

type DefensePresence = {
  ok: boolean;
  partial?: boolean;
  latestYear?: number | null;
  current?: WarCostsRow[];
  construction?: WarCostsRow[];
  warnings?: string[];
};

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

function country(row: WarCostsRow): string {
  return wcText(row, "country", "countryName", "hostCountry", "location") || "Unknown";
}

function RankedBars({ title, subtitle, rows, valueLabel }: { title: string; subtitle: string; rows: Array<{ name: string; value: number; note?: string }>; valueLabel?: (value: number) => string }) {
  const max = Math.max(...rows.map((item) => item.value), 1);
  return <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><h2 className="text-lg font-black text-white">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></header><div className="divide-y divide-white/[.06]">{rows.slice(0, 20).map((item, index) => <div key={`${item.name}-${index}`} className="p-4"><div className="flex items-center justify-between gap-4"><div><strong className="text-sm text-white">{item.name}</strong>{item.note ? <p className="mt-1 text-[10px] text-slate-600">{item.note}</p> : null}</div><span className="shrink-0 text-sm font-black text-slate-200">{valueLabel ? valueLabel(item.value) : item.value.toLocaleString()}</span></div><div className="mt-2 h-1.5 overflow-hidden bg-white/[.05]"><div className="h-full bg-cyan-200/60" style={{ width: `${Math.max(2, item.value / max * 100)}%` }} /></div></div>)}</div></section>;
}

function ExpansionTimeline({ rows }: { rows: WarCostsRow[] }) {
  const points = useMemo(() => {
    const map = new Map<number, { year: number; sites: number; value: number }>();
    rows.forEach((row) => {
      const year = wcNumber(row, "year");
      if (!year) return;
      const item = map.get(year) || { year, sites: 0, value: 0 };
      item.sites += 1;
      item.value += wcNumber(row, "spending", "amount", "cost", "total");
      map.set(year, item);
    });
    return [...map.values()].sort((a, b) => a.year - b.year);
  }, [rows]);
  const maxSites = Math.max(...points.map((item) => item.sites), 1);
  return <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><div className="flex items-center gap-2"><TrendingUp size={17} className="text-amber-200/70" /><div><h2 className="text-lg font-black text-white">Site expansion timeline</h2><p className="mt-1 text-xs leading-5 text-slate-500">Construction records over time. Treat them as emerging-location signals for network planning, not demand forecasts.</p></div></div></header><div className="overflow-x-auto p-5"><div className="flex min-w-[820px] items-end gap-3 border-b border-white/10 pb-3">{points.map((item) => <div key={item.year} className="flex min-w-[52px] flex-1 flex-col items-center justify-end"><div title={`${item.sites} site${item.sites === 1 ? "" : "s"}${item.value ? ` · ${wcMoney(item.value)}` : ""}`} className="w-full bg-amber-200/55" style={{ height: `${Math.max(8, item.sites / maxSites * 180)}px` }} /><span className="mt-2 text-[9px] text-slate-500">{item.year}</span><span className="mt-1 text-[10px] font-black text-slate-300">{item.sites}</span></div>)}</div></div></section>;
}

export default function WarCostsVisualizations() {
  const [installationResponse, setInstallationResponse] = useState<WarCostsDatasetResponse | null>(null);
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [installations, defense] = await Promise.all([
        getWarCostsDataset("base-index.json", force).catch(() => null),
        getDefensePresence(force).catch((reason) => ({ ok: false, partial: true, current: [], construction: [], warnings: [reason instanceof Error ? reason.message : "Defense-presence feed failed."] } as DefensePresence)),
      ]);
      setInstallationResponse(installations);
      setDefensePresence(defense);
      const warnings = [!installations ? "Installation data unavailable." : "", ...(defense.warnings || [])].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  const installations = useMemo(() => wcRows(installationResponse?.data), [installationResponse]);
  const personnelRanked = useMemo(() => [...(defensePresence?.current || [])].map((row) => ({ name: country(row), value: wcNumber(row, "personnel", "troops"), note: defensePresence?.latestYear ? `Personnel dataset ${defensePresence.latestYear}` : undefined })).filter((item) => item.name !== "Unknown" && item.value > 0).sort((a, b) => b.value - a.value), [defensePresence]);
  const installationsRanked = useMemo(() => {
    const map = new Map<string, number>();
    installations.forEach((row) => { const name = country(row); if (name !== "Unknown") map.set(name, (map.get(name) || 0) + 1); });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [installations]);
  const expansionRanked = useMemo(() => {
    const map = new Map<string, { value: number; sites: number }>();
    (defensePresence?.construction || []).forEach((row) => { const name = country(row); if (name === "Unknown") return; const current = map.get(name) || { value: 0, sites: 0 }; current.value += wcNumber(row, "spending", "amount", "cost", "total"); current.sites += 1; map.set(name, current); });
    return [...map.entries()].map(([name, item]) => ({ name, value: item.value || item.sites, note: item.value ? `${item.sites} expansion site${item.sites === 1 ? "" : "s"}` : `${item.sites} expansion site${item.sites === 1 ? "" : "s"} · value not reported` })).sort((a, b) => b.value - a.value);
  }, [defensePresence]);

  return <main className="min-h-screen bg-[#06090d] pb-24 text-white"><Sidebar /><section className="px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Occu-Med · Defense network planning" title="Footprint Visualizations" subtitle="Visualize only the defense context that can support Occu-Med network, provider, client, and expansion decisions. Conflict, casualty, strike, naval, military-spending, weapons, and political visualizations are excluded." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.08] px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button></div><WarCostsWorkspaceNav />{error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs text-amber-100/75">{error}</div> : null}<div className="mt-5">{loading ? <div className="grid min-h-[560px] place-items-center border border-white/10 bg-[#080c12]"><Loader2 className="animate-spin text-cyan-200" /></div> : <div className="grid gap-5 xl:grid-cols-2"><RankedBars title="Personnel footprint" subtitle="Largest country-level U.S. personnel presence. Network-priority context only; not contractor or referral volume." rows={personnelRanked} /><RankedBars title="Installation concentration" subtitle="Number of mapped defense installations by country." rows={installationsRanked} /><RankedBars title="Expansion concentration" subtitle="Countries with the largest reported construction value, or site count where value is unavailable." rows={expansionRanked} valueLabel={(value) => value >= 100000 ? wcMoney(value) : value.toLocaleString()} /><ExpansionTimeline rows={defensePresence?.construction || []} /></div>}</div></section></main>;
}
