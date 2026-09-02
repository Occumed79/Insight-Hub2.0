import { useMemo, useState } from "react";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  wcCivilianDeaths,
  wcConflictCost,
  wcConflictDeaths,
  wcConflictId,
  wcConflictName,
  wcInteger,
  wcMoney,
  wcNumber,
  wcRows,
  wcText,
  type WarCostsRow,
} from "./war-costs-utils";

type CalcKey = "tax" | "jobs" | "opportunity" | "state" | "casualty";

const POST_911_WAR_COST = 8_000_000_000_000;
const US_POPULATION = 335_000_000;
const CITY_PRESETS = [
  ["New York City", 8_258_000], ["Los Angeles", 3_821_000], ["Chicago", 2_664_000], ["Houston", 2_314_000],
  ["Phoenix", 1_650_000], ["San Francisco", 808_000], ["Denver", 716_000], ["Portland, OR", 630_000],
  ["Nashville", 690_000], ["Boise", 236_000], ["Charleston, SC", 155_000], ["Small Town USA", 10_000],
] as const;

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-cyan-100/35">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p><p className="mt-1 text-[9px] leading-4 text-cyan-100/35">{note}</p></div>;
}

function TaxReceipt() {
  const [income, setIncome] = useState(75_000);
  const taxable = Math.max(0, income - 14_600);
  const brackets = [[11_600,.10],[47_150,.12],[100_525,.22],[191_950,.24],[243_725,.32],[609_350,.35],[Infinity,.37]] as const;
  let remaining = taxable, prior = 0, tax = 0;
  for (const [cap, rate] of brackets) {
    const width = Math.max(0, Math.min(remaining, cap - prior));
    tax += width * rate;
    remaining -= width;
    prior = cap;
    if (remaining <= 0) break;
  }
  const military = tax * .24;
  const shares = [["Pentagon Base Budget",.52],["Veteran Care & Benefits",.18],["Interest on War Debt",.12],["Nuclear Weapons / DOE",.08],["Homeland Security",.06],["Foreign Military Aid",.04]] as const;
  const alternatives = [["months of groceries", 400], ["tanks of gas", 60], ["months of student-loan payments", 400], ["months of health insurance", 500]] as const;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Military Tax Receipt</h3><p className="mt-1 text-xs text-cyan-100/42">WarCosts methodology: 2024 single-filer brackets, $14,600 standard deduction, then a conservative 24% military-related share of federal income tax.</p><label className="mt-5 block text-[10px] uppercase text-cyan-100/40">Annual income<input type="number" min={0} value={income} onChange={(e) => setIncome(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm" /></label><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Federal tax estimate" value={wcMoney(tax)} note="federal income tax only" /><Metric label="Military tax bill" value={wcMoney(military)} note="24% conservative baseline" /></div><div className="mt-4 space-y-2">{shares.map(([label, share]) => <div key={label} className="flex justify-between rounded-xl border border-white/8 bg-black/10 p-3 text-xs"><span className="text-cyan-100/48">{label}</span><strong>{wcMoney(military * share)}</strong></div>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{alternatives.map(([label, unit]) => <div key={label} className="rounded-xl border border-cyan-100/10 bg-cyan-300/[.04] p-3"><p className="text-xl font-black">{wcInteger(military / unit)}</p><p className="mt-1 text-[9px] text-cyan-100/38">{label}</p></div>)}</div></GlassCard>;
}

function JobsSimulator({ source }: { source: unknown }) {
  const sourceObject = source && typeof source === "object" && !Array.isArray(source) ? source as WarCostsRow : {};
  const sectors = Array.isArray(sourceObject.sectorsPerMillion) ? sourceObject.sectorsPerMillion.filter((item): item is WarCostsRow => Boolean(item && typeof item === "object")) : [];
  const [shiftB, setShiftB] = useState(100);
  const [sector, setSector] = useState("Education");
  const military = sectors.find((row) => wcText(row, "sector") === "Military") ?? {};
  const target = sectors.find((row) => wcText(row, "sector") === sector) ?? sectors[0] ?? {};
  const millions = Math.max(0, shiftB) * 1000;
  const militaryJobs = wcNumber(military, "jobs") * millions;
  const targetJobs = wcNumber(target, "jobs") * millions;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Jobs Calculator</h3><p className="mt-1 text-xs text-cyan-100/42">Uses WarCosts’ jobs-created-per-$1M source values instead of generic employment multipliers.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[10px] uppercase text-cyan-100/40">Shift from military ($B)<input type="number" min={0} value={shiftB} onChange={(e) => setShiftB(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3" /></label><label className="text-[10px] uppercase text-cyan-100/40">Move to<select value={sector} onChange={(e) => setSector(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{sectors.filter((row) => wcText(row, "sector") !== "Military").map((row) => <option key={wcText(row, "sector")}>{wcText(row, "sector")}</option>)}</select></label></div><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="Military jobs" value={wcInteger(militaryJobs)} note={`${wcNumber(military, "jobs")} / $1M`} /><Metric label={`${sector} jobs`} value={wcInteger(targetJobs)} note={`${wcNumber(target, "jobs")} / $1M`} /><Metric label="Net change" value={wcInteger(targetJobs - militaryJobs)} note="source-rate difference" /></div></GlassCard>;
}

const fallbackOpportunities = [
  { label: "Free public college — annual", unit: 79e9 }, { label: "Universal pre-K — annual", unit: 36e9 },
  { label: "Clean drinking water worldwide — annual", unit: 20e9 }, { label: "End homelessness — annual", unit: 20e9 },
  { label: "Teacher salary-years", unit: 63e3 }, { label: "Rebuild every US bridge", unit: 125e9 },
  { label: "Maximum Pell Grants", unit: 7395 }, { label: "VA mental-health care — annual", unit: 12e9 },
];

function OpportunityCost({ conflicts, source }: { conflicts: WarCostsRow[]; source: unknown }) {
  const [warId, setWarId] = useState(wcConflictId(conflicts[0] ?? {}));
  const selected = conflicts.find((row) => wcConflictId(row) === warId) ?? conflicts[0] ?? {};
  const amount = wcConflictCost(selected);
  const sourceRows = wcRows(source);
  const discovered = sourceRows.map((row) => ({ label: wcText(row, "name", "label", "item", "alternative"), unit: wcNumber(row, "unitCost", "cost", "amount") })).filter((item) => item.label && item.unit > 0);
  const options = discovered.length ? discovered : fallbackOpportunities;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Opportunity Cost</h3><select value={warId} onChange={(e) => setWarId(e.target.value)} className="mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{conflicts.map((row) => <option key={wcConflictId(row)} value={wcConflictId(row)}>{wcConflictName(row)}</option>)}</select><p className="mt-4 text-3xl font-black">{wcMoney(amount)}</p><p className="text-xs text-cyan-100/38">adjusted conflict cost</p><div className="mt-4 grid gap-2 md:grid-cols-2">{options.slice(0, 12).map((item) => <div key={item.label} className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-sm font-black">{item.unit >= 1e7 ? `${(amount / item.unit).toFixed(1)}×` : wcInteger(amount / item.unit)}</p><p className="mt-1 text-[10px] text-cyan-100/40">{item.label} · unit {wcMoney(item.unit)}</p></div>)}</div></GlassCard>;
}

function StateImpact({ states, perCapita }: { states: WarCostsRow[]; perCapita: WarCostsRow[] }) {
  const [key, setKey] = useState(wcText(states[0] ?? {}, "code", "state", "slug"));
  const selected = states.find((row) => [wcText(row, "code"), wcText(row, "state"), wcText(row, "slug")].includes(key)) ?? states[0] ?? {};
  const name = wcText(selected, "state", "name") || key;
  const companion = perCapita.find((row) => wcText(row, "state", "name", "code", "slug").toLowerCase() === name.toLowerCase() || wcText(row, "code") === wcText(selected, "code")) ?? {};
  const explicitSharePct = wcNumber(selected, "federalTaxShare", "taxShare", "populationShare") || wcNumber(companion, "federalTaxShare", "taxShare", "populationShare");
  const population = wcNumber(selected, "population", "statePopulation") || wcNumber(companion, "population", "statePopulation");
  const neutralShare = population > 0 ? population / US_POPULATION : 0;
  const share = explicitSharePct > 0 ? (explicitSharePct > 1 ? explicitSharePct / 100 : explicitSharePct) : neutralShare;
  const stateWarCost = share > 0 ? POST_911_WAR_COST * share : 0;
  const defenseSpending = wcNumber(selected, "dodSpending", "spending", "contractValue") || wcNumber(companion, "spending", "dodSpending");
  const normalizedDefenseSpending = defenseSpending > 0 && defenseSpending < 1_000_000 ? defenseSpending * 1e9 : defenseSpending;
  const alternatives = [["new public schools", 40e6], ["community hospitals", 200e6], ["miles of major infrastructure", 10e6], ["teacher salary-years", 65e3]] as const;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">State Impact Calculator</h3><p className="mt-1 text-xs text-cyan-100/42">WarCosts frames this tool as a state share of roughly $8T in post-9/11 war spending and asks what that amount could have purchased locally. Insight Hub uses an explicit source tax/population share when present; otherwise it uses only a neutral population share when the source exposes population.</p><select value={key} onChange={(e) => setKey(e.target.value)} className="mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{states.map((row) => { const value = wcText(row, "code", "state", "slug"); return <option key={value} value={value}>{wcText(row, "state", "name")} {wcText(row, "code")}</option>; })}</select><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="State war-cost share" value={stateWarCost ? wcMoney(stateWarCost) : "Source share unavailable"} note={explicitSharePct > 0 ? "source tax/share factor" : population > 0 ? "neutral population share" : "no fabricated allocation"} /><Metric label="Current DoD spending" value={normalizedDefenseSpending ? wcMoney(normalizedDefenseSpending) : "—"} note="state footprint source" /><Metric label="Defense-linked jobs" value={wcNumber(selected, "jobs", "directJobs") ? wcInteger(wcNumber(selected, "jobs", "directJobs")) : "—"} note="source state profile" /><Metric label="Installations" value={wcInteger(wcNumber(selected, "bases", "total", "activeBases"))} note="source military footprint" /></div>{stateWarCost > 0 ? <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{alternatives.map(([label, unit]) => <div key={label} className="rounded-xl border border-cyan-100/10 bg-cyan-300/[.04] p-3"><p className="text-xl font-black">{wcInteger(stateWarCost / unit)}</p><p className="mt-1 text-[9px] text-cyan-100/38">{label}</p></div>)}</div> : <div className="mt-4 rounded-xl border border-amber-200/12 bg-amber-300/[.04] p-4 text-xs text-amber-50/65">The mirrored state feeds do not currently expose a defensible allocation factor for {name}. The app intentionally does not manufacture one.</div>}</GlassCard>;
}

function CasualtyScale({ conflicts }: { conflicts: WarCostsRow[] }) {
  const [warId, setWarId] = useState(wcConflictId(conflicts[0] ?? {}));
  const [city, setCity] = useState("Phoenix");
  const [population, setPopulation] = useState(1_650_000);
  const selected = conflicts.find((row) => wcConflictId(row) === warId) ?? conflicts[0] ?? {};
  const scale = Math.max(0, population) / US_POPULATION;
  const choosePreset = (name: string, size: number) => { setCity(name); setPopulation(size); };
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Casualty Scale Calculator</h3><p className="mt-1 text-xs text-cyan-100/42">Matches WarCosts’ interaction: choose a conflict, enter a city name and population, or use one of the provided city presets.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><select value={warId} onChange={(e) => setWarId(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{conflicts.map((row) => <option key={wcConflictId(row)} value={wcConflictId(row)}>{wcConflictName(row)}</option>)}</select><input value={city} onChange={(e) => setCity(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" placeholder="City name" /><input type="number" min={1} value={population} onChange={(e) => setPopulation(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" placeholder="Population" /></div><div className="mt-3 flex flex-wrap gap-2">{CITY_PRESETS.map(([name, size]) => <button key={name} type="button" onClick={() => choosePreset(name, size)} className="rounded-full border border-white/9 bg-black/10 px-3 py-2 text-[9px] font-bold text-cyan-50/65 hover:border-cyan-200/22">{name}</button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="US-death equivalent" value={wcInteger(wcConflictDeaths(selected) * scale)} note={`${city || "Your city"} · population ${wcInteger(population)}`} /><Metric label="Civilian-death equivalent" value={wcInteger(wcCivilianDeaths(selected) * scale)} note="same population scaling" /></div><div className="mt-4 rounded-xl border border-white/8 bg-black/10 p-4"><p className="text-xs font-bold">Source context</p><p className="mt-2 text-[10px] leading-5 text-cyan-100/42">{wcConflictName(selected)} records {wcInteger(wcConflictDeaths(selected))} US deaths and {wcInteger(wcCivilianDeaths(selected))} civilian deaths in the mirrored WarCosts conflict data.</p></div></GlassCard>;
}

export function WarCostsCalculators({ datasets }: { datasets: Record<string, unknown> }) {
  const [active, setActive] = useState<CalcKey>("tax");
  const conflicts = useMemo(() => wcRows(datasets["conflicts.json"]), [datasets]);
  const states = useMemo(() => { const rich = wcRows(datasets["state-military-index.json"]); return rich.length ? rich : wcRows(datasets["state-footprint.json"]); }, [datasets]);
  const perCapita = useMemo(() => wcRows(datasets["spending-per-capita.json"]), [datasets]);
  const options: Array<[CalcKey, string]> = [["tax","Tax Receipt"],["jobs","Jobs"],["opportunity","Opportunity Cost"],["state","State Impact"],["casualty","Casualty Scale"]];
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{options.map(([key, label]) => <button key={key} onClick={() => setActive(key)} className={`min-h-10 rounded-xl border px-3 text-[10px] font-bold ${active === key ? "border-cyan-200/30 bg-cyan-300/12" : "border-white/8 bg-black/10 text-cyan-100/45"}`}>{label}</button>)}</div>{active === "tax" && <TaxReceipt />}{active === "jobs" && <JobsSimulator source={datasets["jobs-data.json"]} />}{active === "opportunity" && <OpportunityCost conflicts={conflicts} source={datasets["opportunity-costs.json"]} />}{active === "state" && <StateImpact states={states} perCapita={perCapita} />}{active === "casualty" && <CasualtyScale conflicts={conflicts} />}</div>;
}
