import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CalendarDays, FileBarChart, Loader2, RefreshCw } from "lucide-react";
import { GlassCard } from "@/components/insight/GlassCard";

type TrackerKey = "day-by-day" | "destruction" | "final";
type StructuredTable = { headers: string[]; rows: string[][] };
type StructuredPage = {
  path: string;
  url: string;
  title: string;
  headings: string[];
  text: string;
  tables: StructuredTable[];
  contentHash: string;
  fetchedAt: string;
  source: "live" | "database";
};

type PageResponse = { ok: boolean; page: StructuredPage; error?: string };

const TRACKERS: Array<{ key: TrackerKey; label: string; path: string; icon: typeof CalendarDays }> = [
  { key: "day-by-day", label: "Day by Day", path: "/iran-war-day-by-day", icon: CalendarDays },
  { key: "destruction", label: "Destruction", path: "/iran-destruction", icon: Building2 },
  { key: "final", label: "By the Numbers", path: "/iran-war-by-the-numbers", icon: FileBarChart },
];

async function readPage(path: string, refresh = false): Promise<StructuredPage> {
  const params = new URLSearchParams({ path });
  if (refresh) params.set("refresh", "1");
  const response = await fetch(`/api/war-costs/page-structure?${params.toString()}`, { headers: { Accept: "application/json" } });
  const payload = await response.json() as PageResponse;
  if (!response.ok || !payload.ok) throw new Error(payload.error || `WarCosts tracker failed with HTTP ${response.status}`);
  return payload.page;
}

function metric(text: string, pattern: RegExp, fallback = "—") {
  return text.match(pattern)?.[1]?.trim() || fallback;
}

function TrackerMetrics({ tracker, page }: { tracker: TrackerKey; page: StructuredPage }) {
  if (tracker === "destruction") {
    const values = [
      ["Sites struck", metric(page.text, /(\d[\d,]*\+?)\s+Sites Struck/i)],
      ["Damage estimate", metric(page.text, /(\$[\d,.]+B)\s+Damage Estimate/i)],
      ["Civilians displaced", metric(page.text, /(\d[\d,.]*K\+?)\s+Civilians Displaced/i)],
      ["Power grid offline", metric(page.text, /(\d+%)\s+Power Grid Offline/i)],
    ];
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{values.map(([label, value]) => <div key={label} className="rounded-xl border border-rose-200/10 bg-rose-300/[.04] p-3"><p className="text-xl font-black text-white">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-rose-100/45">{label}</p></div>)}</div>;
  }

  if (tracker === "final") {
    const values = [
      ["Duration", metric(page.text, /(\d+\s+days)\s+Duration/i)],
      ["Direct cost", metric(page.text, /(\$[\d,.]+B\+?)\s+Direct Cost/i)],
      ["Supplemental", metric(page.text, /(\$[\d,.]+B)\s+Supplemental/i)],
      ["Cost / day", metric(page.text, /(\$[\d,.]+M)\s+Cost\/Day/i)],
      ["US KIA", metric(page.text, /(\d+\+?)\s+US KIA/i)],
      ["US wounded", metric(page.text, /(\d[\d,]*\+?)\s+US Wounded/i)],
      ["Aircraft lost", metric(page.text, /(\d+)\s+Aircraft Lost/i)],
      ["Oil peak", metric(page.text, /(\$\d+\/bbl)\s+Oil Peak/i)],
    ];
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{values.map(([label, value]) => <div key={label} className="rounded-xl border border-amber-200/10 bg-amber-300/[.04] p-3"><p className="text-xl font-black text-white">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-amber-100/45">{label}</p></div>)}</div>;
  }

  const values = [
    ["Current day", metric(page.text, /Day\s+(\d+\+?)/i)],
    ["Current cost", metric(page.text, /(\$[\d,.]+B\+)\s+spent/i)],
    ["US KIA", metric(page.text, /(\d+\+?)\s+US KIA/i)],
    ["Total killed", metric(page.text, /(\d[\d,]*\+)\s+killed/i)],
  ];
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{values.map(([label, value]) => <div key={label} className="rounded-xl border border-cyan-200/10 bg-cyan-300/[.04] p-3"><p className="text-xl font-black text-white">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-cyan-100/45">{label}</p></div>)}</div>;
}

function StructuredTables({ tables }: { tables: StructuredTable[] }) {
  if (!tables.length) return <div className="rounded-xl border border-dashed border-white/10 p-5 text-xs text-cyan-100/40">This source page currently exposes its tracker primarily as narrative/visual content rather than HTML tables. The retained source evidence is shown below.</div>;
  return (
    <div className="space-y-4">
      {tables.slice(0, 5).map((table, tableIndex) => (
        <div key={tableIndex} className="overflow-x-auto rounded-xl border border-white/8 bg-black/10">
          <table className="w-full min-w-[720px] text-xs">
            <thead><tr className="text-left text-[9px] uppercase tracking-wider text-cyan-100/35">{table.headers.map((header, index) => <th key={`${header}-${index}`} className="p-3">{header}</th>)}</tr></thead>
            <tbody>{table.rows.slice(0, 250).map((row, rowIndex) => <tr key={rowIndex} className="border-t border-white/7">{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[420px] p-3 align-top text-cyan-50/68">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function WarCostsIranTrackers() {
  const [active, setActive] = useState<TrackerKey>("day-by-day");
  const [pages, setPages] = useState<Partial<Record<TrackerKey, StructuredPage>>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const entries = await Promise.all(TRACKERS.map(async (tracker) => [tracker.key, await readPage(tracker.path, refresh)] as const));
      setPages(Object.fromEntries(entries) as Record<TrackerKey, StructuredPage>);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Iran tracker pages could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);
  const page = pages[active];
  const activeMeta = useMemo(() => TRACKERS.find((tracker) => tracker.key === active) ?? TRACKERS[0], [active]);

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.2em] text-rose-100/35">Iran 2026 structured trackers</p>
          <h3 className="mt-1 text-lg font-black">Day-by-Day · Destruction · Final Accounting</h3>
          <p className="mt-1 text-xs text-cyan-100/40">Current WarCosts tracker pages are mirrored as structured priority evidence with live fetch + Neon fallback.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 text-[10px] font-bold"><RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />Refresh trackers</button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TRACKERS.map((tracker) => {
          const Icon = tracker.icon;
          return <button key={tracker.key} type="button" onClick={() => setActive(tracker.key)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[10px] font-bold ${active === tracker.key ? "border-rose-200/25 bg-rose-300/10 text-white" : "border-white/8 bg-black/10 text-cyan-100/45"}`}><Icon size={13} />{tracker.label}</button>;
        })}
      </div>

      {error && <div className="mt-4 flex gap-2 rounded-xl border border-amber-200/15 bg-amber-300/[.04] p-3 text-xs text-amber-100"><AlertTriangle size={15} className="shrink-0" />{error}</div>}
      {loading ? <div className="grid min-h-56 place-items-center"><Loader2 className="animate-spin text-cyan-200" /></div> : page ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black">{page.title}</p><p className="mt-1 text-[9px] text-cyan-100/35">{activeMeta.path} · {page.source} · {new Date(page.fetchedAt).toLocaleString()}</p></div><span className="rounded-full border border-white/8 px-2.5 py-1 text-[9px] text-cyan-100/40">{page.tables.length} structured tables</span></div>
          <TrackerMetrics tracker={active} page={page} />
          <StructuredTables tables={page.tables} />
          <details className="rounded-xl border border-white/8 bg-black/10 p-4"><summary className="cursor-pointer text-xs font-bold">Open retained source evidence</summary><p className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-[10px] leading-5 text-cyan-50/55">{page.text.slice(0, 40_000)}</p></details>
        </div>
      ) : null}
    </GlassCard>
  );
}
