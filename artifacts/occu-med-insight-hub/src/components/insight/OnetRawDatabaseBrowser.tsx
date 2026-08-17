import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Database, Loader2, Table2, X } from "lucide-react";
import { GlassCard } from "@/components/insight/GlassCard";

type RecordRow = Record<string, unknown>;
type OnetTable = { table_id?: string; title?: string; description?: string };
type TableInfo = { table_id?: string; title?: string; description?: string; data_dictionary?: string; download?: RecordRow; column?: RecordRow[] };

function text(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function Loading({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/15 p-7 text-xs text-cyan-50/52"><Loader2 size={15} className="animate-spin" />{label}</div>;
}

function RawTable({ rows }: { rows: RecordRow[] }) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  if (!rows.length) return <div className="rounded-xl border border-dashed border-white/12 p-6 text-center text-xs text-cyan-50/45">No rows returned on this page.</div>;
  return <div className="overflow-x-auto rounded-xl border border-white/10"><table className="min-w-full border-collapse text-left text-[10px]"><thead className="bg-[#071321]"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap border-b border-white/10 px-3 py-2 font-black uppercase tracking-[0.08em] text-cyan-100/58">{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-white/[0.06] align-top hover:bg-white/[0.025]">{columns.map((column) => <td key={column} className="max-w-[380px] whitespace-pre-wrap break-words px-3 py-2 leading-5 text-cyan-50/68">{text(row[column])}</td>)}</tr>)}</tbody></table></div>;
}

export function OnetRawDatabaseBrowser() {
  const [tables, setTables] = useState<OnetTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<OnetTable | null>(null);
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [start, setStart] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    setLoading(true); setError("");
    void fetch("/api/occupational-source-browser/onet/database/tables").then((response) => response.json()).then((payload) => {
      if (!payload.ok) throw new Error(payload.error || "O*NET database listing failed.");
      setTables(Array.isArray(payload.tables) ? payload.tables : []);
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "O*NET database listing failed.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected?.table_id) return;
    const tableId = selected.table_id;
    setLoading(true); setError("");
    void Promise.all([
      fetch(`/api/occupational-source-browser/onet/database/table/${encodeURIComponent(tableId)}`).then((response) => response.json()),
      fetch(`/api/occupational-source-browser/onet/database/table/${encodeURIComponent(tableId)}/rows?start=${start}&end=${start + pageSize - 1}`).then((response) => response.json()),
    ]).then(([infoPayload, rowPayload]) => {
      if (!infoPayload.ok) throw new Error(infoPayload.error || "O*NET table information failed.");
      if (!rowPayload.ok) throw new Error(rowPayload.error || "O*NET table rows failed.");
      setInfo(infoPayload.info as TableInfo);
      const data = rowPayload.payload as RecordRow;
      setRows(Array.isArray(data?.row) ? data.row as RecordRow[] : []);
      setTotal(Number(data?.total ?? 0));
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "O*NET table load failed.")).finally(() => setLoading(false));
  }, [selected?.table_id, start]);

  const query = filter.trim().toLowerCase();
  const visible = tables.filter((table) => !query || [table.table_id, table.title, table.description].some((value) => text(value).toLowerCase().includes(query)));
  const columns = Array.isArray(info?.column) ? info.column : [];
  const downloads = info?.download && typeof info.download === "object" ? Object.entries(info.download) : [];

  return <section className="mb-7 rounded-[26px] border border-emerald-200/16 bg-[#050d18]/96 p-4 shadow-[0_24px_70px_rgba(0,0,0,.34)] md:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-emerald-100/70"><Database size={17} /><p className="text-[10px] font-black uppercase tracking-[0.18em]">O*NET Raw Database</p></div><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Every O*NET database table is on the page.</h2><p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/58">This uses O*NET Database Services directly. Each item below corresponds to a file in the downloadable O*NET Database. Open any table to see every documented column and page through all source rows.</p></div><Table2 size={24} className="text-emerald-200/45" /></div>
    {error ? <div className="mt-4 rounded-xl border border-rose-200/18 bg-rose-300/[0.05] p-3 text-xs text-rose-50/70">{error}</div> : null}
    {loading && !tables.length ? <div className="mt-5"><Loading label="Loading every O*NET database table…" /></div> : null}
    {tables.length ? <GlassCard className="mt-5 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/55">Database inventory</p><h3 className="mt-1 text-lg font-black text-white">{tables.length.toLocaleString()} source tables</h3></div><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Optional table filter…" className="min-h-10 min-w-[260px] rounded-xl border border-white/12 bg-[#040c16] px-3 text-xs text-white outline-none" /></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{visible.map((table) => <button key={table.table_id} type="button" onClick={() => { setSelected(table); setStart(1); setInfo(null); setRows([]); }} className="rounded-xl border border-white/10 bg-black/15 p-3 text-left transition hover:border-emerald-200/22 hover:bg-emerald-300/[0.045]"><p className="text-xs font-black text-white">{text(table.title)}</p><p className="mt-1 font-mono text-[9px] text-emerald-100/55">{text(table.table_id)}</p><p className="mt-2 line-clamp-3 text-[10px] leading-5 text-cyan-50/48">{text(table.description)}</p></button>)}</div></GlassCard> : null}
    {selected ? <GlassCard className="mt-5 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100/52">Selected database table</p><h3 className="mt-1 text-xl font-black text-white">{text(info?.title || selected.title)}</h3><p className="mt-1 font-mono text-[10px] text-emerald-100/55">{text(selected.table_id)}</p><p className="mt-2 max-w-4xl text-xs leading-6 text-cyan-50/55">{text(info?.description || selected.description)}</p></div><button type="button" onClick={() => { setSelected(null); setInfo(null); setRows([]); setTotal(0); }} className="rounded-lg border border-white/10 p-2 text-cyan-50/55"><X size={14} /></button></div>{loading ? <div className="mt-4"><Loading label="Loading table schema and rows…" /></div> : <><div className="mt-4 flex flex-wrap gap-1.5">{columns.map((column, index) => <span key={`${text(column.column_id)}-${index}`} title={text(column.description)} className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[9px] text-cyan-50/62">{text(column.column_id)} <span className="text-cyan-50/35">{text(column.type)}</span></span>)}</div>{info?.data_dictionary ? <a href={info.data_dictionary} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[10px] font-bold text-cyan-200/65">Open official data dictionary</a> : null}{downloads.length ? <div className="mt-3 flex flex-wrap gap-2">{downloads.map(([format, url]) => <a key={format} href={text(url)} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] font-bold text-cyan-50/58">Download {format}</a>)}</div> : null}<div className="mt-4"><RawTable rows={rows} /></div><div className="mt-3 flex items-center justify-between gap-3 text-xs text-cyan-50/55"><span>{total.toLocaleString()} total rows · showing {start.toLocaleString()}–{Math.min(start + pageSize - 1, total).toLocaleString()}</span><div className="flex gap-2"><button type="button" disabled={start <= 1} onClick={() => setStart((value) => Math.max(1, value - pageSize))} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronLeft size={14} /></button><button type="button" disabled={start + pageSize > total} onClick={() => setStart((value) => value + pageSize)} className="rounded-lg border border-white/10 p-2 disabled:opacity-30"><ChevronRight size={14} /></button></div></div></>}</GlassCard> : null}
  </section>;
}
