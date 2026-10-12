import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStore } from "../aor-intel/cache";
import { COMMAND_NEWS_COMMANDS, COMMAND_NEWS_SOURCES, sourcesForCommand } from "../aor-intel/command-news/sources";
import { discoverFeedUrls, healthTerms, looksLikeFeed, parseFeed, parseListing, safeUrl } from "../aor-intel/command-news/parse";
import { collectSource, getCommandNews, getNewsMonitor, type FetchText, type NewsDeps } from "../aor-intel/command-news/service";

const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>EUCOM</title>
<item><title><![CDATA[Force Health Protection update &amp; vaccination clinics]]></title><link>https://www.eucom.mil/press-release/1</link><description>&lt;p&gt;Surgeon&#39;s office announces clinics.&lt;/p&gt;</description><pubDate>Mon, 05 Oct 2026 14:00:00 GMT</pubDate></item>
<item><title>Exercise concludes</title><link>/press-release/2</link><description>Plain text</description><pubDate>Tue, 06 Oct 2026 09:30:00 GMT</pubDate></item>
<item><title>Bad link item</title><link>javascript:alert(1)</link></item>
<item><link>https://www.eucom.mil/press-release/3</link></item>
</channel></rss>`;
const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom item</title><link rel="alternate" href="https://www.africom.mil/a/1"/><updated>2026-09-30T10:00:00Z</updated><summary>Summary text</summary></entry></feed>`;
const LISTING = `<html><head><link rel="alternate" type="application/rss+xml" href="/rss/feed.xml"><title>Press</title></head><body>
<a href="/media-gallery/press-releases">Press Releases</a>
<a href="/press-release/20260901-command-announces-medical-readiness-exercise">Command announces medical readiness exercise in the region</a>
<a href="/news/article/42">Commander visits partner nation during regional engagement</a>
<a href="https://other.example.com/news/article/9">Off-site link that must be ignored entirely</a>
<a href="/news/article/42">Commander visits partner nation during regional engagement</a>
<a href="/about">About us and the long history of the command</a></body></html>`;
const LISTING_NO_FEED = LISTING.replace(/<link rel="alternate"[^>]*>/, "");

const source = (id: string) => COMMAND_NEWS_SOURCES.find((entry) => entry.id === id)!;
const fixedNow = (iso: string) => () => new Date(iso);

function deps(routes: Record<string, { status?: number; body?: string; throws?: string }>, now = "2026-10-11T12:00:00Z", store = createMemoryStore()): NewsDeps & { calls: string[] } {
  const calls: string[] = [];
  const fetchText: FetchText = async (url) => {
    calls.push(url);
    const hit = routes[url];
    if (!hit) return { status: 404, body: "", finalUrl: url };
    if (hit.throws) throw new Error(hit.throws);
    return { status: hit.status ?? 200, body: hit.body ?? "", finalUrl: url };
  };
  return { store, fetchText, now: fixedNow(now), calls };
}

test("registry: every one of the six commands has at least one official source, ids are unique, and every address is https on a .mil site", () => {
  assert.deepEqual([...COMMAND_NEWS_COMMANDS].sort(), ["AFRICOM", "CENTCOM", "EUCOM", "INDOPACOM", "NORTHCOM", "SOUTHCOM"]);
  for (const command of COMMAND_NEWS_COMMANDS) assert.ok(sourcesForCommand(command).length >= 1, command);
  assert.equal(new Set(COMMAND_NEWS_SOURCES.map((entry) => entry.id)).size, COMMAND_NEWS_SOURCES.length);
  for (const entry of COMMAND_NEWS_SOURCES) {
    assert.match(entry.listingUrl, /^https:\/\/[a-z.]+\.mil\//, entry.id);
    assert.equal(entry.feedUrls.length, 0, `${entry.id}: no feed address may be guessed; feeds are discovered`);
  }
  assert.ok(COMMAND_NEWS_SOURCES.some((entry) => entry.urlBasis === "expected_not_yet_confirmed"), "unconfirmed addresses are flagged, not presented as confirmed");
});

test("parseFeed reads RSS: CDATA, entities, relative links, dates; drops items without a title or with a non-http link", () => {
  const items = parseFeed(RSS, "https://www.eucom.mil/media-gallery/press-releases");
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Force Health Protection update & vaccination clinics");
  assert.equal(items[0].summary, "Surgeon's office announces clinics.");
  assert.equal(items[0].publishedAt, "2026-10-05T14:00:00.000Z");
  assert.equal(items[1].url, "https://www.eucom.mil/press-release/2");
});

test("parseFeed reads Atom entries", () => {
  const items = parseFeed(ATOM, "https://www.africom.mil/");
  assert.deepEqual(items.map((entry) => [entry.title, entry.url, entry.publishedAt]), [["Atom item", "https://www.africom.mil/a/1", "2026-09-30T10:00:00.000Z"]]);
});

test("feed detection and discovery", () => {
  assert.equal(looksLikeFeed(RSS), true);
  assert.equal(looksLikeFeed(ATOM), true);
  assert.equal(looksLikeFeed(LISTING), false);
  assert.deepEqual(discoverFeedUrls(LISTING, "https://www.eucom.mil/media-gallery/press-releases"), ["https://www.eucom.mil/rss/feed.xml"]);
  assert.equal(safeUrl("javascript:alert(1)", "https://www.eucom.mil/"), null);
});

test("parseListing keeps same-site article links with real titles and ignores navigation, off-site links and duplicates", () => {
  const items = parseListing(LISTING, "https://www.eucom.mil/media-gallery/press-releases");
  assert.deepEqual(items.map((entry) => entry.url), ["https://www.eucom.mil/press-release/20260901-command-announces-medical-readiness-exercise", "https://www.eucom.mil/news/article/42"]);
  assert.ok(items.every((entry) => entry.publishedAt === null), "a listing that states no date yields no date");
});

test("health keyword match is deterministic and limited to the item's own text", () => {
  assert.deepEqual(healthTerms("Force Health Protection update").sort(), ["force health", "health"]);
  assert.deepEqual(healthTerms("Exercise concludes"), []);
});

test("collectSource: a discovered RSS feed is used, items are normalized, and monitoring state records the feed address and fetch times", async () => {
  const d = deps({ "https://www.eucom.mil/media-gallery/press-releases": { body: LISTING }, "https://www.eucom.mil/rss/feed.xml": { body: RSS } });
  const result = await collectSource(source("eucom-press-releases"), d);
  assert.equal(result.report.status, "ok");
  assert.equal(result.report.method, "discovered_feed");
  assert.equal(result.report.feedUrl, "https://www.eucom.mil/rss/feed.xml");
  assert.equal(result.report.lastSuccessfulFetch, "2026-10-11T12:00:00.000Z");
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].command, "EUCOM");
  assert.equal(result.items[0].freshness, "CURRENT_NOTICE");
  assert.deepEqual(result.items[0].healthTerms.sort(), ["force health", "health", "surgeon", "vaccin"]);
});

test("collectSource: without a feed it reads the listing page and says so; dates are not invented", async () => {
  const d = deps({ "https://www.eucom.mil/media-gallery/press-releases": { body: LISTING_NO_FEED } });
  const result = await collectSource(source("eucom-press-releases"), d);
  assert.equal(result.report.status, "ok");
  assert.equal(result.report.method, "html_listing");
  assert.match(result.report.note ?? "", /No feed was offered/);
  assert.ok(result.items.every((item) => item.publishedAt === null));
});

test("collectSource: HTTP 403 is reported as source_unavailable with the status; it is not read as 'no news'", async () => {
  const d = deps({ "https://www.centcom.mil/MEDIA/PRESS-RELEASES/": { status: 403 } });
  const result = await collectSource(source("centcom-press-releases"), d);
  assert.equal(result.report.status, "source_unavailable");
  assert.equal(result.report.httpStatus, 403);
  assert.match(result.report.sourceError ?? "", /HTTP 403/);
  assert.equal(result.items.length, 0);
  assert.equal(result.report.lastSuccessfulFetch, null);
});

test("collectSource: a page that answers with nothing readable is source_returned_no_data, not unavailable and not 'nothing published'", async () => {
  const d = deps({ "https://www.pacom.mil/Media/NEWS/": { body: "<html><body>Loading…</body></html>" } });
  const result = await collectSource(source("indopacom-news"), d);
  assert.equal(result.report.status, "source_returned_no_data");
  assert.match(result.report.note ?? "", /not evidence that the command published nothing/);
});

test("collectSource: a failed refresh serves the last-known items labeled STALE_CACHE with the earlier successful-fetch time", async () => {
  const store = createMemoryStore();
  const url = "https://www.eucom.mil/media-gallery/press-releases";
  await collectSource(source("eucom-press-releases"), deps({ [url]: { body: RSS } }, "2026-10-11T12:00:00Z", store));
  const later = await collectSource(source("eucom-press-releases"), deps({ [url]: { throws: "socket hang up" } }, "2026-10-11T14:00:00Z", store));
  assert.equal(later.report.status, "stale_cache");
  assert.equal(later.report.lastSuccessfulFetch, "2026-10-11T12:00:00.000Z");
  assert.equal(later.report.lastAttemptedFetch, "2026-10-11T14:00:00.000Z");
  assert.match(later.report.sourceError ?? "", /socket hang up/);
  assert.equal(later.items.length, 2);
  assert.ok(later.items.every((item) => item.freshness === "STALE_CACHE" && item.lastKnownData));
});

test("collectSource: results are cached for 30 minutes; failures retry after 5; an explicit refresh is rate limited to once a minute", async () => {
  const store = createMemoryStore();
  const url = "https://www.eucom.mil/media-gallery/press-releases";
  const first = deps({ [url]: { body: RSS } }, "2026-10-11T12:00:00Z", store);
  await collectSource(source("eucom-press-releases"), first);
  const cachedRead = deps({ [url]: { body: RSS } }, "2026-10-11T12:20:00Z", store);
  await collectSource(source("eucom-press-releases"), cachedRead);
  assert.equal(cachedRead.calls.length, 0);
  const tooSoon = deps({ [url]: { body: RSS } }, "2026-10-11T12:00:30Z", store);
  await collectSource(source("eucom-press-releases"), tooSoon, { refresh: true });
  assert.equal(tooSoon.calls.length, 0);
  const refreshed = deps({ [url]: { body: RSS } }, "2026-10-11T12:05:00Z", store);
  await collectSource(source("eucom-press-releases"), refreshed, { refresh: true });
  assert.ok(refreshed.calls.length > 0);
  const failStore = createMemoryStore();
  await collectSource(source("centcom-press-releases"), deps({}, "2026-10-11T12:00:00Z", failStore));
  const early = deps({}, "2026-10-11T12:03:00Z", failStore);
  await collectSource(source("centcom-press-releases"), early);
  assert.equal(early.calls.length, 0);
  const retry = deps({}, "2026-10-11T12:06:00Z", failStore);
  await collectSource(source("centcom-press-releases"), retry);
  assert.ok(retry.calls.length > 0);
});

test("getCommandNews merges a command's sources newest-first (undated last), de-duplicates by URL, and reports partial coverage", async () => {
  const d = deps({
    "https://www.pacom.mil/Media/Press-Releases-and-Readouts/": { body: RSS.replace(/eucom/g, "pacom") },
    "https://www.pacom.mil/Media/NEWS/": { status: 503 },
  });
  const response = await getCommandNews("INDOPACOM", d);
  assert.equal(response.command, "INDOPACOM");
  assert.equal(response.coverage, "some_sources_unavailable");
  assert.equal(response.items[0].publishedAt, "2026-10-06T09:30:00.000Z");
  assert.equal(response.sources.length, 2);
  assert.deepEqual(response.sources.map((entry) => entry.status).sort(), ["ok", "source_unavailable"]);
  assert.ok(response.limitations.some((text) => /never change a REQUIRED/.test(text)));
});

test("getCommandNews: when every source of a command is down the response says so and carries no invented items", async () => {
  const response = await getCommandNews("SOUTHCOM", deps({}));
  assert.equal(response.coverage, "no_source_available");
  assert.equal(response.items.length, 0);
  assert.equal(response.sources.length, 2);
  assert.ok(response.sources.every((entry) => entry.status === "source_unavailable"));
});

test("getCommandNews works for all six commands", async () => {
  for (const command of COMMAND_NEWS_COMMANDS) {
    const response = await getCommandNews(command, deps({}));
    assert.equal(response.command, command);
    assert.equal(response.sources.length, sourcesForCommand(command).length);
  }
});

test("monitor: before any fetch every source is not_evaluated; after a refresh it reports per-command rollups", async () => {
  const store = createMemoryStore();
  const before = await getNewsMonitor(deps({}, undefined, store));
  assert.equal(before.sources.length, COMMAND_NEWS_SOURCES.length);
  assert.ok(before.sources.every((entry) => entry.status === "not_evaluated"));
  assert.ok(before.commands.every((entry) => entry.neverFetched === entry.sourceCount));
  const after = await getNewsMonitor(deps({ "https://www.eucom.mil/media-gallery/press-releases": { body: LISTING_NO_FEED } }, undefined, store), { refresh: true });
  const eucom = after.commands.find((entry) => entry.command === "EUCOM")!;
  assert.equal(eucom.ok, 1);
  assert.equal(after.commands.find((entry) => entry.command === "CENTCOM")!.unavailable, 1);
});
