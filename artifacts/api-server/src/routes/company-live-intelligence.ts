import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

type LiveSourceName = "SAM.gov" | "SEC EDGAR" | "CourtListener" | "USAspending";
type LiveSignalCategory = "entity" | "filing" | "litigation" | "federal-award";
type LiveSourceState = "success" | "empty" | "disabled" | "error";

type LiveSignal = {
  id: string;
  source: LiveSourceName;
  category: LiveSignalCategory;
  title: string;
  summary: string;
  occurredAt?: string;
  geography?: string;
  identifiers: Record<string, string>;
  metrics: Record<string, string | number>;
  evidenceFields: string[];
  confidence: number;
  sourceUrl: string;
};

type LiveSourceStatus = {
  source: LiveSourceName;
  configured: boolean;
  enabled: boolean;
  state: LiveSourceState;
  latencyMs: number;
  resultCount: number;
  sourceUrl: string;
  freshness: string;
  limitation: string;
  error?: string;
};

type SourceRun = {
  status: LiveSourceStatus;
  signals: LiveSignal[];
  warnings: string[];
};

type FetchResult = {
  ok: boolean;
  status: number;
  data: unknown | null;
  error?: string;
};

function getEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Request failed";
  return message
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .replace(/(api[_-]?key|token|authorization)=?[^&\s]*/gi, "$1=[redacted]")
    .slice(0, 260);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function nested(record: Record<string, unknown> | null, ...path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord) return undefined;
    current = currentRecord[key];
  }
  return current;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = stringValue(value);
    if (text) return text;
  }
  return "";
}

function truncate(value: string, length = 280): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= length ? compact : `${compact.slice(0, length - 1).trimEnd()}…`;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

function normalizedName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|plc|holdings?)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function nameConfidence(query: string, candidate: string, strong = 0.92, fallback = 0.68): number {
  const queryName = normalizedName(query);
  const candidateName = normalizedName(candidate);
  if (!queryName || !candidateName) return fallback;
  if (queryName === candidateName) return strong;
  if (candidateName.includes(queryName) || queryName.includes(candidateName)) return Math.max(fallback, strong - 0.08);
  return fallback;
}

function safeDate(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function formatAddress(record: Record<string, unknown> | null): string | undefined {
  if (!record) return undefined;
  const parts = [
    firstString(record.addressLine1, record.address_line_1, record.streetAddress),
    firstString(record.city, record.cityName),
    firstString(record.stateOrProvinceCode, record.stateOrProvince, record.state),
    firstString(record.zipCode, record.zip, record.postalCode),
    firstString(record.countryCode, record.country),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

async function fetchJson(url: string, options?: RequestInit, timeoutMs = 20_000): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = null;
      }
    }
    if (!response.ok) {
      const detail = firstString(
        nested(asRecord(data), "detail"),
        nested(asRecord(data), "message"),
        nested(asRecord(data), "error"),
      );
      return {
        ok: false,
        status: response.status,
        data,
        error: detail ? truncate(detail, 220) : `Source returned HTTP ${response.status}`,
      };
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: sanitizeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

function disabledRun(
  source: LiveSourceName,
  configured: boolean,
  sourceUrl: string,
  freshness: string,
  limitation: string,
  reason: string,
): SourceRun {
  return {
    signals: [],
    warnings: [reason],
    status: {
      source,
      configured,
      enabled: false,
      state: "disabled",
      latencyMs: 0,
      resultCount: 0,
      sourceUrl,
      freshness,
      limitation,
      error: reason,
    },
  };
}

async function runSam(companyName: string, state?: string): Promise<SourceRun> {
  const started = Date.now();
  const source: LiveSourceName = "SAM.gov";
  const sourceUrl = "https://sam.gov/content/entity-information";
  const limitation = "SAM.gov supports federal entity identity and registration evidence; it does not establish occupational risk, ownership, or affiliation beyond returned fields.";
  const apiKey = getEnv("SAM_API_KEY") || getEnv("SAM_GOV_API_KEY");
  if (!apiKey) {
    return disabledRun(source, false, sourceUrl, "Live at manual run time", limitation, "SAM.gov is not configured.");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    legalBusinessName: companyName,
    registrationStatus: "A",
    includeSections: "entityRegistration,coreData,assertions",
  });
  if (state) params.set("physicalAddressProvinceOrStateCode", state);

  const fetched = await fetchJson(`https://api.sam.gov/entity-information/v3/entities?${params.toString()}`);
  const latencyMs = Date.now() - started;
  if (!fetched.ok) {
    return {
      signals: [],
      warnings: [`SAM.gov request failed: ${fetched.error ?? "Unknown source error"}`],
      status: {
        source,
        configured: true,
        enabled: true,
        state: "error",
        latencyMs,
        resultCount: 0,
        sourceUrl,
        freshness: "Live at manual run time",
        limitation,
        error: fetched.error,
      },
    };
  }

  const payload = asRecord(fetched.data);
  const entities = asArray(payload?.entities);
  const signals = entities.slice(0, 10).flatMap((item, index): LiveSignal[] => {
    const entity = asRecord(item);
    if (!entity) return [];
    const registration = asRecord(entity.entityRegistration) ?? entity;
    const coreData = asRecord(entity.coreData);
    const assertions = asRecord(entity.assertions);
    const physicalAddress = asRecord(nested(coreData, "physicalAddress"))
      ?? asRecord(nested(registration, "physicalAddress"))
      ?? asRecord(entity.physicalAddress);

    const legalName = firstString(registration.legalBusinessName, entity.legalBusinessName, entity.entityName);
    if (!legalName) return [];

    const dbaName = firstString(registration.dbaName, entity.dbaName);
    const uei = firstString(registration.ueiSAM, entity.ueiSAM, entity.uei);
    const cage = firstString(registration.cageCode, entity.cageCode, entity.cage);
    const registrationStatus = firstString(registration.registrationStatus, entity.registrationStatus);
    const updatedAt = safeDate(firstString(registration.lastUpdateDate, entity.lastUpdateDate));
    const address = formatAddress(physicalAddress);

    const naicsRecords = asArray(
      nested(assertions, "goodsAndServices", "naicsList")
      ?? nested(assertions, "goodsAndServices", "naics")
      ?? entity.naicsCodes,
    );
    const naics = naicsRecords
      .map((entry) => {
        if (typeof entry === "string" || typeof entry === "number") return stringValue(entry);
        const record = asRecord(entry);
        return firstString(record?.naicsCode, record?.code);
      })
      .filter(Boolean)
      .slice(0, 8);

    const identifiers: Record<string, string> = {};
    if (uei) identifiers.uei = uei;
    if (cage) identifiers.cage = cage;
    if (dbaName) identifiers.dba = dbaName;

    const metrics: Record<string, string | number> = {};
    if (registrationStatus) metrics.registrationStatus = registrationStatus;
    if (naics.length > 0) metrics.naicsCodes = naics.join(", ");

    const summaryParts = [
      dbaName ? `DBA: ${dbaName}` : "",
      registrationStatus ? `Registration: ${registrationStatus}` : "",
      address ? `Address: ${address}` : "",
      naics.length > 0 ? `NAICS: ${naics.join(", ")}` : "",
    ].filter(Boolean);

    return [{
      id: `sam-${slug(uei || legalName)}-${index}`,
      source,
      category: "entity",
      title: legalName,
      summary: truncate(summaryParts.join(" · ") || "SAM.gov returned a federal entity identity record."),
      occurredAt: updatedAt,
      geography: address,
      identifiers,
      metrics,
      evidenceFields: [
        "Legal business name",
        ...(dbaName ? ["DBA name"] : []),
        ...(uei ? ["UEI"] : []),
        ...(cage ? ["CAGE"] : []),
        ...(address ? ["Physical address"] : []),
        ...(naics.length > 0 ? ["NAICS assertions"] : []),
      ],
      confidence: nameConfidence(companyName, legalName, 0.96, 0.76),
      sourceUrl,
    }];
  });

  return {
    signals,
    warnings: [],
    status: {
      source,
      configured: true,
      enabled: true,
      state: signals.length > 0 ? "success" : "empty",
      latencyMs,
      resultCount: signals.length,
      sourceUrl,
      freshness: "Live at manual run time",
      limitation,
    },
  };
}

async function runSec(companyName: string): Promise<SourceRun> {
  const started = Date.now();
  const source: LiveSourceName = "SEC EDGAR";
  const sourceUrl = "https://www.sec.gov/edgar/search/";
  const limitation = "SEC search results are filing and issuer signals. They do not independently prove ownership, subsidiary status, workplace conditions, or occupational risk.";
  const userAgent = getEnv("SEC_USER_AGENT");
  if (!userAgent) {
    return disabledRun(source, false, sourceUrl, "Live at manual run time", limitation, "SEC EDGAR is not configured because SEC_USER_AGENT is missing.");
  }

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 6);
  const params = new URLSearchParams({
    q: companyName,
    dateRange: "custom",
    startdt: startDate.toISOString().slice(0, 10),
    enddt: new Date().toISOString().slice(0, 10),
  });

  const fetched = await fetchJson(
    `https://efts.sec.gov/LATEST/search-index?${params.toString()}`,
    { headers: { "User-Agent": userAgent, Accept: "application/json" } },
  );
  const latencyMs = Date.now() - started;
  if (!fetched.ok) {
    return {
      signals: [],
      warnings: [`SEC EDGAR request failed: ${fetched.error ?? "Unknown source error"}`],
      status: {
        source,
        configured: true,
        enabled: true,
        state: "error",
        latencyMs,
        resultCount: 0,
        sourceUrl,
        freshness: "Live at manual run time",
        limitation,
        error: fetched.error,
      },
    };
  }

  const payload = asRecord(fetched.data);
  const hits = asRecord(payload?.hits);
  const hitRecords = asArray(hits?.hits);
  const signals = hitRecords.slice(0, 12).flatMap((item, index): LiveSignal[] => {
    const hit = asRecord(item);
    const record = asRecord(hit?._source) ?? hit;
    if (!record) return [];

    const entityName = firstString(
      record.entity_name,
      record.display_name,
      asArray(record.display_names)[0],
      companyName,
    );
    const form = firstString(record.form, asArray(record.root_forms)[0], "SEC filing");
    const filedAt = safeDate(firstString(record.file_date, record.filed_at, record.date_filed));
    const cik = firstString(record.entity_id, record.cik).replace(/\D/g, "");
    const ticker = firstString(record.ticker);
    const accession = firstString(record.accession_no, record.accessionNumber);
    const description = firstString(record.file_description, record.description);
    const identifiers: Record<string, string> = {};
    if (cik) identifiers.cik = cik;
    if (ticker) identifiers.ticker = ticker;
    if (accession) identifiers.accession = accession;

    return [{
      id: `sec-${slug(accession || `${entityName}-${form}`)}-${index}`,
      source,
      category: "filing",
      title: `${form} · ${entityName}`,
      summary: truncate(description || `SEC EDGAR returned a ${form} filing associated with the searched company name.`),
      occurredAt: filedAt,
      identifiers,
      metrics: { form },
      evidenceFields: [
        "Issuer/display name",
        "SEC form",
        ...(filedAt ? ["Filing date"] : []),
        ...(cik ? ["CIK"] : []),
        ...(ticker ? ["Ticker"] : []),
        ...(accession ? ["Accession number"] : []),
      ],
      confidence: nameConfidence(companyName, entityName, 0.9, 0.62),
      sourceUrl,
    }];
  });

  return {
    signals,
    warnings: [],
    status: {
      source,
      configured: true,
      enabled: true,
      state: signals.length > 0 ? "success" : "empty",
      latencyMs,
      resultCount: signals.length,
      sourceUrl,
      freshness: "Live at manual run time",
      limitation,
    },
  };
}

async function runCourtListener(companyName: string): Promise<SourceRun> {
  const started = Date.now();
  const source: LiveSourceName = "CourtListener";
  const sourceUrl = "https://www.courtlistener.com/";
  const limitation = "Court records are supporting legal-reference signals only. A search result does not establish liability, negligence, wrongdoing, injury rates, or relevance to a specific worksite.";
  const token = getEnv("COURTLISTENER_API_TOKEN");
  if (!token) {
    return disabledRun(source, false, sourceUrl, "Live at manual run time", limitation, "CourtListener is not configured.");
  }

  const query = `"${companyName}" AND ("workplace injury" OR OSHA OR "workers compensation" OR "occupational disease")`;
  const params = new URLSearchParams({
    q: query,
    type: "r",
    order_by: "dateFiled desc",
  });

  const fetched = await fetchJson(
    `https://www.courtlistener.com/api/rest/v4/search/?${params.toString()}`,
    { headers: { Authorization: `Token ${token}`, Accept: "application/json" } },
  );
  const latencyMs = Date.now() - started;
  if (!fetched.ok) {
    return {
      signals: [],
      warnings: [`CourtListener request failed: ${fetched.error ?? "Unknown source error"}`],
      status: {
        source,
        configured: true,
        enabled: true,
        state: "error",
        latencyMs,
        resultCount: 0,
        sourceUrl,
        freshness: "Live at manual run time",
        limitation,
        error: fetched.error,
      },
    };
  }

  const payload = asRecord(fetched.data);
  const results = asArray(payload?.results);
  const signals = results.slice(0, 12).flatMap((item, index): LiveSignal[] => {
    const record = asRecord(item);
    if (!record) return [];

    const title = firstString(record.caseName, record.case_name, record.caption, record.docketNumber, "Court record");
    const snippet = stripHtml(firstString(record.snippet, record.text, record.description));
    const date = safeDate(firstString(record.dateFiled, record.date_filed, record.dateArgued));
    const absoluteUrl = firstString(record.absolute_url, record.resource_uri);
    const courtName = firstString(record.court, record.court_name, record.court_citation_string);
    const docket = firstString(record.docketNumber, record.docket_number);
    const clusterId = firstString(record.cluster_id, record.id);

    const identifiers: Record<string, string> = {};
    if (docket) identifiers.docket = docket;
    if (clusterId) identifiers.record = clusterId;

    const resultUrl = absoluteUrl
      ? absoluteUrl.startsWith("http") ? absoluteUrl : `https://www.courtlistener.com${absoluteUrl}`
      : sourceUrl;

    return [{
      id: `court-${slug(clusterId || docket || title)}-${index}`,
      source,
      category: "litigation",
      title,
      summary: truncate(snippet || "CourtListener returned a legal reference matching the company and occupational-search terms."),
      occurredAt: date,
      geography: courtName || undefined,
      identifiers,
      metrics: courtName ? { court: courtName } : {},
      evidenceFields: [
        "Case caption or docket",
        "Company-name search term",
        "Occupational legal search terms",
        ...(date ? ["Filed/decision date"] : []),
        ...(courtName ? ["Court"] : []),
      ],
      confidence: nameConfidence(companyName, `${title} ${snippet}`, 0.72, 0.48),
      sourceUrl: resultUrl,
    }];
  });

  return {
    signals,
    warnings: signals.length > 0 ? ["CourtListener results require human relevance review before use."] : [],
    status: {
      source,
      configured: true,
      enabled: true,
      state: signals.length > 0 ? "success" : "empty",
      latencyMs,
      resultCount: signals.length,
      sourceUrl,
      freshness: "Live at manual run time",
      limitation,
    },
  };
}

async function runUsaSpending(
  companyName: string,
  state?: string,
  fromDate?: string,
  toDate?: string,
): Promise<SourceRun> {
  const started = Date.now();
  const source: LiveSourceName = "USAspending";
  const sourceUrl = "https://www.usaspending.gov/";
  const limitation = "Federal awards provide contractor footprint and geography context. They are not injury data, a solicitation feed, a procurement workflow, or evidence of occupational risk.";
  const enabled = isTruthy(getEnv("USASPENDING_API_ENABLED"));
  if (!enabled) {
    return disabledRun(source, true, sourceUrl, "Live at manual run time", limitation, "USAspending is disabled by USASPENDING_API_ENABLED.");
  }

  const start = fromDate || (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date.toISOString().slice(0, 10);
  })();
  const end = toDate || new Date().toISOString().slice(0, 10);

  const filters: Record<string, unknown> = {
    recipient_search_text: [companyName],
    time_period: [{ start_date: start, end_date: end }],
    award_type_codes: ["A", "B", "C", "D", "IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
  };
  if (state) {
    filters.place_of_performance_locations = [{ country: "USA", state }];
  }

  const fetched = await fetchJson("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      filters,
      fields: [
        "Award ID",
        "Recipient Name",
        "Award Amount",
        "Description",
        "Start Date",
        "End Date",
        "Awarding Agency",
        "Awarding Sub Agency",
        "Place of Performance City",
        "Place of Performance State",
        "NAICS Code",
        "NAICS Description",
      ],
      page: 1,
      limit: 12,
      sort: "Award Amount",
      order: "desc",
      subawards: false,
    }),
  });
  const latencyMs = Date.now() - started;
  if (!fetched.ok) {
    return {
      signals: [],
      warnings: [`USAspending request failed: ${fetched.error ?? "Unknown source error"}`],
      status: {
        source,
        configured: true,
        enabled: true,
        state: "error",
        latencyMs,
        resultCount: 0,
        sourceUrl,
        freshness: `Live manual query for ${start} through ${end}`,
        limitation,
        error: fetched.error,
      },
    };
  }

  const payload = asRecord(fetched.data);
  const results = asArray(payload?.results);
  const signals = results.slice(0, 12).flatMap((item, index): LiveSignal[] => {
    const record = asRecord(item);
    if (!record) return [];

    const recipient = firstString(record["Recipient Name"], record.recipient_name, companyName);
    const awardId = firstString(record["Award ID"], record.award_id, record.generated_internal_id);
    const amount = numberValue(record["Award Amount"] ?? record.award_amount);
    const agency = firstString(record["Awarding Agency"], record.awarding_agency);
    const subAgency = firstString(record["Awarding Sub Agency"], record.awarding_sub_agency);
    const description = firstString(record.Description, record.description);
    const startDate = safeDate(firstString(record["Start Date"], record.start_date));
    const endDate = safeDate(firstString(record["End Date"], record.end_date));
    const city = firstString(record["Place of Performance City"], record.place_of_performance_city);
    const awardState = firstString(record["Place of Performance State"], record.place_of_performance_state);
    const naics = firstString(record["NAICS Code"], record.naics_code);
    const naicsDescription = firstString(record["NAICS Description"], record.naics_description);
    const geography = [city, awardState].filter(Boolean).join(", ") || undefined;

    const identifiers: Record<string, string> = {};
    if (awardId) identifiers.awardId = awardId;
    if (naics) identifiers.naics = naics;

    const metrics: Record<string, string | number> = {};
    if (amount !== undefined) metrics.awardAmount = amount;
    if (agency) metrics.awardingAgency = agency;
    if (subAgency) metrics.awardingSubAgency = subAgency;
    if (naicsDescription) metrics.naicsDescription = naicsDescription;
    if (endDate) metrics.endDate = endDate;

    return [{
      id: `usaspending-${slug(awardId || `${recipient}-${index}`)}`,
      source,
      category: "federal-award",
      title: `${recipient}${awardId ? ` · ${awardId}` : ""}`,
      summary: truncate(description || "USAspending returned a federal award associated with the searched recipient name."),
      occurredAt: startDate,
      geography,
      identifiers,
      metrics,
      evidenceFields: [
        "Recipient name",
        ...(awardId ? ["Award ID"] : []),
        ...(amount !== undefined ? ["Award amount"] : []),
        ...(agency ? ["Awarding agency"] : []),
        ...(geography ? ["Place of performance"] : []),
        ...(naics ? ["NAICS"] : []),
      ],
      confidence: nameConfidence(companyName, recipient, 0.9, 0.64),
      sourceUrl,
    }];
  });

  return {
    signals,
    warnings: signals.length > 0 ? ["USAspending signals describe federal award footprint only and are not occupational-risk evidence."] : [],
    status: {
      source,
      configured: true,
      enabled: true,
      state: signals.length > 0 ? "success" : "empty",
      latencyMs,
      resultCount: signals.length,
      sourceUrl,
      freshness: `Live manual query for ${start} through ${end}`,
      limitation,
    },
  };
}

router.post("/company/live-intelligence", async (req: Request, res: Response) => {
  const companyName = typeof req.body?.companyName === "string" ? req.body.companyName.trim() : "";
  const state = typeof req.body?.state === "string" ? req.body.state.trim().toUpperCase() : undefined;
  const fromDate = typeof req.body?.fromDate === "string" ? req.body.fromDate.trim() : undefined;
  const toDate = typeof req.body?.toDate === "string" ? req.body.toDate.trim() : undefined;

  if (!companyName) {
    return res.status(400).json({ ok: false, error: "companyName is required" });
  }
  if (companyName.length > 180) {
    return res.status(400).json({ ok: false, error: "companyName is too long" });
  }
  if (state && !/^[A-Z]{2}$/.test(state)) {
    return res.status(400).json({ ok: false, error: "state must be a two-letter code" });
  }
  if (fromDate && Number.isNaN(new Date(fromDate).getTime())) {
    return res.status(400).json({ ok: false, error: "fromDate must be a valid date" });
  }
  if (toDate && Number.isNaN(new Date(toDate).getTime())) {
    return res.status(400).json({ ok: false, error: "toDate must be a valid date" });
  }

  const executedAt = new Date().toISOString();
  try {
    const runs = await Promise.all([
      runSam(companyName, state),
      runSec(companyName),
      runCourtListener(companyName),
      runUsaSpending(companyName, state, fromDate, toDate),
    ]);

    const sources = runs.map((run) => run.status);
    const signals = runs
      .flatMap((run) => run.signals)
      .sort((a, b) => {
        const aDate = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
        const bDate = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
        return bDate - aDate || b.confidence - a.confidence;
      });
    const warnings = [...new Set(runs.flatMap((run) => run.warnings).filter(Boolean))];

    const successfulSources = sources.filter((sourceStatus) => sourceStatus.state === "success").length;
    const attemptedSources = sources.filter((sourceStatus) => sourceStatus.enabled).length;
    const failedSources = sources.filter((sourceStatus) => sourceStatus.state === "error").length;

    return res.json({
      ok: true,
      manualRun: true,
      companyName,
      state,
      executedAt,
      runId: `company-live-${Date.now()}`,
      summary: {
        signalCount: signals.length,
        successfulSources,
        attemptedSources,
        failedSources,
        disabledSources: sources.filter((sourceStatus) => sourceStatus.state === "disabled").length,
      },
      sources,
      signals,
      warnings,
      limitation: "Company Live Intelligence is a manual research workspace. Results may be incomplete, delayed, ambiguous, or unrelated to the searched employer and require human review. It does not determine occupational risk, legal liability, safety compliance, negligence, or whether an employer is unsafe.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: sanitizeError(error),
    });
  }
});

export default router;
