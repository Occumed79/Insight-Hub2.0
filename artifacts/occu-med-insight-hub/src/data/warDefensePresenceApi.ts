export type DefensePersonnel = {
  country: string;
  iso3: string;
  ccode: string;
  region: string;
  year: number;
  quarter: number;
  month: string;
  sourcePeriod: string;
  activeDuty: number;
  totalPersonnel: number;
  army: number;
  navy: number;
  airForce: number;
  marines: number;
  coastGuard: number;
  spaceForce: number;
  selectedReserve: number;
  civilians: number;
};

export type DefenseFacility = {
  name: string;
  country: string;
  iso3: string;
  latitude: number;
  longitude: number;
  category: "base" | "lilypad" | "funded-site" | "facility";
  base: boolean;
  lilypad: boolean;
  fundedSite: boolean;
};

export type DefenseConstruction = {
  location: string;
  country: string;
  iso3: string;
  latitude: number;
  longitude: number;
  spendThousands: number;
  spendUsd: number;
  firstYear: number;
  lastYear: number;
  observations: number;
};

export type WarDefensePresenceResponse = {
  ok: boolean;
  fetchedAt: string;
  source: {
    name: string;
    dashboard: string;
    latestYear: number;
    latestQuarter: number;
    constructionUnit: string;
    notes: string;
  };
  summary: {
    personnelCountries: number;
    facilities: number;
    constructionLocations: number;
    activeDuty: number;
  };
  personnel: DefensePersonnel[];
  facilities: DefenseFacility[];
  construction: DefenseConstruction[];
};

export async function getWarDefensePresence(refresh = false): Promise<WarDefensePresenceResponse> {
  const response = await fetch(`/api/war-costs/defense-presence${refresh ? "?refresh=1" : ""}`, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `Defense presence request failed (${response.status}).`);
  return payload as WarDefensePresenceResponse;
}
