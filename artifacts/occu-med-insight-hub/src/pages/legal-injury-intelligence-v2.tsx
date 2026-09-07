import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  Check,
  FileText,
  Gavel,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { useEmployerWorkflow } from "@/components/insight/EmployerWorkflowContext";

type LegalReference = {
  caseName: string;
  docketNumber?: string;
  dateFiled?: string;
  court?: string;
  citation?: string;
  snippet?: string;
  contentSource?: string;
  contentAvailable?: boolean;
  recordType?: "opinion" | "recap";
  documentDescription?: string;
  sourceUrl: string;
};

type LegalPayload = {
  ok: boolean;
  query: string;
  references: LegalReference[];
  sourceUrl: string;
  limitation?: string;
};

type LegalClass = {
  employee: boolean;
  injury: boolean;
  workersComp: boolean;
  occupationalHealth: boolean;
  occupationalDisease: boolean;
  disability: boolean;
  medicalExam: boolean;
  workplaceSafety: boolean;
  dba: boolean;
  tort: boolean;
  relevant: boolean;
};

type ViewMode = "relevant" | "all" | "injury" | "dba" | "employee";

const SAVE_KEY = "insightHub.legal.savedCases.v3";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function classifyLegal(reference: LegalReference): LegalClass {
  const blob = `${reference.caseName} ${reference.documentDescription || ""} ${reference.snippet || ""}`.toLowerCase();
  const employee = /\b(employee|worker|employment|employer|labor|workman|claimant)\b/.test(blob);
  const injury = /\b(injur(?:y|ies|ed)|accident|trauma|fracture|sprain|strain|burn|wound|fatalit|death)\b/.test(blob);
  const workersComp = /workers?[’'\s-]*(?:compensation|comp)|workmen[’'\s-]*comp|compensation claim/.test(blob);
  const occupationalHealth = /occupational\s+(?:health|medicine)|fitness[- ]for[- ]duty|medical surveillance|pre[- ]?employment|pre[- ]?placement/.test(blob);
  const occupationalDisease = /occupational disease|asbest|silicos|mesothelioma|hearing loss|noise exposure|toxic exposure|chemical exposure/.test(blob);
  const disability = /\bdisabilit|impairment|permanent partial|permanent total|functional capacity/.test(blob);
  const medicalExam = /medical exam|medical examination|independent medical|ime\b|physical examination/.test(blob);
  const workplaceSafety = /workplace|work site|worksite|jobsite|osha|safety violation|unsafe condition/.test(blob);
  const dba = /defense base act|longshore|overseas contractor|war hazards/.test(blob);
  const tort = /negligence|wrongful death|premises liability|personal injury|tort/.test(blob);
  const relevant = employee || injury || workersComp || occupationalHealth || occupationalDisease || disability || medicalExam || workplaceSafety || dba || tort;
  return { employee, injury, workersComp, occupationalHealth, occupationalDisease, disability, medicalExam, workplaceSafety, dba, tort, relevant };
}

function date(value?: string) {
  if (!value) return "Not reported";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function readSaved(entity: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") as Record<string, string[]>;
    return Array.isArray(parsed[normalize(entity)]) ? parsed[normalize(entity)] : [];
  } catch { return []; }
}

function writeSaved(entity: string, ids: string[]) {
  if (typeof window === "undefined") return;
  let parsed: Record<string, string[]> = {};
  try { parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); } catch { parsed = {}; }
  parsed[normalize(entity)] = ids;
  localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));
}

function caseId(reference: LegalReference) {
  return `${reference.sourceUrl}|${reference.docketNumber || ""}|${reference.caseName}`;
}

function Tag({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "rose" | "amber" | "violet" | "cyan" | "emerald" }) {
  const styles = {
    slate: "border-white/9 text-slate-500",
    rose: "border-rose-300/18 bg-rose-400/[.045] text-rose-100/70",
    amber: "border-amber-300/18 bg-amber-400/[.045] text-amber-100/70",
    violet: "border-violet-300/18 bg-violet-400/[.045] text-violet-100/70",
    cyan: "border-cyan-300/18 bg-cyan-400/[.045] text-cyan-100/70",
    emerald: "border-emerald-300/18 bg-emerald-400/[.045] text-emerald-100/70",
  };
  return <span className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[.08em] ${styles[tone]}`}>{children}</span>;
}

function ClassificationTags({ classification }: { classification: LegalClass }) {
  return <div className="flex flex-wrap gap-1.5">{classification.workersComp ? <Tag tone="amber">Workers’ compensation</Tag> : null}{classification.dba ? <Tag tone="violet">DBA / overseas contractor</Tag> : null}{classification.injury ? <Tag tone="rose">Injury</Tag> : null}{classification.employee ? <Tag tone="cyan">Employee / workplace</Tag> : null}{classification.occupationalHealth ? <Tag tone="emerald">Occupational health</Tag> : null}{classification.occupationalDisease ? <Tag tone="amber">Occupational disease</Tag> : null}{classification.medicalExam ? <Tag tone="emerald">Medical examination</Tag> : null}{classification.disability ? <Tag tone="violet">Disability / impairment</Tag> : null}{classification.workplaceSafety ? <Tag tone="rose">Workplace safety</Tag> : null}{classification.tort ? <Tag>Tort / negligence</Tag> : null}</div>;
}

export default function LegalInjuryIntelligenceV2() {
  const { context } = useEmployerWorkflow();
  const workflowName = (context.legalName || context.employer || "").trim();
  const [query, setQuery] = useState(workflowName);
  const [data, setData] = useState<LegalPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("relevant");
  const [textFilter, setTextFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const seeded = useRef("");

  async function run(value = query) {
    const clean = value.trim();
    if (!clean) return;
    setQuery(clean);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/public-data/courtlistener?query=${encodeURIComponent(clean)}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "CourtListener request failed.");
      const next = payload as LegalPayload;
      setData(next);
      setSelectedId(next.references.find((reference) => classifyLegal(reference).relevant)?.sourceUrl ? caseId(next.references.find((reference) => classifyLegal(reference).relevant)!) : next.references[0] ? caseId(next.references[0]) : "");
      setSavedIds(readSaved(clean));
    } catch (caught) {
      setData(null);
      setSelectedId("");
      setError(caught instanceof Error ? caught.message : "CourtListener request failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (workflowName) setQuery(workflowName); }, [workflowName]);

  useEffect(() => {
    let cancelled = false;
    if (workflowName || query) return () => { cancelled = true; };
    void fetch("/api/entities/roster", { cache: "no-store" }).then((response) => response.json()).then((payload) => {
      const first = payload?.entities?.[0]?.name;
      if (!cancelled && typeof first === "string" && first.trim()) setQuery(first.trim());
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [workflowName]);

  useEffect(() => {
    const clean = query.trim();
    if (!clean || seeded.current === clean) return;
    seeded.current = clean;
    void run(clean);
  }, [query]);

  const classified = useMemo(() => (data?.references || []).map((reference) => ({ reference, classification: classifyLegal(reference), id: caseId(reference) })), [data]);
  const counts = useMemo(() => ({
    relevant: classified.filter((item) => item.classification.relevant).length,
    injury: classified.filter((item) => item.classification.injury || item.classification.workplaceSafety || item.classification.occupationalDisease).length,
    dba: classified.filter((item) => item.classification.dba).length,
    employee: classified.filter((item) => item.classification.employee).length,
  }), [classified]);
  const visible = useMemo(() => {
    const needle = textFilter.trim().toLowerCase();
    return classified.filter((item) => {
      if (viewMode === "relevant" && !item.classification.relevant) return false;
      if (viewMode === "injury" && !(item.classification.injury || item.classification.workplaceSafety || item.classification.occupationalDisease)) return false;
      if (viewMode === "dba" && !item.classification.dba) return false;
      if (viewMode === "employee" && !item.classification.employee) return false;
      if (!needle) return true;
      const reference = item.reference;
      return [reference.caseName, reference.docketNumber, reference.court, reference.citation, reference.snippet, reference.documentDescription, reference.contentSource]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [classified, textFilter, viewMode]);
  const selected = classified.find((item) => item.id === selectedId) || visible[0] || null;

  function toggleSaved(id: string) {
    const next = savedIds.includes(id) ? savedIds.filter((value) => value !== id) : [...savedIds, id];
    setSavedIds(next);
    writeSaved(data?.query || query, next);
  }

  return (
    <main className="reviewer-native-page min-h-screen bg-[#090c10] text-white">
      <Sidebar />
      <section className="min-h-screen lg:ml-[210px]">
        <div className="px-6 pt-7"><HeaderBar eyebrow="Legal & Injury Intelligence · CourtListener" title="Legal & Injury Intelligence" subtitle="Employee-injury, occupational-health, DBA, disability, safety, and related case evidence is separated from generic company litigation, with the selected case kept in a persistent evidence reader." /></div>
        {error ? <div className="mx-6 mb-3 flex items-start gap-2 border-l-2 border-rose-300/35 pl-3 text-xs leading-5 text-rose-100/74"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</div> : null}

        <div className="grid min-h-[calc(100vh-120px)] grid-cols-[260px_minmax(0,1fr)_390px] border-y border-white/8">
          <aside className="border-r border-white/8 bg-[#0a0e13]/90">
            <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Entity context</p><h2 className="mt-1 text-lg font-black">{data?.query || query || "Legal references"}</h2></div><Gavel className="h-5 w-5 text-violet-100/38" /></div>
              <label className="mt-4 block"><span className="text-[9px] font-black uppercase tracking-[.11em] text-slate-600">Company / entity</span><div className="mt-1.5 flex h-10 items-center gap-2 rounded-md border border-white/9 bg-black/20 px-3"><Search className="h-3.5 w-3.5 text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void run()} placeholder="Entity name" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div></label>
              <button onClick={() => void run()} disabled={loading || !query.trim()} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-violet-300/16 bg-violet-400/[.05] text-[10px] font-black text-violet-100 disabled:opacity-40">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}Refresh CourtListener</button>

              <div className="mt-5 border-t border-white/8 pt-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Case views</p><div className="mt-2 space-y-1">{([
                ["relevant", "Occu-Med relevant", counts.relevant],
                ["injury", "Injury / safety", counts.injury],
                ["dba", "DBA / overseas", counts.dba],
                ["employee", "Employee / workplace", counts.employee],
                ["all", "All company litigation", classified.length],
              ] as Array<[ViewMode, string, number]>).map(([mode, label, count]) => <button key={mode} onClick={() => setViewMode(mode)} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[10px] font-bold ${viewMode === mode ? "bg-violet-400/[.07] text-white" : "text-slate-500 hover:bg-white/[.02]"}`}><span>{label}</span><span className="text-[9px] text-slate-650">{count}</span></button>)}</div></div>

              <div className="mt-5 border-t border-white/8 pt-4"><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Saved case references</p><Bookmark className="h-3.5 w-3.5 text-slate-700" /></div><p className="mt-2 text-[10px] leading-5 text-slate-600">{savedIds.length ? `${savedIds.length} case reference${savedIds.length === 1 ? "" : "s"} saved for this entity.` : "No saved case references yet."}</p></div>

              <div className="mt-5 flex items-start gap-2 border-t border-white/8 pt-4 text-[9px] leading-5 text-slate-600"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Court records are research evidence. A match does not establish injury causation, wrongdoing, liability, employment status, compensability, or the legal significance of a claim.</div>
            </div>
          </aside>

          <section className="min-w-0 bg-[#090c10]/72">
            <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/8 bg-[#0a0e13]/95 px-4 py-3 backdrop-blur-xl"><label className="relative flex-1"><FileText className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" /><input value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="Filter case name, docket, court, citation, evidence text" className="h-9 w-full rounded-md border border-white/9 bg-[#101419] pl-9 pr-3 text-[10px] outline-none placeholder:text-slate-700" /></label><span className="text-[9px] uppercase tracking-[.1em] text-slate-650">{visible.length} cases</span></div>

            {loading && !data ? <div className="grid min-h-[520px] place-items-center"><div className="text-center text-xs text-slate-500"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading CourtListener evidence…</div></div> : visible.length ? <div>{visible.map((item) => {
              const reference = item.reference;
              const selectedRow = selected?.id === item.id;
              return <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`block w-full border-b border-white/[.055] px-4 py-4 text-left transition ${selectedRow ? "bg-violet-400/[.055]" : "hover:bg-white/[.018]"}`}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.09em] text-slate-650"><span>{reference.recordType || "record"}</span><span>•</span><span>{date(reference.dateFiled)}</span>{reference.court ? <><span>•</span><span className="truncate">{reference.court}</span></> : null}</div><h3 className="mt-2 text-[12px] font-black leading-5 text-white">{reference.caseName}</h3><div className="mt-2"><ClassificationTags classification={item.classification} /></div>{reference.snippet ? <p className="mt-3 line-clamp-3 text-[10px] leading-5 text-slate-500">{reference.snippet}</p> : null}</div><span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded border ${savedIds.includes(item.id) ? "border-emerald-300/24 bg-emerald-400/[.06] text-emerald-100" : "border-white/8 text-slate-700"}`}>{savedIds.includes(item.id) ? <Check className="h-3 w-3" /> : null}</span></div></button>;
            })}</div> : <div className="grid min-h-[520px] place-items-center text-center"><div><Gavel className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-4 text-sm font-black text-slate-300">No cases match this view.</p><p className="mt-2 text-xs text-slate-600">Change the entity, case class, or local text filter.</p></div></div>}
          </section>

          <aside className="border-l border-white/8 bg-[#0d1014]/92">
            <div className="sticky top-0 max-h-screen overflow-y-auto p-5">
              {selected ? <>
                <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.13em] text-violet-100/38">Selected case evidence</p><h2 className="mt-2 text-xl font-black leading-6 tracking-[-.025em]">{selected.reference.caseName}</h2><p className="mt-2 text-[10px] text-slate-500">{selected.reference.court || "Court not reported"} · {date(selected.reference.dateFiled)}</p></div><button onClick={() => setSelectedId("")} className="rounded-md border border-white/8 p-1.5 text-slate-600 hover:text-white"><X className="h-3.5 w-3.5" /></button></div>
                <div className="mt-4"><ClassificationTags classification={selected.classification} /></div>

                <div className="mt-5 divide-y divide-white/7 border-y border-white/7 text-[10px]"><Info label="Docket" value={selected.reference.docketNumber || "Not reported"} /><Info label="Citation" value={selected.reference.citation || "Not reported"} /><Info label="Record" value={selected.reference.recordType === "recap" ? "RECAP docket/document" : selected.reference.recordType === "opinion" ? "Opinion / case law" : "CourtListener record"} /><Info label="Content" value={selected.reference.contentAvailable ? "Content surfaced by source" : "Metadata / snippet only"} /><Info label="Source" value={selected.reference.contentSource || "CourtListener"} /></div>

                {selected.reference.snippet ? <section className="mt-5"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Evidence excerpt</p><p className="mt-2 text-[10px] leading-6 text-slate-400">{selected.reference.snippet}</p></section> : null}
                {selected.reference.documentDescription ? <section className="mt-5 border-t border-white/8 pt-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Document</p><p className="mt-2 text-[10px] leading-5 text-slate-500">{selected.reference.documentDescription}</p></section> : null}

                <section className="mt-5 border-t border-white/8 pt-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-600">Why it may matter to Occu-Med</p><p className="mt-2 text-[10px] leading-6 text-slate-400">{matterReason(selected.classification)}</p></section>

                <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => toggleSaved(selected.id)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border text-[10px] font-black ${savedIds.includes(selected.id) ? "border-emerald-300/18 bg-emerald-400/[.05] text-emerald-100" : "border-white/9 text-slate-400"}`}><Bookmark className="h-3.5 w-3.5" />{savedIds.includes(selected.id) ? "Saved" : "Save case"}</button><a href={selected.reference.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-violet-300/16 bg-violet-400/[.045] text-[10px] font-black text-violet-100">Open source <ArrowUpRight className="h-3.5 w-3.5" /></a></div>
              </> : <div className="grid min-h-[520px] place-items-center text-center"><div><Gavel className="mx-auto h-8 w-8 text-slate-700" /><h2 className="mt-4 text-lg font-black">Select a case</h2><p className="mx-auto mt-2 max-w-[270px] text-xs leading-5 text-slate-600">Classification, docket metadata, source evidence, and relevance reasoning stay visible here.</p></div></div>}

              {data?.limitation ? <div className="mt-6 border-l-2 border-amber-300/24 pl-3 text-[9px] leading-5 text-amber-100/56">{data.limitation}</div> : null}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function matterReason(classification: LegalClass) {
  const reasons: string[] = [];
  if (classification.dba) reasons.push("The record references the Defense Base Act or overseas-contractor context, which can expose workforce geography, injury patterns, medical-evidence disputes, or contractor populations relevant to Occu-Med research.");
  if (classification.injury || classification.workplaceSafety) reasons.push("The record contains workplace-injury or safety language that may reveal injury mechanisms, affected jobs, operating locations, or medical evaluation issues.");
  if (classification.occupationalHealth || classification.medicalExam) reasons.push("The record contains occupational-health or medical-examination language that may directly relate to surveillance, fitness-for-duty, or exam requirements.");
  if (classification.occupationalDisease) reasons.push("The record contains exposure or occupational-disease language that may indicate surveillance or specialty-evaluation needs.");
  if (classification.disability) reasons.push("The record includes disability or impairment issues that can provide context for functional or medical-evidence requirements.");
  if (classification.workersComp) reasons.push("The record includes workers’ compensation language. This is treated as injury/evidence intelligence only; Occu-Med is not being modeled as a workers’ compensation claims administrator.");
  if (!reasons.length) reasons.push("This record does not contain one of the configured occupational or injury signals. It remains visible only in the all-litigation view for company context.");
  return reasons.join(" ");
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 py-3"><span className="text-slate-650">{label}</span><strong className="break-words font-semibold text-slate-300">{value}</strong></div>;
}
