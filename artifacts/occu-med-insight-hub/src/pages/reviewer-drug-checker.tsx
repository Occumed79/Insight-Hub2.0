import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Atom, CheckCircle2, Loader2, Pill, Search, Trash2, X } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import AuroraMolecule from "./AuroraMolecule";
import "./reviewer-tool-hierarchy.css";

type Drug = { rxcui: string; name: string; score?: number | null };
type MoleculePayload = {
  error?: string;
  pubchemUrl?: string;
  structureImageUrl?: string | null;
  molecule?: Record<string, any>;
};

type DrugProfile = {
  aliases: string[];
  className: string;
  flags: string[];
  points: string[];
};

const DRUG_PROFILES: DrugProfile[] = [
  { aliases: ["gabapentin", "neurontin"], className: "Anticonvulsant / neuropathic pain agent", flags: ["Sedation / dizziness", "Coordination"], points: ["Consider reported somnolence, dizziness, or ataxia when duties require sustained alertness, balance, driving, or hazardous equipment.", "Renal function may affect dosing and tolerability."] },
  { aliases: ["warfarin", "coumadin", "jantoven"], className: "Vitamin K antagonist anticoagulant", flags: ["Bleeding", "Monitoring"], points: ["Bleeding consequences may matter more in jobs with trauma exposure or delayed access to care.", "Confirm required anticoagulation monitoring can be maintained in the work setting."] },
  { aliases: ["insulin", "humalog", "novolog", "lantus", "levemir", "tresiba", "basaglar"], className: "Insulin therapy", flags: ["Hypoglycemia", "Medication access / storage"], points: ["Review severe hypoglycemia history, recognition, monitoring, and actual safety sensitivity of the position.", "Confirm reliable access to medication, supplies, monitoring and appropriate storage."] },
  { aliases: ["metoprolol", "lopressor", "toprol"], className: "Beta blocker", flags: ["Heart-rate response", "Dizziness / fatigue"], points: ["Beta blockade can alter expected heart-rate response during exertion.", "Reported fatigue, bradycardia, or dizziness may matter in strenuous or safety-sensitive duties."] },
  { aliases: ["hydrochlorothiazide", "hctz", "microzide"], className: "Thiazide diuretic", flags: ["Hydration / electrolytes", "Heat"], points: ["Review dehydration or electrolyte concerns when work involves sustained heat exposure or heavy exertion.", "Reported orthostasis or weakness may be occupationally relevant."] },
  { aliases: ["doxycycline", "vibramycin"], className: "Tetracycline antibiotic", flags: ["Photosensitivity", "Administration constraints"], points: ["Photosensitivity can matter for prolonged outdoor work or deployment.", "Consider whether reliable hydration and appropriate administration are practical."] },
  { aliases: ["sertraline", "zoloft"], className: "SSRI antidepressant", flags: ["Alertness / sleep", "Treatment stability"], points: ["Review actual side effects and treatment stability; the medication itself does not establish impairment.", "Somnolence, insomnia, dizziness, or recent dose changes may matter in safety-sensitive work."] },
  { aliases: ["amlodipine", "norvasc"], className: "Calcium-channel blocker", flags: ["Hypotension / dizziness", "Edema"], points: ["Review symptomatic hypotension, dizziness, or edema if the job includes heights, heavy exertion, or prolonged standing.", "Medication tolerance and BP control are more useful than the drug name alone."] },
  { aliases: ["metformin", "glucophage", "fortamet"], className: "Biguanide antihyperglycemic", flags: ["GI tolerance", "Renal function"], points: ["GI effects may matter when field access to hydration or sanitation is limited.", "Renal status and underlying diabetes control are generally more relevant than metformin use itself."] },
];

function drugProfile(name: string) {
  const clean = name.toLowerCase();
  return DRUG_PROFILES.find((profile) => profile.aliases.some((alias) => clean.includes(alias))) ?? null;
}

async function loadJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

function metric(label: string, value: unknown) {
  return <div className="rh-metric"><span>{label}</span><strong>{String(value ?? "—")}</strong></div>;
}

export default function ReviewerDrugCheckerPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Drug[]>([]);
  const [selected, setSelected] = useState<Drug[]>([]);
  const [focused, setFocused] = useState<Drug | null>(null);
  const [searching, setSearching] = useState(false);
  const [molecule, setMolecule] = useState<MoleculePayload | null>(null);
  const [moleculeLoading, setMoleculeLoading] = useState(false);

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

  const profile = focused ? drugProfile(focused.name) : null;
  const cid = molecule?.molecule?.CID;
  const reviewCount = useMemo(() => selected.filter((drug) => Boolean(drugProfile(drug.name))).length, [selected]);

  return (
    <main className="aurora-bg reviewer-native-page min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[210px] lg:px-12 lg:pt-8">
        <HeaderBar eyebrow="Medication / Occupational Review" title="Drug Checker" subtitle="RxNorm identity, accurate PubChem molecular structure, and occupational-review context organized around one selected medication." />

        <div className="rh-stack">
          <section className="rh-primary-action">
            <div className="rh-kicker">01 · Medication lookup</div>
            <h2 className="rh-section-title">Find the medication first.</h2>
            <p className="rh-section-copy">Search resolves the medication through NLM RxNorm. Selecting a result drives the molecular structure and the occupational-review context below.</p>
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
                      <span className="rounded-full border border-cyan-100/14 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/58">{drugProfile(item.name) ? "Reviewed occupational profile" : "Identity only"}</span>
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
                    <h2 className="rh-section-title">{focused?.name || "Select a medication"}</h2>
                    <p className="rh-section-copy">{profile?.className || (focused ? `RxCUI ${focused.rxcui}` : "The molecular structure becomes the primary visual once a medication is selected.")}</p>
                  </div>
                  <Atom className="mt-1 text-cyan-100/55" />
                </div>

                <div className="rh-molecule-stage mt-6">
                  <span className="rh-molecule-tag">Actual PubChem structure · native aurora render</span>
                  {moleculeLoading ? (
                    <div className="rh-molecule-empty"><Loader2 size={22} className="mx-auto mb-3 animate-spin" />Resolving the compound record…</div>
                  ) : molecule?.error ? (
                    <div className="rh-molecule-empty">{molecule.error}</div>
                  ) : focused && cid ? (
                    <AuroraMolecule cid={cid} name={focused.name} />
                  ) : (
                    <div className="rh-molecule-empty">Search and select a medication. The hero is generated from the compound's real PubChem atom coordinates and bonds—no decorative fake molecule and no raw white image canvas.</div>
                  )}
                </div>
              </div>

              <aside className="rh-hero-side">
                <div className="rh-kicker">03 · Review snapshot</div>
                <h3 className="mt-2 text-xl font-black">Occupational context</h3>
                {focused ? (
                  <>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {(profile?.flags || ["Identity resolved"]).map((flag) => <span key={flag} className="rounded-full border border-violet-200/16 bg-violet-300/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-violet-50/75">{flag}</span>)}
                    </div>
                    <div className="mt-5 space-y-3">
                      {(profile?.points || ["No curated occupational profile is stored for this medication. The medication name alone is not treated as evidence of impairment or occupational risk."]).map((point) => <p key={point} className="flex gap-2 text-xs leading-6 text-cyan-100/58"><CheckCircle2 size={14} className="mt-1 shrink-0 text-cyan-100/55" />{point}</p>)}
                    </div>
                    <div className="rh-metric-grid mt-6">
                      {metric("Formula", molecule?.molecule?.MolecularFormula)}
                      {metric("Molecular weight", molecule?.molecule?.MolecularWeight)}
                      {metric("XLogP", molecule?.molecule?.XLogP)}
                      {metric("TPSA", molecule?.molecule?.TPSA)}
                    </div>
                    {molecule?.pubchemUrl ? <a href={molecule.pubchemUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-black text-cyan-100/65 hover:text-white">Open PubChem record <ArrowUpRight size={12} /></a> : null}
                  </>
                ) : <p className="mt-5 text-sm leading-6 text-cyan-100/48">Nothing is inferred until a medication is selected.</p>}
              </aside>
            </div>
          </section>

          <section className="rh-support-grid">
            <div className="rh-card is-wide">
              <div className="flex items-center justify-between gap-4"><div><div className="rh-label">Selected medications</div><h3 className="mt-2">Review list</h3></div><Pill className="text-cyan-100/50" /></div>
              {selected.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{selected.map((drug) => {
                const itemProfile = drugProfile(drug.name);
                const active = focused?.rxcui === drug.rxcui;
                return <div key={drug.rxcui} className={`rounded-2xl border p-4 ${active ? "border-cyan-100/24 bg-cyan-300/[0.07]" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className="flex items-start gap-3"><button onClick={() => void focusDrug(drug)} className="min-w-0 flex-1 text-left"><div className="rh-label">{itemProfile ? "Reviewed occupational profile" : "RxNorm identity"}</div><strong className="mt-1 block text-sm">{drug.name}</strong><p className="mt-1 text-[10px] text-cyan-100/40">{itemProfile?.className || `RxCUI ${drug.rxcui}`}</p></button><button aria-label={`Remove ${drug.name}`} onClick={() => { setSelected((current) => current.filter((item) => item.rxcui !== drug.rxcui)); if (focused?.rxcui === drug.rxcui) { setFocused(null); setMolecule(null); } }} className="rounded-xl border border-white/10 p-2 text-cyan-100/45 hover:text-white"><Trash2 size={14} /></button></div>
                </div>;
              })}</div> : <p className="mt-4">Search and add medications above.</p>}
            </div>
            <div className="rh-card">
              <div className="rh-label">Review coverage</div>
              <h3 className="mt-2">{reviewCount} curated · {selected.length - reviewCount} identity-only</h3>
              <p className="mt-3">Curated review factors are deliberately limited. A missing profile does not imply safety or risk.</p>
            </div>
            <div className="rh-card is-full is-quiet">
              <div className="rh-label">Interpretation boundary</div>
              <p className="mt-2">Drug Checker resolves identity and displays source-backed molecular information plus curated occupational-review prompts. It does not invent drug interactions, impairment, fitness determinations, or clearance decisions.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
