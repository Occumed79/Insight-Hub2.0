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

type CalcKey = "tax" | "jobs" | "opportunity" | "inflation" | "lifetime" | "state" | "casualty" | "draft" | "quiz";

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-cyan-100/35">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p><p className="mt-1 text-[9px] text-cyan-100/35">{note}</p></div>;
}

function TaxReceipt() {
  const [income, setIncome] = useState(75000);
  const taxable = Math.max(0, income - 14600);
  const brackets = [[11600,.10],[47150,.12],[100525,.22],[191950,.24],[243725,.32],[609350,.35],[Infinity,.37]] as const;
  let remaining = taxable, prior = 0, tax = 0;
  for (const [cap, rate] of brackets) { const width = Math.max(0, Math.min(remaining, cap - prior)); tax += width * rate; remaining -= width; prior = cap; if (remaining <= 0) break; }
  const military = tax * .24;
  const shares = [["Pentagon Base Budget",.52],["Veteran Care & Benefits",.18],["Interest on War Debt",.12],["Nuclear Weapons / DOE",.08],["Homeland Security",.06],["Foreign Military Aid",.04]] as const;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Military Tax Receipt</h3><p className="mt-1 text-xs text-cyan-100/42">Recreates WarCosts’ 2024 single-filer / $14,600 standard-deduction / 24% military-share methodology.</p><label className="mt-5 block text-[10px] uppercase text-cyan-100/40">Annual income<input type="number" value={income} onChange={(e) => setIncome(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm" /></label><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Federal tax estimate" value={wcMoney(tax)} note="single-filer estimate" /><Metric label="Military tax bill" value={wcMoney(military)} note="24% baseline" /></div><div className="mt-4 space-y-2">{shares.map(([label, share]) => <div key={label} className="flex justify-between rounded-xl border border-white/8 bg-black/10 p-3 text-xs"><span className="text-cyan-100/48">{label}</span><strong>{wcMoney(military * share)}</strong></div>)}</div></GlassCard>;
}

function JobsSimulator({ source }: { source: unknown }) {
  const sourceObject = source && typeof source === "object" && !Array.isArray(source) ? source as WarCostsRow : {};
  const sectors = Array.isArray(sourceObject.sectorsPerMillion) ? sourceObject.sectorsPerMillion.filter((item): item is WarCostsRow => Boolean(item && typeof item === "object")) : [];
  const [shiftB, setShiftB] = useState(100); const [sector, setSector] = useState("Education");
  const military = sectors.find((x) => wcText(x, "sector") === "Military") ?? {}; const target = sectors.find((x) => wcText(x, "sector") === sector) ?? sectors[0] ?? {};
  const millions = shiftB * 1000, militaryJobs = wcNumber(military, "jobs") * millions, targetJobs = wcNumber(target, "jobs") * millions;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Budget & Jobs Simulator</h3><p className="mt-1 text-xs text-cyan-100/42">Uses WarCosts jobs-created-per-$1M data.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[10px] uppercase text-cyan-100/40">Shift from military ($B)<input type="number" value={shiftB} onChange={(e) => setShiftB(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3" /></label><label className="text-[10px] uppercase text-cyan-100/40">Move to<select value={sector} onChange={(e) => setSector(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{sectors.filter((x) => wcText(x, "sector") !== "Military").map((x) => <option key={wcText(x, "sector")}>{wcText(x, "sector")}</option>)}</select></label></div><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="Military jobs" value={wcInteger(militaryJobs)} note={`${wcNumber(military, "jobs")} / $1M`} /><Metric label={`${sector} jobs`} value={wcInteger(targetJobs)} note={`${wcNumber(target, "jobs")} / $1M`} /><Metric label="Net change" value={wcInteger(targetJobs - militaryJobs)} note="modeled difference" /></div></GlassCard>;
}

const fallbackOpportunities = [
  { label: "Free public college — annual", unit: 79e9 }, { label: "Universal pre-K — annual", unit: 36e9 },
  { label: "Clean drinking water worldwide — annual", unit: 20e9 }, { label: "End homelessness — annual", unit: 20e9 },
  { label: "Teacher salary-years", unit: 63e3 }, { label: "Rebuild every US bridge", unit: 125e9 },
  { label: "Maximum Pell Grants", unit: 7395 }, { label: "VA mental-health care — annual", unit: 12e9 },
];

function OpportunityCost({ conflicts, source }: { conflicts: WarCostsRow[]; source: unknown }) {
  const [warId, setWarId] = useState(wcConflictId(conflicts[0] ?? {})); const selected = conflicts.find((x) => wcConflictId(x) === warId) ?? conflicts[0] ?? {}; const amount = wcConflictCost(selected);
  const sourceRows = wcRows(source); const discovered = sourceRows.map((row) => ({ label: wcText(row, "name", "label", "item", "alternative"), unit: wcNumber(row, "unitCost", "cost", "amount") })).filter((x) => x.label && x.unit > 0); const options = discovered.length ? discovered : fallbackOpportunities;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Opportunity Cost</h3><select value={warId} onChange={(e) => setWarId(e.target.value)} className="mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{conflicts.map((x) => <option key={wcConflictId(x)} value={wcConflictId(x)}>{wcConflictName(x)}</option>)}</select><p className="mt-4 text-3xl font-black">{wcMoney(amount)}</p><p className="text-xs text-cyan-100/38">adjusted conflict cost</p><div className="mt-4 grid gap-2 md:grid-cols-2">{options.slice(0, 12).map((item) => <div key={item.label} className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-sm font-black">{item.unit >= 1e7 ? `${(amount / item.unit).toFixed(1)}×` : wcInteger(amount / item.unit)}</p><p className="mt-1 text-[10px] text-cyan-100/40">{item.label} · unit {wcMoney(item.unit)}</p></div>)}</div></GlassCard>;
}

function Inflation({ conflicts }: { conflicts: WarCostsRow[] }) {
  const candidates = conflicts.filter((x) => wcNumber(x, "costNominal") > 0 && wcConflictCost(x) > 0); const [warId, setWarId] = useState(wcConflictId(candidates[0] ?? {})); const [amount, setAmount] = useState(1000); const selected = candidates.find((x) => wcConflictId(x) === warId) ?? candidates[0] ?? {}; const multiplier = wcNumber(selected, "costNominal") ? wcConflictCost(selected) / wcNumber(selected, "costNominal") : 1;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">War Inflation Calculator</h3><p className="mt-1 text-xs text-cyan-100/42">Uses the selected conflict’s own WarCosts nominal-to-adjusted cost ratio.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><select value={warId} onChange={(e) => setWarId(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{candidates.map((x) => <option key={wcConflictId(x)} value={wcConflictId(x)}>{wcConflictName(x)}</option>)}</select><input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" /></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Historical amount" value={wcMoney(amount)} note={`source year ${wcNumber(selected, "costYear") || "—"}`} /><Metric label="Adjusted equivalent" value={wcMoney(amount * multiplier)} note={`${multiplier.toFixed(1)}×`} /></div></GlassCard>;
}

function LifetimeCost({ conflicts }: { conflicts: WarCostsRow[] }) {
  const [birthYear, setBirthYear] = useState(1990); const lived = conflicts.filter((x) => (wcNumber(x, "endYear") || new Date().getFullYear()) >= birthYear); const cost = lived.reduce((sum, x) => sum + wcConflictCost(x), 0);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Personal Lifetime War Cost</h3><label className="mt-4 block text-[10px] uppercase text-cyan-100/40">Birth year<input type="number" min={1900} max={new Date().getFullYear()} value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3" /></label><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="Conflicts" value={wcInteger(lived.length)} note="overlapping lifetime" /><Metric label="Combined cost" value={wcMoney(cost)} note="adjusted source costs" /><Metric label="Taxpayer share" value={wcMoney(cost / 150_000_000)} note={`${wcMoney(cost / 335_000_000)} / resident`} /></div></GlassCard>;
}

function StateImpact({ states }: { states: WarCostsRow[] }) {
  const [key, setKey] = useState(wcText(states[0] ?? {}, "code", "state", "slug")); const selected = states.find((x) => [wcText(x, "code"), wcText(x, "state"), wcText(x, "slug")].includes(key)) ?? states[0] ?? {}; const spending = wcNumber(selected, "dodSpending", "spending", "contractValue");
  return <GlassCard className="p-5"><h3 className="text-lg font-black">State Military Impact</h3><select value={key} onChange={(e) => setKey(e.target.value)} className="mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{states.map((x) => { const value = wcText(x, "code", "state", "slug"); return <option key={value} value={value}>{wcText(x, "state", "name")} {wcText(x, "code")}</option>; })}</select><div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Defense spending" value={spending ? wcMoney(spending < 1e6 ? spending * 1e9 : spending) : "—"} note="source state profile" /><Metric label="Direct jobs" value={wcNumber(selected, "jobs", "directJobs") ? wcInteger(wcNumber(selected, "jobs", "directJobs")) : "—"} note="defense-linked" /><Metric label="Installations" value={wcInteger(wcNumber(selected, "bases", "total"))} note="military sites" /><Metric label="Share of GSP" value={wcNumber(selected, "percentGsp", "gspPercent", "defenseShare") ? `${wcNumber(selected, "percentGsp", "gspPercent", "defenseShare")}%` : "—"} note="economic dependence" /></div></GlassCard>;
}

function CasualtyScale({ conflicts }: { conflicts: WarCostsRow[] }) {
  const [warId, setWarId] = useState(wcConflictId(conflicts[0] ?? {})); const [population, setPopulation] = useState(500000); const selected = conflicts.find((x) => wcConflictId(x) === warId) ?? conflicts[0] ?? {}; const base = 335_000_000;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Casualty Scale Calculator</h3><div className="mt-4 grid gap-3 md:grid-cols-2"><select value={warId} onChange={(e) => setWarId(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{conflicts.map((x) => <option key={wcConflictId(x)} value={wcConflictId(x)}>{wcConflictName(x)}</option>)}</select><input type="number" value={population} onChange={(e) => setPopulation(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" /></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="US-death equivalent" value={wcInteger(wcConflictDeaths(selected) / base * population)} note={`city population ${wcInteger(population)}`} /><Metric label="Civilian-death equivalent" value={wcInteger(wcCivilianDeaths(selected) / base * population)} note="same scale" /></div></GlassCard>;
}

function DraftSimulator() {
  const [age, setAge] = useState(22), [income, setIncome] = useState("middle"), [education, setEducation] = useState("college"), [dependents, setDependents] = useState(0), [gender, setGender] = useState("male");
  let score = age >= 18 && age <= 25 ? 55 : age <= 30 ? 30 : 5; if (income === "low") score += 15; if (income === "high") score -= 10; if (education === "college") score -= 8; if (education === "graduate") score -= 12; if (dependents >= 2) score -= 12; if (gender !== "male") score *= .55; score = Math.max(1, Math.min(95, score));
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Draft Simulator</h3><p className="mt-1 text-xs text-cyan-100/42">Historical-inequality scenario model, not a prediction of future draft law.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" placeholder="Age" /><select value={gender} onChange={(e) => setGender(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select><select value={income} onChange={(e) => setIncome(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3"><option value="low">Lower income</option><option value="middle">Middle income</option><option value="high">Higher income</option></select><select value={education} onChange={(e) => setEducation(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3"><option value="highschool">High school</option><option value="college">College</option><option value="graduate">Graduate</option></select><input type="number" min={0} value={dependents} onChange={(e) => setDependents(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" placeholder="Dependents" /></div><p className="mt-5 text-4xl font-black">{Math.round(score)}%</p><p className="text-xs text-cyan-100/38">modeled draft-exposure score</p><div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-amber-300/60" style={{ width: `${score}%` }} /></div></GlassCard>;
}

function Quiz({ conflicts }: { conflicts: WarCostsRow[] }) {
  const candidates = conflicts.filter((x) => wcConflictCost(x) > 0); const [seed, setSeed] = useState(0), [answer, setAnswer] = useState<string | null>(null); const current = candidates[seed % Math.max(candidates.length, 1)] ?? {}; const correct = wcConflictName(current); const wrong = candidates.filter((x) => wcConflictId(x) !== wcConflictId(current)).slice((seed * 3) % Math.max(candidates.length - 3, 1), ((seed * 3) % Math.max(candidates.length - 3, 1)) + 3).map(wcConflictName); const options = [correct, ...wrong].sort();
  return <GlassCard className="p-5"><h3 className="text-lg font-black">War Quiz</h3><p className="mt-4 text-sm font-bold">Which conflict has an adjusted cost of {wcMoney(wcConflictCost(current))}?</p><div className="mt-4 grid gap-2 md:grid-cols-2">{options.map((option) => <button key={option} onClick={() => setAnswer(option)} className={`min-h-12 rounded-xl border p-3 text-left text-xs font-bold ${answer === option ? option === correct ? "border-emerald-200/30 bg-emerald-300/10" : "border-rose-200/30 bg-rose-300/10" : "border-white/8 bg-black/10"}`}>{option}</button>)}</div>{answer && <p className={`mt-4 text-xs font-bold ${answer === correct ? "text-emerald-200" : "text-rose-200"}`}>{answer === correct ? "Correct." : `Correct answer: ${correct}`}</p>}<button onClick={() => { setSeed((x) => x + 1); setAnswer(null); }} className="mt-4 min-h-10 rounded-xl border border-cyan-200/20 bg-cyan-300/8 px-4 text-[10px] font-bold">Next question</button></GlassCard>;
}

export function WarCostsCalculators({ datasets }: { datasets: Record<string, unknown> }) {
  const [active, setActive] = useState<CalcKey>("tax"); const conflicts = useMemo(() => wcRows(datasets["conflicts.json"]), [datasets]); const states = useMemo(() => { const rich = wcRows(datasets["state-military-index.json"]); return rich.length ? rich : wcRows(datasets["state-footprint.json"]); }, [datasets]);
  const options: Array<[CalcKey, string]> = [["tax","Tax Receipt"],["jobs","Budget / Jobs"],["opportunity","Opportunity Cost"],["inflation","Inflation"],["lifetime","Lifetime Cost"],["state","State Impact"],["casualty","Casualty Scale"],["draft","Draft Simulator"],["quiz","War Quiz"]];
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{options.map(([key, label]) => <button key={key} onClick={() => setActive(key)} className={`min-h-10 rounded-xl border px-3 text-[10px] font-bold ${active === key ? "border-cyan-200/30 bg-cyan-300/12" : "border-white/8 bg-black/10 text-cyan-100/45"}`}>{label}</button>)}</div>{active === "tax" && <TaxReceipt />}{active === "jobs" && <JobsSimulator source={datasets["jobs-data.json"]} />}{active === "opportunity" && <OpportunityCost conflicts={conflicts} source={datasets["opportunity-costs.json"]} />}{active === "inflation" && <Inflation conflicts={conflicts} />}{active === "lifetime" && <LifetimeCost conflicts={conflicts} />}{active === "state" && <StateImpact states={states} />}{active === "casualty" && <CasualtyScale conflicts={conflicts} />}{active === "draft" && <DraftSimulator />}{active === "quiz" && <Quiz conflicts={conflicts} />}</div>;
}
