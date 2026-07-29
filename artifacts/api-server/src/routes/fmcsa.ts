import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const BASE_URL = "https://mobile.fmcsa.dot.gov/qc/services";
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_RESPONSE_BYTES = 2_500_000;

type CarrierRecord = {
  dotNumber: string | null;
  mcNumber: string | null;
  legalName: string | null;
  dbaName: string | null;
  allowedToOperate: string | null;
  outOfService: string | null;
  outOfServiceDate: string | null;
  complaintCount: number | null;
  physicalAddress: {
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  };
  telephone: string | null;
  vehicles: {
    passenger: number | null;
    bus: number | null;
    limo: number | null;
    minibus: number | null;
    motorcoach: number | null;
    van: number | null;
  };
};

type CacheEntry = {
  records: CarrierRecord[];
  expiresAt: number;
  staleUntil: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CarrierRecord[]>>();

function getWebKey(): string | null {
  const key = process.env.FMCSA_WEB_KEY?.trim() || process.env.FMCSA_WEBKEY?.trim();
  return key || null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timed out/i.test(message)) return "The FMCSA request timed out. Please retry.";
  return message
    .replace(/webKey=[^&\s]+/gi, "webKey=[REDACTED]")
    .replace(/https?:\/\/[^\s]+/g, "[URL redacted]")
    .slice(0, 320);
}

async function readLimitedJson(response: globalThis.Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error("FMCSA response exceeded the safety limit.");
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("FMCSA response exceeded the safety limit.");
  }

  const raw = new TextDecoder().decode(buffer);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("FMCSA returned an invalid JSON response.");
  }
}

function unwrapRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];

  const root = payload as Record<string, unknown>;
  const candidates = [root.content, root.carriers, root.results, root.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    }
    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      for (const value of [nested.carrier, nested.carriers, nested.content, nested.results]) {
        if (Array.isArray(value)) {
          return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
        }
        if (value && typeof value === "object") return [value as Record<string, unknown>];
      }
      return [nested];
    }
  }

  if (root.carrier && typeof root.carrier === "object") return [root.carrier as Record<string, unknown>];
  return [root];
}

function normalizeCarrier(entry: Record<string, unknown>): CarrierRecord {
  const carrier = entry.carrier && typeof entry.carrier === "object"
    ? entry.carrier as Record<string, unknown>
    : entry;

  return {
    dotNumber: text(carrier.dotNumber ?? carrier.dot_number ?? carrier.usdotNumber),
    mcNumber: text(carrier.mcNumber ?? carrier.mc_number ?? carrier.docketNumber),
    legalName: text(carrier.legalName ?? carrier.legal_name ?? carrier.name),
    dbaName: text(carrier.dbaName ?? carrier.dba_name),
    allowedToOperate: text(carrier.allowToOperate ?? carrier.allowedToOperate),
    outOfService: text(carrier.outOfService),
    outOfServiceDate: text(carrier.outOfServiceDate),
    complaintCount: numeric(carrier.complaintCount),
    physicalAddress: {
      street: text(carrier.phyStreet ?? carrier.physicalStreet),
      city: text(carrier.phyCity ?? carrier.physicalCity),
      state: text(carrier.phyState ?? carrier.physicalState)?.toUpperCase() ?? null,
      zip: text(carrier.phyZip ?? carrier.physicalZip),
      country: text(carrier.phyCountry ?? carrier.physicalCountry),
    },
    telephone: text(carrier.telephone ?? carrier.phone),
    vehicles: {
      passenger: numeric(carrier.passengerVehicle),
      bus: numeric(carrier.busVehicle),
      limo: numeric(carrier.limoVehicle),
      minibus: numeric(carrier.miniBusVehicle),
      motorcoach: numeric(carrier.motorCoachVehicle),
      van: numeric(carrier.vanVehicle),
    },
  };
}

async function fetchFromFmcsa(path: string, params: URLSearchParams): Promise<CarrierRecord[]> {
  const webKey = getWebKey();
  if (!webKey) throw new Error("FMCSA_WEB_KEY is not configured on the server.");

  params.set("webKey", webKey);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18_000);
    try {
      const response = await fetch(`${BASE_URL}${path}?${params.toString()}`, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          Accept: "application/json",
          "User-Agent": "Occu-Med Insight Hub/2.0 FMCSA carrier research",
        },
      });

      if (TRANSIENT_STATUSES.has(response.status) && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) ? Math.min(5_000, retryAfter * 1_000) : 450 * (2 ** attempt));
        continue;
      }

      const payload = await readLimitedJson(response);
      if (!response.ok) {
        const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
        const detail = text(root.message ?? root.error ?? root.errorMessage);
        throw new Error(detail || `FMCSA returned HTTP ${response.status}.`);
      }

      return unwrapRecords(payload)
        .map(normalizeCarrier)
        .filter((record) => record.dotNumber || record.legalName || record.dbaName);
    } catch (error) {
      lastError = error;
      if (attempt >= 2) throw error;
      await sleep(450 * (2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("FMCSA request failed.");
}

async function loadCached(cacheKey: string, loader: () => Promise<CarrierRecord[]>): Promise<{ records: CarrierRecord[]; cacheState: "fresh" | "refreshed" | "stale" }> {
  const now = Date.now();
  const existing = cache.get(cacheKey);
  if (existing && existing.expiresAt > now) return { records: existing.records, cacheState: "fresh" };

  let promise = inFlight.get(cacheKey);
  if (!promise) {
    promise = loader();
    inFlight.set(cacheKey, promise);
  }

  try {
    const records = await promise;
    cache.set(cacheKey, {
      records,
      expiresAt: Date.now() + 15 * 60_000,
      staleUntil: Date.now() + 12 * 60 * 60_000,
    });
    return { records, cacheState: "refreshed" };
  } catch (error) {
    if (existing && existing.staleUntil > now) return { records: existing.records, cacheState: "stale" };
    throw error;
  } finally {
    inFlight.delete(cacheKey);
    if (cache.size > 200) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (oldestKey) cache.delete(oldestKey);
    }
  }
}

router.get("/core-intelligence/fmcsa/status", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json({
    ok: true,
    configured: Boolean(getWebKey()),
    environmentVariable: "FMCSA_WEB_KEY",
    source: "FMCSA QCMobile API",
    capabilities: ["carrier-name search", "USDOT-number lookup", "state filtering of returned carrier records"],
    limitation: "The QCMobile API searches carriers by legal/DBA name, USDOT number, or docket number. It does not provide a complete all-carriers-by-state endpoint.",
  });
});

router.get("/core-intelligence/fmcsa/carriers", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  if (!getWebKey()) {
    return res.status(503).json({
      ok: false,
      configured: false,
      error: "FMCSA_WEB_KEY is not configured on the server.",
    });
  }

  const name = text(req.query.name);
  const dotNumber = text(req.query.dotNumber)?.replace(/\D/g, "") || null;
  const stateCode = text(req.query.stateCode)?.toUpperCase() || null;

  if (!name && !dotNumber) {
    return res.status(400).json({ ok: false, configured: true, error: "Provide either name or dotNumber." });
  }
  if (name && name.length < 2) {
    return res.status(400).json({ ok: false, configured: true, error: "Carrier name must contain at least two characters." });
  }
  if (name && name.length > 120) {
    return res.status(400).json({ ok: false, configured: true, error: "Carrier name must be 120 characters or fewer." });
  }
  if (dotNumber && !/^\d{1,10}$/.test(dotNumber)) {
    return res.status(400).json({ ok: false, configured: true, error: "USDOT number must contain 1 to 10 digits." });
  }
  if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) {
    return res.status(400).json({ ok: false, configured: true, error: "stateCode must be a two-letter abbreviation." });
  }

  try {
    const cacheKey = dotNumber
      ? `dot:${dotNumber}`
      : `name:${name!.toLowerCase()}:state:${stateCode || "all"}`;
    const loaded = await loadCached(cacheKey, () => {
      if (dotNumber) return fetchFromFmcsa(`/carriers/${encodeURIComponent(dotNumber)}`, new URLSearchParams());
      return fetchFromFmcsa(`/carriers/name/${encodeURIComponent(name!)}`, new URLSearchParams({ start: "0", size: "50" }));
    });

    const records = stateCode
      ? loaded.records.filter((record) => record.physicalAddress.state === stateCode)
      : loaded.records;

    return res.json({
      ok: true,
      configured: true,
      query: { name, dotNumber, stateCode },
      records,
      returned: records.length,
      unfilteredReturned: loaded.records.length,
      cacheState: loaded.cacheState,
      source: "FMCSA QCMobile API",
      sourceUrl: "https://mobile.fmcsa.dot.gov/QCDevsite/docs/qcApi",
      limitation: "FMCSA name searches return up to 50 carrier matches. State filtering is applied to the returned records and is not a complete census of carriers in the selected state.",
    });
  } catch (error) {
    return res.status(502).json({ ok: false, configured: true, error: sanitizeError(error) });
  }
});

export default router;
