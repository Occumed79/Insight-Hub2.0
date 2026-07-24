import { Router, type Response } from "express";
import { db, entitiesTable, locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const REQUEST_TIMEOUT_MS = 35_000;
const MAX_CANDIDATES = 80;

type DiagnosticStatus = "success" | "partial" | "no-results" | "not-configured" | "error";

type SourceDiagnostic = {
  source: string;
  status: DiagnosticStatus;
  resultsFound: number;
  message: string;
  error?: string;
};

type LocationRecord = {
  id: number | string;
  placeName?: string | null;
  formattedAddress?: string | null;
  facilityType?: string | null;
  sourceClass?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  evidenceSnippet?: string | null;
  reviewStatus?: string | null;
  [key: string]: unknown;
};

type LocationPayload = {
  ok: true;
  entityId: number;
  entityName?: string;
  sourceDiagnostics?: SourceDiagnostic[];
  locations: LocationRecord[];
  warnings?: string[];
  warning?: string;
  counts?: Record<string, number>;
  coverage?: Record<string, number>;
  [key: string]: unknown;
};

type LocationDecision = {
  id: string;
  keep: boolean;
  correctedPlaceName: string | null;
  correctedFacilityType: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

function isLocationPayload(value: unknown): value is LocationPayload {
  const candidate = value as Partial<LocationPayload> | null;
  return Boolean(candidate && candidate.ok === true && Number.isInteger(candidate.entityId) && Array.isArray(candidate.locations));
}

function cleanText(value: unknown, max = 1_000): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      decisions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            keep: { type: "boolean" },
            correctedPlaceName: { anyOf: [{ type: "string" }, { type: "null" }] },
            correctedFacilityType: { anyOf: [{ type: "string" }, { type: "null" }] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            reason: { type: "string" },
          },
          required: ["id", "keep", "correctedPlaceName", "correctedFacilityType", "confidence", "reason"],
        },
      },
    },
    required: ["decisions"],
  } as const;
}

function replaceDiagnostic(payload: LocationPayload, diagnostic: SourceDiagnostic): LocationPayload {
  const diagnostics = Array.isArray(payload.sourceDiagnostics) ? payload.sourceDiagnostics : [];
  return {
    ...payload,
    sourceDiagnostics: [...diagnostics.filter((item) => item?.source !== "cerebras"), diagnostic],
  };
}

function providerError(status: number, body: string): string {
  let detail = cleanText(body, 700);
  try {
    const parsed = JSON.parse(body) as any;
    detail = cleanText(parsed?.error?.message || parsed?.message || parsed?.error || body, 700);
  } catch {
    // Preserve the bounded plain-text body.
  }
  if (status === 400) return `Cerebras rejected the location-validation request (HTTP 400): ${detail || "invalid Version 2 request or schema"}`;
  if (status === 401 || status === 403) return `Cerebras authentication failed (HTTP ${status}). Check the active API key and project access.`;
  if (status === 429) return "Cerebras rate-limited the location-validation request (HTTP 429).";
  if (status >= 500) return `Cerebras was unavailable during location validation (HTTP ${status}).`;
  return `Cerebras location validation failed with HTTP ${status}${detail ? `: ${detail}` : "."}`;
}

function candidateInput(location: LocationRecord) {
  return {
    id: String(location.id),
    placeName: cleanText(location.placeName, 180),
    formattedAddress: cleanText(location.formattedAddress, 500),
    facilityType: cleanText(location.facilityType, 180),
    sourceUrl: cleanText(location.sourceUrl, 1_000),
    sourceTitle: cleanText(location.sourceTitle, 260),
    evidenceSnippet: cleanText(location.evidenceSnippet, 900),
  };
}

async function persistResult(payload: LocationPayload, people: LocationRecord[], rejectedIds: number[], diagnostic: SourceDiagnostic): Promise<void> {
  for (const location of people) {
    const id = Number(location.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    await db.update(locationsTable).set({
      placeName: cleanText(location.placeName, 180) || undefined,
      facilityType: cleanText(location.facilityType, 180) || undefined,
      reviewStatus: location.reviewStatus === "needs-review" ? "needs-review" : undefined,
      updatedAt: new Date(),
    }).where(eq(locationsTable.id, id));
  }

  for (const id of rejectedIds) {
    await db.update(locationsTable).set({
      reviewStatus: "rejected",
      updatedAt: new Date(),
    }).where(eq(locationsTable.id, id));
  }

  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, payload.entityId)).limit(1);
  if (!entity) return;
  const metadata = entity.metadata && typeof entity.metadata === "object" && !Array.isArray(entity.metadata)
    ? entity.metadata as Record<string, unknown>
    : {};
  const sourceDiagnostics = Array.isArray(metadata.sourceDiagnostics)
    ? metadata.sourceDiagnostics as SourceDiagnostic[]
    : [];
  await db.update(entitiesTable).set({
    metadata: {
      ...metadata,
      sourceDiagnostics: [...sourceDiagnostics.filter((item) => item?.source !== "cerebras"), diagnostic],
      cerebrasVersion: 2,
      cerebrasValidatedAt: new Date().toISOString(),
    },
    updatedAt: new Date(),
  }).where(eq(entitiesTable.id, payload.entityId));
}

async function validateLocations(payload: LocationPayload): Promise<LocationPayload> {
  const existing = payload.sourceDiagnostics?.find((item) => item.source === "cerebras");
  if (existing?.status === "success" && existing.resultsFound > 0) return payload;

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    return replaceDiagnostic(payload, {
      source: "cerebras",
      status: "not-configured",
      resultsFound: 0,
      message: "CEREBRAS_API_KEY is not configured.",
    });
  }

  const candidates = payload.locations
    .filter((location) => location.sourceClass === "official-site-ai")
    .slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    return replaceDiagnostic(payload, {
      source: "cerebras",
      status: "no-results",
      resultsFound: 0,
      message: "No AI-extracted official-site locations were available for Cerebras Version 2 validation.",
    });
  }

  const baseUrl = (process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1").replace(/\/$/, "");
  const model = process.env.CEREBRAS_MODEL || "gpt-oss-120b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Cerebras-Version-Patch": "2",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Validate physical company-location records. Keep only locations whose supplied official-site evidence supports that the named company operates at the address. Reject customer addresses, partner addresses, job-only cities, unrelated map results, mailing addresses with no operating-site evidence, fabricated addresses, and evidence that does not support the company-location relationship. Never invent an address, source, place name, or facility type.",
          },
          {
            role: "user",
            content: JSON.stringify({
              companyName: cleanText(payload.entityName, 200),
              candidates: candidates.map(candidateInput),
            }),
          },
        ],
        reasoning_effort: "low",
        temperature: 0,
        max_completion_tokens: 8_000,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "company_location_validation",
            strict: true,
            schema: schema(),
          },
        },
      }),
    });

    const rawBody = await response.text();
    if (!response.ok) {
      const message = providerError(response.status, rawBody);
      console.error("Cerebras Version 2 location validation failed", { status: response.status, model, message });
      return replaceDiagnostic({
        ...payload,
        warnings: Array.from(new Set([...(payload.warnings || []), message])),
        warning: Array.from(new Set([...(payload.warnings || []), message])).join(" "),
      }, {
        source: "cerebras",
        status: "error",
        resultsFound: 0,
        message,
        error: message,
      });
    }

    const parsed = JSON.parse(rawBody) as any;
    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Cerebras returned no structured message content.");
    const structured = JSON.parse(content) as { decisions?: LocationDecision[] };
    const decisions = Array.isArray(structured.decisions) ? structured.decisions : [];
    const byId = new Map(decisions.map((decision) => [String(decision.id), decision]));
    const candidateIds = new Set(candidates.map((candidate) => String(candidate.id)));
    const rejectedIds: number[] = [];
    const retained = payload.locations.flatMap((location) => {
      if (!candidateIds.has(String(location.id))) return [location];
      const decision = byId.get(String(location.id));
      if (!decision?.keep) {
        const numericId = Number(location.id);
        if (Number.isInteger(numericId) && numericId > 0) rejectedIds.push(numericId);
        return [];
      }
      return [{
        ...location,
        placeName: cleanText(decision.correctedPlaceName, 180) || location.placeName,
        facilityType: cleanText(decision.correctedFacilityType, 180) || location.facilityType,
        reviewStatus: decision.confidence === "low" ? "needs-review" : location.reviewStatus,
      }];
    });

    const validatedCount = candidates.length - rejectedIds.length;
    const diagnostic: SourceDiagnostic = {
      source: "cerebras",
      status: validatedCount > 0 ? "success" : "no-results",
      resultsFound: validatedCount,
      message: validatedCount > 0
        ? `Cerebras Version 2 validated ${validatedCount} of ${candidates.length} AI-extracted official-site locations.`
        : `Cerebras Version 2 rejected all ${candidates.length} AI-extracted location records as unsupported.`,
    };

    const warnings = validatedCount === 0
      ? Array.from(new Set([...(payload.warnings || []), diagnostic.message]))
      : payload.warnings || [];
    const updated: LocationPayload = replaceDiagnostic({
      ...payload,
      locations: retained,
      warnings,
      warning: warnings.join(" "),
      counts: payload.counts ? {
        ...payload.counts,
        candidates: retained.length,
        needsReview: retained.filter((location) => location.reviewStatus === "needs-review").length,
      } : payload.counts,
      coverage: payload.coverage ? {
        ...payload.coverage,
        aiAddressesExtracted: validatedCount,
      } : payload.coverage,
    }, diagnostic);

    await persistResult(updated, retained.filter((location) => candidateIds.has(String(location.id))), rejectedIds, diagnostic);
    return updated;
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? `Cerebras location validation timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1_000)} seconds.`
      : `Cerebras location validation could not be parsed: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error("Cerebras Version 2 location validation failed", { model, message });
    const warnings = Array.from(new Set([...(payload.warnings || []), message]));
    return replaceDiagnostic({ ...payload, warnings, warning: warnings.join(" ") }, {
      source: "cerebras",
      status: "error",
      resultsFound: 0,
      message,
      error: message,
    });
  } finally {
    clearTimeout(timeout);
  }
}

router.use((req, res, next) => {
  if (req.method !== "POST" || req.path !== "/locations/discover") {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  let responseScheduled = false;
  res.json = ((payload: unknown) => {
    if (responseScheduled || !isLocationPayload(payload)) return originalJson(payload);
    responseScheduled = true;
    void validateLocations(payload)
      .then((validated) => originalJson(validated))
      .catch((error) => {
        console.error("Cerebras Version 2 location middleware failed unexpectedly:", error);
        originalJson(payload);
      });
    return res;
  }) as Response["json"];

  next();
});

export default router;
