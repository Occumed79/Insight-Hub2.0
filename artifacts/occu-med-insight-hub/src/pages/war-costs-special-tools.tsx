import { useEffect, useMemo, useState } from "react";
import { Activity, Calculator, Clock3, GitCompareArrows, Loader2, RefreshCw, ShipWheel, SlidersHorizontal, Trophy } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
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

type Tool = "budget" | "personal" | "inflation" | "draft" | "quiz" | "aid" | "countries" | "hormuz" | "iran-iraq";

const DATASETS = [
  "foreign-aid.json",
  "global-spending.json",
  "base-countries.json",
  "conflicts.json",
  "military-spending.json",
  "state-military-index.json",
  "state-footprint.json",
  "draft-analysis.json",
  "presidents.json",
] as const;

const STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"];

function federalTax(income: number) {
  const taxable = Math.max(0, income - 14600);
  const brackets = [[11600,.10],[47150,.12],[100525,.22],[191950,.24],[243725,.32],[609350,.35],[Infinity,.37]] as const;
  let remaining = taxable, prior = 0, tax = 0;
  for (const [cap, rate] of brackets) {
    const width = Math.max(0, Math.min(remaining, cap - prior));
    tax += width * rate;
    remaining -= width;
    prior = cap;
    if (remaining <= 0) break;
  }
  return tax;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-cyan-100/35">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p><p className="mt-1 text-[9px] leading-4 text-cyan-100/35">{note}</p></div>;
}

function BudgetSimulator() {
  const categories = [
    ["Nuclear Weapons", 52], ["Overseas Bases", 55], ["Aircraft & Navy", 180], ["Personnel & Pay", 165],
    ["R&D / Weapons Development", 140], ["Operations / Active Wars", 120], ["Intelligence & Cyber", 85],
    ["Veterans Affairs", 325], ["Miscellaneous / Admin", 89],
  ] as const;
  const [kept, setKept] = useState<Record<string, number>>(() => Object.fromEntries(categories.map(([name]) => [name, 100])));
  const defenseOnly = categories.filter(([name]) => name !== "Veterans Affairs");
  const baseDefense = 886;
  const freed = defenseOnly.reduce((sum, [name, amount]) => sum + amount * (1 - (kept[name] ?? 100) / 100), 0);
  const vaFreed = 325 * (1 - (kept["Veterans Affairs"] ?? 100) / 100);
  const remaining = Math.max(0, baseDefense - freed);
  const contexts = [["Universal pre-K years",30],["End homelessness years",20],["Free community college years",10],["Clean-water programs",150]] as const;
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><SlidersHorizontal size={18} className="text-cyan-200/70" /><h3 className="text-lg font-black">Defense Budget Simulator</h3></div><p className="mt-1 text-xs text-cyan-100/42">The WarCosts-style category-by-category budget redesign: 100% keeps current spending; 0% eliminates that category.</p><div className="mt-5 grid gap-3 xl:grid-cols-2">{categories.map(([name, amount]) => { const pct = kept[name] ?? 100; const current = amount * pct / 100; return <div key={name} className="rounded-xl border border-white/8 bg-black/10 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-white">{name}</p><p className="mt-1 text-[9px] text-cyan-100/35">${current.toFixed(1)}B / ${amount}B</p></div><strong className="text-sm">{pct}%</strong></div><input aria-label={`${name} kept percent`} type="range" min={0} max={100} value={pct} onChange={(e) => setKept((state) => ({ ...state, [name]: Number(e.target.value) }))} className="mt-3 w-full" /></div>; })}</div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Freed from defense" value={`$${freed.toFixed(1)}B`} note="excluding separate VA budget" /><Metric label="Remaining defense" value={`$${remaining.toFixed(1)}B`} note={`of $${baseDefense}B baseline`} /><Metric label="Optional VA reduction" value={`$${vaFreed.toFixed(1)}B`} note="tracked separately by WarCosts" /></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{contexts.map(([label, annual]) => <div key={label} className="rounded-xl border border-cyan-100/10 bg-cyan-300/[.04] p-3"><p className="text-lg font-black">{(freed / annual).toFixed(1)}×</p><p className="mt-1 text-[9px] text-cyan-100/38">{label} · ${annual}B benchmark</p></div>)}</div><button onClick={() => setKept(Object.fromEntries(categories.map(([name]) => [name, 100])))} className="mt-4 min-h-10 rounded-xl border border-white/10 px-4 text-[10px] font-bold text-cyan-50/70">Reset all</button></GlassCard>;
}

function annualAdjustedSpending(row: WarCostsRow) {
  return wcNumber(row, "inflationAdjusted", "adjusted2024", "adjusted2026", "spendingAdjusted", "realSpending", "amount", "spending", "total");
}
function annualNominalSpending(row: WarCostsRow) {
  return wcNumber(row, "nominal", "nominalSpending", "currentDollars", "spendingNominal");
}

function PersonalWarCost({ spending, stateRows }: { spending: WarCostsRow[]; stateRows: WarCostsRow[] }) {
  const [birthYear, setBirthYear] = useState(1990);
  const [stateName, setStateName] = useState("California");
  const rows = spending.filter((row) => wcNumber(row, "year") >= birthYear);
  const lifetimeNational = rows.reduce((sum, row) => sum + annualAdjustedSpending(row), 0);
  const perCapita = rows.reduce((sum, row) => {
    const amount = annualAdjustedSpending(row);
    const population = wcNumber(row, "population", "usPopulation") || 335_000_000;
    return sum + (population > 0 ? amount / population : 0);
  }, 0);
  const state = stateRows.find((row) => wcText(row, "state", "name", "stateName").toLowerCase() === stateName.toLowerCase()) ?? {};
  const explicitFactor = wcNumber(state, "federalTaxFactor", "taxBurdenMultiplier", "taxFactor");
  const stateFactor = explicitFactor > 0 ? explicitFactor : 1;
  const adjustedPersonal = perCapita * stateFactor;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Personal War Cost</h3><p className="mt-1 text-xs text-cyan-100/42">Uses the mirrored annual US military-spending history for every year since your birth. State adjustment is applied only when WarCosts supplies an explicit tax-burden factor; otherwise the app shows the neutral national per-capita share rather than inventing one.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[10px] uppercase text-cyan-100/40">Birth year<input type="number" min={1940} max={new Date().getFullYear()} value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3" /></label><label className="text-[10px] uppercase text-cyan-100/40">State<select value={stateName} onChange={(e) => setStateName(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{STATES.map((state) => <option key={state}>{state}</option>)}</select></label></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Years represented" value={wcInteger(rows.length)} note={`${birthYear} through source present`} /><Metric label="National spending during life" value={wcMoney(lifetimeNational)} note="sum of annual mirrored spending" /><Metric label="Your modeled share" value={wcMoney(adjustedPersonal)} note={explicitFactor > 0 ? `${stateName} source factor ${stateFactor.toFixed(2)}×` : "neutral per-capita share; no source tax factor"} /></div></GlassCard>;
}

function InflationCalculator({ conflicts, spending }: { conflicts: WarCostsRow[]; spending: WarCostsRow[] }) {
  const candidates = conflicts.filter((row) => wcNumber(row, "costNominal") > 0 && wcConflictCost(row) > 0);
  const [warId, setWarId] = useState(wcConflictId(candidates[0] ?? {}));
  const [amount, setAmount] = useState(1000);
  const years = useMemo(() => [...new Set(spending.map((row) => wcNumber(row, "year")).filter(Boolean))].sort((a, b) => a - b), [spending]);
  const [year, setYear] = useState(years[0] ?? 1945);
  useEffect(() => { if (years.length && !years.includes(year)) setYear(years[0]); }, [year, years]);
  const selected = candidates.find((row) => wcConflictId(row) === warId) ?? candidates[0] ?? {};
  const warMultiplier = wcNumber(selected, "costNominal") > 0 ? wcConflictCost(selected) / wcNumber(selected, "costNominal") : 1;
  const yearRow = spending.find((row) => wcNumber(row, "year") === year) ?? {};
  const nominal = annualNominalSpending(yearRow);
  const adjusted = annualAdjustedSpending(yearRow);
  const yearMultiplier = nominal > 0 && adjusted > 0 ? adjusted / nominal : 0;
  return <div className="grid gap-5 xl:grid-cols-2"><GlassCard className="p-5"><h3 className="text-lg font-black">War Inflation Comparison</h3><select value={warId} onChange={(e) => setWarId(e.target.value)} className="mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{candidates.map((row) => <option key={wcConflictId(row)} value={wcConflictId(row)}>{wcConflictName(row)}</option>)}</select><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Original cost" value={wcMoney(wcNumber(selected, "costNominal"))} note="source nominal dollars" /><Metric label="Adjusted cost" value={wcMoney(wcConflictCost(selected))} note={`${warMultiplier.toFixed(1)}× source ratio`} /></div></GlassCard><GlassCard className="p-5"><h3 className="text-lg font-black">Amount + Year Calculator</h3><p className="mt-1 text-xs text-cyan-100/42">Uses the nominal-to-real relationship in WarCosts’ annual spending history when both values are available for the selected year.</p><div className="mt-4 grid grid-cols-2 gap-3"><input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" /><select value={year} onChange={(e) => setYear(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></div><p className="mt-5 text-3xl font-black">{yearMultiplier > 0 ? wcMoney(amount * yearMultiplier) : "Source multiplier unavailable"}</p><p className="mt-1 text-xs text-cyan-100/40">{yearMultiplier > 0 ? `${wcMoney(amount)} in ${year} × ${yearMultiplier.toFixed(2)}` : "The annual feed does not expose both nominal and adjusted fields for this year."}</p></GlassCard></div>;
}

function DraftSimulator({ draftSource }: { draftSource: unknown }) {
  const [age, setAge] = useState(22), [gender, setGender] = useState("Male"), [state, setState] = useState("California"), [income, setIncome] = useState("Middle"), [education, setEducation] = useState("College"), [dependents, setDependents] = useState(0);
  let score = age >= 18 && age <= 25 ? 50 : age <= 30 ? 25 : 5;
  if (income === "Lower") score += 18; if (income === "Higher") score -= 12;
  if (education === "College") score -= 7; if (education === "Graduate") score -= 12;
  if (dependents >= 2) score -= 10; if (gender !== "Male") score *= .55;
  score = Math.max(1, Math.min(95, score));
  const sourceRows = wcRows(draftSource);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Draft Simulator</h3><p className="mt-1 text-xs text-cyan-100/42">Matches WarCosts’ profile inputs: age, gender, state, income, education and dependents. Because WarCosts does not publish its internal scoring formula in the downloadable data, Insight Hub labels the output as a scenario index rather than presenting an invented number as an official probability.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" placeholder="Age" /><select value={gender} onChange={(e) => setGender(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3"><option>Male</option><option>Female</option><option>Other</option></select><select value={state} onChange={(e) => setState(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{STATES.map((item) => <option key={item}>{item}</option>)}</select><select value={income} onChange={(e) => setIncome(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3"><option>Lower</option><option>Middle</option><option>Higher</option></select><select value={education} onChange={(e) => setEducation(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3"><option>High School</option><option>College</option><option>Graduate</option></select><input type="number" min={0} value={dependents} onChange={(e) => setDependents(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" placeholder="Dependents" /></div><div className="mt-5 grid gap-4 xl:grid-cols-[.7fr_1.3fr]"><div><p className="text-4xl font-black">{Math.round(score)}/100</p><p className="mt-1 text-xs text-cyan-100/40">historical-exposure scenario index</p><div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-amber-300/60" style={{ width: `${score}%` }} /></div></div><div className="rounded-xl border border-white/8 bg-black/10 p-4"><p className="text-xs font-bold">Historical source context</p><p className="mt-2 text-[10px] leading-5 text-cyan-100/45">WarCosts highlights working-class Vietnam service at roughly 3× the upper-class rate and notes that about 80% of Vietnam combat troops came from working-class or poor backgrounds. The mirrored draft dataset currently exposes {sourceRows.length} structured historical records.</p></div></div></GlassCard>;
}

type QuizQuestion = { prompt: string; options: string[]; answer: string; note: string };
function buildQuiz(conflicts: WarCostsRow[], presidents: WarCostsRow[]): QuizQuestion[] {
  const costRows = conflicts.filter((row) => wcConflictCost(row) > 0).slice(0, 12);
  const questions: QuizQuestion[] = costRows.map((row, index) => {
    const correct = wcConflictName(row);
    const distractors = conflicts.filter((item) => wcConflictId(item) !== wcConflictId(row)).slice(index + 1, index + 4).map(wcConflictName);
    return { prompt: `Which conflict has an adjusted WarCosts estimate closest to ${wcMoney(wcConflictCost(row))}?`, options: [correct, ...distractors].sort(), answer: correct, note: `${wcInteger(wcConflictDeaths(row))} US deaths in the mirrored conflict record.` };
  });
  for (const row of conflicts.filter((item) => wcConflictDeaths(item) > 0).slice(0, 5)) {
    const correct = wcConflictName(row);
    const others = conflicts.filter((item) => wcConflictId(item) !== wcConflictId(row) && wcConflictDeaths(item) > 0).slice(0, 3).map(wcConflictName);
    questions.push({ prompt: `Which conflict records ${wcInteger(wcConflictDeaths(row))} US deaths?`, options: [correct, ...others].sort(), answer: correct, note: "Casualty question generated from conflicts.json." });
  }
  for (const row of presidents.slice(0, 5)) {
    const name = wcText(row, "name", "president", "fullName");
    const cost = wcNumber(row, "warCostAdjusted2024", "totalCost");
    if (!name || !cost) continue;
    const others = presidents.filter((item) => wcText(item, "name", "president", "fullName") !== name).slice(0, 3).map((item) => wcText(item, "name", "president", "fullName")).filter(Boolean);
    questions.push({ prompt: `Which president's WarCosts record carries roughly ${wcMoney(cost)} in war cost?`, options: [name, ...others].sort(), answer: name, note: "Presidential war-cost question from presidents.json." });
  }
  return questions.slice(0, 20);
}
function AdvancedQuiz({ conflicts, presidents }: { conflicts: WarCostsRow[]; presidents: WarCostsRow[] }) {
  const questions = useMemo(() => buildQuiz(conflicts, presidents), [conflicts, presidents]);
  const [index, setIndex] = useState(0), [seconds, setSeconds] = useState(15), [score, setScore] = useState(0), [answer, setAnswer] = useState<string | null>(null), [finished, setFinished] = useState(false);
  const question = questions[index];
  const advance = () => { if (index + 1 >= questions.length) { setFinished(true); return; } setIndex((value) => value + 1); setSeconds(15); setAnswer(null); };
  useEffect(() => {
    if (finished || answer || !question) return;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) { window.clearInterval(timer); window.setTimeout(advance, 0); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [answer, finished, index, question]);
  const reset = () => { setIndex(0); setSeconds(15); setScore(0); setAnswer(null); setFinished(false); };
  if (!questions.length) return <GlassCard className="p-5 text-sm text-cyan-100/45">Quiz source records are unavailable.</GlassCard>;
  if (finished) return <GlassCard className="p-8 text-center"><Trophy className="mx-auto text-amber-200" /><p className="mt-4 text-4xl font-black">{score}/{questions.length}</p><p className="mt-2 text-xs text-cyan-100/40">Advanced WarCosts source quiz complete.</p><button onClick={reset} className="mt-5 min-h-10 rounded-xl border border-cyan-200/20 bg-cyan-300/8 px-4 text-[10px] font-bold">Play again</button></GlassCard>;
  return <GlassCard className="p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider text-cyan-100/35">Question {index + 1} of {questions.length}</p><h3 className="mt-1 text-lg font-black">Advanced War Quiz</h3></div><div className="flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-300/8 px-3 py-2 text-xs font-black text-amber-100"><Clock3 size={14} />{seconds}s</div></div><p className="mt-5 text-sm font-bold leading-6">{question.prompt}</p><div className="mt-4 grid gap-2 md:grid-cols-2">{question.options.map((option) => <button key={option} disabled={Boolean(answer)} onClick={() => { setAnswer(option); if (option === question.answer) setScore((value) => value + 1); }} className={`min-h-12 rounded-xl border p-3 text-left text-xs font-bold ${answer === option ? option === question.answer ? "border-emerald-200/30 bg-emerald-300/10" : "border-rose-200/30 bg-rose-300/10" : answer && option === question.answer ? "border-emerald-200/25 bg-emerald-300/[.06]" : "border-white/8 bg-black/10"}`}>{option}</button>)}</div>{answer && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[10px] leading-4 text-cyan-100/45">{question.note}</p><button onClick={advance} className="shrink-0 rounded-lg border border-cyan-200/20 px-3 py-2 text-[10px] font-bold">Next</button></div>}</GlassCard>;
}

function AidCalculator({ aidRows }: { aidRows: WarCostsRow[] }) {
  const [income, setIncome] = useState(75000);
  const tax = federalTax(income), military = tax * .24, foreignAidTax = tax * .013;
  const ranked = useMemo(() => [...aidRows].sort((a, b) => wcNumber(b, "aid") - wcNumber(a, "aid")), [aidRows]);
  const total = ranked.reduce((sum, row) => sum + wcNumber(row, "aid"), 0) || 68_000_000_000;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Foreign Aid Tax Calculator</h3><p className="mt-1 text-xs text-cyan-100/42">Allocates the estimated foreign-aid share of your federal income tax across WarCosts' current recipient mix.</p><label className="mt-5 block text-[10px] uppercase text-cyan-100/40">Annual income<input type="number" value={income} onChange={(e) => setIncome(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3" /></label><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="Federal tax" value={wcMoney(tax)} note="2024 single-filer method" /><Metric label="Military share" value={wcMoney(military)} note="24% baseline" /><Metric label="Foreign-aid share" value={wcMoney(foreignAidTax)} note="~1.3% of federal income tax" /></div><div className="mt-5 grid gap-2 md:grid-cols-2">{ranked.slice(0, 12).map((row) => { const amount = wcNumber(row, "aid"); const share = total > 0 ? amount / total : 0; return <div key={wcText(row, "country", "name", "slug")} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 p-3 text-xs"><div><p className="font-bold">{wcText(row, "country", "name")}</p><p className="mt-1 text-[9px] text-cyan-100/35">{(share * 100).toFixed(1)}% · {wcMoney(amount)} annual source aid</p></div><strong>{wcMoney(foreignAidTax * share)}</strong></div>; })}</div></GlassCard>;
}

function CountryComparator({ countries, bases }: { countries: WarCostsRow[]; bases: WarCostsRow[] }) {
  const names = useMemo(() => countries.map((row) => wcText(row, "country", "name")).filter(Boolean), [countries]);
  const [left, setLeft] = useState(names[0] ?? "United States"), [right, setRight] = useState(names[1] ?? "China");
  useEffect(() => { if (!left && names.length) setLeft(names[0]); if (!right && names.length > 1) setRight(names[1]); }, [left, right, names]);
  const pick = (name: string) => countries.find((row) => wcText(row, "country", "name") === name) ?? {};
  const base = (name: string) => bases.find((row) => wcText(row, "country", "name", "countryName").toLowerCase() === name.toLowerCase()) ?? {};
  const a = pick(left), b = pick(right), aSpend = wcNumber(a, "spending", "militarySpending", "amount", "value"), bSpend = wcNumber(b, "spending", "militarySpending", "amount", "value");
  const displayMoney = (value: number) => value && value < 1_000_000 ? wcMoney(value * 1_000_000_000) : wcMoney(value);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Country Military Comparator</h3><div className="mt-4 grid gap-3 md:grid-cols-2"><select value={left} onChange={(e) => setLeft(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{names.map((name) => <option key={name}>{name}</option>)}</select><select value={right} onChange={(e) => setRight(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{names.map((name) => <option key={name}>{name}</option>)}</select></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35"><th className="p-2">Metric</th><th className="p-2">{left}</th><th className="p-2">{right}</th></tr></thead><tbody>{[["Military spending",displayMoney(aSpend),displayMoney(bSpend)],["% GDP",`${wcNumber(a,"gdpPercent","percentGdp","gdpShare") || "—"}%`,`${wcNumber(b,"gdpPercent","percentGdp","gdpShare") || "—"}%`],["Per capita",wcMoney(wcNumber(a,"perCapita","spendingPerCapita")),wcMoney(wcNumber(b,"perCapita","spendingPerCapita"))],["Global share",`${wcNumber(a,"globalShare","percentWorld","worldShare") || "—"}%`,`${wcNumber(b,"globalShare","percentWorld","worldShare") || "—"}%`],["US base presence",wcInteger(wcNumber(base(left),"total","bases","installations")),wcInteger(wcNumber(base(right),"total","bases","installations"))]].map(([metric,av,bv]) => <tr key={metric} className="border-t border-white/8"><td className="p-3 text-cyan-100/45">{metric}</td><td className="p-3 font-bold">{av}</td><td className="p-3 font-bold">{bv}</td></tr>)}</tbody></table></div><div className="mt-4 rounded-xl border border-cyan-100/10 bg-cyan-300/[.04] p-4 text-xs"><strong>{left}</strong> spends {bSpend > 0 ? `${(aSpend / bSpend).toFixed(2)}×` : "—"} as much as <strong>{right}</strong> in the mirrored source data.</div></GlassCard>;
}

function HormuzCalculator() {
  const [days, setDays] = useState(30); const bounded = Math.max(1, Math.min(180, days));
  const gdpLoss = bounded * 3.5e9, oil = 108 + bounded * .5, gas = 3.8 + bounded * .02, shipping = bounded;
  const comparisons = [["Public schools",gdpLoss/40e6],["Hospitals / year",gdpLoss/200e6],["Homes",gdpLoss/350000],["Teacher-years",gdpLoss/65000],["4-year scholarships",gdpLoss/100000]] as const;
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><ShipWheel size={18} className="text-amber-200/70" /><h3 className="text-lg font-black">Strait of Hormuz Impact Calculator</h3></div><p className="mt-1 text-xs text-cyan-100/42">WarCosts scenario methodology: $3.5B/day midpoint GDP loss, +$0.50/barrel/day, +$0.02/gal/day and about +1% freight per closure day.</p><label className="mt-5 block text-[10px] uppercase text-cyan-100/40">Closure duration: {bounded} days<input type="range" min={1} max={180} value={bounded} onChange={(e) => setDays(Number(e.target.value))} className="mt-3 w-full" /></label><div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Global GDP loss" value={wcMoney(gdpLoss)} note="$3.5B / day" /><Metric label="Projected oil" value={`$${oil.toFixed(0)}/bbl`} note="$108 conflict-level starting point" /><Metric label="US gas" value={`$${gas.toFixed(2)}/gal`} note="scenario projection" /><Metric label="Shipping costs" value={`+${shipping}%`} note="global freight scenario" /></div><div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{comparisons.map(([label,value]) => <div key={label} className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-lg font-black">{wcInteger(value)}</p><p className="mt-1 text-[9px] text-cyan-100/35">{label}</p></div>)}</div></GlassCard>;
}

function IranVsIraq({ conflicts }: { conflicts: WarCostsRow[] }) {
  const iran = conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iran") && wcNumber(row,"startYear") >= 2025) ?? conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iran")) ?? {};
  const iraq = conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iraq") && wcNumber(row,"startYear") >= 2000) ?? conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iraq")) ?? {};
  const rows = [["Adjusted cost",wcMoney(wcConflictCost(iran)),wcMoney(wcConflictCost(iraq))],["US deaths",wcInteger(wcConflictDeaths(iran)),wcInteger(wcConflictDeaths(iraq))],["Civilian deaths",wcInteger(wcCivilianDeaths(iran)),wcInteger(wcCivilianDeaths(iraq))],["Congressional authorization",iran.congressionalAuth === true ? "Yes" : iran.congressionalAuth === false ? "No" : "—",iraq.congressionalAuth === true ? "Yes" : iraq.congressionalAuth === false ? "No" : "—"],["Outcome",wcText(iran,"outcome") || "Ongoing",wcText(iraq,"outcome") || "—"]];
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><GitCompareArrows size={18} className="text-rose-200/70" /><h3 className="text-lg font-black">Iran vs Iraq</h3></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35"><th className="p-2">Metric</th><th className="p-2">{wcConflictName(iran)}</th><th className="p-2">{wcConflictName(iraq)}</th></tr></thead><tbody>{rows.map(([metric,a,b]) => <tr key={metric as string} className="border-t border-white/8"><td className="p-3 text-cyan-100/45">{metric}</td><td className="max-w-[280px] p-3 font-bold">{String(a)}</td><td className="max-w-[280px] p-3 font-bold">{String(b)}</td></tr>)}</tbody></table></div></GlassCard>;
}

export default function WarCostsSpecialTools() {
  const [active, setActive] = useState<Tool>("budget");
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState("");
  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true); setError("");
    try {
      const pairs = await Promise.all(DATASETS.map(async (name) => { try { return [name, await getWarCostsDataset(name, force)] as const; } catch { return [name, null] as const; } }));
      const next: Record<string, WarCostsDatasetResponse> = {};
      for (const [name,response] of pairs) if (response) next[name] = response;
      setResponses(next);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Specialized WarCosts tools could not load."); }
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { void load(false); }, []);
  const data = useMemo(() => Object.fromEntries(Object.entries(responses).map(([name,response]) => [name,response.data])) as Record<string,unknown>, [responses]);
  const stateRows = wcRows(data["state-military-index.json"]).length ? wcRows(data["state-military-index.json"]) : wcRows(data["state-footprint.json"]);
  const tools: Array<{ key: Tool; label: string; note: string; icon: typeof Calculator }> = [
    { key:"budget", label:"Budget Simulator", note:"Nine category sliders", icon:SlidersHorizontal },
    { key:"personal", label:"Personal War Cost", note:"Birth year + state", icon:Calculator },
    { key:"inflation", label:"Inflation", note:"War + amount/year", icon:Calculator },
    { key:"draft", label:"Draft Simulator", note:"Full six-field profile", icon:Activity },
    { key:"quiz", label:"Advanced Quiz", note:"20 questions · 15 seconds", icon:Trophy },
    { key:"aid", label:"Aid Tax", note:"Tax share by recipient", icon:Calculator },
    { key:"countries", label:"Compare Countries", note:"Military-spending face-off", icon:GitCompareArrows },
    { key:"hormuz", label:"Hormuz Impact", note:"Oil, GDP, gas & freight", icon:ShipWheel },
    { key:"iran-iraq", label:"Iran vs Iraq", note:"Live conflict comparison", icon:Activity },
  ];
  return <main className="aurora-bg min-h-screen text-white"><Sidebar /><section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Specialized Tools" subtitle="Fuller native implementations of WarCosts’ original calculators and comparison experiences, plus specialized live-data tools." /><button onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh source data</button></div><WarCostsWorkspaceNav />{error && <GlassCard className="mt-5 border-rose-300/20 p-4 text-sm text-rose-100">{error}</GlassCard>}{loading ? <GlassCard className="mt-5 grid min-h-[400px] place-items-center"><Loader2 className="animate-spin text-cyan-200" /></GlassCard> : <div className="mt-5 space-y-5"><section className="grid gap-3 md:grid-cols-3 xl:grid-cols-9">{tools.map((tool) => { const Icon = tool.icon; return <button key={tool.key} onClick={() => setActive(tool.key)} className={`rounded-2xl border p-4 text-left transition ${active === tool.key ? "border-cyan-200/28 bg-cyan-300/12" : "border-white/8 bg-black/10 hover:bg-white/[.035]"}`}><Icon size={18} className={active === tool.key ? "text-cyan-100" : "text-cyan-100/40"} /><p className="mt-3 text-xs font-black">{tool.label}</p><p className="mt-1 text-[9px] leading-4 text-cyan-100/35">{tool.note}</p></button>; })}</section>{active === "budget" && <BudgetSimulator />}{active === "personal" && <PersonalWarCost spending={wcRows(data["military-spending.json"])} stateRows={stateRows} />}{active === "inflation" && <InflationCalculator conflicts={wcRows(data["conflicts.json"])} spending={wcRows(data["military-spending.json"])} />}{active === "draft" && <DraftSimulator draftSource={data["draft-analysis.json"]} />}{active === "quiz" && <AdvancedQuiz conflicts={wcRows(data["conflicts.json"])} presidents={wcRows(data["presidents.json"])} />}{active === "aid" && <AidCalculator aidRows={wcRows(data["foreign-aid.json"])} />}{active === "countries" && <CountryComparator countries={wcRows(data["global-spending.json"])} bases={wcRows(data["base-countries.json"])} />}{active === "hormuz" && <HormuzCalculator />}{active === "iran-iraq" && <IranVsIraq conflicts={wcRows(data["conflicts.json"])} />}</div>}</section></main>;
}
