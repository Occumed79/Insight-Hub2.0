import { Router, type IRouter } from "express";
import { FUNGAL_SOURCE_NOTE_LABELS, FUNGAL_SOURCE_NOTES } from "./aor-fungal-source-notes";

const router: IRouter = Router();

type FungalResponseRow = {
  iso2?: string;
  [key: string]: unknown;
};

type FungalResponse = {
  disease?: { key?: string; [key: string]: unknown };
  rows?: FungalResponseRow[];
  sourceNoteLabel?: string | null;
  [key: string]: unknown;
};

// Preserve the country-level comments/assumptions printed in Bongomin et al.
// Tables 2, 3, 4, 6 and 8 without forking the existing burden endpoint. This
// middleware enriches the downstream response in-place and leaves tables that
// have no fourth evidence column (CPA/SAFS) unchanged.
router.get("/aor/fungal-burden", (_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const payload = body as FungalResponse;
      const diseaseKey = String(payload.disease?.key || "");
      const notes = FUNGAL_SOURCE_NOTES[diseaseKey];
      if (notes && Array.isArray(payload.rows)) {
        payload.sourceNoteLabel = FUNGAL_SOURCE_NOTE_LABELS[diseaseKey] || "Source assumptions / comments";
        payload.rows = payload.rows.map((row) => {
          const iso2 = String(row.iso2 || "").toUpperCase();
          return { ...row, sourceNote: notes[iso2] || null };
        });
      } else {
        payload.sourceNoteLabel = null;
      }
    }
    return originalJson(body);
  }) as typeof res.json;
  next();
});

export default router;
