import { useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  MapPin,
  Search,
  Target,
  TrendingUp,
  Truck,
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
const STATE_GEOMETRY_URL = api("core-intelligence/state-map-geometry");

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(api(path), { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : `Request failed with HTTP ${response.status}`);
  }
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

function WorkspaceShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050b14] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_76%_10%,rgba(186,230,253,.12),transparent_28%),radial-gradient(circle_at_68%_74%,rgba(191,219,254,.12),transparent_34%),radial-gradient(circle_at_96%_54%,rgba(221,214,254,.09),transparent_30%)]" />
      <Sidebar />
      <main className="relative min-h-screen px-5 py-8 sm:px-8 lg:ml-[210px] lg:px-10 xl:px-14">
        <HeaderBar eyebrow={eyebrow} title={title} subtitle={subtitle} />
        {children}
      </main>
    </div>
  );
}

function TahoePanel({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <GlassCard
      variant="glass"
      onClick={onClick}
      className={cn(
        "relative overflow-hidden border-white/30 bg-white/[0.085] shadow-[0_24px_70px_rgba(0,0,0,.28),0_0_34px_rgba(186,230,253,.10),inset_0_1px_0_rgba(255,255,255,.28)] backdrop-blur-3xl",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(122deg,rgba(255,255,255,.20),rgba(255,255,255,.05)_18%,transparent_38%),radial-gradient(circle_at_12%_0%,rgba(224,242,254,.15),transparent_34%)]" />
      <div className="relative z-[1]">{children}</div>
    </GlassCard>
  );
}

function MetricCard({ icon: Icon, value, label }: { icon: ElementType; value: number; label: string }) {
  return (
    <TahoePanel className="flex items-center gap-4 p-5">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/28 bg-white/[0.09] text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]">
        <Icon size={19} />
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight text-white">{value}</p>
        <p className="text-xs text-sky-100/58">{label}</p>
      </div>
    </TahoePanel>
  );
}

function LoadingCard({ label }: { label: string }) {
  return <TahoePanel className="p-8 text-sm text-sky-100/64">Loading {label}…</TahoePanel>;
}

function ErrorCard({ error }: { error: unknown }) {
  return <TahoePanel className="border-rose-200/24 p-8 text-sm text-rose-100/90">{error instanceof Error ? error.message : "This workspace could not be loaded."}</TahoePanel>;
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-slate-950/44 backdrop-blur-md" onMouseDown={onClose}>
      <aside
        className="h-full w-full max-w-[520px] overflow-y-auto border-l border-white/28 bg-white/[0.105] p-6 shadow-[-30px_0_90px_rgba(0,0,0,.46),inset_1px_0_0_rgba(255,255,255,.18)] backdrop-blur-[38px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-7 flex items-start justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[.24em] text-sky-100/55">Intelligence Record</p>
            <h2 className="mt-2 text-2xl font-black">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl border border-white/24 bg-white/[0.08] p-2 text-sky-100/62 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
      </aside>
    </div>
  );
}

function Info({ label, value, link = false }: { label: string; value?: string | null; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-white/24 bg-white/[0.065] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.18)]">
      <p className="text-[10px] uppercase tracking-[.2em] text-sky-100/48">{label}</p>
      {link ? (
        <a href={value} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 break-all text-sm text-sky-100/88 hover:text-white">
          {value}<ExternalLink size={13} />
        </a>
      ) : (
        <p className="mt-2 text-sm text-white/88">{value}</p>
      )}
    </div>
  );
}

function Tags({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <section className="rounded-2xl border border-white/24 bg-white/[0.065] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.18)]">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value, index) => (
          <span key={`${value}-${index}`} className="rounded-full border border-white/22 bg-white/[0.075] px-3 py-1.5 text-xs text-sky-100/72">
            {value}
          </span>
        ))}
      </div>
    </section>
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
  branches?: Array<{ id: string; name?: string | null; city?: string | null; state?: string | null; country: string }>;
  contacts?: Array<{ id: string; name: string; title?: string | null; email?: string | null }>;
};

export function EntitiesPage() {
  const [tab, setTab] = useState<"prospects" | "clients">("prospects");
  const [query, setQuery] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const prospectsQ = useQuery({ queryKey: ["core-prospects"], queryFn: () => fetchJson<{ prospects: Prospect[] }>("prospects") });
  const clientsQ = useQuery({ queryKey: ["core-clients"], queryFn: () => fetchJson<{ clients: Client[] }>("clients") });
  const prospects = prospectsQ.data?.prospects ?? [];
  const clients = clientsQ.data?.clients ?? [];
  const needle = query.trim().toLowerCase();
  const filteredProspects = prospects.filter((item) => !needle || `${item.name} ${item.industry ?? ""} ${item.headquarters ?? ""}`.toLowerCase().includes(needle));
  const filteredClients = clients.filter((item) => !needle || `${item.name} ${item.industry ?? ""} ${item.headquarters ?? ""}`.toLowerCase().includes(needle));

  return (
    <WorkspaceShell eyebrow="Company Intelligence" title="Entities" subtitle="Prospect profiles and client records now live in Insight Hub 2.">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 rounded-2xl border border-white/26 bg-white/[0.07] p-1.5 backdrop-blur-2xl">
          <button onClick={() => setTab("prospects")} className={cn("rounded-xl px-4 py-2 text-sm", tab === "prospects" ? "bg-white/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22)]" : "text-sky-100/55")}>Prospect Profiles</button>
          <button onClick={() => setTab("clients")} className={cn("rounded-xl px-4 py-2 text-sm", tab === "clients" ? "bg-white/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22)]" : "text-sky-100/55")}>Client Records</button>
        </div>
        <label className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-white/26 bg-white/[0.07] px-4 py-2.5 backdrop-blur-2xl">
          <Search size={16} className="text-sky-100/58" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-sky-100/38" placeholder={`Search ${tab}…`} />
        </label>
      </div>

      {tab === "prospects" ? (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <MetricCard icon={Target} value={prospects.length} label="Tracked prospects" />
            <MetricCard icon={UserRoundSearch} value={prospects.filter((item) => item.lastResearched || item.researchSummary).length} label="Researched" />
            <MetricCard icon={TrendingUp} value={prospects.filter((item) => item.opportunitySignals).length} label="Opportunity signals" />
          </div>
          {prospectsQ.isLoading ? <LoadingCard label="prospects" /> : prospectsQ.error ? <ErrorCard error={prospectsQ.error} /> : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProspects.map((item) => (
                <TahoePanel key={item.id} className="cursor-pointer p-5 transition hover:border-white/48 hover:bg-white/[0.115]" onClick={() => setSelectedProspect(item)}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex gap-2 text-[10px] uppercase tracking-wider text-sky-100/66"><span>{item.tier}</span><span>·</span><span>{item.status}</span></div>
                      <h2 className="text-lg font-bold">{item.name}</h2>
                      <p className="mt-1 text-sm text-sky-100/58">{item.industry || "Industry not reported"}</p>
                    </div>
                    <Target size={20} className="text-sky-100/70" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-sky-100/52">
                    {item.headquarters ? <span className="flex items-center gap-1"><MapPin size={13} />{item.headquarters}</span> : null}
                    <span className="flex items-center gap-1"><CalendarDays size={13} />{item.lastResearched ? formatDate(item.lastResearched) : "Not researched"}</span>
                  </div>
                </TahoePanel>
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
              {filteredClients.map((item) => (
                <TahoePanel key={item.id} className="cursor-pointer p-5 transition hover:border-white/48 hover:bg-white/[0.115]" onClick={() => setSelectedClient(item)}>
                  <div className="flex items-start justify-between gap-4">
                    <div><h2 className="text-lg font-bold">{item.name}</h2><p className="mt-1 text-sm text-sky-100/58">{item.industry || "Industry not reported"}</p></div>
                    <Building2 size={20} className="text-sky-100/70" />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="rounded-xl border border-white/22 bg-white/[0.055] p-3"><b className="text-lg">{item.branches?.length ?? 0}</b><p className="text-sky-100/48">Branches</p></div>
                    <div className="rounded-xl border border-white/22 bg-white/[0.055] p-3"><b className="text-lg">{item.contacts?.length ?? 0}</b><p className="text-sky-100/48">Contacts</p></div>
                    <div className="rounded-xl border border-white/22 bg-white/[0.055] p-3"><b className="capitalize">{item.overallHiringTrend || "Unknown"}</b><p className="text-sky-100/48">Hiring</p></div>
                  </div>
                </TahoePanel>
              ))}
            </div>
          )}
        </>
      )}

      {selectedProspect ? (
        <Drawer title={selectedProspect.name} onClose={() => setSelectedProspect(null)}>
          <Info label="Industry" value={selectedProspect.industry} />
          <Info label="Headquarters" value={selectedProspect.headquarters} />
          <Info label="Employees" value={selectedProspect.employeeCount} />
          <Info label="Website" value={selectedProspect.website} link />
          <Info label="Research summary" value={selectedProspect.researchSummary || selectedProspect.description} />
          <Tags title="Opportunity signals" values={parseList(selectedProspect.opportunitySignals)} />
        </Drawer>
      ) : null}
      {selectedClient ? (
        <Drawer title={selectedClient.name} onClose={() => setSelectedClient(null)}>
          <Info label="Industry" value={selectedClient.industry} />
          <Info label="Headquarters" value={selectedClient.headquarters} />
          <Info label="Website" value={selectedClient.website} link />
          <Tags title="Branches" values={(selectedClient.branches ?? []).map((branch) => [branch.name, branch.city, branch.state, branch.country].filter(Boolean).join(" · "))} />
          <Tags title="Contacts" values={(selectedClient.contacts ?? []).map((contact) => [contact.name, contact.title, contact.email].filter(Boolean).join(" · "))} />
        </Drawer>
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
  newsArticles?: string | null;
  lastResearched?: string | null;
};

export function CompetitorsPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Competitor | null>(null);
  const dataQ = useQuery({ queryKey: ["core-competitors"], queryFn: () => fetchJson<{ competitors: Competitor[] }>("competitors") });
  const items = dataQ.data?.competitors ?? [];
  const filtered = items.filter((item) => !query.trim() || `${item.name} ${item.description ?? ""} ${item.headquarters ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <WorkspaceShell eyebrow="Market Intelligence" title="Competitors" subtitle="Competitor capabilities, coverage, contract activity, and positioning.">
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard icon={Target} value={items.length} label="Tracked" />
        <MetricCard icon={UserRoundSearch} value={items.filter((item) => item.lastResearched).length} label="Researched" />
        <MetricCard icon={FileText} value={items.reduce((sum, item) => sum + parseList(item.contractWins).length, 0)} label="Contract signals" />
        <MetricCard icon={FileText} value={items.reduce((sum, item) => sum + parseList(item.newsArticles).length, 0)} label="News articles" />
      </div>
      <label className="mb-6 flex items-center gap-2 rounded-2xl border border-white/26 bg-white/[0.07] px-4 py-2.5 backdrop-blur-2xl">
        <Search size={16} className="text-sky-100/58" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-sky-100/38" placeholder="Search competitors…" />
      </label>
      {dataQ.isLoading ? <LoadingCard label="competitors" /> : dataQ.error ? <ErrorCard error={dataQ.error} /> : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((item) => (
            <TahoePanel key={item.id} className="cursor-pointer p-5 transition hover:border-white/48 hover:bg-white/[0.115]" onClick={() => setSelected(item)}>
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-[10px] uppercase tracking-wider text-sky-100/58">{item.tier}</p><h2 className="mt-2 text-lg font-bold">{item.name}</h2></div>
                <Target size={20} className="text-sky-100/70" />
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-sky-100/58">{item.description || "No description saved."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {parseList(item.services).slice(0, 4).map((service) => <span key={service} className="rounded-full border border-white/22 bg-white/[0.055] px-2.5 py-1 text-[10px] text-sky-100/64">{service}</span>)}
              </div>
            </TahoePanel>
          ))}
        </div>
      )}
      {selected ? (
        <Drawer title={selected.name} onClose={() => setSelected(null)}>
          <Info label="Tier" value={selected.tier} />
          <Info label="Headquarters" value={selected.headquarters} />
          <Info label="Employees" value={selected.employeeCount} />
          <Info label="Founded" value={selected.founded} />
          <Info label="Website" value={selected.website} link />
          <Info label="Overview" value={selected.description} />
          <Tags title="Services" values={parseList(selected.services)} />
          <Tags title="Coverage" values={parseList(selected.coverageStates)} />
          <Tags title="Contract wins" values={parseList(selected.contractWins)} />
          <Info label="Recent activity" value={selected.recentActivity || selected.notes} />
        </Drawer>
      ) : null}
    </WorkspaceShell>
  );
}

type FederalItem = {
  id: string;
  sourceType: string;
  agency?: string | null;
  component?: string | null;
  title: string;
  summary?: string | null;
  datePosted?: string | null;
  contractorIncumbent?: string | null;
  occuMedScore?: number | null;
  actionTag?: string | null;
  sourceUrl?: string | null;
};

const FEDERAL_BUCKETS = [
  ["forecast", "Forecast"],
  ["recompete-watch", "Recompete Watch"],
  ["agency-pain", "Agency Pain"],
  ["policy-radar", "Policy Radar"],
  ["incumbent-tracker", "Incumbents"],
  ["leadership-org", "Leadership"],
  ["deployment-medical", "Deploy / Medical"],
  ["budget-funding", "Budget"],
  ["protest-litigation", "Protests"],
] as const;

export function FederalAgenciesPage() {
  const [bucket, setBucket] = useState<(typeof FEDERAL_BUCKETS)[number][0]>("forecast");
  const [agency, setAgency] = useState("all");
  const dataQ = useQuery({ queryKey: ["core-federal", bucket], queryFn: () => fetchJson<{ items: FederalItem[]; total: number }>(`federal-intel/${bucket}?limit=200`) });
  const items = dataQ.data?.items ?? [];
  const agencies = useMemo(() => Array.from(new Set(items.map((item) => item.agency).filter((value): value is string => Boolean(value)))).sort(), [items]);
  const filtered = agency === "all" ? items : items.filter((item) => item.agency === agency);

  return (
    <WorkspaceShell eyebrow="Government Intelligence" title="Federal Agencies" subtitle="Federal procurement, oversight, policy, incumbent, leadership, deployment, budget, and protest intelligence.">
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {FEDERAL_BUCKETS.map(([id, label]) => (
          <button key={id} onClick={() => { setBucket(id); setAgency("all"); }} className={cn("shrink-0 rounded-2xl border px-4 py-2.5 text-sm backdrop-blur-xl", bucket === id ? "border-white/42 bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.24)]" : "border-white/20 bg-white/[0.045] text-sky-100/58")}>{label}</button>
        ))}
      </div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><Landmark className="text-sky-100/78" /><div><p className="font-bold">{FEDERAL_BUCKETS.find(([id]) => id === bucket)?.[1]}</p><p className="text-xs text-sky-100/50">{dataQ.data?.total ?? 0} records</p></div></div>
        <select value={agency} onChange={(event) => setAgency(event.target.value)} className="rounded-2xl border border-white/26 bg-white/[0.07] px-4 py-2.5 text-sm backdrop-blur-2xl"><option value="all">All agencies</option>{agencies.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      {dataQ.isLoading ? <LoadingCard label="federal intelligence" /> : dataQ.error ? <ErrorCard error={dataQ.error} /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((item) => (
            <TahoePanel key={item.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div><div className="mb-2 flex gap-2 text-[10px] uppercase tracking-wider text-sky-100/64"><span>{item.sourceType}</span>{item.actionTag ? <span>· {item.actionTag}</span> : null}{typeof item.occuMedScore === "number" ? <span>· Score {item.occuMedScore}</span> : null}</div><h2 className="font-bold leading-6">{item.title}</h2></div>
                {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} className="text-sky-100/62" /></a> : null}
              </div>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-sky-100/58">{item.summary || "No summary saved."}</p>
              <p className="mt-4 text-xs text-sky-100/48">{item.agency || "Federal source"}{item.component ? ` · ${item.component}` : ""}{item.contractorIncumbent ? ` · Incumbent: ${item.contractorIncumbent}` : ""} · {formatDate(item.datePosted)}</p>
            </TahoePanel>
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}

type StateProfile = { stateCode: string; stateName: string; region: string; oshaStatePlan: string; itemCount: number };
type StateItem = { id: string; title: string; summary?: string | null; url?: string | null; publishedDate?: string | null; agency?: string | null; itemType?: string | null };
type StateIntelItem = { id: string; title: string; summary?: string | null; url?: string | null; publishedDate?: string | null; source?: string | null; severity?: string | null };
type FmcsaCarrier = {
  dotNumber: string | null;
  mcNumber: string | null;
  legalName: string | null;
  dbaName: string | null;
  allowedToOperate: string | null;
  outOfService: string | null;
  outOfServiceDate: string | null;
  complaintCount: number | null;
  physicalAddress: { street: string | null; city: string | null; state: string | null; zip: string | null; country: string | null };
  telephone: string | null;
  vehicles: { passenger: number | null; bus: number | null; limo: number | null; minibus: number | null; motorcoach: number | null; van: number | null };
};
type FmcsaStatus = { configured: boolean; environmentVariable: string; limitation: string };
type FmcsaSearchResponse = { records: FmcsaCarrier[]; returned: number; cacheState: string; limitation: string };

const STATE_BUCKETS = [
  ["procurement", "Procurement"],
  ["legislature", "Legislature"],
  ["governor_agencies", "Gov / Agencies"],
  ["health_dept", "Health Dept"],
  ["labor_warn", "Labor / WARN"],
  ["medical_licensing", "Med Licensing"],
  ["emergency_mgmt", "Emergency Mgmt"],
  ["osha_plan", "OSHA Plan"],
  ["insurance_dept", "Insurance"],
  ["corrections", "Corrections"],
  ["fmcsa", "FMCSA / CDL"],
  ["post_guidelines", "POST"],
  ["dot", "State DOT"],
] as const;

const INTEL_CHANNELS = [
  ["public_health", "Public Health"],
  ["travel_advisory", "Travel Advisories"],
  ["fda_recalls", "FDA Recalls"],
  ["disaster", "FEMA Disasters"],
] as const;

const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
};

function stateCodeFromGeography(id: string | number | undefined): string | null {
  if (id === undefined || id === null) return null;
  return FIPS_TO_STATE[String(id).padStart(2, "0")] ?? null;
}

function formatCarrierAddress(carrier: FmcsaCarrier): string {
  return [carrier.physicalAddress.street, carrier.physicalAddress.city, carrier.physicalAddress.state, carrier.physicalAddress.zip, carrier.physicalAddress.country].filter(Boolean).join(", ") || "Address not reported";
}

export function StateAgenciesPage() {
  const [view, setView] = useState<"state" | "intel">("state");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [bucket, setBucket] = useState("procurement");
  const [channel, setChannel] = useState("public_health");
  const [fmcsaQuery, setFmcsaQuery] = useState("");
  const [fmcsaResults, setFmcsaResults] = useState<FmcsaCarrier[]>([]);
  const [fmcsaError, setFmcsaError] = useState("");
  const [fmcsaLoading, setFmcsaLoading] = useState(false);
  const statesQ = useQuery({ queryKey: ["core-states"], queryFn: () => fetchJson<{ states: StateProfile[] }>("state-agencies/states") });
  const stateItemsQ = useQuery({ queryKey: ["core-state-items", selectedState, bucket], queryFn: () => fetchJson<{ items: StateItem[]; bucketCounts: Record<string, number> }>(`state-agencies/items?stateCode=${selectedState}&bucket=${bucket}`), enabled: Boolean(selectedState) });
  const intelQ = useQuery({ queryKey: ["core-state-intel", channel], queryFn: () => fetchJson<{ items: StateIntelItem[]; channelCounts: Record<string, number> }>(`state-agencies/intel?channel=${channel}`) });
  const fmcsaStatusQ = useQuery({ queryKey: ["fmcsa-status"], queryFn: () => fetchJson<FmcsaStatus>("core-intelligence/fmcsa/status") });
  const states = statesQ.data?.states ?? [];
  const stateByCode = useMemo(() => new Map(states.map((state) => [state.stateCode, state])), [states]);
  const selectedProfile = selectedState ? stateByCode.get(selectedState) : undefined;
  const hoveredProfile = hoveredState ? stateByCode.get(hoveredState) : undefined;

  async function searchFmcsa() {
    const query = fmcsaQuery.trim();
    if (!query || !selectedState) return;
    setFmcsaLoading(true);
    setFmcsaError("");
    setFmcsaResults([]);
    try {
      const params = new URLSearchParams({ stateCode: selectedState });
      if (/^\d+$/.test(query)) params.set("dotNumber", query);
      else params.set("name", query);
      const result = await fetchJson<FmcsaSearchResponse>(`core-intelligence/fmcsa/carriers?${params.toString()}`);
      setFmcsaResults(result.records);
    } catch (error) {
      setFmcsaError(error instanceof Error ? error.message : "FMCSA search failed.");
    } finally {
      setFmcsaLoading(false);
    }
  }

  return (
    <WorkspaceShell eyebrow="Government Intelligence" title="State Agencies" subtitle="Click a state on the map to open its regulatory, health, labor, licensing, emergency, and procurement intelligence.">
      <div className="mb-6 flex gap-2 rounded-2xl border border-white/26 bg-white/[0.07] p-1.5 backdrop-blur-2xl sm:w-fit">
        <button onClick={() => setView("state")} className={cn("rounded-xl px-4 py-2 text-sm", view === "state" ? "bg-white/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22)]" : "text-sky-100/55")}>State Agencies Map</button>
        <button onClick={() => setView("intel")} className={cn("rounded-xl px-4 py-2 text-sm", view === "intel" ? "bg-white/[0.15] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22)]" : "text-sky-100/55")}>Cross-State Intelligence</button>
      </div>

      {statesQ.isLoading ? <LoadingCard label="state profiles" /> : statesQ.error ? <ErrorCard error={statesQ.error} /> : view === "state" ? (
        <div className="space-y-5">
          <TahoePanel className="p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-[10px] uppercase tracking-[.22em] text-sky-100/48">Interactive state map</p><h2 className="mt-2 text-xl font-black">United States agency intelligence</h2></div>
              <div className="text-right"><p className="text-sm font-bold text-white">{hoveredProfile?.stateName || selectedProfile?.stateName || "Select a state"}</p><p className="text-xs text-sky-100/50">{hoveredProfile ? `${hoveredProfile.itemCount} intelligence items` : selectedProfile ? `${selectedProfile.itemCount} intelligence items` : `${states.length} state profiles loaded`}</p></div>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/24 bg-[radial-gradient(circle_at_50%_45%,rgba(224,242,254,.11),transparent_55%),linear-gradient(145deg,rgba(255,255,255,.065),rgba(99,131,155,.045))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.20)]">
              <ComposableMap projection="geoAlbersUsa" projectionConfig={{ scale: 1030 }} width={900} height={560} className="h-auto w-full" aria-label="Clickable map of United States state agencies">
                <Geographies geography={STATE_GEOMETRY_URL}>
                  {({ geographies }) => geographies.map((geo) => {
                    const code = stateCodeFromGeography(geo.id);
                    const profile = code ? stateByCode.get(code) : undefined;
                    const selected = Boolean(code && code === selectedState);
                    const hasItems = Boolean(profile?.itemCount);
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        role="button"
                        tabIndex={code ? 0 : -1}
                        aria-label={profile ? `${profile.stateName}, ${profile.itemCount} intelligence items` : code || "State"}
                        onClick={() => code && profile && setSelectedState(code)}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && code && profile) {
                            event.preventDefault();
                            setSelectedState(code);
                          }
                        }}
                        onMouseEnter={() => code && setHoveredState(code)}
                        onMouseLeave={() => setHoveredState(null)}
                        style={{
                          default: {
                            fill: selected ? "rgba(224,242,254,.86)" : hasItems ? "rgba(178,211,230,.42)" : "rgba(148,177,197,.24)",
                            stroke: selected ? "rgba(255,255,255,.96)" : "rgba(255,255,255,.48)",
                            strokeWidth: selected ? 1.6 : 0.8,
                            outline: "none",
                            cursor: code && profile ? "pointer" : "default",
                            filter: selected ? "drop-shadow(0 0 11px rgba(186,230,253,.75))" : "drop-shadow(0 2px 4px rgba(0,0,0,.24))",
                            transition: "fill .18s ease, stroke .18s ease, filter .18s ease",
                          },
                          hover: {
                            fill: "rgba(224,242,254,.72)",
                            stroke: "rgba(255,255,255,.90)",
                            strokeWidth: 1.3,
                            outline: "none",
                            cursor: code && profile ? "pointer" : "default",
                            filter: "drop-shadow(0 0 10px rgba(186,230,253,.58))",
                          },
                          pressed: {
                            fill: "rgba(255,255,255,.90)",
                            stroke: "rgba(255,255,255,1)",
                            strokeWidth: 1.6,
                            outline: "none",
                          },
                        }}
                      />
                    );
                  })}
                </Geographies>
              </ComposableMap>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-sky-100/52">
              <span>States with saved intelligence are brighter. Click any available state to open its sources.</span>
              <span>{states.reduce((sum, state) => sum + state.itemCount, 0)} total state-agency items</span>
            </div>
          </TahoePanel>

          {!selectedState || !selectedProfile ? (
            <TahoePanel className="grid min-h-[220px] place-items-center p-8 text-center">
              <div><MapPin className="mx-auto mb-3 text-sky-100/46" /><p className="font-bold">Select a state on the map</p><p className="mt-2 text-sm text-sky-100/54">Its agency intelligence buckets and records will open below.</p></div>
            </TahoePanel>
          ) : (
            <TahoePanel className="p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-5">
                <div><p className="text-xs uppercase tracking-[.2em] text-sky-100/50">{selectedProfile.stateCode} · {selectedProfile.region}</p><h2 className="mt-1 text-2xl font-black">{selectedProfile.stateName}</h2><p className="text-xs text-sky-100/54">{selectedProfile.oshaStatePlan.replaceAll("_", " ")} OSHA coverage · {selectedProfile.itemCount} saved items</p></div>
                <button onClick={() => setSelectedState(null)} className="rounded-xl border border-white/24 bg-white/[0.07] p-2 text-sky-100/62 hover:text-white"><X size={18} /></button>
              </div>
              <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                {STATE_BUCKETS.map(([id, label]) => <button key={id} onClick={() => setBucket(id)} className={cn("shrink-0 rounded-xl border px-3 py-2 text-xs backdrop-blur-xl", bucket === id ? "border-white/42 bg-white/[0.14] text-white" : "border-white/20 bg-white/[0.045] text-sky-100/54")}>{label}</button>)}
              </div>

              {bucket === "fmcsa" ? (
                <div className="mb-6 rounded-[24px] border border-white/24 bg-white/[0.065] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.18)] backdrop-blur-2xl">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/24 bg-white/[0.08] text-sky-100"><Truck size={20} /></div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[.2em] text-sky-100/50">Live federal carrier data</p>
                        <h3 className="mt-1 text-lg font-black">FMCSA QCMobile carrier search</h3>
                        <p className="mt-1 text-xs leading-5 text-sky-100/54">Search by legal/DBA name or USDOT number. Name results are filtered to {selectedProfile.stateName}.</p>
                      </div>
                    </div>
                    <span className={cn("rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em]", fmcsaStatusQ.data?.configured ? "border-emerald-200/28 bg-emerald-300/[0.08] text-emerald-100" : "border-amber-200/28 bg-amber-300/[0.08] text-amber-100")}>{fmcsaStatusQ.isLoading ? "Checking" : fmcsaStatusQ.data?.configured ? "API ready" : "Key required"}</span>
                  </div>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <label className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl border border-white/26 bg-white/[0.065] px-4">
                      <Search size={16} className="text-sky-100/55" />
                      <input
                        value={fmcsaQuery}
                        onChange={(event) => setFmcsaQuery(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") void searchFmcsa(); }}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-sky-100/38"
                        placeholder="Carrier name or USDOT number"
                      />
                    </label>
                    <button type="button" onClick={() => void searchFmcsa()} disabled={fmcsaLoading || !fmcsaQuery.trim() || fmcsaStatusQ.data?.configured === false} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/[0.11] px-5 text-sm font-bold text-white transition hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-45">
                      {fmcsaLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      Search FMCSA
                    </button>
                  </div>
                  {fmcsaStatusQ.data?.configured === false ? <p className="mt-3 text-xs text-amber-100/76">Add <code className="rounded bg-white/[0.08] px-1.5 py-0.5">FMCSA_WEB_KEY</code> to the Render service environment, then redeploy.</p> : null}
                  {fmcsaError ? <p className="mt-3 rounded-2xl border border-rose-200/20 bg-rose-300/[0.06] p-3 text-xs text-rose-100">{fmcsaError}</p> : null}
                  {fmcsaResults.length ? (
                    <div className="mt-5 grid gap-3 lg:grid-cols-2">
                      {fmcsaResults.map((carrier, index) => (
                        <article key={`${carrier.dotNumber || carrier.legalName || "carrier"}-${index}`} className="rounded-2xl border border-white/22 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.17)]">
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="text-[10px] uppercase tracking-[.16em] text-sky-100/50">USDOT {carrier.dotNumber || "not reported"}{carrier.mcNumber ? ` · MC ${carrier.mcNumber}` : ""}</p><h4 className="mt-1 font-bold text-white">{carrier.legalName || carrier.dbaName || "Unnamed carrier"}</h4>{carrier.dbaName && carrier.dbaName !== carrier.legalName ? <p className="mt-1 text-xs text-sky-100/58">DBA: {carrier.dbaName}</p> : null}</div>
                            <Truck size={17} className="shrink-0 text-sky-100/62" />
                          </div>
                          <p className="mt-3 text-xs leading-5 text-sky-100/58">{formatCarrierAddress(carrier)}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[.1em]">
                            <span className="rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-1 text-sky-100/70">Operate: {carrier.allowedToOperate || "unknown"}</span>
                            <span className="rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-1 text-sky-100/70">Out of service: {carrier.outOfService || "unknown"}</span>
                            {carrier.complaintCount !== null ? <span className="rounded-full border border-white/20 bg-white/[0.05] px-2.5 py-1 text-sky-100/70">Complaints: {carrier.complaintCount}</span> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {!fmcsaLoading && !fmcsaError && fmcsaQuery.trim() && fmcsaResults.length === 0 ? <p className="mt-4 text-xs text-sky-100/50">No matching carrier records have been returned yet.</p> : null}
                </div>
              ) : null}

              {stateItemsQ.isLoading ? <LoadingCard label="state items" /> : stateItemsQ.error ? <ErrorCard error={stateItemsQ.error} /> : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {(stateItemsQ.data?.items ?? []).map((item) => (
                    <article key={item.id} className="rounded-2xl border border-white/22 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.17)] backdrop-blur-xl">
                      <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold">{item.title}</h3>{item.url ? <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={15} className="text-sky-100/62" /></a> : null}</div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-sky-100/56">{item.summary || "No summary saved."}</p>
                      <p className="mt-3 text-[10px] text-sky-100/44">{item.agency || item.itemType || "State source"} · {formatDate(item.publishedDate)}</p>
                    </article>
                  ))}
                  {(stateItemsQ.data?.items ?? []).length === 0 && bucket !== "fmcsa" ? <p className="col-span-full rounded-2xl border border-white/20 bg-white/[0.045] p-6 text-sm text-sky-100/54">No records are saved in this bucket for {selectedProfile.stateName}.</p> : null}
                </div>
              )}
            </TahoePanel>
          )}
        </div>
      ) : (
        <>
          <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
            {INTEL_CHANNELS.map(([id, label]) => <button key={id} onClick={() => setChannel(id)} className={cn("shrink-0 rounded-2xl border px-4 py-2.5 text-sm backdrop-blur-xl", channel === id ? "border-white/42 bg-white/[0.14] text-white" : "border-white/20 bg-white/[0.045] text-sky-100/54")}>{label}</button>)}
          </div>
          {intelQ.isLoading ? <LoadingCard label="cross-state intelligence" /> : intelQ.error ? <ErrorCard error={intelQ.error} /> : (
            <div className="grid gap-4 xl:grid-cols-2">
              {(intelQ.data?.items ?? []).map((item) => (
                <TahoePanel key={item.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><span className="rounded-full border border-white/22 bg-white/[0.055] px-2 py-1 text-[10px] uppercase tracking-wider text-sky-100/68">{item.severity || "low"}</span><h2 className="mt-3 font-bold">{item.title}</h2></div>
                    {item.url ? <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={16} className="text-sky-100/62" /></a> : null}
                  </div>
                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-sky-100/58">{item.summary || "No summary saved."}</p>
                  <p className="mt-4 text-xs text-sky-100/46">{item.source || "Public source"} · {formatDate(item.publishedDate)}</p>
                </TahoePanel>
              ))}
            </div>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
