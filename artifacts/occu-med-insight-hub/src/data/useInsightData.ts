import { useEffect, useMemo, useState } from "react";
import type { Company } from "./types";
import { buildCanonicalDataset } from "./datasetLayers";

/**
 * Static employer datasets and automatic source runs have been removed.
 * Employer-specific intelligence is populated only by explicit manual workflows.
 */
export function useInsightData() {
  const dataset = useMemo(() => buildCanonicalDataset(), []);
  const companies = useMemo<Company[]>(() => dataset.companies, [dataset.companies]);
  return { dataset, companies };
}

export function useSelectedCompany(companies: Company[]) {
  const getDefaultCompanyId = () => companies[0]?.id ?? "";
  const [companyId, setCompanyId] = useState<string>(() => getDefaultCompanyId());

  useEffect(() => {
    if (!companies.some((item) => item.id === companyId)) {
      setCompanyId(getDefaultCompanyId());
    }
  }, [companies, companyId]);

  const company = useMemo(
    () => companies.find((item) => item.id === companyId) ?? companies[0],
    [companies, companyId],
  );

  return { companyId, setCompanyId, company };
}
