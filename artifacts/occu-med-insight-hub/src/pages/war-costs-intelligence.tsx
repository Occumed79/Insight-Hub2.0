import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, MapPinned, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
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

type CountryRow = {
  country: string;
  personnel: number;
  installations: number;
  expansions: number;
  expansionValue: number;
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

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="border-r border-white/8 px-4 py-3 last:border-r-0"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1.5 text-xl font-black text-white">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{note}</p></div>;
}

function EvidenceState({ label, available, note }: { label: string; available: boolean; note: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-white/[.055] py-3 last:border-b-0"><div><p className="text-[10px] font-bold text-slate-300">{label}</p><p className="mt-1 text-[9px] text-slate-600">{note}</p></div><span className={`shrink-0 text-[9px] font-black uppercase tracking-[.1em] ${available ? "text-emerald-200/75" : "text-rose-200/75"}`}>{available ? "Available" : "Unavailable"}</span></div>;
}

export default function WarCostsIntelligence() {
  const [installationResponse, setInstallationResponse] = useState<WarCostsDatasetResponse | null>(null);
  const [contractorResponse, setContractorResponse] = useState<WarCostsDatasetResponse | null>(null);
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");

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

  const countryRows = useMemo<CountryRow[]>(() => {
    const map = new Map<string, CountryRow>();
    const get = (name: string) => {
      const current = map.get(name) || { country: name, personnel: 0, installations: 0, expansions: 0, expansionValue: 0 };
      map.set(name, current);
      return current;
    };
    personnel.forEach((row) => { const name = country(row); if (name !== "Unknown") get(name).personnel = Math.max(get(name).personnel, wcNumber(row, "personnel", "troops")); });
    installations.forEach((row) => { const name = country(row); if (name !== "Unknown") get(name).installations += 1; });
    construction.forEach((row) => { const name = country(row); if (name !== "Unknown") { const item = get(name); item.expansions += 1; item.expansionValue += wcNumber(row, "spending", "amount", "cost", "total"); } });
    return [...map.values()].sort((a, b) => b.personnel - a.personnel || b.expansions - a.expansions || b.installations - a.installations);
  }, [construction, installations, personnel]);

  useEffect(() => {
    if (!selectedCountry && countryRows[0]) setSelectedCountry(countryRows[0].country);
    else if (selectedCountry && countryRows.length && !countryRows.some((item) => item.country === selectedCountry)) setSelectedCountry(countryRows[0].country);
  }, [countryRows, selectedCountry]);

  const visibleCountries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? countryRows.filter((item) => item.country.toLowerCase().includes(needle)) : countryRows;
  }, [countryRows, query]);

  const selected = countryRows.find((item) => item.country === selectedCountry) || countryRows[0] || null;
  const selectedInstallations = useMemo(() => installations.filter((row) => country(row) === selected?.country), [installations, selected?.country]);
  const selectedConstruction = useMemo(() => construction.filter((row) => country(row) === selected?.country).sort((a, b) => wcNumber(b, "year") - wcNumber(a, "year") || wcNumber(b, "spending", "amount", "cost", "total") - wcNumber(a, "spending", "amount", "cost", "total")), [construction, selected?.country]);
  const selectedPersonnel = useMemo(() => personnel.find((row) => country(row) === selected?.country) || null, [personnel, selected?.country]);
  const selectedContractors = useMemo(() => {
    if (!selected?.country) return [];
    const needle = selected.country.toLowerCase();
    return contractors.filter((row) => JSON.stringify(row).toLowerCase().includes(needle)).slice(0, 20);
  }, [contractors, selected?.country]);
  const rank = selected ? countryRows.findIndex((item) => item.country === selected.country) + 1 : 0;

  return <main className="min-h-screen bg-[#05080c] pb-24 text-white">
    <Sidebar />
    <section className="px-5 py-8 lg:ml-[210px] lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <HeaderBar eyebrow="Occu-Med · Defense network planning" title="Defense Medical Support Intelligence" subtitle="A country-first situation board for installations, personnel footprint, site expansion, and contractor context that can drive provider-network and medical-support research. Generic war intelligence is excluded." />
        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.07] px-4 text-xs font-bold disabled:opacity-45"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button>
      </div>
      <WarCostsWorkspaceNav />
      {error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs leading-5 text-amber-100/75">{error}</div> : null}

      {loading ? <div className="mt-5 grid min-h-[650px] place-items-center border border-white/10 bg-[#080c12]"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-slate-500">Loading Occu-Med-relevant defense context…</p></div></div> : <>
        <section className="mt-5 grid border border-white/10 bg-[#080c12] sm:grid-cols-2 xl:grid-cols-4"><Stat label="Mapped installations" value={installations.length.toLocaleString()} note="Defense sites available for network context" /><Stat label="Personnel countries" value={personnel.length.toLocaleString()} note={defensePresence?.latestYear ? `Country-level rows · ${defensePresence.latestYear}` : "Country-level source rows"} /><Stat label="Expansion sites" value={construction.length.toLocaleString()} note="Construction / new-facility records" /><Stat label="Contractor records" value={contractors.length.toLocaleString()} note="Entity/opportunity context only" /></section>

        <div className="mt-5 grid min-h-[760px] overflow-hidden border border-white/10 bg-[#070b10] xl:grid-cols-[265px_minmax(0,1fr)_330px]">
          <aside className="border-r border-white/10 bg-[#080c12]" aria-label="Country network-priority list">
            <div className="border-b border-white/10 p-3">
              <p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Country footprint</p>
              <label className="mt-3 flex min-h-10 items-center gap-2 border border-white/10 bg-black/20 px-3"><Search size={13} className="text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter countries…" className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-600" /><span className="text-[9px] font-black text-slate-600">{visibleCountries.length}</span></label>
            </div>
            <div className="max-h-[760px] overflow-y-auto divide-y divide-white/[.055]">{visibleCountries.map((item) => <button key={item.country} type="button" onClick={() => setSelectedCountry(item.country)} className={`w-full px-3 py-3 text-left transition ${selected?.country === item.country ? "bg-cyan-300/[.06] shadow-[inset_2px_0_0_rgba(103,232,249,.7)]" : "hover:bg-white/[.02]"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black text-white">{item.country}</p><p className="mt-1 text-[9px] text-slate-600">{item.installations} installation{item.installations === 1 ? "" : "s"} · {item.expansions} expansion site{item.expansions === 1 ? "" : "s"}</p></div><span className="text-[10px] font-black text-slate-400">{item.personnel ? item.personnel.toLocaleString() : "—"}</span></div></button>)}</div>
          </aside>

          <section className="min-w-0 bg-[#05090e]">
            {selected ? <>
              <header className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Selected operating country</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-white">{selected.country}</h2><p className="mt-2 max-w-3xl text-[11px] leading-5 text-slate-500">Use this footprint to decide where to investigate fixed-clinic depth, medical-service coverage, contractor operating locations, and recruitment timing. No demand score is inferred from personnel counts.</p></div><div className="text-right"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Footprint rank</p><p className="mt-1 text-xl font-black text-cyan-100/80">#{rank || "—"}</p></div></div>
              </header>

              <div className="grid border-b border-white/10 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Personnel" value={selected.personnel ? selected.personnel.toLocaleString() : "—"} note="Context, not contractor volume" /><Stat label="Installations" value={selected.installations.toLocaleString()} note="Mapped sites in this country" /><Stat label="Expansion sites" value={selected.expansions.toLocaleString()} note="Potential emerging locations" /><Stat label="Expansion value" value={selected.expansionValue ? wcMoney(selected.expansionValue) : "—"} note="Construction source value" /></div>

              <div className="grid gap-0 2xl:grid-cols-[1.15fr_.85fr]">
                <section className="border-r border-white/10 p-5">
                  <div className="flex items-center gap-2"><Building2 size={15} className="text-cyan-200/55" /><h3 className="text-sm font-black">Installation footprint</h3></div>
                  <div className="mt-3 divide-y divide-white/[.055]">{selectedInstallations.length ? selectedInstallations.slice(0, 30).map((row, index) => <div key={`${wcText(row, "name", "baseName", "installation")}-${index}`} className="py-3"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black text-slate-100">{wcText(row, "name", "baseName", "installation", "site", "facility") || `Installation ${index + 1}`}</p><p className="mt-1 text-[9px] text-slate-600">{[wcText(row, "city", "location", "state"), wcText(row, "type", "baseType", "category"), wcText(row, "status")].filter(Boolean).join(" · ") || "Location details not reported"}</p></div><span className="text-[9px] font-bold text-slate-500">{wcNumber(row, "personnel", "troops") ? `${wcNumber(row, "personnel", "troops").toLocaleString()} personnel` : ""}</span></div></div>) : <p className="py-6 text-[10px] text-slate-600">No mapped installation row for this country.</p>}</div>
                </section>

                <section className="p-5">
                  <div className="flex items-center gap-2"><Users size={15} className="text-cyan-200/55" /><h3 className="text-sm font-black">Personnel composition</h3></div>
                  {selectedPersonnel ? <div className="mt-4 grid grid-cols-2 gap-px bg-white/8">{[["Army", wcNumber(selectedPersonnel, "army")], ["Navy", wcNumber(selectedPersonnel, "navy")], ["Air Force", wcNumber(selectedPersonnel, "airForce", "air_force")], ["Marines", wcNumber(selectedPersonnel, "marines", "marineCorps")]].map(([label, value]) => <div key={String(label)} className="bg-[#05090e] p-3"><p className="text-[9px] uppercase tracking-[.12em] text-slate-600">{label}</p><p className="mt-1 text-lg font-black text-slate-200">{Number(value) ? Number(value).toLocaleString() : "—"}</p></div>)}</div> : <p className="mt-4 text-[10px] text-slate-600">No personnel composition row is available.</p>}
                  <div className="mt-5 flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-200/55" /><h3 className="text-sm font-black">Medical-network actions</h3></div>
                  <div className="mt-3 divide-y divide-white/[.055] text-[10px] leading-5 text-slate-500"><p className="py-2">Map fixed clinics near likely contractor duty locations.</p><p className="py-2">Verify physical exams, labs, ECG, vision and baseline diagnostic capability.</p><p className="py-2">Check audiology, PFT, X-ray, treadmill stress testing, dental and vaccination gaps.</p><p className="py-2">Confirm English documentation, referral workflow and invoice compatibility.</p>{selected.expansions ? <p className="py-2 text-amber-100/60">Expansion evidence exists: investigate provider recruitment before staffing reaches steady state.</p> : null}</div>
                </section>
              </div>
            </> : <div className="grid min-h-[680px] place-items-center text-center"><div><MapPinned size={28} className="mx-auto text-slate-700" /><p className="mt-3 text-sm font-black text-slate-400">No country footprint loaded</p></div></div>}
          </section>

          <aside className="border-l border-white/10 bg-[#080c12] p-4" aria-label="Selected-country evidence inspector">
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Evidence inspector</p>
            <h2 className="mt-1 text-lg font-black text-white">{selected?.country || "No selection"}</h2>

            <section className="mt-4 border-t border-white/8 pt-4"><div className="flex items-center gap-2"><MapPinned size={14} className="text-amber-200/55" /><h3 className="text-[11px] font-black">Expansion watch</h3></div><div className="mt-2 divide-y divide-white/[.055]">{selectedConstruction.length ? selectedConstruction.slice(0, 12).map((row, index) => { const value = wcNumber(row, "spending", "amount", "cost", "total"); return <div key={`${wcText(row, "location", "site", "facility")}-${index}`} className="py-3"><p className="text-[10px] font-bold text-slate-200">{wcText(row, "location", "site", "facility") || `Expansion site ${index + 1}`}</p><p className="mt-1 text-[9px] text-slate-600">{[wcNumber(row, "year") || "", value ? wcMoney(value) : ""].filter(Boolean).join(" · ") || "Year/value not reported"}</p></div>; }) : <p className="py-3 text-[10px] text-slate-600">No expansion record for this country.</p>}</div></section>

            <section className="border-t border-white/8 pt-4"><div className="flex items-center gap-2"><Building2 size={14} className="text-cyan-200/55" /><h3 className="text-[11px] font-black">Contractor context</h3></div><p className="mt-2 text-[9px] leading-4 text-slate-600">Rows below merely mention this country in the contractor dataset; they do not establish an active Occu-Med relationship or current staffing.</p><div className="mt-2 divide-y divide-white/[.055]">{selectedContractors.length ? selectedContractors.map((row, index) => <div key={`${wcText(row, "name", "contractor", "company", "recipient")}-${index}`} className="py-3"><p className="text-[10px] font-bold text-slate-200">{wcText(row, "name", "contractor", "company", "recipient") || `Contractor record ${index + 1}`}</p><p className="mt-1 text-[9px] text-slate-600">{wcText(row, "sector", "industry", "category", "location") || "Defense contractor context"}</p></div>) : <p className="py-3 text-[10px] text-slate-600">No contractor row explicitly mentions this country.</p>}</div></section>

            <section className="border-t border-white/8 pt-4"><h3 className="text-[11px] font-black">Source state</h3><div className="mt-1"><EvidenceState label="Installation index" available={Boolean(installationResponse)} note={`${installations.length.toLocaleString()} mapped records`} /><EvidenceState label="Personnel footprint" available={Boolean(defensePresence?.current)} note={defensePresence?.latestYear ? `Dataset year ${defensePresence.latestYear}` : `${personnel.length.toLocaleString()} country rows`} /><EvidenceState label="Site expansion" available={Boolean(defensePresence?.construction)} note={`${construction.length.toLocaleString()} construction records`} /><EvidenceState label="Contractor context" available={Boolean(contractorResponse)} note={`${contractors.length.toLocaleString()} records`} /></div></section>
          </aside>
        </div>
      </>}
    </section>
  </main>;
}
