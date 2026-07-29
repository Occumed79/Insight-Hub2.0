import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import {
  Activity,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Globe2,
  Landmark,
  Map,
  MapPin,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}/api/${path}`;
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(api(path), { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `Request failed with HTTP ${response.status}`);
  return body as T;
}

function parseList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function WorkspaceShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020713] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(20,184,166,.13),transparent_26%),radial-gradient(circle_at_72%_75%,rgba(59,130,246,.16),transparent_34%),radial-gradient(circle_at_98%_52%,rgba(139,92,246,.12),transparent_30%)]" />
      <Sidebar />
      <main className="relative min-h-screen px-5 py-8 sm:px-8 lg:ml-[210px] lg:px-10 xl:px-14">
        <HeaderBar eyebrow={eyebrow} title={title} subtitle={subtitle} />
        {children}
      </main>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return <GlassCard variant="glass" className="p-8 text-sm text-cyan-100/50">Loading {label}…</GlassCard>;
}

function ErrorCard({ error }: { error: unknown }) {
  return (
    <GlassCard variant="glass" className="border-rose-300/20 p-8 text-sm text-rose-100/80">
      {error instanceof Error ? error.message : "This workspace could not be loaded."}
    </GlassCard>
  );
}

function MetricCard({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <GlassCard variant="glass" className="flex items-center gap-4 p-5">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100/12 bg-cyan-300/8 text-cyan-100/75">
        <Icon size={19} />
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight text-white">{value}</p>
        <p className="text-xs text-cyan-100/42">{label}</p>
      </div>
    </GlassCard>
  );
}

type Prospect = {
  id: string;
  name: string;
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  employeeCount?: string | null;
  status: string;
  tier: string;
  researchSummary?: string | null;
  opportunitySignals?: string | null;
  lastResearched?: string | null;
};

type Client = {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  overallHiringTrend?: string | null;
  branches?: Array<{ id: string; name?: string | null; city?: string | null; state?: string | null; country: string; hiringTrendDirection?: string | null; postingCount?: string | null }>;
  contacts?: Array<{ id: string; name: string; title?: string | null; email?: string | null; isKeyContact?: boolean | null }>;
};

export function EntitiesPage() {
  const [tab, setTab] = useState<"prospects" | "clients">("prospects");
  const [query, setQuery] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const prospectsQ = useQuery<{ prospects: Prospect[] }>({ queryKey: ["moved-prospects"], queryFn: () => fetchJson("prospects") });
  const clientsQ = useQuery<{ clients: Client[] }>({ queryKey: ["moved-clients"], queryFn: () => fetchJson("clients") });

  const prospects = prospectsQ.data?.prospects ?? [];
  const clients = clientsQ.data?.clients ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProspects = prospects.filter((item) => !normalizedQuery || `${item.name} ${item.industry ?? ""} ${item.headquarters ?? ""}`.toLowerCase().includes(normalizedQuery));
  const filteredClients = clients.filter((item) => !normalizedQuery || `${item.name} ${item.industry ?? ""} ${item.headquarters ?? ""}`.toLowerCase().includes(normalizedQuery));
  const researched = prospects.filter((item) => Boolean(item.lastResearched || item.researchSummary)).length;
  const signals = prospects.filter((item) => parseList(item.opportunitySignals).length > 0 || Boolean(item.opportunitySignals)).length;

  return (
    <WorkspaceShell eyebrow="Company Intelligence" title="Entities" subtitle="Prospect profiles and existing client records transferred from the procurement application into Insight Hub 2.">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 rounded-2xl border border-cyan-100/10 bg-[#071321]/72 p-1.5 backdrop-blur-xl">
          <button onClick={() => setTab("prospects")} className={cn("rounded-xl px-4 py-2 text-sm transition", tab === "prospects" ? "bg-cyan-300/16 text-white" : "text-cyan-100/45 hover:text-white")}>Prospect Profiles</button>
          <button onClick={() => setTab("clients")} className={cn("rounded-xl px-4 py-2 text-sm transition", tab === "clients" ? "bg-cyan-300/16 text-white" : "text-cyan-100/45 hover:text-white")}>Client Records</button>
        </div>
        <label className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-cyan-100/12 bg-[#071321]/82 px-4 py-2.5 text-cyan-100/45">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cyan-100/28" placeholder={`Search ${tab}…`} />
        </label>
      </div>

      {tab === "prospects" ? (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <MetricCard icon={Target} value={prospects.length} label="Tracked prospects" />
            <MetricCard icon={UserRoundSearch} value={researched} label="Researched" />
            <MetricCard icon={TrendingUp} value={signals} label="Opportunity signals" />
          </div>
          {prospectsQ.isLoading ? <LoadingCard label="prospects" /> : prospectsQ.error ? <ErrorCard error={prospectsQ.error} /> : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProspects.map((prospect, index) => (
                <GlassCard key={prospect.id} variant="glass" delay={Math.min(index * .025, .3)} className="cursor-pointer p-5 transition hover:border-cyan-200/28 hover:bg-cyan-300/[0.04]" onClick={() => setSelectedProspect(prospect)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-cyan-200/15 bg-cyan-300/8 px-2 py-1 text-[10px] uppercase tracking-wider text-cyan-100/65">{prospect.tier}</span>
                        <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-1 text-[10px] uppercase tracking-wider text-white/45">{prospect.status}</span>
                      </div>
                      <h2 className="text-lg font-bold text-white">{prospect.name}</h2>
                      <p className="mt-1 text-sm text-cyan-100/45">{prospect.industry || "Industry not reported"}</p>
                    </div>
                    <Target className="mt-1 text-cyan-200/50" size={20} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-cyan-100/42">
                    {prospect.headquarters ? <span className="flex items-center gap-1.5"><MapPin size={13} />{prospect.headquarters}</span> : null}
                    {prospect.employeeCount ? <span className="flex items-center gap-1.5"><Users size={13} />{prospect.employeeCount}</span> : null}
                    <span className="flex items-center gap-1.5"><CalendarDays size={13} />{prospect.lastResearched ? formatDate(prospect.lastResearched) : "Not researched"}</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <MetricCard icon={Building2} value={clients.length} label="Client records" />
            <MetricCard icon={MapPin} value={clients.reduce((sum, item) => sum + (item.branches?.length ?? 0), 0)} label="Known branches" />
            <MetricCard icon={Users} value={clients.reduce((sum, item) => sum + (item.contacts?.length ?? 0), 0)} label="Saved contacts" />
          </div>
          {clientsQ.isLoading ? <LoadingCard label="clients" /> : clientsQ.error ? <ErrorCard error={clientsQ.error} /> : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredClients.map((client, index) => (
                <GlassCard key={client.id} variant="glass" delay={Math.min(index * .025, .3)} className="cursor-pointer p-5 transition hover:border-cyan-200/28" onClick={() => setSelectedClient(client)}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white">{client.name}</h2>
                      <p className="mt-1 text-sm text-cyan-100/45">{client.industry || "Industry not reported"}</p>
                    </div>
                    <Building2 className="text-emerald-200/55" size={20} />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-3"><p className="text-lg font-bold">{client.branches?.length ?? 0}</p><p className="text-[10px] text-cyan-100/38">Branches</p></div>
                    <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-3"><p className="text-lg font-bold">{client.contacts?.length ?? 0}</p><p className="text-[10px] text-cyan-100/38">Contacts</p></div>
                    <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-3"><p className="truncate text-sm font-bold capitalize">{client.overallHiringTrend || "Unknown"}</p><p className="text-[10px] text-cyan-100/38">Hiring</p></div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      {selectedProspect ? (
        <DetailDrawer title={selectedProspect.name} onClose={() => setSelectedProspect(null)}>
          <InfoLine label="Industry" value={selectedProspect.industry} />
          <InfoLine label="Headquarters" value={selectedProspect.headquarters} />
          <InfoLine label="Employees" value={selectedProspect.employeeCount} />
          <InfoLine label="Website" value={selectedProspect.website} link />
          <Section title="Research summary" text={selectedProspect.researchSummary || selectedProspect.description} />
          <TagSection title="Opportunity signals" values={parseList(selectedProspect.opportunitySignals)} />
        </DetailDrawer>
      ) : null}
      {selectedClient ? (
        <DetailDrawer title={selectedClient.name} onClose={() => setSelectedClient(null)}>
          <InfoLine label="Industry" value={selectedClient.industry} />
          <InfoLine label="Headquarters" value={selectedClient.headquarters} />
          <InfoLine label="Website" value={selectedClient.website} link />
          <TagSection title="Branches" values={(selectedClient.branches ?? []).map((branch) => [branch.name, branch.city, branch.state, branch.country].filter(Boolean).join(" · "))} />
          <TagSection title="Contacts" values={(selectedClient.contacts ?? []).map((contact) => [contact.name, contact.title, contact.email].filter(Boolean).join(" · "))} />
        </DetailDrawer>
      ) : null}
    </WorkspaceShell>
  );
}

type Competitor = {
  id: string;
  name: string;
  website?: string | null;
  description?: string | null;
  services?: string | null;
  coverageStates?: string | null;
  tier: string;
  headquarters?: string | null;
  employeeCount?: string | null;
  founded?: string | null;
  notes?: string | null;
  recentActivity?: string | null;
  contractWins?: string | null;
  intelligenceSources?: string | null;
  newsArticles?: string | null;
  fecFilings?: string | null;
  lastResearched?: string | null;
};

export function CompetitorsPage() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const [selected, setSelected] = useState<Competitor | null>(null);
  const competitorsQ = useQuery<{ competitors: Competitor[] }>({ queryKey: ["moved-competitors"], queryFn: () => fetchJson("competitors") });
  const competitors = competitorsQ.data?.competitors ?? [];
  const filtered = competitors.filter((item) => {
    const matchesQuery = !query.trim() || `${item.name} ${item.description ?? ""} ${item.headquarters ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (tier === "all" || item.tier === tier);
  });
  const researched = competitors.filter((item) => Boolean(item.lastResearched)).length;
  const contractSignals = competitors.reduce((sum, item) => sum + parseList(item.contractWins).length, 0);
  const news = competitors.reduce((sum, item) => sum + parseList(item.newsArticles).length, 0);

  return (
    <WorkspaceShell eyebrow="Market Intelligence" title="Competitors" subtitle="Competitor capabilities, coverage, contract activity, and positioning transferred into Insight Hub 2.">
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard icon={Target} value={competitors.length} label="Tracked" />
        <MetricCard icon={UserRoundSearch} value={researched} label="Researched" />
        <MetricCard icon={BadgeDollarSign} value={contractSignals} label="Contract signals" />
        <MetricCard icon={FileText} value={news} label="News articles" />
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl border border-cyan-100/12 bg-[#071321]/82 px-4 py-2.5">
          <Search size={16} className="text-cyan-100/45" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/28" placeholder="Search competitors…" />
        </label>
        <select value={tier} onChange={(event) => setTier(event.target.value)} className="rounded-2xl border border-cyan-100/12 bg-[#071321]/92 px-4 text-sm text-cyan-50 outline-none">
          <option value="all">All tiers</option><option value="national">National</option><option value="regional">Regional</option><option value="local">Local</option>
        </select>
      </div>
      {competitorsQ.isLoading ? <LoadingCard label="competitors" /> : competitorsQ.error ? <ErrorCard error={competitorsQ.error} /> : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((competitor, index) => {
            const services = parseList(competitor.services);
            return (
              <GlassCard key={competitor.id} variant="glass" delay={Math.min(index * .025, .3)} className="cursor-pointer p-5 transition hover:border-cyan-200/28" onClick={() => setSelected(competitor)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full border border-cyan-100/12 bg-white/[0.035] px-2 py-1 text-[10px] uppercase tracking-wider text-cyan-100/55">{competitor.tier}</span>
                    <h2 className="mt-3 text-lg font-bold">{competitor.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-cyan-100/45">{competitor.description || "No description saved."}</p>
                  </div>
                  <Target size={20} className="text-violet-200/55" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {services.slice(0, 4).map((service) => <span key={service} className="rounded-full border border-white/8 bg-white/[0.025] px-2.5 py-1 text-[10px] text-cyan-100/48">{service}</span>)}
                </div>
                <div className="mt-5 flex items-center justify-between text-xs text-cyan-100/38">
                  <span className="flex items-center gap-1.5"><MapPin size={13} />{competitor.headquarters || "Location not reported"}</span>
                  <span>{competitor.lastResearched ? formatDate(competitor.lastResearched) : "Not researched"}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
      {selected ? (
        <DetailDrawer title={selected.name} onClose={() => setSelected(null)}>
          <InfoLine label="Tier" value={selected.tier} />
          <InfoLine label="Headquarters" value={selected.headquarters} />
          <InfoLine label="Employees" value={selected.employeeCount} />
          <InfoLine label="Founded" value={selected.founded} />
          <InfoLine label="Website" value={selected.website} link />
          <Section title="Overview" text={selected.description} />
          <TagSection title="Services" values={parseList(selected.services)} />
          <TagSection title="Coverage" values={parseList(selected.coverageStates)} />
          <TagSection title="Contract wins" values={parseList(selected.contractWins).map((item) => typeof item === "string" ? item : String(item))} />
          <Section title="Recent activity" text={selected.recentActivity || selected.notes} />
        </DetailDrawer>
      ) : null}
    </WorkspaceShell>
  );
}

type FederalItem = {
  id: string;
  bucket: string;
  sourceType: string;
  agency?: string | null;
  component?: string | null;
  office?: string | null;
  regionCountry?: string | null;
  title: string;
  summary?: string | null;
  datePosted?: string | null;
  status?: string | null;
  contractorIncumbent?: string | null;
  relatedRef?: string | null;
  budgetSignal?: string | null;
  oversightSignal?: string | null;
  medicalTravelRelevance?: string | null;
  occuMedScore?: number | null;
  actionTag?: string | null;
  sourceUrl?: string | null;
};

const FEDERAL_BUCKETS = [
  ["forecast", "Forecast"], ["recompete-watch", "Recompete Watch"], ["agency-pain", "Agency Pain"],
  ["policy-radar", "Policy Radar"], ["incumbent-tracker", "Incumbents"], ["leadership-org", "Leadership"],
  ["deployment-medical", "Deploy / Medical"], ["budget-funding", "Budget"], ["protest-litigation", "Protests"],
] as const;

export function FederalAgenciesPage() {
  const [bucket, setBucket] = useState<(typeof FEDERAL_BUCKETS)[number][0]>("forecast");
  const [agency, setAgency] = useState("all");
  const itemsQ = useQuery<{ items: FederalItem[]; total: number }>({ queryKey: ["moved-federal", bucket], queryFn: () => fetchJson(`federal-intel/${bucket}?limit=200`) });
  const items = itemsQ.data?.items ?? [];
  const agencies = useMemo(() => Array.from(new Set(items.map((item) => item.agency).filter(Boolean) as string[])).sort(), [items]);
  const filtered = agency === "all" ? items : items.filter((item) => item.agency === agency);

  return (
    <WorkspaceShell eyebrow="Government Intelligence" title="Federal Agencies" subtitle="Procurement forecasts, recompetes, oversight, policy, incumbents, leadership, deployment, budget, and protest intelligence.">
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {FEDERAL_BUCKETS.map(([id, label]) => (
          <button key={id} onClick={() => { setBucket(id); setAgency("all"); }} className={cn("shrink-0 rounded-2xl border px-4 py-2.5 text-sm transition", bucket === id ? "border-cyan-200/28 bg-cyan-300/14 text-white" : "border-cyan-100/8 bg-white/[0.025] text-cyan-100/42 hover:text-white")}>{label}</button>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-violet-200/18 bg-violet-400/10"><Landmark size={19} className="text-violet-100/75" /></div>
          <div><p className="font-bold">{FEDERAL_BUCKETS.find(([id]) => id === bucket)?.[1]}</p><p className="text-xs text-cyan-100/38">{itemsQ.data?.total ?? 0} transferred records</p></div>
        </div>
        <select value={agency} onChange={(event) => setAgency(event.target.value)} className="rounded-2xl border border-cyan-100/12 bg-[#071321]/92 px-4 py-2.5 text-sm text-cyan-50 outline-none">
          <option value="all">All agencies</option>{agencies.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      {itemsQ.isLoading ? <LoadingCard label="federal intelligence" /> : itemsQ.error ? <ErrorCard error={itemsQ.error} /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((item, index) => (
            <GlassCard key={item.id} variant="glass" delay={Math.min(index * .02, .3)} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
                    <span className="rounded-full border border-violet-200/15 bg-violet-300/8 px-2 py-1 text-violet-100/65">{item.sourceType}</span>
                    {item.actionTag ? <span className="rounded-full border border-cyan-200/12 bg-cyan-300/7 px-2 py-1 text-cyan-100/55">{item.actionTag}</span> : null}
                    {typeof item.occuMedScore === "number" ? <span className="rounded-full border border-emerald-200/12 bg-emerald-300/7 px-2 py-1 text-emerald-100/55">Score {item.occuMedScore}</span> : null}
                  </div>
                  <h2 className="font-bold leading-6 text-white">{item.title}</h2>
                </div>
                {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 text-cyan-100/40 hover:text-white"><ExternalLink size={17} /></a> : null}
              </div>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-cyan-100/48">{item.summary || "No summary saved."}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-cyan-100/36">
                {item.agency ? <span>{item.agency}{item.component ? ` · ${item.component}` : ""}</span> : null}
                {item.contractorIncumbent ? <span>Incumbent: {item.contractorIncumbent}</span> : null}
                <span>{formatDate(item.datePosted)}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}

type StateProfile = {
  stateCode: string;
  stateName: string;
  region: string;
  oshaStatePlan: string;
  procurementUrl?: string | null;
  legislatureUrl?: string | null;
  govUrl?: string | null;
  healthDeptUrl?: string | null;
  laborUrl?: string | null;
  emergencyMgmtUrl?: string | null;
  medicalBoardUrl?: string | null;
  insuranceDeptUrl?: string | null;
  correctionsUrl?: string | null;
  dotUrl?: string | null;
  postCommissionUrl?: string | null;
  itemCount: number;
};

type StateItem = { id: string; stateCode: string; bucket: string; title: string; summary?: string | null; url?: string | null; publishedDate?: string | null; agency?: string | null; itemType?: string | null; relevanceScore?: number | null };
type StateIntelItem = { id: string; channel: string; title: string; summary?: string | null; url?: string | null; publishedDate?: string | null; source?: string | null; severity?: string | null; affectedStates?: string | null };

const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY"
};

const STATE_BUCKETS = [["procurement","Procurement"],["legislature","Legislature"],["governor_agencies","Gov / Agencies"],["health_dept","Health Dept"],["labor_warn","Labor / WARN"],["medical_licensing","Med Licensing"],["emergency_mgmt","Emergency Mgmt"],["osha_plan","OSHA Plan"],["insurance_dept","Insurance"],["corrections","Corrections"],["fmcsa","FMCSA / CDL"],["post_guidelines","POST"],["dot","State DOT"]] as const;
const INTEL_CHANNELS = [["public_health","Public Health"],["travel_advisory","Travel Advisories"],["fda_recalls","FDA Recalls"],["disaster","FEMA Disasters"]] as const;

export function StateAgenciesPage() {
  const [view, setView] = useState<"state" | "intel">("intel");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [bucket, setBucket] = useState("procurement");
  const [channel, setChannel] = useState("public_health");
  const statesQ = useQuery<{ states: StateProfile[] }>({ queryKey: ["moved-state-profiles"], queryFn: () => fetchJson("state-agencies/states") });
  const stateItemsQ = useQuery<{ items: StateItem[]; bucketCounts: Record<string, number> }>({ queryKey: ["moved-state-items", selectedState, bucket], queryFn: () => fetchJson(`state-agencies/items?stateCode=${selectedState}&bucket=${bucket}`), enabled: Boolean(selectedState) });
  const intelQ = useQuery<{ items: StateIntelItem[]; channelCounts: Record<string, number> }>({ queryKey: ["moved-state-intel", channel], queryFn: () => fetchJson(`state-agencies/intel?channel=${channel}`) });
  const states = statesQ.data?.states ?? [];
  const statesByCode = useMemo(() => new Map(states.map((state) => [state.stateCode, state])), [states]);
  const profile = selectedState ? statesByCode.get(selectedState) : undefined;

  return (
    <WorkspaceShell eyebrow="Government Intelligence" title="State Agencies" subtitle="State-level regulatory, health, labor, emergency, licensing, and cross-state intelligence transferred into Insight Hub 2.">
      <div className="mb-6 flex gap-2 rounded-2xl border border-cyan-100/10 bg-[#071321]/72 p-1.5 backdrop-blur-xl sm:w-fit">
        <button onClick={() => setView("state")} className={cn("rounded-xl px-4 py-2 text-sm", view === "state" ? "bg-cyan-300/16 text-white" : "text-cyan-100/45")}>State Agencies</button>
        <button onClick={() => setView("intel")} className={cn("rounded-xl px-4 py-2 text-sm", view === "intel" ? "bg-violet-300/16 text-white" : "text-cyan-100/45")}>Cross-State Intelligence</button>
      </div>
      {statesQ.isLoading ? <LoadingCard label="state profiles" /> : statesQ.error ? <ErrorCard error={statesQ.error} /> : view === "state" ? (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <GlassCard variant="glass" className="min-h-[610px] p-5">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">State Map</h2><p className="text-xs text-cyan-100/38">Select a state to open its agency intelligence.</p></div><Map size={20} className="text-cyan-100/50" /></div>
            <ComposableMap projection="geoAlbersUsa" className="mx-auto w-full max-w-[760px]">
              <Geographies geography={GEO_URL}>
                {({ geographies }) => geographies.map((geo) => {
                  const code = STATE_NAME_TO_CODE[geo.properties.name];
                  const state = statesByCode.get(code);
                  const active = code === selectedState;
                  return <Geography key={geo.rsmKey} geography={geo} onClick={() => code && setSelectedState(code)} style={{ default:{ fill:active?"#2563eb":state?.itemCount?"#0f766e":"#13233c", stroke:"#38bdf8", strokeWidth:.35, outline:"none" }, hover:{ fill:"#0ea5e9", stroke:"#a5f3fc", strokeWidth:.6, outline:"none", cursor:"pointer" }, pressed:{ fill:"#2563eb", outline:"none" } }} />;
                })}
              </Geographies>
            </ComposableMap>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-cyan-100/40 sm:grid-cols-3">
              <span>{states.length} profiles</span><span>{states.filter((item) => item.itemCount > 0).length} with saved items</span><span>{states.reduce((sum,item)=>sum+item.itemCount,0)} total items</span>
            </div>
          </GlassCard>
          <GlassCard variant="glass" className="min-h-[610px] p-5">
            {!selectedState || !profile ? <div className="grid h-full min-h-[500px] place-items-center text-center"><div><MapPin className="mx-auto mb-3 text-cyan-100/30" /><p className="font-bold">Select a state</p><p className="mt-2 text-sm text-cyan-100/38">Agency buckets and stored intelligence will appear here.</p></div></div> : (
              <div>
                <div className="mb-5 flex items-start justify-between"><div><p className="text-xs uppercase tracking-[.22em] text-cyan-100/38">{profile.stateCode} · {profile.region}</p><h2 className="mt-1 text-2xl font-black">{profile.stateName}</h2><p className="mt-1 text-xs text-cyan-100/42">{profile.oshaStatePlan.replaceAll("_", " ")} OSHA coverage · {profile.itemCount} saved items</p></div><button onClick={() => setSelectedState(null)} className="text-cyan-100/40 hover:text-white"><X size={18}/></button></div>
                <div className="mb-5 flex gap-2 overflow-x-auto pb-2">{STATE_BUCKETS.map(([id,label])=><button key={id} onClick={()=>setBucket(id)} className={cn("shrink-0 rounded-xl border px-3 py-2 text-xs",bucket===id?"border-cyan-200/24 bg-cyan-300/12 text-white":"border-white/7 bg-white/[0.025] text-cyan-100/38")}>{label}{stateItemsQ.data?.bucketCounts?.[id] ? ` · ${stateItemsQ.data.bucketCounts[id]}` : ""}</button>)}</div>
                {stateItemsQ.isLoading ? <p className="text-sm text-cyan-100/40">Loading items…</p> : stateItemsQ.error ? <ErrorCard error={stateItemsQ.error}/> : <div className="space-y-3">{(stateItemsQ.data?.items ?? []).map((item)=><article key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold leading-5">{item.title}</h3>{item.url?<a href={item.url} target="_blank" rel="noreferrer" className="text-cyan-100/40 hover:text-white"><ExternalLink size={15}/></a>:null}</div><p className="mt-2 line-clamp-3 text-xs leading-5 text-cyan-100/42">{item.summary||"No summary saved."}</p><p className="mt-3 text-[10px] text-cyan-100/30">{item.agency||item.itemType||"State source"} · {formatDate(item.publishedDate)}</p></article>)}{!(stateItemsQ.data?.items ?? []).length?<p className="py-10 text-center text-sm text-cyan-100/35">No saved items in this bucket.</p>:null}</div>}
              </div>
            )}
          </GlassCard>
        </div>
      ) : (
        <div>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-2">{INTEL_CHANNELS.map(([id,label])=><button key={id} onClick={()=>setChannel(id)} className={cn("shrink-0 rounded-2xl border px-4 py-2.5 text-sm",channel===id?"border-violet-200/26 bg-violet-300/14 text-white":"border-white/7 bg-white/[0.025] text-cyan-100/40")}>{label}{intelQ.data?.channelCounts?.[id] ? ` · ${intelQ.data.channelCounts[id]}` : ""}</button>)}</div>
          {intelQ.isLoading ? <LoadingCard label="cross-state intelligence" /> : intelQ.error ? <ErrorCard error={intelQ.error} /> : <div className="grid gap-4 xl:grid-cols-2">{(intelQ.data?.items ?? []).map((item,index)=><GlassCard key={item.id} variant="glass" delay={Math.min(index*.02,.3)} className="p-5"><div className="flex items-start justify-between gap-3"><div><span className={cn("rounded-full border px-2 py-1 text-[10px] uppercase tracking-wider",item.severity==="high"?"border-rose-300/20 bg-rose-300/10 text-rose-100/70":item.severity==="medium"?"border-amber-300/20 bg-amber-300/10 text-amber-100/70":"border-cyan-100/12 bg-white/[0.025] text-cyan-100/50")}>{item.severity||"low"}</span><h2 className="mt-3 font-bold leading-6">{item.title}</h2></div>{item.url?<a href={item.url} target="_blank" rel="noreferrer" className="text-cyan-100/40 hover:text-white"><ExternalLink size={16}/></a>:null}</div><p className="mt-3 line-clamp-4 text-sm leading-6 text-cyan-100/45">{item.summary||"No summary saved."}</p><p className="mt-4 text-xs text-cyan-100/32">{item.source||"Public source"} · {formatDate(item.publishedDate)}</p></GlassCard>)}</div>}
        </div>
      )}
    </WorkspaceShell>
  );
}

function DetailDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-black/50 backdrop-blur-sm" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-[520px] overflow-y-auto border-l border-cyan-100/14 bg-[#04101d]/97 p-6 shadow-[-30px_0_90px_rgba(0,0,0,.58)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-7 flex items-start justify-between gap-5"><div><p className="text-xs uppercase tracking-[.24em] text-cyan-100/38">Intelligence Record</p><h2 className="mt-2 text-2xl font-black">{title}</h2></div><button onClick={onClose} className="rounded-xl border border-white/8 bg-white/[0.035] p-2 text-cyan-100/45 hover:text-white"><X size={18}/></button></div>
        <div className="space-y-4">{children}</div>
      </aside>
    </div>
  );
}

function InfoLine({ label, value, link = false }: { label: string; value?: string | null; link?: boolean }) {
  if (!value) return null;
  return <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-[10px] uppercase tracking-[.2em] text-cyan-100/34">{label}</p>{link?<a href={value} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 break-all text-sm text-cyan-200/75 hover:text-white">{value}<ExternalLink size={13}/></a>:<p className="mt-2 text-sm text-white/80">{value}</p>}</div>;
}

function Section({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><h3 className="text-sm font-bold">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-cyan-100/48">{text}</p></section>;
}

function TagSection({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><h3 className="text-sm font-bold">{title}</h3><div className="mt-3 flex flex-wrap gap-2">{values.map((value,index)=><span key={`${value}-${index}`} className="rounded-full border border-cyan-100/10 bg-cyan-300/6 px-3 py-1.5 text-xs text-cyan-100/55">{value}</span>)}</div></section>;
}
