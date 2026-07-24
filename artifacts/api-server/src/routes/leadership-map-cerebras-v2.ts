import { Router, type Response } from "express";

const router = Router();
const MAX_CANDIDATES = 80;
const REQUEST_TIMEOUT_MS = 35_000;

type ProviderStatus = "success" | "partial" | "no-results" | "not-configured" | "error";

type ProviderDiagnostic = {
  source: "groq" | "cloudflare" | "gemini" | "cerebras";
  status: ProviderStatus;
  resultsFound: number;
  message: string;
  error?: string;
};

type Evidence = {
  url?: string;
  label?: string;
  sourceType?: string;
  snippet?: string;
};

type Person = {
  id: string;
  name: string;
  title: string;
  confidence?: string;
  evidence?: Evidence[];
  [key: string]: unknown;
};

type LeadershipPayload = {
  companyName?: string;
  people: Person[];
  providerDiagnostics?: ProviderDiagnostic[];
  warnings?: string[];
  [key: string]: unknown;
};

type CerebrasDecision = {
  id: string;
  keep: boolean;
  correctedName: string | null;
  correctedTitle: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

function isLeadershipPayload(value: unknown): value is LeadershipPayload {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as Partial<LeadershipPayload>).people));
}

function cleanText(value: unknown, max = 1_000): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cerebrasSchema() {
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
            correctedName: { anyOf: [{ type: "string" }, { type: "null" }] },
            correctedTitle: { anyOf: [{ type: "string" }, { type: "null" }] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            reason: { type: "string" },
          },
          required: ["id", "keep", "correctedName", "correctedTitle", "confidence", "reason"],
        },
      },
    },
    required: ["decisions"],
  } as const;
}

function candidateInput(person: Person) {
  return {
    id: cleanText(person.id, 160),
    name: cleanText(person.name, 160),
    title: cleanText(person.title, 260),
    evidence: (Array.isArray(person.evidence) ? person.evidence : [])
      .slice(0, 4)
      .map((item) => ({
        url: cleanText(item?.url, 1_000),
        sourceType: cleanText(item?.sourceType, 60),
        snippet: cleanText(item?.snippet, 900),
      })),
  };
}

function replaceCerebrasDiagnostic(payload: LeadershipPayload, diagnostic: ProviderDiagnostic): LeadershipPayload {
  const diagnostics = Array.isArray(payload.providerDiagnostics) ? payload.providerDiagnostics : [];
  const withoutCerebras = diagnostics.filter((item) => item?.source !== "cerebras");
  return { ...payload, providerDiagnostics: [...withoutCerebras, diagnostic] };
}

function errorSummary(status: number, body: string): string {
  let detail = cleanText(body, 700);
  try {
    const parsed = JSON.parse(body) as any;
    detail = cleanText(parsed?.error?.message || parsed?.message || parsed?.error || body, 700);
  } catch {
    // Keep the bounded plain-text body.
  }

  if (status === 400) return `Cerebras rejected the validation request (HTTP 400): ${detail || "invalid request or schema"}`;
  if (status === 401 || status === 403) return `Cerebras authentication failed (HTTP ${status}). Check the active API key and project access.`;
  if (status === 429) return "Cerebras rate-limited the validation request (HTTP 429).";
  if (status >= 500) return `Cerebras was unavailable (HTTP ${status}).`;
  return `Cerebras validation failed with HTTP ${status}${detail ? `: ${detail}` : "."}`;
}

async function validateWithCerebras(payload: LeadershipPayload): Promise<LeadershipPayload> {
  const existingDiagnostic = payload.providerDiagnostics?.find((item) => item.source === "cerebras");
  if (existingDiagnostic?.status === "success" && existingDiagnostic.resultsFound > 0) return payload;

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    return replaceCerebrasDiagnostic(payload, {
      source: "cerebras",
      status: "not-configured",
      resultsFound: 0,
      message: "CEREBRAS_API_KEY is not configured.",
    });
  }

  const candidates = payload.people.slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    return replaceCerebrasDiagnostic(payload, {
      source: "cerebras",
      status: "no-results",
      resultsFound: 0,
      message: "No candidate people were available for Cerebras validation.",
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
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are the final evidence validator for an organizational chart. Keep only real, currently serving named people whose supplied evidence supports both the person and the leadership role. Reject organizations, schools, committees, document headings, policy language, proxy language, sentence fragments, former roles presented only as history, and records where the evidence does not support the claimed current title. Never invent a person, title, URL, or relationship.",
          },
          {
            role: "user",
            content: JSON.stringify({
              companyName: cleanText(payload.companyName, 200),
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
            name: "organizational_chart_validation",
            strict: true,
            schema: cerebrasSchema(),
          },
        },
      }),
    });

    const rawBody = await response.text();
    if (!response.ok) {
      const summary = errorSummary(response.status, rawBody);
      console.error("Cerebras organizational-chart validation failed", {
        status: response.status,
        model,
        summary,
      });
      return replaceCerebrasDiagnostic({
        ...payload,
        warnings: Array.from(new Set([...(payload.warnings || []), summary])),
      }, {
        source: "cerebras",
        status: "error",
        resultsFound: 0,
        message: summary,
        error: summary,
      });
    }

    const parsed = JSON.parse(rawBody) as any;
    const content = parsed?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Cerebras returned no structured message content.");
    }

    const structured = JSON.parse(content) as { decisions?: CerebrasDecision[] };
    const decisions = Array.isArray(structured.decisions) ? structured.decisions : [];
    const decisionById = new Map(decisions.map((decision) => [String(decision.id), decision]));
    const people = candidates.flatMap((person) => {
      const decision = decisionById.get(String(person.id));
      if (!decision?.keep) return [];
      const correctedName = cleanText(decision.correctedName, 160);
      const correctedTitle = cleanText(decision.correctedTitle, 260);
      return [{
        ...person,
        name: correctedName || person.name,
        title: correctedTitle || person.title,
        confidence: decision.confidence === "high" ? "confirmed" : "probable",
      }];
    });

    const diagnostic: ProviderDiagnostic = {
      source: "cerebras",
      status: people.length > 0 ? "success" : "no-results",
      resultsFound: people.length,
      message: people.length > 0
        ? `Cerebras Version 2 validated ${people.length} of ${candidates.length} candidate people.`
        : `Cerebras Version 2 rejected all ${candidates.length} candidate records as unsupported.`,
    };

    return replaceCerebrasDiagnostic({
      ...payload,
      people,
      warnings: people.length === 0
        ? Array.from(new Set([...(payload.warnings || []), diagnostic.message]))
        : payload.warnings,
    }, diagnostic);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? `Cerebras validation timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1_000)} seconds.`
      : `Cerebras validation could not be parsed: ${error instanceof Error ? error.message : "Unknown error"}`;
    console.error("Cerebras organizational-chart validation failed", { model, message });
    return replaceCerebrasDiagnostic({
      ...payload,
      warnings: Array.from(new Set([...(payload.warnings || []), message])),
    }, {
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
  if (req.method !== "POST" || req.path !== "/leadership-map/analyze") {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  let responseScheduled = false;
  res.json = ((payload: unknown) => {
    if (responseScheduled || !isLeadershipPayload(payload)) return originalJson(payload);
    responseScheduled = true;
    void validateWithCerebras(payload)
      .then((validated) => originalJson(validated))
      .catch((error) => {
        console.error("Cerebras Version 2 middleware failed unexpectedly:", error);
        originalJson(payload);
      });
    return res;
  }) as Response["json"];

  next();
});

export default router;
