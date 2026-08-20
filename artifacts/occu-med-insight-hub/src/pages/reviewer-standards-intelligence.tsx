import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpenCheck,
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
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import "./reviewer-tool-hierarchy.css";

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
  info: "border-emerald-200/20 bg-emerald-300/[0.07] text-emerald-50/80",
  review: "border-cyan-200/20 bg-cyan-300/[0.07] text-cyan-50/80",
  waiver: "border-violet-200/22 bg-violet-300/[0.08] text-violet-50/85",
  strict: "border-rose-200/22 bg-rose-300/[0.08] text-rose-50/85",
};
const coverageCopy: Record<RuleCoverage, { label: string; copy: string }> = {
  "automated-medical": { label: "Automated medical", copy: "Condition/medication logic is encoded in the server evaluator." },
  "trigger-based": { label: "Trigger-based", copy: "The engine detects program/exposure triggers and routes the reviewer to controlling requirements." },
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
    <main className="aurora-bg reviewer-native-page min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8">
        <HeaderBar
          eyebrow="Standards / Server Intelligence"
          title="Standards Intelligence"
          subtitle="A server-owned standards registry and reviewer engine that separates automated logic from trigger-based and source-reference coverage."
        />

        <div className="rh-stack">
          <section className="rh-primary-action">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="rh-kicker">01 · Standards registry</div>
                <h2 className="rh-section-title">The standards live in the API now—not in this browser bundle.</h2>
                <p className="rh-section-copy">
                  Every available source is surfaced here with authority, edition, evidence freshness, and the exact level of logic the engine claims to automate.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-cyan-100/14 bg-cyan-300/[.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/65">
                {catalog ? `${catalog.totalSources} sources · ${catalog.architectureVersion}` : "Loading registry"}
              </div>
            </div>

            {catalogError ? (
              <div className="mt-5 rounded-2xl border border-rose-200/18 bg-rose-300/[.05] p-4 text-sm text-rose-50/75">{catalogError}</div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {["All", ...(catalog?.categories ?? [])].map((item) => (
                <button key={item} type="button" onClick={() => setCategory(item)} className={`rh-secondary ${category === item ? "!border-cyan-100/28 !bg-cyan-300/[.08] !text-white" : ""}`}>
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleSources.map((source) => {
                const Icon = sourceIcon(source);
                const active = frameworks.includes(source.id);
                const coverage = coverageCopy[source.coverage];
                return (
                  <article key={source.id} className={`rounded-2xl border p-4 transition ${active ? "border-cyan-100/30 bg-gradient-to-br from-cyan-300/[.11] to-violet-300/[.07]" : "border-white/10 bg-white/[.02]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" aria-pressed={active} aria-label={`${active ? "Remove" : "Select"} ${source.shortLabel}`} onClick={() => toggleFramework(source.id)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <Icon size={17} className={active ? "text-cyan-100" : "text-cyan-100/45"} />
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.12em] text-cyan-50/48">{source.category}</span>
                        </div>
                        <strong className="mt-3 block text-sm text-white">{source.shortLabel}</strong>
                        <p className="mt-1 text-[10px] leading-4 text-cyan-100/45">{source.title}</p>
                      </button>
                      {active ? <CircleCheck size={17} className="shrink-0 text-cyan-100/80" /> : null}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-[9px] leading-4 text-cyan-100/38">
                      <div><span className="block font-black uppercase tracking-[.1em] text-cyan-100/55">Edition</span>{source.edition}</div>
                      <div><span className="block font-black uppercase tracking-[.1em] text-cyan-100/55">Coverage</span>{coverage.label}</div>
                      <div><span className="block font-black uppercase tracking-[.1em] text-cyan-100/55">Current as of</span>{source.currentAsOf}</div>
                      <div><span className="block font-black uppercase tracking-[.1em] text-cyan-100/55">Verified</span>{source.lastVerified}</div>
                    </div>
                    <p className="mt-3 text-[10px] leading-5 text-cyan-50/42">{coverage.copy}</p>
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] font-black text-cyan-100/65 hover:text-white">
                      Official source <ExternalLink size={10} />
                    </a>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rh-hero">
            <div className="rh-hero-grid">
              <div className="rh-hero-main">
                <div className="rh-kicker">02 · Reviewer scenario</div>
                <h2 className="rh-section-title">Enter the case and workplace triggers.</h2>
                <p className="rh-section-copy">The server evaluates the selected standards and separately recommends other frameworks that appear relevant to the work context.</p>

                <div className="mt-6 space-y-3">
                  <Field label="Occupation / context" value={values.occupation} onChange={(value) => setValue("occupation", value)} />
                  <Field label="Condition" value={values.condition} onChange={(value) => setValue("condition", value)} placeholder="OSA, asthma, seizure, diabetes…" />
                  <Field label="Medication" value={values.medication} onChange={(value) => setValue("medication", value)} placeholder="Warfarin, insulin, sertraline…" />
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                    <Field label="Age" value={values.age} onChange={(value) => setValue("age", value)} type="number" />
                    <Field label="Weight lb" value={values.weightLb} onChange={(value) => setValue("weightLb", value)} type="number" />
                    <Field label="A1C" value={values.a1c} onChange={(value) => setValue("a1c", value)} type="number" />
                    <Field label="AHI" value={values.ahi} onChange={(value) => setValue("ahi", value)} type="number" />
                    <Field label="PAP compliance %" value={values.papCompliance} onChange={(value) => setValue("papCompliance", value)} type="number" />
                    <Field label="Epworth" value={values.epworth} onChange={(value) => setValue("epworth", value)} type="number" />
                    <Field label="SBP" value={values.sbp} onChange={(value) => setValue("sbp", value)} type="number" />
                    <Field label="DBP" value={values.dbp} onChange={(value) => setValue("dbp", value)} type="number" />
                    <Field label="ASCVD %" value={values.ascvd} onChange={(value) => setValue("ascvd", value)} type="number" />
                    <Field label="Noise TWA dBA" value={values.noiseTwaDba} onChange={(value) => setValue("noiseTwaDba", value)} type="number" />
                  </div>
                </div>

                <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <Toggle label="Required respirator / SCBA" checked={flags.respiratorRequired} onChange={(checked) => setFlag("respiratorRequired", checked)} />
                  <Toggle label="HAZWOPER / HAZMAT covered" checked={flags.hazwoperCovered} onChange={(checked) => setFlag("hazwoperCovered", checked)} />
                  <Toggle label="Blood / OPIM exposure" checked={flags.bloodborneExposure} onChange={(checked) => setFlag("bloodborneExposure", checked)} />
                  <Toggle label="Lead surveillance" checked={flags.leadSurveillance} onChange={(checked) => setFlag("leadSurveillance", checked)} />
                  <Toggle label="Asbestos surveillance" checked={flags.asbestosSurveillance} onChange={(checked) => setFlag("asbestosSurveillance", checked)} />
                  <Toggle label="Cadmium surveillance" checked={flags.cadmiumSurveillance} onChange={(checked) => setFlag("cadmiumSurveillance", checked)} />
                  <Toggle label="DOT-regulated testing" checked={flags.dotTesting} onChange={(checked) => setFlag("dotTesting", checked)} />
                </div>

                {missingRecommendations.length ? (
                  <div className="mt-6 rounded-2xl border border-violet-200/16 bg-violet-300/[.05] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.13em] text-violet-100/72"><Sparkles size={13} />Suggested standards</div>
                        <p className="mt-2 text-xs leading-5 text-violet-50/55">The work context points to additional frameworks. These are suggestions—not silent auto-selection.</p>
                      </div>
                      <button type="button" onClick={applyRecommendations} className="rh-secondary">Apply suggested standards</button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {missingRecommendations.map((item) => {
                        const source = sourceMap.get(item.standardId);
                        return source ? <div key={item.standardId} className="rounded-xl border border-white/10 bg-white/[.02] p-3"><strong className="text-xs">{source.shortLabel}</strong><p className="mt-1 text-[10px] leading-4 text-cyan-100/45">{item.reason}</p></div> : null;
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="rh-hero-side">
                <div className="flex items-center justify-between gap-3">
                  <div className="rh-kicker">03 · Primary determination</div>
                  {evaluating ? <LoaderCircle size={15} className="animate-spin text-cyan-100/55" /> : null}
                </div>
                {evaluationError ? <div className="mt-4 rounded-2xl border border-rose-200/18 bg-rose-300/[.05] p-4 text-xs leading-5 text-rose-50/75">{evaluationError}</div> : null}
                {primary ? (
                  <FindingCard finding={primary} source={sourceMap.get(primary.standardId)} primary />
                ) : (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.02] p-5 text-sm leading-6 text-cyan-100/50">
                    {evaluating ? "Evaluating the selected standards…" : "No rule has matched the current scenario yet."}
                  </div>
                )}
              </aside>
            </div>
          </section>

          <section className="rh-support-grid">
            <div className="rh-card is-full">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="rh-label">04 · Supporting matched rules</div>
                  <h3 className="mt-2">{supporting.length} supporting finding{supporting.length === 1 ? "" : "s"} across {frameworks.length} selected framework{frameworks.length === 1 ? "" : "s"}</h3>
                </div>
                <span className="rounded-full border border-cyan-100/14 px-3 py-1 text-[9px] font-black uppercase tracking-[.13em] text-cyan-100/60">
                  {evaluation ? `${evaluation.coverage.matched} frameworks matched` : "Server evaluator"}
                </span>
              </div>
              {supporting.length ? (
                <div className="mt-5 grid gap-3 xl:grid-cols-2">
                  {supporting.map((finding) => <FindingCard key={`${finding.standardId}-${finding.id}`} finding={finding} source={sourceMap.get(finding.standardId)} />)}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-cyan-100/48">The primary determination is the only matched rule for the current scenario.</p>
              )}
            </div>

            <div className="rh-card is-full">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="rh-label">05 · Source governance</div>
                  <h3 className="mt-2">Coverage is explicit—not implied.</h3>
                  <p className="mt-3 max-w-3xl">A source being available does not mean every clause is automated. Each registry record says whether the engine carries medical rule logic, detects a program trigger, or indexes the official source for reviewer use.</p>
                </div>
                <ShieldCheck className="text-cyan-100/48" />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {(Object.keys(coverageCopy) as RuleCoverage[]).map((key) => <div key={key} className="rounded-2xl border border-white/10 bg-white/[.02] p-4"><strong className="text-xs text-white">{coverageCopy[key].label}</strong><p className="mt-2 text-[10px] leading-5 text-cyan-100/45">{coverageCopy[key].copy}</p></div>)}
              </div>
            </div>

            <div className="rh-card is-full is-quiet">
              <div className="rh-label">Interpretation boundary</div>
              <p className="mt-2">The server engine surfaces reviewer logic, workplace-program triggers, escalation pathways, and citations. The linked current controlling source still governs the final operational or medical determination.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function FindingCard({ finding, source, primary = false }: { finding: StandardFinding; source?: StandardSource; primary?: boolean }) {
  return (
    <article className={primary ? "rh-result mt-4" : "rounded-2xl border border-white/10 bg-white/[.022] p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] ${tone[finding.level]}`}>{finding.level}</span>
        {source ? <span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-cyan-50/55">{source.shortLabel}</span> : null}
        {!primary ? finding.topics.slice(0, 2).map((topic) => <span key={topic} className="text-[9px] text-violet-100/42">{topic}</span>) : null}
      </div>
      <h3 className={primary ? "mt-5 text-2xl font-black leading-tight" : "mt-3 text-sm font-black"}>{finding.title}</h3>
      <p className={primary ? "rh-result-copy" : "mt-2 text-xs leading-5 text-cyan-100/54"}>{finding.summary}</p>
      <div className={`${primary ? "mt-5 rounded-2xl" : "mt-3 rounded-xl"} border border-cyan-100/8 bg-cyan-300/[.025] p-3 text-xs leading-5 text-cyan-50/62`}><strong>Reviewer action:</strong> {finding.action}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-cyan-100/36">{finding.citation}</span>
        <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black text-cyan-100/64 hover:text-white">Source <ExternalLink size={10} /></a>
      </div>
    </article>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="block"><span className="rh-label">{label}</span><input aria-label={label} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="rh-input mt-1.5" /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${checked ? "border-cyan-100/25 bg-cyan-300/[.06]" : "border-white/10 bg-white/[.02]"}`}>
      <input aria-label={label} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-cyan-300" />
      <span className="text-[10px] font-bold leading-4 text-cyan-50/70">{label}</span>
    </label>
  );
}
