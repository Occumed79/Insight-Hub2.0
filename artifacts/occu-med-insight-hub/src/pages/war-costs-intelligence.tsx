import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Anchor, Building2, Database, Loader2, MapPinned, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { wcMoney, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

type DefensePresence = { ok: boolean; partial?: boolean; latestYear?: number | null; current?: WarCostsRow[]; construction?: WarCostsRow[]; warnings?: string[] };
type CountryRow = { country: string; personnel: number; installations: number; expansions: number; expansionValue: number; instability: number; naval: number; casualtySignal: number };
type DatasetKey = "base-index.json" | "contractors.json" | "conflicts.json" | "drone-strikes.json" | "operations.json" | "overseas-presence.json";

const DATASETS: DatasetKey[] = ["base-index.json", "contractors.json", "conflicts.json", "drone-strikes.json", "operations.json", "overseas-presence.json"];

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

function country(row: WarCostsRow): string {
  const countries = Array.isArray(row.countries) ? row.countries.find((value): value is string => typeof value === "string" && Boolean(value.trim())) : "";
  return countries || wcText(row, "country", "countryName", "hostCountry", "targetCountry", "location", "region") || "Unknown";
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="border-r border-white/8 px-4 py-3 last:border-r-0"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1.5 text-xl font-black text-white">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{note}</p></div>;
}

function SignalRow({ icon, title, meta }: { icon: React.ReactNode; title: string; meta: string }) {
  return <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-3 border-b border-white/[.055] py-3 last:border-b-0"><span className="mt-0.5 text-slate-500">{icon}</span><div><p className="text-[11px] font-bold leading-4 text-slate-200">{title}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{meta}</p></div></div>;
}

export default function WarCostsIntelligence() {
  const [responses, setResponses] = useState<Partial<Record<DatasetKey, WarCostsDatasetResponse>>>({});
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
      const [entries, defense] = await Promise.all([
        Promise.all(DATASETS.map(async (name) => [name, await getWarCostsDataset(name, force).catch(() => null)] as const)),
        getDefensePresence(force).catch((reason) => ({ ok: false, partial: true, current: [], construction: [], warnings: [reason instanceof Error ? reason.message : "Defense-presence feed failed."] } as DefensePresence)),
      ]);
      const next: Partial<Record<DatasetKey, WarCostsDatasetResponse>> = {};
      entries.forEach(([name, response]) => { if (response) next[name] = response; });
      setResponses(next);
      setDefensePresence(defense);
      const missing = entries.filter(([, response]) => !response).map(([name]) => name);
      const warnings = [missing.length ? `Unavailable approved feeds: ${missing.join(", ")}.` : "", ...(defense.warnings || [])].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  const installations = useMemo(() => wcRows(responses["base-index.json"]?.data), [responses]);
  const contractors = useMemo(() => wcRows(responses["contractors.json"]?.data), [responses]);
  const conflicts = useMemo(() => wcRows(responses["conflicts.json"]?.data), [responses]);
  const strikes = useMemo(() => wcRows(responses["drone-strikes.json"]?.data), [responses]);
  const naval = useMemo(() => [...wcRows(responses["operations.json"]?.data), ...wcRows(responses["overseas-presence.json"]?.data)], [responses]);
  const personnel = defensePresence?.current || [];
  const construction = defensePresence?.construction || [];

  const countryRows = useMemo<CountryRow[]>(() => {
    const map = new Map<string, CountryRow>();
    const get = (name: string) => {
      const item = map.get(name) || { country: name, personnel: 0, installations: 0, expansions: 0, expansionValue: 0, instability: 0, naval: 0, casualtySignal: 0 };
      map.set(name, item);
      return item;
    };
    personnel.forEach((row) => { const name = country(row); if (name !== "Unknown") get(name).personnel = Math.max(get(name).personnel, wcNumber(row, "personnel", "troops")); });
    installations.forEach((row) => { const name = country(row); if (name !== "Unknown") get(name).installations += 1; });
    construction.forEach((row) => { const name = country(row); if (name !== "Unknown") { const item = get(name); item.expansions += 1; item.expansionValue += wcNumber(row, "spending", "amount", "cost", "total"); } });
    [...conflicts, ...strikes].forEach((row) => { const name = country(row); if (name !== "Unknown") { const item = get(name); item.instability += 1; item.casualtySignal = Math.max(item.casualtySignal, wcNumber(row, "civilianDeaths", "civilianCasualties", "deaths", "fatalities")); } });
    naval.forEach((row) => { const name = country(row); if (name !== "Unknown") get(name).naval += 1; });
    return [...map.values()].sort((a, b) => b.personnel - a.personnel || b.installations - a.installations || b.expansions - a.expansions || b.instability - a.instability);
  }, [conflicts, construction, installations, naval, personnel, strikes]);

  useEffect(() => {
    if (!selectedCountry && countryRows[0]) setSelectedCountry(countryRows[0].country);
    else if (selectedCountry && countryRows.length && !countryRows.some((item) => item.country === selectedCountry)) setSelectedCountry(countryRows[0].country);
  }, [countryRows, selectedCountry]);

  const visibleCountries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? countryRows.filter((item) => item.country.toLowerCase().includes(needle)) : countryRows;
  }, [countryRows, query]);

  const selected = countryRows.find((item) => item.country === selectedCountry) || countryRows[0] || null;
  const selectedInstallations = useMemo(() => installations.filter((row) => country(row) === selected?.country).slice(0, 24), [installations, selected?.country]);
  const selectedConstruction = useMemo(() => construction.filter((row) => country(row) === selected?.country).sort((a, b) => wcNumber(b, "year") - wcNumber(a, "year")).slice(0, 12), [construction, selected?.country]);
  const selectedInstability = useMemo(() => [...conflicts, ...strikes].filter((row) => country(row) === selected?.country).slice(0, 16), [conflicts, selected?.country, strikes]);
  const selectedNaval = useMemo(() => naval.filter((row) => country(row) === selected?.country).slice(0, 12), [naval, selected?.country]);
  const selectedContractors = useMemo(() => selected?.country ? contractors.filter((row) => JSON.stringify(row).toLowerCase().includes(selected.country.toLowerCase())).slice(0, 14) : [], [contractors, selected?.country]);
  const rank = selected ? countryRows.findIndex((item) => item.country === selected.country) + 1 : 0;

  return <main className="min-h-screen bg-[#05080c] pb-24 text-white">
    <Sidebar />
    <section className="px-5 py-8 lg:ml-[210px] lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Occu-Med · Defense intelligence" title="Defense Medical Support Intelligence" subtitle="A country-first operational board combining installations, personnel posture, construction, instability, naval deployments, and contractor context. Instability folds conflict, drone/strike activity, and civilian-casualty signals into one operating-environment dimension." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.07] px-4 text-xs font-bold disabled:opacity-45"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button></div>
      <WarCostsWorkspaceNav />
      {error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs leading-5 text-amber-100/75">{error}</div> : null}

      {loading ? <div className="mt-5 grid min-h-[650px] place-items-center border border-white/10 bg-[#080c12]"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-slate-500">Loading approved defense context…</p></div></div> : <>
        <section className="mt-5 grid border border-white/10 bg-[#080c12] sm:grid-cols-3 xl:grid-cols-6"><Stat label="Installations" value={installations.length.toLocaleString()} note="Mapped defense sites" /><Stat label="Personnel countries" value={personnel.length.toLocaleString()} note={defensePresence?.latestYear ? `Posture · ${defensePresence.latestYear}` : "Country-level posture"} /><Stat label="Expansion sites" value={construction.length.toLocaleString()} note="Construction / facilities" /><Stat label="Instability" value={(conflicts.length + strikes.length).toLocaleString()} note="Conflict + strike records" /><Stat label="Naval" value={naval.length.toLocaleString()} note="Sanitized maritime rows" /><Stat label="Contractors" value={contractors.length.toLocaleString()} note="Entity context" /></section>

        <div className="mt-5 grid min-h-[780px] overflow-hidden border border-white/10 bg-[#070b10] xl:grid-cols-[275px_minmax(0,1fr)_340px]">
          <aside className="border-r border-white/10 bg-[#080c12]" aria-label="Country intelligence list">
            <div className="border-b border-white/10 p-3"><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Country footprint</p><label className="mt-3 flex min-h-10 items-center gap-2 border border-white/10 bg-black/20 px-3"><Search size={13} className="text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter countries…" className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-600" /><span className="text-[9px] font-black text-slate-600">{visibleCountries.length}</span></label></div>
            <div className="max-h-[780px] overflow-y-auto divide-y divide-white/[.055]">{visibleCountries.map((item) => <button key={item.country} type="button" onClick={() => setSelectedCountry(item.country)} className={`w-full px-3 py-3 text-left transition ${selected?.country === item.country ? "bg-cyan-300/[.06] shadow-[inset_2px_0_0_rgba(103,232,249,.7)]" : "hover:bg-white/[.02]"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black text-white">{item.country}</p><p className="mt-1 text-[9px] text-slate-600">{item.installations} sites · {item.expansions} expansion · {item.instability} instability · {item.naval} naval</p></div><span className="text-[10px] font-black text-slate-400">{item.personnel ? item.personnel.toLocaleString() : "—"}</span></div></button>)}</div>
          </aside>

          <section className="min-w-0 bg-[#05090e]">
            {selected ? <>
              <header className="border-b border-white/10 px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Selected operating country</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-white">{selected.country}</h2><p className="mt-2 max-w-3xl text-[11px] leading-5 text-slate-500">Read the dimensions separately: footprint indicates scale, construction indicates change, instability indicates operating friction, and naval posture indicates regional tempo. None is converted into a fabricated Occu-Med demand score.</p></div><div className="text-right"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Footprint rank</p><p className="mt-1 text-xl font-black text-cyan-100/80">#{rank || "—"}</p></div></div></header>
              <div className="grid border-b border-white/10 sm:grid-cols-3 xl:grid-cols-6"><Stat label="Personnel" value={selected.personnel ? selected.personnel.toLocaleString() : "—"} note="Context only" /><Stat label="Installations" value={selected.installations.toLocaleString()} note="Mapped sites" /><Stat label="Expansion" value={selected.expansions.toLocaleString()} note={selected.expansionValue ? wcMoney(selected.expansionValue) : "No value"} /><Stat label="Instability" value={selected.instability.toLocaleString()} note="Combined signals" /><Stat label="Civilian signal" value={selected.casualtySignal ? selected.casualtySignal.toLocaleString() : "—"} note="Source-reported max" /><Stat label="Naval" value={selected.naval.toLocaleString()} note="Deployment rows" /></div>
              <div className="grid 2xl:grid-cols-2">
                <section className="border-r border-white/10 p-5"><div className="flex items-center gap-2"><Building2 size={15} className="text-cyan-200/55" /><h3 className="text-sm font-black">Installations & expansion</h3></div><div className="mt-3">{selectedInstallations.length ? selectedInstallations.map((row, index) => <SignalRow key={`base-${index}`} icon={<MapPinned size={13} />} title={wcText(row, "name", "baseName", "installation", "site", "facility") || `Installation ${index + 1}`} meta={[wcText(row, "city", "location", "state"), wcText(row, "type", "status")].filter(Boolean).join(" · ") || "Mapped installation"} />) : <p className="py-5 text-[10px] text-slate-600">No installation rows for this country.</p>}</div>{selectedConstruction.length ? <div className="mt-5 border-t border-white/8 pt-3">{selectedConstruction.map((row, index) => <SignalRow key={`construction-${index}`} icon={<Building2 size={13} />} title={wcText(row, "location", "site", "facility") || `Expansion site ${index + 1}`} meta={[wcNumber(row, "year") || "", wcNumber(row, "spending", "amount", "cost", "total") ? wcMoney(wcNumber(row, "spending", "amount", "cost", "total")) : ""].filter(Boolean).join(" · ") || "Construction record"} />)}</div> : null}</section>
                <section className="p-5"><div className="flex items-center gap-2"><AlertTriangle size={15} className="text-rose-200/60" /><h3 className="text-sm font-black">Operating environment</h3></div><div className="mt-3">{selectedInstability.length ? selectedInstability.map((row, index) => <SignalRow key={`instability-${index}`} icon={<AlertTriangle size={13} />} title={wcText(row, "name", "title", "conflict", "event") || `Instability signal ${index + 1}`} meta={[wcText(row, "status", "date"), wcNumber(row, "civilianDeaths", "civilianCasualties", "deaths") ? `${wcNumber(row, "civilianDeaths", "civilianCasualties", "deaths").toLocaleString()} casualty signal` : ""].filter(Boolean).join(" · ") || "Conflict / strike context"} />) : <p className="py-5 text-[10px] text-slate-600">No retained instability rows for this country.</p>}</div>{selectedNaval.length ? <div className="mt-5 border-t border-white/8 pt-3"><div className="mb-1 flex items-center gap-2"><Anchor size={13} className="text-blue-200/60" /><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Naval posture</p></div>{selectedNaval.map((row, index) => <SignalRow key={`naval-${index}`} icon={<Anchor size={13} />} title={wcText(row, "name", "title", "operation", "deployment") || `Naval deployment ${index + 1}`} meta={[wcText(row, "location", "region", "aor"), wcNumber(row, "year") || wcText(row, "status")].filter(Boolean).join(" · ") || "Maritime deployment context"} />)}</div> : null}</section>
              </div>
            </> : null}
          </section>

          <aside className="border-l border-white/10 bg-[#080c12] p-4">
            <div className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-200/60" /><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Source state</p><p className="text-[11px] font-black text-slate-300">Approved intelligence boundary</p></div></div>
            <div className="mt-3 divide-y divide-white/[.055]">{DATASETS.map((name) => <div key={name} className="flex items-center justify-between gap-3 py-3"><div><p className="text-[10px] font-bold text-slate-300">{name}</p><p className="mt-1 text-[9px] text-slate-600">{responses[name]?.category || "Approved defense feed"}</p></div><span className={`text-[9px] font-black uppercase ${responses[name] ? "text-emerald-200/70" : "text-rose-200/70"}`}>{responses[name] ? "Live" : "Unavailable"}</span></div>)}</div>
            <div className="mt-6 border-t border-white/8 pt-4"><div className="flex items-center gap-2"><Database size={13} className="text-slate-500" /><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Contractor signals in {selected?.country || "selection"}</p></div><div className="mt-2 divide-y divide-white/[.055]">{selectedContractors.length ? selectedContractors.map((row, index) => <div key={`${wcText(row, "name")}-${index}`} className="py-3"><p className="text-[10px] font-bold text-slate-300">{wcText(row, "name", "company", "recipient") || `Contractor ${index + 1}`}</p><p className="mt-1 text-[9px] text-slate-600">Possible entity context only — verify actual operating relationship.</p></div>) : <p className="py-4 text-[10px] leading-5 text-slate-600">No contractor row explicitly references this country.</p>}</div></div>
          </aside>
        </div>
      </>}
    </section>
  </main>;
}
