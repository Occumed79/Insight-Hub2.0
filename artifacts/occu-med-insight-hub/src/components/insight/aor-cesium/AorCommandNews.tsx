import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleSlash, ExternalLink, History, Loader2, RefreshCw, Stethoscope } from "lucide-react";
import type { CommandId } from "./aor-directory";
import { COMMAND_VIEW } from "./aor-directory";
import { NEWS_KIND_LABEL, NEWS_METHOD_LABEL, NEWS_STATUS_LABEL, type NewsItem, type NewsSourceReport, type NewsSourceStatus } from "./aor-news-types";
import { useCommandNews } from "./use-command-news";

const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : null);
const dateTimeText = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }) : "never");

const STATUS_ICON: Record<NewsSourceStatus, typeof CheckCircle2> = { ok: CheckCircle2, source_returned_no_data: CircleSlash, source_unavailable: AlertTriangle, stale_cache: History };
const STATUS_STYLE: Record<NewsSourceStatus, string> = {
  ok: "border-emerald-300/30 text-emerald-100",
  source_returned_no_data: "border-slate-300/30 text-slate-200",
  source_unavailable: "border-rose-300/45 text-rose-100",
  stale_cache: "border-amber-300/45 text-amber-100",
};

function SourceRow({ source }: { source: NewsSourceReport }) {
  const Icon = STATUS_ICON[source.status];
  return (
    <li data-testid="aor-news-source" data-source-id={source.sourceId} data-status={source.status} className="rounded-lg border border-white/[.06] px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[10px] font-bold leading-4 text-white/90">{source.sourceName}</p>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[.06em] ${STATUS_STYLE[source.status]}`}><Icon size={9} aria-hidden />{NEWS_STATUS_LABEL[source.status]}</span>
      </div>
      <p className="mt-0.5 text-[9px] leading-4 text-slate-400">
        {source.method ? `${NEWS_METHOD_LABEL[source.method]} · ` : ""}{source.itemCount} item{source.itemCount === 1 ? "" : "s"} · last successful fetch {dateTimeText(source.lastSuccessfulFetch)}
      </p>
      {source.sourceError ? <p className="text-[9px] leading-4 text-rose-200/90">Last attempt {dateTimeText(source.lastAttemptedFetch)} failed: {source.sourceError}</p> : null}
      {source.note ? <p className="text-[9px] leading-4 text-slate-400">{source.note}</p> : null}
      {source.urlBasis === "expected_not_yet_confirmed" ? <p className="text-[9px] leading-4 text-amber-100/80">This page address follows the command site's pattern but has not been confirmed by a response yet.</p> : null}
      <a href={source.listingUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-bold text-cyan-100/75 hover:text-cyan-50">Open the official page <ExternalLink size={8} aria-hidden /></a>
    </li>
  );
}

function ItemRow({ item }: { item: NewsItem }) {
  const published = dateText(item.publishedAt);
  return (
    <li data-testid="aor-news-item" data-health={item.healthTerms.length ? "true" : "false"} className="border-b border-white/[.05] py-2">
      <a href={item.url} target="_blank" rel="noreferrer" className="text-[11px] font-bold leading-4 text-white/90 hover:text-cyan-50">{item.title} <ExternalLink size={9} className="inline" aria-hidden /></a>
      {item.summary ? <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{item.summary}</p> : null}
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
        <span>{published ?? "No date stated by the source"}</span>
        <span>{NEWS_KIND_LABEL[item.kind]} · {item.sourceName}</span>
        {item.lastKnownData ? <span className="inline-flex items-center gap-0.5 text-amber-200/90"><History size={8} aria-hidden />Last-known item</span> : null}
        {item.healthTerms.length ? <span className="inline-flex items-center gap-0.5 text-emerald-200/85" title="Keywords found in the item's own title or description"><Stethoscope size={8} aria-hidden />Mentions {item.healthTerms.slice(0, 3).join(", ")}</span> : null}
      </p>
    </li>
  );
}

/** Official command news, press releases and publications, with the monitoring state of every source. Context only; never a medical requirement. */
export function AorCommandNews({ command, active }: { command: CommandId; active: boolean }) {
  const { result, refreshing, reload } = useCommandNews(command, active);
  const [healthOnly, setHealthOnly] = useState(false);
  const label = COMMAND_VIEW[command].label;

  if (result.state === "loading") return <div data-testid="aor-news-loading" className="grid place-items-center py-8 text-[10px] text-slate-400"><Loader2 className="mb-2 animate-spin" size={16} />Checking {label} official sources…</div>;
  if (result.state === "error") return (
    <div data-testid="aor-news-error" className="rounded-xl border border-rose-300/30 px-3 py-2 text-[10px] leading-4 text-rose-100/90">
      <AlertTriangle size={11} className="mr-1 inline" aria-hidden />The command news service could not be reached ({result.message}). No news is shown, which says nothing about what the command has published.
      <button type="button" onClick={() => void reload()} className="ml-2 font-bold text-cyan-100/80 underline">Try again</button>
    </div>
  );

  const { data } = result;
  const shown = healthOnly ? data.items.filter((item) => item.healthTerms.length) : data.items;
  const reachable = data.sources.filter((source) => source.status === "ok" || source.status === "stale_cache").length;
  return (
    <div data-testid="aor-news" data-coverage={data.coverage}>
      <p data-testid="aor-news-disclaimer" className="rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2 text-[9px] leading-4 text-slate-300">{data.limitations[0]}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[9px] text-slate-400" data-testid="aor-news-coverage">{reachable} of {data.sources.length} {label} sources returned items · checked {dateTimeText(data.generatedAt)}</p>
        <button type="button" data-testid="aor-news-refresh" onClick={() => void reload()} disabled={refreshing} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white disabled:opacity-50"><RefreshCw size={9} className={refreshing ? "animate-spin" : ""} aria-hidden />Refresh</button>
      </div>
      {data.coverage === "no_source_available" ? <p data-testid="aor-news-none" className="mt-2 rounded-xl border border-rose-300/30 px-3 py-2 text-[10px] leading-4 text-rose-100/90">None of the {label} sources could be read right now. Nothing is shown; this does not mean the command has published nothing. Use the official page links below.</p> : null}

      <div className="mt-3 flex items-center justify-between">
        <h3 className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Items ({shown.length}{healthOnly ? ` of ${data.items.length}` : ""})</h3>
        <button type="button" data-testid="aor-news-health-filter" aria-pressed={healthOnly} onClick={() => setHealthOnly((value) => !value)} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${healthOnly ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" : "border-white/10 text-slate-400 hover:text-white"}`}><Stethoscope size={9} aria-hidden />Health-related only</button>
      </div>
      {shown.length ? <ul>{shown.map((item) => <ItemRow key={item.id} item={item} />)}</ul> : data.coverage === "no_source_available" ? null : <p className="py-3 text-[10px] text-slate-500">{healthOnly ? "No item mentions health terms in its own title or description." : "No items were read from the sources."}</p>}

      <h3 className="mt-4 text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Source monitoring</h3>
      <ul className="mt-1 space-y-1.5">{data.sources.map((source) => <SourceRow key={source.sourceId} source={source} />)}</ul>
      <ul className="mt-3 space-y-1 pb-2">{data.limitations.slice(1).map((text) => <li key={text} className="text-[9px] leading-4 text-slate-500">{text}</li>)}</ul>
    </div>
  );
}
