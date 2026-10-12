import { looksLikeFeed, parseFeed, stripMarkup } from "../aor-intel/command-news/parse";
import type { DocStatus, RawItem, SourceDefinition } from "./types";

export interface FetchResult { status: number; body: string; finalUrl: string }
export type FetchText = (url: string) => Promise<FetchResult>;

export class SourceError extends Error {
  constructor(message: string, readonly httpStatus: number | null = null, readonly retryable = false) { super(message); }
}

const dateOnly = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1]! : null;
};

/** Federal Register document numbers appear in canonical document URLs: /documents/2024/05/10/2024-09876/slug */
export function federalRegisterNumber(url: string): string | null {
  const match = url.match(/federalregister\.gov\/(?:documents|d)\/(?:\d{4}\/\d{2}\/\d{2}\/)?([A-Z]{0,2}\d{0,4}-?[A-Z0-9]*-?\d+)(?:[/?#.]|$)/);
  return match && /\d/.test(match[1]!) && match[1]!.includes("-") ? match[1]! : null;
}

async function get(fetchText: FetchText, url: string): Promise<FetchResult> {
  const result = await fetchText(url);
  if (result.status === 401 || result.status === 403) throw new SourceError(`HTTP ${result.status}: the site refused this automated request.`, result.status);
  if (result.status === 429) throw new SourceError("HTTP 429: the site is rate limiting requests.", 429, true);
  if (result.status >= 500) throw new SourceError(`HTTP ${result.status}: the server reported an error.`, result.status, true);
  if (result.status < 200 || result.status >= 300) throw new SourceError(`HTTP ${result.status}: the address did not return content.`, result.status);
  return result;
}

// ── RSS / Atom ──────────────────────────────────────────────────────────────

export function parseFeedItems(body: string, base: string): RawItem[] {
  if (!looksLikeFeed(body)) {
    const html = /<html|<!doctype html/i.test(body.slice(0, 2000));
    throw new SourceError(html ? "The response is an HTML page, not an RSS or Atom feed." : "The response is not a recognisable RSS or Atom document.");
  }
  return parseFeed(body, base).map((item) => ({
    externalKey: federalRegisterNumber(item.url) ? `fr:${federalRegisterNumber(item.url)}` : null,
    title: item.title, url: item.url, summary: item.summary,
    publishedAt: dateOnly(item.publishedAt), effectiveAt: null,
    // An Atom/RSS "updated" value is a timestamp only. It is recorded as the modified date but never treated as proof of a revision.
    modifiedAt: dateOnly(item.updatedAt),
    docType: null, action: null, categories: item.categories, cfrRefs: [], rins: [], dockets: [], correctionOf: null, versionKey: null, priorVersions: [], statusHint: null,
  }));
}

// ── Federal Register API ────────────────────────────────────────────────────

const FR_FIELDS = ["document_number", "title", "type", "abstract", "html_url", "publication_date", "effective_on", "action", "agencies", "regulation_id_numbers", "docket_ids", "cfr_references", "correction_of", "comments_close_on"];

export function federalRegisterUrl(source: SourceDefinition, now: Date, withFields = true): string {
  const fr = source.fr!;
  const params = new URLSearchParams();
  params.append("conditions[agencies][]", fr.agency);
  for (const type of fr.types ?? []) params.append("conditions[type][]", type);
  if (fr.term) params.set("conditions[term]", fr.term);
  params.set("conditions[publication_date][gte]", new Date(now.getTime() - 120 * 86_400_000).toISOString().slice(0, 10));
  params.set("order", "newest");
  params.set("per_page", "40");
  if (withFields) for (const field of FR_FIELDS) params.append("fields[]", field);
  return `${source.url}?${params.toString()}`;
}

interface FrResult {
  document_number?: string; title?: string; type?: string; abstract?: string | null; html_url?: string; publication_date?: string; effective_on?: string | null; action?: string | null;
  regulation_id_numbers?: string[]; docket_ids?: string[]; cfr_references?: Array<{ title?: number | string; part?: number | string }>; correction_of?: string | null; excerpts?: string | null; agencies?: Array<{ name?: string }>;
}

/** The API answers with display names ("Proposed Rule", "Rule", "Notice") while its filters use codes (PRORULE, RULE, NOTICE). Both are accepted. */
export function frTypeCode(type: string | undefined | null): string | null {
  if (!type) return null;
  const value = type.trim();
  if (/^pro-?rule$|^proposed rule$/i.test(value)) return "PRORULE";
  if (/^rule$/i.test(value)) return "RULE";
  if (/^notice$/i.test(value)) return "NOTICE";
  return value.toUpperCase();
}

function frStatus(result: FrResult): DocStatus {
  const label = `${result.title ?? ""} ${result.action ?? ""}`;
  if (result.correction_of || /\bcorrect(?:ion|ions|ing)\b/i.test(label)) return "corrected";
  if (/\bwithdraw(?:al|n)\b/i.test(label)) return "withdrawn";
  const type = frTypeCode(result.type);
  if (type === "PRORULE") return "proposed";
  if (type === "RULE") return "final";
  return "informational";
}

export function parseFederalRegister(body: string): RawItem[] {
  let json: { results?: FrResult[]; count?: number };
  try { json = JSON.parse(body); } catch { throw new SourceError("The response is not valid JSON."); }
  // The API omits "results" entirely when a query matches nothing ({"count":0,...}); that is a valid, empty answer.
  if (json && json.count === 0 && !Array.isArray(json.results)) return [];
  if (!json || !Array.isArray(json.results)) throw new SourceError("The Federal Register response has no results array.");
  const items: RawItem[] = [];
  for (const result of json.results) {
    if (!result.document_number || !result.title || !result.html_url) continue;
    const correction = result.correction_of ? String(result.correction_of).split("/").pop()!.replace(/\.json$/i, "") : null;
    items.push({
      externalKey: `fr:${result.document_number}`, title: stripMarkup(result.title), url: result.html_url,
      summary: stripMarkup(result.abstract ?? result.excerpts ?? "").slice(0, 600),
      publishedAt: dateOnly(result.publication_date), effectiveAt: dateOnly(result.effective_on), modifiedAt: null,
      docType: frTypeCode(result.type), action: result.action ? stripMarkup(result.action).slice(0, 200) : null,
      categories: (result.agencies ?? []).map((agency) => agency.name).filter((name): name is string => !!name),
      cfrRefs: (result.cfr_references ?? []).filter((ref) => ref.title && ref.part).map((ref) => `${ref.title} CFR ${ref.part}`),
      rins: result.regulation_id_numbers ?? [], dockets: result.docket_ids ?? [], correctionOf: correction ? `fr:${correction}` : null,
      versionKey: null, priorVersions: [], statusHint: frStatus(result),
    });
  }
  return items;
}

async function fetchFederalRegister(source: SourceDefinition, fetchText: FetchText, now: Date): Promise<{ items: RawItem[]; httpStatus: number }> {
  let response = await fetchText(federalRegisterUrl(source, now, true));
  // If the API rejects the field list, retry once with its default fields rather than failing the whole source.
  if (response.status === 400 || response.status === 422) response = await fetchText(federalRegisterUrl(source, now, false));
  const ok = await get(async () => response, "");
  return { items: parseFederalRegister(ok.body), httpStatus: ok.status };
}

// ── eCFR versioner API ──────────────────────────────────────────────────────

interface EcfrVersion { amendment_date?: string; issue_date?: string; substantive?: boolean; removed?: boolean }

export function parseEcfrVersions(body: string, part: { title: number; part: number; label: string }): RawItem {
  let json: { content_versions?: EcfrVersion[] };
  try { json = JSON.parse(body); } catch { throw new SourceError(`eCFR Title ${part.title} Part ${part.part}: the response is not valid JSON.`); }
  if (!json || !Array.isArray(json.content_versions)) throw new SourceError(`eCFR Title ${part.title} Part ${part.part}: the response has no content_versions list.`);
  const byDate = new Map<string, { sections: number; substantive: number; issue: string | null }>();
  for (const version of json.content_versions) {
    const date = dateOnly(version.amendment_date);
    if (!date) continue;
    const entry = byDate.get(date) ?? { sections: 0, substantive: 0, issue: null };
    entry.sections += 1;
    if (version.substantive) entry.substantive += 1;
    entry.issue = dateOnly(version.issue_date) ?? entry.issue;
    byDate.set(date, entry);
  }
  const dates = [...byDate.keys()].sort();
  if (!dates.length) throw new SourceError(`eCFR Title ${part.title} Part ${part.part}: no amendment dates were listed.`);
  const latest = dates[dates.length - 1]!;
  const entry = byDate.get(latest)!;
  return {
    externalKey: `ecfr:t${part.title}:p${part.part}`,
    title: `${part.title} CFR Part ${part.part} — ${part.label}`,
    url: `https://www.ecfr.gov/current/title-${part.title}/part-${part.part}`,
    summary: `Most recent amendment date listed by the eCFR: ${latest} (${entry.sections} section version${entry.sections === 1 ? "" : "s"} dated that day, ${entry.substantive} marked substantive).`,
    publishedAt: null, effectiveAt: null, modifiedAt: latest, docType: "CFR_PART", action: null, categories: [], cfrRefs: [`${part.title} CFR ${part.part}`], rins: [], dockets: [], correctionOf: null,
    versionKey: latest, priorVersions: dates.slice(0, -1).slice(-10), statusHint: "in_force",
  };
}

async function fetchEcfr(source: SourceDefinition, fetchText: FetchText, now: Date): Promise<{ items: RawItem[]; httpStatus: number | null; errors: string[] }> {
  const since = new Date(now.getTime() - 730 * 86_400_000).toISOString().slice(0, 10);
  const items: RawItem[] = [];
  const errors: string[] = [];
  let httpStatus: number | null = null;
  for (const part of source.ecfr ?? []) {
    try {
      const base = `${source.url}/title-${part.title}.json?part=${part.part}`;
      let response = await fetchText(`${base}&issue_date[gte]=${since}`);
      if (response.status === 400 || response.status === 422) response = await fetchText(base);
      let ok = await get(async () => response, "");
      httpStatus = ok.status;
      let parsed: RawItem;
      try {
        parsed = parseEcfrVersions(ok.body, part);
      } catch (error) {
        // A part with no amendments inside the date window is not an error: read its full history instead.
        if (!(error instanceof SourceError) || !/no amendment dates/.test(error.message)) throw error;
        ok = await get(fetchText, base);
        parsed = parseEcfrVersions(ok.body, part);
      }
      items.push(parsed);
    } catch (error) {
      errors.push(`${part.title} CFR ${part.part}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { items, httpStatus, errors };
}

// Archive-style feeds (CDC MMWR lists thousands of items) are limited to the newest entries; older history is not "new" and is not monitored.
export const MAX_FEED_ITEMS = 150;
const newestFirst = (items: RawItem[]) => [...items].sort((a, b) => (b.publishedAt ?? b.modifiedAt ?? "").localeCompare(a.publishedAt ?? a.modifiedAt ?? ""));

// ── Dispatcher ──────────────────────────────────────────────────────────────

export interface AdapterResult { items: RawItem[]; httpStatus: number | null; partialErrors: string[] }

export async function fetchSource(source: SourceDefinition, fetchText: FetchText, now: Date): Promise<AdapterResult> {
  if (!source.url || source.method === "none") throw new SourceError(source.pendingReason ?? "No endpoint is registered for this source.");
  switch (source.method) {
    case "federal_register_api": {
      const result = await fetchFederalRegister(source, fetchText, now);
      return { items: result.items, httpStatus: result.httpStatus, partialErrors: [] };
    }
    case "ecfr_versioner_api": {
      const result = await fetchEcfr(source, fetchText, now);
      if (!result.items.length) throw new SourceError(`No eCFR part could be read. ${result.errors.slice(0, 3).join(" | ")}`);
      return { items: result.items, httpStatus: result.httpStatus, partialErrors: result.errors };
    }
    case "rss":
    case "atom": {
      const response = await get(fetchText, source.url);
      return { items: newestFirst(parseFeedItems(response.body, response.finalUrl || source.url)).slice(0, MAX_FEED_ITEMS), httpStatus: response.status, partialErrors: [] };
    }
  }
}
