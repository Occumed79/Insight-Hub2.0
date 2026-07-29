import { useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Landmark,
  MapPin,
  Search,
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

function MetricCard({ icon: Icon, value, label }: { icon: ElementType; value: number; label: string }) {
  return (
    <GlassCard variant="glass" className="flex items-center gap-4 p-5">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100/12 bg-cyan-300/8 text-cyan-100/75"><Icon size={19} /></div>
      <div><p className="text-2xl font-black tracking-tight text-white">{value}</p><p className="text-xs text-cyan-100/42">{label}</p></div>
    </GlassCard>
  );
}

function LoadingCard({ label }: { label: string }) {
  return <GlassCard variant="glass" className="p-8 text-sm text-cyan-100/50">Loading {label}…</GlassCard>;
}

function ErrorCard({ error }: { error: unknown }) {
  return <GlassCard variant="glass" className="border-rose-300/20 p-8 text-sm text-rose-100/80">{error instanceof Error ? error.message : "This workspace could not be loaded."}</GlassCard>;
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-black/50 backdrop-blur-sm" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-[520px] overflow-y-auto border-l border-cyan-100/14 bg-[#04101d]/97 p-6 shadow-[-30px_0_90px_rgba(0,0,0,.58)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-7 flex items-start justify-between gap-5"><div><p className="text-xs uppercase tracking-[.24em] text-cyan-100/38">Intelligence Record</p><h2 className="mt-2 text-2xl font-black">{title}</h2></div><button onClick={onClose} className="rounded-xl border border-white/8 bg-white/[0.035] p-2 text-cyan-100/45 hover:text-white"><X size={18} /></button></div>
        <div className="space-y-4">{children}</div>
      </aside>
    </div>
  );
}

function Info({ label, value, link = false }: { label: string; value?: string | null; link?: boolean }) {
  if (!value) return null;
  return <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><p className="text-[10px] uppercase tracking-[.2em] text-cyan-100/34">{label}</p>{link ? <a href={value} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 break-all text-sm text-cyan-200/75 hover:text-white">{value}<ExternalLink size={13} /></a> : <p className="mt-2 text-sm text-white/80">{value}</p>}</div>;
}

function Tags({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><h3 className="text-sm font-bold">{title}</h3><div className="mt-3 flex flex-wrap gap-2">{values.map((value, index) => <span key={`${value}-${index}`} className="rounded-full border border-cyan-100/10 bg-cyan-300/6 px-3 py-1.5 text-xs text-cyan-100/55">{value}</span>)}</div></section>;
}

type Prospect = { id: string; name: string; website?: string | null; description?: string | null; industry?: string | null; headquarters?: string | null; employeeCount?: string | null; status: string; tier: string; researchSummary?: string | null; opportunitySignals?: string | null; lastResearched?: string | null };
type Client = { id: string; name: string; website?: string | null; industry?: string | null; headquarters?: string | null; overallHiringTrend?: string | null; branches?: Array<{ id: string; name?: string | null; city?: string | null; state?: string | null; country: string }>; contacts?: Array<{ id: string; name: string; title?: string | null; email?: string | null }> };

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="flex gap-2 rounded-2xl border border-cyan-100/10 bg-[#071321]/72 p-1.5"><button onClick={() => setTab("prospects")} className={cn("rounded-xl px-4 py-2 text-sm", tab === "prospects" ? "bg-cyan-300/16 text-white" : "text-cyan-100/45")}>Prospect Profiles</button><button onClick={() => setTab("clients")} className={cn("rounded-xl px-4 py-2 text-sm", tab === "clients" ? "bg-cyan-300/16 text-white" : "text-cyan-100/45")}>Client Records</button></div><label className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-cyan-100/12 bg-[#071321]/82 px-4 py-2.5"><Search size={16} className="text-cyan-100/45" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/28" placeholder={`Search ${tab}…`} /></label></div>
      {tab === "prospects" ? <><div className="mb-6 grid gap-4 md:grid-cols-3"><MetricCard icon={Target} value={prospects.length} label="Tracked prospects" /><MetricCard icon={UserRoundSearch} value={prospects.filter((item) => item.lastResearched || item.researchSummary).length} label="Researched" /><MetricCard icon={TrendingUp} value={prospects.filter((item) => item.opportunitySignals).length} label="Opportunity signals" /></div>{prospectsQ.isLoading ? <LoadingCard label="prospects" /> : prospectsQ.error ? <ErrorCard error={prospectsQ.error} /> : <div className="grid gap-4 xl:grid-cols-2">{filteredProspects.map((item) => <GlassCard key={item.id} variant="glass" className="cursor-pointer p-5 transition hover:border-cyan-200/28" onClick={() => setSelectedProspect(item)}><div className="flex items-start justify-between gap-4"><div><div className="mb-2 flex gap-2 text-[10px] uppercase tracking-wider text-cyan-100/55"><span>{item.tier}</span><span>·</span><span>{item.status}</span></div><h2 className="text-lg font-bold">{item.name}</h2><p className="mt-1 text-sm text-cyan-100/45">{item.industry || "Industry not reported"}</p></div><Target size={20} className="text-cyan-200/50" /></div><div className="mt-4 flex flex-wrap gap-4 text-xs text-cyan-100/40">{item.headquarters ? <span className="flex items-center gap-1"><MapPin size={13} />{item.headquarters}</span> : null}<span className="flex items-center gap-1"><CalendarDays size={13} />{item.lastResearched ? formatDate(item.lastResearched) : "Not researched"}</span></div></GlassCard>)}</div>}</> : <><div className="mb-6 grid gap-4 md:grid-cols-3"><MetricCard icon={Building2} value={clients.length} label="Client records" /><MetricCard icon={MapPin} value={clients.reduce((sum, item) => sum + (item.branches?.length ?? 0), 0)} label="Known branches" /><MetricCard icon={Users} value={clients.reduce((sum, item) => sum + (item.contacts?.length ?? 0), 0)} label="Saved contacts" /></div>{clientsQ.isLoading ? <LoadingCard label="clients" /> : clientsQ.error ? <ErrorCard error={clientsQ.error} /> : <div className="grid gap-4 xl:grid-cols-2">{filteredClients.map((item) => <GlassCard key={item.id} variant="glass" className="cursor-pointer p-5 transition hover:border-cyan-200/28" onClick={() => setSelectedClient(item)}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">{item.name}</h2><p className="mt-1 text-sm text-cyan-100/45">{item.industry || "Industry not reported"}</p></div><Building2 size={20} className="text-emerald-200/55" /></div><div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs"><div className="rounded-xl border border-white/7 p-3"><b className="text-lg">{item.branches?.length ?? 0}</b><p className="text-cyan-100/38">Branches</p></div><div className="rounded-xl border border-white/7 p-3"><b className="text-lg">{item.contacts?.length ?? 0}</b><p className="text-cyan-100/38">Contacts</p></div><div className="rounded-xl border border-white/7 p-3"><b className="capitalize">{item.overallHiringTrend || "Unknown"}</b><p className="text-cyan-100/38">Hiring</p></div></div></GlassCard>)}</div>}</>}
      {selectedProspect ? <Drawer title={selectedProspect.name} onClose={() => setSelectedProspect(null)}><Info label="Industry" value={selectedProspect.industry} /><Info label="Headquarters" value={selectedProspect.headquarters} /><Info label="Employees" value={selectedProspect.employeeCount} /><Info label="Website" value={selectedProspect.website} link /><Info label="Research summary" value={selectedProspect.researchSummary || selectedProspect.description} /><Tags title="Opportunity signals" values={parseList(selectedProspect.opportunitySignals)} /></Drawer> : null}
      {selectedClient ? <Drawer title={selectedClient.name} onClose={() => setSelectedClient(null)}><Info label="Industry" value={selectedClient.industry} /><Info label="Headquarters" value={selectedClient.headquarters} /><Info label="Website" value={selectedClient.website} link /><Tags title="Branches" values={(selectedClient.branches ?? []).map((branch) => [branch.name, branch.city, branch.state, branch.country].filter(Boolean).join(" · "))} /><Tags title="Contacts" values={(selectedClient.contacts ?? []).map((contact) => [contact.name, contact.title, contact.email].filter(Boolean).join(" · "))} /></Drawer> : null}
    </WorkspaceShell>
  );
}

type Competitor = { id: string; name: string; website?: string | null; description?: string | null; services?: string | null; coverageStates?: string | null; tier: string; headquarters?: string | null; employeeCount?: string | null; founded?: string | null; notes?: string | null; recentActivity?: string | null; contractWins?: string | null; newsArticles?: string | null; lastResearched?: string | null };

export function CompetitorsPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Competitor | null>(null);
  const dataQ = useQuery({ queryKey: ["core-competitors"], queryFn: () => fetchJson<{ competitors: Competitor[] }>("competitors") });
  const items = dataQ.data?.competitors ?? [];
  const filtered = items.filter((item) => !query.trim() || `${item.name} ${item.description ?? ""} ${item.headquarters ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <WorkspaceShell eyebrow="Market Intelligence" title="Competitors" subtitle="Competitor capabilities, coverage, contract activity, and positioning."><div className="mb-6 grid gap-4 md:grid-cols-4"><MetricCard icon={Target} value={items.length} label="Tracked" /><MetricCard icon={UserRoundSearch} value={items.filter((item) => item.lastResearched).length} label="Researched" /><MetricCard icon={FileText} value={items.reduce((sum, item) => sum + parseList(item.contractWins).length, 0)} label="Contract signals" /><MetricCard icon={FileText} value={items.reduce((sum, item) => sum + parseList(item.newsArticles).length, 0)} label="News articles" /></div><label className="mb-6 flex items-center gap-2 rounded-2xl border border-cyan-100/12 bg-[#071321]/82 px-4 py-2.5"><Search size={16} className="text-cyan-100/45" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/28" placeholder="Search competitors…" /></label>{dataQ.isLoading ? <LoadingCard label="competitors" /> : dataQ.error ? <ErrorCard error={dataQ.error} /> : <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{filtered.map((item) => <GlassCard key={item.id} variant="glass" className="cursor-pointer p-5 transition hover:border-cyan-200/28" onClick={() => setSelected(item)}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wider text-cyan-100/45">{item.tier}</p><h2 className="mt-2 text-lg font-bold">{item.name}</h2></div><Target size={20} className="text-violet-200/55" /></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-cyan-100/45">{item.description || "No description saved."}</p><div className="mt-4 flex flex-wrap gap-2">{parseList(item.services).slice(0, 4).map((service) => <span key={service} className="rounded-full border border-white/8 px-2.5 py-1 text-[10px] text-cyan-100/48">{service}</span>)}</div></GlassCard>)}</div>}{selected ? <Drawer title={selected.name} onClose={() => setSelected(null)}><Info label="Tier" value={selected.tier} /><Info label="Headquarters" value={selected.headquarters} /><Info label="Employees" value={selected.employeeCount} /><Info label="Founded" value={selected.founded} /><Info label="Website" value={selected.website} link /><Info label="Overview" value={selected.description} /><Tags title="Services" values={parseList(selected.services)} /><Tags title="Coverage" values={parseList(selected.coverageStates)} /><Tags title="Contract wins" values={parseList(selected.contractWins)} /><Info label="Recent activity" value={selected.recentActivity || selected.notes} /></Drawer> : null}</WorkspaceShell>;
}

type FederalItem = { id: string; sourceType: string; agency?: string | null; component?: string | null; title: string; summary?: string | null; datePosted?: string | null; contractorIncumbent?: string | null; occuMedScore?: number | null; actionTag?: string | null; sourceUrl?: string | null };
const FEDERAL_BUCKETS = [["forecast", "Forecast"], ["recompete-watch", "Recompete Watch"], ["agency-pain", "Agency Pain"], ["policy-radar", "Policy Radar"], ["incumbent-tracker", "Incumbents"], ["leadership-org", "Leadership"], ["deployment-medical", "Deploy / Medical"], ["budget-funding", "Budget"], ["protest-litigation", "Protests"]] as const;

export function FederalAgenciesPage() {
  const [bucket, setBucket] = useState<(typeof FEDERAL_BUCKETS)[number][0]>("forecast");
  const [agency, setAgency] = useState("all");
  const dataQ = useQuery({ queryKey: ["core-federal", bucket], queryFn: () => fetchJson<{ items: FederalItem[]; total: number }>(`federal-intel/${bucket}?limit=200`) });
  const items = dataQ.data?.items ?? [];
  const agencies = useMemo(() => Array.from(new Set(items.map((item) => item.agency).filter((value): value is string => Boolean(value)))).sort(), [items]);
  const filtered = agency === "all" ? items : items.filter((item) => item.agency === agency);
  return <WorkspaceShell eyebrow="Government Intelligence" title="Federal Agencies" subtitle="Federal procurement, oversight, policy, incumbent, leadership, deployment, budget, and protest intelligence."><div className="mb-6 flex gap-2 overflow-x-auto pb-2">{FEDERAL_BUCKETS.map(([id, label]) => <button key={id} onClick={() => { setBucket(id); setAgency("all"); }} className={cn("shrink-0 rounded-2xl border px-4 py-2.5 text-sm", bucket === id ? "border-cyan-200/28 bg-cyan-300/14 text-white" : "border-cyan-100/8 text-cyan-100/42")}>{label}</button>)}</div><div className="mb-6 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Landmark className="text-violet-100/70" /><div><p className="font-bold">{FEDERAL_BUCKETS.find(([id]) => id === bucket)?.[1]}</p><p className="text-xs text-cyan-100/38">{dataQ.data?.total ?? 0} records</p></div></div><select value={agency} onChange={(event) => setAgency(event.target.value)} className="rounded-2xl border border-cyan-100/12 bg-[#071321] px-4 py-2.5 text-sm"><option value="all">All agencies</option>{agencies.map((item) => <option key={item}>{item}</option>)}</select></div>{dataQ.isLoading ? <LoadingCard label="federal intelligence" /> : dataQ.error ? <ErrorCard error={dataQ.error} /> : <div className="grid gap-4 xl:grid-cols-2">{filtered.map((item) => <GlassCard key={item.id} variant="glass" className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="mb-2 flex gap-2 text-[10px] uppercase tracking-wider text-violet-100/60"><span>{item.sourceType}</span>{item.actionTag ? <span>· {item.actionTag}</span> : null}{typeof item.occuMedScore === "number" ? <span>· Score {item.occuMedScore}</span> : null}</div><h2 className="font-bold leading-6">{item.title}</h2></div>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} className="text-cyan-100/40" /></a> : null}</div><p className="mt-3 line-clamp-4 text-sm leading-6 text-cyan-100/48">{item.summary || "No summary saved."}</p><p className="mt-4 text-xs text-cyan-100/35">{item.agency || "Federal source"}{item.component ? ` · ${item.component}` : ""}{item.contractorIncumbent ? ` · Incumbent: ${item.contractorIncumbent}` : ""} · {formatDate(item.datePosted)}</p></GlassCard>)}</div>}</WorkspaceShell>;
}

type StateProfile = { stateCode: string; stateName: string; region: string; oshaStatePlan: string; itemCount: number };
type StateItem = { id: string; title: string; summary?: string | null; url?: string | null; publishedDate?: string | null; agency?: string | null; itemType?: string | null };
type StateIntelItem = { id: string; title: string; summary?: string | null; url?: string | null; publishedDate?: string | null; source?: string | null; severity?: string | null };
const STATE_BUCKETS = [["procurement", "Procurement"], ["legislature", "Legislature"], ["governor_agencies", "Gov / Agencies"], ["health_dept", "Health Dept"], ["labor_warn", "Labor / WARN"], ["medical_licensing", "Med Licensing"], ["emergency_mgmt", "Emergency Mgmt"], ["osha_plan", "OSHA Plan"], ["insurance_dept", "Insurance"], ["corrections", "Corrections"], ["fmcsa", "FMCSA / CDL"], ["post_guidelines", "POST"], ["dot", "State DOT"]] as const;
const INTEL_CHANNELS = [["public_health", "Public Health"], ["travel_advisory", "Travel Advisories"], ["fda_recalls", "FDA Recalls"], ["disaster", "FEMA Disasters"]] as const;

export function StateAgenciesPage() {
  const [view, setView] = useState<"state" | "intel">("intel");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [bucket, setBucket] = useState("procurement");
  const [channel, setChannel] = useState("public_health");
  const statesQ = useQuery({ queryKey: ["core-states"], queryFn: () => fetchJson<{ states: StateProfile[] }>("state-agencies/states") });
  const stateItemsQ = useQuery({ queryKey: ["core-state-items", selectedState, bucket], queryFn: () => fetchJson<{ items: StateItem[]; bucketCounts: Record<string, number> }>(`state-agencies/items?stateCode=${selectedState}&bucket=${bucket}`), enabled: Boolean(selectedState) });
  const intelQ = useQuery({ queryKey: ["core-state-intel", channel], queryFn: () => fetchJson<{ items: StateIntelItem[]; channelCounts: Record<string, number> }>(`state-agencies/intel?channel=${channel}`) });
  const states = statesQ.data?.states ?? [];
  const selectedProfile = states.find((state) => state.stateCode === selectedState);
  return <WorkspaceShell eyebrow="Government Intelligence" title="State Agencies" subtitle="State regulatory, health, labor, emergency, licensing, and cross-state intelligence."><div className="mb-6 flex gap-2 rounded-2xl border border-cyan-100/10 bg-[#071321]/72 p-1.5 sm:w-fit"><button onClick={() => setView("state")} className={cn("rounded-xl px-4 py-2 text-sm", view === "state" ? "bg-cyan-300/16 text-white" : "text-cyan-100/45")}>State Agencies</button><button onClick={() => setView("intel")} className={cn("rounded-xl px-4 py-2 text-sm", view === "intel" ? "bg-violet-300/16 text-white" : "text-cyan-100/45")}>Cross-State Intelligence</button></div>{statesQ.isLoading ? <LoadingCard label="state profiles" /> : statesQ.error ? <ErrorCard error={statesQ.error} /> : view === "state" ? <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]"><GlassCard variant="glass" className="p-5"><div className="mb-4"><h2 className="font-bold">States</h2><p className="text-xs text-cyan-100/38">Select a state to open its agency intelligence.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">{states.map((state) => <button key={state.stateCode} onClick={() => setSelectedState(state.stateCode)} className={cn("rounded-xl border p-3 text-left transition", selectedState === state.stateCode ? "border-cyan-200/30 bg-cyan-300/12" : "border-white/7 bg-white/[0.025] hover:border-cyan-100/20")}><b>{state.stateCode}</b><p className="truncate text-xs text-cyan-100/45">{state.stateName}</p><p className="mt-1 text-[10px] text-cyan-100/30">{state.itemCount} items</p></button>)}</div></GlassCard><GlassCard variant="glass" className="min-h-[560px] p-5">{!selectedState || !selectedProfile ? <div className="grid min-h-[500px] place-items-center text-center"><div><MapPin className="mx-auto mb-3 text-cyan-100/30" /><p className="font-bold">Select a state</p><p className="mt-2 text-sm text-cyan-100/38">Its intelligence buckets will appear here.</p></div></div> : <><div className="mb-5 flex items-start justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-100/38">{selectedProfile.stateCode} · {selectedProfile.region}</p><h2 className="mt-1 text-2xl font-black">{selectedProfile.stateName}</h2><p className="text-xs text-cyan-100/40">{selectedProfile.oshaStatePlan.replaceAll("_", " ")} OSHA coverage</p></div><button onClick={() => setSelectedState(null)}><X size={18} /></button></div><div className="mb-5 flex gap-2 overflow-x-auto pb-2">{STATE_BUCKETS.map(([id, label]) => <button key={id} onClick={() => setBucket(id)} className={cn("shrink-0 rounded-xl border px-3 py-2 text-xs", bucket === id ? "border-cyan-200/24 bg-cyan-300/12" : "border-white/7 text-cyan-100/38")}>{label}</button>)}</div>{stateItemsQ.isLoading ? <LoadingCard label="state items" /> : stateItemsQ.error ? <ErrorCard error={stateItemsQ.error} /> : <div className="space-y-3">{(stateItemsQ.data?.items ?? []).map((item) => <article key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold">{item.title}</h3>{item.url ? <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a> : null}</div><p className="mt-2 line-clamp-3 text-xs leading-5 text-cyan-100/42">{item.summary || "No summary saved."}</p><p className="mt-3 text-[10px] text-cyan-100/30">{item.agency || item.itemType || "State source"} · {formatDate(item.publishedDate)}</p></article>)}</div>}</>}</GlassCard></div> : <><div className="mb-5 flex gap-2 overflow-x-auto pb-2">{INTEL_CHANNELS.map(([id, label]) => <button key={id} onClick={() => setChannel(id)} className={cn("shrink-0 rounded-2xl border px-4 py-2.5 text-sm", channel === id ? "border-violet-200/26 bg-violet-300/14" : "border-white/7 text-cyan-100/40")}>{label}</button>)}</div>{intelQ.isLoading ? <LoadingCard label="cross-state intelligence" /> : intelQ.error ? <ErrorCard error={intelQ.error} /> : <div className="grid gap-4 xl:grid-cols-2">{(intelQ.data?.items ?? []).map((item) => <GlassCard key={item.id} variant="glass" className="p-5"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full border border-violet-200/15 px-2 py-1 text-[10px] uppercase tracking-wider text-violet-100/60">{item.severity || "low"}</span><h2 className="mt-3 font-bold">{item.title}</h2></div>{item.url ? <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a> : null}</div><p className="mt-3 line-clamp-4 text-sm leading-6 text-cyan-100/45">{item.summary || "No summary saved."}</p><p className="mt-4 text-xs text-cyan-100/32">{item.source || "Public source"} · {formatDate(item.publishedDate)}</p></GlassCard>)}</div>}</>}</WorkspaceShell>;
}
