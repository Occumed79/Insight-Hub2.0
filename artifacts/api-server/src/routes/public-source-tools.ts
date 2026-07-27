import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

function getEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function isTruthy(value: string | undefined): boolean {
  return !!value && ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .replace(/(api[_-]?key|token|authorization)=?[^&\s]*/gi, "$1=[redacted]")
    .slice(0, 260);
}

async function fetchJson(url: string, options?: RequestInit, timeoutMs = 25_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    let payload: unknown = null;
    try { payload = body ? JSON.parse(body) : null; } catch { payload = null; }
    if (!response.ok) {
      const record = asRecord(payload);
      throw new Error(text(record?.message) || text(record?.detail) || `Source returned HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 25_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Occu-Med Insight Hub/2.0 public-data research" },
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

router.get("/public-data/fec", async (req: Request, res: Response) => {
  const query = text(req.query.query);
  if (!query) return res.status(400).json({ ok: false, error: "query is required" });
  const apiKey = getEnv("FEC_API_KEY");
  if (!apiKey) return res.status(503).json({ ok: false, error: "FEC_API_KEY is not configured." });

  try {
    const committeeParams = new URLSearchParams({ api_key: apiKey, q: query, per_page: "12", sort: "-cycle" });
    const committeePayload = asRecord(await fetchJson(`https://api.open.fec.gov/v1/committees/?${committeeParams}`));
    const committees = asArray(committeePayload?.results).map((item) => {
      const row = asRecord(item);
      return {
        committeeId: text(row?.committee_id),
        name: text(row?.name),
        designation: text(row?.designation_full) || text(row?.designation),
        committeeType: text(row?.committee_type_full) || text(row?.committee_type),
        organizationType: text(row?.organization_type_full) || text(row?.organization_type),
        party: text(row?.party_full) || text(row?.party),
        state: text(row?.state),
        treasurer: text(row?.treasurer_name),
        filingFrequency: text(row?.filing_frequency),
        cycles: asArray(row?.cycles).map(text).filter(Boolean),
        sourceUrl: text(row?.committee_id) ? `https://www.fec.gov/data/committee/${text(row?.committee_id)}/` : "https://www.fec.gov/data/committees/",
      };
    }).filter((item) => item.committeeId && item.name);

    const committeeIds = committees.slice(0, 5).map((item) => item.committeeId);
    const filingRuns = await Promise.all(committeeIds.map(async (committeeId) => {
      const params = new URLSearchParams({ api_key: apiKey, committee_id: committeeId, per_page: "20", sort: "-receipt_date" });
      const payload = asRecord(await fetchJson(`https://api.open.fec.gov/v1/filings/?${params}`));
      return asArray(payload?.results).map((item) => {
        const row = asRecord(item);
        const fileNumber = text(row?.file_number);
        return {
          committeeId,
          committeeName: text(row?.committee_name),
          formType: text(row?.form_type),
          reportType: text(row?.report_type_full) || text(row?.report_type),
          reportYear: numberValue(row?.report_year),
          coverageStart: text(row?.coverage_start_date),
          coverageEnd: text(row?.coverage_end_date),
          receiptDate: text(row?.receipt_date),
          totalReceipts: numberValue(row?.total_receipts),
          totalDisbursements: numberValue(row?.total_disbursements),
          cashOnHandEnd: numberValue(row?.cash_on_hand_end_period),
          fileNumber,
          sourceUrl: fileNumber ? `https://docquery.fec.gov/cgi-bin/forms/${committeeId}/${fileNumber}/` : `https://www.fec.gov/data/committee/${committeeId}/?tab=filings`,
        };
      });
    }));

    const filings = filingRuns.flat().sort((a, b) => b.receiptDate.localeCompare(a.receiptDate)).slice(0, 40);
    return res.json({
      ok: true,
      query,
      committees,
      filings,
      source: "Federal Election Commission OpenFEC API",
      sourceUrl: "https://www.fec.gov/data/",
      limitation: "Name matches require human review. Committee or employee political activity must not be attributed to the employer without explicit sponsorship evidence. Contributor information may not be used for commercial solicitation.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.post("/public-data/usaspending", async (req: Request, res: Response) => {
  const companyName = text(req.body?.companyName);
  const state = text(req.body?.state).toUpperCase();
  const fromDate = text(req.body?.fromDate) || `${new Date().getFullYear() - 5}-01-01`;
  const toDate = text(req.body?.toDate) || new Date().toISOString().slice(0, 10);
  if (!companyName) return res.status(400).json({ ok: false, error: "companyName is required" });
  if (!isTruthy(getEnv("USASPENDING_API_ENABLED"))) {
    return res.status(503).json({ ok: false, error: "USAspending is disabled by USASPENDING_API_ENABLED." });
  }

  const filters: Record<string, unknown> = {
    recipient_search_text: [companyName],
    time_period: [{ start_date: fromDate, end_date: toDate }],
    award_type_codes: ["A", "B", "C", "D", "IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
  };
  if (/^[A-Z]{2}$/.test(state)) filters.place_of_performance_locations = [{ country: "USA", state }];

  try {
    const payload = asRecord(await fetchJson("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        filters,
        fields: ["Award ID", "Recipient Name", "Award Amount", "Description", "Start Date", "End Date", "Awarding Agency", "Awarding Sub Agency", "Place of Performance City", "Place of Performance State", "Place of Performance Country Code", "NAICS Code", "NAICS Description"],
        page: 1,
        limit: 50,
        sort: "Award Amount",
        order: "desc",
        subawards: false,
      }),
    }));
    const awards = asArray(payload?.results).map((item) => {
      const row = asRecord(item);
      return {
        awardId: text(row?.["Award ID"]),
        recipientName: text(row?.["Recipient Name"]),
        awardAmount: numberValue(row?.["Award Amount"]),
        description: text(row?.Description),
        startDate: text(row?.["Start Date"]),
        endDate: text(row?.["End Date"]),
        awardingAgency: text(row?.["Awarding Agency"]),
        awardingSubAgency: text(row?.["Awarding Sub Agency"]),
        city: text(row?.["Place of Performance City"]),
        state: text(row?.["Place of Performance State"]),
        country: text(row?.["Place of Performance Country Code"]),
        naics: text(row?.["NAICS Code"]),
        naicsDescription: text(row?.["NAICS Description"]),
      };
    });
    return res.json({
      ok: true,
      companyName,
      fromDate,
      toDate,
      awards,
      totalAwardAmount: awards.reduce((sum, award) => sum + (award.awardAmount ?? 0), 0),
      source: "USAspending.gov API",
      sourceUrl: "https://www.usaspending.gov/",
      limitation: "Awards describe federal spending and contractor footprint. They do not establish current staffing, workplace risk, contract performance, or occupational-health need.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.get("/public-data/courtlistener", async (req: Request, res: Response) => {
  const query = text(req.query.query);
  if (!query) return res.status(400).json({ ok: false, error: "query is required" });
  const token = getEnv("COURTLISTENER_API_TOKEN");
  if (!token) return res.status(503).json({ ok: false, error: "COURTLISTENER_API_TOKEN is not configured." });

  try {
    const params = new URLSearchParams({ q: `"${query}"`, type: "r", order_by: "dateFiled desc" });
    const payload = asRecord(await fetchJson(`https://www.courtlistener.com/api/rest/v4/search/?${params}`, {
      headers: { Authorization: `Token ${token}`, Accept: "application/json" },
    }));
    const references = asArray(payload?.results).slice(0, 40).map((item) => {
      const row = asRecord(item);
      const absoluteUrl = text(row?.absolute_url) || text(row?.resource_uri);
      return {
        caseName: text(row?.caseName) || text(row?.case_name) || text(row?.caption) || "Court record",
        docketNumber: text(row?.docketNumber) || text(row?.docket_number),
        dateFiled: text(row?.dateFiled) || text(row?.date_filed),
        court: text(row?.court) || text(row?.court_name) || text(row?.court_citation_string),
        citation: text(row?.citation) || asArray(row?.citation).map(text).filter(Boolean).join(", "),
        snippet: stripHtml(text(row?.snippet) || text(row?.text) || text(row?.description)),
        sourceUrl: absoluteUrl ? (absoluteUrl.startsWith("http") ? absoluteUrl : `https://www.courtlistener.com${absoluteUrl}`) : "https://www.courtlistener.com/",
      };
    });
    return res.json({
      ok: true,
      query,
      references,
      source: "CourtListener REST API",
      sourceUrl: "https://www.courtlistener.com/",
      limitation: "Search results are public legal references only. A name match does not establish identity, relevance, liability, negligence, wrongdoing, or an adverse legal outcome.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

router.get("/public-data/aor-risk", async (req: Request, res: Response) => {
  const country = text(req.query.country);
  if (!country) return res.status(400).json({ ok: false, error: "country is required" });
  const listUrl = "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html";

  try {
    const listHtml = await fetchText(listUrl);
    const linkPattern = /<a[^>]+href=["']([^"']*traveladvisories\/[^"']+-travel-advisory\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const normalizedCountry = country.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    let selectedUrl = "";
    let selectedTitle = "";
    for (const match of listHtml.matchAll(linkPattern)) {
      const title = stripHtml(match[2]);
      const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (normalizedTitle.includes(normalizedCountry) || normalizedCountry.includes(normalizedTitle.replace(/ travel advisory$/i, ""))) {
        selectedUrl = match[1].startsWith("http") ? match[1] : `https://travel.state.gov${match[1].startsWith("/") ? "" : "/"}${match[1]}`;
        selectedTitle = title;
        break;
      }
    }

    if (!selectedUrl) {
      return res.json({
        ok: true,
        country,
        found: false,
        advisory: null,
        source: "U.S. Department of State Travel Advisories",
        sourceUrl: listUrl,
        limitation: "No exact advisory link was resolved from the official advisory index. Use the official source link for manual review.",
      });
    }

    const advisoryHtml = await fetchText(selectedUrl);
    const advisoryText = stripHtml(advisoryHtml);
    const levelMatch = advisoryText.match(/Level\s*([1-4])\s*[-–:]?\s*(Exercise Normal Precautions|Exercise Increased Caution|Reconsider Travel|Do Not Travel)?/i);
    const level = levelMatch ? Number(levelMatch[1]) : null;
    const levelLabel = levelMatch?.[2] || ({ 1: "Exercise Normal Precautions", 2: "Exercise Increased Caution", 3: "Reconsider Travel", 4: "Do Not Travel" } as Record<number, string>)[level ?? 0] || "Level not parsed";
    const dateMatch = advisoryText.match(/(?:Updated|Reissued|Issued)\s*(?:with updates to)?\s*:?\s*([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i);
    const riskTerms = ["crime", "terrorism", "civil unrest", "kidnapping", "armed conflict", "wrongful detention", "health", "natural disaster", "landmines", "limited healthcare", "political instability"];
    const riskFactors = riskTerms.filter((term) => advisoryText.toLowerCase().includes(term));
    const levelIndex = levelMatch?.index ?? 0;
    const summary = advisoryText.slice(levelIndex, levelIndex + 900).replace(/\s+/g, " ").trim();

    return res.json({
      ok: true,
      country,
      found: true,
      advisory: {
        title: selectedTitle || `${country} Travel Advisory`,
        level,
        levelLabel,
        updatedAt: dateMatch?.[1] || null,
        riskFactors,
        summary,
        sourceUrl: selectedUrl,
      },
      source: "U.S. Department of State Travel Advisories",
      sourceUrl: selectedUrl,
      limitation: "This is official U.S. travel-advisory context, not a complete security assessment. Conditions can change rapidly and the result should be checked against the full advisory and local operational reporting.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: safeError(error) });
  }
});

export default router;
