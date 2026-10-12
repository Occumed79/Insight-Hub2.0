import { Router, type IRouter, type Request, type Response } from "express";
import { createNeonBackedStore } from "../services/aor-intel/cache";
import { COMMAND_NEWS_COMMANDS, COMMAND_NEWS_SOURCES } from "../services/aor-intel/command-news/sources";
import { getCommandNews, getNewsMonitor, type FetchedText, type NewsDeps } from "../services/aor-intel/command-news/service";
import type { CommandId } from "../services/aor-intel/command-policy/assignments-rows";
import { logger } from "../lib/logger";

// Official combatant-command news, press releases and publications, with per-source monitoring.
const router: IRouter = Router();
const store = createNeonBackedStore((error) => logger.warn({ err: error instanceof Error ? error.message : String(error) }, "AOR command-news cache store unavailable; using in-process cache"));

const MAX_BYTES = 2_000_000;

async function fetchText(url: string): Promise<FetchedText> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      redirect: "follow", signal: controller.signal,
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/html;q=0.8, */*;q=0.5", "User-Agent": "Occu-Med-Insight-Hub/2.0 AOR Factors (official-source monitor)" },
    });
    const body = (await response.text()).slice(0, MAX_BYTES);
    return { status: response.status, body, finalUrl: response.url || url };
  } finally {
    clearTimeout(timer);
  }
}

export const newsDeps = (): NewsDeps => ({ store, fetchText });

router.get("/aor/command-news/sources", (_req: Request, res: Response) => {
  res.json({ ok: true, commands: COMMAND_NEWS_COMMANDS, sources: COMMAND_NEWS_SOURCES });
});

router.get("/aor/command-news/status", async (req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await getNewsMonitor(newsDeps(), { refresh: req.query.refresh === "1" }));
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Command news monitor failed." });
  }
});

router.get("/aor/command-news", async (req: Request, res: Response) => {
  const command = String(req.query.command ?? "").toUpperCase() as CommandId;
  if (!COMMAND_NEWS_COMMANDS.includes(command)) {
    res.status(400).json({ ok: false, error: `command must be one of ${COMMAND_NEWS_COMMANDS.join(", ")}.` });
    return;
  }
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await getCommandNews(command, newsDeps(), { refresh: req.query.refresh === "1" }));
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Command news failed." });
  }
});

/** Warms every source on an interval so the monitor reflects reality without a user request. Server start only; failures are logged, never thrown. */
export function startCommandNewsMonitor(intervalMs = 30 * 60_000): () => void {
  const run = async () => {
    try {
      const monitor = await getNewsMonitor(newsDeps(), { refresh: true });
      const bad = monitor.sources.filter((source) => source.status === "source_unavailable" || source.status === "stale_cache");
      if (bad.length) logger.warn({ sources: bad.map((source) => ({ id: source.sourceId, status: source.status, error: "sourceError" in source ? source.sourceError : null })) }, "AOR command-news sources unavailable");
      else logger.info({ sources: monitor.sources.length }, "AOR command-news sources refreshed");
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : String(error) }, "AOR command-news monitor run failed");
    }
  };
  const first = setTimeout(run, 20_000);
  const timer = setInterval(run, intervalMs);
  first.unref?.(); timer.unref?.();
  return () => { clearTimeout(first); clearInterval(timer); };
}

export default router;
