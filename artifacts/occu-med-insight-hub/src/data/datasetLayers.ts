import type { InsightDataset } from "./types";
import { assembleCanonicalDataset, type InsightDatasetLayer } from "./canonicalDataset";

/**
 * Build the dataset from runtime-provided records only.
 * No committed employer profiles, dossiers, metrics, locations, reports, or workbook assets are loaded.
 */
export function buildCanonicalDataset(runtimeDataset?: InsightDataset): InsightDataset {
  const runtimeLayers: InsightDatasetLayer[] = runtimeDataset
    ? [{ name: "runtime", priority: 100, data: runtimeDataset }]
    : [];

  return assembleCanonicalDataset(runtimeLayers);
}
