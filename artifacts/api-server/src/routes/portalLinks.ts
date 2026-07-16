import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const portalKeys = ["entity", "discovery", "federal"] as const;
type PortalKey = (typeof portalKeys)[number];

type PortalLinks = Record<PortalKey, string>;

const fallbackLinks: PortalLinks = {
  entity: process.env["VITE_ENTITY_INTELLIGENCE_URL"] ?? "",
  discovery: process.env["VITE_ENTITY_DISCOVERY_URL"] ?? "",
  federal: process.env["VITE_FEDERAL_AGENCIES_URL"] ?? "",
};

function isPortalKey(value: string): value is PortalKey {
  return portalKeys.includes(value as PortalKey);
}

function normalizePortalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return "";

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function ensurePortalLinksTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_links (
      portal_key text PRIMARY KEY,
      url text NOT NULL DEFAULT '',
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

async function readPortalLinks(): Promise<PortalLinks> {
  await ensurePortalLinksTable();

  const result = await pool.query<{ portal_key: string; url: string }>(
    "SELECT portal_key, url FROM portal_links",
  );

  const links: PortalLinks = { ...fallbackLinks };

  for (const row of result.rows) {
    if (isPortalKey(row.portal_key)) {
      links[row.portal_key] = row.url;
    }
  }

  return links;
}

router.get("/portal-links", async (_req, res) => {
  try {
    const links = await readPortalLinks();
    res.json({ links });
  } catch (error) {
    res.status(500).json({
      error: "Unable to load portal links.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.put("/portal-links", async (req, res) => {
  const requestedLinks = req.body?.links;

  if (!requestedLinks || typeof requestedLinks !== "object" || Array.isArray(requestedLinks)) {
    res.status(400).json({ error: "A links object is required." });
    return;
  }

  const normalizedEntries: Array<[PortalKey, string]> = [];

  for (const key of portalKeys) {
    if (!(key in requestedLinks)) continue;

    const normalizedUrl = normalizePortalUrl(requestedLinks[key]);
    if (normalizedUrl === null) {
      res.status(400).json({ error: `The URL provided for ${key} is invalid.` });
      return;
    }

    normalizedEntries.push([key, normalizedUrl]);
  }

  if (normalizedEntries.length === 0) {
    res.status(400).json({ error: "No recognized portal links were provided." });
    return;
  }

  const client = await pool.connect();

  try {
    await ensurePortalLinksTable();
    await client.query("BEGIN");

    for (const [key, url] of normalizedEntries) {
      await client.query(
        `
          INSERT INTO portal_links (portal_key, url, updated_at)
          VALUES ($1, $2, now())
          ON CONFLICT (portal_key)
          DO UPDATE SET url = EXCLUDED.url, updated_at = now()
        `,
        [key, url],
      );
    }

    await client.query("COMMIT");
    const links = await readPortalLinks();
    res.json({ links });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({
      error: "Unable to save portal links.",
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    client.release();
  }
});

export default router;
