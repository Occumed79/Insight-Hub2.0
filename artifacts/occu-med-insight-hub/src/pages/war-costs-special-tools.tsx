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

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

function nation(row: WarCostsRow): string {
  return wcText(row, "country", "countryName", "hostCountry", "location") || "Unknown";
}

function installationName(row: WarCostsRow, index = 0): string {
  return wcText(row, "name", "baseName", "installation", "site", "facility") || `Installation ${index + 1}`;
}

function fact(row: WarCostsRow | null, label: string, keys: string[]) {
  if (!row) return null;
  const value = wcText(row, ...keys);
  return value ? { label, value } : null;
}

const COVERAGE_REVIEW = [
  ["Core examinations", "Physical examinations, vision, ECG and basic diagnostic capability at a fixed clinic."],
  ["Laboratory access", "Routine labs, QFT/specimen handling and dependable result delivery."],
  ["Hearing conservation", "Pure-tone audiometry with occupational baseline/periodic documentation when required."],
  ["Pulmonary capability", "Spirometry/PFT and respirator-related support where job tasks require it."],
  ["Imaging", "Chest X-ray and other common diagnostic imaging without fragmented result handling."],
  ["Cardiac testing", "Treadmill stress testing or cardiology referral capacity when program criteria trigger it."],
  ["Dental", "Fixed dental clinic capable of comprehensive evaluation, bitewings and panoramic imaging."],
  ["Vaccines / travel health", "Routine and travel vaccines with employer/self-pay workflow when deployment support requires them."],
  ["Documentation workflow", "English records, required forms, acceptable turnaround, direct referral and invoice compatibility."],
] as const;

export default function WarCostsSpecialTools() {
  const [installationResponse, setInstallationResponse] = useState<WarCostsDatasetResponse | null>(null);
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState("");

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
  const installations = useMemo(() => wcRows(installationResponse?.data).sort((a, b) => nation(a).localeCompare(nation(b)) || installationName(a).localeCompare(installationName(b))), [installationResponse]);

  const keyedInstallations = useMemo(() => installations.map((row, index) => ({ row, key: `${installationName(row, index)}|${nation(row)}|${index}`, index })), [installations]);
  useEffect(() => {
    if (!selectedKey && keyedInstallations[0]) setSelectedKey(keyedInstallations[0].key);
    else if (selectedKey && keyedInstallations.length && !keyedInstallations.some((item) => item.key === selectedKey)) setSelectedKey(keyedInstallations[0].key);
  }, [keyedInstallations, selectedKey]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? keyedInstallations.filter(({ row }) => JSON.stringify(row).toLowerCase().includes(needle)) : keyedInstallations;
  }, [keyedInstallations, query]);

  const selectedItem = keyedInstallations.find((item) => item.key === selectedKey) || keyedInstallations[0] || null;
  const selected = selectedItem?.row || null;
  const selectedCountry = selected ? nation(selected) : "";
  const personnel = useMemo(() => (defensePresence?.current || []).find((row) => nation(row) === selectedCountry) || null, [defensePresence?.current, selectedCountry]);
  const expansions = useMemo(() => (defensePresence?.construction || []).filter((row) => nation(row) === selectedCountry).sort((a, b) => wcNumber(b, "year") - wcNumber(a, "year") || wcNumber(b, "spending", "amount", "cost", "total") - wcNumber(a, "spending", "amount", "cost", "total")), [defensePresence?.construction, selectedCountry]);
  const countrySites = useMemo(() => installations.filter((row) => nation(row) === selectedCountry), [installations, selectedCountry]);
  const detailFacts = [fact(selected, "City / location", ["city", "location", "state"]), fact(selected, "Installation type", ["type", "baseType", "category"]), fact(selected, "Status", ["status"]), fact(selected, "Service / branch", ["branch", "service", "component"]), fact(selected, "Operator", ["operator", "command", "organization"])].filter((item): item is { label: string; value: string } => Boolean(item));

  return <main className="min-h-screen bg-[#05080c] pb-24 text-white">
    <Sidebar />
    <section className="px-5 py-8 lg:ml-[210px] lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <HeaderBar eyebrow="Occu-Med · Defense network planning" title="Site & Coverage Workbench" subtitle="Select a defense installation, inspect the surrounding country-level footprint, and use the evidence to drive a fixed-provider coverage review. The tool does not invent provider availability or medical demand." />
        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.07] px-4 text-xs font-bold disabled:opacity-45"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh data</button>
      </div>
      <WarCostsWorkspaceNav />
      {error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs text-amber-100/75">{error}</div> : null}

      {loading ? <div className="mt-5 grid min-h-[650px] place-items-center border border-white/10 bg-[#080c12]"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-slate-500">Loading site and personnel context…</p></div></div> : <div className="mt-5 grid min-h-[780px] overflow-hidden border border-white/10 bg-[#070b10] xl:grid-cols-[300px_minmax(0,1fr)_350px]">
        <aside className="border-r border-white/10 bg-[#080c12]" aria-label="Installation directory">
          <div className="border-b border-white/10 p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Installation directory</p><label className="mt-3 flex min-h-10 items-center gap-2 border border-white/10 bg-black/20 px-3"><Search size={13} className="text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Installation, country, city, type…" className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-600" /><span className="text-[9px] font-black text-slate-600">{visible.length}</span></label></div>
          <div className="max-h-[800px] overflow-y-auto divide-y divide-white/[.055]">{visible.map((item) => <button key={item.key} type="button" onClick={() => setSelectedKey(item.key)} className={`w-full px-4 py-3 text-left transition ${selectedItem?.key === item.key ? "bg-cyan-300/[.055] shadow-[inset_2px_0_0_rgba(103,232,249,.7)]" : "hover:bg-white/[.02]"}`}><p className="text-[11px] font-black leading-4 text-white">{installationName(item.row, item.index)}</p><p className="mt-1 text-[9px] text-slate-600">{nation(item.row)}{wcText(item.row, "city", "location", "state") ? ` · ${wcText(item.row, "city", "location", "state")}` : ""}</p><p className="mt-1 text-[9px] text-slate-700">{wcText(item.row, "type", "baseType", "category", "status") || "Installation record"}</p></button>)}</div>
        </aside>

        <section className="min-w-0 bg-[#05090e]">
          {selected ? <>
            <header className="border-b border-white/10 px-5 py-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Selected installation</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-white">{installationName(selected, selectedItem?.index || 0)}</h2><p className="mt-1 text-[11px] text-slate-500">{selectedCountry}{wcText(selected, "city", "location", "state") ? ` · ${wcText(selected, "city", "location", "state")}` : ""}</p></header>

            <div className="grid border-b border-white/10 sm:grid-cols-2 xl:grid-cols-4"><div className="border-r border-white/8 p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Country sites</p><p className="mt-2 text-xl font-black">{countrySites.length.toLocaleString()}</p></div><div className="border-r border-white/8 p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Personnel</p><p className="mt-2 text-xl font-black">{personnel ? wcNumber(personnel, "personnel", "troops").toLocaleString() : "—"}</p></div><div className="border-r border-white/8 p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Expansion sites</p><p className="mt-2 text-xl font-black">{expansions.length.toLocaleString()}</p></div><div className="p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Personnel year</p><p className="mt-2 text-xl font-black">{defensePresence?.latestYear || "—"}</p></div></div>

            <div className="p-5">
              <div className="grid gap-px bg-white/8 sm:grid-cols-2">{detailFacts.length ? detailFacts.map((item) => <div key={item.label} className="bg-[#05090e] p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">{item.label}</p><p className="mt-1.5 text-[11px] font-bold text-slate-200">{item.value}</p></div>) : <div className="col-span-full bg-[#05090e] p-5 text-[10px] text-slate-600">No additional installation metadata is present in this source row.</div>}</div>

              <section className="mt-6 border-t border-white/8 pt-5"><div className="flex items-center gap-2"><Users size={15} className="text-cyan-200/55" /><h3 className="text-sm font-black">Country personnel context</h3></div>{personnel ? <div className="mt-3 grid grid-cols-2 gap-px bg-white/8 md:grid-cols-5">{[["Total", wcNumber(personnel, "personnel", "troops")], ["Army", wcNumber(personnel, "army")], ["Navy", wcNumber(personnel, "navy")], ["Air Force", wcNumber(personnel, "airForce", "air_force")], ["Marines", wcNumber(personnel, "marines", "marineCorps")]].map(([label, value]) => <div key={String(label)} className="bg-[#05090e] p-3"><p className="text-[9px] uppercase tracking-[.1em] text-slate-600">{label}</p><p className="mt-1 text-base font-black text-slate-200">{Number(value) ? Number(value).toLocaleString() : "—"}</p></div>)}</div> : <p className="mt-3 text-[10px] text-slate-600">No country-level personnel composition row is available.</p>}</section>

              <section className="mt-6 border-t border-white/8 pt-5"><div className="flex items-center gap-2"><MapPinned size={15} className="text-amber-200/55" /><h3 className="text-sm font-black">Expansion evidence in {selectedCountry}</h3></div><div className="mt-2 divide-y divide-white/[.055]">{expansions.length ? expansions.slice(0, 20).map((row, index) => { const value = wcNumber(row, "spending", "amount", "cost", "total"); return <div key={`${wcText(row, "location", "site", "facility")}-${index}`} className="grid gap-2 py-3 md:grid-cols-[1fr_80px_120px]"><div><p className="text-[11px] font-bold text-slate-200">{wcText(row, "location", "site", "facility") || `Expansion site ${index + 1}`}</p><p className="mt-1 text-[9px] text-slate-600">Investigate whether this location creates a new fixed-provider coverage need.</p></div><span className="text-[10px] text-slate-500">{wcNumber(row, "year") || "—"}</span><span className="text-[10px] font-bold text-slate-400">{value ? wcMoney(value) : "—"}</span></div>; }) : <p className="py-4 text-[10px] text-slate-600">No expansion record for this country.</p>}</div></section>
            </div>
          </> : <div className="grid min-h-[650px] place-items-center text-center"><div><Building2 size={30} className="mx-auto text-slate-700" /><p className="mt-3 text-sm font-black text-slate-400">No installation loaded</p></div></div>}
        </section>

        <aside className="border-l border-white/10 bg-[#080c12] p-4" aria-label="Medical coverage review">
          <div className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-200/60" /><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-600">Medical coverage review</p><h2 className="mt-1 text-base font-black">What must be verified locally</h2></div></div>
          <p className="mt-3 text-[9px] leading-4 text-slate-600">The defense datasets do not contain Occu-Med provider availability. These are required verification domains triggered by the selected site, not claims that coverage exists or is missing.</p>
          <div className="mt-4 divide-y divide-white/[.055]">{COVERAGE_REVIEW.map(([label, description], index) => <div key={label} className="py-3"><div className="flex items-start gap-3"><span className="mt-0.5 text-[9px] font-black text-slate-700">{String(index + 1).padStart(2, "0")}</span><div><p className="text-[10px] font-black text-slate-200">{label}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{description}</p></div></div></div>)}</div>

          <section className="mt-5 border-t border-white/8 pt-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Decision boundary</p><p className="mt-2 text-[9px] leading-4 text-slate-600">Installation, personnel, and construction evidence can tell Occu-Med where a coverage review deserves attention. It cannot establish contractor headcount, referral volume, provider adequacy, or an active client relationship without additional evidence.</p></section>
        </aside>
      </div>}
    </section>
  </main>;
}
