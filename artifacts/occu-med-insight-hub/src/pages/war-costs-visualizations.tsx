import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, MapPinned, RefreshCw, TrendingUp, Users } from "lucide-react";
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

type CountryPoint = {
  name: string;
  personnel: number;
  installations: number;
  expansionSites: number;
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

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return Math.round(value).toLocaleString();
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
  return <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-4"><div className="flex items-center gap-2"><TrendingUp size={15} className="text-amber-200/65" /><div><h2 className="text-sm font-black text-white">Site expansion timeline</h2><p className="mt-1 text-[10px] text-slate-600">Construction records by year; emerging-location context, not an Occu-Med demand forecast.</p></div></div></header><div className="overflow-x-auto p-4"><div className="flex min-w-[820px] items-end gap-2 border-b border-white/10 pb-3">{points.map((item) => <div key={item.year} className="flex min-w-[46px] flex-1 flex-col items-center justify-end"><div title={`${item.sites} site${item.sites === 1 ? "" : "s"}${item.value ? ` · ${wcMoney(item.value)}` : ""}`} className="w-full bg-amber-200/50" style={{ height: `${Math.max(7, item.sites / maxSites * 155)}px` }} /><span className="mt-2 text-[8px] text-slate-600">{item.year}</span><span className="mt-1 text-[9px] font-black text-slate-400">{item.sites}</span></div>)}</div></div></section>;
}

function FootprintMatrix({ rows, selected, onSelect }: { rows: CountryPoint[]; selected: string; onSelect: (name: string) => void }) {
  const plot = rows.slice(0, 45);
  const xValues = plot.map((item) => Math.log10(item.personnel + 1));
  const maxX = Math.max(...xValues, 1);
  const maxY = Math.max(...plot.map((item) => item.installations), 1);
  const maxExpansion = Math.max(...plot.map((item) => item.expansionSites), 1);
  const x = (value: number) => 75 + (Math.log10(value + 1) / maxX) * 825;
  const y = (value: number) => 440 - (value / maxY) * 350;
  const radius = (value: number) => value ? 5 + Math.sqrt(value / maxExpansion) * 15 : 4;
  const yTicks = [0, .25, .5, .75, 1].map((fraction) => Math.round(maxY * fraction));
  const xTicks = [10, 100, 1_000, 10_000, 100_000, 1_000_000].filter((value) => Math.log10(value + 1) <= maxX * 1.04);

  return <div className="relative min-h-[520px] overflow-hidden border border-white/10 bg-[#05090e]">
    <div className="absolute left-4 top-3 z-10"><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Footprint matrix</p><p className="mt-1 text-[10px] text-slate-500">X: personnel context · Y: mapped installations · bubble: expansion-site count</p></div>
    <svg viewBox="0 0 1000 500" className="h-[520px] w-full" role="img" aria-label="Defense medical-support country footprint matrix">
      <defs><filter id="pointGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {yTicks.map((value) => { const py = y(value); return <g key={`y-${value}`}><line x1="75" x2="920" y1={py} y2={py} stroke="rgba(148,163,184,.10)" strokeWidth="1" /><text x="60" y={py + 4} textAnchor="end" fill="rgba(148,163,184,.5)" fontSize="10">{value}</text></g>; })}
      {xTicks.map((value) => { const px = x(value); return <g key={`x-${value}`}><line x1={px} x2={px} y1="80" y2="440" stroke="rgba(148,163,184,.07)" strokeWidth="1" /><text x={px} y="462" textAnchor="middle" fill="rgba(148,163,184,.5)" fontSize="10">{compact(value)}</text></g>; })}
      <text x="500" y="487" textAnchor="middle" fill="rgba(148,163,184,.45)" fontSize="10">Country-level personnel footprint — context only, not contractor volume</text>
      <text transform="translate(18 270) rotate(-90)" textAnchor="middle" fill="rgba(148,163,184,.45)" fontSize="10">Mapped defense installations</text>
      {plot.map((item, index) => {
        const px = x(item.personnel); const py = y(item.installations); const r = radius(item.expansionSites); const active = selected === item.name; const label = active || index < 14;
        return <g key={item.name} role="button" tabIndex={0} aria-label={`Select ${item.name}`} onClick={() => onSelect(item.name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(item.name); }} className="cursor-pointer outline-none">
          {active ? <circle cx={px} cy={py} r={r + 7} fill="rgba(103,232,249,.08)" stroke="rgba(103,232,249,.22)" strokeWidth="2" filter="url(#pointGlow)" /> : null}
          <circle cx={px} cy={py} r={r} fill={item.expansionSites ? "rgba(251,191,36,.62)" : "rgba(103,232,249,.56)"} stroke={active ? "rgba(236,254,255,.98)" : "rgba(207,250,254,.5)"} strokeWidth={active ? 2 : 1} />
          {label ? <text x={px + r + 5} y={py + 3} fill={active ? "rgba(255,255,255,.98)" : "rgba(226,232,240,.65)"} fontSize={active ? 11 : 9} fontWeight={active ? 700 : 500}>{item.name}</text> : null}
          <title>{`${item.name}\nPersonnel: ${item.personnel.toLocaleString()}\nInstallations: ${item.installations}\nExpansion sites: ${item.expansionSites}${item.expansionValue ? `\nExpansion value: ${wcMoney(item.expansionValue)}` : ""}`}</title>
        </g>;
      })}
    </svg>
  </div>;
}

export default function WarCostsVisualizations() {
  const [installationResponse, setInstallationResponse] = useState<WarCostsDatasetResponse | null>(null);
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");

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

  const points = useMemo<CountryPoint[]>(() => {
    const map = new Map<string, CountryPoint>();
    const get = (name: string) => { const item = map.get(name) || { name, personnel: 0, installations: 0, expansionSites: 0, expansionValue: 0 }; map.set(name, item); return item; };
    (defensePresence?.current || []).forEach((row) => { const name = country(row); if (name !== "Unknown") get(name).personnel = Math.max(get(name).personnel, wcNumber(row, "personnel", "troops")); });
    installations.forEach((row) => { const name = country(row); if (name !== "Unknown") get(name).installations += 1; });
    (defensePresence?.construction || []).forEach((row) => { const name = country(row); if (name === "Unknown") return; const item = get(name); item.expansionSites += 1; item.expansionValue += wcNumber(row, "spending", "amount", "cost", "total"); });
    return [...map.values()].sort((a, b) => b.personnel - a.personnel || b.installations - a.installations || b.expansionSites - a.expansionSites);
  }, [defensePresence?.construction, defensePresence?.current, installations]);

  useEffect(() => { if (!selectedCountry && points[0]) setSelectedCountry(points[0].name); }, [points, selectedCountry]);
  const selected = points.find((item) => item.name === selectedCountry) || points[0] || null;
  const byExpansion = useMemo(() => [...points].sort((a, b) => b.expansionSites - a.expansionSites || b.expansionValue - a.expansionValue).slice(0, 18), [points]);
  const byInstallations = useMemo(() => [...points].sort((a, b) => b.installations - a.installations || b.personnel - a.personnel).slice(0, 18), [points]);

  return <main className="min-h-screen bg-[#05080c] pb-24 text-white">
    <Sidebar />
    <section className="px-5 py-8 lg:ml-[210px] lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Occu-Med · Defense network planning" title="Footprint Visualizations" subtitle="An interactive planning matrix for the defense context that can support provider-network, client, and expansion decisions. Personnel, installations, and construction stay separate evidence dimensions rather than being collapsed into a fabricated score." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.07] px-4 text-xs font-bold disabled:opacity-45"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh</button></div>
      <WarCostsWorkspaceNav />
      {error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs text-amber-100/75">{error}</div> : null}
      <div className="mt-5">{loading ? <div className="grid min-h-[650px] place-items-center border border-white/10 bg-[#080c12]"><Loader2 className="animate-spin text-cyan-200" /></div> : <>
        <div className="grid min-h-[520px] overflow-hidden border border-white/10 bg-[#070b10] 2xl:grid-cols-[minmax(0,1fr)_310px]">
          <FootprintMatrix rows={points} selected={selected?.name || ""} onSelect={setSelectedCountry} />
          <aside className="border-l border-white/10 bg-[#080c12] p-4">
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Selected country</p><h2 className="mt-1 text-xl font-black text-white">{selected?.name || "No data"}</h2>
            {selected ? <>
              <div className="mt-4 grid grid-cols-2 gap-px bg-white/8"><div className="bg-[#080c12] p-3"><Users size={13} className="text-cyan-200/55" /><p className="mt-2 text-[9px] uppercase tracking-[.1em] text-slate-600">Personnel</p><p className="mt-1 text-lg font-black">{selected.personnel ? selected.personnel.toLocaleString() : "—"}</p></div><div className="bg-[#080c12] p-3"><Building2 size={13} className="text-cyan-200/55" /><p className="mt-2 text-[9px] uppercase tracking-[.1em] text-slate-600">Installations</p><p className="mt-1 text-lg font-black">{selected.installations}</p></div><div className="bg-[#080c12] p-3"><MapPinned size={13} className="text-amber-200/55" /><p className="mt-2 text-[9px] uppercase tracking-[.1em] text-slate-600">Expansion sites</p><p className="mt-1 text-lg font-black">{selected.expansionSites}</p></div><div className="bg-[#080c12] p-3"><TrendingUp size={13} className="text-amber-200/55" /><p className="mt-2 text-[9px] uppercase tracking-[.1em] text-slate-600">Expansion value</p><p className="mt-1 text-lg font-black">{selected.expansionValue ? wcMoney(selected.expansionValue) : "—"}</p></div></div>
              <div className="mt-4 border-t border-white/8 pt-4"><p className="text-[10px] font-black text-slate-300">Planning interpretation</p><p className="mt-2 text-[9px] leading-5 text-slate-600">{selected.expansionSites ? "Expansion evidence makes this a candidate for an early fixed-provider capacity review. Confirm contractor/client footprint before treating it as an opportunity." : selected.installations ? "Existing installation concentration supports a provider-network coverage review around duty locations." : "Country-level personnel context alone does not establish a provider need."}</p></div>
              <p className="mt-4 border-t border-white/8 pt-4 text-[8px] leading-4 text-slate-700">Bubble size represents expansion-site count only. Personnel counts do not equal contractor staffing or Occu-Med referral volume.</p>
            </> : null}
          </aside>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-4"><h2 className="text-sm font-black">Expansion concentration</h2><p className="mt-1 text-[10px] text-slate-600">Countries with the most construction / new-facility records.</p></header><div className="divide-y divide-white/[.055]">{byExpansion.map((item) => <button type="button" key={item.name} onClick={() => setSelectedCountry(item.name)} className="grid w-full grid-cols-[1fr_85px_120px] gap-3 px-4 py-3 text-left hover:bg-white/[.02]"><span className="text-[11px] font-bold text-slate-200">{item.name}</span><span className="text-right text-[10px] font-black text-amber-100/65">{item.expansionSites} sites</span><span className="text-right text-[10px] text-slate-500">{item.expansionValue ? wcMoney(item.expansionValue) : "value not reported"}</span></button>)}</div></section>
          <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-4"><h2 className="text-sm font-black">Installation concentration</h2><p className="mt-1 text-[10px] text-slate-600">Countries with the largest mapped installation footprint.</p></header><div className="divide-y divide-white/[.055]">{byInstallations.map((item) => <button type="button" key={item.name} onClick={() => setSelectedCountry(item.name)} className="grid w-full grid-cols-[1fr_95px_115px] gap-3 px-4 py-3 text-left hover:bg-white/[.02]"><span className="text-[11px] font-bold text-slate-200">{item.name}</span><span className="text-right text-[10px] font-black text-cyan-100/65">{item.installations} sites</span><span className="text-right text-[10px] text-slate-500">{item.personnel ? `${compact(item.personnel)} personnel` : "personnel —"}</span></button>)}</div></section>
        </div>

        <div className="mt-5"><ExpansionTimeline rows={defensePresence?.construction || []} /></div>
      </>}</div>
    </section>
  </main>;
}
