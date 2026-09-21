import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CalendarClock,
  ExternalLink,
  FileSearch,
  HeartPulse,
  Landmark,
  Loader2,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import "./federal-agencies-cinematic.css";

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

const AGENCY_MEDIA: Record<string, { domain: string; photo?: string; photoSource?: string }> = {
  "Department of Defense": {
    domain: "defense.gov",
    photo: "https://media.defense.gov/2021/Jan/25/2002570077/-1/-1/0/210122-D-BN624-0029Y.JPG",
    photoSource: "https://www.defense.gov/Multimedia/Photos/igphoto/2002570077/",
  },
  "Department of State": { domain: "state.gov" },
  "Department of Homeland Security": { domain: "dhs.gov" },
  "Department of Veterans Affairs": { domain: "va.gov" },
  "Department of Health and Human Services": { domain: "hhs.gov" },
  "Department of Justice": { domain: "justice.gov" },
  "Department of Energy": { domain: "energy.gov" },
  "Department of Transportation": { domain: "transportation.gov" },
  "Department of Labor": { domain: "dol.gov" },
  "Department of Agriculture": { domain: "usda.gov" },
  "Department of the Interior": { domain: "doi.gov" },
};

type PersistedItem = { id: string; bucket: string; sourceType: string | null; agency: string | null; component: string | null; office: string | null; regionCountry: string | null; title: string; summary: string | null; datePosted: string | null; status: string | null; contractorIncumbent: string | null; relatedRef: string | null; budgetSignal: string | null; oversightSignal: string | null; medicalTravelRelevance: string | null; occuMedScore: number | null; actionTag: string | null; sourceUrl: string | null; fetchedAt: string | null };
type FederalOrg = { id: string; name: string; type: string | null; status: string | null; agencyCode: string | null; department: string | null; parentPath: string | null; cgacCodes: string[] };
type Opportunity = { noticeId: string; title: string; solicitationNumber: string | null; organization: string | null; organizationCode: string | null; postedDate: string | null; type: string | null; baseType: string | null; responseDeadline: string | null; naicsCode: string | null; classificationCode: string | null; active: boolean; setAside: string | null; award: { amount: number | null; awardee: string | null; date: string | null; number: string | null } | null; officeAddress: { city: string | null; state: string | null; zip: string | null; country: string | null }; placeOfPerformance: { city: string | null; state: string | null; country: string | null; zip: string | null }; pointsOfContact: Array<{ name: string | null; title: string | null; email: string | null; phone: string | null; type: string | null }>; sourceUrl: string; descriptionUrl: string | null; resourceLinks: string[]; occuMedRelevant: boolean; occuMedScore: number; occuMedTags: string[] };
type Leader = { id: string; agency: string | null; component: string | null; positionTitle: string; name: string; location: string | null; appointmentType: string | null; payPlan: string | null; levelGradePay: string | null; tenure: string | null; expiration: string | null; sourceUrl: string; source: string; confidence: string };
type DirectoryResponse = { organizations?: FederalOrg[]; error?: string };
type OpportunitiesResponse = { configured?: boolean; opportunities?: Opportunity[]; returned?: number; limitation?: string; diagnostics?: { resultStatus: string; queryFilterMode: string; rawRecordsReturned: number; normalizedRecordsReturned: number } };
type LeadershipResponse = { leaders?: Leader[] };
type StructureResponse = { organizations?: FederalOrg[] };
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
function agencyInitials(value: string) { return value.replace(/^Department of (the )?/i, "").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 4).toUpperCase(); }

export default function FederalAgenciesCinematic() {
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
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingDirectory(true);
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
    setLoadingAgency(true);
    setError("");
    setInspect(null);
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
  }, [selectedAgency, refreshNonce]);

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

  const media = AGENCY_MEDIA[selectedAgency] || { domain: "usa.gov" };
  const favicon = `https://${media.domain}/favicon.ico`;

  return (
    <main className="fa-cinematic">
      <Sidebar />
      <section className="fa-shell">
        <div className="fa-scene" key={selectedAgency}>
          {media.photo ? <img src={media.photo} alt="" className="fa-scene-photo" /> : null}
          <div className="fa-scene-shade" />
          <div className="fa-curtain fa-curtain-top" aria-hidden="true" />
          <div className="fa-curtain fa-curtain-bottom" aria-hidden="true" />

          <div className="fa-scene-copy">
            <div className="fa-agency-id">
              <img src={favicon} alt="" className="fa-agency-favicon" onError={(event) => { event.currentTarget.style.display = "none"; }} />
              <span>{agencyInitials(selectedAgency)}</span>
            </div>
            <p className="fa-eyebrow">Public Intelligence · Federal</p>
            <h1>Federal Agencies</h1>
            <h2>{selectedAgency}</h2>
            <p className="fa-scene-subtitle">Live federal opportunity, contract, forecast, leadership, office, and occupational-health intelligence.</p>
          </div>

          <div className="fa-scene-actions">
            <button type="button" onClick={() => setRefreshNonce((value) => value + 1)} disabled={loadingAgency}>
              <RefreshCw size={14} className={loadingAgency ? "fa-spin" : ""} />
              Refresh feed
            </button>
            <a href={`https://${media.domain}`} target="_blank" rel="noreferrer">Official site <ExternalLink size={12} /></a>
            {media.photoSource ? <a href={media.photoSource} target="_blank" rel="noreferrer">Photo source <ExternalLink size={12} /></a> : null}
          </div>

          <div className="fa-telemetry" aria-label="Agency record counts">
            <Telemetry label="Solicitations" value={opportunities.length} icon={<FileSearch size={13} />} />
            <Telemetry label="Recompetes" value={recompetes.length} icon={<CalendarClock size={13} />} />
            <Telemetry label="Forecasts" value={forecasts.length} icon={<Building2 size={13} />} />
            <Telemetry label="Medical" value={medical.length} icon={<HeartPulse size={13} />} />
          </div>
        </div>

        {error ? <div className="fa-error">{error}</div> : null}

        <div className="fa-workspace">
          <aside className="fa-directory" aria-label="Federal agency directory">
            <div className="fa-search">
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loaded intelligence" />
            </div>
            <div className="fa-directory-heading"><Landmark size={14} /> Agency directory</div>
            <div className="fa-agency-list">
              {loadingDirectory ? <div className="fa-loading-line"><Loader2 size={16} className="fa-spin" /> Loading agencies</div> : agencies.map((name) => (
                <button key={name} type="button" onClick={() => { setSelectedAgency(name); setView("Overview"); }} aria-pressed={selectedAgency === name}>
                  <span className="fa-agency-code">{agencyInitials(name)}</span>
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="fa-data-stage">
            <nav className="fa-view-rail" aria-label="Agency intelligence views">
              {VIEWS.map((item) => <button key={item} type="button" onClick={() => setView(item)} aria-current={view === item ? "page" : undefined}>{item}</button>)}
            </nav>

            <div className="fa-stage-heading">
              <div>
                <span>{view}</span>
                <strong>{selectedAgency}</strong>
              </div>
              <div className="fa-live-status"><span /> {loadingAgency ? "Refreshing sources" : "Live workspace"}</div>
            </div>

            <div className="fa-stage-body">
              {loadingAgency ? <div className="fa-stage-loading"><Loader2 size={22} className="fa-spin" /><span>Loading agency sources…</span></div> : null}
              {!loadingAgency && view === "Overview" ? <OverviewView rows={overviewRows.slice(0, 25)} onSelect={inspectPersisted} diagnostics={opportunityMeta} /> : null}
              {!loadingAgency && view === "Solicitations" ? <OpportunityTable items={filteredOpportunities} onSelect={inspectOpportunity} /> : null}
              {!loadingAgency && view === "Contracts & Spending" ? <PersistedTable items={filterPersisted([...incumbents, ...relevantAll.filter((item) => /contract|award|spend/i.test(`${item.bucket} ${item.title} ${item.summary || ""}`))])} empty="No Occu-Med-relevant contract/spending records are loaded for this agency." onSelect={inspectPersisted} /> : null}
              {!loadingAgency && view === "Recompetes" ? <PersistedTable items={filterPersisted(recompetes)} empty="No recompete records with affirmative occupational-health and recompete evidence are loaded." onSelect={inspectPersisted} /> : null}
              {!loadingAgency && view === "Forecasts" ? <PersistedTable items={filterPersisted(forecasts)} empty="No procurement forecasts with occupational-health evidence are loaded." onSelect={inspectPersisted} /> : null}
              {!loadingAgency && view === "Incumbents" ? <PersistedTable items={filterPersisted(incumbents)} empty="No occupational-health incumbent records are loaded." onSelect={inspectPersisted} /> : null}
              {!loadingAgency && view === "Contracting Offices" ? <OfficeView offices={contractingOffices} /> : null}
              {!loadingAgency && view === "Leadership" ? <LeadershipView leaders={leaders} /> : null}
              {!loadingAgency && view === "Medical Requirements" ? <PersistedTable items={filterPersisted(medical)} empty="No deployment/occupational medical requirements are loaded for this agency." onSelect={inspectPersisted} /> : null}
              {!loadingAgency && view === "Recent Activity" ? <PersistedTable items={overviewRows.slice(0, 80)} empty="No recent Occu-Med-relevant activity is loaded." onSelect={inspectPersisted} /> : null}
            </div>
          </section>

          <aside className={`fa-inspector ${inspect ? "is-open" : ""}`} aria-label="Evidence inspector">
            <div className="fa-inspector-head">
              <div><span>Evidence inspector</span><strong>{inspect ? "Selected federal record" : "Nothing selected"}</strong></div>
              {inspect ? <button type="button" onClick={() => setInspect(null)} aria-label="Close inspector"><X size={15} /></button> : null}
            </div>
            {inspect ? (
              <div className="fa-inspector-body">
                <span className="fa-inspector-kind">{inspect.kind}</span>
                <h3>{inspect.title}</h3>
                <p>{inspect.summary}</p>
                <dl>{inspect.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                {inspect.sourceUrl ? <a href={inspect.sourceUrl} target="_blank" rel="noreferrer">Open official/source record <ExternalLink size={12} /></a> : null}
              </div>
            ) : (
              <div className="fa-inspector-empty"><FileSearch size={24} /><p>Select a solicitation, contract, forecast, recompete, incumbent, leadership record, or medical requirement to inspect its source evidence.</p></div>
            )}
            {structure.length ? <div className="fa-structure"><span>Organization structure</span>{structure.slice(0, 18).map((item) => <div key={item.id}><strong>{item.name}</strong><small>{item.type || "Organization"}{item.agencyCode ? ` · ${item.agencyCode}` : ""}</small></div>)}</div> : null}
          </aside>
        </div>
      </section>
    </main>
  );
}

function Telemetry({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="fa-telemetry-item">{icon}<span>{label}</span><strong>{value.toLocaleString()}</strong></div>;
}

function OverviewView({ rows, onSelect, diagnostics }: { rows: PersistedItem[]; onSelect: (item: PersistedItem) => void; diagnostics: OpportunitiesResponse | null }) {
  const diag = diagnostics?.diagnostics;
  return <div className="fa-overview"><div data-testid="sam-diagnostics" className="fa-diagnostics"><strong>SAM.gov</strong><span>{diag ? `${diag.resultStatus} · ${diag.rawRecordsReturned.toLocaleString()} raw / ${diag.normalizedRecordsReturned.toLocaleString()} matched · ${diag.queryFilterMode}` : diagnostics?.configured === false ? "not configured" : `${diagnostics?.returned ?? 0} matched records`}{diagnostics?.limitation ? ` · ${diagnostics.limitation}` : ""}</span></div><PersistedTable items={rows} empty="No Occu-Med-relevant federal activity is loaded for this agency." onSelect={onSelect} /></div>;
}

function PersistedTable({ items, empty, onSelect }: { items: PersistedItem[]; empty: string; onSelect: (item: PersistedItem) => void }) {
  if (!items.length) return <div className="fa-empty">{empty}</div>;
  return <div className="fa-row-stream">{items.map((item) => <button key={`${item.bucket}-${item.id}`} type="button" onClick={() => onSelect(item)} className="fa-record-row"><span className="fa-row-date">{formatDate(item.datePosted || item.fetchedAt)}</span><span className="fa-row-main"><strong>{item.title}</strong><small>{item.summary || "No summary stored."}</small></span><span className="fa-row-office">{item.office || item.component || "—"}</span><span className="fa-row-status">{item.status || item.bucket.replace(/-/g, " ")}</span></button>)}</div>;
}

function OpportunityTable({ items, onSelect }: { items: Opportunity[]; onSelect: (item: Opportunity) => void }) {
  if (!items.length) return <div className="fa-empty">No SAM.gov opportunities with Occu-Med-relevant service evidence are currently loaded for this agency.</div>;
  return <div className="fa-row-stream">{items.map((item) => <button key={item.noticeId} type="button" onClick={() => onSelect(item)} className="fa-record-row"><span className="fa-row-date">{formatDate(item.postedDate)}</span><span className="fa-row-main"><strong>{item.title}</strong><small>{item.solicitationNumber || item.noticeId}</small></span><span className="fa-row-office">{item.organization || "—"}</span><span className="fa-row-status">{item.naicsCode || "NAICS —"}</span></button>)}</div>;
}

function OfficeView({ offices }: { offices: Array<{ name: string; count: number }> }) {
  return <div className="fa-row-stream">{offices.length ? offices.map((office, index) => <div key={office.name} className="fa-office-row"><span>{String(index + 1).padStart(2, "0")}</span><strong>{office.name}</strong><small>{office.count.toLocaleString()} matched records</small></div>) : <div className="fa-empty">No contracting-office evidence is loaded.</div>}</div>;
}

function LeadershipView({ leaders }: { leaders: Leader[] }) {
  return <div className="fa-row-stream">{leaders.length ? leaders.map((leader) => <a key={leader.id} href={leader.sourceUrl} target="_blank" rel="noreferrer" className="fa-leader-row"><Users size={14} /><span><strong>{leader.name}</strong><small>{leader.positionTitle}</small></span><span>{leader.component || leader.agency || "—"}</span><span>{leader.location || "Location not reported"}</span></a>) : <div className="fa-empty">No OPM leadership records are loaded for this agency.</div>}</div>;
}
