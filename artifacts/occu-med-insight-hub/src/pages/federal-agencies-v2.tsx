import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ExternalLink,
  FileSearch,
  HeartPulse,
  Landmark,
  Loader2,
  Search,
  Users,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}/api/${path.replace(/^\//, "")}`;
const PERSISTED_BUCKETS = ["forecast", "recompete-watch", "incumbent-tracker", "deployment-medical"] as const;
const VIEWS = ["Overview", "Solicitations", "Contracts & Spending", "Recompetes", "Forecasts", "Incumbents", "Contracting Offices", "Leadership", "Medical Requirements", "Recent Activity"] as const;
type View = typeof VIEWS[number];

const OCCU_MED_EVIDENCE = /occupational\s+(medicine|health)|employee\s+health|medical\s+(examination|exam|surveillance)|physical\s+exam|pre[- ]?(employment|placement)|post[- ]?offer|fitness[- ]?for[- ]?duty|health\s+surveillance|respiratory\s+protection|respirator\s+fit|fit\s+testing|audiometr|hearing\s+conservation|drug\s+testing|alcohol\s+testing|dot\s+testing|specimen\s+collection|vaccin|immuniz|travel\s+medicine|deployment\s+medicine|return\s+to\s+work|ergonomic|clinical\s+services.*workforce\s+readiness/i;
const HARDWARE_NOISE = /gantry|crane|roof\s+painting|valves?|clamps?|drums?|weapon|missile|ammunition|aircraft\s+parts?|vehicle\s+parts?|construction\s+materials?|janitorial|groundskeeping/i;
const RECOMPETE_EVIDENCE = /recompete|re-compete|renewal|follow[- ]?on|expir(?:e|es|ing|ation)|option\s+year|bridge\s+contract/i;
const FORECAST_EVIDENCE = /procurement\s+forecast|acquisition\s+forecast|forecast(?:ed)?|planned\s+(acquisition|procurement|solicitation)|anticipated\s+(award|solicitation|procurement)/i;
const NEGATED_RECOMPETE_EVIDENCE = /\b(?:no|not|without)\s+(?:contract\s+)?(?:recompete|re-compete|renewal|expiration|follow[- ]?on|option\s+year|bridge\s+contract)/i;

const FALLBACK_AGENCIES = ["Department of Defense", "Department of State", "Department of Homeland Security", "Department of Veterans Affairs", "Department of Health and Human Services", "Department of Justice", "Department of Energy", "Department of Transportation", "Department of Labor", "Department of Agriculture", "Department of the Interior"];

type PersistedItem = { id: string; bucket: string; sourceType: string | null; agency: string | null; component: string | null; office: string | null; regionCountry: string | null; title: string; summary: string | null; datePosted: string | null; status: string | null; contractorIncumbent: string | null; relatedRef: string | null; budgetSignal: string | null; oversightSignal: string | null; medicalTravelRelevance: string | null; occuMedScore: number | null; actionTag: string | null; sourceUrl: string | null; fetchedAt: string | null };
type FederalOrg = { id: string; name: string; type: string | null; status: string | null; agencyCode: string | null; department: string | null; parentPath: string | null; cgacCodes: string[] };
type Opportunity = { noticeId: string; title: string; solicitationNumber: string | null; organization: string | null; organizationCode: string | null; postedDate: string | null; type: string | null; baseType: string | null; responseDeadline: string | null; naicsCode: string | null; classificationCode: string | null; active: boolean; setAside: string | null; award: { amount: number | null; awardee: string | null; date: string | null; number: string | null } | null; officeAddress: { city: string | null; state: string | null; zip: string | null; country: string | null }; placeOfPerformance: { city: string | null; state: string | null; country: string | null; zip: string | null }; pointsOfContact: Array<{ name: string | null; title: string | null; email: string | null; phone: string | null; type: string | null }>; sourceUrl: string; descriptionUrl: string | null; resourceLinks: string[]; occuMedRelevant: boolean; occuMedScore: number; occuMedTags: string[] };
type Leader = { id: string; agency: string | null; component: string | null; positionTitle: string; name: string; location: string | null; appointmentType: string | null; payPlan: string | null; levelGradePay: string | null; tenure: string | null; expiration: string | null; sourceUrl: string; source: string; confidence: string };
type DirectoryResponse = { ok?: boolean; configured?: boolean; organizations?: FederalOrg[]; allOrganizationCount?: number; source?: string; sourceUrl?: string; retrievedAt?: string; limitation?: string; error?: string };
type OpportunitiesResponse = { ok?: boolean; configured?: boolean; opportunities?: Opportunity[]; returned?: number; totalRecords?: number; occuMedRelevant?: number; source?: string; sourceUrl?: string; retrievedAt?: string; limitation?: string; error?: string; diagnostics?: { configured: boolean; resultStatus: string; requestedAgency: string; queryFilterMode: string; postedFrom: string | null; postedTo: string | null; pagesRequested: number; rawRecordsReturned: number; normalizedRecordsReturned: number; totalRecordsReportedBySam: number; agencyMatchMethod: string } };
type LeadershipResponse = { ok?: boolean; leaders?: Leader[]; returned?: number; sourceMode?: string; source?: string; sourceUrl?: string; exportUrl?: string | null; certificationUrl?: string; dataAsOf?: string; retrievedAt?: string; diagnostic?: string; limitation?: string; error?: string };
type StructureResponse = { ok?: boolean; configured?: boolean; organizations?: FederalOrg[]; returned?: number; agencyCode?: string | null; source?: string; sourceUrl?: string; retrievedAt?: string; error?: string };
type InspectItem = { kind: string; title: string; summary: string; sourceUrl?: string | null; fields: Array<[string, string]> };

function canonicalAgency(value: string | null | undefined): string {
  const name = String(value || "").trim();
  if (/state department|department of state|state, department of/i.test(name)) return "Department of State";
  if (/defense/i.test(name)) return "Department of Defense";
  if (/veterans affairs/i.test(name)) return "Department of Veterans Affairs";
  if (/health and human services/i.test(name)) return "Department of Health and Human Services";
  if (/homeland security/i.test(name)) return "Department of Homeland Security";
  if (/energy/i.test(name)) return "Department of Energy";
  if (/justice/i.test(name)) return "Department of Justice";
  if (/agriculture/i.test(name)) return "Department of Agriculture";
  if (/interior/i.test(name)) return "Department of the Interior";
  if (/transportation/i.test(name)) return "Department of Transportation";
  if (/labor/i.test(name)) return "Department of Labor";
  return name;
}
function formatDate(value?: string | null): string { if (!value) return "Date not reported"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
function dateValue(value?: string | null): number { if (!value) return 0; const time = new Date(value).getTime(); return Number.isFinite(time) ? time : 0; }
function agencyMatches(value: string | null | undefined, selected: string) { if (!value) return false; const left = canonicalAgency(value).toLowerCase(); const right = canonicalAgency(selected).toLowerCase(); return left === right || left.includes(right) || right.includes(left); }
async function json<T>(path: string): Promise<T> { const response = await fetch(api(path), { cache: "no-store" }); const payload = await response.json().catch(() => ({})) as Record<string, unknown>; if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`); return payload as T; }
async function safeJson<T>(path: string, fallback: T): Promise<T> { try { return await json<T>(path); } catch { return fallback; } }
function textOf(item: PersistedItem) { return `${item.title} ${item.summary || ""} ${item.medicalTravelRelevance || ""} ${item.actionTag || ""}`; }
function relevantPersisted(item: PersistedItem) { const text = textOf(item); return OCCU_MED_EVIDENCE.test(text) && !HARDWARE_NOISE.test(text); }
function validForecast(item: PersistedItem) { return relevantPersisted(item) && FORECAST_EVIDENCE.test(textOf(item)); }
function validRecompete(item: PersistedItem) { const text = textOf(item); return relevantPersisted(item) && RECOMPETE_EVIDENCE.test(text) && !NEGATED_RECOMPETE_EVIDENCE.test(text); }
function relevantOpportunity(item: Opportunity) { const text = `${item.title} ${item.occuMedTags.join(" ")} ${item.naicsCode || ""}`; return (item.occuMedRelevant || OCCU_MED_EVIDENCE.test(text)) && !HARDWARE_NOISE.test(text); }

export default function FederalAgenciesV2() {
  const [directory, setDirectory] = useState<FederalOrg[]>([]);
  const [selectedAgency, setSelectedAgency] = useState("Department of Defense");
  const [view, setView] = useState<View>("Overview");
  const [query, setQuery] = useState("");
  const [buckets, setBuckets] = useState<Record<string, PersistedItem[]>>({});
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunityMeta, setOpportunityMeta] = useState<OpportunitiesResponse | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [structure, setStructure] = useState<FederalOrg[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [loadingAgency, setLoadingAgency] = useState(false);
  const [error, setError] = useState("");
  const [inspect, setInspect] = useState<InspectItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    void json<DirectoryResponse>("core-intelligence/federal-live/directory").then((payload) => {
      if (cancelled) return;
      const organizations = payload.organizations || [];
      setDirectory(organizations);
      const dod = organizations.find((item) => canonicalAgency(item.name) === "Department of Defense");
      if (dod) setSelectedAgency(canonicalAgency(dod.name));
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Federal agency directory failed."); }).finally(() => { if (!cancelled) setLoadingDirectory(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingAgency(true); setError(""); setInspect(null);
    const encoded = encodeURIComponent(selectedAgency);
    void Promise.all([
      ...PERSISTED_BUCKETS.map(async (bucket) => [bucket, await safeJson<{ items?: PersistedItem[] }>(`federal-intel/${bucket}?limit=500`, { items: [] })] as const),
      safeJson<OpportunitiesResponse>(`core-intelligence/federal-live/opportunities?agency=${encoded}`, { opportunities: [], returned: 0, configured: false }),
      safeJson<LeadershipResponse>(`core-intelligence/federal-live/leadership?agency=${encoded}`, { leaders: [] }),
      safeJson<StructureResponse>(`core-intelligence/federal-live/structure?agency=${encoded}`, { organizations: [] }),
    ]).then((results) => {
      if (cancelled) return;
      const nextBuckets: Record<string, PersistedItem[]> = {};
      for (let index = 0; index < PERSISTED_BUCKETS.length; index += 1) {
        const [bucket, payload] = results[index] as readonly [string, { items?: PersistedItem[] }];
        nextBuckets[bucket] = (payload.items || []).filter((item) => !item.agency || agencyMatches(item.agency, selectedAgency));
      }
      setBuckets(nextBuckets);
      const opportunityPayload = results[PERSISTED_BUCKETS.length] as OpportunitiesResponse;
      const leadershipPayload = results[PERSISTED_BUCKETS.length + 1] as LeadershipResponse;
      const structurePayload = results[PERSISTED_BUCKETS.length + 2] as StructureResponse;
      setOpportunityMeta(opportunityPayload);
      setOpportunities((opportunityPayload.opportunities || []).filter(relevantOpportunity));
      setLeaders(leadershipPayload.leaders || []);
      setStructure(structurePayload.organizations || []);
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Agency intelligence failed to load."); }).finally(() => { if (!cancelled) setLoadingAgency(false); });
    return () => { cancelled = true; };
  }, [selectedAgency]);

  const agencies = useMemo(() => {
    const names = new Set<string>(FALLBACK_AGENCIES);
    directory.forEach((item) => names.add(canonicalAgency(item.name)));
    Object.values(buckets).flat().forEach((item) => { if (item.agency) names.add(canonicalAgency(item.agency)); });
    return [...names].filter(Boolean).sort();
  }, [directory, buckets]);

  const relevantAll = useMemo(() => Object.values(buckets).flat().filter(relevantPersisted), [buckets]);
  const forecasts = useMemo(() => (buckets["forecast"] || []).filter(validForecast), [buckets]);
  const recompetes = useMemo(() => (buckets["recompete-watch"] || []).filter(validRecompete), [buckets]);
  const incumbents = useMemo(() => (buckets["incumbent-tracker"] || []).filter(relevantPersisted), [buckets]);
  const medical = useMemo(() => (buckets["deployment-medical"] || []).filter(relevantPersisted), [buckets]);
  const q = query.trim().toLowerCase();
  const filterPersisted = (items: PersistedItem[]) => items.filter((item) => !q || `${item.title} ${item.summary || ""} ${item.office || ""} ${item.contractorIncumbent || ""}`.toLowerCase().includes(q));
  const filteredOpportunities = opportunities.filter((item) => !q || `${item.title} ${item.organization || ""} ${item.naicsCode || ""}`.toLowerCase().includes(q));
  const contractingOffices = useMemo(() => {
    const counts = new Map<string, number>();
    relevantAll.forEach((item) => { const office = item.office || item.component; if (office) counts.set(office, (counts.get(office) || 0) + 1); });
    filteredOpportunities.forEach((item) => { const office = item.organization || item.organizationCode; if (office) counts.set(office, (counts.get(office) || 0) + 1); });
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [relevantAll, filteredOpportunities]);

  function inspectPersisted(item: PersistedItem) {
    setInspect({ kind: item.bucket.replace(/-/g, " "), title: item.title, summary: item.summary || "No source summary stored.", sourceUrl: item.sourceUrl, fields: [["Agency", canonicalAgency(item.agency) || selectedAgency], ["Office", item.office || item.component || "Not reported"], ["Posted", formatDate(item.datePosted || item.fetchedAt)], ["Incumbent", item.contractorIncumbent || "Not reported"], ["Status", item.status || "Not reported"], ["Budget / value", item.budgetSignal || "Not reported"], ["Occu-Med relevance", item.medicalTravelRelevance || item.actionTag || "Occupational-health evidence matched"]] });
  }
  function inspectOpportunity(item: Opportunity) {
    const place = [item.placeOfPerformance.city, item.placeOfPerformance.state, item.placeOfPerformance.country].filter(Boolean).join(", ") || "Not reported";
    const poc = item.pointsOfContact?.[0];
    setInspect({ kind: "SAM.gov solicitation", title: item.title, summary: `Official opportunity record${item.occuMedTags.length ? ` · ${item.occuMedTags.join(", ")}` : ""}.`, sourceUrl: item.sourceUrl, fields: [["Solicitation", item.solicitationNumber || "Not reported"], ["Organization", item.organization || selectedAgency], ["Posted", formatDate(item.postedDate)], ["Response deadline", formatDate(item.responseDeadline)], ["Place of performance", place], ["NAICS", item.naicsCode || "Not reported"], ["Point of contact", poc ? [poc.name, poc.email, poc.phone].filter(Boolean).join(" · ") : "Not reported"]] });
  }

  const overviewRows = [...filterPersisted(relevantAll), ...filteredOpportunities.map((item) => ({ id: item.noticeId, bucket: "solicitation", sourceType: "SAM.gov", agency: item.organization, component: null, office: item.organization, regionCountry: item.placeOfPerformance.country, title: item.title, summary: item.occuMedTags.join(", "), datePosted: item.postedDate, status: item.active ? "active" : "inactive", contractorIncumbent: item.award?.awardee || null, relatedRef: item.solicitationNumber, budgetSignal: item.award?.amount ? `$${item.award.amount.toLocaleString()}` : null, oversightSignal: null, medicalTravelRelevance: item.occuMedTags.join(", "), occuMedScore: item.occuMedScore, actionTag: null, sourceUrl: item.sourceUrl, fetchedAt: null } as PersistedItem))].sort((a, b) => dateValue(b.datePosted || b.fetchedAt) - dateValue(a.datePosted || a.fetchedAt));

  return (
    <main className="min-h-screen bg-[#06090d] pb-16 text-white">
      <Sidebar />
      <section className="px-5 py-8 lg:ml-[210px] lg:px-8 2xl:px-10">
        <HeaderBar eyebrow="Public Intelligence · Federal" title="Federal Agencies" subtitle="Agency profiles built around Occu-Med-relevant solicitations, contracts, recompetes, forecasts, incumbents, offices, leadership, and medical requirements — not a generic federal-data dashboard." />
        {error ? <div className="mt-4 border border-rose-200/18 bg-rose-300/[.04] p-3 text-xs text-rose-100">{error}</div> : null}

        <div className="mt-5 grid min-h-[790px] border border-white/10 bg-[#080c12] 2xl:grid-cols-[280px_minmax(0,1fr)_350px]">
          <aside className="border-b border-white/10 2xl:border-b-0 2xl:border-r">
            <div className="border-b border-white/10 p-4"><div className="flex items-center gap-2"><Landmark size={15} className="text-cyan-200/60" /><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Agency directory</p></div><div className="mt-4 flex min-h-10 items-center gap-2 border border-white/10 bg-black/25 px-3"><Search size={14} className="text-slate-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter loaded agency intelligence…" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /></div></div>
            <div className="max-h-[680px] overflow-y-auto divide-y divide-white/[.06]">{loadingDirectory ? <div className="p-5 text-center"><Loader2 className="mx-auto animate-spin text-cyan-200/55" /></div> : agencies.map((name) => <button key={name} type="button" onClick={() => { setSelectedAgency(name); setView("Overview"); }} className={`w-full p-4 text-left transition ${selectedAgency === name ? "bg-cyan-300/[.055]" : "hover:bg-white/[.02]"}`}><p className="text-sm font-black text-white">{name}</p><p className="mt-1 text-[9px] text-slate-600">Open agency intelligence profile</p></button>)}</div>
          </aside>

          <section className="min-w-0 border-b border-white/10 2xl:border-b-0 2xl:border-r">
            <header className="border-b border-white/10 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-cyan-100/55">Agency intelligence profile</p><h2 className="mt-2 text-3xl font-black tracking-[-.035em] text-white">{selectedAgency}</h2><p className="mt-2 text-xs leading-5 text-slate-500">Official SAM.gov organization / opportunity context plus persisted federal intelligence filtered for occupational-health relevance.</p></div><div className="grid grid-cols-4 divide-x divide-white/8 border border-white/8 text-center"><Metric label="Solicitations" value={opportunities.length} /><Metric label="Recompetes" value={recompetes.length} /><Metric label="Forecasts" value={forecasts.length} /><Metric label="Medical" value={medical.length} /></div></div>
              <div className="mt-5 flex gap-5 overflow-x-auto border-b border-white/8">{VIEWS.map((item) => <button key={item} type="button" onClick={() => setView(item)} className={`min-h-10 shrink-0 border-b-2 text-xs font-bold ${view === item ? "border-cyan-200 text-white" : "border-transparent text-slate-500 hover:text-slate-200"}`}>{item}</button>)}</div>
            </header>

            {loadingAgency ? <div className="grid min-h-[580px] place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs text-slate-500">Loading agency sources…</p></div></div> : <div className="min-h-[620px]">
              {view === "Overview" ? <OverviewView rows={overviewRows.slice(0, 25)} onSelect={inspectPersisted} diagnostics={opportunityMeta} /> : null}
              {view === "Solicitations" ? <OpportunityTable items={filteredOpportunities} onSelect={inspectOpportunity} /> : null}
              {view === "Contracts & Spending" ? <PersistedTable items={filterPersisted([...incumbents, ...relevantAll.filter((item) => /contract|award|spend/i.test(`${item.bucket} ${item.title} ${item.summary || ""}`))])} empty="No Occu-Med-relevant contract/spending records are loaded for this agency." onSelect={inspectPersisted} /> : null}
              {view === "Recompetes" ? <PersistedTable items={filterPersisted(recompetes)} empty="No recompete records with affirmative occupational-health and recompete evidence are loaded." onSelect={inspectPersisted} /> : null}
              {view === "Forecasts" ? <PersistedTable items={filterPersisted(forecasts)} empty="No procurement forecasts with occupational-health evidence are loaded." onSelect={inspectPersisted} /> : null}
              {view === "Incumbents" ? <PersistedTable items={filterPersisted(incumbents)} empty="No occupational-health incumbent records are loaded." onSelect={inspectPersisted} /> : null}
              {view === "Contracting Offices" ? <OfficeView offices={contractingOffices} /> : null}
              {view === "Leadership" ? <LeadershipView leaders={leaders} /> : null}
              {view === "Medical Requirements" ? <PersistedTable items={filterPersisted(medical)} empty="No deployment/occupational medical requirements are loaded for this agency." onSelect={inspectPersisted} /> : null}
              {view === "Recent Activity" ? <PersistedTable items={overviewRows.slice(0, 80)} empty="No recent Occu-Med-relevant activity is loaded." onSelect={inspectPersisted} /> : null}
            </div>}
          </section>

          <aside className="bg-[#070b10]">
            <div className="sticky top-0 max-h-screen overflow-y-auto">
              <div className="flex h-14 items-center justify-between border-b border-white/10 px-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-600">Evidence inspector</p><p className="mt-0.5 text-[11px] font-black text-slate-300">Selected federal record</p></div>{inspect ? <button onClick={() => setInspect(null)} className="border border-white/8 p-1.5 text-slate-600 hover:text-white"><X size={14} /></button> : null}</div>
              {inspect ? <div className="p-5"><span className="text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/55">{inspect.kind}</span><h2 className="mt-3 text-xl font-black leading-6 text-white">{inspect.title}</h2><p className="mt-3 text-xs leading-6 text-slate-400">{inspect.summary}</p><div className="mt-5 divide-y divide-white/7 border-y border-white/7">{inspect.fields.map(([label, value]) => <div key={label} className="grid grid-cols-[105px_1fr] gap-3 py-3 text-[10px]"><span className="text-slate-600">{label}</span><strong className="break-words text-slate-300">{value}</strong></div>)}</div>{inspect.sourceUrl ? <a href={inspect.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-[10px] font-black text-cyan-200/70">Open official/source record <ExternalLink size={12} /></a> : null}</div> : <div className="grid min-h-[560px] place-items-center px-6 text-center"><div><FileSearch size={30} className="mx-auto text-slate-700" /><h3 className="mt-4 text-base font-black text-slate-300">Select a record</h3><p className="mt-2 text-[10px] leading-5 text-slate-600">The agency remains the persistent context. Select a solicitation, forecast, recompete, contract, incumbent, or medical-requirement row to inspect source details here.</p></div></div>}
              {structure.length ? <div className="border-t border-white/10 p-4"><p className="text-[9px] font-black uppercase tracking-[.13em] text-slate-600">Organization structure</p><div className="mt-3 divide-y divide-white/[.06]">{structure.slice(0, 18).map((item) => <div key={item.id} className="py-2.5"><p className="text-[10px] font-black text-slate-300">{item.name}</p><p className="mt-1 text-[9px] text-slate-600">{item.type || "Organization"}{item.agencyCode ? ` · ${item.agencyCode}` : ""}</p></div>)}</div></div> : null}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="px-4 py-3"><p className="text-[8px] font-black uppercase tracking-[.11em] text-slate-600">{label}</p><p className="mt-1 text-lg font-black text-white">{value.toLocaleString()}</p></div>; }

function OverviewView({ rows, onSelect, diagnostics }: { rows: PersistedItem[]; onSelect: (item: PersistedItem) => void; diagnostics: OpportunitiesResponse | null }) {
  const diag = diagnostics?.diagnostics;
  return <div><div data-testid="sam-diagnostics" className="border-b border-white/8 bg-black/20 px-5 py-3 text-[10px] leading-5 text-slate-500"><strong className="text-slate-300">SAM.gov:</strong> {diag ? `${diag.resultStatus} · ${diag.rawRecordsReturned.toLocaleString()} raw / ${diag.normalizedRecordsReturned.toLocaleString()} matched · ${diag.queryFilterMode}` : diagnostics?.configured === false ? "not configured" : `${diagnostics?.returned ?? 0} matched records`}{diagnostics?.limitation ? ` · ${diagnostics.limitation}` : ""}</div><PersistedTable items={rows} empty="No Occu-Med-relevant federal activity is loaded for this agency." onSelect={onSelect} /></div>;
}

function PersistedTable({ items, empty, onSelect }: { items: PersistedItem[]; empty: string; onSelect: (item: PersistedItem) => void }) {
  if (!items.length) return <div className="p-10 text-center text-sm text-slate-500">{empty}</div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="border-b border-white/8 text-[9px] uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">Record</th><th className="p-3">Office / component</th><th className="p-3">Incumbent</th><th className="p-3">Status</th><th className="p-3">Date</th></tr></thead><tbody>{items.map((item) => <tr key={`${item.bucket}-${item.id}`} onClick={() => onSelect(item)} className="cursor-pointer border-b border-white/[.055] hover:bg-white/[.025]"><td className="p-3"><p className="font-black text-white">{item.title}</p><p className="mt-1 line-clamp-2 max-w-xl text-[10px] leading-5 text-slate-500">{item.summary || "No summary stored."}</p></td><td className="p-3 text-slate-400">{item.office || item.component || "—"}</td><td className="p-3 text-slate-400">{item.contractorIncumbent || "—"}</td><td className="p-3 text-slate-400">{item.status || item.bucket.replace(/-/g, " ")}</td><td className="p-3 text-slate-500">{formatDate(item.datePosted || item.fetchedAt)}</td></tr>)}</tbody></table></div>;
}

function OpportunityTable({ items, onSelect }: { items: Opportunity[]; onSelect: (item: Opportunity) => void }) {
  if (!items.length) return <div className="p-10 text-center text-sm text-slate-500">No SAM.gov opportunities with Occu-Med-relevant service evidence are currently loaded for this agency.</div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-white/8 text-[9px] uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">Solicitation</th><th className="p-3">Organization</th><th className="p-3">NAICS</th><th className="p-3">Posted</th><th className="p-3">Deadline</th></tr></thead><tbody>{items.map((item) => <tr key={item.noticeId} onClick={() => onSelect(item)} className="cursor-pointer border-b border-white/[.055] hover:bg-white/[.025]"><td className="p-3"><p className="font-black text-white">{item.title}</p><p className="mt-1 text-[10px] text-cyan-100/50">{item.solicitationNumber || item.noticeId}</p></td><td className="p-3 text-slate-400">{item.organization || "—"}</td><td className="p-3 text-slate-400">{item.naicsCode || "—"}</td><td className="p-3 text-slate-500">{formatDate(item.postedDate)}</td><td className="p-3 text-slate-400">{formatDate(item.responseDeadline)}</td></tr>)}</tbody></table></div>;
}

function OfficeView({ offices }: { offices: Array<{ name: string; count: number }> }) {
  return <div className="divide-y divide-white/[.06]">{offices.length ? offices.map((office, index) => <div key={office.name} className="grid grid-cols-[42px_1fr_90px] gap-4 p-4"><span className="text-[10px] font-black text-slate-600">{String(index + 1).padStart(2, "0")}</span><div><p className="text-sm font-black text-white">{office.name}</p><p className="mt-1 text-[10px] text-slate-600">Seen in loaded Occu-Med-relevant records</p></div><strong className="text-right text-lg text-slate-300">{office.count}</strong></div>) : <div className="p-10 text-center text-sm text-slate-500">No contracting-office evidence is loaded.</div>}</div>;
}

function LeadershipView({ leaders }: { leaders: Leader[] }) {
  return <div className="divide-y divide-white/[.06]">{leaders.length ? leaders.map((leader) => <a key={leader.id} href={leader.sourceUrl} target="_blank" rel="noreferrer" className="grid gap-3 p-4 hover:bg-white/[.02] sm:grid-cols-[1fr_1fr_150px]"><div><p className="text-sm font-black text-white">{leader.name}</p><p className="mt-1 text-[10px] text-slate-500">{leader.positionTitle}</p></div><p className="text-xs text-slate-400">{leader.component || leader.agency || "—"}</p><p className="text-[10px] text-slate-600">{leader.location || "Location not reported"}</p></a>) : <div className="p-10 text-center text-sm text-slate-500">No OPM leadership records are loaded for this agency.</div>}</div>;
}
