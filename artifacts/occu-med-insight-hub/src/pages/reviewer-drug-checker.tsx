import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Atom,
  BookOpen,
  CheckCircle2,
  Layers3,
  Loader2,
  Pill,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { AuroraMolecule } from "@/components/insight/AuroraMolecule";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import "./reviewer-tool-hierarchy.css";

type Drug = { rxcui: string; name: string; score?: number | null };
type MoleculePayload = {
  error?: string;
  pubchemUrl?: string;
  structureImageUrl?: string | null;
  molecule?: Record<string, any>;
};
type DrugSignal = {
  id: string;
  label: string;
  domain: string;
  section: string;
  evidence: string;
  source: string;
};
type DrugIntelligence = {
  ok: boolean;
  error?: string;
  medication: Drug;
  identity: {
    rxcui: string;
    canonicalName: string;
    synonym?: string;
    termType?: string;
    ingredients: string[];
    source: string;
    sourceUrl: string;
  };
  classes: Array<{ classId: string; className: string; classType: string; relationship: string; relationshipSource: string }>;
  fdaClassNames: string[];
  label: null | {
    setId: string;
    effectiveTime: string;
    genericNames: string[];
    brandNames: string[];
    manufacturers: string[];
    routes: string[];
    dosageForms: string[];
    pharmClassEpc: string[];
    pharmClassMoa: string[];
    sections: {
      boxedWarning: string;
      warningsAndCautions: string;
      adverseReactions: string;
      drugInteractions: string;
      contraindications: string;
      precautions: string;
      patientCounseling: string;
      useInSpecificPopulations: string;
    };
    source: string;
    sourceUrl: string;
    dailyMedUrl: string;
  };
  signals: DrugSignal[];
  coverage: { rxnorm: boolean; rxclass: boolean; fdaLabel: boolean; signalCount: number };
  limitation: string;
};
type RegimenReview = {
  ok: boolean;
  error?: string;
  overlaps: Array<{
    id: string;
    label: string;
    domain: string;
    medications: Array<{ rxcui: string; name: string; evidence: string; section: string }>;
  }>;
  interactionMentions: Array<{
    fromRxcui: string;
    fromDrug: string;
    toRxcui: string;
    toDrug: string;
    section: string;
    evidence: string;
  }>;
  coverage: { selected: number; fdaLabels: number; rxClasses: number; medicationsWithSignals: number };
  limitation: string;
};

async function loadJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

function metric(label: string, value: unknown) {
  return <div className="rh-metric"><span>{label}</span><strong>{String(value ?? "—")}</strong></div>;
}

function effectiveDate(value?: string) {
  if (!value) return "Date not supplied";
  if (/^\d{8}$/.test(value)) {
    const parsed = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function LabelSection({ title, value, urgent = false }: { title: string; value?: string; urgent?: boolean }) {
  if (!value) return null;
  return (
    <article className={`rounded-2xl border p-4 ${urgent ? "border-rose-200/20 bg-rose-300/[0.055]" : "border-white/10 bg-white/[0.025]"}`}>
      <div className={`text-[9px] font-black uppercase tracking-[.14em] ${urgent ? "text-rose-100/72" : "text-cyan-100/48"}`}>{title}</div>
      <p className="mt-2 text-[11px] leading-5 text-cyan-50/62">{value}</p>
    </article>
  );
}

export default function ReviewerDrugCheckerPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Drug[]>([]);
  const [selected, setSelected] = useState<Drug[]>([]);
  const [focused, setFocused] = useState<Drug | null>(null);
  const [searching, setSearching] = useState(false);
  const [molecule, setMolecule] = useState<MoleculePayload | null>(null);
  const [moleculeLoading, setMoleculeLoading] = useState(false);
  const [intelligence, setIntelligence] = useState<DrugIntelligence | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [intelligenceError, setIntelligenceError] = useState("");
  const [regimen, setRegimen] = useState<RegimenReview | null>(null);
  const [regimenLoading, setRegimenLoading] = useState(false);
  const [regimenError, setRegimenError] = useState("");

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      loadJson(`/api/reviewer-tools/rxnorm?term=${encodeURIComponent(clean)}`)
        .then((payload) => setResults(payload.candidates || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!focused) {
      setIntelligence(null);
      setIntelligenceError("");
      return;
    }
    let active = true;
    setIntelligenceLoading(true);
    setIntelligenceError("");
    loadJson(`/api/reviewer-tools/drug-intelligence?rxcui=${encodeURIComponent(focused.rxcui)}&name=${encodeURIComponent(focused.name)}`)
      .then((payload) => { if (active) setIntelligence(payload); })
      .catch((error) => { if (active) { setIntelligence(null); setIntelligenceError(error instanceof Error ? error.message : "Live drug intelligence unavailable."); } })
      .finally(() => { if (active) setIntelligenceLoading(false); });
    return () => { active = false; };
  }, [focused]);

  useEffect(() => {
    if (selected.length < 2) {
      setRegimen(null);
      setRegimenError("");
      return;
    }
    let active = true;
    setRegimenLoading(true);
    setRegimenError("");
    postJson("/api/reviewer-tools/drug-regimen", { medications: selected.map(({ rxcui, name }) => ({ rxcui, name })) })
      .then((payload) => { if (active) setRegimen(payload); })
      .catch((error) => { if (active) { setRegimen(null); setRegimenError(error instanceof Error ? error.message : "Regimen review unavailable."); } })
      .finally(() => { if (active) setRegimenLoading(false); });
    return () => { active = false; };
  }, [selected]);

  async function focusDrug(drug: Drug) {
    setFocused(drug);
    setMoleculeLoading(true);
    setMolecule(null);
    try {
      setMolecule(await loadJson(`/api/reviewer-tools/pubchem?name=${encodeURIComponent(drug.name)}`));
    } catch {
      setMolecule({ error: "PubChem molecular record unavailable for this medication name." });
    } finally {
      setMoleculeLoading(false);
    }
  }

  function addDrug(drug: Drug) {
    if (!selected.some((item) => item.rxcui === drug.rxcui)) setSelected((current) => [...current, drug]);
    setQuery("");
    setResults([]);
    void focusDrug(drug);
  }

  function removeDrug(drug: Drug) {
    setSelected((current) => current.filter((item) => item.rxcui !== drug.rxcui));
    if (focused?.rxcui === drug.rxcui) {
      const remaining = selected.filter((item) => item.rxcui !== drug.rxcui);
      if (remaining.length) void focusDrug(remaining[0]);
      else {
        setFocused(null);
        setMolecule(null);
      }
    }
  }

  const structureUrl = molecule?.structureImageUrl ?? null;
  const classNames = useMemo(() => unique([
    ...(intelligence?.fdaClassNames || []),
    ...(intelligence?.classes || []).map((item) => item.className),
  ]).slice(0, 10), [intelligence]);

  return (
    <main className="aurora-bg reviewer-native-page min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8">
        <HeaderBar eyebrow="Medication / Occupational Review" title="Drug Checker" subtitle="Live RxNorm identity, RxClass pharmacology, FDA labeling, PubChem structure, and regimen-level occupational review." />

        <div className="rh-stack">
          <section className="rh-primary-action">
            <div className="rh-kicker">01 · Medication lookup</div>
            <h2 className="rh-section-title">Resolve the medication.</h2>
            <p className="rh-section-copy">Search uses NLM RxNorm. Selecting a result loads live ingredient/class data, FDA label intelligence, the molecular structure, and—when multiple medications are selected—a regimen review.</p>
            <div className="relative mt-5">
              <div className="flex items-center gap-3 rounded-2xl border border-white/16 bg-black/20 px-4">
                {searching ? <Loader2 size={17} className="animate-spin text-cyan-100/55" /> : <Search size={17} className="text-cyan-100/55" />}
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Gabapentin, Eliquis, metoprolol…" className="rh-input !border-0 !bg-transparent !px-0" />
                {query ? <button onClick={() => setQuery("")} className="text-cyan-100/50 hover:text-white" aria-label="Clear medication search"><X size={15} /></button> : null}
              </div>
              {results.length ? (
                <div className="absolute left-0 right-0 top-[58px] z-30 overflow-hidden rounded-2xl border border-cyan-100/16 bg-[#040b18]/98 shadow-2xl backdrop-blur-3xl">
                  {results.map((item) => (
                    <button key={item.rxcui} onClick={() => addDrug(item)} className="flex w-full items-center justify-between gap-4 border-b border-white/8 px-4 py-3 text-left last:border-0 hover:bg-cyan-300/[0.06]">
                      <div><strong className="text-sm">{item.name}</strong><p className="mt-1 text-[10px] text-cyan-100/38">RxCUI {item.rxcui}</p></div>
                      <span className="rounded-full border border-cyan-100/14 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/58">Live source review</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rh-hero">
            <div className="rh-hero-grid">
              <div className="rh-hero-main">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="rh-kicker">02 · Molecular hero</div>
                    <h2 className="rh-section-title">{intelligence?.identity?.canonicalName || focused?.name || "Select a medication"}</h2>
                    <p className="rh-section-copy">{focused ? `RxCUI ${focused.rxcui}` : "The molecular structure and live medication record appear after selection."}</p>
                  </div>
                  <Atom className="mt-1 text-cyan-100/55" />
                </div>

                <div className="rh-molecule-stage mt-6">
                  <span className="rh-molecule-tag">PubChem structure · transparent aurora render</span>
                  {moleculeLoading ? (
                    <div className="rh-molecule-empty"><Loader2 size={22} className="mx-auto mb-3 animate-spin" />Resolving the compound structure…</div>
                  ) : molecule?.error ? (
                    <div className="rh-molecule-empty">{molecule.error}</div>
                  ) : focused && structureUrl ? (
                    <AuroraMolecule src={structureUrl} alt={`PubChem molecular structure for ${focused.name}`} />
                  ) : (
                    <div className="rh-molecule-empty">Search and select a medication. The hero uses the actual PubChem compound structure.</div>
                  )}
                </div>
              </div>

              <aside className="rh-hero-side">
                <div className="rh-kicker">03 · Live review snapshot</div>
                <h3 className="mt-2 text-xl font-black">Source-grounded occupational context</h3>
                {!focused ? <p className="mt-5 text-sm leading-6 text-cyan-100/48">Nothing is inferred until a medication is selected.</p> : intelligenceLoading ? (
                  <div className="mt-6 flex items-center gap-2 text-xs text-cyan-100/52"><Loader2 size={15} className="animate-spin" />Loading RxNorm, RxClass, and FDA labeling…</div>
                ) : intelligenceError ? (
                  <p className="mt-5 text-xs leading-6 text-amber-100/70">{intelligenceError}</p>
                ) : intelligence ? (
                  <>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {classNames.length ? classNames.map((name) => <span key={name} className="rounded-full border border-violet-200/16 bg-violet-300/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-violet-50/75">{name}</span>) : <span className="text-[10px] text-cyan-100/42">No RxClass/FDA class was returned for this RxCUI.</span>}
                    </div>
                    <div className="mt-5 space-y-3">
                      <div className="flex gap-2 text-xs leading-5 text-cyan-100/58"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-cyan-100/55" /><span><strong className="text-cyan-50/80">Ingredients:</strong> {intelligence.identity.ingredients.join(", ") || "not resolved"}</span></div>
                      <div className="flex gap-2 text-xs leading-5 text-cyan-100/58"><BookOpen size={14} className="mt-0.5 shrink-0 text-cyan-100/55" /><span><strong className="text-cyan-50/80">FDA label:</strong> {intelligence.label ? `loaded · effective ${effectiveDate(intelligence.label.effectiveTime)}` : "not resolved"}</span></div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {intelligence.signals.slice(0, 5).map((signal) => <span key={signal.id} className="rounded-full border border-cyan-100/15 bg-cyan-300/[0.055] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em] text-cyan-50/72">{signal.label}</span>)}
                      {!intelligence.signals.length ? <span className="text-[10px] text-cyan-100/42">No configured occupational signal phrase was found in the loaded label sections.</span> : null}
                    </div>
                    <div className="rh-metric-grid mt-6">
                      {metric("Formula", molecule?.molecule?.MolecularFormula)}
                      {metric("Molecular weight", molecule?.molecule?.MolecularWeight)}
                      {metric("Label signals", intelligence.signals.length)}
                      {metric("RxClass matches", intelligence.classes.length)}
                    </div>
                  </>
                ) : null}
              </aside>
            </div>
          </section>

          <section className="rh-card is-full">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="rh-label">04 · FDA label intelligence</div>
                <h3 className="mt-2">Occupationally relevant source signals</h3>
                <p className="mt-2 max-w-3xl">Signals below are detected from current product-label sections and retain the exact section/evidence that triggered them. They are not impairment probabilities or clearance decisions.</p>
              </div>
              <ShieldAlert className="text-cyan-100/48" />
            </div>

            {!focused ? <p className="mt-5">Select a medication to load the label intelligence.</p> : intelligenceLoading ? <div className="mt-5 flex items-center gap-2 text-xs text-cyan-100/48"><Loader2 size={15} className="animate-spin" />Loading live label intelligence…</div> : intelligenceError ? <p className="mt-5 text-amber-100/70">{intelligenceError}</p> : intelligence ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["RxNorm identity", intelligence.coverage.rxnorm],
                    ["RxClass", intelligence.coverage.rxclass],
                    ["FDA product label", intelligence.coverage.fdaLabel],
                    ["Occupational signals", intelligence.signals.length > 0],
                  ].map(([label, ok]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/42">{label}</div><strong className={`mt-1 block text-sm ${ok ? "text-cyan-50" : "text-amber-100/72"}`}>{ok ? "Resolved" : "No match"}</strong></div>)}
                </div>

                {intelligence.signals.length ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {intelligence.signals.map((signal) => (
                      <article key={signal.id} className="rounded-2xl border border-cyan-100/12 bg-cyan-300/[0.035] p-4">
                        <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/44">{signal.domain}</div><h4 className="mt-1 text-sm font-black text-white">{signal.label}</h4></div><Activity size={14} className="shrink-0 text-cyan-100/45" /></div>
                        <p className="mt-3 text-[10px] leading-5 text-cyan-50/58">{signal.evidence}</p>
                        <div className="mt-3 text-[9px] font-bold uppercase tracking-[.1em] text-violet-100/46">FDA · {signal.section}</div>
                      </article>
                    ))}
                  </div>
                ) : <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-cyan-100/48">The loaded FDA label did not trigger one of the configured occupational-review signal categories. This is not evidence that the medication has no occupational implications.</div>}

                {intelligence.label ? (
                  <>
                    <div className="mt-6 grid gap-3 lg:grid-cols-2">
                      <LabelSection title="Boxed warning" value={intelligence.label.sections.boxedWarning} urgent />
                      <LabelSection title="Warnings and precautions" value={intelligence.label.sections.warningsAndCautions} />
                      <LabelSection title="Adverse reactions" value={intelligence.label.sections.adverseReactions} />
                      <LabelSection title="Drug interactions" value={intelligence.label.sections.drugInteractions} />
                      <LabelSection title="Contraindications" value={intelligence.label.sections.contraindications} />
                      <LabelSection title="Patient counseling" value={intelligence.label.sections.patientCounseling} />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3 text-xs font-black">
                      <a href={intelligence.label.dailyMedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-cyan-100/68 hover:text-white">Open DailyMed label <ArrowUpRight size={12} /></a>
                      <a href={intelligence.label.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-cyan-100/68 hover:text-white">Open FDA label API record <ArrowUpRight size={12} /></a>
                      {molecule?.pubchemUrl ? <a href={molecule.pubchemUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-cyan-100/68 hover:text-white">Open PubChem <ArrowUpRight size={12} /></a> : null}
                    </div>
                  </>
                ) : <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-300/[0.04] p-4 text-xs leading-5 text-amber-100/68">No current openFDA Structured Product Label record resolved from this RxCUI/name. RxNorm identity remains available, but no label-derived safety conclusion is made.</div>}
              </>
            ) : null}
          </section>

          <section className="rh-card is-full">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="rh-label">05 · Regimen intelligence</div>
                <h3 className="mt-2">Combined medication burden</h3>
                <p className="mt-2 max-w-3xl">With two or more selected medications, the checker compares label-derived occupational signals and searches each selected FDA Drug Interactions section for explicit mentions of another selected medication or ingredient.</p>
              </div>
              <Layers3 className="text-violet-100/50" />
            </div>

            {selected.length < 2 ? <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-cyan-100/48">Add at least two medications to activate regimen-level review.</div> : regimenLoading ? <div className="mt-5 flex items-center gap-2 text-xs text-cyan-100/48"><Loader2 size={15} className="animate-spin" />Comparing selected FDA labels and RxNorm identities…</div> : regimenError ? <p className="mt-5 text-amber-100/70">{regimenError}</p> : regimen ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {metric("Selected", regimen.coverage.selected)}
                  {metric("FDA labels", regimen.coverage.fdaLabels)}
                  {metric("RxClass coverage", regimen.coverage.rxClasses)}
                  {metric("With label signals", regimen.coverage.medicationsWithSignals)}
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-2">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/44">Overlapping label-derived signals</div>
                    {regimen.overlaps.length ? <div className="mt-3 space-y-3">{regimen.overlaps.map((overlap) => (
                      <article key={overlap.id} className="rounded-2xl border border-cyan-100/12 bg-cyan-300/[0.035] p-4">
                        <h4 className="text-sm font-black text-white">{overlap.label}</h4>
                        <p className="mt-1 text-[10px] text-cyan-100/46">{overlap.domain}</p>
                        <div className="mt-3 flex flex-wrap gap-2">{overlap.medications.map((item) => <span key={item.rxcui} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-black text-cyan-50/70">{item.name}</span>)}</div>
                      </article>
                    ))}</div> : <p className="mt-3 text-xs leading-5 text-cyan-100/46">No configured occupational signal appeared in two or more of the loaded labels.</p>}
                  </div>

                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[.14em] text-violet-100/48">Cross-medication FDA label mentions</div>
                    {regimen.interactionMentions.length ? <div className="mt-3 space-y-3">{regimen.interactionMentions.map((mention, index) => (
                      <article key={`${mention.fromRxcui}-${mention.toRxcui}-${index}`} className="rounded-2xl border border-violet-200/13 bg-violet-300/[0.04] p-4">
                        <h4 className="text-sm font-black text-white">{mention.fromDrug} label mentions {mention.toDrug}</h4>
                        <p className="mt-3 text-[10px] leading-5 text-violet-50/60">{mention.evidence}</p>
                        <div className="mt-3 text-[9px] font-bold uppercase tracking-[.1em] text-violet-100/42">{mention.section}</div>
                      </article>
                    ))}</div> : <p className="mt-3 text-xs leading-5 text-cyan-100/46">No selected medication or ingredient was explicitly found in another selected product's FDA Drug Interactions section.</p>}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200/13 bg-amber-300/[0.035] p-4 text-[10px] leading-5 text-amber-100/66"><AlertTriangle size={13} className="mr-2 inline" />{regimen.limitation}</div>
              </>
            ) : null}
          </section>

          <section className="rh-support-grid">
            <div className="rh-card is-wide">
              <div className="flex items-center justify-between gap-4"><div><div className="rh-label">Selected medications</div><h3 className="mt-2">Review list</h3></div><Pill className="text-cyan-100/50" /></div>
              {selected.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{selected.map((drug) => {
                const active = focused?.rxcui === drug.rxcui;
                return <div key={drug.rxcui} className={`rounded-2xl border p-4 ${active ? "border-cyan-100/24 bg-cyan-300/[0.07]" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className="flex items-start gap-3"><button onClick={() => void focusDrug(drug)} className="min-w-0 flex-1 text-left"><div className="rh-label">Live RxNorm / FDA review</div><strong className="mt-1 block text-sm">{drug.name}</strong><p className="mt-1 text-[10px] text-cyan-100/40">RxCUI {drug.rxcui}</p></button><button aria-label={`Remove ${drug.name}`} onClick={() => removeDrug(drug)} className="rounded-xl border border-white/10 p-2 text-cyan-100/45 hover:text-white"><Trash2 size={14} /></button></div>
                </div>;
              })}</div> : <p className="mt-4">Search and add medications above.</p>}
            </div>
            <div className="rh-card">
              <div className="rh-label">Current coverage</div>
              <h3 className="mt-2">{selected.length} selected</h3>
              <p className="mt-3">Each selected RxCUI is resolved independently against current NLM/FDA sources. Coverage failures are shown instead of being replaced by a generic hardcoded profile.</p>
            </div>
            <div className="rh-card is-full is-quiet">
              <div className="rh-label">Interpretation boundary</div>
              <p className="mt-2">Drug Checker is a reviewer-intelligence aid. It resolves identity, classes, product-label evidence, occupationally relevant label signals, and transparent regimen overlaps. It does not diagnose, prescribe, calculate an invented interaction-severity score, or issue fitness-for-duty clearance.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
