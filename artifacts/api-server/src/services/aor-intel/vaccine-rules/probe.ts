import { createHash } from "node:crypto";
import type { UrlProbe } from "../types";

const MAX_BYTES = 2_000_000;

/** Hash that ignores script/style blocks, comments and whitespace so cosmetic page churn does not look like a rule change. */
export function contentFingerprint(body: Uint8Array, contentType: string | null): string {
  if (contentType && /html|xml|text/i.test(contentType)) {
    const text = Buffer.from(body).toString("utf8")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return createHash("sha1").update(text).digest("hex");
  }
  return createHash("sha1").update(body).digest("hex");
}

/**
 * Fetches an official rule page for reachability and change detection. URLs come only from the
 * reviewed rule set and the source registry, never from request input.
 */
export async function probeOfficialUrl(url: string, timeoutMs = 12_000): Promise<UrlProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "text/html,application/pdf;q=0.9,*/*;q=0.5", "User-Agent": "Occu-Med-Insight-Hub/2.0 AOR Factors rule-source monitor" },
    });
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body?.getReader();
    while (reader && size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    await reader?.cancel().catch(() => undefined);
    const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const contentType = response.headers.get("content-type");
    return {
      httpStatus: response.status,
      finalUrl: response.url || url,
      lastModified: response.headers.get("last-modified"),
      etag: response.headers.get("etag"),
      contentType,
      contentHash: body.byteLength ? contentFingerprint(body, contentType) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}
