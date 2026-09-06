import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpenCheck,
  Check,
  CircleCheck,
  ExternalLink,
  Flame,
  FlaskConical,
  LoaderCircle,
  Radar,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Truck,
  Volume2,
} from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";

type FindingLevel = "info" | "review" | "waiver" | "strict";
type RuleCoverage = "automated-medical" | "trigger-based" | "reference";
type StandardSource = {
  id: string;
  shortLabel: string;
  title: string;
  edition: string;
  authority: "official-policy" | "regulation" | "official-guidance" | "consensus-standard";
  category: string;
  sourceUrl: string;
  description: string;
  currentAsOf: string;
  lastVerified: string;
  coverage: RuleCoverage;
  topics: string[];
};
type StandardFinding = {
  id: string;
  standardId: string;
  level: FindingLevel;
  title: string;
  summary: string;
  action: string;
  citation: string;
  sourceUrl: string;
  topics: string[];
  matchedBy: string[];
};
type Recommendation = { standardId: string; reason: string };
type CatalogResponse = {
  ok: boolean;
  architectureVersion: string;
  totalSources: number;
  automatedSources: number;
  categories: string[];
  sources: StandardSource[];
};
type EvaluationResponse = {
  ok: boolean;
  architectureVersion: string;
  evaluatedAt: string;
  selectedSources: StandardSource[];
  findings: StandardFinding[];
  recommendations: Recommendation[];
  coverage: { selected: number; matched: number; automatedSelected: number; referenceSelected: number };
};

const tone: Record<FindingLevel, string> = {
  info: "text-emerald-200 border-emerald-300/22",
  review: "text-cyan-200 border-cyan-300/22",
  waiver: "text-violet-200 border-violet-300/22",
  strict: "text-rose-200 border-rose-300/22",
};

const coverageCopy: Record<RuleCoverage, { label: string; copy: string }> = {
  "automated-medical": { label: "Automated medical", copy: "Condition and medication logic is encoded in the server evaluator." },
  "trigger-based": { label: "Trigger-based", copy: "The engine detects program or exposure triggers and routes the reviewer to controlling requirements." },
  reference: { label: "Reference", copy: "Official source is indexed, but the engine does not claim clause-level automation." },
};

function numeric(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}

function sourceIcon(source: StandardSource) {
  const category = source.category.toLowerCase();
  if (category.includes("transport")) return Truck;
  if (category.includes("aviation")) return Activity;
  if (category.includes("emergency")) return Flame;
  if (category.includes("drug")) return FlaskConical;
  if (source.topics.some((topic) => topic.toLowerCase().includes("noise"))) return Volume2;
  if (category.includes("osha")) return Stethoscope;
  if (category.includes("deployment")) return Radar;
  return BookOpenCheck;
}

export default function ReviewerStandardsIntelligencePage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>(["centcom-mod18"]);
  const [category, setCategory] = useState("All");
  const [values, setValues] = useState<Record<string, string>>({
    occupation: "DoD contractor — CENTCOM deployment",
    condition: "",
    medication: "",
    age: "",
    a1c: "",
    ahi: "",
    papCompliance: "",
    epworth: "",
    sbp: "",
    dbp: "",
    ascvd: "",
    weightLb: "",
    noiseTwaDba: "",
  });
  const [flags, setFlags] = useState<Record<string, boolean>>({
    respiratorRequired: false,
    hazwoperCovered: false,
    bloodborneExposure: false,
    leadSurveillance: false,
    asbestosSurveillance: false,
    cadmiumSurveillance: false,
    dotTesting: false,
  });
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadCatalog() {
      try {
        const response = await fetch("/api/standards/catalog", { signal: controller.signal });
        if (!response.ok) throw new Error(`Standards catalog returned ${response.status}`);
        const body = (await response.json()) as CatalogResponse;
        if (!body.ok || !Array.isArray(body.sources)) throw new Error("Standards catalog response was invalid.");
        setCatalog(body);
        setCatalogError("");
      } catch (reason) {
        if (controller.signal.aborted) return;
        setCatalogError(reason instanceof Error ? reason.message : "Standards catalog could not be loaded.");
      }
    }
    void loadCatalog();
    return () => controller.abort();
  }, []);

  const requestBody = useMemo(
    () => ({
      frameworks,
      occupation: values.occupation || "",
      condition: values.condition || "",
      medication: values.medication || "",
      age: numeric(values.age || ""),
      a1c: numeric(values.a1c || ""),
      ahi: numeric(values.ahi || ""),
      papCompliance: numeric(values.papCompliance || ""),
      epworth: numeric(values.epworth || ""),
      sbp: numeric(values.sbp || ""),
      dbp: numeric(values.dbp || ""),
      ascvd: numeric(values.ascvd || ""),
      weightLb: numeric(values.weightLb || ""),
      noiseTwaDba: numeric(values.noiseTwaDba || ""),
      ...flags,
    }),
    [flags, frameworks, values],
  );

  useEffect(() => {
    if (!catalog || !frameworks.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setEvaluating(true);
      try {
        const response = await fetch("/api/standards/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Standards evaluator returned ${response.status}`);
        const body = (await response.json()) as EvaluationResponse;
        if (!body.ok || !Array.isArray(body.findings)) throw new Error("Standards evaluation response was invalid.");
        setEvaluation(body);
        setEvaluationError("");
      } catch (reason) {
        if (controller.signal.aborted) return;
        setEvaluationError(reason instanceof Error ? reason.message : "Standards evaluation failed.");
      } finally {
        if (!controller.signal.aborted) setEvaluating(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [catalog, frameworks, requestBody]);

  const sourceMap = useMemo(() => new Map((catalog?.sources ?? []).map((source) => [source.id, source])), [catalog]);
  const visibleSources = useMemo(
    () => (catalog?.sources ?? []).filter((source) => category === "All" || source.category === category),
    [catalog, category],
  );
  const primary = evaluation?.findings[0] ?? null;
  const supporting = evaluation?.findings.slice(1) ?? [];
  const missingRecommendations = (evaluation?.recommendations ?? []).filter((item) => !frameworks.includes(item.standardId));

  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const setFlag = (key: string, value: boolean) => setFlags((current) => ({ ...current, [key]: value }));

  function toggleFramework(id: string) {
    setFrameworks((current) => {
      if (!current.includes(id)) return [...current, id];
      if (current.length === 1) return current;
      return current.filter((value) => value !== id);
    });
  }

  function applyRecommendations() {
    const suggested = (evaluation?.recommendations ?? []).map((item) => item.standardId);
    setFrameworks((current) => [...new Set([...current, ...suggested])]);
  }

  return (
    <main className="reviewer-native-page min-h-screen bg-[#050912] pb-16 text-white">
      <Sidebar />
      <section className="relative z-10 px-6 pb-12 pt-7 lg:ml-[210px] lg:px-8 2xl:px-10">
        <header className="border-b border-slate-300/10 pb-5">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Standards / server intelligence</p>
              <h1 className="mt-1 text-[32px] font-black tracking-[-0.04em] text-white">Standards Intelligence</h1>
              <p className="mt-1 max-w-3xl text-[14px] leading-6 text-slate-400">Controlling standards, workplace triggers and reviewer logic in one desktop workbench.</p>
            </div>
            <div className="flex items-end gap-8 text-right">
              <Stat label="Registry" value={catalog ? `${catalog.totalSources} sources · ${catalog.architectureVersion}` : "Loading registry"} />
              <Stat label="Selected" value={String(frameworks.length)} />
              <Stat label="Matched" value={evaluation ? String(evaluation.coverage.matched) : "—"} />
            </div>
          </div>
        </header>

        {catalogError ? <div className="mt-4 border-l-2 border-rose-300/55 bg-rose-300/[.035] px-4 py-3 text-[13px] text-rose-100/80">{catalogError}</div> : null}

        <div className="mt-6 grid gap-8 2xl:grid-cols-[minmax(0,1.15fr)_minmax(440px,.85fr)]">
          <section className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-300/10 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Standards registry</p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-white">Controlling sources</h2>
              </div>
              <div className="flex max-w-full gap-5 overflow-x-auto">
                {["All", ...(catalog?.categories ?? [])].map((item) => (
                  <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 border-b-2 pb-2 text-[12px] font-semibold transition ${category === item ? "border-cyan-200 text-white" : "border-transparent text-slate-500 hover:text-slate-200"}`}>
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-300/8">
              {visibleSources.map((source) => {
                const Icon = sourceIcon(source);
                const active = frameworks.includes(source.id);
                const coverage = coverageCopy[source.coverage];
                return (
                  <article key={source.id} className={`group grid gap-4 py-4 transition xl:grid-cols-[minmax(250px,1fr)_120px_150px_130px_40px] xl:items-center ${active ? "bg-cyan-300/[.025]" : ""}`}>
                    <button type="button" aria-pressed={active} aria-label={`${active ? "Remove" : "Select"} ${source.shortLabel}`} onClick={() => toggleFramework(source.id)} className="flex min-w-0 items-start gap-3 text-left">
                      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${active ? "border-cyan-200/28 bg-cyan-300/[.08] text-cyan-200" : "border-slate-300/10 bg-white/[.018] text-slate-500"}`}><Icon size={15} /></span>
                      <span className="min-w-0">
                        <strong className="block text-[14px] font-bold text-white">{source.shortLabel}</strong>
                        <span className="mt-0.5 block truncate text-[12px] text-slate-500">{source.title}</span>
                        <span className="mt-1.5 block text-[11px] text-slate-600">{source.category}</span>
                      </span>
                    </button>
                    <Meta label="Coverage" value={coverage.label} />
                    <Meta label="Edition" value={source.edition} />
                    <Meta label="Verified" value={source.lastVerified} />
                    <div className="flex items-center justify-end gap-2">
                      {active ? <CircleCheck size={16} className="text-cyan-200" /> : null}
                      <a href={source.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${source.shortLabel} official source`} className="text-slate-600 transition hover:text-slate-200"><ExternalLink size={14} /></a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="min-w-0 2xl:sticky 2xl:top-6 2xl:self-start">
            <div className="overflow-hidden rounded-[22px] border border-slate-300/12 bg-[#07101c]/92 shadow-[0_24px_64px_rgba(0,0,0,.28)]">
              <div className="border-b border-slate-300/10 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Reviewer workbench</p><h2 className="mt-1 text-lg font-black text-white">Case + workplace triggers</h2></div>
                  {evaluating ? <LoaderCircle size={16} className="animate-spin text-cyan-200" /> : <span className="h-2 w-2 rounded-full bg-emerald-300/80 shadow-[0_0_12px_rgba(110,231,183,.35)]" />}
                </div>
              </div>

              <div className="max-h-[calc(100vh-170px)] overflow-y-auto px-5 py-5">
                <div className="space-y-3">
                  <Field label="Occupation / context" value={values.occupation} onChange={(value) => setValue("occupation", value)} />
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-1 3xl:grid-cols-2">
                    <Field label="Condition" value={values.condition} onChange={(value) => setValue("condition", value)} placeholder="OSA, asthma, seizure…" />
                    <Field label="Medication" value={values.medication} onChange={(value) => setValue("medication", value)} placeholder="Warfarin, insulin…" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-2">
                    <Field label="Age" value={values.age} onChange={(value) => setValue("age", value)} type="number" />
                    <Field label="Weight lb" value={values.weightLb} onChange={(value) => setValue("weightLb", value)} type="number" />
                    <Field label="A1C" value={values.a1c} onChange={(value) => setValue("a1c", value)} type="number" />
                    <Field label="ASCVD %" value={values.ascvd} onChange={(value) => setValue("ascvd", value)} type="number" />
                    <Field label="AHI" value={values.ahi} onChange={(value) => setValue("ahi", value)} type="number" />
                    <Field label="PAP compliance %" value={values.papCompliance} onChange={(value) => setValue("papCompliance", value)} type="number" />
                    <Field label="Epworth" value={values.epworth} onChange={(value) => setValue("epworth", value)} type="number" />
                    <Field label="Noise TWA dBA" value={values.noiseTwaDba} onChange={(value) => setValue("noiseTwaDba", value)} type="number" />
                    <Field label="SBP" value={values.sbp} onChange={(value) => setValue("sbp", value)} type="number" />
                    <Field label="DBP" value={values.dbp} onChange={(value) => setValue("dbp", value)} type="number" />
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-300/10 pt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Program / exposure triggers</p>
                  <div className="divide-y divide-slate-300/8">
                    <Toggle label="Required respirator / SCBA" checked={flags.respiratorRequired} onChange={(checked) => setFlag("respiratorRequired", checked)} />
                    <Toggle label="HAZWOPER / HAZMAT covered" checked={flags.hazwoperCovered} onChange={(checked) => setFlag("hazwoperCovered", checked)} />
                    <Toggle label="Blood / OPIM exposure" checked={flags.bloodborneExposure} onChange={(checked) => setFlag("bloodborneExposure", checked)} />
                    <Toggle label="Lead surveillance" checked={flags.leadSurveillance} onChange={(checked) => setFlag("leadSurveillance", checked)} />
                    <Toggle label="Asbestos surveillance" checked={flags.asbestosSurveillance} onChange={(checked) => setFlag("asbestosSurveillance", checked)} />
                    <Toggle label="Cadmium surveillance" checked={flags.cadmiumSurveillance} onChange={(checked) => setFlag("cadmiumSurveillance", checked)} />
                    <Toggle label="DOT-regulated testing" checked={flags.dotTesting} onChange={(checked) => setFlag("dotTesting", checked)} />
                  </div>
                </div>

                {missingRecommendations.length ? (
                  <div className="mt-5 border-t border-violet-300/16 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[12px] font-bold text-violet-100"><Sparkles size={14} />Suggested standards</div>
                      <button type="button" onClick={applyRecommendations} className="rounded-lg border border-violet-300/20 bg-violet-300/[.055] px-3 py-2 text-[11px] font-bold text-violet-100 transition hover:bg-violet-300/[.09]">Apply suggested standards</button>
                    </div>
                    <div className="mt-3 divide-y divide-violet-300/10">
                      {missingRecommendations.map((item) => {
                        const source = sourceMap.get(item.standardId);
                        return source ? <div key={item.standardId} className="py-2.5"><strong className="text-[12px] text-white">{source.shortLabel}</strong><p className="mt-0.5 text-[11px] leading-4 text-slate-400">{item.reason}</p></div> : null;
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 border-t border-slate-300/10 pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Primary determination</p>
                  {evaluationError ? <p className="mt-3 text-[12px] leading-5 text-rose-200">{evaluationError}</p> : null}
                  {primary ? <FindingCard finding={primary} source={sourceMap.get(primary.standardId)} primary /> : <p className="mt-3 text-[13px] leading-6 text-slate-500">{evaluating ? "Evaluating the selected standards…" : "No rule has matched the current scenario yet."}</p>}
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-9 border-t border-slate-300/10 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">Matched rules</p><h2 className="mt-1 text-lg font-black text-white">{supporting.length} supporting finding{supporting.length === 1 ? "" : "s"} across {frameworks.length} selected framework{frameworks.length === 1 ? "" : "s"}</h2></div>
            <p className="text-[12px] text-slate-500">{evaluation ? `${evaluation.coverage.matched} frameworks matched` : "Server evaluator"}</p>
          </div>
          {supporting.length ? <div className="mt-4 divide-y divide-slate-300/8">{supporting.map((finding) => <FindingCard key={`${finding.standardId}-${finding.id}`} finding={finding} source={sourceMap.get(finding.standardId)} />)}</div> : <p className="mt-3 text-[13px] text-slate-500">The primary determination is the only matched rule for the current scenario.</p>}
        </section>

        <section className="mt-8 grid gap-6 border-t border-slate-300/10 pt-6 xl:grid-cols-[1fr_1.25fr]">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-cyan-200/70" /><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">Source governance</p></div>
            <h2 className="mt-2 text-lg font-black text-white">Coverage is explicit—not implied.</h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-400">A source being available does not mean every clause is automated. Each registry record declares exactly what the engine does.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {(Object.keys(coverageCopy) as RuleCoverage[]).map((key) => <div key={key} className="border-l border-slate-300/10 pl-4"><strong className="text-[13px] text-white">{coverageCopy[key].label}</strong><p className="mt-1 text-[12px] leading-5 text-slate-500">{coverageCopy[key].copy}</p></div>)}
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-300/8 pt-4 text-[11px] leading-5 text-slate-600">Interpretation boundary: the server engine surfaces reviewer logic, workplace-program triggers, escalation pathways and citations. The linked current controlling source still governs the final operational or medical determination.</footer>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">{label}</p><p className="mt-1 whitespace-nowrap text-[13px] font-semibold text-slate-300">{value}</p></div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.10em] text-slate-600">{label}</p><p className="mt-1 truncate text-[12px] text-slate-400">{value}</p></div>;
}

function FindingCard({ finding, source, primary = false }: { finding: StandardFinding; source?: StandardSource; primary?: boolean }) {
  return (
    <article className={primary ? "mt-3" : "grid gap-3 py-4 xl:grid-cols-[180px_minmax(0,1fr)_220px] xl:items-start"}>
      {!primary ? <div><span className={`inline-flex border-l-2 pl-2 text-[11px] font-bold uppercase tracking-[0.10em] ${tone[finding.level]}`}>{source?.shortLabel || finding.standardId}</span><p className="mt-2 text-[11px] text-slate-600">{finding.citation}</p></div> : null}
      <div>
        {primary ? <div className="flex items-center gap-2"><span className={`border-l-2 pl-2 text-[11px] font-bold uppercase tracking-[0.10em] ${tone[finding.level]}`}>{source?.shortLabel || finding.standardId}</span><Check size={13} className="text-slate-500" /></div> : null}
        <h3 className={primary ? "mt-3 text-xl font-black leading-tight text-white" : "text-[14px] font-bold text-white"}>{finding.title}</h3>
        <p className={primary ? "mt-2 text-[13px] leading-6 text-slate-400" : "mt-1 text-[12px] leading-5 text-slate-500"}>{finding.summary}</p>
      </div>
      <div className={primary ? "mt-3 border-l border-cyan-300/14 pl-3" : "border-l border-slate-300/8 pl-4"}>
        <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-slate-600">Reviewer action</p>
        <p className="mt-1 text-[12px] leading-5 text-slate-300">{finding.action}</p>
        <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-200/70 hover:text-cyan-100">Source <ExternalLink size={10} /></a>
      </div>
    </article>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="block"><span className="text-[10px] font-bold uppercase tracking-[0.10em] text-slate-600">{label}</span><input aria-label={label} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300/12 bg-[#030914] px-3 text-[13px] text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/[.055]" /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 py-2.5">
      <span className={`text-[12px] font-medium ${checked ? "text-white" : "text-slate-400"}`}>{label}</span>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer accent-cyan-300"
      />
    </label>
  );
}
