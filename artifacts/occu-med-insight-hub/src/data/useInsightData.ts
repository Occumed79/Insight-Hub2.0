import { useEffect, useMemo, useState } from "react";
import { loadInsightDataset } from "./ingestion";
import { seedDataset } from "./seed";
import type { Company, InsightDataset } from "./types";

const API_DATASET_PATH = "/api/insight/dataset";

async function loadBackendDataset(): Promise<InsightDataset> {
  const response = await fetch(API_DATASET_PATH, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Backend dataset request failed with status ${response.status}`);
  }

  return (await response.json()) as InsightDataset;
}

async function loadBestAvailableDataset(): Promise<InsightDataset> {
  try {
    return await loadBackendDataset();
  } catch (backendError) {
    const workbookDataset = await loadInsightDataset();

    return {
      ...workbookDataset,
      status: {
        ...workbookDataset.status,
        error:
          workbookDataset.status.error ||
          (backendError instanceof Error
            ? `Backend API unavailable; using workbook/seed fallback. ${backendError.message}`
            : "Backend API unavailable; using workbook/seed fallback."),
      },
    };
  }
}

export function useInsightData() {
  const [dataset, setDataset] = useState<InsightDataset>(seedDataset);

  useEffect(() => {
    let active = true;

    loadBestAvailableDataset().then((loaded) => {
      if (active) setDataset(loaded);
    });

    return () => {
      active = false;
    };
  }, []);

  const defaultCompany = useMemo(
    () => dataset.companies.find((company) => company.id === "v2x") || dataset.companies[0],
    [dataset.companies],
  );

  return { dataset, defaultCompany };
}

export function useSelectedCompany(companies: Company[], defaultId = "v2x") {
  const [companyId, setCompanyId] = useState(defaultId);
  const company = companies.find((item) => item.id === companyId) || companies[0];
  return { companyId: company?.id || defaultId, setCompanyId, company };
}
