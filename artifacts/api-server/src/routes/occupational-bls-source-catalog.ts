import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const BASE = "https://download.bls.gov/pub/time.series";

type Spec = { title: string; description: string; officialUrl: string; dimensions: Record<string, { label: string; file: string }> };
const DATASETS: Record<string, Spec> = {
  is: {
    title: "Survey of Occupational Injuries and Illnesses — Industry Data",
    description: "All published SOII industry mapping dimensions used to identify occupational injury and illness counts and incidence-rate series.",
    officialUrl: `${BASE}/is/`,
    dimensions: {
      industry: { label: "Industries / NAICS", file: "is.industry" },
      area: { label: "Geographic areas", file: "is.area" },
      case_type: { label: "Case types", file: "is.case.type" },
      data_type: { label: "Data types / measures", file: "is.data.type" },
      supersector: { label: "Supersectors", file: "is.supersector" },
    },
  },
  fa: {
    title: "Census of Fatal Occupational Injuries",
    description: "All published CFOI mapping dimensions used to identify fatal occupational injury series.",
    officialUrl: `${BASE}/fa/`,
    dimensions: {
      area: { label: "Geographic areas", file: "fa.area" },
      case: { label: "Case classifications", file: "fa.case" },
      category: { label: "Fatality categories", file: "fa.category" },
      category2: { label: "Category definitions", file: "fa.category2" },
      datatype: { label: "Data types", file: "fa.datatype" },
      event: { label: "Events / exposures", file: "fa.event" },
      industry: { label: "Industries / NAICS", file: "fa.industry" },
      occupation: { label: "Occupations / SOC", file: "fa.occupation" },
      source: { label: "Sources of injury", file: "fa.source" },
    },
  },
};

function parse(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split("\t").map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()]));
  });
}

router.get("/occupational-source-browser/bls/catalog", async (req: Request, res: Response) => {
  const dataset = String(req.query.dataset ?? "").toLowerCase();
  const spec = DATASETS[dataset];
  if (!spec) return res.status(400).json({ ok: false, error: "dataset must be is or fa." });
  try {
    const entries = await Promise.all(Object.entries(spec.dimensions).map(async ([id, dimension]) => {
      const response = await fetch(`${BASE}/${dataset}/${dimension.file}`, { headers: { "User-Agent": "Occu-Med-Insight-Hub/2.0" } });
      if (!response.ok) throw new Error(`${dimension.file} returned HTTP ${response.status}.`);
      const rows = parse(await response.text());
      return [id, { id, label: dimension.label, file: dimension.file, count: rows.length, rows }] as const;
    }));
    return res.json({ ok: true, source: "BLS public time-series mapping files", catalog: { dataset, title: spec.title, description: spec.description, officialUrl: spec.officialUrl, dimensions: Object.fromEntries(entries) } });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "BLS mapping catalog failed." });
  }
});

export default router;
