import { useCallback, useEffect, useMemo, useState } from "react";
import { latLngBounds, type LatLngTuple } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Globe2,
  Loader2,
  Radar,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  discoverGeographicFootprint,
  getSavedGeographicEntities,
  verifyGeographicLocation,
  type GeographicFootprintResponse,
  type GeographicLocation,
  type GeographicResearchSource,
  type GeographicSourceDiagnostic,
  type SavedGeographicEntity,
} from "@/data/geographicFootprintApi";

const SESSION_COMPANY_KEY = "insight-hub.locations.company";
const ALL_SAVED = "all-saved";
const SEARCH_RESULTS = "search-results";
const MAPPABLE_CONFIDENCE = new Set(["exact", "place", "city"]);

type CompanyPinPalette = {
  fillColor: string;
  borderColor: string;
};

function companyPinPalette(companyName: string): CompanyPinPalette {
  const normalizedName = companyName.trim().toLowerCase() || "unknown-company";
  let hash = 2166136261;

  for (let index = 0; index < normalizedName.length; index += 1) {
    hash ^= normalizedName.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const unsignedHash = hash >>> 0;
  const hue = (unsignedHash / 0xffffffff) * 360;
  const saturation = 72 + ((unsignedHash >>> 8) % 17);
  const lightness = 44 + ((unsignedHash >>> 16) % 10);

  return {
    fillColor: `hsl(${hue.toFixed(2)} ${saturation}% ${lightness}%)`,
    borderColor: `hsl(${hue.toFixed(2)} ${Math.min(saturation + 5, 94)}% ${Math.min(lightness + 27, 82)}%)`,
  };
}

type DisplayLocation = GeographicLocation & {
  companyName: string;
};

function coordinatesFor(location: GeographicLocation): LatLngTuple | null {
  if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) return null;
  const longitude = Number(location.coordinates[0]);
  const latitude = Number(location.coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [latitude, longitude];
}

function locationMetadata(location: GeographicLocation): Record<string, unknown> {
  return location.metadata && typeof location.metadata === "object" ? location.metadata : {};
}

function evidenceUrl(location: GeographicLocation): string {
  const metadata = locationMetadata(location);
  if (typeof metadata.sourceUrl === "string" && /^https?:\/\//.test(metadata.sourceUrl)) return metadata.sourceUrl;
  const coordinates = coordinatesFor(location);
  if (location.sourceId && /^(node|way|relation)\//.test(location.sourceId)) {
    return `https://www.openstreetmap.org/${location.sourceId}`;
  }
  if (coordinates) {
    const [latitude, longitude] = coordinates;
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(location.formattedAddress || location.placeName)}`;
}

function confidenceLabel(location: GeographicLocation): string {
  if (location.reviewStatus === "verified") return "Saved location";
  if (location.geocodeConfidence === "exact") return "Exact match";
  if (location.geocodeConfidence === "place") return "Named place";
  if (location.geocodeConfidence === "city") return "City-level match";
  return "Needs review";
}

function FitMapToLocations({ locations }: { locations: DisplayLocation[] }) {
  const map = useMap();

  useEffect(() => {
    const points = locations.map(coordinatesFor).filter((point): point is LatLngTuple => Boolean(point));
    if (points.length === 0) {
      map.setView([20, 0], 2, { animate: true });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 9, { animate: true });
      return;
    }
    map.fitBounds(latLngBounds(points), { padding: [70, 70], maxZoom: 9, animate: true });
  }, [locations, map]);

  return null;
}

export default function GeographicData() {
  const [companyName, setCompanyName] = useState(() => sessionStorage.getItem(SESSION_COMPANY_KEY) || "");
  const [savedEntities, setSavedEntities] = useState<SavedGeographicEntity[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(ALL_SAVED);
  const [searchResult, setSearchResult] = useState<GeographicFootprintResponse | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [searching, setSearching] = useState(false);
  const [savingLocationId, setSavingLocationId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSavedCompanies = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const response = await getSavedGeographicEntities();
      setSavedEntities(response.entities);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Saved companies could not be loaded from Neon.");
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    void loadSavedCompanies();
  }, [loadSavedCompanies]);

  const savedMapLocations = useMemo<DisplayLocation[]>(() => savedEntities.flatMap((entity) => entity.locations
    .filter((location) => coordinatesFor(location) && MAPPABLE_CONFIDENCE.has(location.geocodeConfidence))
    .map((location) => ({ ...location, entityId: entity.id, companyName: entity.name }))), [savedEntities]);

  const displayedLocations = useMemo<DisplayLocation[]>(() => {
    if (selectedCompanyId === SEARCH_RESULTS && searchResult) {
      return searchResult.locations
        .filter((location) => coordinatesFor(location) && MAPPABLE_CONFIDENCE.has(location.geocodeConfidence))
        .map((location) => ({ ...location, companyName: searchResult.entityName }));
    }
    if (selectedCompanyId === ALL_SAVED) return savedMapLocations;
    return savedMapLocations.filter((location) => String(location.entityId) === selectedCompanyId);
  }, [savedMapLocations, searchResult, selectedCompanyId]);

  const selectedLocation = useMemo(
    () => displayedLocations.find((location) => location.id === selectedLocationId) ?? null,
    [displayedLocations, selectedLocationId],
  );

  const activeCompanyLabel = useMemo(() => {
    if (selectedCompanyId === SEARCH_RESULTS && searchResult) return `Search results · ${searchResult.entityName}`;
    if (selectedCompanyId === ALL_SAVED) return "All saved companies";
    return savedEntities.find((entity) => String(entity.id) === selectedCompanyId)?.name || "Saved company";
  }, [savedEntities, searchResult, selectedCompanyId]);

  const selectedResearchSources = useMemo<GeographicResearchSource[]>(() => {
    if (!selectedLocation || !searchResult || selectedLocation.entityId !== searchResult.entityId) return [];
    return searchResult.researchSources;
  }, [searchResult, selectedLocation]);

  useEffect(() => {
    if (selectedLocationId !== null && !displayedLocations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(null);
      setDetailOpen(false);
    }
  }, [displayedLocations, selectedLocationId]);

  useEffect(() => {
    if (!detailOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailOpen]);

  async function runDiscovery() {
    const company = companyName.trim();
    if (!company) {
      setError("Enter a company name before searching for locations.");
      return;
    }

    setSearching(true);
    setError(null);
    setNotice(null);
    setSelectedLocationId(null);
    setDetailOpen(false);
    sessionStorage.setItem(SESSION_COMPANY_KEY, company);

    try {
      const response = await discoverGeographicFootprint(company);
      setSearchResult(response);
      setSelectedCompanyId(SEARCH_RESULTS);
      await loadSavedCompanies();
      setNotice(
        `${response.company.canonicalName} was saved to Neon. `
        + `${response.counts.candidates} location candidates were retained; `
        + `${response.coverage.officialLocationsGeocoded} came from addresses extracted from official company pages.`,
      );
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The company location search could not be completed.");
      await loadSavedCompanies();
    } finally {
      setSearching(false);
    }
  }

  async function saveLocation(location: DisplayLocation) {
    if (!searchResult || location.entityId !== searchResult.entityId) return;
    setSavingLocationId(location.id);
    setError(null);
    setNotice(null);

    try {
      await verifyGeographicLocation(location.entityId, location.id);
      setSearchResult({
        ...searchResult,
        locations: searchResult.locations.map((candidate) => candidate.id === location.id
          ? { ...candidate, reviewStatus: "verified" }
          : candidate),
      });
      await loadSavedCompanies();
      setNotice(`${location.placeName} was verified and saved without removing the company’s other location candidates.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The location could not be saved.");
    } finally {
      setSavingLocationId(null);
    }
  }

  function chooseSavedCompany(value: string) {
    setSelectedCompanyId(value);
    setSelectedLocationId(null);
    setDetailOpen(false);
    setError(null);
    setNotice(null);
  }

  function openPreview(locationId: number) {
    setSelectedLocationId(locationId);
    setDetailOpen(false);
  }

  return (
    <main className="aurora-bg min-h-screen overflow-x-hidden text-white">
      <Sidebar />
      <section className="relative z-10 px-4 pb-10 pt-6 lg:ml-[210px] lg:px-7">
        <header className="mb-4 flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/38">Tab 1</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-white md:text-4xl">Locations</h1>
          </div>
          <p className="max-w-2xl text-xs leading-5 text-cyan-100/42 sm:text-right">
            Resolve a company, scan its official public location pages, geocode the addresses, and retain the company and candidates in Neon.
          </p>
        </header>

        <GlassCard
          variant="glass"
          className="relative overflow-hidden rounded-[36px] border border-cyan-100/20 bg-[#030916]/72 p-[6px] shadow-[0_28px_100px_rgba(0,0,0,.52),0_0_48px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.14)]"
        >
          <div className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#050913]">
            <div className="absolute left-5 top-5 z-[650] flex items-center gap-3 rounded-full border border-white/12 bg-[#07101d]/72 px-4 py-2 shadow-[0_14px_40px_rgba(0,0,0,.32)] backdrop-blur-xl">
              <Globe2 size={15} className="text-cyan-200/80" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/78">{activeCompanyLabel}</span>
              <span className="h-1 w-1 rounded-full bg-cyan-200/50" />
              <span className="text-[10px] text-cyan-100/44">{displayedLocations.length} mapped</span>
            </div>

            <div className="h-[calc(100vh-210px)] min-h-[620px] max-h-[940px] bg-[#050913]">
              <MapContainer center={[20, 0]} zoom={2} minZoom={2} className="locations-map h-full w-full" worldCopyJump>
                <TileLayer
                  attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Esri, TomTom, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors, and the GIS User Community'
                  url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                />
                <FitMapToLocations locations={displayedLocations} />
                {displayedLocations.map((location) => {
                  const center = coordinatesFor(location);
                  if (!center) return null;
                  const active = location.id === selectedLocationId;
                  const saved = location.reviewStatus === "verified";
                  const pinPalette = companyPinPalette(location.companyName);
                  return (
                    <CircleMarker
                      key={`${location.entityId}-${location.id}`}
                      center={center}
                      radius={active ? 12 : 8}
                      pathOptions={{
                        color: active ? "#ffffff" : pinPalette.borderColor,
                        fillColor: pinPalette.fillColor,
                        fillOpacity: active ? 1 : saved ? 0.94 : 0.8,
                        weight: active ? 4 : saved ? 3 : 2,
                      }}
                      eventHandlers={{ click: () => openPreview(location.id) }}
                    />
                  );
                })}
              </MapContainer>
            </div>

            {selectedLocation && (
              <LocationPreview
                location={selectedLocation}
                onClose={() => setSelectedLocationId(null)}
                onOpen={() => setDetailOpen(true)}
              />
            )}
          </div>
        </GlassCard>

        <GlassCard
          variant="glass"
          className="mt-5 rounded-[30px] border border-cyan-100/18 bg-[#06101d]/76 p-5 shadow-[0_24px_70px_rgba(0,0,0,.38),0_0_38px_rgba(45,212,191,.08),inset_0_1px_0_rgba(255,255,255,.12)] md:p-6"
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(260px,.7fr)_minmax(420px,1.3fr)] xl:items-end">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/44">Companies saved in Neon</span>
              <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/14 bg-black/22 px-4 focus-within:border-cyan-200/32">
                {loadingSaved ? <Loader2 size={16} className="animate-spin text-cyan-200/55" /> : <Building2 size={16} className="text-cyan-200/55" />}
                <select
                  value={selectedCompanyId === SEARCH_RESULTS ? ALL_SAVED : selectedCompanyId}
                  onChange={(event) => chooseSavedCompany(event.target.value)}
                  className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-semibold text-cyan-50 outline-none"
                >
                  <option value={ALL_SAVED} className="bg-[#07101d]">All saved companies ({savedMapLocations.length} locations)</option>
                  {savedEntities.map((entity) => (
                    <option key={entity.id} value={String(entity.id)} className="bg-[#07101d]">
                      {entity.name} · {entity.status} ({entity.locations.length})
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-cyan-100/34">Every submitted company is retained, including companies whose sites still need review.</p>
            </label>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/44">Find a company and its public sites</span>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-cyan-100/14 bg-black/22 px-4 focus-within:border-cyan-200/32">
                  <Search size={16} className="shrink-0 text-cyan-200/48" />
                  <input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void runDiscovery();
                    }}
                    placeholder="Enter a company name"
                    className="min-w-0 flex-1 bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-100/24"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void runDiscovery()}
                  disabled={searching || !companyName.trim()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/24 bg-cyan-300/14 px-5 text-sm font-bold text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.10)] transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {searching ? <Loader2 size={17} className="animate-spin" /> : <Radar size={17} />}
                  {searching ? "Resolving, crawling & geocoding…" : "Find branches & sites"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-cyan-100/34">The finder uses company resolution, official-site pages, configured search providers, OpenStreetMap, and Photon.</p>
            </div>
          </div>

          {(error || notice) && (
            <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-200/18 bg-rose-300/[0.07] text-rose-100" : "border-emerald-200/18 bg-emerald-300/[0.07] text-emerald-100"}`}>
              {error || notice}
            </div>
          )}

          {searchResult && (
            <DiscoveryStatus
              diagnostics={searchResult.sourceDiagnostics}
              pagesScanned={searchResult.coverage.officialPagesScanned}
              addressesExtracted={searchResult.coverage.officialAddressesExtracted}
              officialWebsite={searchResult.company.officialWebsite}
              warnings={searchResult.warnings}
            />
          )}
        </GlassCard>
      </section>

      {selectedLocation && detailOpen && (
        <LocationDetailModal
          location={selectedLocation}
          researchSources={selectedResearchSources}
          saving={savingLocationId === selectedLocation.id}
          onSave={() => void saveLocation(selectedLocation)}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </main>
  );
}

function DiscoveryStatus({
  diagnostics,
  pagesScanned,
  addressesExtracted,
  officialWebsite,
  warnings,
}: {
  diagnostics: GeographicSourceDiagnostic[];
  pagesScanned: number;
  addressesExtracted: number;
  officialWebsite?: string;
  warnings: string[];
}) {
  return (
    <section className="mt-5 border-t border-cyan-100/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/40">Finder coverage</p>
          <p className="mt-1 text-xs text-cyan-100/46">{pagesScanned} official pages scanned · {addressesExtracted} official addresses extracted</p>
        </div>
        {officialWebsite && (
          <a href={officialWebsite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-100/64 transition hover:text-cyan-50">
            Official website <ExternalLink size={13} />
          </a>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {diagnostics.map((diagnostic) => (
          <div key={diagnostic.source} className="rounded-2xl border border-cyan-100/10 bg-black/16 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-100/38">{diagnostic.source.replace("-", " ")}</span>
              <span className={`h-2 w-2 rounded-full ${diagnostic.status === "success" ? "bg-emerald-300" : diagnostic.status === "error" ? "bg-rose-300" : "bg-amber-300"}`} />
            </div>
            <p className="mt-2 text-xs font-semibold text-cyan-50/78">{diagnostic.resultsFound} found</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-cyan-100/34">{diagnostic.message}</p>
          </div>
        ))}
      </div>
      {warnings.length > 0 && <p className="mt-3 text-[10px] leading-4 text-amber-100/52">{warnings.join(" ")}</p>}
    </section>
  );
}

function LocationPreview({ location, onClose, onOpen }: { location: DisplayLocation; onClose: () => void; onOpen: () => void }) {
  const metadata = locationMetadata(location);
  const discoveredBy = typeof metadata.discoveredBy === "string" ? metadata.discoveredBy : location.geocodeSource;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      className="absolute bottom-5 left-5 z-[650] w-[min(390px,calc(100%-40px))] cursor-pointer overflow-hidden rounded-[26px] border border-cyan-100/22 bg-[#07101d]/84 p-5 shadow-[0_24px_70px_rgba(0,0,0,.52),0_0_34px_rgba(34,211,238,.12),inset_0_1px_0_rgba(255,255,255,.14)] backdrop-blur-2xl transition hover:border-cyan-100/38 hover:bg-[#091526]/90"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="absolute right-3 top-3 rounded-xl border border-white/10 bg-black/20 p-1.5 text-cyan-100/45 transition hover:text-white"
        aria-label="Close location preview"
      >
        <X size={14} />
      </button>
      <p className="pr-10 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">{location.companyName}</p>
      <h2 className="mt-2 pr-8 text-xl font-black tracking-[-0.025em] text-white">{location.placeName}</h2>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-cyan-100/52">
        {location.formattedAddress || [location.city, location.state, location.country].filter(Boolean).join(", ")}
      </p>
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-cyan-100/10 pt-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-cyan-50/80">{location.facilityType || location.sourceType || "Location candidate"}</p>
          <p className="mt-1 text-[10px] text-cyan-100/38">{confidenceLabel(location)} · {discoveredBy}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-300/10 text-cyan-50">
          <ChevronRight size={19} />
        </span>
      </div>
    </div>
  );
}

function LocationDetailModal({
  location,
  researchSources,
  saving,
  onSave,
  onClose,
}: {
  location: DisplayLocation;
  researchSources: GeographicResearchSource[];
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const coordinates = coordinatesFor(location);
  const isSaved = location.reviewStatus === "verified";
  const metadata = locationMetadata(location);
  const sourceTitle = typeof metadata.sourceTitle === "string" ? metadata.sourceTitle : undefined;
  const evidenceSnippet = typeof metadata.evidenceSnippet === "string" ? metadata.evidenceSnippet : undefined;
  const discoveredBy = typeof metadata.discoveredBy === "string" ? metadata.discoveredBy : location.geocodeSource;

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center px-4 py-8">
      <button type="button" aria-label="Close location details" onClick={onClose} className="absolute inset-0 bg-[#01040b]/76 backdrop-blur-md" />
      <GlassCard
        variant="glass"
        className="relative z-10 max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-[34px] border border-cyan-100/24 bg-[#06101d]/92 p-6 shadow-[0_40px_140px_rgba(0,0,0,.72),0_0_60px_rgba(34,211,238,.14),inset_0_1px_0_rgba(255,255,255,.16)] md:p-8"
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/42">{location.companyName}</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">{location.placeName}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-cyan-100/56">
              {location.formattedAddress || [location.city, location.state, location.country].filter(Boolean).join(", ")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 text-cyan-100/52 transition hover:text-white" aria-label="Close details">
            <X size={19} />
          </button>
        </div>

        <div className="mt-7 grid gap-x-8 gap-y-6 border-y border-cyan-100/10 py-7 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Company" value={location.companyName} />
          <DetailField label="Location type" value={location.facilityType || location.sourceType || "Unclassified"} />
          <DetailField label="Activity" value={location.activity || "Not established"} />
          <DetailField label="City / region" value={[location.city, location.state || location.region].filter(Boolean).join(", ") || "Not established"} />
          <DetailField label="Country" value={location.country || "Unknown"} />
          <DetailField label="Evidence status" value={confidenceLabel(location)} />
          <DetailField label="Discovered by" value={discoveredBy} />
          <DetailField label="Geocode source" value={location.geocodeSource || "Unknown"} />
          <DetailField label="Source classification" value={[location.sourceClass, location.sourceType].filter(Boolean).join(" · ") || "Not classified"} />
          <DetailField label="Coordinates" value={coordinates ? `${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}` : "Unavailable"} mono />
        </div>

        {(sourceTitle || evidenceSnippet) && (
          <section className="mt-7 border-b border-cyan-100/10 pb-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/40">Public evidence</p>
            {sourceTitle && <p className="mt-3 text-sm font-bold text-cyan-50/82">{sourceTitle}</p>}
            {evidenceSnippet && <p className="mt-2 text-sm leading-6 text-cyan-100/54">{evidenceSnippet}</p>}
          </section>
        )}

        {location.notes && (
          <section className="mt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/40">Location notes</p>
            <p className="mt-3 text-sm leading-7 text-cyan-100/58">{location.notes}</p>
          </section>
        )}

        {researchSources.length > 0 && (
          <section className="mt-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/40">Additional verification paths</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {researchSources.map((source) => (
                <a
                  key={`${source.type}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 rounded-2xl border border-cyan-100/10 bg-white/[0.025] px-4 py-3 transition hover:border-cyan-100/22 hover:bg-white/[0.05]"
                >
                  <div>
                    <p className="text-xs font-bold text-cyan-50">{source.label}</p>
                    <p className="mt-1 text-[10px] leading-4 text-cyan-100/38">{source.note}</p>
                  </div>
                  <ExternalLink size={15} className="shrink-0 text-cyan-100/40" />
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-cyan-100/10 pt-6 sm:flex-row sm:justify-end">
          <a
            href={evidenceUrl(location)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/14 bg-white/[0.035] px-5 text-sm font-semibold text-cyan-50 transition hover:bg-white/[0.06]"
          >
            <ExternalLink size={16} />
            Open public evidence
          </a>
          {!isSaved && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200/22 bg-emerald-300/12 px-5 text-sm font-bold text-emerald-100 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
              {saving ? "Saving location…" : "Verify & save location"}
            </button>
          )}
          {isSaved && (
            <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200/18 bg-emerald-300/[0.08] px-5 text-sm font-bold text-emerald-100">
              <CheckCircle2 size={17} />
              Verified in Neon
            </span>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/34">{label}</p>
      <p className={`mt-2 text-sm font-semibold leading-5 text-cyan-50/82 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
