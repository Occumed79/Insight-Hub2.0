import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, MapPinned, RefreshCw, Search, Users } from "lucide-react";
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

type CountryPriorityRow = {
  country: string;
  personnel: number;
  installations: number;
  expansions: number;
  expansionValue: number;
};

type Lens = "personnel" | "expansion" | "installations";
const DATASETS = ["base-index.json", "contractors.json"] as const;

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

function country(row: WarCostsRow): string {
  return wcText(row, "country", "countryName", "hostCountry", "location") || "Unknown";
}

function lensDescription(lens: Lens) {
  if (lens === "expansion") return "Expansion-first: countries with more construction/new-facility records rise to the top; personnel and installations remain visible as separate evidence.";
  if (lens === "installations") return "Installation-first: countries with more mapped defense sites rise to the top; no provider need or referral volume is inferred.";
  return "Personnel-first: country-level U.S. personnel footprint is used only as a network-priority context signal, not a contractor staffing estimate.";
}

export default function WarCostsTools() {
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lens, setLens] = useState<Lens>("personnel");
  const [countryQuery, setCountryQuery] = useState("");
  const [contractorQuery, setContractorQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [pairs, defense] = await Promise.all([
        Promise.all(DATASETS.map(async (name) => { try { return [name, await getWarCostsDataset(name, force)] as const; } catch { return [name, null] as const; } })),
        getDefensePresence(force).catch((reason) => ({ ok: false, partial: true, current: [], construction: [], warnings: [reason instanceof Error ? reason.message : "Defense-presence feed failed."] } as DefensePresence)),
      ]);
      const next: Record<string, WarCostsDatasetResponse> = {};
      for (const [name, response] of pairs) if (response) next[name] = response;
      setResponses(next);
      setDefensePresence(defense);
      const warnings = [...(defense.warnings || []), !next["base-index.json"] ? "Installation data unavailable." : "", !next["contractors.json"] ? "Contractor data unavailable." : ""].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);
  const data = useMemo(() => Object.fromEntries(Object.entries(responses).map(([name, response]) => [name, wcRows(response.data)])) as Record<string, WarCostsRow[]>, [responses]);
  const bases = data["base-index.json"] || [];
  const contractors = data["contractors.json"] || [];
  const personnel = defensePresence?.current || [];
  const construction = defensePresence?.construction || [];

  const countryRows = useMemo<CountryPriorityRow[]>(() => {
    const byCountry = new Map<string, CountryPriorityRow>();
    const get = (name: string) => {
      const key = name.trim() || "Unknown";
      const current = byCountry.get(key) || { country: key, personnel: 0, installations: 0, expansions: 0, expansionValue: 0 };
      byCountry.set(key, current);
      return current;
    };
    personnel.forEach((row) => { const item = get(country(row)); item.personnel = Math.max(item.personnel, wcNumber(row, "personnel", "troops")); });
    bases.forEach((row) => { get(country(row)).installations += 1; });
    construction.forEach((row) => { const item = get(country(row)); item.expansions += 1; item.expansionValue += wcNumber(row, "spending", "amount", "cost", "total"); });
    return [...byCountry.values()].filter((item) => item.country !== "Unknown");
  }, [bases, construction, personnel]);

  const rankedCountries = useMemo(() => {
    const needle = countryQuery.trim().toLowerCase();
    const rows = countryRows.filter((item) => !needle || item.country.toLowerCase().includes(needle));
    return [...rows].sort((a, b) => {
      if (lens === "expansion") return b.expansions - a.expansions || b.expansionValue - a.expansionValue || b.personnel - a.personnel;
      if (lens === "installations") return b.installations - a.installations || b.personnel - a.personnel || b.expansions - a.expansions;
      return b.personnel - a.personnel || b.expansions - a.expansions || b.installations - a.installations;
    });
  }, [countryQuery, countryRows, lens]);

  useEffect(() => {
    if (!selectedCountry && rankedCountries[0]) setSelectedCountry(rankedCountries[0].country);
    else if (selectedCountry && countryRows.length && !countryRows.some((item) => item.country === selectedCountry)) setSelectedCountry(countryRows[0].country);
  }, [countryRows, rankedCountries, selectedCountry]);

  const selected = countryRows.find((item) => item.country === selectedCountry) || rankedCountries[0] || null;
  const selectedExpansions = useMemo(() => construction.filter((row) => country(row) === selected?.country).sort((a, b) => wcNumber(b, "year") - wcNumber(a, "year") || wcNumber(b, "spending", "amount", "cost", "total") - wcNumber(a, "spending", "amount", "cost", "total")), [construction, selected?.country]);
  const selectedBases = useMemo(() => bases.filter((row) => country(row) === selected?.country), [bases, selected?.country]);

  const visibleContractors = useMemo(() => {
    const needle = contractorQuery.trim().toLowerCase();
    return contractors.filter((row) => !needle || JSON.stringify(row).toLowerCase().includes(needle));
  }, [contractorQuery, contractors]);

  return <main className="min-h-screen bg-[#05080c] pb-24 text-white">
    <Sidebar />
    <section className="px-5 py-8 lg:ml-[210px] lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Occu-Med · Defense network planning" title="Network Priority Triage" subtitle="All relevant defense footprint data is visible on first load. Change the evidence lens to reprioritize countries without turning separate source dimensions into a fabricated composite score." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.07] px-4 text-xs font-bold disabled:opacity-45"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh data</button></div>
      <WarCostsWorkspaceNav />
      {error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs text-amber-100/75">{error}</div> : null}

      {loading ? <div className="mt-5 grid min-h-[650px] place-items-center border border-white/10 bg-[#080c12]"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-slate-500">Loading Occu-Med-relevant defense data…</p></div></div> : <>
        <section className="mt-5 border border-white/10 bg-[#080c12]">
          <div className="grid border-b border-white/10 lg:grid-cols-[1fr_auto] lg:items-center"><div className="p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Priority lens</p><p className="mt-1 text-[10px] leading-5 text-slate-500">{lensDescription(lens)}</p></div><div className="flex border-l border-white/10">{(["personnel", "expansion", "installations"] as Lens[]).map((value) => <button key={value} type="button" onClick={() => setLens(value)} className={`min-h-14 border-r border-white/8 px-4 text-[10px] font-black capitalize last:border-r-0 ${lens === value ? "bg-cyan-300/[.07] text-white" : "text-slate-500 hover:bg-white/[.02]"}`}>{value}</button>)}</div></div>
          <div className="grid min-h-[620px] xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 border-r border-white/10">
              <div className="border-b border-white/10 p-3"><label className="flex min-h-10 items-center gap-2 border border-white/10 bg-black/20 px-3"><Search size={13} className="text-slate-600" /><input value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} placeholder="Filter country priority queue…" className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-600" /><span className="text-[9px] font-black text-slate-600">{rankedCountries.length}</span></label></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="border-b border-white/8 text-[9px] uppercase tracking-[.12em] text-slate-600"><tr><th className="p-3">#</th><th className="p-3">Country</th><th className="p-3 text-right">Personnel</th><th className="p-3 text-right">Installations</th><th className="p-3 text-right">Expansion sites</th><th className="p-3 text-right">Expansion value</th><th className="p-3">Why review</th></tr></thead><tbody>{rankedCountries.slice(0, 150).map((item, index) => <tr key={item.country} onClick={() => setSelectedCountry(item.country)} className={`cursor-pointer border-b border-white/[.055] transition ${selected?.country === item.country ? "bg-cyan-300/[.045]" : "hover:bg-white/[.02]"}`}><td className="p-3 text-[10px] font-black text-slate-700">{index + 1}</td><td className="p-3 text-[11px] font-black text-white">{item.country}</td><td className="p-3 text-right text-[10px] font-bold text-slate-300">{item.personnel ? item.personnel.toLocaleString() : "—"}</td><td className="p-3 text-right text-[10px] text-slate-500">{item.installations}</td><td className="p-3 text-right text-[10px] text-slate-500">{item.expansions}</td><td className="p-3 text-right text-[10px] text-slate-500">{item.expansionValue ? wcMoney(item.expansionValue) : "—"}</td><td className="p-3 text-[9px] leading-4 text-slate-600">{item.expansions ? "Emerging location / provider-capacity review" : item.installations ? "Existing site / provider-coverage review" : "Country-level context only"}</td></tr>)}</tbody></table></div>
            </div>

            <aside className="bg-[#070b10] p-4" aria-label="Selected priority country">
              <p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Selected country</p><h2 className="mt-1 text-xl font-black">{selected?.country || "No data"}</h2>
              {selected ? <>
                <div className="mt-4 grid grid-cols-2 gap-px bg-white/8"><div className="bg-[#070b10] p-3"><Users size={13} className="text-cyan-200/55" /><p className="mt-2 text-[8px] uppercase tracking-[.1em] text-slate-600">Personnel</p><p className="mt-1 text-lg font-black">{selected.personnel ? selected.personnel.toLocaleString() : "—"}</p></div><div className="bg-[#070b10] p-3"><Building2 size={13} className="text-cyan-200/55" /><p className="mt-2 text-[8px] uppercase tracking-[.1em] text-slate-600">Installations</p><p className="mt-1 text-lg font-black">{selected.installations}</p></div><div className="bg-[#070b10] p-3"><MapPinned size={13} className="text-amber-200/55" /><p className="mt-2 text-[8px] uppercase tracking-[.1em] text-slate-600">Expansion</p><p className="mt-1 text-lg font-black">{selected.expansions}</p></div><div className="bg-[#070b10] p-3"><MapPinned size={13} className="text-amber-200/55" /><p className="mt-2 text-[8px] uppercase tracking-[.1em] text-slate-600">Value</p><p className="mt-1 text-base font-black">{selected.expansionValue ? wcMoney(selected.expansionValue) : "—"}</p></div></div>
                <div className="mt-4 border-t border-white/8 pt-4"><p className="text-[10px] font-black text-slate-300">Next Occu-Med questions</p><div className="mt-2 divide-y divide-white/[.055] text-[9px] leading-4 text-slate-600"><p className="py-2">Where are contractor/client duty locations relative to these installations?</p><p className="py-2">Which fixed clinics can cover physicals, labs, ECG and routine diagnostics?</p><p className="py-2">Are audiology, PFT, X-ray, stress testing, dental and vaccine gaps present?</p>{selected.expansions ? <p className="py-2 text-amber-100/60">Does site expansion justify provider recruitment before staffing growth?</p> : null}</div></div>
                <div className="mt-4 border-t border-white/8 pt-4"><p className="text-[10px] font-black text-slate-300">Expansion rows</p><div className="mt-2 divide-y divide-white/[.055]">{selectedExpansions.slice(0, 8).map((row, index) => { const value = wcNumber(row, "spending", "amount", "cost", "total"); return <div key={`${wcText(row, "location", "site", "facility")}-${index}`} className="py-2"><p className="text-[9px] font-bold text-slate-300">{wcText(row, "location", "site", "facility") || `Expansion site ${index + 1}`}</p><p className="mt-1 text-[8px] text-slate-700">{[wcNumber(row, "year") || "", value ? wcMoney(value) : ""].filter(Boolean).join(" · ") || "No year/value reported"}</p></div>; })}{!selectedExpansions.length ? <p className="py-2 text-[9px] text-slate-600">No expansion rows.</p> : null}</div></div>
                <div className="mt-4 border-t border-white/8 pt-4"><p className="text-[10px] font-black text-slate-300">Mapped installations</p><div className="mt-2 divide-y divide-white/[.055]">{selectedBases.slice(0, 8).map((row, index) => <div key={`${wcText(row, "name", "baseName", "installation")}-${index}`} className="py-2"><p className="text-[9px] font-bold text-slate-300">{wcText(row, "name", "baseName", "installation", "site", "facility") || `Installation ${index + 1}`}</p><p className="mt-1 text-[8px] text-slate-700">{wcText(row, "city", "location", "state", "type", "status") || "Site detail not reported"}</p></div>)}</div></div>
              </> : null}
            </aside>
          </div>
        </section>

        <section className="mt-5 border border-white/10 bg-[#080c12]">
          <header className="grid border-b border-white/10 lg:grid-cols-[1fr_420px] lg:items-center"><div className="p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Contractor context</p><h2 className="mt-1 text-base font-black">Defense contractor directory</h2><p className="mt-1 text-[10px] leading-5 text-slate-600">Always visible because contractor names can help identify possible clients, incumbents, competitors, or operating footprints. Validate current relationship and geography before action.</p></div><label className="m-4 flex min-h-10 items-center gap-2 border border-white/10 bg-black/20 px-3"><Search size={13} className="text-slate-600" /><input value={contractorQuery} onChange={(event) => setContractorQuery(event.target.value)} placeholder="Contractor, country, sector…" className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-600" /><span className="text-[9px] font-black text-slate-600">{visibleContractors.length}</span></label></header>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-white/[.055]">{visibleContractors.slice(0, 240).map((row, index) => { const name = wcText(row, "name", "contractor", "company", "recipient") || `Contractor ${index + 1}`; return <article key={`${name}-${index}`} className="grid gap-2 px-4 py-3 md:grid-cols-[1.3fr_1fr_1fr_1.5fr]"><strong className="text-[11px] text-slate-100">{name}</strong><span className="text-[10px] text-slate-500">{wcText(row, "country", "location", "headquarters") || "Location not reported"}</span><span className="text-[10px] text-slate-500">{wcText(row, "sector", "industry", "category") || "Defense contractor"}</span><span className="text-[9px] leading-4 text-slate-600">Entity/opportunity context only; no active Occu-Med relationship is inferred.</span></article>; })}</div>
        </section>
      </>}
    </section>
  </main>;
}
