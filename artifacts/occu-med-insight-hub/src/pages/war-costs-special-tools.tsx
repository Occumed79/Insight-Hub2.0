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
type IranCompareMode = "first-month" | "total";

type HistoryPoint = { year: number; value: number };

const DATASETS = [
  "foreign-aid.json", "global-spending.json", "base-countries.json", "conflicts.json", "military-spending.json",
  "state-military-index.json", "state-footprint.json", "draft-analysis.json", "presidents.json",
] as const;

const STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"];

function finiteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%+,]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function federalTax(income: number) {
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
  return tax;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-cyan-100/35">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p><p className="mt-1 text-[9px] leading-4 text-cyan-100/35">{note}</p></div>;
}

function BudgetSimulator() {
  const categories = [["Nuclear Weapons",52],["Overseas Bases",55],["Aircraft & Navy",180],["Personnel & Pay",165],["R&D / Weapons Development",140],["Operations / Active Wars",120],["Intelligence & Cyber",85],["Veterans Affairs",325],["Miscellaneous / Admin",89]] as const;
  const [kept, setKept] = useState<Record<string, number>>(() => Object.fromEntries(categories.map(([name]) => [name, 100])));
  const defenseOnly = categories.filter(([name]) => name !== "Veterans Affairs");
  const baseDefense = 886;
  const freed = defenseOnly.reduce((sum, [name, amount]) => sum + amount * (1 - (kept[name] ?? 100) / 100), 0);
  const remaining = Math.max(0, baseDefense - freed);
  const vaFreed = 325 * (1 - (kept["Veterans Affairs"] ?? 100) / 100);
  const contexts = [["Universal pre-K years",30],["End homelessness years",20],["Free community college years",10],["Clean-water programs",150]] as const;
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><SlidersHorizontal size={18} className="text-cyan-200/70" /><h3 className="text-lg font-black">Defense Budget Simulator</h3></div><p className="mt-1 text-xs text-cyan-100/42">Nine independent WarCosts-style categories. 100% keeps current spending; 0% eliminates that category.</p><div className="mt-5 grid gap-3 xl:grid-cols-2">{categories.map(([name, amount]) => { const pct = kept[name] ?? 100; return <div key={name} className="rounded-xl border border-white/8 bg-black/10 p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold">{name}</p><p className="mt-1 text-[9px] text-cyan-100/35">${(amount * pct / 100).toFixed(1)}B / ${amount}B</p></div><strong>{pct}%</strong></div><input aria-label={`${name} kept percent`} type="range" min={0} max={100} value={pct} onChange={(e) => setKept((state) => ({ ...state, [name]: Number(e.target.value) }))} className="mt-3 w-full" /></div>; })}</div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Freed from defense" value={`$${freed.toFixed(1)}B`} note="excluding separate VA budget" /><Metric label="Remaining defense" value={`$${remaining.toFixed(1)}B`} note={`of $${baseDefense}B baseline`} /><Metric label="Optional VA reduction" value={`$${vaFreed.toFixed(1)}B`} note="tracked separately" /></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{contexts.map(([label, annual]) => <div key={label} className="rounded-xl border border-cyan-100/10 bg-cyan-300/[.04] p-3"><p className="text-lg font-black">{(freed / annual).toFixed(1)}×</p><p className="mt-1 text-[9px] text-cyan-100/38">{label}</p></div>)}</div><button onClick={() => setKept(Object.fromEntries(categories.map(([name]) => [name, 100])))} className="mt-4 min-h-10 rounded-xl border border-white/10 px-4 text-[10px] font-bold">Reset all</button></GlassCard>;
}

function annualAdjustedSpending(row: WarCostsRow) { return wcNumber(row, "inflationAdjusted", "adjusted2024", "adjusted2026", "spendingAdjusted", "realSpending", "amount", "spending", "total"); }
function annualNominalSpending(row: WarCostsRow) { return wcNumber(row, "nominal", "nominalSpending", "currentDollars", "spendingNominal"); }

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
  const alternatives = [["school lunches",3.81],["teacher salary-years",65_000],["maximum Pell Grants",7_000],["median-price homes",405_000],["VA healthcare appointments",350]] as const;
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Personal War Cost</h3><p className="mt-1 text-xs text-cyan-100/42">Annual military spending over your lifetime, divided by US population each year. A state adjustment is applied only when the mirrored source exposes a tax-burden factor.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[10px] uppercase text-cyan-100/40">Birth year<input type="number" min={1940} max={new Date().getFullYear()} value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3" /></label><label className="text-[10px] uppercase text-cyan-100/40">State<select value={stateName} onChange={(e) => setStateName(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{STATES.map((stateNameOption) => <option key={stateNameOption}>{stateNameOption}</option>)}</select></label></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Years represented" value={wcInteger(rows.length)} note={`${birthYear} through source present`} /><Metric label="National spending during life" value={wcMoney(lifetimeNational)} note="sum of annual source spending" /><Metric label="Your modeled share" value={wcMoney(adjustedPersonal)} note={explicitFactor > 0 ? `${stateName} source factor ${stateFactor.toFixed(2)}×` : "neutral per-capita share"} /></div><div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-100/35">What your modeled share could have bought instead</p><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{alternatives.map(([label, unit]) => <div key={label} className="rounded-xl border border-cyan-100/10 bg-cyan-300/[.04] p-3"><p className="text-xl font-black">{(adjustedPersonal / unit).toLocaleString(undefined, { maximumFractionDigits: unit >= 100_000 ? 2 : 0 })}</p><p className="mt-1 text-[9px] text-cyan-100/38">{label}</p></div>)}</div></div></GlassCard>;
}

function InflationCalculator({ conflicts, spending }: { conflicts: WarCostsRow[]; spending: WarCostsRow[] }) {
  const candidates = conflicts.filter((row) => wcNumber(row, "costNominal") > 0 && wcConflictCost(row) > 0);
  const [warId, setWarId] = useState(wcConflictId(candidates[0] ?? {}));
  const [amount, setAmount] = useState(1000);
  const years = useMemo(() => [...new Set(spending.map((row) => wcNumber(row, "year")).filter(Boolean))].sort((a, b) => a - b), [spending]);
  const [year, setYear] = useState(years[0] ?? 1945);
  useEffect(() => { if (years.length && !years.includes(year)) setYear(years[0]); }, [year, years]);
  const selected = candidates.find((row) => wcConflictId(row) === warId) ?? candidates[0] ?? {};
  const nominal = annualNominalSpending(spending.find((row) => wcNumber(row, "year") === year) ?? {});
  const adjusted = annualAdjustedSpending(spending.find((row) => wcNumber(row, "year") === year) ?? {});
  const multiplier = nominal > 0 && adjusted > 0 ? adjusted / nominal : 0;
  const gdpPct = wcNumber(selected, "gdpPercent", "percentGdp", "gdpShare");
  const currentGdp = 29_000_000_000_000;
  const gdpEquivalent = gdpPct > 0 ? currentGdp * (gdpPct / 100) : 0;
  return <div className="grid gap-5 xl:grid-cols-2"><GlassCard className="p-5"><h3 className="text-lg font-black">War Inflation Comparison</h3><select value={warId} onChange={(e) => setWarId(e.target.value)} className="mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-[#07101c] px-3">{candidates.map((row) => <option key={wcConflictId(row)} value={wcConflictId(row)}>{wcConflictName(row)}</option>)}</select><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Original cost" value={wcMoney(wcNumber(selected, "costNominal"))} note="source nominal dollars" /><Metric label="2026 / adjusted cost" value={wcMoney(wcConflictCost(selected))} note="source adjusted figure" /></div><div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-3"><Metric label="Per capita then" value={wcNumber(selected, "perCapitaThen", "perCapita") ? wcMoney(wcNumber(selected, "perCapitaThen", "perCapita")) : "—"} note="when source exposes it" /><Metric label="% GDP then" value={gdpPct ? `${gdpPct}%` : "—"} note="war-era GDP context" /><Metric label="GDP equivalent now" value={gdpEquivalent ? wcMoney(gdpEquivalent) : "—"} note="same GDP share applied to ~2026 US GDP" /></div></GlassCard><GlassCard className="p-5"><h3 className="text-lg font-black">Amount + Year Calculator</h3><div className="mt-4 grid grid-cols-2 gap-3"><input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" /><select value={year} onChange={(e) => setYear(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></div><p className="mt-5 text-3xl font-black">{multiplier > 0 ? wcMoney(amount * multiplier) : "Source multiplier unavailable"}</p><p className="mt-1 text-xs text-cyan-100/40">{multiplier > 0 ? `${wcMoney(amount)} in ${year} × ${multiplier.toFixed(2)}` : "No nominal/adjusted pair is exposed for this year."}</p></GlassCard></div>;
}

function DraftSimulator({ draftSource }: { draftSource: unknown }) {
  const [age, setAge] = useState(22), [gender, setGender] = useState("Male"), [state, setState] = useState("California"), [income, setIncome] = useState("Middle"), [education, setEducation] = useState("College"), [dependents, setDependents] = useState(0);
  let score = age >= 18 && age <= 25 ? 50 : age <= 30 ? 25 : 5;
  if (income === "Lower") score += 18;
  if (income === "Higher") score -= 12;
  if (education === "College") score -= 7;
  if (education === "Graduate") score -= 12;
  if (dependents >= 2) score -= 10;
  if (gender !== "Male") score *= .55;
  score = Math.max(1, Math.min(95, score));
  const sourceRows = wcRows(draftSource);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Draft Simulator</h3><p className="mt-1 text-xs text-cyan-100/42">Uses the same six profile inputs surfaced by WarCosts. The score is explicitly a historical-exposure scenario index because WarCosts does not publish an official future-draft probability model.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" placeholder="Age" /><select value={gender} onChange={(e) => setGender(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3"><option>Male</option><option>Female</option><option>Other</option></select><select value={state} onChange={(e) => setState(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{STATES.map((item) => <option key={item}>{item}</option>)}</select><select value={income} onChange={(e) => setIncome(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3"><option>Lower</option><option>Middle</option><option>Higher</option></select><select value={education} onChange={(e) => setEducation(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3"><option>High School</option><option>College</option><option>Graduate</option></select><input type="number" min={0} value={dependents} onChange={(e) => setDependents(Number(e.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3" placeholder="Dependents" /></div><div className="mt-5 grid gap-4 xl:grid-cols-[.7fr_1.3fr]"><div><p className="text-4xl font-black">{Math.round(score)}/100</p><p className="mt-1 text-xs text-cyan-100/40">historical-exposure scenario index</p><div className="mt-3 h-3 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-amber-300/60" style={{ width: `${score}%` }} /></div></div></div><div className="rounded-xl border border-white/8 bg-black/10 p-4"><p className="text-xs font-bold">Historical source context</p><p className="mt-2 text-[10px] leading-5 text-cyan-100/45">The mirrored draft dataset currently exposes {sourceRows.length} structured historical records. WarCosts highlights large class differences in Vietnam-era service and casualty exposure.</p></div></div></GlassCard>;
}

type QuizQuestion = { prompt: string; options: string[]; answer: string; note: string };
function buildQuiz(conflicts: WarCostsRow[], presidents: WarCostsRow[]): QuizQuestion[] {
  const questions: QuizQuestion[] = conflicts.filter((row) => wcConflictCost(row) > 0).slice(0, 12).map((row, index) => {
    const correct = wcConflictName(row);
    const distractors = conflicts.filter((item) => wcConflictId(item) !== wcConflictId(row)).slice(index + 1, index + 4).map(wcConflictName);
    return { prompt: `Which conflict has an adjusted WarCosts estimate closest to ${wcMoney(wcConflictCost(row))}?`, options: [correct, ...distractors].sort(), answer: correct, note: `${wcInteger(wcConflictDeaths(row))} US deaths in the mirrored record.` };
  });
  for (const row of conflicts.filter((item) => wcConflictDeaths(item) > 0).slice(0, 4)) {
    const correct = wcConflictName(row);
    const others = conflicts.filter((item) => wcConflictId(item) !== wcConflictId(row) && wcConflictDeaths(item) > 0).slice(0, 3).map(wcConflictName);
    questions.push({ prompt: `Which conflict records ${wcInteger(wcConflictDeaths(row))} US deaths?`, options: [correct, ...others].sort(), answer: correct, note: "Generated from conflicts.json." });
  }
  for (const row of presidents.slice(0, 4)) {
    const name = wcText(row, "name", "president", "fullName");
    const cost = wcNumber(row, "warCostAdjusted2024", "totalCost");
    if (!name || !cost) continue;
    const others = presidents.filter((item) => wcText(item, "name", "president", "fullName") !== name).slice(0, 3).map((item) => wcText(item, "name", "president", "fullName")).filter(Boolean);
    questions.push({ prompt: `Which president's record carries roughly ${wcMoney(cost)} in war cost?`, options: [name, ...others].sort(), answer: name, note: "Generated from presidents.json." });
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
  if (finished) return <GlassCard className="p-8 text-center"><Trophy className="mx-auto text-amber-200" /><p className="mt-4 text-4xl font-black">{score}/{questions.length}</p><button onClick={reset} className="mt-5 min-h-10 rounded-xl border border-cyan-200/20 bg-cyan-300/8 px-4 text-[10px] font-bold">Play again</button></GlassCard>;
  return <GlassCard className="p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider text-cyan-100/35">Question {index + 1} of {questions.length}</p><h3 className="mt-1 text-lg font-black">Advanced War Quiz</h3></div><div className="flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-300/8 px-3 py-2 text-xs font-black"><Clock3 size={14} />{seconds}s</div></div><p className="mt-5 text-sm font-bold leading-6">{question.prompt}</p><div className="mt-4 grid gap-2 md:grid-cols-2">{question.options.map((option) => <button key={option} disabled={Boolean(answer)} onClick={() => { setAnswer(option); if (option === question.answer) setScore((value) => value + 1); }} className={`min-h-12 rounded-xl border p-3 text-left text-xs font-bold ${answer === option ? option === question.answer ? "border-emerald-200/30 bg-emerald-300/10" : "border-rose-200/30 bg-rose-300/10" : answer && option === question.answer ? "border-emerald-200/25 bg-emerald-300/[.06]" : "border-white/8 bg-black/10"}`}>{option}</button>)}</div>{answer && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[10px] text-cyan-100/45">{question.note}</p><button onClick={advance} className="rounded-lg border border-cyan-200/20 px-3 py-2 text-[10px] font-bold">Next</button></div>}</GlassCard>;
}

function AidCalculator({ aidRows }: { aidRows: WarCostsRow[] }) {
  const [income, setIncome] = useState(75_000);
  const tax = federalTax(income), military = tax * .24, foreignAidTax = tax * .013;
  const ranked = useMemo(() => [...aidRows].sort((a, b) => wcNumber(b, "aid") - wcNumber(a, "aid")), [aidRows]);
  const total = ranked.reduce((sum, row) => sum + wcNumber(row, "aid"), 0) || 55_000_000_000;
  const top = ranked.slice(0, 9);
  const shownTotal = top.reduce((sum, row) => sum + wcNumber(row, "aid"), 0);
  const otherShare = Math.max(0, 1 - shownTotal / total);
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Foreign Aid Tax Calculator</h3><p className="mt-1 text-xs text-cyan-100/42">Federal tax → military share → foreign-aid share, then allocated across the mirrored recipient mix.</p><label className="mt-5 block text-[10px] uppercase text-cyan-100/40">Annual income<input type="number" min={0} value={income} onChange={(e) => setIncome(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3" /></label><div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Federal income tax" value={wcMoney(tax)} note="2024 single-filer method" /><Metric label="Military spending" value={wcMoney(military)} note="24% baseline" /><Metric label="Foreign aid" value={wcMoney(foreignAidTax)} note="source-style allocation" /><Metric label="Everything else" value={wcMoney(Math.max(0, tax - military))} note="remaining federal income tax" /></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Tomahawk equivalent" value={(military / 2_000_000).toFixed(3)} note="$2M each" /><Metric label="Teacher salary equivalent" value={(military / 65_000).toFixed(2)} note="$65K / year" /></div><div className="mt-5 grid gap-2 md:grid-cols-2">{top.map((row) => { const aid = wcNumber(row, "aid"); const share = total > 0 ? aid / total : 0; return <div key={wcText(row, "country", "name", "slug")} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 p-3 text-xs"><div><p className="font-bold">{wcText(row, "country", "name")}</p><p className="mt-1 text-[9px] text-cyan-100/35">{(share * 100).toFixed(1)}% of mirrored aid</p></div><strong>{wcMoney(foreignAidTax * share)}</strong></div>; })}{otherShare > 0 && <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 p-3 text-xs"><div><p className="font-bold">Other recipients</p><p className="mt-1 text-[9px] text-cyan-100/35">{(otherShare * 100).toFixed(1)}% of mirrored aid</p></div><strong>{wcMoney(foreignAidTax * otherShare)}</strong></div>}</div></GlassCard>;
}

function spendingValue(row: WarCostsRow): number {
  const value = wcNumber(row, "spending", "militarySpending", "amount", "value");
  return value > 0 && value < 1_000_000 ? value * 1_000_000_000 : value;
}

function historyPoints(row: WarCostsRow): HistoryPoint[] {
  const candidates = [row.history, row.yearly, row.spendingHistory, row.trendData];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const points = candidate.map((item): HistoryPoint | null => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const record = item as WarCostsRow;
        const year = wcNumber(record, "year");
        const value = wcNumber(record, "spending", "amount", "value", "militarySpending");
        return year && value ? { year, value } : null;
      }).filter((item): item is HistoryPoint => Boolean(item));
      if (points.length >= 2) return points.sort((a, b) => a.year - b.year);
    }
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const points = Object.entries(candidate as Record<string, unknown>).map(([yearKey, value]): HistoryPoint | null => {
        const year = Number(yearKey);
        const amount = finiteNumber(value);
        return Number.isFinite(year) && amount ? { year, value: amount } : null;
      }).filter((item): item is HistoryPoint => Boolean(item));
      if (points.length >= 2) return points.sort((a, b) => a.year - b.year);
    }
  }
  const keyed = Object.entries(row).map(([key, value]): HistoryPoint | null => {
    const match = key.match(/(?:spending|amount|budget)?[_-]?(20\d{2})$/i);
    if (!match) return null;
    const amount = finiteNumber(value);
    return amount ? { year: Number(match[1]), value: amount } : null;
  }).filter((item): item is HistoryPoint => Boolean(item));
  return keyed.sort((a, b) => a.year - b.year);
}

function tenYearTrend(row: WarCostsRow): number | null {
  for (const key of ["tenYearTrend", "trend10yr", "trend10Year", "change10yr", "tenYearChange", "trend10y"] as const) {
    const value = finiteNumber(row[key]);
    if (value || row[key] === 0 || row[key] === "0") return value;
  }
  const points = historyPoints(row);
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const target = latest.year - 10;
  const baseline = [...points].reverse().find((point) => point.year <= target) ?? points[0];
  return baseline.value > 0 ? ((latest.value - baseline.value) / baseline.value) * 100 : null;
}

function CountryComparator({ countries, bases }: { countries: WarCostsRow[]; bases: WarCostsRow[] }) {
  const rankedCountries = useMemo(() => [...countries].sort((a, b) => spendingValue(b) - spendingValue(a)), [countries]);
  const names = useMemo(() => rankedCountries.map((row) => wcText(row, "country", "name")).filter(Boolean), [rankedCountries]);
  const [left, setLeft] = useState(names[0] ?? "United States"), [right, setRight] = useState(names[1] ?? "China");
  useEffect(() => { if (!names.length) return; if (!names.includes(left)) setLeft(names[0]); if (!names.includes(right)) setRight(names[1] ?? names[0]); }, [left, right, names]);
  const pick = (name: string) => rankedCountries.find((row) => wcText(row, "country", "name") === name) ?? {};
  const base = (name: string) => bases.find((row) => wcText(row, "country", "name", "countryName").toLowerCase() === name.toLowerCase()) ?? {};
  const rank = (name: string) => { const index = rankedCountries.findIndex((row) => wcText(row, "country", "name") === name); return index >= 0 ? index + 1 : 0; };
  const a = pick(left), b = pick(right), aSpend = spendingValue(a), bSpend = spendingValue(b);
  const aTrend = tenYearTrend(a), bTrend = tenYearTrend(b);
  const trendLabel = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  const rows = [
    ["Military spending",wcMoney(aSpend),wcMoney(bSpend)],
    ["Global rank",rank(left) ? `#${rank(left)}` : "—",rank(right) ? `#${rank(right)}` : "—"],
    ["10-year trend",trendLabel(aTrend),trendLabel(bTrend)],
    ["% GDP",`${wcNumber(a,"gdpPercent","percentGdp","gdpShare") || "—"}%`,`${wcNumber(b,"gdpPercent","percentGdp","gdpShare") || "—"}%`],
    ["Per capita",wcNumber(a,"perCapita","spendingPerCapita") ? wcMoney(wcNumber(a,"perCapita","spendingPerCapita")) : "—",wcNumber(b,"perCapita","spendingPerCapita") ? wcMoney(wcNumber(b,"perCapita","spendingPerCapita")) : "—"],
    ["Global share",`${wcNumber(a,"globalShare","percentWorld","worldShare") || "—"}%`,`${wcNumber(b,"globalShare","percentWorld","worldShare") || "—"}%`],
    ["US base presence",wcInteger(wcNumber(base(left),"total","bases","installations")),wcInteger(wcNumber(base(right),"total","bases","installations"))],
  ];
  return <GlassCard className="p-5"><h3 className="text-lg font-black">Country Military Comparator</h3><p className="mt-1 text-xs text-cyan-100/42">Current budget, global rank, 10-year trend, GDP share, per-capita spending and US base presence.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><select value={left} onChange={(e) => setLeft(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{names.map((name) => <option key={name}>{name}</option>)}</select><select value={right} onChange={(e) => setRight(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#07101c] px-3">{names.map((name) => <option key={name}>{name}</option>)}</select></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[660px] text-xs"><tbody>{rows.map(([metric,av,bv]) => <tr key={metric} className="border-t border-white/8"><td className="p-3 text-cyan-100/45">{metric}</td><td className="p-3 font-bold">{av}</td><td className="p-3 font-bold">{bv}</td></tr>)}</tbody></table></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-cyan-100/10 bg-cyan-300/[.04] p-4 text-xs"><strong>{left}</strong> spends {bSpend > 0 ? `${(aSpend / bSpend).toFixed(2)}×` : "—"} as much as <strong>{right}</strong>.</div><div className="rounded-xl border border-white/8 bg-black/10 p-4 text-xs text-cyan-50/65">Trend is taken from a source 10-year field when present; otherwise it is derived only from the row’s source history. No history means “—”.</div></div></GlassCard>;
}

function HormuzCalculator() {
  const [days, setDays] = useState(30);
  const bounded = Math.max(1, Math.min(180, days));
  const gdpLoss = bounded * 3.5e9, oil = 108 + bounded * .5, gas = 3.8 + bounded * .02, shipping = bounded;
  const comparisons = [["Public schools",gdpLoss/40e6],["Hospitals / year",gdpLoss/200e6],["Homes",gdpLoss/350000],["Teacher-years",gdpLoss/65000],["4-year scholarships",gdpLoss/100000]] as const;
  return <GlassCard className="p-5"><div className="flex items-center gap-2"><ShipWheel size={18} className="text-amber-200/70" /><h3 className="text-lg font-black">Strait of Hormuz Impact Calculator</h3></div><p className="mt-1 text-xs text-cyan-100/42">Duration-based GDP, oil, gasoline and freight scenario using WarCosts’ displayed assumptions.</p><label className="mt-5 block text-[10px] uppercase text-cyan-100/40">Closure duration: {bounded} days<input type="range" min={1} max={180} value={bounded} onChange={(e) => setDays(Number(e.target.value))} className="mt-3 w-full" /></label><div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Global GDP loss" value={wcMoney(gdpLoss)} note="$3.5B / day" /><Metric label="Projected oil" value={`$${oil.toFixed(0)}/bbl`} note="$108 starting point" /><Metric label="US gas" value={`$${gas.toFixed(2)}/gal`} note="scenario projection" /><Metric label="Shipping costs" value={`+${shipping}%`} note="freight scenario" /></div><div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{comparisons.map(([label,value]) => <div key={label} className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-lg font-black">{wcInteger(value)}</p><p className="mt-1 text-[9px] text-cyan-100/35">{label}</p></div>)}</div></GlassCard>;
}

const FIRST_MONTH_ROWS = [
  ["Cost", "$50B+", "$5B"], ["US Deaths", "15", "139"], ["US Wounded", "303", "~500"], ["Civilian Deaths", "3,300+", "~7,000"],
  ["Countries Involved", "12+", "39-nation coalition"], ["Congressional Vote", "NO vote", "296-133 (H) / 77-23 (S)"],
  ["Coalition", "No formal coalition", "39-nation Coalition of the Willing"], ["Oil Price Impact", "$60 → $108", "$25 → $37"], ["Public Support", "56% oppose", "72% support"],
] as const;

function IranVsIraq({ conflicts }: { conflicts: WarCostsRow[] }) {
  const [mode, setMode] = useState<IranCompareMode>("first-month");
  const iran = conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iran") && wcNumber(row,"startYear") >= 2025) ?? conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iran")) ?? {};
  const iraq = conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iraq") && wcNumber(row,"startYear") >= 2000) ?? conflicts.find((row) => wcConflictName(row).toLowerCase().includes("iraq")) ?? {};
  const totalRows = [["Adjusted / total cost",wcMoney(wcConflictCost(iran)),wcMoney(wcConflictCost(iraq))],["US deaths",wcInteger(wcConflictDeaths(iran)),wcInteger(wcConflictDeaths(iraq))],["Civilian deaths",wcInteger(wcCivilianDeaths(iran)),wcInteger(wcCivilianDeaths(iraq))],["Congressional authorization",iran.congressionalAuth === true ? "Yes" : iran.congressionalAuth === false ? "No" : "—",iraq.congressionalAuth === true ? "Yes" : iraq.congressionalAuth === false ? "No" : "—"],["Outcome / status",wcText(iran,"outcome","status") || "—",wcText(iraq,"outcome","status") || "—"]];
  const rows = mode === "first-month" ? FIRST_MONTH_ROWS : totalRows;
  return <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-2"><GitCompareArrows size={18} className="text-rose-200/70" /><div><h3 className="text-lg font-black">Iran vs Iraq</h3><p className="mt-1 text-xs text-cyan-100/42">Two source views: WarCosts’ published first-month snapshot and the mirrored full-conflict record.</p></div></div><div className="flex gap-2"><button type="button" onClick={() => setMode("first-month")} className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${mode === "first-month" ? "border-rose-200/25 bg-rose-300/10" : "border-white/8 bg-black/10"}`}>First Month</button><button type="button" onClick={() => setMode("total")} className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${mode === "total" ? "border-rose-200/25 bg-rose-300/10" : "border-white/8 bg-black/10"}`}>Projected / Total</button></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35"><th className="p-2">Metric</th><th className="p-2">Iran War (2026)</th><th className="p-2">Iraq War (2003)</th></tr></thead><tbody>{rows.map(([metric,a,b]) => <tr key={String(metric)} className="border-t border-white/8"><td className="p-3 text-cyan-100/45">{metric}</td><td className="max-w-[300px] p-3 font-bold">{String(a)}</td><td className="max-w-[300px] p-3 font-bold">{String(b)}</td></tr>)}</tbody></table></div>{mode === "first-month" ? <div className="mt-4 grid gap-3 xl:grid-cols-2"><div className="rounded-xl border border-rose-200/10 bg-rose-300/[.04] p-4"><p className="text-xs font-black">Iran — first-month differences</p><p className="mt-2 text-[10px] leading-5 text-rose-50/60">No congressional authorization · no formal international coalition · dramatically higher first-month burn rate · majority opposition from the outset · immediate oil shock.</p></div><div className="rounded-xl border border-cyan-200/10 bg-cyan-300/[.04] p-4"><p className="text-xs font-black">Iraq — first-month context</p><p className="mt-2 text-[10px] leading-5 text-cyan-50/60">Congressional authorization · 39-nation launch coalition · high initial public support · ultimately an 8+ year conflict with far larger cumulative costs.</p></div></div> : <p className="mt-4 text-[10px] leading-5 text-cyan-100/38">Projected / Total mode intentionally uses the current mirrored conflict records instead of freezing the first-month snapshot into a second supposedly live view.</p>}</GlassCard>;
}

export default function WarCostsSpecialTools() {
  const [active, setActive] = useState<Tool>("budget");
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState("");
  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const pairs = await Promise.all(DATASETS.map(async (name) => { try { return [name, await getWarCostsDataset(name, force)] as const; } catch { return [name, null] as const; } }));
      const next: Record<string, WarCostsDatasetResponse> = {};
      for (const [name,response] of pairs) if (response) next[name] = response;
      setResponses(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Specialized WarCosts tools could not load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => { void load(false); }, []);
  const data = useMemo(() => Object.fromEntries(Object.entries(responses).map(([name,response]) => [name,response.data])) as Record<string,unknown>, [responses]);
  const stateRows = wcRows(data["state-military-index.json"]).length ? wcRows(data["state-military-index.json"]) : wcRows(data["state-footprint.json"]);
  const tools: Array<{ key: Tool; label: string; note: string; icon: typeof Calculator }> = [
    { key:"budget", label:"Budget Simulator", note:"Nine category sliders", icon:SlidersHorizontal },
    { key:"personal", label:"Personal War Cost", note:"Birth year + state + alternatives", icon:Calculator },
    { key:"inflation", label:"Inflation", note:"War + GDP equivalent + amount/year", icon:Calculator },
    { key:"draft", label:"Draft Simulator", note:"Full six-field profile", icon:Activity },
    { key:"quiz", label:"Advanced Quiz", note:"20 questions · 15 seconds", icon:Trophy },
    { key:"aid", label:"Aid Tax", note:"Tax share by recipient", icon:Calculator },
    { key:"countries", label:"Compare Countries", note:"Rank + 10-year trend + bases", icon:GitCompareArrows },
    { key:"hormuz", label:"Hormuz Impact", note:"Oil, GDP, gas & freight", icon:ShipWheel },
    { key:"iran-iraq", label:"Iran vs Iraq", note:"First month + total", icon:Activity },
  ];
  return <main className="aurora-bg min-h-screen text-white"><Sidebar /><section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="WarCosts Intelligence" title="Specialized Tools" subtitle="Canonical implementations of WarCosts’ deeper calculators and comparison experiences." /><button onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh source data</button></div><WarCostsWorkspaceNav />{error && <GlassCard className="mt-5 border-rose-300/20 p-4 text-sm text-rose-100">{error}</GlassCard>}{loading ? <GlassCard className="mt-5 grid min-h-[400px] place-items-center"><Loader2 className="animate-spin text-cyan-200" /></GlassCard> : <div className="mt-5 space-y-5"><section className="grid gap-3 md:grid-cols-3 xl:grid-cols-9">{tools.map((tool) => { const Icon = tool.icon; return <button key={tool.key} onClick={() => setActive(tool.key)} className={`rounded-2xl border p-4 text-left transition ${active === tool.key ? "border-cyan-200/28 bg-cyan-300/12" : "border-white/8 bg-black/10 hover:bg-white/[.035]"}`}><Icon size={18} className={active === tool.key ? "text-cyan-100" : "text-cyan-100/40"} /><p className="mt-3 text-xs font-black">{tool.label}</p><p className="mt-1 text-[9px] leading-4 text-cyan-100/35">{tool.note}</p></button>; })}</section>{active === "budget" && <BudgetSimulator />}{active === "personal" && <PersonalWarCost spending={wcRows(data["military-spending.json"])} stateRows={stateRows} />}{active === "inflation" && <InflationCalculator conflicts={wcRows(data["conflicts.json"])} spending={wcRows(data["military-spending.json"])} />}{active === "draft" && <DraftSimulator draftSource={data["draft-analysis.json"]} />}{active === "quiz" && <AdvancedQuiz conflicts={wcRows(data["conflicts.json"])} presidents={wcRows(data["presidents.json"])} />}{active === "aid" && <AidCalculator aidRows={wcRows(data["foreign-aid.json"])} />}{active === "countries" && <CountryComparator countries={wcRows(data["global-spending.json"])} bases={wcRows(data["base-countries.json"])} />}{active === "hormuz" && <HormuzCalculator />}{active === "iran-iraq" && <IranVsIraq conflicts={wcRows(data["conflicts.json"])} />}</div>}</section></main>;
}
