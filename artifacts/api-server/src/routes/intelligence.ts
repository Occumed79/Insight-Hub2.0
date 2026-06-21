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

type SourceDiagnostic = {
  source: string;
  status: "success" | "no-results" | "error" | "not-applicable" | "needs-key";
  factsFound: number;
  aliasesQueried: string[];
  message: string;
  error?: string;
};

type IngestDiagnostics = {
  sources: SourceDiagnostic[];
  liveFactsInserted: number;
  sourceLeadsInserted: number;
  totalInserted: number;
  aliasesUsed: string[];
};

const COMPANY_ALIASES: Record<string, string[]> = {
  "v2x-global-footprint-intelligence": [
    "V2X", "V2X Inc", "Vectrus", "Vectrus Systems Corporation",
    "Vertex Aerospace", "The Vertex Company", "Vectrus Mission Solutions", "Vectrus Services",
  ],
  caci: ["CACI", "CACI International", "CACI Inc"],
  fluor: ["Fluor", "Fluor Corporation", "Fluor Corp"],
  gdit: ["GDIT", "General Dynamics Information Technology", "General Dynamics IT"],
  "freeport-mcmoran": ["Freeport-McMoRan", "Freeport McMoRan", "Freeport", "FCX"],
  "dynamic-aviation": ["Dynamic Aviation", "Dynamic Aviation Group"],
  "ids-international": ["IDS International", "IDS International Solutions"],
  constellis: ["Constellis", "Constellis Holdings"],
  "asrc-federal": ["ASRC Federal", "ASRC Federal Holding"],
  ecc: ["ECC", "ECC International"],
  iap: ["IAP", "IAP Worldwide Services"],
  amentum: ["Amentum", "Amentum Services"],
};

function getAliases(companyId: string, companyName: string, requestAliases: string[]): string[] {
  const configAliases = COMPANY_ALIASES[companyId] ?? [];
  const all = [companyName, ...requestAliases, ...configAliases];
  return [...new Set(all.map((a) => a.trim()).filter(Boolean))];
}

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

async function fetchUSASpendingAwards(
  aliases: string[],
  companyId: string
): Promise<{ facts: FactRow[]; diagnostic: SourceDiagnostic }> {
  const seenAwardIds = new Set<string>();
  const facts: FactRow[] = [];
  const aliasesQueried: string[] = [];

  for (const alias of aliases) {
    aliasesQueried.push(alias);
    const body = {
      filters: {
        award_type_codes: ["A", "B", "C", "D"],
        keywords: [alias],
        time_period: [{ start_date: "2022-01-01", end_date: "2026-12-31" }],
      },
      fields: [
        "Award ID", "Recipient Name", "Award Amount", "Start Date", "End Date",
        "Awarding Agency", "Awarding Sub Agency", "Contract Award Type", "Award Type",
      ],
      page: 1,
      limit: 25,
      sort: "Award Amount",
      order: "desc",
    };

    try {
      const response = await fetch("https://api.usaspending.gov/api/v1/search/spending_by_award/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Occu-Med Insight Hub intelligence ingestion" },
        body: JSON.stringify(body),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as USASpendingResponse;
      const awards = data.results ?? [];

      for (const award of awards) {
        const awardId = award["Award ID"] || award.generated_internal_id || "";
        if (!awardId || seenAwardIds.has(awardId)) continue;
        seenAwardIds.add(awardId);

        const recipientName = award["Recipient Name"] || alias;
        const amount = typeof award["Award Amount"] === "number" ? award["Award Amount"] : undefined;
        const startDate = award["Start Date"] || "";
        const awardingAgency = award["Awarding Agency"] || "Federal agency";

        const recipientLower = recipientName.toLowerCase();
        const isExactMatch = aliases.some((a) => recipientLower.includes(a.toLowerCase()));
        const confidence: IntelligenceConfidence = isExactMatch ? "high" : "medium";

        facts.push({
          companyId,
          title: `${awardingAgency} contract award — ${recipientName}`,
          category: "contractAwards",
          date: startDate,
          value: amount,
          valueUnit: "usd",
          sourceUrl: `https://www.usaspending.gov/award/${awardId}`,
          sourceName: "USASpending.gov",
          sourceType: "usaspending",
          confidence,
          rawSnippet: `${recipientName} — ${award["Contract Award Type"] || "Contract"} — $${(amount ?? 0).toLocaleString()} — ${awardingAgency}`,
          summary: `Federal contract award of $${(amount ?? 0).toLocaleString()} from ${awardingAgency} to ${recipientName}, starting ${startDate || "unknown date"}.`,
          metadata: {
            awardId, recipientName, awardingAgency,
            awardingSubAgency: award["Awarding Sub Agency"],
            endDate: award["End Date"],
            awardType: award["Award Type"],
            matchedAlias: alias,
          },
        });
      }
    } catch {
      // continue to next alias
    }
  }

  return {
    facts,
    diagnostic: {
      source: "usaspending",
      status: facts.length > 0 ? "success" : "no-results",
      factsFound: facts.length,
      aliasesQueried,
      message: facts.length > 0
        ? `${facts.length} contract awards found across ${aliasesQueried.length} alias queries.`
        : `No awards found for any of ${aliasesQueried.length} aliases: ${aliasesQueried.join(", ")}.`,
    },
  };
}

async function fetchSECFilings(
  aliases: string[],
  companyId: string
): Promise<{ facts: FactRow[]; diagnostic: SourceDiagnostic }> {
  const facts: FactRow[] = [];
  const aliasesQueried: string[] = [];

  for (const alias of aliases) {
    aliasesQueried.push(alias);
    const url = new URL("https://api.sec.gov/cgi-bin/browse-edgar");
    url.searchParams.set("action", "getcompany");
    url.searchParams.set("company", alias);
    url.searchParams.set("type", "10-K");
    url.searchParams.set("dateb", "");
    url.searchParams.set("owner", "include");
    url.searchParams.set("count", "5");
    url.searchParams.set("output", "atom");

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Occu-Med Insight Hub research/research@occumed.example.com",
          "Accept": "application/json",
        },
      });
      if (!response.ok) continue;

      const text = await response.text();
      const entryMatches = text.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
      if (entryMatches.length === 0) continue;

      for (const entryXml of entryMatches.slice(0, 5)) {
        const titleMatch = entryXml.match(/<title>(.*?)<\/title>/);
        const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/);
        const idMatch = entryXml.match(/<id>(.*?)<\/id>/);
        const title = titleMatch ? titleMatch[1].trim() : "SEC Filing";
        const filedDate = updatedMatch ? updatedMatch[1].split("T")[0] : "";
        const link = idMatch ? idMatch[1].trim() : undefined;

        facts.push({
          companyId,
          title: title,
          category: "secFilings",
          date: filedDate,
          sourceUrl: link,
          sourceName: "SEC EDGAR",
          sourceType: "sec",
          confidence: "high",
          summary: `SEC 10-K filing: ${title} filed on ${filedDate}.`,
          metadata: { filingLink: link, matchedAlias: alias },
        });
      }
      break;
    } catch {
      // continue to next alias
    }
  }

  const status: SourceDiagnostic["status"] = facts.length > 0 ? "success" : "no-results";
  const message = facts.length > 0
    ? `${facts.length} SEC filings found.`
    : `No SEC filings found for any of ${aliasesQueried.length} aliases. Company may be private or not a SEC registrant.`;

  return {
    facts,
    diagnostic: {
      source: "sec",
      status,
      factsFound: facts.length,
      aliasesQueried,
      message,
    },
  };
}

function buildSourceLeads(companyName: string, companyId: string): { leads: FactRow[]; diagnostic: SourceDiagnostic } {
  const encoded = encodeURIComponent(companyName);
  const quoted = encodeURIComponent(`"${companyName}"`);
  const today = new Date().toISOString().split("T")[0];

  const leads: FactRow[] = [
    {
      companyId,
      title: `SAM.gov opportunities search for ${companyName}`,
      category: "opportunities",
      date: today,
      sourceUrl: `https://sam.gov/search/?index=opp&keywords=${encoded}`,
      sourceName: "SAM.gov",
      sourceType: "sam",
      confidence: "link-only",
      summary: `SAM.gov opportunity search link for "${companyName}". API key required for automated fetch.`,
      metadata: { needsKey: true, recordType: "sourceLead", reason: "SAM.gov API requires an API key not currently configured." },
    },
    {
      companyId,
      title: `Official company website search for ${companyName}`,
      category: "sourceFacts",
      date: today,
      sourceUrl: `https://www.google.com/search?q=${quoted}+official+website`,
      sourceName: "Web search",
      sourceType: "official",
      confidence: "link-only",
      summary: `Official website search link for "${companyName}". Use to verify corporate footprint and leadership.`,
      metadata: { needsReview: true, recordType: "sourceLead", reason: "Manual review link — no automated fetch configured." },
    },
    {
      companyId,
      title: `Career portal search for ${companyName}`,
      category: "jobSignals",
      date: today,
      sourceUrl: `https://www.google.com/search?q=${quoted}+careers+jobs+locations`,
      sourceName: "Web search",
      sourceType: "careers",
      confidence: "link-only",
      summary: `Career portal search link for "${companyName}". Job postings signal growth and location expansion.`,
      metadata: { needsReview: true, recordType: "sourceLead", reason: "Manual review link — no automated fetch configured." },
    },
  ];

  return {
    leads,
    diagnostic: {
      source: "sam/official/careers",
      status: "needs-key",
      factsFound: 0,
      aliasesQueried: [companyName],
      message: "3 source leads stored for manual review. SAM.gov requires API key; official/careers are web search links.",
    },
  };
}

function buildChartReady(facts: FactRow[]) {
  const liveFacts = facts.filter((f) => f.confidence !== "link-only");

  const awardValueTimeline = liveFacts
    .filter((f) => f.category === "contractAwards" && f.value !== undefined && f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({ date: f.date, value: f.value ?? 0, title: f.title, sourceName: f.sourceName }));

  const opportunitiesByStage = liveFacts
    .filter((f) => f.category === "opportunities")
    .reduce<Record<string, string | number>[]>((acc, f) => {
      const stage = (f.metadata?.stage as string) || "identified";
      const existing = acc.find((item) => item.stage === stage);
      if (existing) {
        existing.count = (existing.count as number) + 1;
      } else {
        acc.push({ stage, count: 1, label: f.title });
      }
      return acc;
    }, []);

  const sourceConfidenceOverTime = liveFacts
    .filter((f) => f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({
      date: f.date,
      confidence: f.confidence === "high" ? 3 : f.confidence === "medium" ? 2 : 1,
      sourceName: f.sourceName,
      category: f.category,
    }));

  const jobSignalTrend = liveFacts
    .filter((f) => f.category === "jobSignals" && f.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map((f) => ({ date: f.date, value: f.value ?? 1, title: f.title, sourceName: f.sourceName }));

  const eventTimeline = liveFacts
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

  const locationExposureByRegion = liveFacts
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

  const networkGapScoreByRegion = liveFacts
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

    const liveFacts = mappedFacts.filter((f) => f.confidence !== "link-only");
    const sourceLeads = mappedFacts.filter((f) => f.confidence === "link-only");

    res.json({
      ok: true,
      companyId,
      facts: mappedFacts,
      runs: mappedRuns,
      chartReady,
      diagnostics: {
        liveFacts: liveFacts.length,
        sourceLeads: sourceLeads.length,
        total: mappedFacts.length,
      },
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
    const requestAliases: string[] = Array.isArray(req.body?.aliases) ? req.body.aliases : [];
    if (!companyId || !companyName) {
      res.status(400).json({ ok: false, error: "companyId and companyName are required" });
      return;
    }

    const aliases = getAliases(companyId, companyName, requestAliases);

    const [run] = await db.insert(intelligenceRunsTable).values({
      companyId,
      startedAt: new Date(),
      status: "running",
      sourcesQueried: [],
    }).returning();

    const sourcesQueried: string[] = [];
    const allFacts: FactRow[] = [];
    const diagnostics: SourceDiagnostic[] = [];
    const errors: string[] = [];

    // USASpending — free, no key required
    sourcesQueried.push("usaspending");
    try {
      const { facts: usaFacts, diagnostic: usaDiag } = await fetchUSASpendingAwards(aliases, companyId);
      allFacts.push(...usaFacts);
      diagnostics.push(usaDiag);
      if (usaFacts.length === 0) {
        errors.push(`USASpending: no awards found for ${aliases.length} aliases`);
      }
    } catch (err) {
      const msg = `USASpending: ${err instanceof Error ? err.message : "failed"}`;
      errors.push(msg);
      diagnostics.push({ source: "usaspending", status: "error", factsFound: 0, aliasesQueried: aliases, message: msg, error: msg });
    }

    // SEC EDGAR — free, no key required
    sourcesQueried.push("sec");
    try {
      const { facts: secFacts, diagnostic: secDiag } = await fetchSECFilings(aliases, companyId);
      allFacts.push(...secFacts);
      diagnostics.push(secDiag);
      if (secFacts.length === 0) {
        errors.push(`SEC: no filings found — company may be private`);
      }
    } catch (err) {
      const msg = `SEC: ${err instanceof Error ? err.message : "failed"}`;
      errors.push(msg);
      diagnostics.push({ source: "sec", status: "error", factsFound: 0, aliasesQueried: aliases, message: msg, error: msg });
    }

    // Source leads — SAM.gov, official, careers (not counted as live facts)
    sourcesQueried.push("sam", "official", "careers");
    const { leads, diagnostic: leadDiag } = buildSourceLeads(companyName, companyId);
    diagnostics.push(leadDiag);
    allFacts.push(...leads);

    // Insert facts into DB
    const insertedFacts: typeof intelligenceFactsTable.$inferSelect[] = allFacts.length > 0
      ? await db.insert(intelligenceFactsTable).values(
          allFacts.map((f) => ({
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

    const liveFactsInserted = insertedFacts.filter((f) => f.confidence !== "link-only").length;
    const sourceLeadsInserted = insertedFacts.filter((f) => f.confidence === "link-only").length;

    // Update run status
    const runStatus = liveFactsInserted > 0 ? (errors.length > 0 ? "partial" : "completed") : (insertedFacts.length > 0 ? "partial" : "failed");
    await db.update(intelligenceRunsTable).set({
      completedAt: new Date(),
      sourcesQueried,
      factsCollected: insertedFacts.length,
      status: runStatus,
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

    const ingestDiagnostics: IngestDiagnostics = {
      sources: diagnostics,
      liveFactsInserted,
      sourceLeadsInserted,
      totalInserted: insertedFacts.length,
      aliasesUsed: aliases,
    };

    res.json({
      ok: true,
      runId: run.id,
      companyId,
      companyName,
      sourcesQueried,
      factsCollected: insertedFacts.length,
      liveFactsInserted,
      sourceLeadsInserted,
      status: runStatus,
      errors: errors.length > 0 ? errors : undefined,
      diagnostics: ingestDiagnostics,
      facts: mappedFacts,
      chartReady,
    });
  } catch (error) {
    console.error("Intelligence ingestion error:", error);
    res.status(503).json({ ok: false, error: error instanceof Error ? error.message : "Ingestion failed" });
  }
});

export default router;
