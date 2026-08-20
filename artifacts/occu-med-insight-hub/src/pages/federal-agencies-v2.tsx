import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}/api/${path.replace(/^\//, "")}`;

const PERSISTED_BUCKETS = ["forecast", "recompete-watch", "incumbent-tracker", "deployment-medical"] as const;
const OCCU_MED_EVIDENCE = /occupational\s+(medicine|health)|employee\s+health|medical\s+(examination|exam|surveillance)|physical\s+exam|pre[- ]?(employment|placement)|post[- ]?offer|fitness[- ]?for[- ]?duty|health\s+surveillance|respiratory\s+protection|respirator\s+fit|fit\s+testing|audiometr|hearing\s+conservation|drug\s+testing|alcohol\s+testing|dot\s+testing|specimen\s+collection|vaccin|immuniz|travel\s+medicine|deployment\s+medicine|return\s+to\s+work|workers.?\s*comp|ergonomic|clinical\s+services.*workforce\s+readiness/i;
const VIEWS = [
  "Overview",
  "Solicitations",
  "Contracts & Spending",
  "Recompetes",
  "Forecasts",
  "Incumbents",
  "Contracting Offices",
  "Leadership",
  "Medical Requirements",
  "Recent Activity",
] as const;

type View = typeof VIEWS[number];

type PersistedItem = {
  id: string;
  bucket: string;
  sourceType: string | null;
  agency: string | null;
  component: string | null;
  office: string | null;
  regionCountry: string | null;
  title: string;
  summary: string | null;
  datePosted: string | null;
  status: string | null;
  contractorIncumbent: string | null;
  relatedRef: string | null;
  budgetSignal: string | null;
  oversightSignal: string | null;
  medicalTravelRelevance: string | null;
  occuMedScore: number | null;
  actionTag: string | null;
  sourceUrl: string | null;
  fetchedAt: string | null;
};

type FederalOrg = {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  agencyCode: string | null;
  department: string | null;
  parentPath: string | null;
  cgacCodes: string[];
};

type Opportunity = {
  noticeId: string;
  title: string;
  solicitationNumber: string | null;
  organization: string | null;
  organizationCode: string | null;
  postedDate: string | null;
  type: string | null;
  baseType: string | null;
  responseDeadline: string | null;
  naicsCode: string | null;
  classificationCode: string | null;
  active: boolean;
  setAside: string | null;
  award: { amount: number | null; awardee: string | null; date: string | null; number: string | null } | null;
  officeAddress: { city: string | null; state: string | null; zip: string | null; country: string | null };
  placeOfPerformance: { city: string | null; state: string | null; country: string | null; zip: string | null };
  pointsOfContact: Array<{ name: string | null; title: string | null; email: string | null; phone: string | null; type: string | null }>;
  sourceUrl: string;
  descriptionUrl: string | null;
  resourceLinks: string[];
  occuMedRelevant: boolean;
  occuMedScore: number;
  occuMedTags: string[];
};

type Leader = {
  id: string;
  agency: string | null;
  component: string | null;
  positionTitle: string;
  name: string;
  location: string | null;
  appointmentType: string | null;
  payPlan: string | null;
  levelGradePay: string | null;
  tenure: string | null;
  expiration: string | null;
  sourceUrl: string;
  source: string;
  confidence: string;
};

type DirectoryResponse = {
  ok?: boolean;
  configured?: boolean;
  organizations?: FederalOrg[];
  allOrganizationCount?: number;
  source?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  limitation?: string;
  error?: string;
};

type OpportunitiesResponse = {
  ok?: boolean;
  configured?: boolean;
  opportunities?: Opportunity[];
  returned?: number;
  totalRecords?: number;
  occuMedRelevant?: number;
  source?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  limitation?: string;
  error?: string;
};

type LeadershipResponse = {
  ok?: boolean;
  leaders?: Leader[];
  returned?: number;
  sourceMode?: string;
  source?: string;
  sourceUrl?: string;
  exportUrl?: string | null;
  certificationUrl?: string;
  dataAsOf?: string;
  retrievedAt?: string;
  diagnostic?: string;
  limitation?: string;
  error?: string;
};

type StructureResponse = {
  ok?: boolean;
  configured?: boolean;
  organizations?: FederalOrg[];
  returned?: number;
  agencyCode?: string | null;
  source?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  error?: string;
};

const FALLBACK_AGENCIES = [
  "Department of Defense",
  "Department of State",
  "Department of Homeland Security",
  "Department of Veterans Affairs",
  "Department of Health and Human Services",
  "Department of Justice",
  "Department of Energy",
  "Department of Transportation",
  "Department of Labor",
  "Department of Agriculture",
  "Department of the Interior",
];

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

function formatDate(value?: string | null): string {
  if (!value) return "Date not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function dateValue(value?: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function moneyValue(value?: string | null): number {
  if (!value) return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactMoney(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

function agencyMatches(value: string | null | undefined, selected: string): boolean {
  if (!value) return false;
  const left = canonicalAgency(value).toLowerCase();
  const right = canonicalAgency(selected).toLowerCase();
  return left === right || left.includes(right) || right.includes(left);
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(api(path), { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`);
  return payload as T;
}

async function safeJson<T>(path: string, fallback: T): Promise<T> {
  try { return await json<T>(path); } catch { return fallback; }
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard
      variant="glass"
      className={cn(
        "border-cyan-100/16 bg-[#04101d]/82 shadow-[0_24px_70px_rgba(0,0,0,.32),inset_0_1px_0_rgba(255,255,255,.06)]",
        className,
      )}
    >
      {children}
    </GlassCard>
  );
}

function SourceBadge({ children, tone = "cyan" }: { children: ReactNode; tone?: "cyan" | "violet" | "emerald" | "amber" }) {
  const tones = {
    cyan: "border-cyan-200/20 bg-cyan-300/[0.08] text-cyan-50/76",
    violet: "border-violet-200/20 bg-violet-300/[0.08] text-violet-50/76",
    emerald: "border-emerald-200/20 bg-emerald-300/[0.08] text-emerald-50/76",
    amber: "border-amber-200/20 bg-amber-300/[0.08] text-amber-50/76",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.13em]", tones[tone])}>{children}</span>;
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Activity }) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[9px] font-black uppercase tracking-[.17em] text-cyan-100/42">{label}</p><p className="mt-2 text-2xl font-black tracking-[-.03em] text-white">{value}</p></div>
        <div className="rounded-xl border border-cyan-100/12 bg-cyan-300/[0.055] p-2 text-cyan-100/58"><Icon size={17} /></div>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-cyan-50/46">{note}</p>
    </Panel>
  );
}

function ExternalSource({ href, label }: { href?: string | null; label: string }) {
  if (!href) return null;
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.025] px-3 text-[10px] font-bold text-cyan-50/62 transition hover:border-cyan-200/24 hover:text-white"><ExternalLink size={12} />{label}</a>;
}

function PersistedCard({ item }: { item: PersistedItem }) {
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2"><SourceBadge tone="violet">{item.sourceType || "persisted federal data"}</SourceBadge>{item.status ? <SourceBadge tone={/active/i.test(item.status) ? "emerald" : "amber"}>{item.status}</SourceBadge> : null}</div>
          <h3 className="mt-3 text-base font-black leading-6 text-white">{item.title}</h3>
          {item.summary ? <p className="mt-2 text-xs leading-6 text-cyan-50/62">{item.summary}</p> : null}
        </div>
        <ExternalSource href={item.sourceUrl} label="Source" />
      </div>
      <div className="mt-4 grid gap-2 border-t border-white/8 pt-4 text-[11px] text-cyan-50/54 sm:grid-cols-2 xl:grid-cols-4">
        <span><b className="text-cyan-50/76">Posted:</b> {formatDate(item.datePosted || item.fetchedAt)}</span>
        <span><b className="text-cyan-50/76">Incumbent:</b> {item.contractorIncumbent || "Not reported"}</span>
        <span><b className="text-cyan-50/76">Office:</b> {item.office || item.component || "Not reported"}</span>
        <span><b className="text-cyan-50/76">Value:</b> {item.budgetSignal || "Not reported"}</span>
      </div>
    </Panel>
  );
}

function OpportunityCard({ item }: { item: Opportunity }) {
  const poc = item.pointsOfContact?.[0];
  const place = [item.placeOfPerformance?.city, item.placeOfPerformance?.state, item.placeOfPerformance?.country].filter(Boolean).join(", ");
  return (
    <Panel className={cn("p-5", item.occuMedRelevant && "border-emerald-200/20 bg-emerald-300/[0.035]") }>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2"><SourceBadge tone="cyan">SAM.gov live</SourceBadge>{item.type ? <SourceBadge>{item.type}</SourceBadge> : null}{item.occuMedRelevant ? <SourceBadge tone="emerald">Occu-Med relevant</SourceBadge> : null}</div>
          <h3 className="mt-3 text-base font-black leading-6 text-white">{item.title}</h3>
          <p className="mt-2 text-[11px] leading-5 text-cyan-50/52">{item.organization || "Federal organization not reported"}</p>
        </div>
        <ExternalSource href={item.sourceUrl} label="Open SAM.gov" />
      </div>
      {item.occuMedTags?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{item.occuMedTags.map((tag) => <span key={tag} className="rounded-lg border border-emerald-200/14 bg-emerald-300/[0.055] px-2 py-1 text-[9px] font-bold text-emerald-50/70">{tag}</span>)}</div> : null}
      <div className="mt-4 grid gap-2 border-t border-white/8 pt-4 text-[11px] leading-5 text-cyan-50/54 sm:grid-cols-2 xl:grid-cols-4">
        <span><b className="text-cyan-50/76">Posted:</b> {formatDate(item.postedDate)}</span>
        <span><b className="text-cyan-50/76">Response:</b> {formatDate(item.responseDeadline)}</span>
        <span><b className="text-cyan-50/76">Solicitation:</b> {item.solicitationNumber || item.noticeId || "Not reported"}</span>
        <span><b className="text-cyan-50/76">NAICS:</b> {item.naicsCode || "Not reported"}</span>
        <span><b className="text-cyan-50/76">Set-aside:</b> {item.setAside || "Not reported"}</span>
        <span><b className="text-cyan-50/76">Place:</b> {place || "Not reported"}</span>
        <span><b className="text-cyan-50/76">POC:</b> {poc?.name || poc?.email || "Not reported"}</span>
        <span><b className="text-cyan-50/76">Contact:</b> {poc?.email || poc?.phone || "Not reported"}</span>
      </div>
    </Panel>
  );
}

function LeaderCard({ leader, sourceMode }: { leader: Leader; sourceMode?: string }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2"><SourceBadge tone="violet">{sourceMode === "opm-plum" ? "OPM PLUM" : "official agency source"}</SourceBadge><SourceBadge>{leader.confidence}</SourceBadge></div>
          <h3 className="mt-3 text-lg font-black text-white">{leader.name}</h3>
          <p className="mt-1 text-sm font-bold text-cyan-50/78">{leader.positionTitle}</p>
          {leader.component ? <p className="mt-1 text-xs text-cyan-50/48">{leader.component}</p> : null}
        </div>
        <ExternalSource href={leader.sourceUrl} label="Evidence" />
      </div>
      <div className="mt-4 grid gap-2 border-t border-white/8 pt-4 text-[11px] text-cyan-50/54 sm:grid-cols-2">
        <span><b className="text-cyan-50/76">Location:</b> {leader.location || "Not reported"}</span>
        <span><b className="text-cyan-50/76">Appointment:</b> {leader.appointmentType || "Not reported"}</span>
        <span><b className="text-cyan-50/76">Pay plan:</b> {leader.payPlan || "Not reported"}</span>
        <span><b className="text-cyan-50/76">Level / grade:</b> {leader.levelGradePay || "Not reported"}</span>
      </div>
    </Panel>
  );
}

function EmptyState({ label }: { label: string }) {
  return <Panel className="grid min-h-44 place-items-center p-8 text-center"><div><FileSearch className="mx-auto text-cyan-100/32" size={24} /><p className="mt-3 text-sm font-black text-white">{label}</p><p className="mt-1 text-xs leading-5 text-cyan-50/44">No records from the loaded official or persisted sources match this view and filter.</p></div></Panel>;
}

export default function FederalAgenciesV2Page() {
  const [persisted, setPersisted] = useState<PersistedItem[]>([]);
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [selectedAgency, setSelectedAgency] = useState("Department of Defense");
  const [agencyQuery, setAgencyQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<View>("Overview");
  const [opportunities, setOpportunities] = useState<OpportunitiesResponse | null>(null);
  const [leadership, setLeadership] = useState<LeadershipResponse | null>(null);
  const [structure, setStructure] = useState<StructureResponse | null>(null);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingAgency, setLoadingAgency] = useState(true);
  const [baseError, setBaseError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingBase(true);
      const [directoryPayload, ...buckets] = await Promise.all([
        safeJson<DirectoryResponse>("core-intelligence/federal-live/directory", { organizations: [], configured: false }),
        ...PERSISTED_BUCKETS.map((bucket) => safeJson<{ items?: PersistedItem[] }>(`federal-intel/${bucket}?limit=200`, { items: [] })),
      ]);
      if (cancelled) return;
      const allPersisted = buckets.flatMap((payload) => Array.isArray(payload.items) ? payload.items : []);
      setDirectory(directoryPayload);
      setPersisted(allPersisted);
      const availableNames = [
        ...(Array.isArray(directoryPayload.organizations) ? directoryPayload.organizations.map((org) => canonicalAgency(org.name)) : []),
        ...allPersisted.map((item) => canonicalAgency(item.agency)),
      ].filter(Boolean);
      const unique = [...new Set(availableNames)];
      if (!unique.some((name) => name === "Department of Defense") && unique[0]) setSelectedAgency(unique[0]);
      setBaseError(directoryPayload.error || "");
      setLoadingBase(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingAgency(true);
      const encoded = encodeURIComponent(selectedAgency);
      const [opps, leaders, orgs] = await Promise.all([
        safeJson<OpportunitiesResponse>(`core-intelligence/federal-live/opportunities?agency=${encoded}&days=365`, { opportunities: [], configured: false }),
        safeJson<LeadershipResponse>(`core-intelligence/federal-live/leadership?agency=${encoded}`, { leaders: [], source: "OPM PLUM Reporting" }),
        safeJson<StructureResponse>(`core-intelligence/federal-live/structure?agency=${encoded}`, { organizations: [], configured: false }),
      ]);
      if (cancelled) return;
      setOpportunities(opps);
      setLeadership(leaders);
      setStructure(orgs);
      setLoadingAgency(false);
    })();
    return () => { cancelled = true; };
  }, [selectedAgency]);

  const agencies = useMemo(() => {
    const rows = [
      ...(Array.isArray(directory?.organizations) ? directory.organizations.map((org) => canonicalAgency(org.name)) : []),
      ...persisted.map((item) => canonicalAgency(item.agency)),
      ...FALLBACK_AGENCIES,
    ].filter(Boolean);
    return [...new Set(rows)].sort((a, b) => a.localeCompare(b));
  }, [directory, persisted]);

  const visibleAgencies = useMemo(() => {
    const q = agencyQuery.trim().toLowerCase();
    return q ? agencies.filter((agency) => agency.toLowerCase().includes(q)).slice(0, 70) : agencies.slice(0, 70);
  }, [agencies, agencyQuery]);

  const agencyPersisted = useMemo(() => persisted.filter((item) => agencyMatches(item.agency, selectedAgency)), [persisted, selectedAgency]);
  const agencyOpportunities = Array.isArray(opportunities?.opportunities) ? opportunities!.opportunities! : [];
  const agencyLeaders = Array.isArray(leadership?.leaders) ? leadership!.leaders! : [];
  const agencyStructure = Array.isArray(structure?.organizations) ? structure!.organizations! : [];

  const query = filter.trim().toLowerCase();
  const textMatches = (parts: Array<string | null | undefined>) => !query || parts.filter(Boolean).join(" ").toLowerCase().includes(query);
  const filteredPersisted = agencyPersisted.filter((item) => textMatches([item.title, item.summary, item.contractorIncumbent, item.office, item.component, item.medicalTravelRelevance, item.actionTag]));
  const filteredOpps = agencyOpportunities.filter((item) => textMatches([item.title, item.organization, item.solicitationNumber, item.naicsCode, item.type, item.setAside, ...(item.occuMedTags || [])]));
  const filteredLeaders = agencyLeaders.filter((item) => textMatches([item.name, item.positionTitle, item.component, item.location, item.appointmentType]));
  const filteredStructure = agencyStructure.filter((item) => textMatches([item.name, item.department, item.parentPath, item.agencyCode, item.type]));

  const incumbentItems = agencyPersisted.filter((item) => item.bucket === "incumbent-tracker");
  const knownSpend = incumbentItems.reduce((sum, item) => sum + moneyValue(item.budgetSignal), 0);
  const activeContracts = incumbentItems.filter((item) => /active/i.test(item.status || "")).length;
  const hasMedicalEvidence = (item: PersistedItem) => OCCU_MED_EVIDENCE.test(`${item.title} ${item.summary || ""} ${item.medicalTravelRelevance || ""}`);
  const recompetes = agencyPersisted.filter((item) => item.bucket === "recompete-watch" && hasMedicalEvidence(item));
  const forecasts = agencyPersisted.filter((item) => item.bucket === "forecast" && hasMedicalEvidence(item));
  const medicalPersisted = agencyPersisted.filter((item) => item.bucket === "deployment-medical");
  const relevantOpps = agencyOpportunities.filter((item) => item.occuMedRelevant);
  const incumbentGroups = useMemo(() => {
    const map = new Map<string, { name: string; count: number; tracked: number; active: number }>();
    for (const item of incumbentItems) {
      const name = item.contractorIncumbent?.trim();
      if (!name) continue;
      const current = map.get(name) || { name, count: 0, tracked: 0, active: 0 };
      current.count += 1;
      current.tracked += moneyValue(item.budgetSignal);
      if (/active/i.test(item.status || "")) current.active += 1;
      map.set(name, current);
    }
    return [...map.values()].sort((a, b) => b.tracked - a.tracked || b.count - a.count);
  }, [incumbentItems]);

  const officeGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of agencyPersisted) {
      const office = item.office || item.component;
      if (office) map.set(office, (map.get(office) || 0) + 1);
    }
    for (const org of agencyStructure) map.set(org.name, (map.get(org.name) || 0) + 1);
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [agencyPersisted, agencyStructure]);

  const recentRows = useMemo(() => {
    const rows: Array<{ kind: "opportunity" | "persisted"; date: string | null; opportunity?: Opportunity; item?: PersistedItem }> = [
      ...agencyOpportunities.map((opportunity) => ({ kind: "opportunity" as const, date: opportunity.postedDate, opportunity })),
      ...agencyPersisted.map((item) => ({ kind: "persisted" as const, date: item.datePosted || item.fetchedAt, item })),
    ];
    return rows.sort((a, b) => dateValue(b.date) - dateValue(a.date)).slice(0, 30);
  }, [agencyOpportunities, agencyPersisted]);

  const latestPersisted = agencyPersisted.reduce((latest, item) => Math.max(latest, dateValue(item.fetchedAt)), 0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(13,148,136,.28),transparent_34%),radial-gradient(circle_at_55%_48%,rgba(14,165,233,.21),transparent_42%),radial-gradient(circle_at_88%_24%,rgba(79,70,229,.22),transparent_34%),linear-gradient(145deg,#020817_8%,#06243b_46%,#071333_70%,#0b0824)]" />
      <Sidebar />
      <main className="relative min-h-screen px-5 py-8 sm:px-8 lg:ml-[210px] lg:px-10 xl:px-14">
        <HeaderBar eyebrow="Federal Intelligence Workspace" title="Federal Agencies" subtitle="Agency intelligence opens preloaded: live SAM.gov solicitations and hierarchy, leadership evidence, persisted awards/incumbents, recompetes, forecasts, contracting offices, and occupational-health signals." />

        <section className="grid gap-5 xl:grid-cols-[290px_1fr]">
          <Panel className="h-fit p-4 xl:sticky xl:top-5">
            <div className="flex items-center gap-2"><Landmark size={17} className="text-cyan-100/64" /><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-100/52">Agency directory</p></div>
            <label className="mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 focus-within:border-cyan-200/28">
              <Search size={14} className="text-cyan-100/44" /><input value={agencyQuery} onChange={(event) => setAgencyQuery(event.target.value)} placeholder="Filter agencies…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-cyan-50/34" />
            </label>
            <div className="mt-3 max-h-[58vh] space-y-1 overflow-y-auto pr-1">
              {visibleAgencies.map((agency) => <button key={agency} type="button" onClick={() => { setSelectedAgency(agency); setFilter(""); setView("Overview"); }} className={cn("w-full rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition", agency === selectedAgency ? "border-cyan-200/26 bg-cyan-300/[0.10] text-white" : "border-transparent text-cyan-50/52 hover:border-white/8 hover:bg-white/[0.025] hover:text-white")}>{agency}</button>)}
            </div>
            <div className="mt-4 border-t border-white/8 pt-4 text-[10px] leading-5 text-cyan-50/40">
              <p>{directory?.allOrganizationCount ? `${directory.allOrganizationCount.toLocaleString()} active SAM hierarchy records indexed.` : "SAM hierarchy augments the known agency directory when configured."}</p>
            </div>
          </Panel>

          <div className="min-w-0 space-y-5">
            <Panel className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.20em] text-cyan-100/50">Selected agency</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-white sm:text-3xl">{selectedAgency}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SourceBadge tone="cyan">SAM.gov live</SourceBadge>
                    <SourceBadge tone="violet">OPM PLUM · data 2026-06-15</SourceBadge>
                    <SourceBadge tone="emerald">USAspending / persisted intelligence</SourceBadge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2"><ExternalSource href="https://sam.gov/content/opportunities" label="SAM Opportunities" /><ExternalSource href="https://sam.gov/content/fh" label="Federal Hierarchy" /><ExternalSource href={leadership?.sourceUrl || "https://www.opm.gov/about-us/open-government/plum-reporting/plum-data/"} label="OPM PLUM" /></div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-white/8 bg-white/[0.022] p-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/38">SAM refresh</p><p className="mt-1 text-xs font-bold text-white">{formatDate(opportunities?.retrievedAt)}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.022] p-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/38">Persisted refresh</p><p className="mt-1 text-xs font-bold text-white">{latestPersisted ? formatDate(new Date(latestPersisted).toISOString()) : "No agency rows"}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.022] p-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/38">Leadership mode</p><p className="mt-1 text-xs font-bold text-white">{leadership?.sourceMode === "opm-plum" ? "OPM PLUM export" : leadership?.sourceMode === "official-site-fallback" ? "Official agency pages" : "Loading"}</p></div>
                <div className="rounded-xl border border-white/8 bg-white/[0.022] p-3"><p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/38">SAM agency code</p><p className="mt-1 text-xs font-bold text-white">{structure?.agencyCode || "Resolving"}</p></div>
              </div>
              {baseError ? <p className="mt-4 text-xs text-amber-100/64">Directory note: {baseError}</p> : null}
              {leadership?.diagnostic ? <p className="mt-3 text-[10px] leading-5 text-cyan-50/38">Leadership source note: {leadership.diagnostic}</p> : null}
            </Panel>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Live solicitations" value={agencyOpportunities.length.toLocaleString()} note="SAM.gov notices in the last 365 days" icon={FileSearch} />
              <Metric label="Occu-Med relevant" value={relevantOpps.length.toLocaleString()} note="Medical / occupational-health triage" icon={HeartPulse} />
              <Metric label="Active contracts" value={activeContracts.toLocaleString()} note="Persisted active incumbent rows" icon={ShieldCheck} />
              <Metric label="Tracked spend" value={compactMoney(knownSpend)} note="Values present in persisted award intelligence" icon={CircleDollarSign} />
              <Metric label="Recompetes" value={recompetes.length.toLocaleString()} note="Persisted recompete-watch signals" icon={CalendarClock} />
              <Metric label="Leadership" value={agencyLeaders.length.toLocaleString()} note="PLUM or official agency evidence" icon={Users} />
            </div>

            <Panel className="p-3 sm:p-4">
              <div className="flex gap-2 overflow-x-auto pb-1">{VIEWS.map((item) => <button key={item} type="button" onClick={() => setView(item)} className={cn("shrink-0 rounded-xl border px-3.5 py-2.5 text-[11px] font-black transition", view === item ? "border-cyan-200/28 bg-cyan-300/[0.11] text-white" : "border-white/8 bg-white/[0.02] text-cyan-50/50 hover:text-white")}>{item}</button>)}</div>
              <label className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 focus-within:border-cyan-200/28"><Search size={14} className="text-cyan-100/40" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter loaded intelligence…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-cyan-50/32" /></label>
            </Panel>

            {(loadingBase || loadingAgency) && view === "Overview" ? <Panel className="flex min-h-28 items-center justify-center gap-3 p-6 text-sm font-bold text-cyan-50/62"><Loader2 className="animate-spin" size={18} />Loading official and persisted Federal intelligence…</Panel> : null}

            {view === "Overview" ? (
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="space-y-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-100/52">Priority opportunity signals</p><h2 className="mt-1 text-lg font-black text-white">Occupational-health-relevant SAM notices</h2></div>{relevantOpps.slice(0, 6).length ? relevantOpps.slice(0, 6).map((item) => <OpportunityCard key={item.noticeId || item.sourceUrl} item={item} />) : <EmptyState label="No current occupational-health-tagged SAM notices" />}</div>
                <div className="space-y-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-100/52">Forward pipeline</p><h2 className="mt-1 text-lg font-black text-white">Recompetes and forecasts</h2></div>{[...recompetes, ...forecasts].sort((a, b) => dateValue(b.datePosted || b.fetchedAt) - dateValue(a.datePosted || a.fetchedAt)).slice(0, 7).map((item) => <PersistedCard key={item.id} item={item} />)}{!recompetes.length && !forecasts.length ? <EmptyState label="No persisted recompete or forecast rows for this agency" /> : null}</div>
              </div>
            ) : null}

            {view === "Solicitations" ? <div className="space-y-3">{filteredOpps.length ? filteredOpps.map((item) => <OpportunityCard key={item.noticeId || item.sourceUrl} item={item} />) : <EmptyState label="No loaded SAM.gov solicitations match" />}</div> : null}

            {view === "Contracts & Spending" ? <div className="space-y-3">{filteredPersisted.filter((item) => item.bucket === "incumbent-tracker").length ? filteredPersisted.filter((item) => item.bucket === "incumbent-tracker").map((item) => <PersistedCard key={item.id} item={item} />) : <EmptyState label="No loaded contract/spending rows match" />}</div> : null}

            {view === "Recompetes" ? <div className="space-y-3">{filteredPersisted.filter((item) => item.bucket === "recompete-watch" && hasMedicalEvidence(item)).length ? filteredPersisted.filter((item) => item.bucket === "recompete-watch" && hasMedicalEvidence(item)).map((item) => <PersistedCard key={item.id} item={item} />) : <EmptyState label="No occupational-health recompete records match" />}</div> : null}

            {view === "Forecasts" ? <div className="space-y-3">{filteredPersisted.filter((item) => item.bucket === "forecast" && hasMedicalEvidence(item)).length ? filteredPersisted.filter((item) => item.bucket === "forecast" && hasMedicalEvidence(item)).map((item) => <PersistedCard key={item.id} item={item} />) : <EmptyState label="No occupational-health forecast records match" />}</div> : null}

            {view === "Incumbents" ? <div className="grid gap-3 lg:grid-cols-2">{incumbentGroups.filter((row) => textMatches([row.name])).map((row) => <Panel key={row.name} className="p-5"><div className="flex items-start justify-between gap-3"><div><SourceBadge tone="emerald">incumbent intelligence</SourceBadge><h3 className="mt-3 text-lg font-black text-white">{row.name}</h3></div><Building2 size={20} className="text-cyan-100/42" /></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-4 text-center"><div><p className="text-lg font-black text-white">{row.count}</p><p className="text-[9px] uppercase tracking-[.13em] text-cyan-50/36">records</p></div><div><p className="text-lg font-black text-white">{row.active}</p><p className="text-[9px] uppercase tracking-[.13em] text-cyan-50/36">active</p></div><div><p className="text-lg font-black text-white">{compactMoney(row.tracked)}</p><p className="text-[9px] uppercase tracking-[.13em] text-cyan-50/36">tracked</p></div></div></Panel>)}{!incumbentGroups.length ? <EmptyState label="No incumbent names loaded for this agency" /> : null}</div> : null}

            {view === "Contracting Offices" ? <div className="grid gap-3 lg:grid-cols-2">{officeGroups.filter((row) => textMatches([row.name])).map((row) => <Panel key={row.name} className="p-5"><div className="flex items-start justify-between gap-4"><div><SourceBadge tone="cyan">SAM hierarchy + persisted</SourceBadge><h3 className="mt-3 text-base font-black text-white">{row.name}</h3></div><span className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-xs font-black text-cyan-50/60">{row.count}</span></div></Panel>)}{!officeGroups.length ? <EmptyState label="No contracting-office or subtier records loaded" /> : null}</div> : null}

            {view === "Leadership" ? <div className="space-y-4"><Panel className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-100/50">Leadership provenance</p><p className="mt-1 text-xs leading-5 text-cyan-50/56">{leadership?.source || "OPM PLUM Reporting"} · PLUM data as of {leadership?.dataAsOf || "2026-06-15"}. {leadership?.limitation || "PLUM covers policy and supporting positions, not every manager or employee."}</p></div><div className="flex gap-2"><ExternalSource href={leadership?.sourceUrl} label="PLUM Data" /><ExternalSource href={leadership?.certificationUrl} label="Agency Certification" /></div></div></Panel>{filteredLeaders.length ? <div className="grid gap-3 lg:grid-cols-2">{filteredLeaders.map((leader) => <LeaderCard key={leader.id} leader={leader} sourceMode={leadership?.sourceMode} />)}</div> : <EmptyState label="No named leadership records were returned from official sources" />}</div> : null}

            {view === "Medical Requirements" ? <div className="space-y-5"><div className="space-y-3"><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-100/52">Live procurement signals</p>{filteredOpps.filter((item) => item.occuMedRelevant).map((item) => <OpportunityCard key={item.noticeId || item.sourceUrl} item={item} />)}{!filteredOpps.some((item) => item.occuMedRelevant) ? <EmptyState label="No current SAM notices match occupational-health triage" /> : null}</div><div className="space-y-3"><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-100/52">Persisted medical / deployment intelligence</p>{filteredPersisted.filter((item) => item.bucket === "deployment-medical").map((item) => <PersistedCard key={item.id} item={item} />)}{!medicalPersisted.length ? <EmptyState label="No persisted deployment-medical records for this agency" /> : null}</div></div> : null}

            {view === "Recent Activity" ? <div className="space-y-3">{recentRows.filter((row) => row.opportunity ? textMatches([row.opportunity.title, row.opportunity.organization, row.opportunity.solicitationNumber]) : row.item ? textMatches([row.item.title, row.item.summary, row.item.contractorIncumbent]) : false).map((row, index) => row.opportunity ? <OpportunityCard key={`opp-${row.opportunity.noticeId}-${index}`} item={row.opportunity} /> : row.item ? <PersistedCard key={`item-${row.item.id}-${index}`} item={row.item} /> : null)}{!recentRows.length ? <EmptyState label="No recent Federal activity loaded" /> : null}</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
