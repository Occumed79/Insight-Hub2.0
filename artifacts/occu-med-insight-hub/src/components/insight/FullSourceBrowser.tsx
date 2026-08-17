import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FileJson,
  Loader2,
  Search,
  Table2,
} from "lucide-react";
import { GlassCard } from "@/components/insight/GlassCard";

type RecordRow = Record<string, unknown>;

type BlsDimension = { id: string; label: string; file: string; count: number; rows: RecordRow[] };
type BlsCatalog = { dataset: "is" | "fa"; title: string; description: string; officialUrl: string; dimensions: Record<string, BlsDimension> };
type OshaTable = { id: string; label: string; table: string; count: number; columns: Array<{ column_name: string; data_type: string; ordinal_position: number }> };

type SourceTab = "bls" | "osha" | "datagov";

const tabClass = (active: boolean) => `rounded-xl border px-4 py-2 text-xs font-black transition ${active ? "border-cyan-200/28 bg-cyan-300/12 text-white" : "border-white/10 bg-black/15 text-cyan-50/58 hover:border-cyan-200/20 hover:text-white"}`;

function text(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function rowLabel(row: RecordRow): string {
  const preferred = Object.keys(row).find((key) => /(_text|_name|title|label)$/i.test(key) && text(row[key]) !== "—");
  if (preferred) return text(row[preferred]);
  return Object.values(row).map(text).find((value) => value !== "—") ?? "Record";
}

function codeValue(row: RecordRow, key: string): string {
  return typeof row[key] === "string" ? row[key] as string : String(row[key] ?? "");
}

function GenericTable({ rows, columns, maxColumns = 40 }: { rows: RecordRow[]; columns?: string[]; maxColumns?: number }) {
  const keys = (columns?.length ? columns : Array.from(new Set(rows.flatMap((row) => Object.keys(row))))).slice(0, maxColumns);
  if (!rows.length) return <div className="rounded-xl border border-dashed border-white/12 p-6 text-center text-xs text-cyan-50/48">No rows returned for this view.</div>;
  return <div className="overflow-x-auto rounded-xl border border-white/10"><table className="min-w-full border-collapse text-left text-[10px]"><thead className="sticky top-0 bg-[#071321]"><tr>{keys.map((key) => <th key={key} className="whitespace-nowrap border-b border-white/10 px-3 py-2 font-black uppercase tracking-[0.08em] text-cyan-100/62">{key}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-white/[0.06] align-top hover:bg-white/[0.025]">{keys.map((key) => <td key={key} className="max-w-[360px] whitespace-pre-wrap break-words px-3 py-2 leading-5 text-cyan-50/68">{text(row[key])}</td>)}</tr>)}</tbody></table></div>;
}

function Loading({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/15 p-8 text-xs text-cyan-50/55"><Loader2 size={16} className="animate-spin" />{label}</div>;
}

function BlsBrowser() {
  const [dataset, setDataset] = useState<"is" | "fa">("is");
  const [catalog, setCatalog] = useState<BlsCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dimension, setDimension] = useState("");
  const [filter, setFilter] = useState("");
  const [visible, setVisible] = useState(75);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [faDetailType, setFaDetailType] = useState("industry");
  const [series, setSeries] = useState<RecordRow | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);

  useEffect(() => {
    setLoading(true); setError(""); setCatalog(null); setSeries(null); setSelection({});
    void fetch(`/api/occupational-source-browser/bls/catalog?dataset=${dataset}`).then((response) => response.json()).then((payload) => {
      if (!payload.ok) throw new Error(payload.error || "BLS catalog failed.");
      const next = payload.catalog as BlsCatalog;
      setCatalog(next);
      setDimension(Object.keys(next.dimensions)[0] ?? "");
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "BLS catalog failed.")).finally(() => setLoading(false));
  }, [dataset]);

  useEffect(() => { setVisible(75); setFilter(""); }, [dimension]);

  const active = catalog?.dimensions[dimension];
  const rows = useMemo(() => {
    if (!active) return [];
    const query = filter.trim().toLowerCase();
    if (!query) return active.rows;
    return active.rows.filter((row) => Object.values(row).some((value) => text(value).toLowerCase().includes(query)));
  }, [active, filter]);

  function options(id: string): RecordRow[] { return catalog?.dimensions[id]?.rows ?? []; }
  function selected(id: string, key: string): RecordRow | undefined {
    const rowsForDimension = options(id);
    const chosen = selection[id] || codeValue(rowsForDimension[0] ?? {}, key);
    return rowsForDimension.find((row) => codeValue(row, key) === chosen) ?? rowsForDimension[0];
  }

  async function loadSeries() {
    if (!catalog) return;
    setSeriesLoading(true); setSeries(null); setError("");
    try {
      let endpoint = "";
      if (dataset === "is") {
        const industry = selected("industry", "industry_code");
        const area = selected("area", "area_code");
        const dataType = selected("data_type", "data_type_code");
        const caseType = selected("case_type", "case_type_code");
        if (!industry || !area || !dataType || !caseType) throw new Error("BLS IS catalog dimensions are incomplete.");
        const params = new URLSearchParams({ supersector: codeValue(industry, "supersector_code"), industry: codeValue(industry, "industry_code"), area: codeValue(area, "area_code"), dataType: codeValue(dataType, "data_type_code"), caseType: codeValue(caseType, "case_type_code"), startYear: "2015", endYear: String(new Date().getFullYear()) });
        endpoint = `/api/occupational-source-browser/bls/is-series?${params}`;
      } else {
        const category = selected("category", "category_code");
        const detailKey = faDetailType === "event" ? "event_code" : faDetailType === "source" ? "source_code" : faDetailType === "occupation" ? "occupation_code" : "industry_code";
        const detail = selected(faDetailType, detailKey);
        const datatype = selected("datatype", "datatype_code");
        const caseCode = selected("case", "case_code");
        const area = selected("area", "area_code");
        if (!category || !detail || !datatype || !caseCode || !area) throw new Error("BLS CFOI catalog dimensions are incomplete.");
        const params = new URLSearchParams({ category: codeValue(category, "category_code"), detail: codeValue(detail, detailKey), datatype: codeValue(datatype, "datatype_code"), caseCode: codeValue(caseCode, "case_code"), area: codeValue(area, "area_code"), startYear: "2015", endYear: String(new Date().getFullYear()) });
        endpoint = `/api/occupational-source-browser/bls/fa-series?${params}`;
      }
      const response = await fetch(endpoint);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "BLS series request failed.");
      setSeries(payload as RecordRow);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "BLS series request failed."); }
    finally { setSeriesLoading(false); }
  }

  const selectField = (id: string, key: string, label: string) => {
    const dimensionRows = options(id);
    const value = selection[id] || codeValue(dimensionRows[0] ?? {}, key);
    return <label className="block"><span className="text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-50/50">{label}</span><select value={value} onChange={(event) => setSelection((current) => ({ ...current, [id]: event.target.value }))} className="mt-1 min-h-10 w-full rounded-xl border border-white/12 bg-[#040c16] px-3 text-xs text-white">{dimensionRows.map((row, index) => <option key={`${codeValue(row, key)}-${index}`} value={codeValue(row, key)}>{rowLabel(row)} · {codeValue(row, key)}</option>)}</select></label>;
  };

  const blsData = series?.payload as RecordRow | undefined;
  const results = blsData?.Results as RecordRow | undefined;
  const resultSeries = Array.isArray(results?.series) ? results?.series as RecordRow[] : [];
  const points = resultSeries.length && Array.isArray(resultSeries[0]?.data) ? resultSeries[0].data as RecordRow[] : [];

  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2"><button className={tabClass(dataset === "is")} onClick={() => setDataset("is")}>SOII — Nonfatal</button><button className={tabClass(dataset === "fa")} onClick={() => setDataset("fa")}>CFOI — Fatal</button></div>
    {loading ? <Loading label="Loading the complete BLS occupational mapping catalog…" /> : null}
    {error ? <div className="rounded-xl border border-rose-200/20 bg-rose-300/[0.05] p-4 text-xs text-rose-50"><AlertTriangle size={15} className="mr-2 inline" />{error}</div> : null}
    {catalog ? <>
      <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-50/50">Complete BLS source dimensions</p><h3 className="mt-1 text-xl font-black text-white">{catalog.title}</h3><p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/58">{catalog.description}</p></div><a href={catalog.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-cyan-200/70">Official files <ExternalLink size={12} /></a></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{Object.values(catalog.dimensions).map((item) => <button key={item.id} type="button" onClick={() => setDimension(item.id)} className={`rounded-xl border p-3 text-left ${dimension === item.id ? "border-cyan-200/28 bg-cyan-300/[0.07]" : "border-white/10 bg-black/15"}`}><p className="text-xs font-black text-white">{item.label}</p><p className="mt-1 text-[10px] text-cyan-50/45">{item.count.toLocaleString()} published values</p></button>)}</div></GlassCard>
      {active ? <GlassCard className="p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-50/50">{active.file}</p><h3 className="mt-1 text-lg font-black text-white">{active.label}</h3><p className="mt-1 text-xs text-cyan-50/48">Showing {Math.min(visible, rows.length).toLocaleString()} of {rows.length.toLocaleString()} matching published values.</p></div><label className="min-w-[260px]"><span className="text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-50/50">Filter this dimension</span><div className="mt-1 flex items-center rounded-xl border border-white/12 bg-[#040c16] px-3"><Search size={13} className="text-cyan-100/45" /><input value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-10 flex-1 bg-transparent px-2 text-xs text-white outline-none" placeholder="Type any code or label…" /></div></label></div><div className="mt-4"><GenericTable rows={rows.slice(0, visible)} /></div>{visible < rows.length ? <button type="button" onClick={() => setVisible((value) => value + 100)} className="mt-3 rounded-xl border border-white/12 px-4 py-2 text-xs font-bold text-cyan-50/65">Show 100 more</button> : null}</GlassCard> : null}
      <GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100/55">Any valid BLS series — no hidden preset list</p><h3 className="mt-1 text-lg font-black text-white">Build a series from the source dimensions above</h3><p className="mt-1 text-xs leading-5 text-cyan-50/48">Every selector is populated from the official BLS mapping files. The app builds the documented series ID internally and requests the historical observations from the BLS Public Data API.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{dataset === "is" ? <>{selectField("industry", "industry_code", "Industry")}{selectField("area", "area_code", "Area")}{selectField("data_type", "data_type_code", "Measure / data type")}{selectField("case_type", "case_type_code", "Case type")}</> : <>{selectField("category", "category_code", "Category")}<label className="block"><span className="text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-50/50">Detail dimension</span><select value={faDetailType} onChange={(event) => setFaDetailType(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-white/12 bg-[#040c16] px-3 text-xs text-white"><option value="industry">Industry</option><option value="occupation">Occupation</option><option value="event">Event / exposure</option><option value="source">Source of injury</option></select></label>{selectField(faDetailType, faDetailType === "event" ? "event_code" : faDetailType === "source" ? "source_code" : faDetailType === "occupation" ? "occupation_code" : "industry_code", "Selected detail")}{selectField("datatype", "datatype_code", "Data type")}{selectField("case", "case_code", "Case classification")}{selectField("area", "area_code", "Area")}</>}</div><button type="button" onClick={() => void loadSeries()} disabled={seriesLoading} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200/24 bg-emerald-300/10 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{seriesLoading ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}Load official historical series</button>{series ? <div className="mt-4"><div className="mb-2 text-xs text-cyan-50/60">Series ID: <span className="font-mono font-bold text-white">{text(series.seriesId)}</span></div><GenericTable rows={points} /></div> : null}</GlassCard>
    </> : null}
  </div>;
}

function OshaBrowser() {
  const [catalog, setCatalog] = useState<{ configured: boolean; tables: OshaTable[]; warning?: string } | null>(null);
  const [table, setTable] = useState("summary");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<{ rows: RecordRow[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState(""); const [state, setState] = useState(""); const [year, setYear] = useState(""); const [naics, setNaics] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => { void fetch("/api/occupational-source-browser/osha/catalog").then((response) => response.json()).then((data) => setCatalog(data.ok ? data : { configured: false, tables: [], warning: data.error })).catch((error) => setCatalog({ configured: false, tables: [], warning: String(error) })); }, []);
  useEffect(() => {
    if (!catalog?.configured) return;
    setLoading(true);
    const params = new URLSearchParams({ table, page: String(page), limit: "50" });
    if (company) params.set("company", company); if (state) params.set("state", state); if (year) params.set("year", year); if (naics) params.set("naics", naics);
    void fetch(`/api/occupational-source-browser/osha/rows?${params}`).then((response) => response.json()).then((data) => { if (!data.ok) throw new Error(data.error); setPayload(data); }).catch(() => setPayload({ rows: [], total: 0, pages: 1 })).finally(() => setLoading(false));
  }, [catalog?.configured, table, page, nonce]);

  const tableSpec = catalog?.tables.find((item) => item.id === table);
  return <div className="space-y-5">
    {!catalog ? <Loading label="Reading the OSHA database schema…" /> : !catalog.configured ? <div className="rounded-xl border border-amber-200/18 bg-amber-300/[0.05] p-4 text-xs leading-6 text-amber-50/70">{catalog.warning || "OSHA persistence is not configured in this environment."}</div> : <>
      <GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-50/50">Every imported OSHA table</p><h3 className="mt-1 text-xl font-black text-white">Raw database browser</h3><p className="mt-2 text-xs leading-6 text-cyan-50/55">This is not a prepared ranking. Every column and every imported row in the OSHA ITA tables is accessible here, paginated so the browser does not try to render hundreds of thousands of rows at once.</p><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{catalog.tables.map((item) => <button key={item.id} type="button" onClick={() => { setTable(item.id); setPage(1); setPayload(null); }} className={`rounded-xl border p-3 text-left ${table === item.id ? "border-cyan-200/28 bg-cyan-300/[0.07]" : "border-white/10 bg-black/15"}`}><p className="text-xs font-black text-white">{item.label}</p><p className="mt-1 text-[10px] text-cyan-50/45">{item.count.toLocaleString()} rows · {item.columns.length} columns</p></button>)}</div></GlassCard>
      {tableSpec ? <GlassCard className="p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-50/50">Schema</p><h3 className="mt-1 text-lg font-black text-white">{tableSpec.label}</h3></div><div className="text-xs text-cyan-50/45">{tableSpec.count.toLocaleString()} total rows</div></div><div className="mt-3 flex flex-wrap gap-1.5">{tableSpec.columns.map((column) => <span key={column.column_name} className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[9px] text-cyan-50/62">{column.column_name} <span className="text-cyan-50/35">{column.data_type}</span></span>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company contains…" className="min-h-10 rounded-xl border border-white/12 bg-[#040c16] px-3 text-xs text-white" /><input value={state} onChange={(event) => setState(event.target.value)} placeholder="State" className="min-h-10 rounded-xl border border-white/12 bg-[#040c16] px-3 text-xs text-white" /><input value={year} onChange={(event) => setYear(event.target.value)} placeholder="Year" className="min-h-10 rounded-xl border border-white/12 bg-[#040c16] px-3 text-xs text-white" /><input value={naics} onChange={(event) => setNaics(event.target.value)} placeholder="NAICS prefix" className="min-h-10 rounded-xl border border-white/12 bg-[#040c16] px-3 text-xs text-white" /></div><button type="button" onClick={() => { setPage(1); setNonce((value) => value + 1); }} className="mt-3 rounded-xl border border-cyan-200/22 bg-cyan-300/[0.07] px-4 py-2 text-xs font-black text-white">Apply filters</button><div className="mt-4">{loading ? <Loading label="Loading OSHA rows…" /> : <GenericTable rows={payload?.rows ?? []} columns={tableSpec.columns.map((column) => column.column_name)} maxColumns={80} />}</div><div className="mt-3 flex items-center justify-between gap-3 text-xs text-cyan-50/55"><span>{(payload?.total ?? 0).toLocaleString()} matching rows</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronLeft size={14} /></button><span>Page {page} of {payload?.pages ?? 1}</span><button disabled={page >= (payload?.pages ?? 1)} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronRight size={14} /></button></div></div></GlassCard> : null}
    </>}
  </div>;
}

function DataGovBrowser() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<{ datasets: RecordRow[]; total: number; pages: number; limitation?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [preview, setPreview] = useState<RecordRow | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), rows: "20" }); if (submitted) params.set("q", submitted);
    void fetch(`/api/occupational-source-browser/datagov/catalog?${params}`).then((response) => response.json()).then((data) => { if (!data.ok) throw new Error(data.error); setPayload(data); }).catch(() => setPayload({ datasets: [], total: 0, pages: 1 })).finally(() => setLoading(false));
  }, [page, submitted]);

  async function openDataset(dataset: RecordRow) {
    const id = text(dataset.id || dataset.name);
    try { const response = await fetch(`/api/occupational-source-browser/datagov/dataset/${encodeURIComponent(id)}`); const data = await response.json(); setSelected(data.ok ? data.dataset : dataset); } catch { setSelected(dataset); }
  }
  async function previewResource(resource: RecordRow) {
    const id = text(resource.id);
    setPreview({ loading: true });
    try { const response = await fetch(`/api/occupational-discovery/datagov-datastore-preview?resource=${encodeURIComponent(id)}`); const data = await response.json(); setPreview(data); } catch (error) { setPreview({ ok: false, error: String(error) }); }
  }

  return <div className="space-y-5">
    <GlassCard className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-50/50">Complete Data.gov catalog browser</p><h3 className="mt-1 text-xl font-black text-white">Browse the catalog without knowing a magic search term</h3><p className="mt-2 text-xs leading-6 text-cyan-50/55">An empty search walks the entire Data.gov metadata catalog page by page. Search only narrows it. Open any dataset to inspect its complete catalog metadata and every listed resource.</p><form onSubmit={(event) => { event.preventDefault(); setPage(1); setSubmitted(query.trim()); }} className="mt-4 flex gap-2"><div className="flex min-h-11 flex-1 items-center rounded-xl border border-white/12 bg-[#040c16] px-3"><Search size={14} className="text-cyan-100/45" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Optional filter — leave blank for the complete catalog" className="min-h-10 flex-1 bg-transparent px-2 text-xs text-white outline-none" /></div><button className="rounded-xl border border-cyan-200/22 bg-cyan-300/[0.07] px-4 text-xs font-black text-white">Browse</button></form></GlassCard>
    {loading ? <Loading label="Loading Data.gov catalog page…" /> : <><div className="grid gap-3 xl:grid-cols-2">{(payload?.datasets ?? []).map((dataset, index) => { const resources = Array.isArray(dataset.resources) ? dataset.resources as RecordRow[] : []; const organization = dataset.organization && typeof dataset.organization === "object" ? dataset.organization as RecordRow : {}; return <GlassCard key={text(dataset.id || dataset.name || index)} className="p-4"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-50/45">{text(organization.title || organization.name)}</p><h4 className="mt-1 text-sm font-black text-white">{text(dataset.title || dataset.name)}</h4><p className="mt-2 line-clamp-4 text-[10px] leading-5 text-cyan-50/52">{text(dataset.notes)}</p><div className="mt-3 flex flex-wrap gap-1">{resources.slice(0, 12).map((resource, resourceIndex) => <span key={resourceIndex} className="rounded-full border border-white/10 px-2 py-1 text-[8px] text-cyan-50/55">{text(resource.format || "resource")}</span>)}</div><button type="button" onClick={() => void openDataset(dataset)} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-white/12 px-3 py-2 text-[10px] font-bold text-cyan-100/70"><FileJson size={12} />All metadata & resources</button></GlassCard>; })}</div><div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-xs text-cyan-50/55"><span>{(payload?.total ?? 0).toLocaleString()} catalog records</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronLeft size={14} /></button><span>Page {page} of {payload?.pages ?? 1}</span><button disabled={page >= (payload?.pages ?? 1)} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronRight size={14} /></button></div></div></>}
    {selected ? <GlassCard className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-100/55">Complete dataset metadata</p><h3 className="mt-1 text-lg font-black text-white">{text(selected.title || selected.name)}</h3></div><button type="button" onClick={() => { setSelected(null); setPreview(null); }} className="text-xs text-cyan-50/50">Close</button></div><div className="mt-4"><GenericTable rows={Object.entries(selected).filter(([key]) => key !== "resources").map(([key, value]) => ({ field: key, value }))} columns={["field", "value"]} /></div><h4 className="mt-5 text-sm font-black text-white">Resources</h4><div className="mt-3 space-y-2">{(Array.isArray(selected.resources) ? selected.resources as RecordRow[] : []).map((resource, index) => <div key={index} className="rounded-xl border border-white/10 bg-black/15 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-white">{text(resource.name || resource.description || `Resource ${index + 1}`)}</p><p className="mt-1 text-[9px] text-cyan-50/45">{text(resource.format)} · {text(resource.mimetype)}</p></div><div className="flex gap-2">{Boolean(resource.datastore_active) && resource.id ? <button type="button" onClick={() => void previewResource(resource)} className="rounded-lg border border-emerald-200/20 bg-emerald-300/[0.06] px-3 py-2 text-[9px] font-bold text-emerald-50">Preview actual data</button> : null}{resource.url ? <a href={text(resource.url)} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-[9px] font-bold text-cyan-50/65">Open source</a> : null}</div></div></div>)}</div>{preview ? <div className="mt-5"><h4 className="text-sm font-black text-white">Datastore preview</h4>{preview.loading ? <Loading label="Loading resource data…" /> : preview.ok === false ? <p className="mt-2 text-xs text-rose-100/70">{text(preview.error)}</p> : <><div className="mt-3"><GenericTable rows={Array.isArray(preview.records) ? preview.records as RecordRow[] : []} /></div><p className="mt-2 text-[9px] text-cyan-50/40">{text(preview.limitation)}</p></>}</div> : null}</GlassCard> : null}
  </div>;
}

export function FullSourceBrowser() {
  const [tab, setTab] = useState<SourceTab>("bls");
  return <section className="mb-7 rounded-[26px] border border-fuchsia-200/16 bg-[#050d18]/96 p-4 shadow-[0_24px_70px_rgba(0,0,0,.34)] md:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-fuchsia-100/70"><Database size={17} /><p className="text-[10px] font-black uppercase tracking-[0.18em]">Full Source Browser</p></div><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">If the source contains it, the page exposes it.</h2><p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/58">Prepared intelligence stays below, but it is no longer the ceiling. Browse the complete BLS occupational dimensions, every imported OSHA table/column/row, and the full Data.gov metadata catalog directly from the app.</p></div><Table2 size={24} className="text-fuchsia-200/45" /></div><div className="my-5 flex flex-wrap gap-2"><button className={tabClass(tab === "bls")} onClick={() => setTab("bls")}>BLS — all occupational dimensions</button><button className={tabClass(tab === "osha")} onClick={() => setTab("osha")}>OSHA — all imported rows</button><button className={tabClass(tab === "datagov")} onClick={() => setTab("datagov")}>Data.gov — full catalog</button></div>{tab === "bls" ? <BlsBrowser /> : tab === "osha" ? <OshaBrowser /> : <DataGovBrowser />}</section>;
}
