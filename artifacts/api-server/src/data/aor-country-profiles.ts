import { ACCESS_TIER, CLIMATE, EVACUATION, MEDICAL, SECURITY, TRAVEL, WATCH } from "./aor-country-profile-pools";
import { AOR_COUNTRY_PROFILE_ROWS_1 } from "./aor-country-profile-rows-1";
import { AOR_COUNTRY_PROFILE_ROWS_2 } from "./aor-country-profile-rows-2";
import { AOR_COUNTRY_PROFILE_ROWS_3 } from "./aor-country-profile-rows-3";
import { AOR_COUNTRY_PROFILE_ROWS_4 } from "./aor-country-profile-rows-4";

export type AorCountryProfile = {
  profileId: string;
  country: string;
  iso2: string;
  iso3: string;
  mapTilerIsoA2: string;
  aorRegion: string;
  unSubregion: string;
  capital: string;
  latitude: number | null;
  longitude: number | null;
  climateEnvironment: string;
  medicalAccess: string;
  securityAccess: string;
  travelHealthContext: string;
  escalationEvacuation: string;
  reviewWatchItems: string[];
  medicalAccessTier: string;
  legacyBuiltIn: boolean;
  liveAdvisoryRequired: boolean;
};

export const AOR_COUNTRY_PROFILE_SOURCE = {
  name: "AOR_Global_Country_Profiles_MapTiler.xlsx",
  reviewedAt: "2026-08-10",
  profileType: "baseline" as const,
  coverage: 197,
} as const;

const ROWS = [
  ...AOR_COUNTRY_PROFILE_ROWS_1,
  ...AOR_COUNTRY_PROFILE_ROWS_2,
  ...AOR_COUNTRY_PROFILE_ROWS_3,
  ...AOR_COUNTRY_PROFILE_ROWS_4,
] as const;

export const AOR_COUNTRY_PROFILES: readonly AorCountryProfile[] = ROWS.map((row) => ({
  profileId: row[0],
  country: row[1],
  iso2: row[2],
  iso3: row[3],
  mapTilerIsoA2: row[4],
  aorRegion: row[5],
  unSubregion: row[6],
  capital: row[7],
  latitude: row[8],
  longitude: row[9],
  climateEnvironment: CLIMATE[row[10]],
  medicalAccess: MEDICAL[row[11]],
  securityAccess: SECURITY[row[12]],
  travelHealthContext: TRAVEL[row[13]],
  escalationEvacuation: EVACUATION[row[14]],
  reviewWatchItems: WATCH[row[15]].split(";").map((item) => item.trim()).filter(Boolean),
  medicalAccessTier: ACCESS_TIER[row[16]],
  legacyBuiltIn: row[17] === 1,
  liveAdvisoryRequired: row[18] === 1,
}));

const BY_ISO2 = new Map(AOR_COUNTRY_PROFILES.map((profile) => [profile.iso2.toUpperCase(), profile] as const));

export function getAorCountryProfileByIso2(iso2: string): AorCountryProfile | null {
  const normalized = String(iso2 || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return BY_ISO2.get(normalized) ?? null;
}
