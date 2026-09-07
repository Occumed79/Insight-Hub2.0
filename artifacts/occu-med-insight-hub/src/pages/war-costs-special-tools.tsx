import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, RefreshCw, Search, Users } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

type Tool = "installations" | "personnel" | "service-prompts";

type DefensePresence = {
  ok: boolean;
  partial?: boolean;
  latestYear?: number | null;
  current?: WarCostsRow[];
  construction?: WarCostsRow[];
  warnings?: string[];
};

const TOOLS: Array<{ key: Tool; label: string; note: string; icon: typeof Building2 }> = [
  { key: "installations", label: "Installation Explorer", note: "Search sites by country, type and status", icon: Building2 },
  { key: "personnel", label: "Personnel Detail", note: "Branch composition by country", icon: Users },
  { key: "service-prompts", label: "Medical Planning Prompts", note: "Translate footprint evidence into review questions", icon: Search },
];

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

function nation(row: WarCostsRow): string {
  return wcText(row, "country", "countryName", "hostCountry", "location") || "Unknown";
}

function InstallationExplorer({ rows }: { rows: WarCostsRow[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => !needle || JSON.stringify(row).toLowerCase().includes(needle)).sort((a, b) => nation(a).localeCompare(nation(b)) || wcText(a, "name", "baseName", "installation").localeCompare(wcText(b, "name", "baseName", "installation")));
  }, [query, rows]);
  return <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Installation explorer</p><h2 className="mt-1 text-xl font-black text-white">Defense sites that may require medical-network support</h2><p className="mt-2 text-xs leading-6 text-slate-400">This view is for geography and site-context research. It does not assume an Occu-Med relationship or demand level.</p><div className="mt-4 flex min-h-11 items-center gap-2 border border-white/10 bg-black/25 px-3"><Search size={15} className="text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search installation, country, city, type, status…" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" /><span className="text-[10px] font-black text-slate-500">{visible.length}</span></div></header><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-white/8 text-[9px] uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">Installation</th><th className="p-3">Country</th><th className="p-3">City / location</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Planning use</th></tr></thead><tbody>{visible.slice(0, 240).map((row, index) => <tr key={`${wcText(row, "name", "baseName", "installation")}-${index}`} className="border-b border-white/[.055]"><td className="p-3 font-black text-white">{wcText(row, "name", "baseName", "installation", "site", "facility") || `Installation ${index + 1}`}</td><td className="p-3 text-slate-300">{nation(row)}</td><td className="p-3 text-slate-400">{wcText(row, "city", "location", "state") || "—"}</td><td className="p-3 text-slate-400">{wcText(row, "type", "baseType", "category") || "—"}</td><td className="p-3 text-slate-400">{wcText(row, "status") || "—"}</td><td className="p-3 text-[11px] leading-5 text-slate-500">Check contractor/client footprint and nearby fixed provider capacity.</td></tr>)}</tbody></table></div></section>;
}

function PersonnelDetail({ rows, year }: { rows: WarCostsRow[]; year?: number | null }) {
  const sorted = useMemo(() => [...rows].filter((row) => wcNumber(row, "personnel", "troops") > 0).sort((a, b) => wcNumber(b, "personnel", "troops") - wcNumber(a, "personnel", "troops")), [rows]);
  return <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Personnel detail</p><h2 className="mt-1 text-xl font-black text-white">Country-level personnel composition</h2><p className="mt-2 text-xs leading-6 text-slate-400">Personnel counts are context for where network depth may matter; they are not contractor counts, referral forecasts, or Occu-Med volume estimates.{year ? ` Dataset year: ${year}.` : ""}</p></header><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="border-b border-white/8 text-[9px] uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">Country</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Army</th><th className="p-3 text-right">Navy</th><th className="p-3 text-right">Air Force</th><th className="p-3 text-right">Marines</th></tr></thead><tbody>{sorted.slice(0, 180).map((row, index) => <tr key={`${nation(row)}-${index}`} className="border-b border-white/[.055]"><td className="p-3 font-black text-white">{nation(row)}</td><td className="p-3 text-right font-black text-slate-200">{wcNumber(row, "personnel", "troops").toLocaleString()}</td><td className="p-3 text-right text-slate-400">{wcNumber(row, "army") ? wcNumber(row, "army").toLocaleString() : "—"}</td><td className="p-3 text-right text-slate-400">{wcNumber(row, "navy") ? wcNumber(row, "navy").toLocaleString() : "—"}</td><td className="p-3 text-right text-slate-400">{wcNumber(row, "airForce", "air_force") ? wcNumber(row, "airForce", "air_force").toLocaleString() : "—"}</td><td className="p-3 text-right text-slate-400">{wcNumber(row, "marines", "marineCorps") ? wcNumber(row, "marines", "marineCorps").toLocaleString() : "—"}</td></tr>)}</tbody></table></div></section>;
}

function MedicalPlanningPrompts() {
  const prompts = [
    ["Provider density", "Are there fixed clinics close enough to likely contractor duty locations to support routine referrals without excessive travel?"],
    ["Core exam capability", "Can local providers complete pre-placement / annual physicals, ECG, labs, vision, and basic diagnostics at one site or through a reliable referral chain?"],
    ["Specialty gaps", "Are audiology, PFT/spirometry, chest X-ray, treadmill stress testing, dental evaluation, vaccines, and travel-health services locally available?"],
    ["Result quality", "Can providers deliver records in English, with the forms, test parameters, turnaround, and documentation quality required by the client program?"],
    ["Commercial workflow", "Will the provider accept direct referral, self-pay / invoicing, and Occu-Med’s documentation workflow without acting as a TPA or employment-clearance authority?"],
    ["Expansion timing", "If a defense site is expanding, should provider recruitment begin before contractor staffing and medical demand materialize?"],
    ["Redundancy", "Is there a second usable provider or referral path if the primary site becomes unavailable, refuses a service, or cannot meet turnaround?"],
  ];
  return <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Medical planning prompts</p><h2 className="mt-1 text-xl font-black text-white">Questions that footprint data should trigger</h2><p className="mt-2 text-xs leading-6 text-slate-400">These are review prompts, not modeled outputs. They convert installation, personnel, and expansion evidence into the next network-management questions.</p></header><div className="divide-y divide-white/[.06]">{prompts.map(([label, prompt], index) => <div key={label} className="grid grid-cols-[42px_170px_1fr] gap-4 p-4"><span className="text-[10px] font-black text-slate-600">{String(index + 1).padStart(2, "0")}</span><strong className="text-sm text-white">{label}</strong><p className="text-xs leading-6 text-slate-400">{prompt}</p></div>)}</div></section>;
}

export default function WarCostsSpecialTools() {
  const [installationResponse, setInstallationResponse] = useState<WarCostsDatasetResponse | null>(null);
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [active, setActive] = useState<Tool>("installations");
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

  return <main className="min-h-screen bg-[#06090d] pb-24 text-white"><Sidebar /><section className="px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Occu-Med · Defense network planning" title="Site & Coverage Workbench" subtitle="Specialized installation, personnel, and medical-network planning tools. Naval deployments, regional conflict chronology, weapons, and generic military operations are excluded." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.08] px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh data</button></div><WarCostsWorkspaceNav />{error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs text-amber-100/75">{error}</div> : null}<div className="mt-5 grid grid-cols-[220px_minmax(0,1fr)] border border-white/10 bg-[#070b10]"><aside className="border-r border-white/10"><div className="border-b border-white/10 p-4 text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Specialized views</div>{TOOLS.map((tool) => { const Icon = tool.icon; return <button key={tool.key} type="button" onClick={() => setActive(tool.key)} className={`w-full border-b border-white/[.06] p-4 text-left transition ${active === tool.key ? "bg-white/[.04] text-white" : "text-slate-400 hover:bg-white/[.02]"}`}><div className="flex items-center gap-2"><Icon size={14} /><strong className="text-xs">{tool.label}</strong></div><p className="mt-1.5 text-[9px] leading-4 text-slate-600">{tool.note}</p></button>; })}</aside><div className="min-w-0 p-5">{loading ? <div className="grid min-h-[520px] place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-slate-500">Loading site and personnel context…</p></div></div> : null}{!loading && active === "installations" ? <InstallationExplorer rows={installations} /> : null}{!loading && active === "personnel" ? <PersonnelDetail rows={defensePresence?.current || []} year={defensePresence?.latestYear} /> : null}{!loading && active === "service-prompts" ? <MedicalPlanningPrompts /> : null}</div></div></section></main>;
}
