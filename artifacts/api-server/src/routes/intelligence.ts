import { Router, type IRouter } from "express";
import { db, intelligenceFactsTable, intelligenceRunsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

type IntelligenceCategory =
  | "contractAwards"
  | "opportunities"
  | "secFilings"
  | "jobSignals"
  | "sourceFacts"
  | "sourceConfidence"
  | "timelineEvents"
  | "locationExposure"
  | "medicalNetworkGaps"
  | "competitorSignals"
  | "renewalOrExpirationEvents";

type IntelligenceSourceType =
  | "usaspending"
  | "sec"
  | "sam"
  | "official"
  | "careers"
  | "manual"
  | "news"
  | "web";

type IntelligenceConfidence = "high" | "medium" | "low" | "link-only";

type FactRow = {
  companyId: string;
  title: string;
  category: IntelligenceCategory;
  date: string;
  value?: number;
  valueUnit?: "usd" | "count" | "percent" | "score";
  sourceUrl?: string;
  sourceName: string;
  sourceType: IntelligenceSourceType;
  confidence: IntelligenceConfidence;
  rawSnippet?: string;
  summary: string;
  metadata: Record<string, unknown>;
};

type USASpendingAward = {
  "Award ID"?: string;
  "Recipient Name"?: string;
  "Award Amount"?: number;
  "Start Date"?: string;
  "End Date"?: string;
  "Awarding Agency"?: string;
  "Awarding Sub Agency"?: string;
  "Contract Award Type"?: string;
  "Award Type"?: string;
  recipient_id?: string;
  generated_internal_id?: string;
};

type USASpendingResponse = {
  results: USASpendingAward[];
  page_metadata?: { total?: number; page?: number };
};

async function fetchUSASpendingAwards(companyName: string): Promise<FactRow[]> {
  const url = new URL("https://api.usaspending.gov/api/v1/search/spending_by_award/");
  const body = {
    filters: {
      award_type_codes: ["A", "B", "C", "D"],
      keywords: [companyName],
      time_period: [{ start_date: "2023-01-01", end_date: "2025-12-31" }],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Start Date",
      "End Date",
      "Awarding Agency",
      "Awarding Sub Agency",
      "Contract Award Type",
      "Award Type",
    ],
    page: 1,
    limit: 10,
    sort: "Award Amount",
    order: "desc",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Occu-Med Insight Hub intelligence ingestion" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`USASpending API returned ${response.status}`);
  const data = (await response.json()) as USASpendingResponse;
  const awards = data.results ?? [];

  return awards.map((award): FactRow => {
    const amount = typeof award["Award Amount"] === "number" ? award["Award Amount"] : undefined;
    const startDate = award["Start Date"] || "";
    const awardId = award["Award ID"] || award.generated_internal_id || "unknown";
    return {
      companyId: "",
      title: `${award["Awarding Agency"] || "Federal agency"} contract award`,
      category: "contractAwards",
      date: startDate,
      value: amount,
      valueUnit: "usd",
      sourceUrl: `https://www.usaspending.gov/award/${awardId}`,
      sourceName: "USASpending.gov",
      sourceType: "usaspending",
      confidence: "high",
      rawSnippet: `${award["Recipient Name"] || companyName} — ${award["Contract Award Type"] || "Contract"} — $${(amount ?? 0).toLocaleString()}`,
      summary: `Federal contract award of $${(amount ?? 0).toLocaleString()} from ${award["Awarding Agency"] || "unknown agency"} starting ${startDate || "unknown date"}.`,
      metadata: {
        awardId,
        recipientName: award["Recipient Name"],
        awardingAgency: award["Awarding Agency"],
        awardingSubAgency: award["Awarding Sub Agency"],
        endDate: award["End Date"],
        awardType: award["Award Type"],
      },
    };
  });
}

async function fetchSECFilings(companyName: string): Promise<FactRow[]> {
  const url = new URL("https://api.sec.gov/cgi-bin/browse-edgar");
  url.searchParams.set("action", "getcompany");
  url.searchParams.set("company", companyName);
  url.searchParams.set("type", "10-K");
  url.searchParams.set("dateb", "");
  url.searchParams.set("owner", "include");
  url.searchParams.set("count", "5");
  url.searchParams.set("output", "atom");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Occu-Med Insight Hub research/research@occumed.example.com",
      "Accept": "application/json",
    },
  });
  if (!response.ok) throw new Error(`SEC EDGAR returned ${response.status}`);

  const text = await response.text();
  const filings: FactRow[] = [];

  const entryMatches = text.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const entryXml of entryMatches.slice(0, 5)) {
    const titleMatch = entryXml.match(/<title>(.*?)<\/title>/);
    const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/);
    const idMatch = entryXml.match(/<id>(.*?)<\/id>/);
    const title = titleMatch ? titleMatch[1].trim() : "SEC Filing";
    const filedDate = updatedMatch ? updatedMatch[1].split("T")[0] : "";
    const link = idMatch ? idMatch[1].trim() : undefined;

    filings.push({
      companyId: "",
      title: title,
      category: "secFilings",
      date: filedDate,
      sourceUrl: link,
      sourceName: "SEC EDGAR",
      sourceType: "sec",
      confidence: "high",
      summary: `SEC filing: ${title} filed on ${filedDate}.`,
      metadata: { filingLink: link },
    });
  }

  if (filings.length === 0) {
    const searchUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(companyName)}&type=10-K&dateb=&owner=include&count=5&output=atom`;
    filings.push({
      companyId: "",
      title: `SEC EDGAR search for ${companyName}`,
      category: "secFilings",
      date: new Date().toISOString().split("T")[0],
      sourceUrl: searchUrl,
      sourceName: "SEC EDGAR",
      sourceType: "sec",
      confidence: "link-only",
      summary: `No 10-K filings parsed from SEC EDGAR for "${companyName}". The search link is available for manual review.`,
      metadata: { searchUrl, needsReview: true },
    });
  }

  return filings;
}

function buildLinkOnlyFacts(companyName: string): FactRow[] {
  const encoded = encodeURIComponent(companyName);
  const quoted = encodeURIComponent(`"${companyName}"`);
  const today = new Date().toISOString().split("T")[0];

  return [
    {
      companyId: "",
      title: `SAM.gov opportunities search for ${companyName}`,
      category: "opportunities",
      date: today,
      sourceUrl: `https://sam.gov/search/?index=opp&keywords=${encoded}`,
      sourceName: "SAM.gov",
      sourceType: "sam",
      confidence: "link-only",
      summary: `SAM.gov opportunity search link for "${companyName}". API key required for automated fetch — stored as link-only for manual review.`,
      metadata: { needsKey: true, reason: "SAM.gov API requires an API key not currently configured." },
    },
    {
      companyId: "",
      title: `Official company website search for ${companyName}`,
      category: "sourceFacts",
      date: today,
      sourceUrl: `https://www.google.com/search?q=${quoted}+official+website`,
      sourceName: "Web search",
      sourceType: "official",
      confidence: "link-only",
      summary: `Official website search link for "${companyName}". Use this to verify corporate footprint, leadership, and operating context.`,
      metadata: { needsReview: true },
    },
    {
      companyId: "",
      title: `Career portal search for ${companyName}`,
      category: "jobSignals",
      date: today,
      sourceUrl: `https://www.google.com/search?q=${quoted}+careers+jobs+locations`,
      sourceName: "Web search",
      sourceType: "careers",
      confidence: "link-only",
      summary: `Career portal search link for "${companyName}". Job postings can signal growth, location expansion, and workforce composition.`,
      metadata: { needsReview: true },
    },
    {
      companyId: "",
      title: `USASpending search for ${companyName}`,
      category: "contractAwards",
      date: today,
      sourceUrl: `https://www.usaspending.gov/search/?keyword=${encoded}`,
      sourceName: "USASpending.gov",
      sourceType: "usaspending",
      confidence: "link-only",
      summary: `USASpending.gov search link for "${companyName}". Use this to review federal contract award history and recipient profiles.`,
      metadata: { needsReview: true },
    },
  ];
}

function buildChartReady(facts: FactRow[]) {
  const awardValueTimeline = facts
    .filter((f) => f.category === "contractAwards" && f.value !== undefined && f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({ date: f.date, value: f.value ?? 0, title: f.title, sourceName: f.sourceName }));

  const opportunitiesByStage = facts
    .filter((f) => f.category === "opportunities")
    .reduce<Record<string, string | number>[]>((acc, f) => {
      const stage = (f.metadata?.stage as string) || "link-only";
      const existing = acc.find((item) => item.stage === stage);
      if (existing) {
        existing.count = (existing.count as number) + 1;
      } else {
        acc.push({ stage, count: 1, label: f.title });
      }
      return acc;
    }, []);

  const sourceConfidenceOverTime = facts
    .filter((f) => f.confidence !== "link-only" && f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({
      date: f.date,
      confidence: f.confidence === "high" ? 3 : f.confidence === "medium" ? 2 : 1,
      sourceName: f.sourceName,
      category: f.category,
    }));

  const jobSignalTrend = facts
    .filter((f) => f.category === "jobSignals" && f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({ date: f.date, value: f.value ?? 1, title: f.title, sourceName: f.sourceName }));

  const eventTimeline = facts
    .filter((f) => f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({
      date: f.date,
      category: f.category,
      title: f.title,
      sourceName: f.sourceName,
      confidence: f.confidence,
      value: f.value ?? 0,
    }));

  const locationExposureByRegion = facts
    .filter((f) => f.category === "locationExposure")
    .reduce<Record<string, string | number>[]>((acc, f) => {
      const region = (f.metadata?.region as string) || "Unknown";
      const existing = acc.find((item) => item.region === region);
      if (existing) {
        existing.count = (existing.count as number) + 1;
        existing.value = ((existing.value as number) || 0) + (f.value || 0);
      } else {
        acc.push({ region, count: 1, value: f.value ?? 0 });
      }
      return acc;
    }, []);

  const networkGapScoreByRegion = facts
    .filter((f) => f.category === "medicalNetworkGaps")
    .map((f) => ({
      region: (f.metadata?.region as string) || "Unknown",
      gapScore: f.value ?? 0,
      title: f.title,
      sourceName: f.sourceName,
    }));

  return {
    awardValueTimeline,
    opportunitiesByStage,
    sourceConfidenceOverTime,
    jobSignalTrend,
    eventTimeline,
    locationExposureByRegion,
    networkGapScoreByRegion,
  };
}

router.get("/intelligence/health", async (_req, res) => {
  try {
    await db.select().from(intelligenceFactsTable).limit(1);
    res.json({ ok: true, status: "available" });
  } catch (error) {
    console.error("Intelligence health error:", error);
    res.status(503).json({ ok: false, status: "unavailable", error: error instanceof Error ? error.message : "Database unavailable" });
  }
});

router.get("/intelligence/company/:companyId", async (req, res) => {
  try {
    const companyId = String(req.params.companyId || "").trim();
    if (!companyId) {
      res.status(400).json({ ok: false, error: "companyId is required" });
      return;
    }
    const facts = await db.select().from(intelligenceFactsTable).where(eq(intelligenceFactsTable.companyId, companyId)).orderBy(desc(intelligenceFactsTable.discoveredAt));
    const runs = await db.select().from(intelligenceRunsTable).where(eq(intelligenceRunsTable.companyId, companyId)).orderBy(desc(intelligenceRunsTable.startedAt));

    const mappedFacts = facts.map((f) => ({
      id: String(f.id),
      companyId: f.companyId,
      title: f.title,
      category: f.category as IntelligenceCategory,
      date: f.factDate || "",
      discoveredAt: f.discoveredAt.toISOString(),
      value: f.value ? Number(f.value) : undefined,
      valueUnit: (f.valueUnit as "usd" | "count" | "percent" | "score") || undefined,
      sourceUrl: f.sourceUrl || undefined,
      sourceName: f.sourceName,
      sourceType: f.sourceType as IntelligenceSourceType,
      confidence: f.confidence as IntelligenceConfidence,
      rawSnippet: f.rawSnippet || undefined,
      summary: f.summary,
      metadata: (f.metadata as Record<string, unknown>) || {},
    }));

    const mappedRuns = runs.map((r) => ({
      id: String(r.id),
      companyId: r.companyId,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() || "",
      sourcesQueried: (r.sourcesQueried as string[]) || [],
      factsCollected: r.factsCollected,
      status: r.status as "completed" | "partial" | "failed",
      error: r.error || undefined,
    }));

    const chartReady = buildChartReady(mappedFacts);

    res.json({
      ok: true,
      companyId,
      facts: mappedFacts,
      runs: mappedRuns,
      chartReady,
    });
  } catch (error) {
    console.error("Get intelligence error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Failed to get intelligence" });
  }
});

router.post("/intelligence/ingest/company", async (req, res) => {
  try {
    const companyId = String(req.body?.companyId || "").trim();
    const companyName = String(req.body?.companyName || "").trim();
    if (!companyId || !companyName) {
      res.status(400).json({ ok: false, error: "companyId and companyName are required" });
      return;
    }

    const [run] = await db.insert(intelligenceRunsTable).values({
      companyId,
      startedAt: new Date(),
      status: "running",
      sourcesQueried: [],
    }).returning();

    const sourcesQueried: string[] = [];
    const allFacts: FactRow[] = [];
    const errors: string[] = [];

    // USASpending — free, no key required
    try {
      sourcesQueried.push("usaspending");
      const usaFacts = await fetchUSASpendingAwards(companyName);
      allFacts.push(...usaFacts);
    } catch (err) {
      errors.push(`USASpending: ${err instanceof Error ? err.message : "failed"}`);
    }

    // SEC EDGAR — free, no key required
    try {
      sourcesQueried.push("sec");
      const secFacts = await fetchSECFilings(companyName);
      allFacts.push(...secFacts);
    } catch (err) {
      errors.push(`SEC: ${err instanceof Error ? err.message : "failed"}`);
    }

    // Link-only sources — SAM.gov, official, careers, USASpending search
    sourcesQueried.push("sam", "official", "careers");
    allFacts.push(...buildLinkOnlyFacts(companyName));

    // Assign companyId to all facts
    const factsWithCompany = allFacts.map((f) => ({ ...f, companyId }));

    // Insert facts into DB
    const insertedFacts = factsWithCompany.length > 0
      ? await db.insert(intelligenceFactsTable).values(
          factsWithCompany.map((f) => ({
            companyId: f.companyId,
            title: f.title,
            category: f.category,
            factDate: f.date || null,
            value: f.value !== undefined ? String(f.value) : null,
            valueUnit: f.valueUnit || null,
            sourceUrl: f.sourceUrl || null,
            sourceName: f.sourceName,
            sourceType: f.sourceType,
            confidence: f.confidence,
            rawSnippet: f.rawSnippet || null,
            summary: f.summary,
            metadata: f.metadata,
            runId: run.id,
          }))
        ).returning()
      : [];

    // Update run status
    await db.update(intelligenceRunsTable).set({
      completedAt: new Date(),
      sourcesQueried,
      factsCollected: insertedFacts.length,
      status: errors.length > 0 && insertedFacts.length === 0 ? "failed" : errors.length > 0 ? "partial" : "completed",
      error: errors.length > 0 ? errors.join("; ") : null,
    }).where(eq(intelligenceRunsTable.id, run.id));

    const mappedFacts = insertedFacts.map((f) => ({
      id: String(f.id),
      companyId: f.companyId,
      title: f.title,
      category: f.category as IntelligenceCategory,
      date: f.factDate || "",
      discoveredAt: f.discoveredAt.toISOString(),
      value: f.value ? Number(f.value) : undefined,
      valueUnit: (f.valueUnit as "usd" | "count" | "percent" | "score") || undefined,
      sourceUrl: f.sourceUrl || undefined,
      sourceName: f.sourceName,
      sourceType: f.sourceType as IntelligenceSourceType,
      confidence: f.confidence as IntelligenceConfidence,
      rawSnippet: f.rawSnippet || undefined,
      summary: f.summary,
      metadata: (f.metadata as Record<string, unknown>) || {},
    }));

    const chartReady = buildChartReady(mappedFacts);

    res.json({
      ok: true,
      runId: run.id,
      companyId,
      companyName,
      sourcesQueried,
      factsCollected: insertedFacts.length,
      status: errors.length > 0 && insertedFacts.length === 0 ? "failed" : errors.length > 0 ? "partial" : "completed",
      errors: errors.length > 0 ? errors : undefined,
      facts: mappedFacts,
      chartReady,
    });
  } catch (error) {
    console.error("Intelligence ingestion error:", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Ingestion failed" });
  }
});

export default router;
