import { Router, type IRouter } from "express";
import yellowBook1 from "./aor-yellow-book-data-1";
import yellowBook2 from "./aor-yellow-book-data-2";
import yellowBook3 from "./aor-yellow-book-data-3";
import yellowBook4 from "./aor-yellow-book-data-4";
import { YELLOW_BOOK_OPERATIONAL_RULES } from "./aor-yellow-book-rules";

const router: IRouter = Router();

type YellowBookProfile = {
  title: string;
  aliases: readonly string[];
  pages: readonly [number, number];
  sourceDate: string;
  agent: string;
  endemicity: string;
  atRisk: string;
  prevention: string;
  diagnosticSupport: string;
  transmission: string;
  clinical: string;
  diagnosis: string;
  treatment: string;
  keyNotes: readonly string[];
  flags: Readonly<Record<string, boolean>>;
};

const PROFILES = [...yellowBook1, ...yellowBook2, ...yellowBook3, ...yellowBook4] as unknown as YellowBookProfile[];
const FLAG_OVERRIDES: Record<string, Record<string, boolean>> = {
  "Typhoid and Paratyphoid Fever": { animalExposure: false },
  "Leptospirosis": { animalExposure: true },
  "Malaria": { freshwater: false },
  "Cholera": { vaccinePreventable: true },
};

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matches(profile: YellowBookProfile, query: string) {
  const needle = normalize(query);
  if (!needle) return true;
  return [profile.title, ...profile.aliases, profile.agent, profile.endemicity, profile.atRisk, profile.prevention, profile.transmission]
    .map(normalize)
    .join(" ")
    .includes(needle);
}

router.get("/aor/yellow-book", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  const query = String(req.query.q || "").trim().slice(0, 100);
  const selected = query ? PROFILES.filter((profile) => matches(profile, query)) : PROFILES;
  const profiles = selected.map((profile) => ({
    ...profile,
    flags: { ...profile.flags, ...(FLAG_OVERRIDES[profile.title] ?? {}) },
    operationalRules: YELLOW_BOOK_OPERATIONAL_RULES[profile.title] ?? [],
  }));

  return res.json({
    ok: true,
    source: {
      publication: "CDC Yellow Book™: Health Information for International Travel",
      edition: 2026,
      bookletPages: 277,
      diseaseChapters: 22,
      extraction: "Structured from the supplied CDC infectious-disease booklet, preserving chapter terminology and source page ranges.",
      currentGuidanceBoundary: "Yellow Book content is reference context. Current country-specific recommendations and Travel Health Notices continue to come from CDC Travelers' Health and other live official sources.",
    },
    profiles,
  });
});

export default router;
