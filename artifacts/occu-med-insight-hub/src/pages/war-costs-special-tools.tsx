import { useEffect, useMemo, useState } from "react";
import { Activity, Calculator, GitCompareArrows, Loader2, RefreshCw, ShipWheel } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { wcConflictCost, wcConflictDeaths, wcConflictName, wcInteger, wcMoney, wcNumber, wcRows, wcText, type WarCostsRow } from "./war-costs-utils";

type Tool = "aid" | "countries" | "hormuz" | "iran-iraq";

const DATASETS = ["foreign-aid.json", "global-spending.json", "base-countries.json", "conflicts.json"] as const;

function federalTax(income: number) {
  const taxable = Math.max(0, income - 14600);
  const brackets = [[11600,.10],[47150,.12],[100525,.22],[191950,.24],[243725,.32],[609350,.35],[Infinity,.37]] as const;
  let remaining = taxable, prior = 0, tax = 0;
  for (const [cap, rate] of brackets) { const width = Math.max(0, Math.min(remaining, cap - prior)); tax += width * rate; remaining -= width; prior = cap; if (remaining <= 0) break; }
  return tax;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-cyan-100/35">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p><p className="mt-1 text-[9px] leading-4 text-cyan-100/35">{note}</p></div>;
}

function AidCalculator({ aidRows }: { aidRows: WarCostsRow[] }) {
  const [income, setIncome] = useState(75000);
  const tax = federalTax(income);
  const military = tax * .24;
  const foreignAidTax = tax * .013;
  const ranked = useMemo(() => [...aidRows].sort((a, b) => wcNumber(b, "amount", "total", "aid") - wcNumber(a, "amount", "total", "aid")), [aidRows]);
  const total = ranked.reduce((sum, row) => sum + wcNumber(row, "amount", "total", "aid"), 0) || 55_000_000_000;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Foreign Aid Tax Calculator</h3><p className="mt-1 text-xs text-cyan-100/42">Recreates WarCosts’ income-tax view, then allocates your foreign-aid share across the live mirrored recipient data.</p><label className="mt-5 block text-[10px] uppercase text-cyan-100/40">Annual income<input type="number" value={income} onChange={(e) => setIncome(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3" /></label><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="Federal income tax" value={wcMoney(tax)} note="2024 single-filer method" /><Metric label="Military share" value={wcMoney(military)} note="24% conservative baseline" /><Metric label="Foreign-aid share" value={wcMoney(foreignAidTax)} note="~1.3% of federal income tax" /></div><div className="mt-5 grid gap-2 md:grid-cols-2">{ranked.slice(0, 12).map((row) => { const amount = wcNumber(row, "amount", "total", "aid"); const share = total > 0 ? amount / total : 0; return <div key={wcText(row, "country", "name", "slug")} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 p-3 text-xs"><div><p className="font-bold">{wcText(row, "country", "name")}</p><p className="mt-1 text-[9px] text-cyan-100/35">{(share * 100).toFixed(1)}% of mirrored aid total</p></div><strong>{wcMoney(foreignAidTax * share)}</strong></div>; })}</div></GlassCard>;
}

function CountryComparator({ countries, bases }: { countries: WarCostsRow[]; bases: WarCostsRow[] }) {
  const names = useMemo(() => countries.map((row) => wcText(row, "country", "name")).filter(Boolean), [countries]);
  const [left, setLeft] = useState(names[0] ?? "United States"); const [right, setRight] = useState(names[1] ?? "China");
  useEffect(() => { if (!left && names.length) setLeft(names[0]); if (!right && names.length > 1) setRight(names[1]); }, [left, right, names]);
  const pick = (name: string) => countries.find((row) => wcText(row, "country", "name") === name) ?? {};
  const base = (name: string) => bases.find((row) => wcText(row, "country", "name", "countryName") === name) ?? {};
  const a = pick(left), b = pick(right), aSpend = wcNumber(a, "spending", "amount", "militarySpending", "value"), bSpend = wcNumber(b, "spending", "amount", "militarySpending", "value");
  const displayMoney = (value: number) => value && value < 1_000_000 ? wcMoney(value * 1_000_000_000) : wcMoney(value);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Country Military Comparator</h3><p className="mt-1 text-xs text-cyan-100/42">Military spending face-off using the mirrored global-spending and US-base-presence datasets.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><select value={left} onChange={(e) => setLeft(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{names.map((name) => <option key={name}>{name}</option>)}</select><select value={right} onChange={(e) => setRight(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{names.map((name) => <option key={name}>{name}</option>)}</select></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35"><th className="p-2">Metric</th><th className="p-2">{left}</th><th className="p-2">{right}</th></tr></thead><tbody>{[
    ["Military spending", displayMoney(aSpend), displayMoney(bSpend)],
    ["% GDP", `${wcNumber(a, "gdpPercent", "percentGdp", "gdpShare") || "—"}%`, `${wcNumber(b, "gdpPercent", "percentGdp", "gdpShare") || "—"}%`],
    ["Per capita", wcMoney(wcNumber(a, "perCapita", "spendingPerCapita")), wcMoney(wcNumber(b, "perCapita", "spendingPerCapita"))],
    ["Global share", `${wcNumber(a, "globalShare", "percentWorld", "worldShare") || "—"}%`, `${wcNumber(b, "globalShare", "percentWorld", "worldShare") || "—"}%`],
    ["US base presence", wcInteger(wcNumber(base(left), "total", "bases", "installations")), wcInteger(wcNumber(base(right), "total", "bases", "installations"))],
  ].map(([metric, av, bv]) => <tr key={metric} className="border-t border-white/8"><td className="p-3 text-cyan-100/45">{metric}</td><td className="p-3 font-bold">{av}</td><td className="p-3 font-bold">{bv}</td></tr>)}</tbody></table></div><div className="mt-4 rounded-xl border border-cyan-100/10 bg-cyan-300/[.04] p-4 text-xs"><strong>{left}</strong> spends {bSpend > 0 ? `${(aSpend / bSpend).toFixed(2)}×` : "—"} as much as <strong>{right}</strong> in the mirrored source data.</div></GlassCard>;
}

function HormuzCalculator() {
  const [days, setDays] = useState(30);
  const bounded = Math.max(1, Math.min(180, days));
  const gdpLoss = bounded * 3.5e9;
  const oil = 108 + bounded * .5;
  const gas = 3.8 + bounded * .02;
  const shipping = bounded;
  const schools = gdpLoss / 40e6, hospitals = gdpLoss / 200e6, homes = gdpLoss / 350000, teachers = gdpLoss / 65000, scholarships = gdpLoss / 100000;
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><ShipWheel size={18} className="text-amber-200/70" /><h3 className="text-lg font-black">Strait of Hormuz Impact Calculator</h3></div><p className="mt-1 text-xs text-cyan-100/42">WarCosts methodology: 21M barrels/day through Hormuz, $3.5B/day midpoint GDP loss, +$0.50/barrel/day, +$0.02/gal/day, and roughly +1% freight per closure day.</p><label className="mt-5 block text-[10px] uppercase text-cyan-100/40">Closure duration: {bounded} days<input type="range" min={1} max={180} value={bounded} onChange={(e) => setDays(Number(e.target.value))} className="mt-3 w-full" /></label><div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Global GDP loss" value={wcMoney(gdpLoss)} note={`${wcMoney(3.5e9)} / day`} /><Metric label="Projected oil" value={`$${oil.toFixed(0)}/bbl`} note="$60 pre-war baseline; $108 conflict level" /><Metric label="US gas" value={`$${gas.toFixed(2)}/gal`} note="scenario projection" /><Metric label="Shipping costs" value={`+${shipping}%`} note="global freight scenario" /></div><div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{[["Public schools", schools],["Hospitals / year", hospitals],["Homes", homes],["Teacher-years", teachers],["4-year scholarships", scholarships]].map(([label, value]) => <div key={label as string} className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-lg font-black">{wcInteger(Number(value))}</p><p className="mt-1 text-[9px] text-cyan-100/35">{label}</p></div>)}</div></GlassCard>;
}

function IranVsIraq({ conflicts }: { conflicts: WarCostsRow[] }) {
  const iran = conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iran") && wcNumber(row, "startYear") >= 2025) ?? conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iran")) ?? {};
  const iraq = conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iraq") && wcNumber(row, "startYear") >= 2000) ?? conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iraq")) ?? {};
  const rows = [
    ["Adjusted cost", wcMoney(wcConflictCost(iran)), wcMoney(wcConflictCost(iraq))],
    ["US deaths", wcInteger(wcConflictDeaths(iran)), wcInteger(wcConflictDeaths(iraq))],
    ["Civilian deaths", wcInteger(wcNumber(iran, "civilianDeaths", "civilianCasualties")), wcInteger(wcNumber(iraq, "civilianDeaths", "civilianCasualties"))],
    ["Congressional authorization", iran.congressionalAuth === true ? "Yes" : iran.congressionalAuth === false ? "No" : "—", iraq.congressionalAuth === true ? "Yes" : iraq.congressionalAuth === false ? "No" : "—"],
    ["Duration", `${Math.max(0, (wcNumber(iran, "endYear") || new Date().getFullYear()) - wcNumber(iran, "startYear"))} years`, `${Math.max(0, (wcNumber(iraq, "endYear") || new Date().getFullYear()) - wcNumber(iraq, "startYear"))} years`],
    ["Outcome", wcText(iran, "outcome") || "Ongoing", wcText(iraq, "outcome") || "—"],
  ];
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><GitCompareArrows size={18} className="text-rose-200/70" /><h3 className="text-lg font-black">Iran vs Iraq</h3></div><p className="mt-1 text-xs text-cyan-100/42">Dedicated side-by-side view using the live mirrored conflict records; no hard-coded headline numbers.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35"><th className="p-2">Metric</th><th className="p-2">{wcConflictName(iran)}</th><th className="p-2">{wcConflictName(iraq)}</th></tr></thead><tbody>{rows.map(([metric, a, b]) => <tr key={metric as string} className="border-t border-white/8"><td className="p-3 text-cyan-100/45">{metric}</td><td className="max-w-[280px] p-3 font-bold">{String(a)}</td><td className="max-w-[280px] p-3 font-bold">{String(b)}</td></tr>)}</tbody></table></div></GlassCard>;
}

export default function WarCostsSpecialTools() {
  const [active, setActive] = useState<Tool>("aid"); const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({}); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  async function load(force = false) { force ? setRefreshing(true) : setLoading(true); setError(""); try { const pairs = await Promise.all(DATASETS.map(async (name) => { try { return [name, await getWarCostsDataset(name, force)] as const; } catch { return [name, null] as const; } })); const next: Record<string, WarCostsDatasetResponse> = {}; for (const [name, response] of pairs) if (response) next[name] = response; setResponses(next); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Specialized WarCosts tools could not load."); } finally { setLoading(false); setRefreshing(false); } }
  useEffect(() => { void load(false); }, []);
  const data = useMemo(() => Object.fromEntries(Object.entries(responses).map(([name, response]) => [name, response.data])) as Record<string, unknown>, [responses]);
  const tools: Array<{ key: Tool; label: string; note: string; icon: typeof Calculator }> = [
    { key: "aid", label: "Aid Tax Calculator", note: "Your tax share by recipient", icon: Calculator },
    { key: "countries", label: "Compare Countries", note: "Military-spending face-off", icon: GitCompareArrows },
    { key: "hormuz", label: "Hormuz Impact", note: "Oil, GDP, gas and freight", icon: ShipWheel },
    { key: "iran-iraq", label: "Iran vs Iraq", note: "Dedicated live comparison", icon: Activity },
  ];
  return <main className="aurora-bg min-h-screen text-white"><Sidebar /><section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Specialized Tools" subtitle="The remaining WarCosts calculators and comparison experiences recreated inside the same unified workspace." /><button onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh source data</button></div><WarCostsWorkspaceNav />{error && <GlassCard className="mt-5 border-rose-300/20 p-4 text-sm text-rose-100">{error}</GlassCard>}{loading ? <GlassCard className="mt-5 grid min-h-[400px] place-items-center"><Loader2 className="animate-spin text-cyan-200" /></GlassCard> : <div className="mt-5 space-y-5"><section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{tools.map((tool) => { const Icon = tool.icon; return <button key={tool.key} onClick={() => setActive(tool.key)} className={`rounded-2xl border p-4 text-left transition ${active === tool.key ? "border-cyan-200/28 bg-cyan-300/12" : "border-white/8 bg-black/10 hover:bg-white/[.035]"}`}><Icon size={18} className={active === tool.key ? "text-cyan-100" : "text-cyan-100/40"} /><p className="mt-3 text-xs font-black">{tool.label}</p><p className="mt-1 text-[9px] text-cyan-100/35">{tool.note}</p></button>; })}</section>{active === "aid" && <AidCalculator aidRows={wcRows(data["foreign-aid.json"])} />}{active === "countries" && <CountryComparator countries={wcRows(data["global-spending.json"])} bases={wcRows(data["base-countries.json"])} />}{active === "hormuz" && <HormuzCalculator />}{active === "iran-iraq" && <IranVsIraq conflicts={wcRows(data["conflicts.json"])} />}</div>}</section></main>;
}
