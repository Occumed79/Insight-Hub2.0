import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LoaderCircle, Search, ShieldCheck, Sparkles } from "lucide-react";
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

const coverageCopy: Record<RuleCoverage, { label: string; copy: string }> = {
  "automated-medical": { label: "Automated medical", copy: "Condition and medication logic is encoded in the server evaluator." },
  "trigger-based": { label: "Trigger-based", copy: "The engine detects program or exposure triggers and routes the reviewer to controlling requirements." },
  reference: { label: "Reference", copy: "Official source is indexed, but the engine does not claim clause-level automation." },
};

const levelTone: Record<FindingLevel, string> = {
  info: "border-slate-500/40 bg-slate-400/[.05] text-slate-200",
  review: "border-sky-400/35 bg-sky-400/[.06] text-sky-100",
  waiver: "border-violet-400/35 bg-violet-400/[.06] text-violet-100",
  strict: "border-rose-400/35 bg-rose-400/[.06] text-rose-100",
};

const triggerFields = [
  ["respiratorRequired", "Required respirator / SCBA"],
  ["hazwoperCovered", "HAZWOPER / HAZMAT covered"],
  ["bloodborneExposure", "Blood / OPIM exposure"],
  ["leadSurveillance", "Lead surveillance"],
  ["asbestosSurveillance", "Asbestos surveillance"],
  ["cadmiumSurveillance", "Cadmium surveillance"],
  ["dotTesting", "DOT-regulated testing"],
] as const;

function numeric(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}

function authorityLabel(value: StandardSource["authority"]) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ReviewerStandardsIntelligencePage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>(["centcom-mod18"]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
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
  const visibleSources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (catalog?.sources ?? []).filter((source) => {
      if (category !== "All" && source.category !== category) return false;
      if (!normalized) return true;
      return [source.shortLabel, source.title, source.category, source.edition, ...source.topics]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [catalog, category, query]);
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
    <main className="reviewer-native-page min-h-screen bg-[#0a0c0f] text-slate-100">
      <Sidebar />
      <section className="min-h-screen lg:ml-[210px]">
        <header className="flex min-h-[72px] items-center justify-between gap-6 border-b border-white/8 bg-[#0c0f13] px-7 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">
              <ShieldCheck size={13} /> Standards registry / evaluator
            </div>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-.035em] text-white">Standards Intelligence</h1>
          </div>
          <div className="flex items-center gap-7 text-right">
            <HeaderMetric label="Registry" value={catalog ? `${catalog.totalSources} sources · ${catalog.architectureVersion}` : "Loading registry"} />
            <HeaderMetric label="Selected" value={String(frameworks.length)} />
            <HeaderMetric label="Matched" value={evaluation ? String(evaluation.coverage.matched) : "—"} />
          </div>
        </header>

        {catalogError ? <div className="border-b border-rose-300/15 bg-rose-400/[.04] px-7 py-2.5 text-[12px] text-rose-100">{catalogError}</div> : null}

        <div className="grid min-h-[calc(100vh-72px)] grid-cols-[minmax(0,1fr)_430px]">
          <section className="min-w-0 border-r border-white/8 bg-[#0a0c0f]">
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-white/8 bg-[#0a0c0f]/95 px-6 py-3 backdrop-blur">
              <label className="relative min-w-[280px] flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  aria-label="Search standards registry"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, topic, category or edition"
                  className="h-9 w-full rounded-md border border-white/10 bg-[#101419] pl-9 pr-3 text-[12px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500/70"
                />
              </label>
              <select
                aria-label="Standards category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-9 min-w-[180px] rounded-md border border-white/10 bg-[#101419] px-3 text-[12px] text-slate-200 outline-none"
              >
                {["All", ...(catalog?.categories ?? [])].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <span className="whitespace-nowrap text-[11px] text-slate-500">{visibleSources.length} shown</span>
            </div>

            <div className="overflow-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="sticky top-[61px] z-10 bg-[#0d1014] text-[10px] uppercase tracking-[.11em] text-slate-500">
                  <tr className="border-b border-white/8">
                    <th className="w-12 px-4 py-3">Use</th>
                    <th className="px-3 py-3 font-semibold">Standard</th>
                    <th className="w-[150px] px-3 py-3 font-semibold">Authority</th>
                    <th className="w-[130px] px-3 py-3 font-semibold">Coverage</th>
                    <th className="w-[150px] px-3 py-3 font-semibold">Edition</th>
                    <th className="w-[120px] px-3 py-3 font-semibold">Verified</th>
                    <th className="w-[54px] px-3 py-3 text-center font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.055]">
                  {visibleSources.map((source) => {
                    const active = frameworks.includes(source.id);
                    return (
                      <tr key={source.id} className={active ? "bg-sky-400/[.035]" : "hover:bg-white/[.018]"}>
                        <td className="px-4 py-3 align-top">
                          <input
                            aria-label={`${active ? "Remove" : "Select"} ${source.shortLabel}`}
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleFramework(source.id)}
                            className="mt-1 h-4 w-4 accent-sky-400"
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <button type="button" onClick={() => toggleFramework(source.id)} className="block max-w-[430px] text-left">
                            <span className="block text-[12px] font-semibold text-slate-100">{source.shortLabel}</span>
                            <span className="mt-0.5 block text-[12px] leading-5 text-slate-400">{source.title}</span>
                            <span className="mt-1 block truncate text-[10px] text-slate-600">{source.topics.slice(0, 4).join(" · ")}</span>
                          </button>
                        </td>
                        <td className="px-3 py-3 align-top text-[11px] leading-5 text-slate-400">{authorityLabel(source.authority)}</td>
                        <td className="px-3 py-3 align-top"><span className="text-[11px] font-medium text-slate-300">{coverageCopy[source.coverage].label}</span></td>
                        <td className="px-3 py-3 align-top text-[11px] leading-5 text-slate-400">{source.edition}</td>
                        <td className="px-3 py-3 align-top text-[11px] text-slate-500">{source.lastVerified}</td>
                        <td className="px-3 py-3 text-center align-top">
                          <a href={source.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${source.shortLabel} official source`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/[.04] hover:text-white"><ExternalLink size={13} /></a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="bg-[#0d1014]">
            <div className="sticky top-0 max-h-screen overflow-y-auto">
              <div className="flex h-[61px] items-center justify-between border-b border-white/8 px-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Case evaluator</p>
                  <h2 className="mt-0.5 text-[14px] font-semibold text-white">Reviewer inputs</h2>
                </div>
                {evaluating ? <LoaderCircle size={16} className="animate-spin text-sky-300" /> : <span className="inline-flex items-center gap-2 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Live</span>}
              </div>

              <div className="space-y-5 p-5">
                <section>
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500">Context</p>
                  <div className="space-y-3">
                    <Field label="Occupation / context" value={values.occupation} onChange={(value) => setValue("occupation", value)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Condition" value={values.condition} onChange={(value) => setValue("condition", value)} placeholder="OSA, asthma…" />
                      <Field label="Medication" value={values.medication} onChange={(value) => setValue("medication", value)} placeholder="Warfarin…" />
                    </div>
                  </div>
                </section>

                <section className="border-t border-white/8 pt-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500">Measurements</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    <Field label="Age" value={values.age} onChange={(value) => setValue("age", value)} type="number" />
                    <Field label="Weight lb" value={values.weightLb} onChange={(value) => setValue("weightLb", value)} type="number" />
                    <Field label="A1c %" value={values.a1c} onChange={(value) => setValue("a1c", value)} type="number" />
                    <Field label="AHI" value={values.ahi} onChange={(value) => setValue("ahi", value)} type="number" />
                    <Field label="PAP %" value={values.papCompliance} onChange={(value) => setValue("papCompliance", value)} type="number" />
                    <Field label="Epworth" value={values.epworth} onChange={(value) => setValue("epworth", value)} type="number" />
                    <Field label="SBP" value={values.sbp} onChange={(value) => setValue("sbp", value)} type="number" />
                    <Field label="DBP" value={values.dbp} onChange={(value) => setValue("dbp", value)} type="number" />
                    <Field label="ASCVD %" value={values.ascvd} onChange={(value) => setValue("ascvd", value)} type="number" />
                  </div>
                  <div className="mt-2.5"><Field label="Noise TWA dBA" value={values.noiseTwaDba} onChange={(value) => setValue("noiseTwaDba", value)} type="number" /></div>
                </section>

                <section className="border-t border-white/8 pt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500">Program / exposure triggers</p>
                  <div className="divide-y divide-white/[.055]">
                    {triggerFields.map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center justify-between gap-3 py-2.5 text-[12px] text-slate-300">
                        <span>{label}</span>
                        <input aria-label={label} type="checkbox" checked={Boolean(flags[key])} onChange={(event) => setFlag(key, event.target.checked)} className="h-4 w-4 accent-sky-400" />
                      </label>
                    ))}
                  </div>
                </section>

                {missingRecommendations.length ? (
                  <section className="border-t border-white/8 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[12px] font-semibold text-violet-100"><Sparkles size={13} />Suggested standards</div>
                      <button type="button" onClick={applyRecommendations} className="h-8 rounded-md border border-violet-300/20 bg-violet-400/[.06] px-3 text-[10px] font-semibold text-violet-100 hover:bg-violet-400/[.10]">Apply suggested standards</button>
                    </div>
                    <div className="mt-2 divide-y divide-white/[.055]">
                      {missingRecommendations.map((item) => {
                        const source = sourceMap.get(item.standardId);
                        return source ? <div key={item.standardId} className="py-2.5"><div className="text-[11px] font-semibold text-white">{source.shortLabel}</div><div className="mt-0.5 text-[11px] leading-4 text-slate-500">{item.reason}</div></div> : null;
                      })}
                    </div>
                  </section>
                ) : null}

                <section className="border-t border-white/8 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500">Matched rules</p>
                    <span className="text-[10px] text-slate-600">{evaluation?.findings.length ?? 0} findings</span>
                  </div>
                  {evaluationError ? <p className="mt-3 text-[11px] leading-5 text-rose-200">{evaluationError}</p> : null}
                  <div className="mt-2 divide-y divide-white/[.055]">
                    {(evaluation?.findings ?? []).map((finding) => <FindingRow key={`${finding.standardId}-${finding.id}`} finding={finding} source={sourceMap.get(finding.standardId)} />)}
                  </div>
                  {!evaluating && !evaluation?.findings.length ? <p className="mt-3 text-[11px] leading-5 text-slate-600">No rule has matched the current scenario yet.</p> : null}
                </section>

                <section className="border-t border-white/8 pt-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300"><ShieldCheck size={13} />Coverage is explicit—not implied.</div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-600">Each registry row declares whether the server carries automated medical logic, trigger routing, or reference-only coverage. The linked controlling source still governs the final determination.</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[9px] leading-4 text-slate-600">
                    {(Object.keys(coverageCopy) as RuleCoverage[]).map((key) => <div key={key}><div className="font-semibold text-slate-400">{coverageCopy[key].label}</div><div className="mt-0.5">{coverageCopy[key].copy}</div></div>)}
                  </div>
                </section>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[9px] font-semibold uppercase tracking-[.11em] text-slate-600">{label}</div><div className="mt-1 whitespace-nowrap text-[11px] font-medium text-slate-300">{value}</div></div>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-[9px] font-semibold uppercase tracking-[.08em] text-slate-600">{label}</span>
      <input aria-label={label} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 h-9 w-full rounded-md border border-white/9 bg-[#11151a] px-2.5 text-[11px] text-slate-100 outline-none placeholder:text-slate-700 focus:border-slate-500/60" />
    </label>
  );
}

function FindingRow({ finding, source }: { finding: StandardFinding; source?: StandardSource }) {
  return (
    <article className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.08em] ${levelTone[finding.level]}`}>{finding.level}</span>
            <span className="text-[9px] font-medium uppercase tracking-[.08em] text-slate-600">{source?.shortLabel || finding.standardId}</span>
          </div>
          <h3 className="mt-2 text-[12px] font-semibold leading-5 text-slate-100">{finding.title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">{finding.summary}</p>
          <p className="mt-1.5 text-[10px] leading-4 text-slate-400"><span className="font-semibold text-slate-500">Action:</span> {finding.action}</p>
          <p className="mt-1 text-[9px] text-slate-600">{finding.citation}</p>
        </div>
        <a href={finding.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${finding.title} source`} className="mt-0.5 shrink-0 text-slate-600 hover:text-white"><ExternalLink size={12} /></a>
      </div>
    </article>
  );
}
