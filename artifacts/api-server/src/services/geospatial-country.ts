import type { GeospatialResolveRequest } from "./geospatial-types";

export type CanonicalCountry = {
  iso2: string;
  name: string;
  center?: [number, number];
  bbox?: [number, number, number, number];
};

const countries: Array<[string[], CanonicalCountry]> = [
  [["united states", "usa", "us"], { iso2: "US", name: "United States", center: [-98.5795, 39.8283], bbox: [-124.85, 24.4, -66.88, 49.5] }],
  [["canada", "ca"], { iso2: "CA", name: "Canada", center: [-106.3468, 56.1304], bbox: [-141, 41.7, -52.6, 83.1] }],
  [["mexico", "mx"], { iso2: "MX", name: "Mexico", center: [-102.5528, 23.6345], bbox: [-118.5, 14.4, -86.7, 32.8] }],
  [["united kingdom", "uk", "gb", "great britain"], { iso2: "GB", name: "United Kingdom", center: [-3.436, 55.3781], bbox: [-8.65, 49.86, 1.77, 60.86] }],
  [["germany", "de"], { iso2: "DE", name: "Germany", center: [10.4515, 51.1657], bbox: [5.87, 47.27, 15.04, 55.06] }],
  [["france", "fr"], { iso2: "FR", name: "France", center: [2.2137, 46.2276], bbox: [-5.14, 41.33, 9.56, 51.09] }],
  [["italy", "it"], { iso2: "IT", name: "Italy", center: [12.5674, 41.8719], bbox: [6.63, 35.49, 18.78, 47.1] }],
  [["spain", "es"], { iso2: "ES", name: "Spain", center: [-3.7492, 40.4637], bbox: [-9.39, 35.95, 4.33, 43.79] }],
  [["poland", "pl"], { iso2: "PL", name: "Poland", center: [19.1451, 51.9194], bbox: [14.12, 49, 24.15, 54.84] }],
  [["romania", "ro"], { iso2: "RO", name: "Romania", center: [24.9668, 45.9432], bbox: [20.26, 43.62, 29.69, 48.27] }],
  [["turkey", "turkiye", "türkiye", "tr"], { iso2: "TR", name: "Türkiye", center: [35.2433, 38.9637], bbox: [25.67, 35.81, 44.82, 42.1] }],
  [["greece", "gr"], { iso2: "GR", name: "Greece", center: [21.8243, 39.0742], bbox: [19.37, 34.8, 28.25, 41.75] }],
  [["belgium", "be"], { iso2: "BE", name: "Belgium", center: [4.4699, 50.5039], bbox: [2.54, 49.5, 6.41, 51.51] }],
  [["estonia", "ee"], { iso2: "EE", name: "Estonia", center: [25.0136, 58.5953], bbox: [21.76, 57.51, 28.21, 59.68] }],
  [["portugal", "pt"], { iso2: "PT", name: "Portugal", center: [-8.2245, 39.3999], bbox: [-9.56, 36.96, -6.19, 42.15] }],
  [["kuwait", "kw"], { iso2: "KW", name: "Kuwait", center: [47.4818, 29.3117], bbox: [46.55, 28.52, 48.43, 30.1] }],
  [["saudi arabia", "sa"], { iso2: "SA", name: "Saudi Arabia", center: [45.0792, 23.8859], bbox: [34.5, 16.3, 55.67, 32.15] }],
  [["japan", "jp"], { iso2: "JP", name: "Japan", center: [138.2529, 36.2048], bbox: [122.93, 24.05, 153.99, 45.56] }],
  [["australia", "au"], { iso2: "AU", name: "Australia", center: [133.7751, -25.2744], bbox: [112.92, -43.74, 153.64, -10.68] }],
  [["ghana", "gh"], { iso2: "GH", name: "Ghana", center: [-1.0232, 7.9465], bbox: [-3.26, 4.74, 1.2, 11.17] }],
  [["colombia", "co"], { iso2: "CO", name: "Colombia", center: [-74.2973, 4.5709], bbox: [-79, -4.23, -66.85, 12.46] }],
  [["peru", "pe"], { iso2: "PE", name: "Peru", center: [-75.0152, -9.19], bbox: [-81.33, -18.35, -68.65, 0.04] }],
  [["panama", "pa"], { iso2: "PA", name: "Panama", center: [-80.7821, 8.538], bbox: [-83.05, 7.2, -77.16, 9.65] }],
  [["chile", "cl"], { iso2: "CL", name: "Chile", center: [-71.543, -35.6751], bbox: [-75.7, -55.98, -66.42, -17.5] }],
  [["argentina", "ar"], { iso2: "AR", name: "Argentina", center: [-63.6167, -38.4161], bbox: [-73.56, -55.06, -53.64, -21.78] }],
  [["south korea", "republic of korea", "korea", "kr"], { iso2: "KR", name: "South Korea", center: [127.7669, 35.9078], bbox: [126.11, 33, 129.59, 38.61] }],
  [["north korea", "kp"], { iso2: "KP", name: "North Korea", center: [127.5101, 40.3399], bbox: [124.1, 37.67, 130.68, 43.02] }],
  [["ivory coast", "cote d ivoire", "cote d'ivoire", "côte d’ivoire", "ci"], { iso2: "CI", name: "Côte d’Ivoire", center: [-5.5471, 7.54], bbox: [-8.6, 4.35, -2.49, 10.74] }],
  [["czechia", "czech republic", "cz"], { iso2: "CZ", name: "Czechia", center: [15.473, 49.8175], bbox: [12.09, 48.55, 18.86, 51.06] }],
];

const aliasMap = new Map<string, CanonicalCountry>();
for (const [aliases, country] of countries) for (const alias of aliases) aliasMap.set(normalizeText(alias), country);

const regionCodes: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca", colorado: "co", connecticut: "ct", delaware: "de",
  florida: "fl", georgia: "ga", hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia", kansas: "ks", kentucky: "ky",
  louisiana: "la", maine: "me", maryland: "md", massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms", missouri: "mo",
  montana: "mt", nebraska: "ne", nevada: "nv", "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
  "north carolina": "nc", "north dakota": "nd", ohio: "oh", oklahoma: "ok", oregon: "or", pennsylvania: "pa", "rhode island": "ri",
  "south carolina": "sc", "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt", virginia: "va", washington: "wa",
  "west virginia": "wv", wisconsin: "wi", wyoming: "wy", "district of columbia": "dc",
};

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeIso2(value: unknown): string {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(text) ? text : "";
}

export function canonicalCountry(value: unknown): CanonicalCountry | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const direct = aliasMap.get(normalized);
  if (direct) return direct;
  const iso = normalizeIso2(value);
  return iso ? countries.map(([, country]) => country).find((country) => country.iso2 === iso) ?? null : null;
}

export function expectedIso2(request: GeospatialResolveRequest): string {
  return normalizeIso2(request.expectedIso2)
    || canonicalCountry(request.expectedCountry)?.iso2
    || (request.kind === "country" ? canonicalCountry(request.query)?.iso2 || "" : "");
}

export function regionEquivalent(expected: unknown, actual: unknown): boolean {
  const left = normalizeText(expected);
  const right = normalizeText(actual);
  if (!left || !right) return false;
  if (left === right) return true;
  return (regionCodes[left] || left) === (regionCodes[right] || right);
}

export function validCoordinates(lat: unknown, lon: unknown): boolean {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
}
