import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { Activity, Building2, ExternalLink, HeartPulse, Landmark, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}/api/${path.replace(/^\//, "")}`;
const GEOMETRY = api("core-intelligence/state-map-geometry");

const FIPS: Record<string, { code: string; name: string }> = {
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

const OCCU_MED = /occupational\s+(health|medicine)|employee\s+health|pre[- ]?employment|post[- ]?offer|medical\s+(exam|evaluation|surveillance)|physical\s+exam|fitness[- ]?for[- ]?duty|drug\s+(test|screen)|alcohol\s+(test|screen)|respirator|respiratory\s+protection|fit\s*test|audiometr|hearing\s+conservation|workers.?\s*comp|return[- ]?to[- ]?work|vaccin|immuniz|dot\s+physical|commercial\s+driver|hazmat/i;

type StateProfile = {
  stateCode: string; stateName: string; region: string | null; oshaStatePlan: string | null; itemCount: number;
  procurementUrl: string | null; legislatureUrl: string | null; govUrl: string | null; healthDeptUrl: string | null; laborUrl: string | null;
  emergencyMgmtUrl: string | null; medicalBoardUrl: string | null; insuranceDeptUrl: string | null; correctionsUrl: string | null; dotUrl: string | null; postCommissionUrl: string | null;
};
type StateItem = { id: string; stateCode: string; bucket: string; title: string; summary: string | null; url: string | null; publishedDate: string | null; agency: string | null; itemType: string | null; relevanceScore: number | null; fetchedAt: string | null };

type View = "Occu-Med signals" | "Procurement" | "Labor / OSHA" | "Health" | "Licensing" | "DOT" | "All official records";
const VIEWS: View[] = ["Occu-Med signals", "Procurement", "Labor / OSHA", "Health", "Licensing", "DOT", "All official records"];

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload as T;
}
function official(url?: string | null) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith(".gov") || host.endsWith(".us") || host === "usa.gov";
  } catch { return false; }
}
function formatDate(value?: string | null) {
  if (!value) return "Date not reported";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function itemText(item: StateItem) { return `${item.title} ${item.summary || ""} ${item.bucket} ${item.itemType || ""}`; }
function relevant(item: StateItem) { return OCCU_MED.test(itemText(item)); }
function viewMatch(item: StateItem, view: View) {
  const text = itemText(item).toLowerCase();
  if (view === "Occu-Med signals") return relevant(item);
  if (view === "Procurement") return /procure|solicit|bid|rfp|contract|award/.test(text);
  if (view === "Labor / OSHA") return /osha|labor|workplace|safety|worker/.test(text);
  if (view === "Health") return /health|medical|clinic|physician|immun|disease/.test(text);
  if (view === "Licensing") return /license|board|credential|physician|nurse/.test(text);
  if (view === "DOT") return /transport|dot|driver|commercial|motor carrier/.test(text);
  return true;
}
function fillFor(count: number, selected: boolean) {
  if (selected) return "#9cf8e7";
  if (count >= 25) return "#22c8d8";
  if (count >= 10) return "#1689a8";
  if (count > 0) return "#115671";
  return "#0b2337";
}

export default function StateAgenciesV2Page() {
  const [profiles, setProfiles] = useState<StateProfile[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [items, setItems] = useState<StateItem[]>([]);
  const [view, setView] = useState<View>("Occu-Med signals");
  const [hovered, setHovered] = useState("");
  const [loading, setLoading] = useState(true);
  const [itemLoading, setItemLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    readJson<{ states: StateProfile[] }>(api("state-agencies/states"))
      .then((payload) => {
        if (!active) return;
        const states = payload.states || [];
        setProfiles(states);
        const initial = [...states].sort((a, b) => b.itemCount - a.itemCount)[0]?.stateCode || states[0]?.stateCode || "";
        setSelectedCode(initial);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Unable to load state intelligence."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedCode) return;
    let active = true;
    setItemLoading(true);
    setItems([]);
    readJson<{ items: StateItem[] }>(api(`state-agencies/items?stateCode=${encodeURIComponent(selectedCode)}&limit=500`))
      .then((payload) => { if (active) setItems((payload.items || []).filter((item) => !item.url || official(item.url))); })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Unable to load selected state records."))
      .finally(() => active && setItemLoading(false));
    return () => { active = false; };
  }, [selectedCode]);

  const selected = profiles.find((state) => state.stateCode === selectedCode) || null;
  const relevantItems = useMemo(() => items.filter(relevant), [items]);
  const visible = useMemo(() => items.filter((item) => viewMatch(item, view)).sort((a, b) => new Date(b.publishedDate || b.fetchedAt || 0).getTime() - new Date(a.publishedDate || a.fetchedAt || 0).getTime()), [items, view]);
  const topStates = useMemo(() => [...profiles].sort((a, b) => b.itemCount - a.itemCount).slice(0, 8), [profiles]);
  const statePlanCount = profiles.filter((state) => state.oshaStatePlan === "full").length;
  const officialLinks = selected ? [
    ["State portal", selected.govUrl], ["Labor / OSHA", selected.laborUrl], ["Health department", selected.healthDeptUrl], ["Procurement", selected.procurementUrl],
    ["Medical board", selected.medicalBoardUrl], ["Insurance / workers comp", selected.insuranceDeptUrl], ["State DOT", selected.dotUrl], ["Legislature", selected.legislatureUrl],
  ].filter(([, url]) => Boolean(url)) as Array<[string, string]> : [];
  const buckets = useMemo(() => {
    const values = new Map<string, number>();
    for (const item of relevantItems) values.set(item.bucket || "other", (values.get(item.bucket || "other") || 0) + 1);
    return [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [relevantItems]);
  const maxBucket = Math.max(1, ...buckets.map(([, count]) => count));

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(16,185,129,.22),transparent_30%),radial-gradient(circle_at_58%_38%,rgba(14,165,233,.18),transparent_36%),radial-gradient(circle_at_88%_18%,rgba(99,102,241,.18),transparent_28%),linear-gradient(145deg,#020817_8%,#032738_48%,#071333_72%,#080720)]" />
      <Sidebar />
      <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[224px] lg:px-12 lg:pt-8">
        <HeaderBar eyebrow="State Intelligence · official-source only" title="State Agencies" subtitle="A state-by-state occupational-health intelligence layer built from stored state records and official government sources. No cross-state political noise. No clinic marketing copy." />

        <section className="mt-8 overflow-hidden rounded-[32px] border border-white/12 bg-black/20 shadow-[0_36px_100px_rgba(0,0,0,.38)] backdrop-blur-3xl">
          <div className="grid min-h-[520px] xl:grid-cols-[1.45fr_.55fr]">
            <div className="relative border-b border-white/10 xl:border-b-0 xl:border-r">
              <div className="absolute left-5 top-5 z-10 max-w-sm rounded-2xl border border-white/12 bg-[#020817]/70 px-4 py-3 backdrop-blur-xl">
                <p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/45">National intelligence map</p>
                <p className="mt-1 text-xs text-cyan-50/55">Color intensity reflects stored state-agency records. Click any state to replace the workspace below.</p>
                {hovered ? <p className="mt-2 text-sm font-black text-white">{hovered}</p> : null}
              </div>
              <ComposableMap projection="geoAlbersUsa" width={980} height={600} className="h-full min-h-[520px] w-full">
                <Geographies geography={GEOMETRY}>
                  {({ geographies }) => geographies.map((geo) => {
                    const fips = String(geo.id || geo.properties?.STATEFP || "").padStart(2, "0");
                    const stateMeta = FIPS[fips];
                    const profile = stateMeta ? profiles.find((entry) => entry.stateCode === stateMeta.code) : null;
                    const isSelected = Boolean(stateMeta && stateMeta.code === selectedCode);
                    return <Geography key={geo.rsmKey} geography={geo} onMouseEnter={() => setHovered(stateMeta?.name || "")} onMouseLeave={() => setHovered("")} onClick={() => stateMeta && setSelectedCode(stateMeta.code)} style={{ default: { fill: fillFor(profile?.itemCount || 0, isSelected), stroke: "rgba(196,255,249,.32)", strokeWidth: isSelected ? 1.6 : .65, outline: "none", transition: "all .2s ease" }, hover: { fill: "#67e8f9", stroke: "#e6fffb", strokeWidth: 1.2, outline: "none", cursor: "pointer" }, pressed: { fill: "#a7f3d0", outline: "none" } }} />;
                  })}
                </Geographies>
              </ComposableMap>
            </div>

            <aside className="p-6 md:p-8">
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/45">National pulse</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-.04em]">What is actually in the state layer.</h2>
              <div className="mt-8 space-y-6">
                <div><strong className="text-4xl font-black">{profiles.length || "—"}</strong><p className="mt-1 text-xs text-cyan-50/45">state profiles loaded</p></div>
                <div><strong className="text-4xl font-black">{profiles.reduce((sum, state) => sum + state.itemCount, 0).toLocaleString()}</strong><p className="mt-1 text-xs text-cyan-50/45">stored state-agency records</p></div>
                <div><strong className="text-4xl font-black">{statePlanCount}</strong><p className="mt-1 text-xs text-cyan-50/45">full OSHA state-plan profiles</p></div>
              </div>
              <div className="mt-8 border-t border-white/10 pt-5">
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">Most populated</p>
                <div className="mt-3 space-y-2">{topStates.map((state) => <button key={state.stateCode} onClick={() => setSelectedCode(state.stateCode)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition hover:bg-white/[.05]"><span>{state.stateName}</span><span className="font-black text-cyan-100/55">{state.itemCount}</span></button>)}</div>
              </div>
            </aside>
          </div>
        </section>

        {error ? <div className="mt-6 rounded-2xl border border-rose-200/20 bg-rose-300/[.05] p-4 text-sm text-rose-100">{error}</div> : null}
        {loading || !selected ? <div className="mt-8 py-16 text-center text-sm text-cyan-50/45">Loading state intelligence…</div> : (
          <>
            <section className="mt-12 grid gap-8 xl:grid-cols-[.78fr_1.22fr]">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.19em] text-emerald-100/50">Selected state</p>
                <h2 className="mt-2 text-5xl font-black tracking-[-.055em]">{selected.stateName}</h2>
                <p className="mt-3 max-w-lg text-sm leading-7 text-cyan-50/52">{selected.region || "State"} · {selected.oshaStatePlan === "full" ? "OSHA state plan" : selected.oshaStatePlan || "OSHA coverage not classified"}</p>
                <div className="mt-8 grid grid-cols-2 gap-5">
                  <div><strong className="text-3xl font-black">{items.length}</strong><p className="mt-1 text-[10px] text-cyan-50/42">official stored records</p></div>
                  <div><strong className="text-3xl font-black">{relevantItems.length}</strong><p className="mt-1 text-[10px] text-cyan-50/42">Occu-Med-relevant signals</p></div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/11 bg-white/[.035] p-6 md:p-8">
                <div className="flex items-center justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.17em] text-cyan-100/42">Signal mix</p><h3 className="mt-2 text-xl font-black">Occupational-health relevance by source bucket</h3></div><Activity className="text-cyan-100/50" /></div>
                <div className="mt-7 space-y-4">{buckets.length ? buckets.map(([bucket, count]) => <div key={bucket}><div className="flex justify-between gap-3 text-xs"><span className="capitalize text-cyan-50/65">{bucket.replace(/[-_]/g, " ")}</span><b>{count}</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300/70 via-cyan-300/70 to-indigo-300/70" style={{ width: `${Math.max(8, (count / maxBucket) * 100)}%` }} /></div></div>) : <p className="text-sm text-cyan-50/42">No official stored occupational-health records for this state yet.</p>}</div>
              </div>
            </section>

            <section className="mt-10">
              <div className="flex flex-wrap gap-2">{VIEWS.map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-full border px-4 py-2 text-[10px] font-black transition ${view === item ? "border-cyan-200/30 bg-cyan-300/12 text-white" : "border-white/9 bg-white/[.025] text-cyan-50/48 hover:text-white"}`}>{item}</button>)}</div>
            </section>

            <section className="mt-6 grid gap-8 xl:grid-cols-[1fr_.42fr]">
              <div>
                <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-[9px] font-black uppercase tracking-[.17em] text-cyan-100/42">{view}</p><h3 className="mt-2 text-2xl font-black">Official state intelligence stream</h3></div><span className="text-xs text-cyan-50/38">{itemLoading ? "Loading…" : `${visible.length} records`}</span></div>
                <div className="divide-y divide-white/8">{visible.slice(0, 40).map((item) => <article key={item.id} className="group grid gap-3 py-6 md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[.12em] text-cyan-100/38"><span>{item.agency || item.bucket}</span><span>·</span><span>{formatDate(item.publishedDate || item.fetchedAt)}</span>{relevant(item) ? <span className="text-emerald-200/70">Occu-Med signal</span> : null}</div><h4 className="mt-2 text-base font-black leading-6 text-white/90">{item.title}</h4>{item.summary ? <p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/48">{item.summary}</p> : null}</div>{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-[10px] font-black text-cyan-50/55 transition group-hover:border-cyan-200/25 group-hover:text-white">Official source <ExternalLink size={12} /></a> : null}</article>)}{!itemLoading && visible.length === 0 ? <div className="py-14 text-sm text-cyan-50/42">No official stored records match this view. The app is intentionally not filling the space with generic web results.</div> : null}</div>
              </div>

              <aside className="space-y-8">
                <div><div className="flex items-center gap-2"><Landmark size={17} className="text-cyan-100/48" /><h3 className="text-sm font-black">Official source rail</h3></div><div className="mt-4 space-y-2">{officialLinks.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-white/9 bg-white/[.025] px-4 py-3 text-xs text-cyan-50/60 transition hover:border-cyan-200/22 hover:bg-white/[.045] hover:text-white"><span>{label}</span><ExternalLink size={12} /></a>)}</div></div>
                <div className="rounded-[26px] border border-emerald-100/12 bg-emerald-300/[.035] p-5"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-200/60" /><p className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-100/55">Source policy</p></div><p className="mt-3 text-xs leading-6 text-cyan-50/50">This workspace excludes non-government clinic marketing, generic disaster/news results, and cross-state political alerts from the state intelligence stream.</p></div>
              </aside>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
