import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, ExternalLink, FileText, Loader2, Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { loadSecFilingsFeed, searchSecIssuers, type SecFiling, type SecTrackedIssuer } from "@/data/secFilingsApi";

const FORMS = ["8-K","10-Q","10-K","DEF 14A","6-K","20-F","40-F"];
const KNOWN: SecTrackedIssuer[] = [
  { cik: "0001601548", name: "V2X, Inc.", ticker: "VVX", exchange: "NYSE" },
  { cik: "0001792580", name: "Amentum Holdings, Inc.", ticker: "AMTM", exchange: "NYSE" },
  { cik: "0000885725", name: "Jacobs Solutions Inc.", ticker: "J", exchange: "NYSE" },
];

type Signal = { label: string; detail: string; tone: "cyan" | "emerald" | "violet" | "amber" };
async function rosterNames() {
  const response = await fetch("/api/entities/roster", { cache: "no-store" });
  if (!response.ok) return [] as string[];
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload?.entities) ? payload.entities.map((item: any) => String(item?.name || "")).filter(Boolean) : [];
}
function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function signalFor(filing: SecFiling): Signal {
  const text = `${filing.form} ${filing.primaryDocumentDescription || ""} ${filing.items || ""}`.toLowerCase();
  if (filing.form === "10-K") return { label: "Annual risk reset", detail: "Review workforce, geographic operations, backlog, government-customer concentration, litigation, and risk-factor changes.", tone: "violet" };
  if (filing.form === "10-Q") return { label: "Quarterly operating change", detail: "Compare headcount, program mix, backlog, restructuring, litigation, and material risk changes against the prior quarter.", tone: "cyan" };
  if (filing.form === "DEF 14A") return { label: "Leadership + governance", detail: "Useful for executive changes, board oversight, compensation priorities, ownership, and governance structure.", tone: "emerald" };
  if (/acquisition|merger|restructur|layoff|reduction|workforce|material agreement|departure|appointment|bankruptcy/.test(text)) return { label: "Material operating signal", detail: "This filing may indicate a structural change worth connecting to workforce, geographic footprint, or contract demand.", tone: "amber" };
  if (filing.form === "8-K") return { label: "Current-event filing", detail: "Use the filing item numbers and document description to identify the material event before treating it as an opportunity signal.", tone: "cyan" };
  return { label: "Issuer filing", detail: "Official EDGAR evidence for the selected issuer. Open the filing for source detail before drawing an operational conclusion.", tone: "cyan" };
}
function toneClass(tone: Signal["tone"]) {
  return tone === "emerald" ? "bg-emerald-300" : tone === "violet" ? "bg-violet-300" : tone === "amber" ? "bg-amber-300" : "bg-cyan-300";
}

export default function SecFilings() {
  const [issuers, setIssuers] = useState<SecTrackedIssuer[]>(KNOWN);
  const [selectedCik, setSelectedCik] = useState(KNOWN[0].cik);
  const [feed, setFeed] = useState<SecFiling[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SecTrackedIssuer[]>([]);
  const [form, setForm] = useState("all");

  useEffect(() => {
    let active = true;
    void rosterNames().then(async (names) => {
      const additions: SecTrackedIssuer[] = [];
      for (const name of names.slice(0, 30)) {
        const known = KNOWN.find((candidate) => candidate.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(candidate.name.replace(/,?\s+(inc\.?|holdings|solutions).*$/i, "").toLowerCase()));
        if (known) { additions.push(known); continue; }
        try {
          const found = await searchSecIssuers(name);
          const exact = found.issuers.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
          if (exact) additions.push(exact);
        } catch { /* private/unresolved entities are expected */ }
      }
      if (!active) return;
      setIssuers((current) => [...current, ...additions].filter((item,index,all) => all.findIndex((candidate) => candidate.cik === item.cik) === index));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const selected = issuers.find((issuer) => issuer.cik === selectedCik);
    if (!selected) return;
    let active = true;
    setLoading(true); setError(""); setFeed([]); setForm("all");
    void loadSecFilingsFeed([selected], FORMS).then((payload) => {
      if (!active) return;
      setFeed((payload.filings || []).filter((filing) => filing.cik.replace(/^0+/, "") === selected.cik.replace(/^0+/, "")));
    }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "SEC feed failed."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [issuers, selectedCik]);

  const selected = issuers.find((issuer) => issuer.cik === selectedCik) || issuers[0];
  const visible = useMemo(() => form === "all" ? feed : feed.filter((filing) => filing.form === form), [feed, form]);
  const formCounts = useMemo(() => {
    const map = new Map<string, number>(); for (const filing of feed) map.set(filing.form, (map.get(filing.form) || 0) + 1); return [...map.entries()].sort((a,b) => b[1]-a[1]);
  }, [feed]);
  const maxCount = Math.max(1, ...formCounts.map(([,count]) => count));
  const yearCounts = useMemo(() => {
    const map = new Map<string, number>(); for (const filing of feed) { const year = filing.filingDate?.slice(0,4) || "Unknown"; map.set(year, (map.get(year)||0)+1); } return [...map.entries()].sort((a,b) => a[0].localeCompare(b[0])).slice(-5);
  }, [feed]);
  const maxYear = Math.max(1, ...yearCounts.map(([,count]) => count));

  async function runSearch() {
    if (query.trim().length < 2) return;
    setError("");
    try { const payload = await searchSecIssuers(query.trim()); setResults(payload.issuers); } catch (reason) { setError(reason instanceof Error ? reason.message : "Issuer search failed."); }
  }
  function addIssuer(issuer: SecTrackedIssuer) {
    setIssuers((current) => current.some((item) => item.cik === issuer.cik) ? current : [...current, issuer]); setSelectedCik(issuer.cik); setResults([]); setQuery("");
  }

  return <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(16,185,129,.18),transparent_30%),radial-gradient(circle_at_58%_30%,rgba(14,165,233,.17),transparent_36%),radial-gradient(circle_at_88%_20%,rgba(99,102,241,.17),transparent_28%),linear-gradient(145deg,#020817,#052638_50%,#0a0d2d)]" />
    <Sidebar />
    <section className="relative z-10 px-5 py-8 pt-24 lg:ml-[224px] lg:px-12 lg:pt-8">
      <HeaderBar eyebrow="Employer intelligence · EDGAR evidence" title="SEC Filings" subtitle="Issuer-specific SEC intelligence. Selecting a company reloads only that issuer’s official filings, then turns the filing stream into an operating-risk and workforce-change timeline instead of a raw SEC list." />

      <section className="mt-9 grid gap-10 xl:grid-cols-[320px_1fr]">
        <aside className="self-start xl:sticky xl:top-8">
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/40">Public-company roster</p>
          <div className="mt-4 divide-y divide-white/8 border-y border-white/9">{issuers.map((issuer) => <button key={issuer.cik} onClick={() => setSelectedCik(issuer.cik)} className={`w-full py-4 text-left transition ${issuer.cik === selectedCik ? "text-white" : "text-cyan-50/45 hover:text-white"}`}><div className="flex items-center justify-between gap-3"><span><strong className="block text-sm">{issuer.name}</strong><small className="mt-1 block text-[9px] uppercase tracking-[.12em] text-cyan-100/35">{issuer.ticker || "—"} · {issuer.exchange || "—"}</small></span>{issuer.cik === selectedCik ? <span className="h-2 w-2 rounded-full bg-cyan-300" /> : null}</div></button>)}</div>
          <div className="mt-7"><p className="text-[9px] font-black uppercase tracking-[.15em] text-cyan-100/32">Add another issuer</p><div className="mt-2 flex gap-2 border-b border-white/12 py-2"><Search size={14} className="mt-2 text-cyan-100/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void runSearch()} placeholder="Ticker or company" className="min-h-9 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-cyan-100/22" /><button onClick={() => void runSearch()} className="text-[9px] font-black text-cyan-100/50 hover:text-white">Search</button></div>{results.slice(0,6).map((issuer) => <button key={issuer.cik} onClick={() => addIssuer(issuer)} className="mt-2 block w-full rounded-xl px-2 py-2 text-left text-[10px] text-cyan-50/50 hover:bg-white/[.04] hover:text-white">{issuer.name} · {issuer.ticker || "—"}</button>)}</div>
        </aside>

        <div>
          <section className="overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(145deg,rgba(4,39,52,.86),rgba(24,38,86,.75))] shadow-[0_36px_100px_rgba(0,0,0,.36)]">
            <div className="grid gap-0 xl:grid-cols-[1.1fr_.9fr]">
              <div className="p-7 md:p-10"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-cyan-100/38">Selected issuer</p><h2 className="mt-2 text-4xl font-black tracking-[-.055em]">{selected?.name || "Select an issuer"}</h2><p className="mt-2 text-xs text-cyan-50/40">{selected?.ticker || "—"} · {selected?.exchange || "—"} · CIK {selected?.cik || "—"}</p></div><Building2 className="text-cyan-100/45" /></div><div className="mt-10 grid grid-cols-3 gap-6"><div><strong className="text-4xl font-black">{feed.length}</strong><p className="mt-1 text-[9px] text-cyan-50/38">filings loaded</p></div><div><strong className="text-4xl font-black">{formCounts.length}</strong><p className="mt-1 text-[9px] text-cyan-50/38">form types</p></div><div><strong className="text-4xl font-black">{feed[0]?.filingDate ? formatDate(feed[0].filingDate) : "—"}</strong><p className="mt-1 text-[9px] text-cyan-50/38">latest filing</p></div></div></div>
              <aside className="border-t border-white/10 bg-black/12 p-7 md:p-10 xl:border-l xl:border-t-0"><p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/38">Form mix</p><div className="mt-5 space-y-4">{formCounts.slice(0,6).map(([name,count]) => <div key={name}><div className="flex justify-between text-xs"><span>{name}</span><b>{count}</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300/65 via-cyan-300/70 to-violet-300/70" style={{ width: `${Math.max(8,(count/maxCount)*100)}%` }} /></div></div>)}</div></aside>
            </div>
          </section>

          {error ? <div className="mt-5 rounded-2xl border border-rose-200/18 bg-rose-300/[.05] p-4 text-sm text-rose-100"><AlertTriangle size={15} className="mr-2 inline" />{error}</div> : null}
          {loading ? <div className="mt-12 flex items-center justify-center gap-3 py-20 text-sm text-cyan-50/45"><Loader2 size={18} className="animate-spin" />Loading issuer-specific EDGAR evidence…</div> : null}

          {!loading ? <>
            <section className="mt-12 grid gap-10 xl:grid-cols-[.7fr_1.3fr]">
              <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-100/38">Filing cadence</p><h3 className="mt-2 text-3xl font-black tracking-[-.04em]">How the disclosure stream is moving.</h3><div className="mt-8 flex h-40 items-end gap-3">{yearCounts.map(([year,count]) => <div key={year} className="flex h-full flex-1 flex-col justify-end"><div className="rounded-t-xl bg-gradient-to-t from-cyan-300/35 to-violet-300/65" style={{ height: `${Math.max(12,(count/maxYear)*100)}%` }} /><div className="mt-2 text-center"><b className="text-[10px]">{year}</b><p className="text-[8px] text-cyan-50/30">{count}</p></div></div>)}</div></div>
              <div><div className="flex flex-wrap gap-2">{["all",...formCounts.map(([name]) => name)].map((value) => <button key={value} onClick={() => setForm(value)} className={`rounded-full border px-3 py-1.5 text-[9px] font-black ${form === value ? "border-cyan-200/28 bg-cyan-300/10 text-white" : "border-white/8 text-cyan-50/40"}`}>{value === "all" ? "All forms" : value}</button>)}</div><div className="mt-5 divide-y divide-white/8 border-t border-white/8">{visible.slice(0,24).map((filing) => { const signal = signalFor(filing); return <article key={filing.id} className="grid gap-4 py-6 md:grid-cols-[110px_1fr_auto]"><div><p className="text-[9px] font-black uppercase tracking-[.13em] text-cyan-100/34">{formatDate(filing.filingDate)}</p><span className="mt-2 inline-flex rounded-full border border-white/10 px-2 py-1 text-[9px] font-black">{filing.form}</span></div><div><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${toneClass(signal.tone)}`} /><p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-100/38">{signal.label}</p></div><h4 className="mt-2 text-base font-black">{filing.primaryDocumentDescription || `${filing.form} filing`}</h4>{filing.items ? <p className="mt-1 text-[10px] text-cyan-50/35">Items: {filing.items}</p> : null}<p className="mt-2 max-w-3xl text-xs leading-6 text-cyan-50/48">{signal.detail}</p></div><a href={filing.filingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-[9px] font-black text-cyan-50/50 hover:border-cyan-200/25 hover:text-white">Evidence <ExternalLink size={12} /></a></article>; })}{visible.length === 0 ? <div className="py-16 text-sm text-cyan-50/40">No filings match this form filter for the selected issuer.</div> : null}</div></div>
            </section>

            <section className="mt-14 grid gap-6 border-t border-white/10 pt-10 md:grid-cols-3"><div><ShieldCheck className="text-emerald-100/45" /><h4 className="mt-3 text-sm font-black">Issuer isolation</h4><p className="mt-2 text-xs leading-6 text-cyan-50/42">Only rows whose CIK matches the selected issuer are rendered. Another tracked company cannot leak into this view.</p></div><div><TrendingUp className="text-cyan-100/45" /><h4 className="mt-3 text-sm font-black">Operating change</h4><p className="mt-2 text-xs leading-6 text-cyan-50/42">10-K, 10-Q, 8-K, and proxy filings are triaged into the kind of workforce, governance, risk, and structural changes worth investigating.</p></div><div><Sparkles className="text-violet-100/45" /><h4 className="mt-3 text-sm font-black">Not a raw feed</h4><p className="mt-2 text-xs leading-6 text-cyan-50/42">The page tells you why a filing may matter, while keeping the official EDGAR filing one click away.</p></div></section>
          </> : null}
        </div>
      </section>
    </section>
  </main>;
}
