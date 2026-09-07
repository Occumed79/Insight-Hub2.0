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

type Drug = { rxcui: string; name: string; score?: number | null };
type MoleculePayload = { error?: string; pubchemUrl?: string; structureImageUrl?: string | null; molecule?: Record<string, any> };
type DrugSignal = { id: string; label: string; domain: string; section: string; evidence: string; source: string };
type DrugIntelligence = {
  ok: boolean;
  error?: string;
  medication: Drug;
  identity: { rxcui: string; canonicalName: string; synonym?: string; termType?: string; ingredients: string[]; source: string; sourceUrl: string };
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
  const response = await fetch(url, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
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

function CoverageDot({ ok, label }: { ok: boolean; label: string }) {
  return <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[.1em] text-cyan-100/42"><span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-300" : "bg-amber-300"}`} />{label}</span>;
}

function LabelSection({ title, value, urgent = false }: { title: string; value?: string; urgent?: boolean }) {
  if (!value) return null;
  return <section className="border-t border-white/8 py-5"><div className={`text-[9px] font-black uppercase tracking-[.14em] ${urgent ? "text-rose-200/72" : "text-cyan-100/40"}`}>{title}</div><p className="mt-2 text-[11px] leading-6 text-cyan-50/58">{value}</p></section>;
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
    if (clean.length < 2) { setResults([]); return; }
    const timer = window.setTimeout(() => {
      setSearching(true);
      loadJson(`/api/reviewer-tools/rxnorm?term=${encodeURIComponent(clean)}`)
        .then((payload) => setResults(payload.candidates || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!focused) { setIntelligence(null); setIntelligenceError(""); return; }
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
    if (selected.length < 2) { setRegimen(null); setRegimenError(""); return; }
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
    const remaining = selected.filter((item) => item.rxcui !== drug.rxcui);
    setSelected(remaining);
    if (focused?.rxcui === drug.rxcui) {
      if (remaining.length) void focusDrug(remaining[0]);
      else { setFocused(null); setMolecule(null); }
    }
  }

  const structureUrl = molecule?.structureImageUrl ?? null;
  const classNames = useMemo(() => unique([...(intelligence?.fdaClassNames || []), ...(intelligence?.classes || []).map((item) => item.className)]).slice(0, 10), [intelligence]);

  return (
    <main className="reviewer-native-page min-h-screen pb-16 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-10 lg:pt-8">
        <HeaderBar eyebrow="Medication / Occupational Review" title="Drug Checker" subtitle="Build the regimen first, then inspect each medication and the cross-medication evidence without losing context." />

        <div className="grid min-h-[calc(100vh-128px)] overflow-hidden border-y border-white/8 xl:grid-cols-[310px_minmax(0,1fr)_390px]">
          <aside className="border-r border-white/8 bg-black/12">
            <div className="sticky top-0 max-h-[calc(100vh-24px)] overflow-y-auto p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/34">Regimen builder</p><h2 className="mt-1 text-lg font-black text-white">{selected.length} selected</h2></div><Pill className="h-5 w-5 text-cyan-100/44" /></div>
              <div className="relative mt-4">
                <div className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-[#07101d]/82 px-3 focus-within:border-cyan-200/24">{searching ? <Loader2 className="h-4 w-4 animate-spin text-cyan-100/45" /> : <Search className="h-4 w-4 text-cyan-100/40" />}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Add medication" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{query ? <button onClick={() => setQuery("")} className="text-cyan-100/38 hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}</div>
                {results.length ? <div className="absolute left-0 right-0 top-[50px] z-40 overflow-hidden rounded-xl border border-white/12 bg-[#06101d]/98 shadow-2xl">{results.map((item) => <button key={item.rxcui} onClick={() => addDrug(item)} className="block w-full border-b border-white/7 px-3 py-3 text-left last:border-b-0 hover:bg-cyan-300/[.05]"><p className="text-xs font-bold text-white">{item.name}</p><p className="mt-1 text-[9px] text-cyan-100/34">RxCUI {item.rxcui}</p></button>)}</div> : null}
              </div>

              <div className="mt-4 divide-y divide-white/7 border-y border-white/7">
                {selected.length ? selected.map((drug, index) => {
                  const active = focused?.rxcui === drug.rxcui;
                  return <div key={drug.rxcui} className={`group flex items-start gap-3 py-3 ${active ? "text-white" : "text-cyan-100/60"}`}><button onClick={() => void focusDrug(drug)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full border text-[8px] font-black ${active ? "border-cyan-200/28 bg-cyan-300/10" : "border-white/10"}`}>{index + 1}</span><strong className="truncate text-xs">{drug.name}</strong></div><p className="ml-7 mt-1 text-[9px] text-cyan-100/30">RxCUI {drug.rxcui}</p></button><button aria-label={`Remove ${drug.name}`} onClick={() => removeDrug(drug)} className="mt-0.5 text-cyan-100/25 opacity-0 transition hover:text-white group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button></div>;
                }) : <div className="py-8 text-center"><Search className="mx-auto h-5 w-5 text-cyan-100/22" /><p className="mt-3 text-xs leading-5 text-cyan-100/38">Search RxNorm and add medications. The selected list stays visible while you inspect evidence.</p></div>}
              </div>

              <div className="mt-4 space-y-2 text-[9px] leading-5 text-cyan-100/34"><p><strong className="text-cyan-100/50">Sources:</strong> RxNorm, RxClass, FDA labeling, DailyMed, PubChem.</p><p>Coverage failures stay visible instead of being replaced by hardcoded drug profiles.</p></div>
            </div>
          </aside>

          <section className="min-w-0 bg-black/6">
            {!focused ? (
              <div className="grid min-h-[680px] place-items-center px-8 text-center"><div><Atom className="mx-auto h-12 w-12 text-violet-100/18" /><h2 className="mt-5 text-2xl font-black tracking-[-0.03em]">Select a medication</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-cyan-100/42">The medication inspector opens here while the regimen remains persistent at left.</p></div></div>
            ) : (
              <div className="mx-auto max-w-[980px] px-7 py-7">
                <div className="flex items-start justify-between gap-5 border-b border-white/8 pb-5"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.14em] text-violet-100/40">Medication inspector · RxCUI {focused.rxcui}</p><h2 className="mt-2 text-[31px] font-black tracking-[-0.04em] text-white">{intelligence?.identity?.canonicalName || focused.name}</h2>{classNames.length ? <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{classNames.map((name) => <span key={name} className="text-[10px] text-violet-100/54">{name}</span>)}</div> : null}</div><Atom className="h-6 w-6 shrink-0 text-cyan-100/46" /></div>

                <div className="grid gap-6 border-b border-white/8 py-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="relative min-h-[360px] overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(60,220,235,.12),transparent_28%),radial-gradient(circle_at_70%_68%,rgba(139,92,246,.12),transparent_34%),#030913]">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(102,224,235,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(102,224,235,.035)_1px,transparent_1px)] bg-[size:36px_36px]" />
                    <div className="relative z-10 grid min-h-[360px] place-items-center p-6">{moleculeLoading ? <div className="text-center text-xs text-cyan-100/46"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Resolving PubChem structure…</div> : molecule?.error ? <p className="max-w-sm text-center text-xs leading-6 text-amber-100/62">{molecule.error}</p> : structureUrl ? <div className="w-full max-w-[520px]"><AuroraMolecule src={structureUrl} alt={`PubChem molecular structure for ${focused.name}`} /></div> : <p className="text-xs text-cyan-100/42">No structure image returned.</p>}</div>
                  </div>

                  <aside>
                    <p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/34">Live source coverage</p>
                    {intelligenceLoading ? <div className="mt-5 flex items-center gap-2 text-xs text-cyan-100/44"><Loader2 className="h-4 w-4 animate-spin" />Loading medication intelligence…</div> : intelligenceError ? <p className="mt-5 text-xs leading-6 text-amber-100/70">{intelligenceError}</p> : intelligence ? <><div className="mt-4 space-y-3"><CoverageDot ok={intelligence.coverage.rxnorm} label="RxNorm identity" /><CoverageDot ok={intelligence.coverage.rxclass} label="RxClass" /><CoverageDot ok={intelligence.coverage.fdaLabel} label="FDA product label" /><CoverageDot ok={intelligence.signals.length > 0} label="Occupational signals" /></div><div className="mt-6 divide-y divide-white/7 border-y border-white/7 text-[10px]"><div className="grid grid-cols-[90px_1fr] gap-3 py-3"><span className="text-cyan-100/32">Ingredients</span><strong className="text-cyan-50/72">{intelligence.identity.ingredients.join(", ") || "Not resolved"}</strong></div><div className="grid grid-cols-[90px_1fr] gap-3 py-3"><span className="text-cyan-100/32">FDA label</span><strong className="text-cyan-50/72">{intelligence.label ? effectiveDate(intelligence.label.effectiveTime) : "Not resolved"}</strong></div><div className="grid grid-cols-[90px_1fr] gap-3 py-3"><span className="text-cyan-100/32">Formula</span><strong className="text-cyan-50/72">{String(molecule?.molecule?.MolecularFormula ?? "—")}</strong></div><div className="grid grid-cols-[90px_1fr] gap-3 py-3"><span className="text-cyan-100/32">Mol. weight</span><strong className="text-cyan-50/72">{String(molecule?.molecule?.MolecularWeight ?? "—")}</strong></div></div></> : null}
                  </aside>
                </div>

                <section className="py-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/34">FDA label intelligence</p><h3 className="mt-2 text-xl font-black">Occupationally relevant source signals</h3></div><ShieldAlert className="h-5 w-5 text-cyan-100/40" /></div>{intelligence?.signals.length ? <div className="mt-4 divide-y divide-white/7 border-y border-white/7">{intelligence.signals.map((signal) => <article key={signal.id} className="grid gap-3 py-4 md:grid-cols-[180px_minmax(0,1fr)]"><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-violet-100/42">{signal.domain}</p><h4 className="mt-1 text-sm font-black text-white">{signal.label}</h4><p className="mt-2 text-[9px] uppercase tracking-[.1em] text-cyan-100/30">FDA · {signal.section}</p></div><p className="text-[10px] leading-6 text-cyan-50/56">{signal.evidence}</p></article>)}</div> : intelligence && !intelligenceLoading ? <p className="mt-4 border-l border-white/10 pl-4 text-xs leading-6 text-cyan-100/42">The loaded FDA label did not trigger one of the configured occupational-review signal categories. This is not evidence that the medication has no occupational implications.</p> : null}</section>

                {intelligence?.label ? <section><div className="flex items-center justify-between gap-4 border-t border-white/8 py-4"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-cyan-100/45" /><h3 className="text-sm font-black">Product label sections</h3></div><div className="flex gap-3 text-[10px] font-black"><a href={intelligence.label.dailyMedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-100/54 hover:text-white">DailyMed <ArrowUpRight className="h-3 w-3" /></a><a href={intelligence.label.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-100/54 hover:text-white">FDA record <ArrowUpRight className="h-3 w-3" /></a></div></div><LabelSection title="Boxed warning" value={intelligence.label.sections.boxedWarning} urgent /><LabelSection title="Warnings and precautions" value={intelligence.label.sections.warningsAndCautions} /><LabelSection title="Adverse reactions" value={intelligence.label.sections.adverseReactions} /><LabelSection title="Drug interactions" value={intelligence.label.sections.drugInteractions} /><LabelSection title="Contraindications" value={intelligence.label.sections.contraindications} /><LabelSection title="Patient counseling" value={intelligence.label.sections.patientCounseling} /></section> : null}
              </div>
            )}
          </section>

          <aside className="border-l border-white/8 bg-[#08101a]/46">
            <div className="sticky top-0 max-h-[calc(100vh-24px)] overflow-y-auto p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-100/36">Regimen review</p><h2 className="mt-1 text-lg font-black">Cross-medication evidence</h2></div><Layers3 className="h-5 w-5 text-violet-100/44" /></div>
              {selected.length < 2 ? <div className="mt-8 border-l border-white/9 pl-4"><p className="text-xs leading-6 text-cyan-100/42">Add at least two medications. This pane will then compare the selected regimen using current FDA label sections and the occupational signals already extracted for each RxCUI.</p></div> : regimenLoading ? <div className="mt-8 flex items-center gap-2 text-xs text-cyan-100/46"><Loader2 className="h-4 w-4 animate-spin" />Reviewing selected regimen…</div> : regimenError ? <p className="mt-8 text-xs leading-6 text-amber-100/70">{regimenError}</p> : regimen ? <>
                <div className="mt-5 grid grid-cols-2 border-y border-white/7 py-3"><div><p className="text-[8px] font-black uppercase tracking-[.12em] text-cyan-100/28">FDA labels</p><strong className="mt-1 block text-lg">{regimen.coverage.fdaLabels}/{regimen.coverage.selected}</strong></div><div><p className="text-[8px] font-black uppercase tracking-[.12em] text-cyan-100/28">Signal-bearing meds</p><strong className="mt-1 block text-lg">{regimen.coverage.medicationsWithSignals}</strong></div></div>

                <section className="mt-5"><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/34">Shared occupational domains</p><span className="text-[9px] text-cyan-100/28">{regimen.overlaps.length}</span></div><div className="mt-2 divide-y divide-white/7">{regimen.overlaps.length ? regimen.overlaps.map((overlap) => <article key={overlap.id} className="py-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.11em] text-violet-100/38">{overlap.domain}</p><h3 className="mt-1 text-sm font-black text-white">{overlap.label}</h3></div><Activity className="h-4 w-4 text-violet-100/40" /></div><div className="mt-3 space-y-2">{overlap.medications.map((medication) => <div key={`${overlap.id}-${medication.rxcui}`} className="border-l border-violet-200/14 pl-3"><p className="text-[10px] font-bold text-violet-50/72">{medication.name}</p><p className="mt-1 text-[9px] leading-5 text-cyan-100/40">{medication.evidence}</p></div>)}</div></article>) : <p className="py-4 text-xs leading-5 text-cyan-100/40">No shared configured occupational signal domain was found across the selected medications.</p>}</div></section>

                <section className="mt-5 border-t border-white/8 pt-5"><p className="text-[9px] font-black uppercase tracking-[.12em] text-violet-100/38">Cross-medication FDA label mentions</p><div className="mt-2 divide-y divide-white/7">{regimen.interactionMentions.length ? regimen.interactionMentions.map((mention, index) => <article key={`${mention.fromRxcui}-${mention.toRxcui}-${index}`} className="py-4"><h3 className="text-xs font-black text-white">{mention.fromDrug} label mentions {mention.toDrug}</h3><p className="mt-2 text-[9px] leading-5 text-violet-50/52">{mention.evidence}</p><p className="mt-2 text-[8px] font-black uppercase tracking-[.1em] text-violet-100/30">{mention.section}</p></article>) : <p className="py-4 text-xs leading-5 text-cyan-100/40">No selected medication or ingredient was explicitly found in another selected product's FDA Drug Interactions section.</p>}</div></section>

                <div className="mt-5 border-l-2 border-amber-300/28 pl-3 text-[9px] leading-5 text-amber-100/58"><AlertTriangle className="mr-1.5 inline h-3 w-3" />{regimen.limitation}</div>
              </> : null}

              <div className="mt-7 border-t border-white/8 pt-4"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/34"><CheckCircle2 className="h-3.5 w-3.5" />Interpretation boundary</div><p className="mt-2 text-[9px] leading-5 text-cyan-100/36">Drug Checker resolves identity, classes, product-label evidence, occupationally relevant label signals, and transparent regimen overlaps. It does not diagnose, prescribe, calculate an invented interaction-severity score, or issue fitness-for-duty clearance.</p></div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
