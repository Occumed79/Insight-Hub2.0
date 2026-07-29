import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import {
  CalendarDays,
  ExternalLink,
  Globe2,
  Landmark,
  Loader2,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  X,
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

const FRESHNESS_OPTIONS: Array<[Freshness, string]> = [
  ["oneWeek", "Past week"],
  ["oneMonth", "Past month"],
  ["oneYear", "Past year"],
  ["noLimit", "Any time"],
];

const COMPETITOR_CATEGORIES = [
  "Market overview",
  "Services and coverage",
  "Contract activity",
  "Recent news",
  "Leadership and positioning",
] as const;

const FEDERAL_CATEGORIES = [
  "Forecast",
  "Recompete watch",
  "Agency needs",
  "Policy and regulation",
  "Incumbents",
  "Leadership",
  "Deployment medical",
  "Budget and funding",
  "Protests and litigation",
] as const;

const STATE_CATEGORIES = [
  ["procurement", "Procurement"],
  ["legislature", "Legislature"],
  ["governor agencies", "Governor / Agencies"],
  ["health department", "Health Dept"],
  ["labor WARN", "Labor / WARN"],
  ["medical licensing", "Medical Licensing"],
  ["emergency management", "Emergency Management"],
  ["OSHA state plan", "OSHA Plan"],
  ["insurance department", "Insurance"],
  ["corrections", "Corrections"],
  ["dot-medical-exams", "FMCSA / DOT Exams"],
  ["POST guidelines", "POST"],
  ["department of transportation", "State DOT"],
] as const;

const DOT_MEDICAL_SEARCH_CONTEXT = [
  "FMCSA DOT medical examination",
  "physical qualification standards",
  "certified medical examiner guidance",
  "National Registry of Certified Medical Examiners",
  "medical certification",
  "NRII",
  "state driver licensing agency",
  "MCSA-5875",
  "MCSA-5876",
  "49 CFR 391.41",
  "49 CFR 391.43",
  "medical variance exemption waiver",
].join(" ");

const DOT_MEDICAL_TOPICS = [
  "Medical certification rules",
  "National Registry updates",
  "MCSA-5875 / MCSA-5876 forms",
  "NRII and SDLA transmission",
  "Waivers and exemptions",
  "Medical examiner guidance",
];

const CROSS_STATE_CATEGORIES = [
  "Public health",
  "Travel advisories",
  "FDA recalls",
  "Disasters and emergency declarations",
] as const;

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
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(api(path), { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `Request failed with HTTP ${response.status}`);
  return payload as T;
}

function WorkspaceShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(13,148,136,.38),transparent_34%),radial-gradient(circle_at_52%_48%,rgba(14,165,233,.30),transparent_40%),radial-gradient(circle_at_88%_28%,rgba(79,70,229,.30),transparent_34%),radial-gradient(circle_at_72%_88%,rgba(139,92,246,.25),transparent_38%),linear-gradient(145deg,#020817_8%,#06243b_46%,#071333_70%,#0b0824)]" />
      <div className="pointer-events-none fixed inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] [background-size:46px_46px]" />
      <Sidebar />
      <main className="relative min-h-screen px-5 py-8 sm:px-8 lg:ml-[210px] lg:px-10 xl:px-14">
        <HeaderBar eyebrow={eyebrow} title={title} subtitle={subtitle} />
        {children}
      </main>
    </div>
  );
}

function LuminousPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <GlassCard
      variant="glass"
      className={cn(
        "relative overflow-hidden border-cyan-100/36 bg-[linear-gradient(145deg,rgba(34,211,238,.14),rgba(59,130,246,.13)_48%,rgba(139,92,246,.15))] shadow-[0_28px_90px_rgba(0,0,0,.34),0_0_42px_rgba(34,211,238,.15),inset_0_1px_0_rgba(255,255,255,.38),inset_0_0_0_1px_rgba(255,255,255,.08)] backdrop-blur-[34px]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.24),rgba(255,255,255,.055)_18%,transparent_40%),radial-gradient(circle_at_10%_0%,rgba(153,246,228,.20),transparent_35%),radial-gradient(circle_at_100%_10%,rgba(196,181,253,.18),transparent_34%)]" />
      <div className="relative z-[1]">{children}</div>
    </GlassCard>
  );
}

function SearchControls({
  query,
  setQuery,
  freshness,
  setFreshness,
  loading,
  onSubmit,
  placeholder,
}: {
  query: string;
  setQuery: (value: string) => void;
  freshness: Freshness;
  setFreshness: (value: Freshness) => void;
  loading: boolean;
  onSubmit: () => void;
  placeholder: string;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <LuminousPanel className="p-4 sm:p-5">
      <form onSubmit={submit} className="grid gap-3 lg:grid-cols-[1fr_170px_auto]">
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/32 bg-white/[0.08] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,.22)] backdrop-blur-2xl focus-within:border-cyan-100/70 focus-within:shadow-[0_0_0_3px_rgba(34,211,238,.10),0_0_28px_rgba(34,211,238,.16)]">
          <Search size={17} className="shrink-0 text-cyan-50/88 drop-shadow-[0_0_8px_rgba(34,211,238,.6)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-cyan-50/58"
          />
        </label>
        <select
          value={freshness}
          onChange={(event) => setFreshness(event.target.value as Freshness)}
          className="min-h-12 rounded-2xl border border-white/32 bg-white/[0.09] px-4 text-sm font-semibold text-white outline-none backdrop-blur-2xl"
        >
          {FRESHNESS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/42 bg-cyan-300/18 px-5 text-sm font-black text-white shadow-[0_0_30px_rgba(34,211,238,.18),inset_0_1px_0_rgba(255,255,255,.28)] transition hover:bg-cyan-200/24 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Radar size={17} />}
          Search live web
        </button>
      </form>
    </LuminousPanel>
  );
}

function CategoryTabs({ values, active, onChange }: { values: readonly string[]; active: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {values.map((value) => (
        <button
          type="button"
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            "shrink-0 rounded-2xl border px-4 py-2.5 text-xs font-bold backdrop-blur-xl transition",
            active === value
              ? "border-cyan-100/55 bg-cyan-300/18 text-white shadow-[0_0_26px_rgba(34,211,238,.15),inset_0_1px_0_rgba(255,255,255,.26)]"
              : "border-white/20 bg-white/[0.055] text-cyan-50/76 hover:border-white/34 hover:text-white",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function SearchResults({ response, loading, error, emptyLabel }: { response: LiveSearchResponse | null; loading: boolean; error: string; emptyLabel: string }) {
  if (loading) {
    return <LuminousPanel className="mt-5 flex min-h-56 items-center justify-center gap-3 p-8 text-sm font-semibold text-cyan-50/86"><Loader2 className="animate-spin" size={19} />Searching LangSearch…</LuminousPanel>;
  }
  if (error) {
    return <LuminousPanel className="mt-5 border-rose-200/38 p-6 text-sm font-semibold text-rose-50">{error}</LuminousPanel>;
  }
  if (!response) {
    return (
      <LuminousPanel className="mt-5 grid min-h-64 place-items-center p-8 text-center">
        <div><Sparkles className="mx-auto text-cyan-100/80 drop-shadow-[0_0_12px_rgba(34,211,238,.72)]" /><p className="mt-4 text-base font-black text-white">{emptyLabel}</p><p className="mt-2 text-sm leading-6 text-cyan-50/78">Nothing is preloaded here. Enter a subject and run a live LangSearch query.</p></div>
      </LuminousPanel>
    );
  }
  return (
    <section className="mt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-cyan-50/76">
        <span>{response.returned} live results · {response.cacheState} response</span>
        <span>Search run {formatDate(response.searchedAt)}</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {response.results.map((item) => (
          <LuminousPanel key={item.url} className="p-5 transition hover:border-cyan-100/58 hover:shadow-[0_28px_90px_rgba(0,0,0,.34),0_0_54px_rgba(34,211,238,.24),inset_0_1px_0_rgba(255,255,255,.42)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-100/82">{item.siteName}</p>
                <h2 className="mt-2 text-lg font-black leading-6 text-white drop-shadow-[0_0_10px_rgba(255,255,255,.16)]">{item.title}</h2>
              </div>
              <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`} className="rounded-xl border border-white/26 bg-white/[0.08] p-2 text-cyan-50/88 transition hover:bg-white/[0.14] hover:text-white">
                <ExternalLink size={16} />
              </a>
            </div>
            <p className="mt-4 text-sm font-medium leading-7 text-cyan-50/88">{item.summary || item.snippet || "No summary returned."}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/16 pt-4 text-[11px] font-semibold text-cyan-50/68">
              <span className="max-w-[75%] truncate">{item.displayUrl}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />{formatDate(item.publishedAt || item.lastCrawledAt)}</span>
            </div>
          </LuminousPanel>
        ))}
      </div>
      <p className="mt-4 text-xs leading-6 text-cyan-50/66">{response.limitation}</p>
    </section>
  );
}

function useLiveSearch(workspace: Workspace) {
  const [response, setResponse] = useState<LiveSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(query: string, category: string, freshness: Freshness, state = "") {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ workspace, query: query.trim(), category, freshness });
      if (state) params.set("state", state);
      const payload = await getJson<LiveSearchResponse>(`core-intelligence/live-search?${params.toString()}`);
      setResponse(payload);
    } catch (searchError) {
      setResponse(null);
      setError(searchError instanceof Error ? searchError.message : "Live search failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResponse(null);
    setError("");
  }

  return { response, loading, error, run, reset };
}

export function CompetitorsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(COMPETITOR_CATEGORIES[0]);
  const [freshness, setFreshness] = useState<Freshness>("oneYear");
  const search = useLiveSearch("competitors");

  return (
    <WorkspaceShell eyebrow="Live Market Intelligence" title="Competitors" subtitle="Search the public web in real time for competitors, services, contracts, leadership, and current positioning.">
      <CategoryTabs values={COMPETITOR_CATEGORIES} active={category} onChange={(value) => { setCategory(value); search.reset(); }} />
      <SearchControls query={query} setQuery={setQuery} freshness={freshness} setFreshness={setFreshness} loading={search.loading} onSubmit={() => void search.run(query, category, freshness)} placeholder="Search a competitor, service market, contract, or strategic question…" />
      <SearchResults response={search.response} loading={search.loading} error={search.error} emptyLabel="Search live competitor intelligence" />
    </WorkspaceShell>
  );
}

export function FederalAgenciesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(FEDERAL_CATEGORIES[0]);
  const [freshness, setFreshness] = useState<Freshness>("oneYear");
  const search = useLiveSearch("federal");

  return (
    <WorkspaceShell eyebrow="Live Government Intelligence" title="Federal Agencies" subtitle="Run focused LangSearch queries across federal programs, forecasts, incumbents, policy, budgets, and procurement signals.">
      <CategoryTabs values={FEDERAL_CATEGORIES} active={category} onChange={(value) => { setCategory(value); search.reset(); }} />
      <SearchControls query={query} setQuery={setQuery} freshness={freshness} setFreshness={setFreshness} loading={search.loading} onSubmit={() => void search.run(query, category, freshness)} placeholder="Search an agency, program, requirement, incumbent, or policy topic…" />
      <SearchResults response={search.response} loading={search.loading} error={search.error} emptyLabel="Search live federal intelligence" />
    </WorkspaceShell>
  );
}

function stateFromGeoId(id: string | number | undefined): { code: string; name: string } | null {
  if (id === undefined || id === null) return null;
  return FIPS_STATES[String(id).padStart(2, "0")] ?? null;
}

function StateMap({ selected, onSelect }: { selected: string | null; onSelect: (state: { code: string; name: string }) => void }) {
  const selectedState = useMemo(() => Object.values(FIPS_STATES).find((state) => state.code === selected) || null, [selected]);
  return (
    <LuminousPanel className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-100/78">Interactive state map</p><h2 className="mt-2 text-xl font-black text-white">United States agency intelligence</h2></div>
        <div className="text-right"><p className="text-sm font-black text-white">{selectedState?.name || "Select a state"}</p><p className="text-xs font-semibold text-cyan-50/70">Every state launches a live search workspace</p></div>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-cyan-100/30 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.15),transparent_58%),linear-gradient(145deg,rgba(255,255,255,.075),rgba(59,130,246,.08),rgba(139,92,246,.075))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_0_36px_rgba(34,211,238,.10)]">
        <ComposableMap projection="geoAlbersUsa" projectionConfig={{ scale: 1030 }} width={900} height={560} className="h-auto w-full" aria-label="Clickable map of United States state agencies">
          <Geographies geography={STATE_GEOMETRY_URL}>
            {({ geographies }) => geographies.map((geo) => {
              const state = stateFromGeoId(geo.id);
              const active = state?.code === selected;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  role="button"
                  tabIndex={state ? 0 : -1}
                  aria-label={state?.name || "State"}
                  onClick={() => state && onSelect(state)}
                  onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && state) {
                      event.preventDefault();
                      onSelect(state);
                    }
                  }}
                  style={{
                    default: {
                      fill: active ? "rgba(165,243,252,.95)" : "rgba(125,211,252,.31)",
                      stroke: active ? "rgba(255,255,255,1)" : "rgba(207,250,254,.72)",
                      strokeWidth: active ? 1.7 : 0.85,
                      outline: "none",
                      cursor: state ? "pointer" : "default",
                      filter: active ? "drop-shadow(0 0 16px rgba(34,211,238,.88))" : "drop-shadow(0 2px 5px rgba(0,0,0,.28))",
                      transition: "fill .18s ease, stroke .18s ease, filter .18s ease",
                    },
                    hover: {
                      fill: "rgba(196,181,253,.82)",
                      stroke: "rgba(255,255,255,1)",
                      strokeWidth: 1.4,
                      outline: "none",
                      cursor: state ? "pointer" : "default",
                      filter: "drop-shadow(0 0 14px rgba(139,92,246,.72))",
                    },
                    pressed: { fill: "rgba(255,255,255,.96)", stroke: "white", strokeWidth: 1.7, outline: "none" },
                  }}
                />
              );
            })}
          </Geographies>
        </ComposableMap>
      </div>
      <p className="mt-4 text-xs font-semibold leading-6 text-cyan-50/72">Click a state, choose an intelligence category, and search the current public web through LangSearch.</p>
    </LuminousPanel>
  );
}

export function StateAgenciesPage() {
  const [view, setView] = useState<"state" | "cross-state">("state");
  const [selectedState, setSelectedState] = useState<{ code: string; name: string } | null>(null);
  const [category, setCategory] = useState<string>(STATE_CATEGORIES[0][0]);
  const [crossCategory, setCrossCategory] = useState<string>(CROSS_STATE_CATEGORIES[0]);
  const [query, setQuery] = useState("");
  const [freshness, setFreshness] = useState<Freshness>("oneYear");
  const liveSearch = useLiveSearch("state");

  const stateCategoryLabels = STATE_CATEGORIES.map(([, label]) => label);
  const activeStateCategoryLabel = STATE_CATEGORIES.find(([id]) => id === category)?.[1] || category;
  const isDotMedical = category === "dot-medical-exams";

  function clearResults() {
    liveSearch.reset();
  }

  async function runStateSearch() {
    if (!selectedState || query.trim().length < 2) return;
    const searchCategory = isDotMedical ? DOT_MEDICAL_SEARCH_CONTEXT : activeStateCategoryLabel;
    await liveSearch.run(query, searchCategory, freshness, selectedState.name);
  }

  async function runCrossStateSearch() {
    await liveSearch.run(query, crossCategory, freshness);
  }

  return (
    <WorkspaceShell eyebrow="Live Government Intelligence" title="State Agencies" subtitle="Choose a state on the map, then search current agency, regulatory, health, labor, licensing, emergency, procurement, and DOT medical-exam intelligence.">
      <div className="mb-6 flex gap-2 rounded-2xl border border-white/24 bg-white/[0.065] p-1.5 backdrop-blur-2xl sm:w-fit">
        <button type="button" onClick={() => { setView("state"); clearResults(); }} className={cn("rounded-xl px-4 py-2 text-sm font-bold", view === "state" ? "bg-cyan-300/18 text-white shadow-[0_0_24px_rgba(34,211,238,.14),inset_0_1px_0_rgba(255,255,255,.24)]" : "text-cyan-50/70")}>State Agencies Map</button>
        <button type="button" onClick={() => { setView("cross-state"); clearResults(); }} className={cn("rounded-xl px-4 py-2 text-sm font-bold", view === "cross-state" ? "bg-violet-300/18 text-white shadow-[0_0_24px_rgba(139,92,246,.14),inset_0_1px_0_rgba(255,255,255,.24)]" : "text-cyan-50/70")}>Cross-State Search</button>
      </div>

      {view === "state" ? (
        <div className="space-y-5">
          <StateMap selected={selectedState?.code || null} onSelect={(state) => { setSelectedState(state); clearResults(); }} />
          {!selectedState ? (
            <LuminousPanel className="grid min-h-52 place-items-center p-8 text-center"><div><MapPin className="mx-auto text-cyan-100/82" /><p className="mt-4 font-black text-white">Select a state on the map</p><p className="mt-2 text-sm text-cyan-50/76">The live search controls will open below.</p></div></LuminousPanel>
          ) : (
            <section>
              <LuminousPanel className="mb-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-100/80">{selectedState.code}</p><h2 className="mt-1 text-2xl font-black text-white">{selectedState.name}</h2><p className="mt-1 text-sm font-semibold text-cyan-50/76">Live public-web intelligence; no preloaded state cards.</p></div>
                  <button type="button" onClick={() => { setSelectedState(null); clearResults(); }} className="rounded-xl border border-white/24 bg-white/[0.08] p-2 text-cyan-50/82 hover:text-white"><X size={18} /></button>
                </div>
              </LuminousPanel>
              <CategoryTabs values={stateCategoryLabels} active={activeStateCategoryLabel} onChange={(label) => { const next = STATE_CATEGORIES.find(([, itemLabel]) => itemLabel === label)?.[0] || "procurement"; setCategory(next); clearResults(); }} />
              {isDotMedical ? (
                <LuminousPanel className="mb-4 p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 shrink-0 text-cyan-100/90" size={18} />
                    <div>
                      <p className="text-sm font-black text-white">DOT medical-exam intelligence</p>
                      <p className="mt-2 text-xs font-semibold leading-6 text-cyan-50/76">Search FMCSA medical certification rules, National Registry changes, examination forms, examiner guidance, state licensing-agency transmission requirements, and medical waivers or exemptions. This is not a motor-carrier lookup.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {DOT_MEDICAL_TOPICS.map((topic) => <span key={topic} className="rounded-full border border-cyan-100/24 bg-cyan-300/[0.08] px-3 py-1.5 text-[10px] font-bold text-cyan-50/82">{topic}</span>)}
                      </div>
                    </div>
                  </div>
                </LuminousPanel>
              ) : null}
              <SearchControls query={query} setQuery={setQuery} freshness={freshness} setFreshness={setFreshness} loading={liveSearch.loading} onSubmit={() => void runStateSearch()} placeholder={isDotMedical ? "Search DOT exam rules, forms, certification updates, examiner guidance, waivers, or National Registry changes…" : `Search ${selectedState.name} ${activeStateCategoryLabel.toLowerCase()} intelligence…`} />
              <SearchResults response={liveSearch.response} loading={liveSearch.loading} error={liveSearch.error} emptyLabel={isDotMedical ? `Search ${selectedState.name} DOT medical-exam updates` : `Search ${selectedState.name} ${activeStateCategoryLabel}`} />
            </section>
          )}
        </div>
      ) : (
        <section>
          <CategoryTabs values={CROSS_STATE_CATEGORIES} active={crossCategory} onChange={(value) => { setCrossCategory(value); clearResults(); }} />
          <SearchControls query={query} setQuery={setQuery} freshness={freshness} setFreshness={setFreshness} loading={liveSearch.loading} onSubmit={() => void runCrossStateSearch()} placeholder="Search a cross-state public-health, recall, disaster, or advisory topic…" />
          <SearchResults response={liveSearch.response} loading={liveSearch.loading} error={liveSearch.error} emptyLabel="Search live cross-state intelligence" />
        </section>
      )}

      <div className="mt-8 flex items-start gap-3 border-t border-cyan-100/18 pt-5 text-xs font-semibold leading-6 text-cyan-50/66">
        <ShieldCheck size={15} className="mt-1 shrink-0" />
        <p>LangSearch results are current public-web leads rather than stored agency cards. Review the linked official source before using a result operationally.</p>
      </div>
    </WorkspaceShell>
  );
}
