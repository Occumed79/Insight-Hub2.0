import { useEffect, useMemo, useRef, useState } from "react";
import { loadInsightDataset } from "./ingestion";
import type { Company, InsightDataset } from "./types";
import { fetchCompanyIntelligence } from "./intelligenceApi";
import { buildCanonicalDataset } from "./datasetLayers";
import { upsertCompanyIntelligence } from "./canonicalDataset";

const INTELLIGENCE_CONCURRENCY = 4;

export function useInsightData() {
  const [dataset, setDataset] = useState<InsightDataset>(() => buildCanonicalDataset());
  const attemptedIntelligence = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    loadInsightDataset().then((workbookDataset) => {
      if (!active) return;
      setDataset((previous) => {
        const rebuilt = buildCanonicalDataset(workbookDataset);
        const retainedIntelligence = previous.intelligence.filter((item) => rebuilt.companies.some((company) => company.id === item.companyId));
        return { ...rebuilt, intelligence: retainedIntelligence };
      });
    });
    return () => { active = false; };
  }, []);

  const intelligenceCompanyIds = useMemo(
    () => dataset.companies.filter((company) => (company.entityType ?? "company") === "company").map((company) => company.id),
    [dataset.companies],
  );
  const intelligenceCompanyKey = intelligenceCompanyIds.join("|");

  useEffect(() => {
    let active = true;
    const pending = intelligenceCompanyIds.filter((companyId) => !attemptedIntelligence.current.has(companyId));
    let cursor = 0;

    const worker = async () => {
      while (active) {
        const index = cursor;
        cursor += 1;
        const companyId = pending[index];
        if (!companyId) return;
        attemptedIntelligence.current.add(companyId);
        const intelligence = await fetchCompanyIntelligence(companyId);
        if (!active || !intelligence) continue;
        setDataset((previous) => upsertCompanyIntelligence(previous, intelligence));
      }
    };

    void Promise.all(Array.from({ length: Math.min(INTELLIGENCE_CONCURRENCY, pending.length) }, () => worker()));
    return () => { active = false; };
  }, [intelligenceCompanyKey]);

  const companies = useMemo<Company[]>(() => dataset.companies, [dataset.companies]);
  return { dataset, companies };
}

export function useSelectedCompany(companies: Company[]) {
  const getDefaultCompanyId = () => companies.find((item) => item.id === "v2x")?.id || companies[0]?.id || "";
  const [companyId, setCompanyId] = useState<string>(() => getDefaultCompanyId());

  useEffect(() => {
    if (!companies.some((item) => item.id === companyId)) {
      setCompanyId(getDefaultCompanyId());
    }
  }, [companies, companyId]);

  const company = useMemo(() => companies.find((item) => item.id === companyId) || companies[0], [companies, companyId]);

  return { companyId, setCompanyId, company };
}
