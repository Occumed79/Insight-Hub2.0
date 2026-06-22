import { Router, type IRouter, type Request, type Response } from "express";
import { buildVisualizationFeed, type DataVisualizationFeed } from "../services/dataVisualizationFeedService";

const router: IRouter = Router();

// GET /api/data-visualization/feed?company=&state=&naics=&year=&include=
router.get("/data-visualization/feed", async (req: Request, res: Response) => {
  try {
    const { company, state, naics, year, include } = req.query;

    const includeArr = include
      ? String(include).split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const feed: DataVisualizationFeed = await buildVisualizationFeed({
      company: company ? String(company) : undefined,
      state: state ? String(state) : undefined,
      naics: naics ? String(naics) : undefined,
      year: year ? String(year) : undefined,
      include: includeArr,
    });

    // Browser caches for 60s; server-side cache (5min) handles dedup
    res.set("Cache-Control", "public, max-age=60");
    return res.json(feed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data visualization feed failed";
    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

export default router;
