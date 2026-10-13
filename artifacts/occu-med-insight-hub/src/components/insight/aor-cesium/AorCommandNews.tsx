import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleSlash, ExternalLink, History, Loader2, MapPin, RefreshCw, Search, Sparkles, Stethoscope } from "lucide-react";
import type { CommandId } from "./aor-directory";
import { COMMAND_VIEW } from "./aor-directory";
import {
  FEED_ROLE_LABEL, FEED_STATUS_LABEL, NEWS_KINDS, NEWS_KIND_LABEL, NEWS_KIND_PLURAL, NEWS_METHOD_LABEL, NEWS_STATUS_LABEL, URL_BASIS_NOTE,
  type FeedAttempt, type NewsItem, type NewsKind, type NewsSourceReport, type NewsSourceStatus,
} from "./aor-news-types";
import { useCommandNews } from "./use-command-news";

const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : null);
const dateTimeText = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }) : "never");
const RECENT_MS = 7 * 24 * 3_600_000;
const within = (iso: string | null, reference: string) => Boolean(iso) && Date.parse(reference) - Date.parse(iso!) <= RECENT_MS;

/** New = first seen by the monitor in the last 7 days AND not already on the source when monitoring began. Updated = the source changed it in the last 7 days. */
export const isNewItem = (item: NewsItem, reference: string) => !item.baseline && within(item.firstSeenAt, reference);
export const isUpdatedItem = (item: NewsItem, reference: string) => item.changeCount > 0 && within(item.lastChangedAt, reference);

const STATUS_ICON: Record<NewsSourceStatus, typeof CheckCircle2> = { ok: CheckCircle2, source_returned_no_data: CircleSlash, source_unavailable: AlertTriangle, stale_cache: History };
const STATUS_STYLE: Record<NewsSourceStatus, string> = {
  ok: "border-emerald-300/30 text-emerald-100",
  source_returned_no_data: "border-slate-300/30 text-slate-200",
  source_unavailable: "border-rose-300/45 text-rose-100",
  stale_cache: "border-amber-300/45 text-amber-100",
};

function FeedRow({ feed }: { feed: FeedAttempt }) {
  const bad = feed.status === "unavailable";
  return (
    <li data-testid="aor-news-feed" data-status={feed.status} className="border-t border-white/[.04] py-1 text-[12px] leading-4">
      <span className={bad ? "font-bold text-rose-200" : feed.status === "ok" ? "font-bold text-emerald-200" : "font-bold text-slate-300"}>{FEED_STATUS_LABEL[feed.status]}</span>
      <span className="text-slate-400"> · {FEED_ROLE_LABEL[feed.role]}{feed.kind ? ` · ${NEWS_KIND_LABEL[feed.kind]}` : ""}{feed.httpStatus ? ` · HTTP ${feed.httpStatus}` : ""}{feed.role === "directory" ? ` · ${feed.itemCount} feed${feed.itemCount === 1 ? "" : "s"} listed` : ` · ${feed.itemCount} item${feed.itemCount === 1 ? "" : "s"}`}</span>
      <a href={feed.url} target="_blank" rel="noreferrer" className="block break-all text-cyan-100/70 hover:text-cyan-50">{feed.url}</a>
      {feed.error ? <span className="block text-rose-200/90">{feed.error}</span> : null}
    </li>
  );
}

function SourceRow({ source }: { source: NewsSourceReport }) {
  const Icon = STATUS_ICON[source.status];
  const basis = URL_BASIS_NOTE[source.urlBasis];
  const failed = source.feeds.filter((feed) => feed.status === "unavailable" && feed.role !== "directory").length;
  return (
    <li data-testid="aor-news-source" data-source-id={source.sourceId} data-status={source.status} className="rounded-lg border border-white/[.06] px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[13px] font-bold leading-4 text-white/90">{source.sourceName}</p>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[source.status]}`}><Icon size={9} aria-hidden />{NEWS_STATUS_LABEL[source.status]}</span>
      </div>
      <p className="mt-0.5 text-[12px] leading-4 text-slate-400">
        {source.method ? `${NEWS_METHOD_LABEL[source.method]} · ` : ""}{source.itemCount} item{source.itemCount === 1 ? "" : "s"} · last successful fetch {dateTimeText(source.lastSuccessfulFetch)}
      </p>
      {source.sourceError ? <p className="text-[12px] leading-4 text-rose-200/90">Last attempt {dateTimeText(source.lastAttemptedFetch)} failed: {source.sourceError}</p> : null}
      {source.note ? <p className="text-[12px] leading-4 text-slate-400">{source.note}</p> : null}
      {basis ? <p className="text-[12px] leading-4 text-amber-100/80">{basis}</p> : null}
      {source.feeds.length ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[12px] font-bold text-slate-300 hover:text-white">Feed health ({source.feeds.length - failed - source.feeds.filter((feed) => feed.status === "not_needed").length} readable{failed ? `, ${failed} unavailable` : ""})</summary>
          <ul className="mt-1">{source.feeds.map((feed) => <FeedRow key={`${feed.role}:${feed.url}`} feed={feed} />)}</ul>
        </details>
      ) : null}
      <a href={source.listingUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-bold text-cyan-100/75 hover:text-cyan-50">Open the official page <ExternalLink size={8} aria-hidden /></a>
    </li>
  );
}

function ItemRow({ item, reference, command }: { item: NewsItem; reference: string; command: string }) {
  const published = dateText(item.publishedAt);
  const isNew = isNewItem(item, reference);
  const isUpdated = isUpdatedItem(item, reference);
  const otherSources = item.sources.length > 1;
  return (
    <li data-testid="aor-news-item" data-kind={item.kind} data-health={item.healthTerms.length ? "true" : "false"} data-new={isNew ? "true" : "false"} data-updated={isUpdated ? "true" : "false"} className="border-b border-white/[.05] py-2">
      <div className="flex flex-wrap items-center gap-1">
        <span data-testid="aor-news-kind" className="rounded-full border border-white/10 px-1.5 py-px text-[11px] font-semibold text-slate-300">{NEWS_KIND_LABEL[item.kind]}</span>
        {isNew ? <span data-testid="aor-news-badge-new" className="inline-flex items-center gap-0.5 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-1.5 py-px text-[11px] font-semibold text-cyan-100"><Sparkles size={8} aria-hidden />New</span> : null}
        {isUpdated ? <span data-testid="aor-news-badge-updated" title={item.lastChange ? `Changed ${item.lastChange.fields.join(", ")} on ${dateTimeText(item.lastChange.at)}` : undefined} className="inline-flex items-center gap-0.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-1.5 py-px text-[11px] font-semibold text-amber-100"><RefreshCw size={8} aria-hidden />Updated</span> : null}
        {item.lastKnownData ? <span className="inline-flex items-center gap-0.5 text-[12px] text-amber-200/90"><History size={8} aria-hidden />Last-known item</span> : null}
      </div>
      <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block text-[14px] font-bold leading-4 text-white/90 hover:text-cyan-50">{item.title} <ExternalLink size={9} className="inline" aria-hidden /></a>
      {item.summary ? <p className="mt-0.5 text-[13px] leading-4 text-slate-400">{item.summary}</p> : null}
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-500">
        <span data-testid="aor-news-date">{published ?? (item.updatedAt ? `Updated ${dateText(item.updatedAt)} (no publication date stated)` : "No date stated by the source")}</span>
        <span>{item.sourceName}{otherSources ? ` + ${item.sources.length - 1} more feed${item.sources.length === 2 ? "" : "s"}` : ""}</span>
        <span title={item.baseline ? "Already on the source when this monitor first read it" : undefined}>{item.baseline ? `On the source when monitoring began (${dateText(item.firstSeenAt)})` : `First seen ${dateText(item.firstSeenAt)}`}</span>
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
        {item.countries.length
          ? item.countries.map((tag) => <span key={tag.id} data-testid="aor-news-country-tag" title={`Named in the item's ${tag.mentionedIn.join(" and ")}`} className="inline-flex items-center gap-0.5 text-sky-200/90"><MapPin size={8} aria-hidden />Names {tag.name}</span>)
          : <span data-testid="aor-news-commandwide" className="text-slate-500">Command-wide · {command}</span>}
        {item.healthTerms.length ? <span className="inline-flex items-center gap-0.5 text-emerald-200/85" title="Keywords found in the item's own title or description"><Stethoscope size={8} aria-hidden />Mentions {item.healthTerms.slice(0, 3).join(", ")}</span> : null}
        {item.policyTerms.length ? <span data-testid="aor-news-policy-wording" className="text-emerald-100/80" title="Wording only. Not a requirement and not evaluated.">Medical-policy wording</span> : null}
      </p>
    </li>
  );
}

const Pill = ({ pressed, onClick, testid, children }: { pressed: boolean; onClick: () => void; testid: string; children: React.ReactNode }) => (
  <button type="button" data-testid={testid} aria-pressed={pressed} onClick={onClick} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-bold transition ${pressed ? "border-cyan-200/30 bg-cyan-200/10 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}>{children}</button>
);

/** Official command news, press releases, documents and transcripts, with the monitoring state of every source and feed. Context only; never a medical requirement. */
export function AorCommandNews({ command, active }: { command: CommandId; active: boolean }) {
  const { result, refreshing, reload } = useCommandNews(command, active);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<NewsKind | "all">("all");
  const [healthOnly, setHealthOnly] = useState(false);
  const [freshOnly, setFreshOnly] = useState(false);
  const [country, setCountry] = useState("all");
  const label = COMMAND_VIEW[command].label;
  const data = result.state === "ready" ? result.data : null;

  const countries = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const item of data?.items ?? []) for (const tag of item.countries) counts.set(tag.id, { name: tag.name, count: (counts.get(tag.id)?.count ?? 0) + 1 });
    return [...counts].map(([id, value]) => ({ id, ...value })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const shown = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (healthOnly && !item.healthTerms.length) return false;
      if (freshOnly && !isNewItem(item, data.generatedAt) && !isUpdatedItem(item, data.generatedAt)) return false;
      if (country === "command-wide" && item.countries.length) return false;
      if (country !== "all" && country !== "command-wide" && !item.countries.some((tag) => tag.id === country)) return false;
      return !needle || `${item.title} ${item.summary}`.toLowerCase().includes(needle);
    });
  }, [data, query, kind, healthOnly, freshOnly, country]);

  if (result.state === "loading") return <div data-testid="aor-news-loading" className="grid place-items-center py-8 text-[13px] text-slate-400"><Loader2 className="mb-2 animate-spin" size={16} />Checking {label} official sources…</div>;
  if (result.state === "error") return (
    <div data-testid="aor-news-error" className="rounded-xl border border-rose-300/30 px-3 py-2 text-[13px] leading-4 text-rose-100/90">
      <AlertTriangle size={11} className="mr-1 inline" aria-hidden />The command news service could not be reached ({result.message}). No news is shown, which says nothing about what the command has published.
      <button type="button" onClick={() => void reload()} className="ml-2 font-bold text-cyan-100/80 underline">Try again</button>
    </div>
  );

  const { generatedAt } = result.data;
  const feeds = result.data.sources.flatMap((source) => source.feeds).filter((feed) => feed.role !== "directory");
  const feedsOk = feeds.filter((feed) => feed.status === "ok").length;
  const feedsFailed = feeds.filter((feed) => feed.status === "unavailable").length;
  const reachable = result.data.sources.filter((source) => source.status === "ok" || source.status === "stale_cache").length;
  const filtered = query.trim() || kind !== "all" || healthOnly || freshOnly || country !== "all";
  const clear = () => { setQuery(""); setKind("all"); setHealthOnly(false); setFreshOnly(false); setCountry("all"); };
  const counts = result.data.counts;
  const newCount = result.data.items.filter((item) => isNewItem(item, generatedAt)).length;
  const updatedCount = result.data.items.filter((item) => isUpdatedItem(item, generatedAt)).length;

  return (
    <div data-testid="aor-news" data-coverage={result.data.coverage}>
      <p data-testid="aor-news-disclaimer" className="rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2 text-[12px] leading-4 text-slate-300">{result.data.limitations[0]}</p>
      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="text-[12px] leading-4 text-slate-400" data-testid="aor-news-coverage">
          {reachable} of {result.data.sources.length} {label} sources returned items · checked {dateTimeText(generatedAt)}
          <span data-testid="aor-news-feed-summary" className="block">{feeds.length ? `${feedsOk} of ${feeds.length} feed or page addresses readable${feedsFailed ? `, ${feedsFailed} unavailable` : ""}` : "No feed addresses were tried."}</span>
        </p>
        <button type="button" data-testid="aor-news-refresh" onClick={() => void reload()} disabled={refreshing} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[12px] font-bold text-slate-300 hover:text-white disabled:opacity-50"><RefreshCw size={9} className={refreshing ? "animate-spin" : ""} aria-hidden />Refresh</button>
      </div>
      {result.data.coverage === "no_source_available" ? <p data-testid="aor-news-none" className="mt-2 rounded-xl border border-rose-300/30 px-3 py-2 text-[13px] leading-4 text-rose-100/90">None of the {label} sources could be read right now. Nothing is shown; this does not mean the command has published nothing. Use the official page links below.</p> : null}

      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 rounded-lg border border-white/[.08] bg-black/25 px-2.5 focus-within:border-cyan-200/40">
          <Search size={11} className="text-slate-500" aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${COMMAND_VIEW[command].short} news`} aria-label={`Search ${label} news and publications`} data-testid="aor-news-search" style={{ outline: "none" }} className="min-h-8 w-full bg-transparent text-[13px] text-white placeholder:text-slate-600" />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Publication type">
          <Pill testid="aor-news-type-all" pressed={kind === "all"} onClick={() => setKind("all")}>All ({counts.total})</Pill>
          {NEWS_KINDS.map((entry) => <Pill key={entry} testid={`aor-news-type-${entry}`} pressed={kind === entry} onClick={() => setKind(entry)}>{NEWS_KIND_PLURAL[entry]} ({counts.byKind[entry]})</Pill>)}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Pill testid="aor-news-health-filter" pressed={healthOnly} onClick={() => setHealthOnly((value) => !value)}><Stethoscope size={9} aria-hidden />Health / medical policy ({counts.health})</Pill>
          <Pill testid="aor-news-fresh-filter" pressed={freshOnly} onClick={() => setFreshOnly((value) => !value)}><Sparkles size={9} aria-hidden />New or updated ({newCount + updatedCount})</Pill>
          {countries.length ? (
            <select data-testid="aor-news-country-filter" aria-label="Country relevance" value={country} onChange={(event) => setCountry(event.target.value)} className="min-h-6 rounded-full border border-white/10 bg-black/30 px-2 text-[12px] font-bold text-slate-300">
              <option value="all">All items</option>
              <option value="command-wide">Command-wide only</option>
              {countries.map((entry) => <option key={entry.id} value={entry.id}>Names {entry.name} ({entry.count})</option>)}
            </select>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h3 data-testid="aor-news-count" className="text-[12px] font-semibold text-slate-400">Items ({shown.length}{filtered ? ` of ${result.data.items.length}` : ""}) · newest first</h3>
        {filtered ? <button type="button" data-testid="aor-news-clear" onClick={clear} className="text-[12px] font-bold text-cyan-100/80 underline">Clear filters</button> : null}
      </div>
      {shown.length ? <ul>{shown.map((item) => <ItemRow key={item.id} item={item} reference={generatedAt} command={COMMAND_VIEW[command].short} />)}</ul> : result.data.coverage === "no_source_available" ? null : (
        <p data-testid="aor-news-empty" className="py-3 text-[13px] text-slate-500">{filtered ? "No item matches these filters. Health matching uses only keywords in an item's own title or description." : "No items were read from the sources."}</p>
      )}

      <h3 className="mt-4 text-[12px] font-semibold text-slate-400">Source monitoring</h3>
      <ul className="mt-1 space-y-1.5">{result.data.sources.map((source) => <SourceRow key={source.sourceId} source={source} />)}</ul>
      <ul className="mt-3 space-y-1 pb-2">{result.data.limitations.slice(1).map((text) => <li key={text} className="text-[12px] leading-4 text-slate-500">{text}</li>)}</ul>
    </div>
  );
}
