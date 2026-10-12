import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStore } from "../aor-intel/cache";
import { COMMAND_NEWS_COMMANDS, COMMAND_NEWS_SOURCES, sourcesForCommand } from "../aor-intel/command-news/sources";
import { canonicalUrl, classifyFeedKind, describeDirectoryPage, discoverDirectoryFeeds, discoverFeedUrls, healthTerms, looksLikeFeed, nearbyDate, parseFeed, parseListing, policyTerms, safeUrl } from "../aor-intel/command-news/parse";
import { collectSource, dedupe, getCommandNews, getNewsMonitor, type FetchText, type NewsDeps } from "../aor-intel/command-news/service";
import { countryTags } from "../aor-intel/command-news/countries";

// ---- Format fixtures -----------------------------------------------------------------------------------------------------------------
// These follow the published RSS 2.0 and Atom 1.0 formats (namespaced extensions, CDATA, escaped markup, self/alternate links, categories). They are
// written to the formats, NOT captured from the command sites: they prove the parser handles the formats, not that any live feed works. Whether a live
// address answers is reported by the monitor at run time.

const RSS_20 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
<channel><title>USEUCOM Press Releases</title><link>https://www.eucom.mil/media-gallery/press-releases</link><description>Releases</description><lastBuildDate>Tue, 06 Oct 2026 10:00:00 GMT</lastBuildDate>
<atom:link href="https://www.eucom.mil/syndication-feed/rss/press-releases" rel="self" type="application/rss+xml"/>
<item><title><![CDATA[Force Health Protection update &amp; vaccination clinics in Poland]]></title><link>https://www.eucom.mil/press-release/1?utm_source=rss#top</link>
<guid isPermaLink="false">eucom-pr-1</guid><dc:date>2026-10-05T14:00:00Z</dc:date><category>Health</category><category><![CDATA[Poland]]></category>
<description>&lt;p&gt;Surgeon&amp;#39;s office announces clinics.&lt;/p&gt;</description><content:encoded><![CDATA[<p>Longer body that must not replace the description.</p>]]></content:encoded><media:thumbnail url="https://www.eucom.mil/t.jpg"/></item>
<item><title>Exercise concludes</title><link>/press-release/2</link><description>Plain text</description><pubDate>Tue, 06 Oct 2026 09:30:00 GMT</pubDate></item>
<item><title>Bad link item</title><link>javascript:alert(1)</link></item>
<item><link>https://www.eucom.mil/press-release/3</link></item>
<item><title>Permalink GUID only</title><guid isPermaLink="true">https://www.eucom.mil/press-release/4</guid><pubDate>Wed, 07 Oct 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM_10 = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>USAFRICOM Articles</title><id>urn:uuid:60a76c80</id><updated>2026-10-06T12:00:00Z</updated>
<link rel="self" href="https://www.africom.mil/syndication-feed/atom/articles"/><link rel="alternate" href="https://www.africom.mil/"/>
<entry><title type="html">Medical readiness &amp;amp; training in Kenya</title><id>urn:uuid:1</id>
<link rel="enclosure" href="https://www.africom.mil/file.pdf"/><link rel="self" href="https://www.africom.mil/atom/entry/1"/><link rel="alternate" type="text/html" href="https://www.africom.mil/article/1/"/>
<published>2026-10-01T08:00:00Z</published><updated>2026-10-03T09:00:00Z</updated><category term="Health" label="Health"/><summary type="html">&lt;p&gt;Summary text&lt;/p&gt;</summary></entry>
<entry><title>Updated-only entry</title><id>urn:uuid:2</id><link href="https://www.africom.mil/article/2"/><updated>2026-10-04T10:00:00Z</updated><content type="text">Body text</content></entry>
</feed>`;

const DIRECTORY_DNN = `<html><body><h1>RSS Feeds</h1><ul>
<li><a href="/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&amp;Site=808&amp;max=10">News Articles</a></li>
<li><a href="/DesktopModules/ArticleCS/RSS.ashx?ContentType=9&amp;Site=808&amp;max=10">Press Releases</a></li>
<li><a href="/DesktopModules/ArticleCS/RSS.ashx?ContentType=400&amp;Site=808&amp;max=10">Transcripts and Speeches</a></li>
<li><a href="/DesktopModules/ArticleCS/RSS.ashx?ContentType=7&amp;Site=808&amp;max=10">Official Documents and Directives</a></li>
<li><a href="https://www.facebook.com/centcom/rss">Off-site feed link</a></li>
<li><a href="/rss/">This directory</a></li><li><a href="/About">About</a></li></ul></body></html>`;

const DIRECTORY_SYNDICATION = `<html><body>
<a href="/syndication-feed/rss/articles">Articles (RSS)</a><a href="/syndication-feed/atom/articles">Articles (Atom)</a>
<a href="/syndication-feed/rss/press-releases">Press Releases (RSS)</a><a href="/syndication-feed/atom/transcripts">Transcripts (Atom only)</a></body></html>`;

const LISTING = `<html><head><link rel="alternate" type="application/rss+xml" href="/rss/feed.xml"><title>Press</title></head><body>
<a href="/media-gallery/press-releases">Press Releases</a>
<div class="item"><a href="/press-release/20260901-command-announces-medical-readiness-exercise">Command announces medical readiness exercise in the region</a><span class="date">Sep. 1, 2026</span></div>
<div class="item"><a href="/news/article/42">Commander visits partner nation during regional engagement</a><time datetime="2026-08-30T10:00:00Z">Aug 30</time></div>
<div class="item"><a href="/news/article/43">Undated item with a long enough title to be kept</a></div>
<a href="https://other.example.com/news/article/9">Off-site link that must be ignored entirely</a>
<a href="/news/article/42">Commander visits partner nation during regional engagement</a>
<a href="/about">About us and the long history of the command</a></body></html>`;
const LISTING_NO_FEED = LISTING.replace(/<link rel="alternate"[^>]*>/, "");

const EU = "https://www.eucom.mil";
const AF = "https://www.africom.mil";
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

const rss = (...items: Array<{ title: string; url: string; date?: string; description?: string }>) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items.map((item) => `<item><title>${item.title}</title><link>${item.url}</link><description>${item.description ?? ""}</description>${item.date ? `<pubDate>${item.date}</pubDate>` : ""}</item>`).join("")}</channel></rss>`;

// ---- Registry --------------------------------------------------------------------------------------------------------------------------

test("registry: all six commands, unique ids, https .mil addresses, and exactly the supplied feed addresses (no feed is invented)", () => {
  assert.deepEqual([...COMMAND_NEWS_COMMANDS].sort(), ["AFRICOM", "CENTCOM", "EUCOM", "INDOPACOM", "NORTHCOM", "SOUTHCOM"]);
  for (const command of COMMAND_NEWS_COMMANDS) assert.ok(sourcesForCommand(command).length >= 1, command);
  assert.equal(new Set(COMMAND_NEWS_SOURCES.map((entry) => entry.id)).size, COMMAND_NEWS_SOURCES.length);
  for (const entry of COMMAND_NEWS_SOURCES) for (const url of [entry.listingUrl, entry.directoryUrl, ...entry.feedUrls, ...entry.atomUrls, entry.officialSite]) if (url) assert.match(url, /^https:\/\/www\.[a-z]+\.mil\//, entry.id);

  for (const [command, host] of [["EUCOM", "www.eucom.mil"], ["AFRICOM", "www.africom.mil"]] as const) {
    const own = sourcesForCommand(command);
    assert.equal(own.length, 4);
    assert.deepEqual(own.map((entry) => entry.kind).sort(), ["news", "press_release", "publication", "transcript"]);
    assert.deepEqual(own.flatMap((entry) => entry.feedUrls).sort(), ["articles", "documents", "press-releases", "transcripts"].map((slug) => `https://${host}/syndication-feed/rss/${slug}`));
    for (const entry of own) assert.deepEqual(entry.atomUrls, entry.feedUrls.map((url) => url.replace("/rss/", "/atom/")), "Atom is the /rss/ → /atom/ equivalent");
  }
  const supplied = new Set(COMMAND_NEWS_SOURCES.flatMap((entry) => entry.feedUrls));
  assert.equal(supplied.size, 8, "only the eight supplied EUCOM/AFRICOM feeds are pre-registered");

  assert.equal(source("centcom-rss-directory").directoryUrl, "https://www.centcom.mil/rss/");
  assert.equal(source("southcom-rss-directory").directoryUrl, "https://www.southcom.mil/RSS/");
  assert.equal(source("indopacom-news").listingUrl, "https://www.pacom.mil/Media/NEWS/");
  assert.equal(source("indopacom-press-releases").listingUrl, "https://www.pacom.mil/Media/Press-Releases-and-Readouts/");
  assert.equal(source("northcom-news-archive").listingUrl, "https://www.northcom.mil/Newsroom/News/News-Archive/");
  assert.equal(source("northcom-press-releases").listingUrl, "https://www.northcom.mil/Newsroom/Press-Releases/");
});

// ---- Parsing (published formats) -------------------------------------------------------------------------------------------------------

test("parseFeed reads RSS 2.0 with namespaces: CDATA, escaped markup, dc:date, categories, relative links, permalink GUIDs; drops items without a title or with a non-http link", () => {
  const items = parseFeed(RSS_20, "https://www.eucom.mil/media-gallery/press-releases");
  assert.deepEqual(items.map((entry) => entry.title), ["Force Health Protection update & vaccination clinics in Poland", "Exercise concludes", "Permalink GUID only"]);
  assert.equal(items[0].summary, "Surgeon's office announces clinics.");
  assert.equal(items[0].publishedAt, "2026-10-05T14:00:00.000Z");
  assert.deepEqual(items[0].categories, ["Health", "Poland"]);
  assert.equal(items[1].url, "https://www.eucom.mil/press-release/2");
  assert.equal(items[2].url, "https://www.eucom.mil/press-release/4");
});

test("parseFeed reads Atom 1.0: picks the alternate link (never self/enclosure), published vs updated, category term, HTML-typed summaries", () => {
  const items = parseFeed(ATOM_10, "https://www.africom.mil/");
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Medical readiness & training in Kenya");
  assert.equal(items[0].url, "https://www.africom.mil/article/1/");
  assert.equal(items[0].publishedAt, "2026-10-01T08:00:00.000Z");
  assert.equal(items[0].updatedAt, "2026-10-03T09:00:00.000Z");
  assert.deepEqual(items[0].categories, ["Health"]);
  assert.equal(items[0].summary, "Summary text");
  assert.equal(items[1].url, "https://www.africom.mil/article/2");
  assert.equal(items[1].publishedAt, null, "an Atom entry with only <updated> has no stated publication date");
  assert.equal(items[1].updatedAt, "2026-10-04T10:00:00.000Z");
  assert.equal(items[1].summary, "Body text");
});

test("feed detection, advertised-feed discovery, canonical addresses", () => {
  assert.equal(looksLikeFeed(RSS_20), true);
  assert.equal(looksLikeFeed(ATOM_10), true);
  assert.equal(looksLikeFeed(LISTING), false);
  assert.deepEqual(discoverFeedUrls(LISTING, "https://www.eucom.mil/media-gallery/press-releases"), ["https://www.eucom.mil/rss/feed.xml"]);
  assert.equal(safeUrl("javascript:alert(1)", "https://www.eucom.mil/"), null);
  assert.equal(canonicalUrl("http://WWW.eucom.mil/press-release/1/?utm_source=rss&b=2&a=1#top"), "https://www.eucom.mil/press-release/1?a=1&b=2");
  assert.equal(canonicalUrl("https://www.eucom.mil/press-release/1"), canonicalUrl("https://www.eucom.mil/press-release/1/index.html"));
});

test("discoverDirectoryFeeds: reads an RSS directory page, classifies each feed from its own label, drops off-site links, the directory itself, and Atom twins", () => {
  const dnn = discoverDirectoryFeeds(DIRECTORY_DNN, "https://www.centcom.mil/rss/");
  assert.deepEqual(dnn.map((feed) => feed.kind), ["news", "press_release", "transcript", "publication"]);
  assert.ok(dnn.every((feed) => feed.url.startsWith("https://www.centcom.mil/DesktopModules/ArticleCS/RSS.ashx?")));
  const syndication = discoverDirectoryFeeds(DIRECTORY_SYNDICATION, "https://www.southcom.mil/RSS/");
  assert.deepEqual(syndication.map((feed) => [feed.url.replace("https://www.southcom.mil", ""), feed.format]), [
    ["/syndication-feed/rss/articles", "rss"], ["/syndication-feed/rss/press-releases", "rss"], ["/syndication-feed/atom/transcripts", "atom"],
  ]);
  assert.equal(classifyFeedKind("Readouts"), "press_release");
  assert.equal(classifyFeedKind("Something else"), "news");
});

test("parseListing keeps same-site article links with real titles, reads the date the page states next to each, and invents none", () => {
  const items = parseListing(LISTING, "https://www.eucom.mil/media-gallery/press-releases");
  assert.deepEqual(items.map((entry) => [entry.url, entry.publishedAt]), [
    ["https://www.eucom.mil/press-release/20260901-command-announces-medical-readiness-exercise", "2026-09-01T12:00:00.000Z"],
    ["https://www.eucom.mil/news/article/42", "2026-08-30T10:00:00.000Z"],
    ["https://www.eucom.mil/news/article/43", null],
  ]);
  assert.equal(nearbyDate("<span>no date here</span>"), null);
});

// Addresses and titles below are the ones the production monitor read from the live INDOPACOM / SOUTHCOM listing pages on 2026-10-12; the surrounding
// markup is an approximation of that platform's listing, not a capture.
const PLATFORM_LISTING = `<html><body><nav><a href="/Contact/Directory/Biography/Article/4223733/command-senior-enlisted-leader-us-pacific-command">Senior Enlisted Leader</a>
<a href="/Newsroom/Digital-Content-Refresh">Digital Content Refresh</a></nav>
<div class="hero"><a href="/Media/News/News-Articles/Article/4623136/84th-tes-provides-total-force-support-throughout-the-pacific"><img alt=""></a>
<a href="/Media/News/News-Articles/Article/4623136/84th-tes-provides-total-force-support-throughout-the-pacific">84th TES provides Total Force support throughout the Pacific</a></div>
<div class="item"><a href="/Media/News/News-Articles/Article/4623132/a-new-chapter-in-sustainment">A New Chapter in Sustainment: 10th Support Group transitions</a></div>
<div class="item"><a href="/Media/News/News-Articles/Article/4623116/4th-multi-domain-task-force-officially-activates">Short</a><a href="/Media/News/News-Articles/Article/4623116/4th-multi-domain-task-force-officially-activates">4th Multi-Domain Task Force Officially Activates</a><span class="date">10/08/2026</span></div>
<div class="item"><a href="/Media/News/News-Articles/Article/4619667/george-hw-bush-carrier-strike-group-arrives-in-thailand">George H.W. Bush Carrier Strike Group arrives in Thailand</a><p>Oct. 4, 2026</p></div>
<div class="item"><a href="/Media/News/News-Articles/Article/4620720/usrok-partnership-highlighted-during-vandenberg-visit">U.S.–ROK partnership highlighted during Vandenberg visit</a><time datetime="2026-09-29T08:00:00Z">29 Sep</time></div>
<ul><li><a href="/News/PressReleases/Year/2026/Month/9">September 2026 (10)</a></li><li><a href="/News/PressReleases/Year/2025/Month/9">September 2025 (2)</a></li></ul></body></html>`;

test("platform listings: only story links are kept (no biographies, notices or month archives), the longest link text is the title, and dates are read in the formats pages use", () => {
  const items = parseListing(PLATFORM_LISTING, "https://www.pacom.mil/Media/NEWS/");
  assert.deepEqual(items.map((entry) => entry.title), [
    "84th TES provides Total Force support throughout the Pacific", "A New Chapter in Sustainment: 10th Support Group transitions", "4th Multi-Domain Task Force Officially Activates",
    "George H.W. Bush Carrier Strike Group arrives in Thailand", "U.S.–ROK partnership highlighted during Vandenberg visit",
  ]);
  assert.deepEqual(items.map((entry) => entry.publishedAt), [null, null, "2026-10-08T12:00:00.000Z", "2026-10-04T12:00:00.000Z", "2026-09-29T08:00:00.000Z"]);
});

test("undated listing items keep the page's own order through an order hint that is never a date; dated items have none needed", () => {
  const items = parseListing(PLATFORM_LISTING, "https://www.pacom.mil/Media/NEWS/");
  assert.equal(items[0].publishedAt, null);
  assert.ok(items[0].orderHint! > items[1].orderHint!, "the first undated item sorts above the second");
  assert.ok(items[1].orderHint! > "2026-10-08T12:00:00.000Z", "both sit just above the next dated item");
  assert.ok(items[1].orderHint! < "2026-10-08T13:00:00.000Z");
});

test("nearbyDate understands month-first, day-first, numeric and ISO dates", () => {
  assert.equal(nearbyDate("Sept. 5, 2026"), "2026-09-05T12:00:00.000Z");
  assert.equal(nearbyDate("5 September 2026"), "2026-09-05T12:00:00.000Z");
  assert.equal(nearbyDate("09/05/2026"), "2026-09-05T12:00:00.000Z");
  assert.equal(nearbyDate("2026-09-05"), "2026-09-05T12:00:00.000Z");
  assert.equal(nearbyDate("13/45/2026"), null);
});

test("the stream orders undated listing items by the page's order among dated ones, and shows no date for them", async () => {
  const d = deps({ "https://www.pacom.mil/Media/NEWS/": { body: PLATFORM_LISTING }, "https://www.pacom.mil/Media/Press-Releases-and-Readouts/": { status: 403 } });
  const response = await getCommandNews("INDOPACOM", d);
  assert.deepEqual(response.items.map((item) => item.title.slice(0, 12)), ["84th TES pro", "A New Chapte", "4th Multi-Do", "George H.W. ", "U.S.–ROK par"]);
  assert.equal(response.items[0].publishedAt, null);
  const refused = response.sources.find((entry) => entry.sourceId === "indopacom-press-releases")!;
  assert.match(refused.sourceError ?? "", /HTTP 403 \(the site refused this automated request\)/);
});

test("a feed directory that answers but exposes no feed addresses is reported with what the page held, not as an empty feed", async () => {
  const page = "<html><body><a href='/News'>News</a><a href='/rss-help'>About RSS</a><script src='/x.js'></script></body></html>";
  assert.match(describeDirectoryPage(page, "https://www.southcom.mil/RSS/"), /2 links, 1 scripts\) but lists no feed address.*links that mention a feed: https:\/\/www\.southcom\.mil\/rss-help/);
  const result = await collectSource(source("southcom-rss-directory"), deps({ "https://www.southcom.mil/RSS/": { body: page } }));
  assert.equal(result.report.status, "source_returned_no_data");
  assert.match(result.report.feeds[0].error ?? "", /lists no feed address/);
});

test("health and medical-policy wording is deterministic, limited to the item's own text, and never a requirement", () => {
  assert.deepEqual(healthTerms("Force Health Protection update").sort(), ["force health", "force health protection", "health"]);
  assert.deepEqual(healthTerms("Exercise concludes"), []);
  assert.deepEqual(policyTerms("New medical clearance and quarantine guidance"), ["medical clearance", "quarantine"]);
  assert.deepEqual(policyTerms("Clinic opens"), []);
});

// ---- Collection: feeds, Atom alternate, fallback, failure ------------------------------------------------------------------------------

test("EUCOM press releases: the supplied RSS feed is used and its Atom twin is not fetched (no duplicate records)", async () => {
  const d = deps({ [`${EU}/syndication-feed/rss/press-releases`]: { body: RSS_20 } });
  const result = await collectSource(source("eucom-press-releases"), d);
  assert.equal(result.report.status, "ok");
  assert.equal(result.report.method, "feed");
  assert.equal(result.report.feedUrl, `${EU}/syndication-feed/rss/press-releases`);
  assert.deepEqual(d.calls, [`${EU}/syndication-feed/rss/press-releases`]);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.report.feeds.map((feed) => [feed.role, feed.status]), [["rss", "ok"]]);
});

test("EUCOM press releases: when the RSS address fails the Atom equivalent is used and reported as such", async () => {
  const d = deps({ [`${EU}/syndication-feed/rss/press-releases`]: { status: 403 }, [`${EU}/syndication-feed/atom/press-releases`]: { body: ATOM_10.replace(/africom/g, "eucom") } });
  const result = await collectSource(source("eucom-press-releases"), d);
  assert.equal(result.report.status, "ok");
  assert.equal(result.report.method, "atom_feed");
  assert.deepEqual(result.report.feeds.map((feed) => [feed.role, feed.status, feed.httpStatus]), [["rss", "unavailable", 403], ["atom", "ok", 200]]);
  assert.match(result.report.note ?? "", /1 of 2 feed addresses could not be read/);
});

test("EUCOM press releases: with both feeds down the official listing page is monitored instead, and says so", async () => {
  const d = deps({ [`${EU}/media-gallery/press-releases`]: { body: LISTING_NO_FEED } });
  const result = await collectSource(source("eucom-press-releases"), d);
  assert.equal(result.report.status, "ok");
  assert.equal(result.report.method, "html_listing");
  assert.match(result.report.note ?? "", /No feed was available/);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.report.feeds.map((feed) => feed.role), ["rss", "atom", "listing"]);
});

test("EUCOM documents (no listing page known): with both feeds down the source is unavailable, with each address and error recorded, not empty", async () => {
  const d = deps({ [`${EU}/syndication-feed/rss/documents`]: { throws: "socket hang up" }, [`${EU}/syndication-feed/atom/documents`]: { status: 503 } });
  const result = await collectSource(source("eucom-documents"), d);
  assert.equal(result.report.status, "source_unavailable");
  assert.equal(result.records.length, 0);
  assert.equal(result.report.lastSuccessfulFetch, null);
  assert.deepEqual(result.report.feeds.map((feed) => [feed.url.split("/").slice(-3).join("/"), feed.status]), [["rss/documents", "unavailable"], ["atom/documents", "unavailable"]].map(([u, s]) => [`syndication-feed/${u}`, s]));
  assert.match(result.report.sourceError ?? "", /socket hang up/);
});

test("a feed address that answers with HTML (a login or block page) is unavailable, not an empty feed", async () => {
  const d = deps({ [`${EU}/syndication-feed/rss/documents`]: { body: "<html>Access Denied</html>" }, [`${EU}/syndication-feed/atom/documents`]: { body: rss() } });
  const result = await collectSource(source("eucom-documents"), d);
  assert.equal(result.report.feeds[0].status, "unavailable");
  assert.match(result.report.feeds[0].error ?? "", /not an RSS\/Atom feed/);
  assert.equal(result.report.feeds[1].status, "no_items");
  assert.equal(result.report.status, "source_returned_no_data");
  assert.match(result.report.note ?? "", /not evidence that the command published nothing/);
});

test("CENTCOM: feeds are discovered from the official RSS directory, each classified, one failing feed is reported while the others are shown", async () => {
  const base = "https://www.centcom.mil/DesktopModules/ArticleCS/RSS.ashx";
  const d = deps({
    "https://www.centcom.mil/rss/": { body: DIRECTORY_DNN },
    [`${base}?ContentType=1&Site=808&max=10`]: { body: rss({ title: "CENTCOM news story", url: "https://www.centcom.mil/MEDIA/NEWS-ARTICLES/Article/1/x/", date: "Mon, 05 Oct 2026 10:00:00 GMT" }) },
    [`${base}?ContentType=9&Site=808&max=10`]: { body: rss({ title: "CENTCOM release", url: "https://www.centcom.mil/MEDIA/PRESS-RELEASES/Press-Release-View/Article/2/y/", date: "Tue, 06 Oct 2026 10:00:00 GMT" }) },
    [`${base}?ContentType=400&Site=808&max=10`]: { status: 500 },
    [`${base}?ContentType=7&Site=808&max=10`]: { body: rss({ title: "CENTCOM directive", url: "https://www.centcom.mil/Documents/3.pdf" }) },
  });
  const result = await collectSource(source("centcom-rss-directory"), d);
  assert.equal(result.report.status, "ok");
  assert.equal(result.report.method, "discovered_feed");
  assert.deepEqual(result.records.map((record) => record.kind).sort(), ["news", "press_release", "publication"]);
  const discovered = result.report.feeds.filter((feed) => feed.role === "discovered");
  assert.deepEqual(discovered.map((feed) => feed.status), ["ok", "ok", "unavailable", "ok"]);
  assert.equal(discovered[2].httpStatus, 500);
  assert.equal(discovered[2].kind, "transcript");
  assert.match(result.report.note ?? "", /1 of 4 feed addresses could not be read/);
});

test("CENTCOM RSS directory unreachable: reported as unavailable with the HTTP status; the other CENTCOM source is unaffected", async () => {
  const d = deps({ "https://www.centcom.mil/rss/": { status: 403 }, "https://www.centcom.mil/MEDIA/PRESS-RELEASES/": { body: LISTING_NO_FEED.replace(/\/press-release\//g, "/PRESS-RELEASES/Press-Release-View/Article/") } });
  const response = await getCommandNews("CENTCOM", d);
  const directory = response.sources.find((entry) => entry.sourceId === "centcom-rss-directory")!;
  assert.equal(directory.status, "source_unavailable");
  assert.equal(directory.httpStatus, 403);
  assert.equal(response.coverage, "some_sources_unavailable");
  assert.ok(response.items.length > 0);
});

test("a page that answers with nothing readable is source_returned_no_data, not unavailable and not 'nothing published'", async () => {
  const d = deps({ "https://www.pacom.mil/Media/NEWS/": { body: "<html><body>Loading…</body></html>" } });
  const result = await collectSource(source("indopacom-news"), d);
  assert.equal(result.report.status, "source_returned_no_data");
  assert.match(result.report.note ?? "", /not evidence that the command published nothing/);
});

test("a failed refresh serves the last-known items labeled STALE_CACHE with the earlier successful-fetch time", async () => {
  const store = createMemoryStore();
  const url = `${EU}/syndication-feed/rss/press-releases`;
  await collectSource(source("eucom-press-releases"), deps({ [url]: { body: RSS_20 } }, "2026-10-11T12:00:00Z", store));
  const later = deps({ [url]: { throws: "socket hang up" } }, "2026-10-11T14:00:00Z", store);
  const result = await getCommandNews("EUCOM", later);
  const report = result.sources.find((entry) => entry.sourceId === "eucom-press-releases")!;
  assert.equal(report.status, "stale_cache");
  assert.equal(report.lastSuccessfulFetch, "2026-10-11T12:00:00.000Z");
  assert.equal(report.lastAttemptedFetch, "2026-10-11T14:00:00.000Z");
  assert.match(report.sourceError ?? "", /socket hang up/);
  const own = result.items.filter((item) => item.sourceId === "eucom-press-releases");
  assert.equal(own.length, 3);
  assert.ok(own.every((item) => item.freshness === "STALE_CACHE" && item.lastKnownData));
});

test("results are reused for 30 minutes; failures retry after 5; an explicit refresh is rate limited to once a minute", async () => {
  const store = createMemoryStore();
  const url = `${EU}/syndication-feed/rss/press-releases`;
  await collectSource(source("eucom-press-releases"), deps({ [url]: { body: RSS_20 } }, "2026-10-11T12:00:00Z", store));
  const cachedRead = deps({ [url]: { body: RSS_20 } }, "2026-10-11T12:20:00Z", store);
  await collectSource(source("eucom-press-releases"), cachedRead);
  assert.equal(cachedRead.calls.length, 0);
  const tooSoon = deps({ [url]: { body: RSS_20 } }, "2026-10-11T12:00:30Z", store);
  await collectSource(source("eucom-press-releases"), tooSoon, { refresh: true });
  assert.equal(tooSoon.calls.length, 0);
  const refreshed = deps({ [url]: { body: RSS_20 } }, "2026-10-11T12:05:00Z", store);
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

// ---- Durable tracking and change detection ---------------------------------------------------------------------------------------------

test("tracking: the first read is the baseline; later new items are first-seen then; unchanged items stay unchanged; the state survives a new process (same store)", async () => {
  const store = createMemoryStore();
  const url = `${EU}/syndication-feed/rss/articles`;
  const a = { title: "Story A", url: `${EU}/article/a`, date: "Mon, 05 Oct 2026 10:00:00 GMT", description: "First" };
  const b = { title: "Story B", url: `${EU}/article/b`, date: "Tue, 06 Oct 2026 10:00:00 GMT", description: "Second" };
  const first = await collectSource(source("eucom-articles"), deps({ [url]: { body: rss(a) } }, "2026-10-11T12:00:00Z", store));
  assert.equal(first.records.length, 1);
  assert.equal(first.records[0].baseline, true);
  assert.equal(first.records[0].firstSeenAt, "2026-10-11T12:00:00.000Z");

  const second = await collectSource(source("eucom-articles"), deps({ [url]: { body: rss(a, b) } }, "2026-10-11T13:00:00Z", store));
  const byTitle = Object.fromEntries(second.records.map((record) => [record.title, record]));
  assert.equal(byTitle["Story B"].baseline, false);
  assert.equal(byTitle["Story B"].firstSeenAt, "2026-10-11T13:00:00.000Z");
  assert.equal(byTitle["Story A"].firstSeenAt, "2026-10-11T12:00:00.000Z", "first-seen is durable");
  assert.equal(byTitle["Story A"].lastSeenAt, "2026-10-11T13:00:00.000Z");
  assert.equal(byTitle["Story A"].lastChangedAt, null);
  assert.deepEqual(byTitle["Story A"].changes, []);
});

test("change detection: an edited title/description is recorded with the fields and time; a date the page stops stating is not erased; an item that leaves the feed is kept", async () => {
  const store = createMemoryStore();
  const url = `${EU}/syndication-feed/rss/articles`;
  const original = { title: "Medical readiness exercise", url: `${EU}/article/a`, date: "Mon, 05 Oct 2026 10:00:00 GMT", description: "Original text" };
  await collectSource(source("eucom-articles"), deps({ [url]: { body: rss(original) } }, "2026-10-11T12:00:00Z", store));
  const edited = await collectSource(source("eucom-articles"), deps({ [url]: { body: rss({ ...original, title: "Medical readiness exercise (corrected)", description: "Revised text" }) } }, "2026-10-11T13:00:00Z", store));
  assert.deepEqual(edited.records[0].changes, [{ at: "2026-10-11T13:00:00.000Z", fields: ["title", "description"] }]);
  assert.equal(edited.records[0].lastChangedAt, "2026-10-11T13:00:00.000Z");
  assert.equal(edited.records[0].title, "Medical readiness exercise (corrected)");

  const undated = await collectSource(source("eucom-articles"), deps({ [url]: { body: rss({ title: "Medical readiness exercise (corrected)", url: `${EU}/article/a`, description: "Revised text" }) } }, "2026-10-11T14:00:00Z", store));
  assert.equal(undated.records[0].publishedAt, "2026-10-05T10:00:00.000Z");
  assert.equal(undated.records[0].changes.length, 1, "no new change was recorded");

  const other = await collectSource(source("eucom-articles"), deps({ [url]: { body: rss({ title: "Different story entirely", url: `${EU}/article/z`, date: "Wed, 07 Oct 2026 10:00:00 GMT" }) } }, "2026-10-11T15:00:00Z", store));
  const kept = other.records.find((record) => record.url === `${EU}/article/a`)!;
  assert.equal(kept.inFeed, false);
  assert.equal(other.records.length, 2);
  assert.equal(other.report.itemCount, 1, "itemCount counts what the source is serving now");
});

test("a partial feed failure never marks the failed feed's items as gone", async () => {
  const store = createMemoryStore();
  const base = "https://www.centcom.mil/DesktopModules/ArticleCS/RSS.ashx";
  const routes = (secondOk: boolean) => ({
    "https://www.centcom.mil/rss/": { body: DIRECTORY_DNN },
    [`${base}?ContentType=1&Site=808&max=10`]: { body: rss({ title: "News story", url: "https://www.centcom.mil/MEDIA/NEWS-ARTICLES/Article/1/x/" }) },
    [`${base}?ContentType=9&Site=808&max=10`]: secondOk ? { body: rss({ title: "Release story", url: "https://www.centcom.mil/MEDIA/PRESS-RELEASES/Press-Release-View/Article/2/y/" }) } : { status: 500 },
  });
  await collectSource(source("centcom-rss-directory"), deps(routes(true), "2026-10-11T12:00:00Z", store));
  const later = await collectSource(source("centcom-rss-directory"), deps(routes(false), "2026-10-11T13:00:00Z", store));
  assert.ok(later.records.every((record) => record.inFeed), "the release item is still considered present");
  assert.equal(later.records.length, 2);
});

// ---- Cross-feed deduplication ----------------------------------------------------------------------------------------------------------

test("one publication in two feeds becomes one record: the most specific type wins and both sources are kept as provenance", async () => {
  const shared = { title: "Joint exercise concludes", url: `${EU}/article/9?utm_source=rss`, date: "Mon, 05 Oct 2026 10:00:00 GMT", description: "Short" };
  const sharedPr = { ...shared, url: `${EU}/article/9/`, description: "A longer description from the press release feed" };
  const d = deps({
    [`${EU}/syndication-feed/rss/articles`]: { body: rss(shared, { title: "Only an article", url: `${EU}/article/10`, date: "Tue, 06 Oct 2026 10:00:00 GMT" }) },
    [`${EU}/syndication-feed/rss/press-releases`]: { body: rss(sharedPr) },
    [`${EU}/syndication-feed/rss/documents`]: { body: rss({ title: "Policy memo", url: `${EU}/documents/memo.pdf`, date: "Wed, 07 Oct 2026 10:00:00 GMT" }) },
    [`${EU}/syndication-feed/rss/transcripts`]: { body: rss({ title: "Commander remarks", url: `${EU}/transcript/1`, date: "Thu, 08 Oct 2026 10:00:00 GMT" }) },
  });
  const response = await getCommandNews("EUCOM", d);
  assert.equal(response.counts.total, 4);
  assert.equal(response.counts.duplicatesMerged, 1);
  assert.deepEqual(response.counts.byKind, { news: 1, press_release: 1, publication: 1, transcript: 1 });
  const joint = response.items.find((item) => item.title === "Joint exercise concludes")!;
  assert.equal(joint.kind, "press_release");
  assert.equal(joint.summary, "A longer description from the press release feed");
  assert.deepEqual(joint.sources.map((entry) => entry.sourceId).sort(), ["eucom-articles", "eucom-press-releases"]);
  assert.deepEqual(response.items.map((item) => item.kind), ["transcript", "publication", "news", "press_release"], "newest first: distinct kinds are all present");
});

test("dedupe also merges the same story published under two addresses (same command, same title, same stated date)", () => {
  const base = { command: "EUCOM" as const, sourceId: "s", sourceName: "S", kind: "news" as const, summary: "", publishedAt: "2026-10-05T10:00:00.000Z", updatedAt: null, orderHint: null, firstSeenAt: "2026-10-11T12:00:00.000Z", lastSeenAt: "2026-10-11T12:00:00.000Z", lastChangedAt: null, changeCount: 0, lastChange: null, baseline: true, retrievedAt: "2026-10-11T12:00:00.000Z", freshness: "CURRENT_NOTICE" as const, lastKnownData: false, healthTerms: [], policyTerms: [], countries: [], sources: [{ sourceId: "s", sourceName: "S", kind: "news" as const, feedUrls: [] }] };
  const out = dedupe([{ ...base, id: "1", title: "Same Story!", url: "https://www.eucom.mil/a" }, { ...base, id: "2", title: "same story", url: "https://www.eucom.mil/b" }, { ...base, id: "3", title: "Same story", url: "https://www.eucom.mil/c", publishedAt: "2026-10-06T10:00:00.000Z" }]);
  assert.equal(out.items.length, 2);
  assert.equal(out.merged, 1);
});

// ---- Country relevance -----------------------------------------------------------------------------------------------------------------

test("country tags come only from the item's own words and its own command; command-wide items stay command-wide", () => {
  const kenya = countryTags("AFRICOM", { title: "Medical readiness training in Kenya", summary: "", categories: [] });
  assert.deepEqual(kenya.map((tag) => [tag.name, tag.mentionedIn]), [["Kenya", ["title"]]]);
  assert.deepEqual(countryTags("AFRICOM", { title: "Aid arrives in South Sudan", summary: "", categories: [] }).map((tag) => tag.name), ["South Sudan"], "South Sudan is not also read as Sudan");
  assert.deepEqual(countryTags("AFRICOM", { title: "Commander meets Spanish and Polish counterparts in Spain", summary: "", categories: [] }), [], "a country of another command is not attached");
  assert.deepEqual(countryTags("AFRICOM", { title: "Command-wide health protection update", summary: "Applies to all personnel.", categories: ["Health"] }), []);
  assert.deepEqual(countryTags("EUCOM", { title: "Training in Georgia", summary: "", categories: [] }), [], "ambiguous names are never matched");
  const category = countryTags("AFRICOM", { title: "Exercise concludes", summary: "", categories: ["Kenya"] });
  assert.deepEqual(category.map((tag) => tag.mentionedIn), [["category"]]);
});

// ---- Command responses ------------------------------------------------------------------------------------------------------------------

test("getCommandNews merges a command's sources newest-first (undated last), reports partial coverage, and never claims a requirement", async () => {
  const d = deps({
    "https://www.pacom.mil/Media/Press-Releases-and-Readouts/": { body: rss({ title: "Readout one", url: "https://www.pacom.mil/Media/Press-Releases/Article/1/a/", date: "Mon, 05 Oct 2026 10:00:00 GMT" }, { title: "Readout two with no date", url: "https://www.pacom.mil/Media/Press-Releases/Article/2/b/" }, { title: "Readout three", url: "https://www.pacom.mil/Media/Press-Releases/Article/3/c/", date: "Tue, 06 Oct 2026 09:30:00 GMT" }) },
    "https://www.pacom.mil/Media/NEWS/": { status: 503 },
  });
  const response = await getCommandNews("INDOPACOM", d);
  assert.equal(response.coverage, "some_sources_unavailable");
  assert.deepEqual(response.items.map((item) => item.title), ["Readout three", "Readout one", "Readout two with no date"]);
  assert.deepEqual(response.sources.map((entry) => entry.status).sort(), ["ok", "source_unavailable"]);
  assert.ok(response.limitations.some((text) => /never change a REQUIRED/.test(text)));
  assert.ok(response.limitations.some((text) => /no date/.test(text)));
});

test("getCommandNews: when every source of a command is down the response says so and carries no invented items", async () => {
  const response = await getCommandNews("SOUTHCOM", deps({}));
  assert.equal(response.coverage, "no_source_available");
  assert.equal(response.items.length, 0);
  assert.equal(response.sources.length, sourcesForCommand("SOUTHCOM").length);
  assert.ok(response.sources.every((entry) => entry.status === "source_unavailable"));
});

test("getCommandNews works for all six commands and attaches country tags and health wording", async () => {
  for (const command of COMMAND_NEWS_COMMANDS) {
    const response = await getCommandNews(command, deps({}));
    assert.equal(response.command, command);
    assert.equal(response.sources.length, sourcesForCommand(command).length);
  }
  const d = deps({ [`${AF}/syndication-feed/atom/articles`]: { body: ATOM_10 }, [`${AF}/syndication-feed/rss/articles`]: { status: 404 } });
  const africom = await getCommandNews("AFRICOM", d);
  const kenya = africom.items.find((item) => item.title.includes("Kenya"))!;
  assert.deepEqual(kenya.countries.map((tag) => tag.name), ["Kenya"]);
  assert.ok(kenya.healthTerms.includes("health"));
  assert.equal(kenya.updatedAt, "2026-10-03T09:00:00.000Z");
  assert.equal(africom.items.find((item) => item.title === "Updated-only entry")!.countries.length, 0);
});

test("monitor: before any fetch every source is not_evaluated; after a refresh it reports per-command rollups including per-feed health", async () => {
  const store = createMemoryStore();
  const before = await getNewsMonitor(deps({}, undefined, store));
  assert.equal(before.sources.length, COMMAND_NEWS_SOURCES.length);
  assert.ok(before.sources.every((entry) => entry.status === "not_evaluated"));
  assert.ok(before.commands.every((entry) => entry.neverFetched === entry.sourceCount));
  const after = await getNewsMonitor(deps({ [`${EU}/syndication-feed/rss/press-releases`]: { body: RSS_20 }, [`${EU}/syndication-feed/rss/articles`]: { status: 403 } }, undefined, store), { refresh: true });
  const eucom = after.commands.find((entry) => entry.command === "EUCOM")!;
  assert.equal(eucom.ok, 1);
  assert.equal(eucom.unavailable, 3);
  assert.equal(eucom.feedsOk, 1);
  assert.ok(eucom.feedsFailed >= 6);
  assert.equal(after.commands.find((entry) => entry.command === "CENTCOM")!.unavailable, 2);
});
