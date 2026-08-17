import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Database, Loader2, Network, X } from "lucide-react";
import { GlassCard } from "@/components/insight/GlassCard";

type RecordRow = Record<string, unknown>;

type Occupation = { code: string; title: string; datalevel?: boolean; zone?: { code?: number; title?: string }; tags?: Record<string, unknown> };
type ContentLink = { href?: string; title?: string };

const families = [
  ["abilities", "Abilities"], ["interests", "Interests"], ["knowledge", "Knowledge"], ["skills_basic", "Basic Skills"],
  ["skills_cf", "Cross-Functional Skills"], ["work_activities", "Work Activities"], ["work_context", "Work Context"], ["work_styles", "Work Styles"],
] as const;

function text(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function DataTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (depth > 5) return <span className="text-[10px] text-cyan-50/45">{text(value)}</span>;
  if (Array.isArray(value)) return <div className="space-y-2">{value.map((item, index) => <div key={index} className="rounded-xl border border-white/10 bg-black/15 p-3"><DataTree value={item} depth={depth + 1} /></div>)}</div>;
  if (value && typeof value === "object") return <div className="grid gap-2">{Object.entries(value as RecordRow).map(([key, child]) => <div key={key} className="grid gap-1 sm:grid-cols-[180px_1fr]"><span className="text-[9px] font-black uppercase tracking-[0.1em] text-cyan-100/48">{key}</span><div className="min-w-0 break-words text-[10px] leading-5 text-cyan-50/68"><DataTree value={child} depth={depth + 1} /></div></div>)}</div>;
  return <span>{text(value)}</span>;
}

function Loading({ label }: { label: string }) { return <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 p-7 text-xs text-cyan-50/50"><Loader2 size={15} className="animate-spin" />{label}</div>; }

export function OnetDatabaseBrowser() {
  const [start, setStart] = useState(1);
  const [catalog, setCatalog] = useState<{ total: number; occupation: Occupation[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [selectedCode, setSelectedCode] = useState("");
  const [content, setContent] = useState<{ title: string; payload: unknown } | null>(null);
  const [family, setFamily] = useState("");
  const [familyPayload, setFamilyPayload] = useState<unknown>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true); setError("");
    const end = start + 49;
    void fetch(`/api/occupational-source-browser/onet/occupations?start=${start}&end=${end}&sort=title`).then((response) => response.json()).then((data) => {
      if (!data.ok) throw new Error(data.error || "O*NET catalog failed.");
      setCatalog(data.payload);
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "O*NET catalog failed.")).finally(() => setLoading(false));
  }, [start]);

  async function openOccupation(code: string) {
    setSelectedCode(code); setSelected(null); setContent(null); setFamily(""); setFamilyPayload(null); setLoading(true); setError("");
    try {
      const response = await fetch(`/api/occupational-source-browser/onet/occupation/${encodeURIComponent(code)}`);
      const data = await response.json(); if (!data.ok) throw new Error(data.error); setSelected(data.payload);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "O*NET occupation failed."); }
    finally { setLoading(false); }
  }

  async function openContent(link: ContentLink) {
    if (!link.href || !selectedCode) return;
    setLoading(true); setContent(null); setError("");
    try {
      const params = new URLSearchParams({ url: link.href });
      const response = await fetch(`/api/occupational-source-browser/onet/occupation/${encodeURIComponent(selectedCode)}/content?${params}`);
      const data = await response.json(); if (!data.ok) throw new Error(data.error); setContent({ title: link.title || "O*NET section", payload: data.payload });
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "O*NET section failed."); }
    finally { setLoading(false); }
  }

  async function openFamily(id: string) {
    setFamily(id); setFamilyPayload(null); setLoading(true); setError("");
    try {
      const response = await fetch(`/api/occupational-source-browser/onet/content-model/${id}`);
      const data = await response.json(); if (!data.ok) throw new Error(data.error); setFamilyPayload(data.payload);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "O*NET content model failed."); }
    finally { setLoading(false); }
  }

  const total = catalog?.total ?? 0;
  const last = Math.min(start + 49, total);
  const details = Array.isArray(selected?.details_contents) ? selected?.details_contents as ContentLink[] : [];
  const summary = Array.isArray(selected?.summary_contents) ? selected?.summary_contents as ContentLink[] : [];
  const custom = Array.isArray(selected?.custom_contents) ? selected?.custom_contents as ContentLink[] : [];

  return <section className="mb-7 rounded-[26px] border border-cyan-200/16 bg-[#050d18]/96 p-4 shadow-[0_24px_70px_rgba(0,0,0,.34)] md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-cyan-100/70"><Database size={17} /><p className="text-[10px] font-black uppercase tracking-[0.18em]">Complete O*NET Database Browser</p></div><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">All occupations. All published occupation sections. All content-model families.</h2><p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/58">The prepared Occu-Med views remain below, but this browser exposes the actual O*NET catalog. Browse every occupation O*NET publishes, then open every Details, Summary, and Custom section O*NET says is available for that occupation.</p></div><Network size={24} className="text-cyan-200/45" /></div>
    {error ? <div className="mt-4 rounded-xl border border-rose-200/18 bg-rose-300/[0.05] p-3 text-xs text-rose-50/70">{error}</div> : null}
    <GlassCard className="mt-5 p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100/55">O*NET content model</p><h3 className="mt-1 text-lg font-black text-white">Browse the source taxonomy itself</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{families.map(([id, label]) => <button key={id} type="button" onClick={() => void openFamily(id)} className={`rounded-xl border p-3 text-left text-xs font-black ${family === id ? "border-violet-200/28 bg-violet-300/[0.08] text-white" : "border-white/10 bg-black/15 text-cyan-50/68"}`}>{label}</button>)}</div>{family ? <div className="mt-4">{loading && !familyPayload ? <Loading label="Loading O*NET taxonomy…" /> : <DataTree value={familyPayload} />}</div> : null}</GlassCard>
    <GlassCard className="mt-5 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100/55">All occupations</p><h3 className="mt-1 text-lg font-black text-white">O*NET occupation catalog</h3><p className="mt-1 text-xs text-cyan-50/45">{total ? `${total.toLocaleString()} occupations available` : "Loading occupation count…"}</p></div>{total ? <div className="text-xs text-cyan-50/45">Showing {start.toLocaleString()}–{last.toLocaleString()}</div> : null}</div>{loading && !selected ? <Loading label="Loading occupations…" /> : <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{(catalog?.occupation ?? []).map((occupation) => <button key={occupation.code} type="button" onClick={() => void openOccupation(occupation.code)} className="rounded-xl border border-white/10 bg-black/15 p-3 text-left transition hover:border-cyan-200/22 hover:bg-cyan-300/[0.045]"><p className="text-xs font-black text-white">{occupation.title}</p><p className="mt-1 text-[9px] text-cyan-50/45">{occupation.code}{occupation.zone?.title ? ` · ${occupation.zone.title}` : ""}</p></button>)}</div>}<div className="mt-4 flex items-center justify-between"><button type="button" disabled={start <= 1} onClick={() => setStart((value) => Math.max(1, value - 50))} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-cyan-50/60 disabled:opacity-30"><ChevronLeft size={13} />Previous 50</button><button type="button" disabled={!total || start + 50 > total} onClick={() => setStart((value) => value + 50)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-cyan-50/60 disabled:opacity-30">Next 50<ChevronRight size={13} /></button></div></GlassCard>
    {selected ? <GlassCard className="mt-5 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/55">Selected occupation</p><h3 className="mt-1 text-xl font-black text-white">{text(selected.title)}</h3><p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/55">{text(selected.description)}</p><p className="mt-2 text-[10px] text-cyan-50/42">O*NET-SOC {text(selected.code)} · {details.length} detail sections · {summary.length} summary sections · {custom.length} custom sections</p></div><button type="button" onClick={() => { setSelected(null); setContent(null); setSelectedCode(""); }} className="rounded-lg border border-white/10 p-2 text-cyan-50/55"><X size={14} /></button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[...details, ...summary, ...custom].map((link, index) => <button key={`${link.href}-${index}`} type="button" onClick={() => void openContent(link)} className="rounded-xl border border-white/10 bg-black/15 p-3 text-left text-xs font-bold text-white hover:border-emerald-200/20">{link.title || "O*NET section"}<span className="mt-1 block text-[9px] font-normal text-cyan-50/42">Load every returned field/item</span></button>)}</div>{content ? <div className="mt-5 rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.025] p-4"><h4 className="text-sm font-black text-white">{content.title}</h4><div className="mt-3"><DataTree value={content.payload} /></div></div> : loading ? <div className="mt-4"><Loading label="Loading O*NET section…" /></div> : null}</GlassCard> : null}
  </section>;
}
