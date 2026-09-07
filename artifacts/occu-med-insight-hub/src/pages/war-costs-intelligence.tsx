import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, MapPinned, RefreshCw, Users } from "lucide-react";
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

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Building2 }) {
  return <div className="border-r border-white/8 px-5 py-4 last:border-r-0"><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">{label}</p><Icon size={14} className="text-cyan-200/50" /></div><p className="mt-2 text-2xl font-black tracking-[-.03em] text-white">{value}</p><p className="mt-1 text-[10px] leading-5 text-slate-600">{note}</p></div>;
}

export default function WarCostsIntelligence() {
  const [installationResponse, setInstallationResponse] = useState<WarCostsDatasetResponse | null>(null);
  const [contractorResponse, setContractorResponse] = useState<WarCostsDatasetResponse | null>(null);
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [installations, contractors, defense] = await Promise.all([
        getWarCostsDataset("base-index.json", force).catch(() => null),
        getWarCostsDataset("contractors.json", force).catch(() => null),
        getDefensePresence(force).catch((reason) => ({ ok: false, partial: true, current: [], construction: [], warnings: [reason instanceof Error ? reason.message : "Defense-presence feed failed."] } as DefensePresence)),
      ]);
      setInstallationResponse(installations);
      setContractorResponse(contractors);
      setDefensePresence(defense);
      const warnings = [!installations ? "Installation data unavailable." : "", !contractors ? "Contractor data unavailable." : "", ...(defense.warnings || [])].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  const installations = useMemo(() => wcRows(installationResponse?.data), [installationResponse]);
  const contractors = useMemo(() => wcRows(contractorResponse?.data), [contractorResponse]);
  const personnel = defensePresence?.current || [];
  const construction = defensePresence?.construction || [];

  const countryRows = useMemo(() => {
    const map = new Map<string, { country: string; personnel: number; installations: number; expansions: number; expansionValue: number }>();
    const get = (name: string) => { const current = map.get(name) || { country: name, personnel: 0, installations: 0, expansions: 0, expansionValue: 0 }; map.set(name, current); return current; };
    personnel.forEach((row) => { const name = country(row); if (name !== "Unknown") get(name).personnel = Math.max(get(name).personnel, wcNumber(row, "personnel", "troops")); });
    installations.forEach((row) => { const name = country(row); if (name !== "Unknown") get(name).installations += 1; });
    construction.forEach((row) => { const name = country(row); if (name !== "Unknown") { const item = get(name); item.expansions += 1; item.expansionValue += wcNumber(row, "spending", "amount", "cost", "total"); } });
    return [...map.values()].sort((a, b) => b.personnel - a.personnel || b.expansions - a.expansions || b.installations - a.installations);
  }, [construction, installations, personnel]);

  const recentExpansion = useMemo(() => [...construction].sort((a, b) => wcNumber(b, "year") - wcNumber(a, "year") || wcNumber(b, "spending", "amount", "cost", "total") - wcNumber(a, "spending", "amount", "cost", "total")).slice(0, 12), [construction]);
  const countryCount = countryRows.length;

  return <main className="min-h-screen bg-[#06090d] pb-24 text-white"><Sidebar /><section className="px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Occu-Med · Defense network planning" title="Defense Medical Support Intelligence" subtitle="A focused view of defense installations, personnel footprint, site expansion, and contractor context that can support provider-network, client, and opportunity decisions. Generic war intelligence is excluded." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.08] px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button></div><WarCostsWorkspaceNav />{error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs text-amber-100/75">{error}</div> : null}{loading ? <div className="mt-5 grid min-h-[620px] place-items-center border border-white/10 bg-[#080c12]"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-slate-500">Loading Occu-Med-relevant defense context…</p></div></div> : <>
    <section className="mt-5 grid border border-white/10 bg-[#080c12] md:grid-cols-2 xl:grid-cols-4"><Metric label="Mapped installations" value={installations.length.toLocaleString()} note="Defense sites available for network-planning context" icon={Building2} /><Metric label="Personnel countries" value={personnel.length.toLocaleString()} note={defensePresence?.latestYear ? `Country-level source rows · ${defensePresence.latestYear}` : "Country-level source rows"} icon={Users} /><Metric label="Expansion sites" value={construction.length.toLocaleString()} note="Construction / new-facility records" icon={MapPinned} /><Metric label="Contractor records" value={contractors.length.toLocaleString()} note="Entity/opportunity context only" icon={Building2} /></section>

    <section className="mt-5 grid gap-5 2xl:grid-cols-[1.35fr_.65fr]">
      <div className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Country footprint</p><h2 className="mt-1 text-xl font-black text-white">Where network depth may matter</h2><p className="mt-2 text-xs leading-6 text-slate-400">Sorted by personnel footprint, then expansion and installation evidence. No demand score is invented and personnel counts are not treated as contractor volume.</p></header><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/8 text-[9px] uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">Country</th><th className="p-3 text-right">Personnel</th><th className="p-3 text-right">Installations</th><th className="p-3 text-right">Expansion</th><th className="p-3">Planning interpretation</th></tr></thead><tbody>{countryRows.slice(0, 50).map((item) => <tr key={item.country} className="border-b border-white/[.055]"><td className="p-3 font-black text-white">{item.country}</td><td className="p-3 text-right text-slate-200">{item.personnel ? item.personnel.toLocaleString() : "—"}</td><td className="p-3 text-right text-slate-400">{item.installations}</td><td className="p-3 text-right text-slate-400">{item.expansions}</td><td className="p-3 text-[11px] leading-5 text-slate-500">{item.expansions ? "Review emerging provider capacity and contractor footprint" : item.installations ? "Review existing provider coverage around defense sites" : "Country-level context only"}</td></tr>)}</tbody></table></div></div>

      <aside className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Current evidence state</p><h2 className="mt-1 text-lg font-black text-white">Source coverage</h2></header><div className="divide-y divide-white/[.06] text-xs"><div className="p-4"><div className="flex justify-between"><span className="text-slate-400">Installation index</span><strong className={installationResponse ? "text-emerald-200" : "text-rose-200"}>{installationResponse ? "Available" : "Unavailable"}</strong></div><p className="mt-1 text-[10px] text-slate-600">{installations.length.toLocaleString()} mapped records</p></div><div className="p-4"><div className="flex justify-between"><span className="text-slate-400">Personnel footprint</span><strong className={defensePresence?.current ? "text-emerald-200" : "text-rose-200"}>{defensePresence?.current ? "Available" : "Unavailable"}</strong></div><p className="mt-1 text-[10px] text-slate-600">{countryCount.toLocaleString()} countries represented</p></div><div className="p-4"><div className="flex justify-between"><span className="text-slate-400">Site expansion</span><strong className={defensePresence?.construction ? "text-emerald-200" : "text-rose-200"}>{defensePresence?.construction ? "Available" : "Unavailable"}</strong></div><p className="mt-1 text-[10px] text-slate-600">{construction.length.toLocaleString()} construction records</p></div><div className="p-4"><div className="flex justify-between"><span className="text-slate-400">Contractor context</span><strong className={contractorResponse ? "text-emerald-200" : "text-rose-200"}>{contractorResponse ? "Available" : "Unavailable"}</strong></div><p className="mt-1 text-[10px] text-slate-600">{contractors.length.toLocaleString()} records</p></div></div></aside>
    </section>

    <section className="mt-5 border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Expansion watch</p><h2 className="mt-1 text-xl font-black text-white">Recent site-expansion records</h2><p className="mt-2 text-xs leading-6 text-slate-400">These are prompts to investigate provider capacity early, not predictions that Occu-Med will receive referrals.</p></header><div className="divide-y divide-white/[.06]">{recentExpansion.map((row, index) => { const location = wcText(row, "location", "site", "facility") || `Expansion site ${index + 1}`; const value = wcNumber(row, "spending", "amount", "cost", "total"); return <div key={`${location}-${index}`} className="grid gap-3 p-4 md:grid-cols-[1.3fr_.7fr_90px_130px_1.4fr]"><strong className="text-sm text-white">{location}</strong><span className="text-xs text-slate-400">{country(row)}</span><span className="text-xs text-slate-400">{wcNumber(row, "year") || "—"}</span><span className="text-xs font-bold text-slate-300">{value ? wcMoney(value) : "—"}</span><span className="text-[11px] leading-5 text-slate-500">Check contractor staffing trajectory and nearby fixed clinic capability.</span></div>; })}</div></section>
  </>}</section></main>;
}
