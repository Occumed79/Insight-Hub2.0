import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import {
  Activity,
  ArrowLeft,
  Building2,
  Clock3,
  ExternalLink,
  FileText,
  HeartPulse,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  Radar,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}/api/${path.replace(/^\//, "")}`;
const STATE_GEOMETRY_URL = api("core-intelligence/state-map-geometry");

const VIEWS = [
  "Compliance pulse",
  "Occupational health",
  "Procurement",
  "Labor / OSHA",
  "Health department",
  "State DOT",
  "Medical licensing",
  "Workers' comp / insurance",
  "Official sources",
  "FMCSA / DOT Carrier Lookup",
] as const;
type View = typeof VIEWS[number];

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

type FmcsaCarrier = {
  dotNumber: string | null;
  legalName: string | null;
  dbaName: string | null;
  allowedToOperate: string | null;
  physicalAddress: { street: string | null; city: string | null; state: string | null; zip: string | null; country: string | null };
  telephone: string | null;
};

type FmcsaStatus = { configured: boolean; source: string; limitation?: string };
type FmcsaResponse = { records: FmcsaCarrier[]; returned: number; source: string; limitation?: string };

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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(api(path), { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `Request failed with HTTP ${response.status}`);
  return payload as T;
}

function formatDate(value?: string | null) {
  if (!value) return "Date not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function stateFromGeoId(id: string | number | undefined) {
  if (id === undefined || id === null) return null;
  return FIPS_STATES[String(id).padStart(2, "0")] || null;
}

function occHealthRelevant(item: StateAgencyItem) {
  const text = `${item.title} ${item.summary || ""} ${item.bucket} ${item.itemType || ""}`.toLowerCase();
  return /(pre.?employment|pre.?placement|physical exam|medical exam|fitness for duty|drug test|respirator|fit test|audiogram|hearing|immuniz|vaccin|occupational health|annual exam|medical surveillance|worker health|employee health|dot physical)/i.test(text);
}

function matchesView(item: StateAgencyItem, view: View) {
  const text = `${item.bucket} ${item.title} ${item.summary || ""} ${item.agency || ""} ${item.itemType || ""}`.toLowerCase();
  if (view === "Occupational health") return occHealthRelevant(item);
  if (view === "Procurement") return /procurement|rfp|bid|solicitation|contract|award/.test(text);
  if (view === "Labor / OSHA") return /labor|osha|safety|worker|employment|industrial hygiene/.test(text);
  if (view === "Health department") return /health department|public health|medical|health services/.test(text);
  if (view === "State DOT") return /transport|department of transportation|\bdot\b|driver|fmcsa/.test(text);
  if (view === "Medical licensing") return /medical board|licens|physician|provider|nursing board/.test(text);
  if (view === "Workers' comp / insurance") return /workers.? comp|work comp|insurance|self-insur|claim|benefit/.test(text);
  return true;
}

function sourceLinks(profile: StateProfile) {
  return [
    ["State government", profile.govUrl],
    ["Health department", profile.healthDeptUrl],
    ["Labor / OSHA", profile.laborUrl],
    ["Procurement", profile.procurementUrl],
    ["Medical board", profile.medicalBoardUrl],
    ["State DOT", profile.dotUrl],
    ["Insurance / workers' comp", profile.insuranceDeptUrl],
    ["Legislature", profile.legislatureUrl],
    ["Emergency management", profile.emergencyMgmtUrl],
    ["Corrections", profile.correctionsUrl],
    ["POST / public safety", profile.postCommissionUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function StateMap({ selected, onSelect }: { selected: string | null; onSelect: (state: { code: string; name: string }) => void }) {
  return (
    <section className="border border-white/8 bg-[#06101a]/78">
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">State intelligence map</p>
          <h2 className="mt-1 text-lg font-semibold text-white">United States</h2>
        </div>
        <p className="text-[11px] text-slate-400">Select a state to open its profile</p>
      </div>
      <div className="bg-[#030911] p-3">
        <ComposableMap projection="geoAlbersUsa" projectionConfig={{ scale: 1030 }} width={900} height={560} className="h-auto w-full" aria-label="Clickable map of United States state agencies">
          <Geographies geography={STATE_GEOMETRY_URL}>
            {({ geographies }) => geographies.map((geo) => {
              const state = stateFromGeoId(geo.id);
              const active = state?.code === selected;
              return <Geography key={geo.rsmKey} geography={geo} role="button" tabIndex={state ? 0 : -1} aria-label={state?.name || "State"} onClick={() => state && onSelect(state)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && state) { event.preventDefault(); onSelect(state); } }} style={{
                default: { fill: active ? "#d9f7ff" : "#173044", stroke: active ? "#ffffff" : "#6d8798", strokeWidth: active ? 1.5 : .65, outline: "none", cursor: state ? "pointer" : "default" },
                hover: { fill: "#8dd8eb", stroke: "#ffffff", strokeWidth: 1.1, outline: "none", cursor: "pointer" },
                pressed: { fill: "#ffffff", stroke: "#ffffff", strokeWidth: 1.3, outline: "none" },
              }} />;
            })}
          </Geographies>
        </ComposableMap>
      </div>
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="border-r border-white/8 px-4 py-3 last:border-r-0"><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold tracking-[-.02em] text-white">{value}</p><p className="mt-1 text-[10px] text-slate-500">{note}</p></div>;
}

function RecordTable({ items }: { items: StateAgencyItem[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[820px] border-collapse text-left"><thead><tr className="border-b border-white/10 text-[9px] uppercase tracking-[.12em] text-slate-500"><th className="px-4 py-3">Agency / source</th><th className="px-4 py-3">Intelligence</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Relevance</th><th className="px-4 py-3">Date</th><th className="w-12 px-4 py-3" /></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-white/[.055] align-top hover:bg-white/[.02]"><td className="px-4 py-4 text-[10px] font-medium text-slate-400">{item.agency || item.stateCode}</td><td className="max-w-[520px] px-4 py-4"><p className="text-[12px] font-semibold leading-5 text-white">{item.title}</p><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-500">{item.summary || "No stored summary."}</p>{occHealthRelevant(item) ? <span className="mt-2 inline-block text-[9px] font-semibold uppercase tracking-[.1em] text-emerald-300/80">Occupational-health relevant</span> : null}</td><td className="px-4 py-4 text-[10px] text-slate-400">{item.itemType || item.bucket}</td><td className="px-4 py-4 text-[10px] font-semibold text-slate-300">{item.relevanceScore ?? "—"}</td><td className="whitespace-nowrap px-4 py-4 text-[10px] text-slate-500">{formatDate(item.publishedDate || item.fetchedAt)}</td><td className="px-4 py-4">{item.url ? <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`} className="text-slate-500 hover:text-white"><ExternalLink size={14} /></a> : null}</td></tr>)}</tbody></table></div>;
}

function SourceDirectory({ profile }: { profile: StateProfile }) {
  const links = sourceLinks(profile);
  return <div className="divide-y divide-white/8 border-y border-white/8">{links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 px-1 py-3 text-[11px] text-slate-300 hover:text-white"><span>{label}</span><ExternalLink size={13} className="shrink-0 text-slate-600" /></a>)}</div>;
}

function PulseResults({ response, loading, error }: { response: LiveSearchResponse | null; loading: boolean; error: string }) {
  if (loading) return <div className="flex min-h-28 items-center justify-center gap-2 border-t border-white/8 text-[11px] text-slate-400"><Loader2 size={14} className="animate-spin" />Scanning current public sources…</div>;
  if (error) return <div className="border-t border-rose-300/15 px-4 py-4 text-[11px] text-rose-200/80">{error}</div>;
  if (!response) return null;
  return <div className="divide-y divide-white/8 border-t border-white/8">{response.results.slice(0, 12).map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="block px-4 py-4 hover:bg-white/[.02]"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-slate-500">{item.siteName}</p><p className="mt-1 text-[11px] font-semibold leading-5 text-white">{item.title}</p><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-500">{item.summary || item.snippet}</p></div><ExternalLink size={13} className="mt-1 shrink-0 text-slate-600" /></div></a>)}</div>;
}

function FmcsaLookup({ state }: { state: { code: string; name: string } }) {
  const [status, setStatus] = useState<FmcsaStatus | null>(null);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<FmcsaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let cancelled = false; void getJson<FmcsaStatus>("core-intelligence/fmcsa/status").then((value) => { if (!cancelled) setStatus(value); }).catch(() => undefined); return () => { cancelled = true; }; }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    setLoading(true); setError(""); setResponse(null);
    try {
      const params = new URLSearchParams({ stateCode: state.code });
      if (/^\d[\d\s-]*$/.test(value)) params.set("dotNumber", value.replace(/\D/g, "")); else params.set("name", value);
      setResponse(await getJson<FmcsaResponse>(`core-intelligence/fmcsa/carriers?${params.toString()}`));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "FMCSA lookup failed."); }
    finally { setLoading(false); }
  }
  return <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"><section className="border border-white/8 bg-[#06101a]/72 p-5"><div className="flex items-center gap-2"><Truck size={16} className="text-sky-300/70" /><h2 className="text-sm font-semibold">FMCSA carrier lookup</h2></div><p className="mt-2 text-[10px] leading-5 text-slate-500">Optional official carrier lookup for {state.name}. This is a secondary tool, not the primary State Agencies experience.</p><form onSubmit={submit} className="mt-5 space-y-3"><label className="flex h-11 items-center gap-3 border border-white/10 bg-black/20 px-3"><Search size={14} className="text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Carrier, DBA, or USDOT" className="w-full bg-transparent text-xs text-white outline-none" /></label><button disabled={loading || query.trim().length < 2 || status?.configured === false} className="h-10 w-full border border-sky-300/20 bg-sky-300/[.06] text-[11px] font-semibold text-sky-100 disabled:opacity-40">{loading ? "Searching…" : "Search FMCSA"}</button></form>{error ? <p className="mt-4 text-[10px] text-rose-200/80">{error}</p> : null}</section><section className="border border-white/8 bg-[#06101a]/72"><div className="border-b border-white/8 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Official results</p></div>{response?.records?.length ? <div className="divide-y divide-white/8">{response.records.map((carrier, index) => <div key={`${carrier.dotNumber}-${index}`} className="px-5 py-4"><div className="flex justify-between gap-4"><div><p className="text-[9px] uppercase tracking-[.12em] text-slate-500">USDOT {carrier.dotNumber || "—"}</p><h3 className="mt-1 text-sm font-semibold text-white">{carrier.legalName || carrier.dbaName || "Carrier"}</h3>{carrier.dbaName && carrier.dbaName !== carrier.legalName ? <p className="mt-1 text-[10px] text-slate-500">DBA {carrier.dbaName}</p> : null}</div><span className="text-[10px] text-slate-400">{carrier.allowedToOperate || "status unknown"}</span></div><p className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><MapPin size={12} />{[carrier.physicalAddress.street, carrier.physicalAddress.city, carrier.physicalAddress.state, carrier.physicalAddress.zip].filter(Boolean).join(", ") || "Address not reported"}</p>{carrier.telephone ? <p className="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><Phone size={12} />{carrier.telephone}</p> : null}</div>)}</div> : <div className="grid min-h-48 place-items-center p-8 text-center text-[10px] text-slate-600">Run an optional carrier lookup to populate this pane.</div>}</section></div>;
}

export default function StateAgenciesPage() {
  const [profiles, setProfiles] = useState<StateProfile[]>([]);
  const [nationalItems, setNationalItems] = useState<StateAgencyItem[]>([]);
  const [crossState, setCrossState] = useState<StateIntelItem[]>([]);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [items, setItems] = useState<StateAgencyItem[]>([]);
  const [view, setView] = useState<View>("Compliance pulse");
  const [loading, setLoading] = useState(true);
  const [stateLoading, setStateLoading] = useState(false);
  const [error, setError] = useState("");
  const [pulse, setPulse] = useState<LiveSearchResponse | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [pulseError, setPulseError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getJson<{ states: StateProfile[] }>("state-agencies/states"),
      getJson<{ items: StateIntelItem[] }>("state-agencies/intel?limit=200"),
      getJson<{ items: StateAgencyItem[] }>("state-agencies/items?limit=500"),
    ]).then(([statePayload, intelPayload, itemPayload]) => {
      if (cancelled) return;
      setProfiles(statePayload.states || []);
      setCrossState(intelPayload.items || []);
      setNationalItems(itemPayload.items || []);
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load state intelligence."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setStateLoading(true); setError(""); setItems([]); setPulse(null); setPulseError(""); setPulseLoading(true);
    void getJson<{ items: StateAgencyItem[] }>(`state-agencies/items?stateCode=${selected.code}&limit=500`).then((payload) => { if (!cancelled) setItems(payload.items || []); }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load state intelligence."); }).finally(() => { if (!cancelled) setStateLoading(false); });
    const params = new URLSearchParams({ workspace: "state", query: "pre-employment medical exams annual employee physicals occupational health fitness for duty drug testing respirator hearing medical surveillance", category: "occupational health regulatory requirements compliance updates", freshness: "oneYear", state: selected.name });
    void getJson<LiveSearchResponse>(`core-intelligence/live-search?${params.toString()}`).then((payload) => { if (!cancelled) setPulse(payload); }).catch((reason) => { if (!cancelled) setPulseError(reason instanceof Error ? reason.message : "Current compliance scan failed."); }).finally(() => { if (!cancelled) setPulseLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.code]);

  const profile = selected ? profiles.find((item) => item.stateCode === selected.code) || null : null;
  const nationalOccHealth = useMemo(() => nationalItems.filter(occHealthRelevant), [nationalItems]);
  const nationalProcurement = useMemo(() => nationalItems.filter((item) => matchesView(item, "Procurement")), [nationalItems]);
  const statesWithIntel = profiles.filter((item) => item.itemCount > 0).length;
  const statePlanCount = profiles.filter((item) => item.oshaStatePlan === "full").length;
  const rankedStates = [...profiles].sort((a, b) => b.itemCount - a.itemCount);
  const latestNational = [...nationalItems].sort((a, b) => new Date(b.publishedDate || b.fetchedAt || 0).getTime() - new Date(a.publishedDate || a.fetchedAt || 0).getTime()).slice(0, 10);
  const visible = items.filter((item) => matchesView(item, view));
  const occHealth = items.filter(occHealthRelevant);
  const latestStored = [...items].sort((a, b) => new Date(b.publishedDate || b.fetchedAt || 0).getTime() - new Date(a.publishedDate || a.fetchedAt || 0).getTime())[0];
  const crossForState = selected ? crossState.filter((item) => !item.affectedStates || item.affectedStates.includes(selected.code) || item.affectedStates.toLowerCase().includes(selected.name.toLowerCase())) : [];

  function chooseState(state: { code: string; name: string }) {
    setSelected(state);
    setView("Compliance pulse");
  }

  return (
    <main className="min-h-screen bg-[#03080f] text-slate-100">
      <Sidebar />
      <section className="min-h-screen lg:ml-[210px]">
        <header className="border-b border-white/8 bg-[#060b12]/95 px-6 py-6 xl:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Public intelligence / state compliance</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-3xl font-semibold tracking-[-.035em] text-white">State Agencies</h1><p className="mt-2 max-w-4xl text-[12px] leading-6 text-slate-400">State-by-state occupational-health, labor, procurement, licensing, transportation, insurance and compliance intelligence. The workspace loads national intelligence before selection and state intelligence immediately after selection.</p></div>
            {selected ? <button type="button" onClick={() => setSelected(null)} className="inline-flex h-9 items-center gap-2 border border-white/10 px-3 text-[11px] font-semibold text-slate-300 hover:bg-white/[.04]"><ArrowLeft size={13} />National view</button> : null}
          </div>
        </header>

        {error ? <div className="border-b border-rose-300/15 bg-rose-400/[.035] px-6 py-3 text-[11px] text-rose-200/80">{error}</div> : null}

        {loading ? <div className="grid min-h-[560px] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-sky-300" /><p className="mt-3 text-[11px] text-slate-500">Loading state intelligence…</p></div></div> : null}

        {!loading && !selected ? <div className="p-5 xl:p-8" aria-label="National state-agency intelligence">
          <div className="grid border border-white/8 bg-[#060d15]/72 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="States with intelligence" value={statesWithIntel} note="stored state coverage" />
            <Metric label="Stored state records" value={nationalItems.length.toLocaleString()} note="loaded automatically" />
            <Metric label="Occupational-health signals" value={nationalOccHealth.length.toLocaleString()} note="medical / workforce evidence" />
            <Metric label="Procurement signals" value={nationalProcurement.length.toLocaleString()} note="bids, RFPs, contracts" />
            <Metric label="OSHA state plans" value={statePlanCount} note={`${Math.max(0, profiles.length - statePlanCount)} federal / other`} />
          </div>

          <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
            <StateMap selected={null} onSelect={chooseState} />
            <section className="border border-white/8 bg-[#060d15]/72">
              <div className="border-b border-white/8 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">State activity ranking</p><h2 className="mt-1 text-lg font-semibold text-white">Prepared intelligence library</h2></div>
              <div className="max-h-[650px] overflow-y-auto"><table className="w-full text-left"><thead className="sticky top-0 bg-[#060d15] text-[9px] uppercase tracking-[.12em] text-slate-600"><tr><th className="px-4 py-3">State</th><th className="px-4 py-3 text-right">Records</th><th className="px-4 py-3">OSHA</th></tr></thead><tbody>{rankedStates.map((state) => <tr key={state.stateCode} onClick={() => chooseState({ code: state.stateCode, name: state.stateName })} className="cursor-pointer border-t border-white/[.055] text-[11px] hover:bg-white/[.025]"><td className="px-4 py-3 font-semibold text-white">{state.stateName}</td><td className="px-4 py-3 text-right font-semibold text-slate-300">{state.itemCount}</td><td className="px-4 py-3 text-slate-500">{state.oshaStatePlan === "full" ? "State plan" : state.oshaStatePlan === "federal" ? "Federal" : state.oshaStatePlan || "—"}</td></tr>)}</tbody></table></div>
            </section>
          </div>

          <section className="mt-5 border border-white/8 bg-[#060d15]/72">
            <div className="flex items-end justify-between border-b border-white/8 px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Latest national state signals</p><h2 className="mt-1 text-lg font-semibold text-white">Recent intelligence across states</h2></div><span className="text-[10px] text-slate-500">No search required</span></div>
            <RecordTable items={latestNational} />
          </section>
        </div> : null}

        {!loading && selected ? <div className="p-5 xl:p-8">
          <div className="border border-white/8 bg-[#060d15]/72">
            <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/8 px-5 py-5">
              <div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center border border-sky-300/20 bg-sky-300/[.05] text-sm font-bold text-sky-100">{selected.code}</div><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">State profile</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.025em] text-white">{selected.name}</h2><p className="mt-1 text-[11px] text-slate-500">{profile?.region || "United States"} · {profile?.oshaStatePlan === "full" ? "OSHA state plan" : profile?.oshaStatePlan === "federal" ? "Federal OSHA jurisdiction" : profile?.oshaStatePlan || "OSHA status not recorded"}</p></div></div>
              <div className="text-right"><p className="text-[9px] uppercase tracking-[.12em] text-slate-600">Latest stored pull</p><p className="mt-1 text-[11px] font-semibold text-slate-300">{formatDate(latestStored?.publishedDate || latestStored?.fetchedAt)}</p></div>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-5"><Metric label="Stored records" value={items.length.toLocaleString()} note="state intelligence" /><Metric label="Occ-health relevant" value={occHealth.length.toLocaleString()} note="exam / surveillance signals" /><Metric label="OSHA coverage" value={profile?.oshaStatePlan === "full" ? "State plan" : profile?.oshaStatePlan === "federal" ? "Federal" : profile?.oshaStatePlan || "Unknown"} note="jurisdiction" /><Metric label="Cross-state alerts" value={crossForState.length.toLocaleString()} note="affecting this state" /><Metric label="Current web pulse" value={pulseLoading ? "Scanning" : String(pulse?.returned ?? 0)} note="public-source leads" /></div>
          </div>

          <nav className="mt-5 flex gap-5 overflow-x-auto border-b border-white/10" aria-label="State intelligence views">{VIEWS.map((item) => <button key={item} type="button" onClick={() => setView(item)} className={cn("shrink-0 border-b-2 px-0.5 py-3 text-[11px] font-semibold transition", view === item ? "border-sky-300 text-white" : "border-transparent text-slate-500 hover:text-slate-300")}>{item}</button>)}</nav>

          {view === "FMCSA / DOT Carrier Lookup" ? <div className="mt-5"><FmcsaLookup state={selected} /></div> : null}

          {view === "Official sources" && profile ? <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><section className="border border-white/8 bg-[#060d15]/72"><div className="border-b border-white/8 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Official source directory</p><h2 className="mt-1 text-lg font-semibold text-white">{selected.name} source portals</h2></div><div className="grid gap-px bg-white/8 sm:grid-cols-2 lg:grid-cols-3">{sourceLinks(profile).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="bg-[#060d15] p-5 hover:bg-white/[.025]"><Landmark size={15} className="text-sky-300/60" /><p className="mt-3 text-[12px] font-semibold text-white">{label}</p><p className="mt-1 truncate text-[9px] text-slate-600">{url}</p></a>)}</div></section><aside className="border border-white/8 bg-[#060d15]/72 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">State profile</p><div className="mt-4 divide-y divide-white/8 text-[11px]"><div className="flex justify-between py-3"><span className="text-slate-500">Region</span><span className="font-semibold text-slate-300">{profile.region || "—"}</span></div><div className="flex justify-between py-3"><span className="text-slate-500">Stored records</span><span className="font-semibold text-slate-300">{profile.itemCount}</span></div><div className="flex justify-between py-3"><span className="text-slate-500">OSHA</span><span className="font-semibold text-slate-300">{profile.oshaStatePlan || "—"}</span></div><div className="flex justify-between py-3"><span className="text-slate-500">Source portals</span><span className="font-semibold text-slate-300">{sourceLinks(profile).length}</span></div></div></aside></div> : null}

          {view !== "Official sources" && view !== "FMCSA / DOT Carrier Lookup" ? <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_330px]">
            <section className="min-w-0 border border-white/8 bg-[#060d15]/72">
              <div className="flex items-end justify-between gap-4 border-b border-white/8 px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">{view === "Compliance pulse" ? "State compliance pulse" : view}</p><h2 className="mt-1 text-lg font-semibold text-white">{selected.name}</h2></div><span className="text-[10px] text-slate-500">{visible.length.toLocaleString()} loaded records</span></div>
              {stateLoading ? <div className="flex min-h-40 items-center justify-center gap-2 text-[11px] text-slate-500"><Loader2 size={14} className="animate-spin" />Loading stored state intelligence…</div> : visible.length ? <RecordTable items={visible.slice(0, 100)} /> : <div className="grid min-h-40 place-items-center px-6 text-center text-[11px] text-slate-600">No persisted {view.toLowerCase()} records are stored for {selected.name} yet.</div>}
            </section>

            <aside className="space-y-5">
              <section className="border border-white/8 bg-[#060d15]/72 p-5"><div className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-300/70" /><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">State source profile</p></div>{profile ? <div className="mt-4"><SourceDirectory profile={profile} /></div> : <p className="mt-4 text-[10px] text-slate-600">Source profile unavailable.</p>}</section>
              <section className="border border-white/8 bg-[#060d15]/72"><div className="border-b border-white/8 px-5 py-4"><div className="flex items-center gap-2"><Radar size={15} className="text-violet-300/70" /><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Cross-state alerts</p></div></div>{crossForState.length ? <div className="divide-y divide-white/8">{crossForState.slice(0, 8).map((item) => <a key={item.id} href={item.url || "#"} target={item.url ? "_blank" : undefined} rel={item.url ? "noreferrer" : undefined} className="block px-5 py-4 hover:bg-white/[.02]"><p className="text-[11px] font-semibold leading-5 text-white">{item.title}</p><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-500">{item.summary}</p></a>)}</div> : <div className="p-5 text-[10px] text-slate-600">No cross-state alerts currently stored for this state.</div>}</section>
            </aside>
          </div> : null}

          {view !== "FMCSA / DOT Carrier Lookup" ? <section className="mt-5 border border-white/8 bg-[#060d15]/72"><div className="flex items-start justify-between gap-4 px-5 py-4"><div><div className="flex items-center gap-2"><Clock3 size={15} className="text-sky-300/70" /><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Automatic current scan</p></div><h2 className="mt-2 text-lg font-semibold text-white">Recent occupational-health compliance leads</h2><p className="mt-2 max-w-4xl text-[10px] leading-5 text-slate-500">Pre-employment and annual medical exams, fitness-for-duty, drug testing, respirator/hearing requirements, medical surveillance and related state rules are scanned automatically. Public-web leads remain separated from stored state records.</p></div><HeartPulse size={18} className="shrink-0 text-sky-300/45" /></div><PulseResults response={pulse} loading={pulseLoading} error={pulseError} /></section> : null}
        </div> : null}
      </section>
    </main>
  );
}
