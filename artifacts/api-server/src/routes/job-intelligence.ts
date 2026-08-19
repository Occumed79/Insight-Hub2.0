import { Router, type Request, type Response } from "express";
import {
  createJobProfile,
  deleteJobProfile,
  getJobProfile,
  listJobProfiles,
  updateJobProfile,
} from "../services/jobIntelligenceService";

const router = Router();

function idFrom(req: Request): string {
  return String(req.params.id || "").trim();
}

router.get("/job-intelligence/profiles", async (_req: Request, res: Response) => {
  try {
    const profiles = await listJobProfiles();
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, profiles });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to load Job Intelligence profiles." });
  }
});

router.get("/job-intelligence/profiles/:id", async (req: Request, res: Response) => {
  try {
    const profile = await getJobProfile(idFrom(req));
    if (!profile) return res.status(404).json({ ok: false, error: "Job profile not found." });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, profile });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to load Job Intelligence profile." });
  }
});

router.post("/job-intelligence/profiles", async (req: Request, res: Response) => {
  try {
    const profile = await createJobProfile((req.body ?? {}) as Record<string, unknown>);
    return res.status(201).json({ ok: true, profile });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Unable to create Job Intelligence profile." });
  }
});

router.patch("/job-intelligence/profiles/:id", async (req: Request, res: Response) => {
  try {
    const profile = await updateJobProfile(idFrom(req), (req.body ?? {}) as Record<string, unknown>);
    if (!profile) return res.status(404).json({ ok: false, error: "Job profile not found." });
    return res.json({ ok: true, profile });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Unable to update Job Intelligence profile." });
  }
});

router.delete("/job-intelligence/profiles/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await deleteJobProfile(idFrom(req));
    if (!deleted) return res.status(404).json({ ok: false, error: "Job profile not found." });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to delete Job Intelligence profile." });
  }
});

export default router;
