import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ExternalLink, LoaderCircle, Search, ShieldCheck, Sparkles } from "lucide-react";
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
    <article className="border-b border-white/[.055] py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.08em] ${levelTone[finding.level]}`}>{finding.level}</span>
        <span className="text-[9px] font-medium uppercase tracking-[.08em] text-slate-600">{source?.shortLabel || finding.standardId}</span>
      </div>
      <h3 className="mt-2 text-[12px] font-semibold leading-5 text-slate-100">{finding.title}</h3>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{finding.summary}</p>
      <p className="mt-1.5 text-[10px] leading-4 text-slate-400"><span className="font-semibold text-slate-500">Action:</span> {finding.action}</p>
      <div className="mt-2 flex items-center justify-between gap-3 text-[9px] text-slate-600"><span>{finding.citation}</span><a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:text-white">Source <ExternalLink size={10} /></a></div>
    </article>
  );
}

export default function ReviewerStandardsIntelligencePage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>(["centcom-mod18"]);
  const [selectedStandardId, setSelectedStandardId] = useState("centcom-mod18");
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
    fetch("/api/standards/catalog", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Standards catalog returned ${response.status}`);
        return response.json() as Promise<CatalogResponse>;
      })
      .then((body) => {
        if (!body.ok || !Array.isArray(body.sources)) throw new Error("Standards catalog response was invalid.");
        setCatalog(body);
        setCatalogError("");
        if (!body.sources.some((source) => source.id === selectedStandardId)) setSelectedStandardId(body.sources[0]?.id || "");
      })
      .catch((reason) => { if (!controller.signal.aborted) setCatalogError(reason instanceof Error ? reason.message : "Standards catalog could not be loaded."); });
    return () => controller.abort();
  }, []);

  const requestBody = useMemo(() => ({
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
  }), [flags, frameworks, values]);

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
        if (!controller.signal.aborted) setEvaluationError(reason instanceof Error ? reason.message : "Standards evaluation failed.");
      } finally {
        if (!controller.signal.aborted) setEvaluating(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [catalog, frameworks, requestBody]);

  const sourceMap = useMemo(() => new Map((catalog?.sources ?? []).map((source) => [source.id, source])), [catalog]);
  const visibleSources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (catalog?.sources ?? []).filter((source) => {
      if (category !== "All" && source.category !== category) return false;
      if (!normalized) return true;
      return [source.shortLabel, source.title, source.category, source.edition, ...source.topics].join(" ").toLowerCase().includes(normalized);
    });
  }, [catalog, category, query]);
  const selectedSource = sourceMap.get(selectedStandardId) || visibleSources[0] || catalog?.sources[0] || null;
  const selectedFindings = (evaluation?.findings ?? []).filter((finding) => finding.standardId === selectedSource?.id);
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
    <main className="reviewer-native-page min-h-screen bg-[#090b0e] text-slate-100">
      <Sidebar />
      <section className="min-h-screen lg:ml-[210px]">
        <header className="flex min-h-[68px] items-center justify-between gap-6 border-b border-white/8 bg-[#0c0f13]/92 px-6 py-3 backdrop-blur-xl">
          <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500"><BookOpen size={12} /> Standards library / live evaluator</div><h1 className="mt-1 text-[25px] font-semibold tracking-[-.035em] text-white">Standards Intelligence</h1></div>
          <div className="hidden items-center gap-6 text-right xl:flex"><HeaderMetric label="Registry" value={catalog ? `${catalog.totalSources} sources · ${catalog.architectureVersion}` : "Loading registry"} /><HeaderMetric label="Selected" value={String(frameworks.length)} /><HeaderMetric label="Matched" value={evaluation ? String(evaluation.coverage.matched) : "—"} /></div>
        </header>
        {catalogError ? <div className="border-b border-rose-300/15 bg-rose-400/[.04] px-6 py-2 text-[11px] text-rose-100">{catalogError}</div> : null}

        <div className="grid min-h-[calc(100vh-68px)] grid-cols-[260px_minmax(0,1fr)_390px]">
          <nav className="border-r border-white/8 bg-[#0b0e12]">
            <div className="sticky top-0 max-h-screen overflow-y-auto">
              <div className="border-b border-white/8 p-3">
                <label className="relative block"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" /><input aria-label="Search standards registry" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search standards" className="h-9 w-full rounded-md border border-white/9 bg-[#11151a] pl-8 pr-2 text-[11px] outline-none placeholder:text-slate-700" /></label>
                <select aria-label="Standards category" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-8 w-full rounded-md border border-white/9 bg-[#11151a] px-2 text-[10px] text-slate-300 outline-none">{["All", ...(catalog?.categories ?? [])].map((item) => <option key={item} value={item}>{item}</option>)}</select>
              </div>
              <div className="px-2 py-2">
                {visibleSources.map((source) => {
                  const active = selectedSource?.id === source.id;
                  const enabled = frameworks.includes(source.id);
                  return <button key={source.id} type="button" onClick={() => setSelectedStandardId(source.id)} className={`group mb-1 w-full border-l-2 px-3 py-2.5 text-left transition ${active ? "border-sky-300 bg-sky-400/[.055]" : "border-transparent hover:bg-white/[.02]"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-slate-100">{source.shortLabel}</p><p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-500">{source.title}</p></div><span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${enabled ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200" : "border-white/10 text-transparent"}`}>{enabled ? <Check size={10} /> : null}</span></div><div className="mt-2 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[.1em] text-slate-650"><span>{source.category}</span><span>{coverageCopy[source.coverage].label}</span></div></button>;
                })}
              </div>
            </div>
          </nav>

          <section className="min-w-0 bg-[#090b0e]">
            {selectedSource ? (
              <div className="mx-auto max-w-[920px] px-8 py-8">
                <div className="flex items-start justify-between gap-6 border-b border-white/8 pb-6">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-[9px] font-semibold uppercase tracking-[.12em] text-slate-600"><span>{selectedSource.category}</span><span>•</span><span>{authorityLabel(selectedSource.authority)}</span><span>•</span><span>{selectedSource.edition}</span></div><h2 className="mt-3 text-[31px] font-semibold leading-[1.08] tracking-[-.04em] text-white">{selectedSource.title}</h2><p className="mt-3 text-[13px] leading-6 text-slate-400">{selectedSource.description}</p></div>
                  <div className="shrink-0 text-right"><button onClick={() => toggleFramework(selectedSource.id)} className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[10px] font-semibold ${frameworks.includes(selectedSource.id) ? "border-emerald-300/24 bg-emerald-400/[.06] text-emerald-100" : "border-white/10 text-slate-400"}`}>{frameworks.includes(selectedSource.id) ? <Check size={12} /> : null}{frameworks.includes(selectedSource.id) ? "Selected for case" : "Add to case"}</button><a href={selectedSource.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500 hover:text-white">Official source <ExternalLink size={11} /></a></div>
                </div>

                <div className="grid grid-cols-3 border-b border-white/8 py-5 text-[10px]"><Meta label="Coverage" value={coverageCopy[selectedSource.coverage].label} /><Meta label="Current as of" value={selectedSource.currentAsOf} /><Meta label="Last verified" value={selectedSource.lastVerified} /></div>

                <section className="py-6"><p className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-600">Indexed topics</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{selectedSource.topics.map((topic) => <span key={topic} className="text-[11px] text-slate-400">{topic}</span>)}</div></section>

                <section className="border-t border-white/8 py-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-600">Case relationship</p><h3 className="mt-2 text-[18px] font-semibold text-white">Matched rules from this standard</h3></div><span className="text-[10px] text-slate-600">{selectedFindings.length} findings</span></div><div className="mt-3">{selectedFindings.length ? selectedFindings.map((finding) => <FindingRow key={`${finding.standardId}-${finding.id}`} finding={finding} source={selectedSource} />) : <p className="border-l border-white/10 pl-4 text-[11px] leading-5 text-slate-600">No rule from this standard has matched the current evaluator inputs. The source remains available for reviewer reference.</p>}</div></section>

                <section className="border-t border-white/8 py-6"><div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300"><ShieldCheck size={13} />Coverage is explicit—not implied.</div><p className="mt-2 max-w-3xl text-[11px] leading-5 text-slate-600">{coverageCopy[selectedSource.coverage].copy} The linked controlling source still governs the final determination.</p></section>
              </div>
            ) : <div className="grid min-h-[70vh] place-items-center text-sm text-slate-600">Loading standards registry…</div>}
          </section>

          <aside className="border-l border-white/8 bg-[#0d1014]">
            <div className="sticky top-0 max-h-screen overflow-y-auto">
              <div className="flex h-[58px] items-center justify-between border-b border-white/8 px-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-slate-500">Case evaluator</p><h2 className="mt-0.5 text-[13px] font-semibold text-white">Reviewer inputs</h2></div>{evaluating ? <LoaderCircle size={15} className="animate-spin text-sky-300" /> : <span className="inline-flex items-center gap-2 text-[9px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Live</span>}</div>
              <div className="space-y-5 p-4">
                <section><p className="mb-3 text-[9px] font-semibold uppercase tracking-[.11em] text-slate-500">Context</p><div className="space-y-3"><Field label="Occupation / context" value={values.occupation} onChange={(value) => setValue("occupation", value)} /><div className="grid grid-cols-2 gap-2"><Field label="Condition" value={values.condition} onChange={(value) => setValue("condition", value)} placeholder="OSA, asthma…" /><Field label="Medication" value={values.medication} onChange={(value) => setValue("medication", value)} placeholder="Warfarin…" /></div></div></section>
                <section className="border-t border-white/8 pt-4"><p className="mb-3 text-[9px] font-semibold uppercase tracking-[.11em] text-slate-500">Measurements</p><div className="grid grid-cols-3 gap-2"><Field label="Age" value={values.age} onChange={(value) => setValue("age", value)} type="number" /><Field label="Weight lb" value={values.weightLb} onChange={(value) => setValue("weightLb", value)} type="number" /><Field label="A1c %" value={values.a1c} onChange={(value) => setValue("a1c", value)} type="number" /><Field label="AHI" value={values.ahi} onChange={(value) => setValue("ahi", value)} type="number" /><Field label="PAP %" value={values.papCompliance} onChange={(value) => setValue("papCompliance", value)} type="number" /><Field label="Epworth" value={values.epworth} onChange={(value) => setValue("epworth", value)} type="number" /><Field label="SBP" value={values.sbp} onChange={(value) => setValue("sbp", value)} type="number" /><Field label="DBP" value={values.dbp} onChange={(value) => setValue("dbp", value)} type="number" /><Field label="ASCVD %" value={values.ascvd} onChange={(value) => setValue("ascvd", value)} type="number" /></div><div className="mt-2"><Field label="Noise TWA dBA" value={values.noiseTwaDba} onChange={(value) => setValue("noiseTwaDba", value)} type="number" /></div></section>
                <section className="border-t border-white/8 pt-4"><p className="mb-2 text-[9px] font-semibold uppercase tracking-[.11em] text-slate-500">Program / exposure triggers</p><div className="divide-y divide-white/[.055]">{triggerFields.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-3 py-2.5 text-[11px] text-slate-300"><span>{label}</span><input aria-label={label} type="checkbox" checked={Boolean(flags[key])} onChange={(event) => setFlag(key, event.target.checked)} className="h-4 w-4 accent-sky-400" /></label>)}</div></section>

                {missingRecommendations.length ? <section className="border-t border-white/8 pt-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-violet-100"><Sparkles size={12} />Suggested standards</div><button type="button" onClick={applyRecommendations} className="h-8 rounded-md border border-violet-300/20 bg-violet-400/[.06] px-2.5 text-[9px] font-semibold text-violet-100">Apply suggested standards</button></div><div className="mt-2 divide-y divide-white/[.055]">{missingRecommendations.map((item) => { const source = sourceMap.get(item.standardId); return source ? <button type="button" key={item.standardId} onClick={() => setSelectedStandardId(item.standardId)} className="block w-full py-2.5 text-left"><div className="text-[10px] font-semibold text-white">{source.shortLabel}</div><div className="mt-0.5 text-[10px] leading-4 text-slate-500">{item.reason}</div></button> : null; })}</div></section> : null}

                <section className="border-t border-white/8 pt-4"><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-semibold uppercase tracking-[.11em] text-slate-500">All matched rules</p><span className="text-[9px] text-slate-600">{evaluation?.findings.length ?? 0}</span></div>{evaluationError ? <p className="mt-3 text-[10px] leading-5 text-rose-200">{evaluationError}</p> : null}<div className="mt-2">{(evaluation?.findings ?? []).map((finding) => <FindingRow key={`${finding.standardId}-${finding.id}`} finding={finding} source={sourceMap.get(finding.standardId)} />)}</div>{!evaluating && !evaluation?.findings.length ? <p className="mt-3 text-[10px] leading-5 text-slate-600">No rule has matched the current scenario yet.</p> : null}</section>

                {evaluation?.evaluatedAt ? <p className="border-t border-white/8 pt-3 text-[9px] text-slate-650">Evaluated {new Date(evaluation.evaluatedAt).toLocaleString()}</p> : null}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[8px] font-semibold uppercase tracking-[.11em] text-slate-600">{label}</div><div className="mt-1 whitespace-nowrap text-[10px] font-medium text-slate-300">{value}</div></div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-white/8 px-4 first:pl-0 last:border-r-0"><p className="text-[8px] font-semibold uppercase tracking-[.11em] text-slate-600">{label}</p><p className="mt-1 text-[11px] font-medium text-slate-300">{value}</p></div>;
}
