import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock3,
  DollarSign,
  ExternalLink,
  HeartPulse,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}/api/${path}`;
const STATE_GEOMETRY_URL = api("core-intelligence/state-map-geometry");

type Workspace = "competitors" | "federal" | "state";
type Freshness = "oneDay" | "oneWeek" | "oneMonth" | "oneYear" | "noLimit";

type SearchItem = {
  id: string;
  title: string;
  url: string;
  displayUrl: string;
  siteName: string;
  snippet: string;
  summary: string;
  publishedAt: string | null;
  lastCrawledAt: string | null;
};

type LiveSearchResponse = {
  ok: boolean;
  configured: boolean;
  query: string;
  queryUsed: string;
  results: SearchItem[];
  returned: number;
  cacheState: "fresh" | "refreshed" | "stale";
  source: string;
  searchedAt: string;
  limitation: string;
};

type FederalItem = {
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

type FederalBucketResponse = { items: FederalItem[]; bucket: string; total: number };

type Competitor = {
  id: string; name: string; website: string | null; description: string | null;
  services: string | null; coverageStates: string | null; tier: string | null;
  headquarters: string | null; employeeCount: string | null; founded: string | null; notes: string | null;
};

type StateProfile = {
  stateCode: string;
  stateName: string;
  region: string | null;
  oshaStatePlan: string | null;
  procurementUrl: string | null;
  legislatureUrl: string | null;
  govUrl: string | null;
  healthDeptUrl: string | null;
  laborUrl: string | null;
  emergencyMgmtUrl: string | null;
  medicalBoardUrl: string | null;
  insuranceDeptUrl: string | null;
  correctionsUrl: string | null;
  dotUrl: string | null;
  postCommissionUrl: string | null;
  itemCount: number;
};

type StateAgencyItem = {
  id: string;
  stateCode: string;
  bucket: string;
  title: string;
  summary: string | null;
  url: string | null;
  publishedDate: string | null;
  agency: string | null;
  itemType: string | null;
  relevanceScore: number | null;
  fetchedAt: string | null;
};

type StateIntelItem = {
  id: string;
  channel: string;
  title: string;
  summary: string | null;
  url: string | null;
  publishedDate: string | null;
  source: string | null;
  severity: string | null;
  affectedStates: string | null;
  fetchedAt: string | null;
};

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

type FmcsaStatus = { ok: boolean; configured: boolean; environmentVariable: string; source: string; capabilities: string[]; limitation: string };
type FmcsaResponse = { ok: boolean; configured: boolean; records: FmcsaCarrier[]; returned: number; unfilteredReturned: number; cacheState: "fresh" | "refreshed" | "stale"; source: string; sourceUrl: string; limitation: string };

const COMPETITOR_CATEGORIES = ["Market overview", "Services and coverage", "Contract activity", "Recent news", "Leadership and positioning"] as const;
const FEDERAL_BUCKETS = [
  ["forecast", "Forecasts"],
  ["recompete-watch", "Recompete Watch"],
  ["incumbent-tracker", "Contracts & Incumbents"],
  ["deployment-medical", "Medical Requirements"],
] as const;
const FEDERAL_VIEWS = ["All intelligence", "Active contracts", "Forecasts", "Recompetes", "Spending", "Incumbents", "Contracting offices", "Medical requirements", "Recent activity"] as const;
const STATE_VIEWS = ["Compliance pulse", "Occupational health", "Procurement", "Labor / OSHA", "Health department", "Medical licensing", "State DOT", "Official sources", "FMCSA / DOT Carrier Lookup"] as const;

const FIPS_STATES: Record<string, { code: string; name: string }> = {
  "01": { code: "AL", name: "Alabama" }, "02": { code: "AK", name: "Alaska" }, "04": { code: "AZ", name: "Arizona" }, "05": { code: "AR", name: "Arkansas" },
  "06": { code: "CA", name: "California" }, "08": { code: "CO", name: "Colorado" }, "09": { code: "CT", name: "Connecticut" }, "10": { code: "DE", name: "Delaware" },
  "11": { code: "DC", name: "District of Columbia" }, "12": { code: "FL", name: "Florida" }, "13": { code: "GA", name: "Georgia" }, "15": { code: "HI", name: "Hawaii" },
  "16": { code: "ID", name: "Idaho" }, "17": { code: "IL", name: "Illinois" }, "18": { code: "IN", name: "Indiana" }, "19": { code: "IA", name: "Iowa" },
  "20": { code: "KS", name: "Kansas" }, "21": { code: "KY", name: "Kentucky" }, "22": { code: "LA", name: "Louisiana" }, "23": { code: "ME", name: "Maine" },
  "24": { code: "MD", name: "Maryland" }, "25": { code: "MA", name: "Massachusetts" }, "26": { code: "MI", name: "Michigan" }, "27": { code: "MN", name: "Minnesota" },
  "28": { code: "MS", name: "Mississippi" }, "29": { code: "MO", name: "Missouri" }, "30": { code: "MT", name: "Montana" }, "31": { code: "NE", name: "Nebraska" },
  "32": { code: "NV", name: "Nevada" }, "33": { code: "NH", name: "New Hampshire" }, "34": { code: "NJ", name: "New Jersey" }, "35": { code: "NM", name: "New Mexico" },
  "36": { code: "NY", name: "New York" }, "37": { code: "NC", name: "North Carolina" }, "38": { code: "ND", name: "North Dakota" }, "39": { code: "OH", name: "Ohio" },
  "40": { code: "OK", name: "Oklahoma" }, "41": { code: "OR", name: "Oregon" }, "42": { code: "PA", name: "Pennsylvania" }, "44": { code: "RI", name: "Rhode Island" },
  "45": { code: "SC", name: "South Carolina" }, "46": { code: "SD", name: "South Dakota" }, "47": { code: "TN", name: "Tennessee" }, "48": { code: "TX", name: "Texas" },
  "49": { code: "UT", name: "Utah" }, "50": { code: "VT", name: "Vermont" }, "51": { code: "VA", name: "Virginia" }, "53": { code: "WA", name: "Washington" },
  "54": { code: "WV", name: "West Virginia" }, "55": { code: "WI", name: "Wisconsin" }, "56": { code: "WY", name: "Wyoming" },
};

function formatDate(value?: string | null): string {
  if (!value) return "Date not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function compactMoney(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value).toLocaleString()}`;
}

function moneyValue(value: string | null): number {
  if (!value) return 0;
  const number = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(api(path), { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `Request failed with HTTP ${response.status}`);
  return payload as T;
}

function canonicalAgency(value: string | null): string {
  const name = (value || "Agency not reported").trim();
  if (/state department|department of state|state, department of/i.test(name)) return "Department of State";
  if (/defense/i.test(name)) return "Department of Defense";
  if (/veterans affairs/i.test(name)) return "Department of Veterans Affairs";
  if (/health and human services/i.test(name)) return "Department of Health and Human Services";
  if (/homeland security/i.test(name)) return "Department of Homeland Security";
  if (/energy/i.test(name)) return "Department of Energy";
  if (/justice/i.test(name)) return "Department of Justice";
  if (/agriculture/i.test(name)) return "Department of Agriculture";
  if (/interior/i.test(name)) return "Department of the Interior";
  return name;
}

function WorkspaceShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(13,148,136,.32),transparent_34%),radial-gradient(circle_at_52%_48%,rgba(14,165,233,.25),transparent_40%),radial-gradient(circle_at_88%_28%,rgba(79,70,229,.24),transparent_34%),linear-gradient(145deg,#020817_8%,#06243b_46%,#071333_70%,#0b0824)]" />
      <Sidebar />
      <main className="relative min-h-screen px-5 py-8 sm:px-8 lg:ml-[210px] lg:px-10 xl:px-14">
        <HeaderBar eyebrow={eyebrow} title={title} subtitle={subtitle} />
        {children}
      </main>
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <GlassCard variant="glass" className={cn("border-cyan-100/16 bg-[#04101d]/82 shadow-[0_24px_70px_rgba(0,0,0,.32),inset_0_1px_0_rgba(255,255,255,.06)]", className)}>{children}</GlassCard>;
}

function Tabs({ values, active, onChange }: { values: readonly string[]; active: string; onChange: (value: string) => void }) {
  return <div className="flex gap-2 overflow-x-auto pb-2">{values.map((value) => <button key={value} type="button" onClick={() => onChange(value)} className={cn("shrink-0 rounded-xl border px-4 py-2.5 text-xs font-bold transition", active === value ? "border-cyan-200/28 bg-cyan-300/[0.12] text-white" : "border-white/8 bg-white/[0.025] text-cyan-50/54 hover:text-white")}>{value}</button>)}</div>;
}

function useLiveSearch(workspace: Workspace) {
  const [response, setResponse] = useState<LiveSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function run(query: string, category: string, freshness: Freshness, state = "") {
    if (query.trim().length < 2) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ workspace, query: query.trim(), category, freshness });
      if (state) params.set("state", state);
      setResponse(await getJson<LiveSearchResponse>(`core-intelligence/live-search?${params.toString()}`));
    } catch (err) { setResponse(null); setError(err instanceof Error ? err.message : "Live search failed."); }
    finally { setLoading(false); }
  }
  function reset() { setResponse(null); setError(""); }
  return { response, loading, error, run, reset };
}

function SearchResults({ response, loading, error }: { response: LiveSearchResponse | null; loading: boolean; error: string }) {
  if (loading) return <Panel className="mt-4 flex min-h-40 items-center justify-center gap-3 p-6 text-sm text-cyan-50/72"><Loader2 size={18} className="animate-spin" />Refreshing public-source intelligence…</Panel>;
  if (error) return <Panel className="mt-4 border-rose-200/20 p-5 text-sm text-rose-100">{error}</Panel>;
  if (!response) return null;
  return <div className="mt-4 grid gap-3 xl:grid-cols-2">{response.results.map((item) => <Panel key={item.url} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.17em] text-cyan-100/46">{item.siteName}</p><h3 className="mt-1 text-base font-black text-white">{item.title}</h3></div><a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`} className="rounded-lg border border-white/8 p-2 text-cyan-100/55 hover:text-white"><ExternalLink size={15} /></a></div><p className="mt-3 text-xs leading-6 text-cyan-50/60">{item.summary || item.snippet}</p><p className="mt-3 text-[10px] text-cyan-100/38">{formatDate(item.publishedAt || item.lastCrawledAt)}</p></Panel>)}</div>;
}

export function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(COMPETITOR_CATEGORIES[0]);
  const search = useLiveSearch("competitors");
  useEffect(() => { let cancelled = false; void getJson<{ competitors: Competitor[] }>("competitors").then(({ competitors: rows }) => { if (cancelled) return; setCompetitors(rows); setSelectedId((current) => current || rows[0]?.id || ""); }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load competitors."); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  const selected = competitors.find((item) => item.id === selectedId) || competitors[0];
  const parseList = (value: string | null) => { if (!value) return []; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : [value]; } catch { return value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean); } };
  const tiers = competitors.reduce<Record<string, number>>((acc, item) => { const tier = item.tier || "unclassified"; acc[tier] = (acc[tier] || 0) + 1; return acc; }, {});
  const states = new Set(competitors.flatMap((item) => parseList(item.coverageStates)));
  const services = competitors.flatMap((item) => parseList(item.services));
  const topServices = [...new Set(services)].slice(0, 8);
  return <WorkspaceShell eyebrow="Database-backed market intelligence" title="Competitors" subtitle="The stored competitor roster and its strategic coverage load first. Select a company for an immediate capability brief; public research is secondary.">
    {loading ? <Panel className="p-8 text-center"><Loader2 className="mx-auto animate-spin" />Loading competitor database…</Panel> : null}{error ? <Panel className="border-rose-200/20 p-5 text-rose-100">{error}</Panel> : null}
    {!loading && !error ? <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Panel className="p-4"><p className="text-[9px] uppercase text-cyan-100/45">Stored competitors</p><p className="mt-2 text-3xl font-black">{competitors.length}</p></Panel><Panel className="p-4"><p className="text-[9px] uppercase text-cyan-100/45">Market tiers</p><p className="mt-2 text-lg font-black">{Object.entries(tiers).map(([key,value]) => `${key} ${value}`).join(" · ") || "—"}</p></Panel><Panel className="p-4"><p className="text-[9px] uppercase text-cyan-100/45">Geographic footprint</p><p className="mt-2 text-3xl font-black">{states.size}</p><p className="text-xs text-cyan-50/45">coverage states represented</p></Panel><Panel className="p-4"><p className="text-[9px] uppercase text-cyan-100/45">Service capabilities</p><p className="mt-2 text-3xl font-black">{new Set(services).size}</p><p className="text-xs text-cyan-50/45">distinct stored services</p></Panel></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[330px_1fr]"><Panel className="p-4"><h2 className="text-lg font-black">Competitor roster</h2><div className="mt-3 max-h-[680px] space-y-2 overflow-y-auto">{competitors.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={cn("w-full rounded-xl border p-3 text-left", selected?.id === item.id ? "border-cyan-200/30 bg-cyan-300/10" : "border-white/8 bg-white/[.02]")}><p className="font-black">{item.name}</p><p className="mt-1 text-[10px] text-cyan-50/45">{item.tier || "Unclassified"} · {item.headquarters || "HQ not stored"}</p></button>)}</div></Panel>
    {selected ? <div className="space-y-4"><Panel className="p-5"><div className="flex justify-between gap-4"><div><p className="text-[9px] uppercase text-cyan-100/45">Overview</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="mt-2 text-xs leading-6 text-cyan-50/60">{selected.description || selected.notes || "Strategic description has not yet been stored."}</p></div>{selected.website ? <a href={selected.website} target="_blank" rel="noreferrer"><ExternalLink /></a> : null}</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><p><strong>Tier</strong><br/><span className="text-xs text-cyan-50/55">{selected.tier || "—"}</span></p><p><strong>Headquarters</strong><br/><span className="text-xs text-cyan-50/55">{selected.headquarters || "—"}</span></p><p><strong>Size / founded</strong><br/><span className="text-xs text-cyan-50/55">{selected.employeeCount || "—"} · {selected.founded || "—"}</span></p></div></Panel><div className="grid gap-4 md:grid-cols-2"><Panel className="p-5"><h3 className="font-black">Service Capability</h3><div className="mt-3 flex flex-wrap gap-2">{parseList(selected.services).map((value) => <span key={value} className="rounded-full border border-cyan-200/15 px-3 py-1 text-xs">{value}</span>)}</div></Panel><Panel className="p-5"><h3 className="font-black">Geographic Coverage</h3><p className="mt-3 text-xs leading-6 text-cyan-50/60">{parseList(selected.coverageStates).join(" · ") || "Coverage not stored."}</p></Panel><Panel className="p-5"><h3 className="font-black">Federal Awards & Open Opportunities</h3><p className="mt-2 text-xs text-cyan-50/55">Select Federal Awards or Federal Agencies in the sidebar for source-specific USAspending and SAM intelligence for {selected.name}.</p></Panel><Panel className="p-5"><h3 className="font-black">Leadership / Corporate Positioning</h3><p className="mt-2 text-xs leading-6 text-cyan-50/55">{selected.notes || "No positioning notes stored."}</p></Panel></div></div> : <Panel className="p-8">No competitors are stored.</Panel>}</section>
    <Panel className="mt-5 p-4"><p className="mb-3 text-[9px] font-black uppercase tracking-widest text-cyan-100/45">Research more · public sources</p><Tabs values={COMPETITOR_CATEGORIES} active={category} onChange={(value) => { setCategory(value); search.reset(); }} /><form onSubmit={(e) => { e.preventDefault(); void search.run(query, category, "oneYear"); }} className="mt-3 flex gap-3"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Research ${selected?.name || "a competitor"} further`} className="min-h-12 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 text-sm"/><button disabled={query.trim().length < 2 || search.loading} className="rounded-xl border border-cyan-200/20 px-5 text-xs font-black">Research more</button></form>{topServices.length ? <p className="mt-3 text-[10px] text-cyan-50/35">Roster service signals: {topServices.join(" · ")}</p> : null}</Panel><SearchResults response={search.response} loading={search.loading} error={search.error} /></> : null}
  </WorkspaceShell>;
}

function federalMatches(item: FederalItem, view: string): boolean {
  const text = `${item.bucket} ${item.title} ${item.summary || ""} ${item.status || ""}`.toLowerCase();
  if (view === "Active contracts") return item.bucket === "incumbent-tracker" && /active|current|award/.test(text);
  if (view === "Forecasts") return item.bucket === "forecast";
  if (view === "Recompetes") return item.bucket === "recompete-watch";
  if (view === "Spending") return Boolean(item.budgetSignal);
  if (view === "Incumbents") return Boolean(item.contractorIncumbent);
  if (view === "Contracting offices") return Boolean(item.office || item.component);
  if (view === "Medical requirements") return item.bucket === "deployment-medical" || Boolean(item.medicalTravelRelevance);
  if (view === "Recent activity") {
    const date = new Date(item.datePosted || item.fetchedAt || 0).getTime();
    return Number.isFinite(date) && date > Date.now() - 365 * 24 * 60 * 60 * 1000;
  }
  return true;
}

export function FederalAgenciesPage() {
  const [items, setItems] = useState<FederalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agency, setAgency] = useState("All agencies");
  const [view, setView] = useState<string>(FEDERAL_VIEWS[0]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(FEDERAL_BUCKETS.map(([bucket]) => getJson<FederalBucketResponse>(`federal-intel/${bucket}?limit=200`)))
      .then((responses) => { if (!cancelled) setItems(responses.flatMap((response) => response.items)); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load federal intelligence."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const agencies = useMemo(() => {
    const map = new Map<string, FederalItem[]>();
    items.forEach((item) => {
      const name = canonicalAgency(item.agency);
      map.set(name, [...(map.get(name) || []), item]);
    });
    return [...map.entries()].map(([name, rows]) => ({ name, rows, latest: [...rows].sort((a, b) => new Date(b.datePosted || b.fetchedAt || 0).getTime() - new Date(a.datePosted || a.fetchedAt || 0).getTime())[0] })).sort((a, b) => b.rows.length - a.rows.length);
  }, [items]);

  const visible = useMemo(() => items.filter((item) => {
    if (agency !== "All agencies" && canonicalAgency(item.agency) !== agency) return false;
    if (!federalMatches(item, view)) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${item.title} ${item.summary || ""} ${item.contractorIncumbent || ""} ${item.office || ""} ${canonicalAgency(item.agency)}`.toLowerCase().includes(needle);
  }).sort((a, b) => new Date(b.datePosted || b.fetchedAt || 0).getTime() - new Date(a.datePosted || a.fetchedAt || 0).getTime()), [items, agency, view, query]);

  const totalSpend = items.reduce((sum, item) => sum + moneyValue(item.budgetSignal), 0);
  const activeCount = items.filter((item) => item.bucket === "incumbent-tracker" && /active/i.test(item.status || "")).length;
  const incumbentCount = items.filter((item) => item.contractorIncumbent).length;
  const medicalCount = items.filter((item) => item.bucket === "deployment-medical" || item.medicalTravelRelevance).length;
  const offices = [...new Set(items.map((item) => item.office || item.component).filter((value): value is string => Boolean(value)))];

  return (
    <WorkspaceShell eyebrow="Government opportunity intelligence" title="Federal Agencies" subtitle="Agency intelligence loads first: contracts, recompetes, forecasts, incumbents, offices, spending signals, medical requirements, and recent activity. Search only filters what is already here.">
      {loading ? <Panel className="flex min-h-52 items-center justify-center gap-3 p-8"><Loader2 className="animate-spin" size={18} />Loading persisted federal intelligence…</Panel> : null}
      {error ? <Panel className="border-rose-200/20 p-5 text-rose-100">{error}</Panel> : null}
      {!loading && !error ? <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Agency directory", agencies.length.toLocaleString(), "normalized agencies", Landmark],
            ["Active contracts", activeCount.toLocaleString(), "current incumbent records", BriefcaseBusiness],
            ["Tracked award value", compactMoney(totalSpend), "USAspending-derived signals", DollarSign],
            ["Incumbent records", incumbentCount.toLocaleString(), "contractor relationships", Building2],
            ["Medical intelligence", medicalCount.toLocaleString(), "deployment / health records", HeartPulse],
          ].map(([label, value, note, Icon]) => <Panel key={String(label)} className="p-4"><Icon size={16} className="text-cyan-200/55" /><p className="mt-3 text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">{String(label)}</p><p className="mt-1 text-2xl font-black text-white">{String(value)}</p><p className="mt-1 text-[10px] text-cyan-50/42">{String(note)}</p></Panel>)}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[330px_1fr]">
          <Panel className="p-4">
            <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.17em] text-cyan-100/40">Agency directory</p><h2 className="mt-1 text-lg font-black">Agencies with intelligence</h2></div><span className="rounded-full border border-white/8 px-2.5 py-1 text-[10px] text-cyan-50/48">{items.length} records</span></div>
            <button type="button" onClick={() => setAgency("All agencies")} className={cn("mt-4 w-full rounded-xl border p-3 text-left text-xs font-bold", agency === "All agencies" ? "border-cyan-200/24 bg-cyan-300/[0.08]" : "border-white/7 bg-white/[0.02]")}>All agencies</button>
            <div className="mt-2 max-h-[570px] space-y-2 overflow-y-auto pr-1">
              {agencies.map((entry) => <button key={entry.name} type="button" onClick={() => setAgency(entry.name)} className={cn("w-full rounded-xl border p-3 text-left transition", agency === entry.name ? "border-cyan-200/24 bg-cyan-300/[0.08]" : "border-white/7 bg-white/[0.02] hover:border-white/14")}><div className="flex items-start justify-between gap-3"><span className="text-xs font-black text-white">{entry.name}</span><span className="text-[10px] font-bold text-cyan-100/46">{entry.rows.length}</span></div><p className="mt-1 text-[9px] text-cyan-50/34">Latest {formatDate(entry.latest?.datePosted || entry.latest?.fetchedAt)}</p></button>)}
            </div>
          </Panel>

          <div className="min-w-0">
            <Panel className="p-4">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.17em] text-cyan-100/40">Loaded intelligence</p><h2 className="mt-1 text-lg font-black">{agency}</h2></div><div className="text-right text-[10px] text-cyan-50/40">{offices.length} contracting offices/components represented</div></div>
              <div className="mt-4"><Tabs values={FEDERAL_VIEWS} active={view} onChange={setView} /></div>
              <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4"><Search size={15} className="text-cyan-100/45" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter loaded agency data by contract, incumbent, office, requirement…" className="w-full bg-transparent text-xs text-white outline-none" /></label>
            </Panel>
            <div className="mt-4 grid gap-3 2xl:grid-cols-2">
              {visible.length ? visible.map((item) => <Panel key={item.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-cyan-200/12 bg-cyan-300/[0.05] px-2 py-1 text-[8px] font-black uppercase tracking-[.13em] text-cyan-100/60">{item.bucket.replace(/-/g, " ")}</span>{item.status ? <span className="rounded-full border border-white/8 px-2 py-1 text-[8px] font-bold uppercase text-cyan-50/44">{item.status}</span> : null}</div><p className="mt-2 text-[10px] font-bold text-cyan-100/46">{canonicalAgency(item.agency)}</p><h3 className="mt-1 text-base font-black leading-6">{item.title}</h3></div>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/8 p-2 text-cyan-100/45 hover:text-white" aria-label={`Open source for ${item.title}`}><ExternalLink size={15} /></a> : null}</div><p className="mt-3 text-xs leading-6 text-cyan-50/58">{item.summary || "No summary stored."}</p><div className="mt-4 grid gap-2 text-[10px] text-cyan-50/46 sm:grid-cols-2">{item.contractorIncumbent ? <p><strong className="text-white/75">Incumbent:</strong> {item.contractorIncumbent}</p> : null}{item.budgetSignal ? <p><strong className="text-white/75">Award/spend:</strong> {item.budgetSignal}</p> : null}{item.office || item.component ? <p><strong className="text-white/75">Office:</strong> {item.office || item.component}</p> : null}{item.medicalTravelRelevance ? <p><strong className="text-white/75">Medical:</strong> {item.medicalTravelRelevance}</p> : null}</div><div className="mt-4 flex justify-between border-t border-white/7 pt-3 text-[9px] text-cyan-100/32"><span>{item.sourceType || "stored source"}</span><span>{formatDate(item.datePosted || item.fetchedAt)}</span></div></Panel>) : <Panel className="p-8 text-center text-sm text-cyan-50/50">No stored records match this view. Change the agency or intelligence filter.</Panel>}
            </div>
          </div>
        </section>
      </> : null}
    </WorkspaceShell>
  );
}

function stateFromGeoId(id: string | number | undefined): { code: string; name: string } | null {
  if (id === undefined || id === null) return null;
  return FIPS_STATES[String(id).padStart(2, "0")] ?? null;
}

function StateMap({ selected, onSelect }: { selected: string | null; onSelect: (state: { code: string; name: string }) => void }) {
  const selectedState = useMemo(() => Object.values(FIPS_STATES).find((state) => state.code === selected) || null, [selected]);
  return <Panel className="p-4 sm:p-5"><div className="mb-3 flex items-end justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.17em] text-cyan-100/40">State intelligence map</p><h2 className="mt-1 text-lg font-black">Select a state</h2></div><p className="text-xs font-black text-white">{selectedState?.name || "United States"}</p></div><div className="overflow-hidden rounded-[28px] border border-cyan-100/24 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.12),transparent_58%),linear-gradient(145deg,rgba(255,255,255,.045),rgba(59,130,246,.06),rgba(139,92,246,.05))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.12)]"><ComposableMap projection="geoAlbersUsa" projectionConfig={{ scale: 1030 }} width={900} height={560} className="h-auto w-full" aria-label="Clickable map of United States state agencies"><Geographies geography={STATE_GEOMETRY_URL}>{({ geographies }) => geographies.map((geo) => { const state = stateFromGeoId(geo.id); const active = state?.code === selected; return <Geography key={geo.rsmKey} geography={geo} role="button" tabIndex={state ? 0 : -1} aria-label={state?.name || "State"} onClick={() => state && onSelect(state)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && state) { event.preventDefault(); onSelect(state); } }} style={{ default: { fill: active ? "rgba(165,243,252,.95)" : "rgba(125,211,252,.30)", stroke: active ? "white" : "rgba(207,250,254,.68)", strokeWidth: active ? 1.7 : .8, outline: "none", cursor: state ? "pointer" : "default", filter: active ? "drop-shadow(0 0 16px rgba(34,211,238,.8))" : "none" }, hover: { fill: "rgba(196,181,253,.82)", stroke: "white", strokeWidth: 1.3, outline: "none", cursor: "pointer" }, pressed: { fill: "white", stroke: "white", strokeWidth: 1.5, outline: "none" } }} />; })}</Geographies></ComposableMap></div></Panel>;
}

function occHealthRelevant(item: StateAgencyItem): boolean {
  const text = `${item.title} ${item.summary || ""} ${item.bucket} ${item.itemType || ""}`.toLowerCase();
  return /(pre.?employment|pre.?placement|physical exam|medical exam|fitness for duty|drug test|respirator|fit test|audiogram|hearing|immuniz|vaccin|occupational health|annual exam|medical surveillance|worker health|employee health|dot physical)/i.test(text);
}

function stateViewMatches(item: StateAgencyItem, view: string): boolean {
  const text = `${item.bucket} ${item.title} ${item.summary || ""} ${item.agency || ""}`.toLowerCase();
  if (view === "Occupational health") return occHealthRelevant(item);
  if (view === "Procurement") return /procurement|rfp|bid|solicitation|contract/.test(text);
  if (view === "Labor / OSHA") return /labor|osha|safety|worker|employment/.test(text);
  if (view === "Health department") return /health|medical|public health/.test(text);
  if (view === "Medical licensing") return /medical board|licens|physician|provider/.test(text);
  if (view === "State DOT") return /transport|dot|driver|fmcsa/.test(text);
  return true;
}

function StateRecordCard({ item }: { item: StateAgencyItem }) {
  return <Panel className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-cyan-200/12 bg-cyan-300/[0.05] px-2 py-1 text-[8px] font-black uppercase tracking-[.13em] text-cyan-100/60">{item.bucket}</span>{occHealthRelevant(item) ? <span className="rounded-full border border-emerald-200/14 bg-emerald-300/[0.05] px-2 py-1 text-[8px] font-black uppercase text-emerald-100/70">Occ health relevant</span> : null}</div><p className="mt-2 text-[10px] font-bold text-cyan-100/40">{item.agency || item.stateCode}</p><h3 className="mt-1 text-base font-black leading-6">{item.title}</h3></div>{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/8 p-2 text-cyan-100/45 hover:text-white" aria-label={`Open ${item.title}`}><ExternalLink size={15} /></a> : null}</div><p className="mt-3 text-xs leading-6 text-cyan-50/58">{item.summary || "No summary stored."}</p><div className="mt-4 flex justify-between border-t border-white/7 pt-3 text-[9px] text-cyan-100/32"><span>{item.itemType || "state intelligence"} · relevance {item.relevanceScore ?? "—"}</span><span>{formatDate(item.publishedDate || item.fetchedAt)}</span></div></Panel>;
}

function OfficialStateSources({ profile }: { profile: StateProfile }) {
  const links = [
    ["Governor / agencies", profile.govUrl], ["Health department", profile.healthDeptUrl], ["Labor", profile.laborUrl], ["Procurement", profile.procurementUrl], ["Legislature", profile.legislatureUrl], ["Medical board", profile.medicalBoardUrl], ["State DOT", profile.dotUrl], ["Insurance", profile.insuranceDeptUrl], ["Emergency management", profile.emergencyMgmtUrl], ["Corrections", profile.correctionsUrl], ["POST", profile.postCommissionUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-cyan-200/18 hover:bg-cyan-300/[0.04]"><p className="text-xs font-black text-white">{label}</p><p className="mt-1 truncate text-[9px] text-cyan-100/34">{url}</p></a>)}</div>;
}

function carrierAddress(carrier: FmcsaCarrier): string {
  return [carrier.physicalAddress.street, carrier.physicalAddress.city, carrier.physicalAddress.state, carrier.physicalAddress.zip, carrier.physicalAddress.country].filter(Boolean).join(", ") || "Address not reported";
}

function FmcsaLookup({ state }: { state: { code: string; name: string } }) {
  const [status, setStatus] = useState<FmcsaStatus | null>(null);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<FmcsaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let cancelled = false; void getJson<FmcsaStatus>("core-intelligence/fmcsa/status").then((payload) => { if (!cancelled) setStatus(payload); }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to read FMCSA status."); }); return () => { cancelled = true; }; }, []);
  async function submit(event: FormEvent) { event.preventDefault(); const value = query.trim(); if (value.length < 2) return; setLoading(true); setError(""); setResponse(null); try { const params = new URLSearchParams({ stateCode: state.code }); if (/^\d[\d\s-]*$/.test(value)) params.set("dotNumber", value.replace(/\D/g, "")); else params.set("name", value); setResponse(await getJson<FmcsaResponse>(`core-intelligence/fmcsa/carriers?${params.toString()}`)); } catch (err) { setError(err instanceof Error ? err.message : "FMCSA lookup failed."); } finally { setLoading(false); } }
  return <section><Panel className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Truck size={18} className="text-cyan-200/60" /><h3 className="text-base font-black">FMCSA carrier lookup</h3></div><p className="mt-2 text-xs text-cyan-50/50">Official FMCSA API search by legal name, DBA name, or USDOT number; name results are filtered to {state.name}.</p></div><span className={cn("rounded-full border px-3 py-1.5 text-[9px] font-black uppercase", status?.configured ? "border-emerald-200/20 text-emerald-100" : "border-amber-200/20 text-amber-100")}>{status?.configured ? "FMCSA API ready" : "Checking API"}</span></div><form onSubmit={submit} className="mt-4 flex gap-3"><label className="flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4"><Search size={15} className="text-cyan-100/45" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Carrier legal name, DBA, or USDOT…" className="w-full bg-transparent text-xs text-white outline-none" /></label><button disabled={loading || query.trim().length < 2 || status?.configured === false} className="rounded-xl border border-cyan-200/18 bg-cyan-300/[0.08] px-4 text-xs font-black disabled:opacity-40">{loading ? "Loading…" : "Search FMCSA"}</button></form></Panel>{error ? <Panel className="mt-3 border-rose-200/20 p-4 text-xs text-rose-100">{error}</Panel> : null}{response ? <div className="mt-3 grid gap-3 xl:grid-cols-2">{response.records.map((carrier, index) => <Panel key={`${carrier.dotNumber}-${index}`} className="p-5"><div className="flex justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-cyan-100/36">USDOT {carrier.dotNumber || "—"}</p><h3 className="mt-1 text-base font-black">{carrier.legalName || carrier.dbaName || "Carrier"}</h3>{carrier.dbaName && carrier.dbaName !== carrier.legalName ? <p className="mt-1 text-[10px] text-cyan-50/42">DBA {carrier.dbaName}</p> : null}</div><span className="text-[9px] text-cyan-50/42">{carrier.allowedToOperate || "status unknown"}</span></div><div className="mt-4 space-y-2 text-xs text-cyan-50/52"><p className="flex gap-2"><MapPin size={14} className="shrink-0" />{carrierAddress(carrier)}</p>{carrier.telephone ? <p className="flex gap-2"><Phone size={14} className="shrink-0" />{carrier.telephone}</p> : null}</div></Panel>)}</div> : null}</section>;
}

export function StateAgenciesPage() {
  const [profiles, setProfiles] = useState<StateProfile[]>([]);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [items, setItems] = useState<StateAgencyItem[]>([]);
  const [nationalItems, setNationalItems] = useState<StateAgencyItem[]>([]);
  const [crossState, setCrossState] = useState<StateIntelItem[]>([]);
  const [view, setView] = useState<string>(STATE_VIEWS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pulse = useLiveSearch("state");

  useEffect(() => { let cancelled = false; Promise.all([getJson<{ states: StateProfile[] }>("state-agencies/states"), getJson<{ items: StateIntelItem[] }>("state-agencies/intel?limit=200"), getJson<{ items: StateAgencyItem[] }>("state-agencies/items?limit=500")]).then(([statePayload, intelPayload, itemPayload]) => { if (!cancelled) { setProfiles(statePayload.states); setCrossState(intelPayload.items); setNationalItems(itemPayload.items); } }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load state directory."); }); return () => { cancelled = true; }; }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true); setError(""); setItems([]); pulse.reset();
    void getJson<{ items: StateAgencyItem[] }>(`state-agencies/items?stateCode=${selected.code}&limit=500`).then((payload) => { if (!cancelled) setItems(payload.items); }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load stored state intelligence."); }).finally(() => { if (!cancelled) setLoading(false); });
    void pulse.run("pre-employment medical exams annual employee physicals occupational health fitness for duty drug testing respirator hearing medical surveillance", "occupational health regulatory requirements compliance updates", "oneYear", selected.name);
    return () => { cancelled = true; };
  // pulse is intentionally excluded so state selection, not hook identity, controls refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.code]);

  const profile = selected ? profiles.find((entry) => entry.stateCode === selected.code) || null : null;
  const relevant = items.filter(occHealthRelevant);
  const visible = items.filter((item) => stateViewMatches(item, view));
  const latestStored = [...items].sort((a, b) => new Date(b.publishedDate || b.fetchedAt || 0).getTime() - new Date(a.publishedDate || a.fetchedAt || 0).getTime())[0];
  const crossForState = selected ? crossState.filter((item) => !item.affectedStates || item.affectedStates.includes(selected.code) || item.affectedStates.toLowerCase().includes(selected.name.toLowerCase())) : [];
  const nationalOccHealth = nationalItems.filter(occHealthRelevant);
  const nationalProcurement = nationalItems.filter((item) => stateViewMatches(item, "Procurement"));
  const statePlanCount = profiles.filter((item) => item.oshaStatePlan === "full").length;
  const topStates = [...profiles].filter((item) => item.itemCount > 0).sort((a, b) => b.itemCount - a.itemCount).slice(0, 6);
  const recentNational = [...nationalItems].sort((a, b) => new Date(b.publishedDate || b.fetchedAt || 0).getTime() - new Date(a.publishedDate || a.fetchedAt || 0).getTime()).slice(0, 6);

  return (
    <WorkspaceShell eyebrow="State compliance intelligence" title="State Agencies" subtitle="Select a state and the app immediately loads its official-source directory, stored regulatory/procurement intelligence, occupational-health signals, cross-state alerts, and a current compliance scan.">
      <StateMap selected={selected?.code || null} onSelect={(state) => { setSelected(state); setView("Compliance pulse"); }} />
      {!selected ? <section className="mt-5 space-y-5" aria-label="National state-agency intelligence"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["States with intelligence", profiles.filter((item) => item.itemCount > 0).length, "stored state coverage"],["Stored state records", nationalItems.length, "loaded automatically"],["Occupational-health signals", nationalOccHealth.length, "medical / workforce evidence"],["Procurement signals", nationalProcurement.length, "bids, RFPs, contracts"],["OSHA state plans", statePlanCount, `${profiles.length - statePlanCount} federal / other`]].map(([label,value,note]) => <Panel key={String(label)} className="p-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/38">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-[10px] text-cyan-50/42">{note}</p></Panel>)}</div><div className="grid gap-5 xl:grid-cols-2"><Panel className="p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/40">Top states by stored activity</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{topStates.map((state) => <button key={state.stateCode} type="button" onClick={() => setSelected({ code: state.stateCode, name: state.stateName })} className="rounded-xl border border-white/8 bg-white/[.025] p-3 text-left"><span className="font-black">{state.stateName}</span><span className="float-right text-cyan-100/55">{state.itemCount}</span></button>)}</div></Panel><Panel className="p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-100/45">Latest national state signals</p><div className="mt-3 space-y-2">{recentNational.map((item) => <div key={item.id} className="rounded-xl border border-white/8 p-3"><p className="text-[9px] text-cyan-100/42">{item.stateCode} · {item.bucket} · {formatDate(item.publishedDate || item.fetchedAt)}</p><p className="mt-1 text-xs font-black">{item.title}</p></div>)}</div></Panel></div></section> : null}
      {selected ? <section className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["State", selected.name, profile?.region || "US state", MapPin],
            ["Stored records", items.length.toLocaleString(), "state intelligence", Activity],
            ["Occ-health relevant", relevant.length.toLocaleString(), "exam / surveillance signals", HeartPulse],
            ["OSHA coverage", profile?.oshaStatePlan === "full" ? "State plan" : profile?.oshaStatePlan === "federal" ? "Federal OSHA" : profile?.oshaStatePlan || "Unknown", "jurisdiction", ShieldCheck],
            ["Current web pulse", pulse.loading ? "Scanning" : String(pulse.response?.returned ?? 0), "recent public-source leads", Radar],
          ].map(([label, value, note, Icon]) => <Panel key={String(label)} className="p-4"><Icon size={15} className="text-cyan-200/55" /><p className="mt-3 text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/36">{String(label)}</p><p className="mt-1 text-xl font-black">{String(value)}</p><p className="mt-1 text-[9px] text-cyan-50/36">{String(note)}</p></Panel>)}
        </div>
        <div className="mt-4"><Tabs values={STATE_VIEWS} active={view} onChange={setView} /></div>

        {view === "FMCSA / DOT Carrier Lookup" ? <div className="mt-3"><FmcsaLookup state={selected} /></div> : null}
        {view === "Official sources" && profile ? <Panel className="mt-3 p-5"><div className="mb-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">Official state directory</p><h2 className="mt-1 text-lg font-black">{selected.name} source portals</h2></div><OfficialStateSources profile={profile} /></Panel> : null}

        {view !== "FMCSA / DOT Carrier Lookup" && view !== "Official sources" ? <>
          <Panel className="mt-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">{view === "Compliance pulse" ? "State compliance pulse" : view}</p><h2 className="mt-1 text-lg font-black">{selected.name}</h2><p className="mt-1 text-xs text-cyan-50/48">Stored intelligence is shown first. The live scan is automatic and clearly separated below.</p></div><div className="text-right text-[10px] text-cyan-50/36"><p>Latest stored pull</p><p className="mt-1 font-bold text-white/70">{formatDate(latestStored?.publishedDate || latestStored?.fetchedAt)}</p></div></div>
          </Panel>
          {loading ? <Panel className="mt-3 flex min-h-36 items-center justify-center gap-3 text-xs text-cyan-50/58"><Loader2 size={16} className="animate-spin" />Loading stored state intelligence…</Panel> : null}
          {error ? <Panel className="mt-3 border-rose-200/20 p-4 text-xs text-rose-100">{error}</Panel> : null}
          {!loading && !error ? <div className="mt-3 grid gap-3 2xl:grid-cols-2">{visible.length ? visible.slice(0, 30).map((item) => <StateRecordCard key={item.id} item={item} />) : <Panel className="p-6 text-center text-xs text-cyan-50/44">No persisted {view.toLowerCase()} records are stored for {selected.name} yet. The live regulatory pulse below fills that gap automatically.</Panel>}</div> : null}

          {crossForState.length ? <Panel className="mt-4 p-5"><p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-100/40">Cross-state alerts affecting {selected.name}</p><div className="mt-3 grid gap-2 lg:grid-cols-2">{crossForState.slice(0, 8).map((item) => <a key={item.id} href={item.url || "#"} target={item.url ? "_blank" : undefined} rel={item.url ? "noreferrer" : undefined} className="rounded-xl border border-white/7 bg-white/[0.02] p-3"><p className="text-xs font-black">{item.title}</p><p className="mt-1 text-[10px] leading-5 text-cyan-50/42">{item.summary}</p></a>)}</div></Panel> : null}

          <Panel className="mt-4 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">Automatic current scan</p><h2 className="mt-1 text-lg font-black">Recent occupational-health compliance leads</h2></div><Clock3 size={18} className="text-cyan-200/45" /></div><p className="mt-2 text-xs leading-5 text-cyan-50/46">Pre-employment and annual medical exams, fitness-for-duty, drug testing, respirator/hearing requirements, medical surveillance, and related state rules are scanned automatically. Public-web leads still require source review before operational use.</p></Panel>
          <SearchResults response={pulse.response} loading={pulse.loading} error={pulse.error} />
        </> : null}
      </section> : null}
    </WorkspaceShell>
  );
}
