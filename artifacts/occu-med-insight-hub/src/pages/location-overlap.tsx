import { useEffect, useMemo, useState } from "react";
import { latLngBounds, type LatLngTuple } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Pane,
  TileLayer,
  Tooltip as LeafletTooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Building2,
  Check,
  ChevronRight,
  Layers3,
  Loader2,
  MapPin,
  Radar,
  RotateCcw,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  getSavedGeographicEntities,
  type GeographicLocation,
  type SavedGeographicEntity,
} from "@/data/geographicFootprintApi";

const SELECTED_COMPANIES_KEY = "insight-hub.location-overlap.companies";
const OVERLAP_RADIUS_KEY = "insight-hub.location-overlap.radius";
const MAPPABLE_CONFIDENCE = new Set(["exact", "place", "city"]);
const RADIUS_OPTIONS = [25, 50, 100, 200] as const;

const COMPANY_SLOTS = [
  { label: "Company A", color: "#ff8a3d", glow: "rgba(255,138,61,.34)" },
  { label: "Company B", color: "#44f0a7", glow: "rgba(68,240,167,.30)" },
  { label: "Company C", color: "#a78bfa", glow: "rgba(167,139,250,.30)" },
  { label: "Company D", color: "#38bdf8", glow: "rgba(56,189,248,.30)" },
] as const;

type CompanyPoint = {
  id: string;
  companyId: number;
  companyName: string;
  companySlot: number;
  color: string;
  coordinates: LatLngTuple;
  location: GeographicLocation;
};

type OverlapCompany = {
  id: number;
  name: string;
  slot: number;
  color: string;
  locations: number;
};

type OverlapZone = {
  id: string;
  label: string;
  coordinates: LatLngTuple;
  companies: OverlapCompany[];
  points: CompanyPoint[];
  verifiedLocations: number;
  score: number;
};

function locationCoordinates(location: GeographicLocation): LatLngTuple | null {
  if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) return null;
  const longitude = Number(location.coordinates[0]);
  const latitude = Number(location.coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [latitude, longitude];
}

function mappableLocations(entity: SavedGeographicEntity, verifiedOnly: boolean) {
  return entity.locations.filter((location) => {
    if (!locationCoordinates(location) || !MAPPABLE_CONFIDENCE.has(location.geocodeConfidence)) return false;
    return !verifiedOnly || location.reviewStatus === "verified";
  });
}

function haversineKilometers(a: LatLngTuple, b: LatLngTuple) {
  const earthRadius = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);
  const deltaLat = toRadians(b[0] - a[0]);
  const deltaLng = toRadians(b[1] - a[1]);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function readableLocation(location: GeographicLocation) {
  const city = location.city?.trim() || location.placeName?.trim();
  const region = location.state?.trim() || location.region?.trim();
  return [city, region, location.country?.trim()].filter(Boolean).join(", ") || "Shared operating area";
}

function mostCommonLabel(points: CompanyPoint[]) {
  const counts = new Map<string, number>();
  points.forEach((point) => {
    const label = readableLocation(point.location);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "Shared operating area";
}

function buildOverlapZones(points: CompanyPoint[], radiusMiles: number): OverlapZone[] {
  if (points.length < 2) return [];
  const radiusKilometers = radiusMiles * 1.609344;
  const parent = points.map((_, index) => index);

  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };

  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      if (haversineKilometers(points[left].coordinates, points[right].coordinates) <= radiusKilometers) {
        union(left, right);
      }
    }
  }

  const components = new Map<number, CompanyPoint[]>();
  points.forEach((point, index) => {
    const root = find(index);
    const component = components.get(root) || [];
    component.push(point);
    components.set(root, component);
  });

  return [...components.entries()]
    .map(([root, component]) => {
      const companyGroups = new Map<number, CompanyPoint[]>();
      component.forEach((point) => {
        const group = companyGroups.get(point.companyId) || [];
        group.push(point);
        companyGroups.set(point.companyId, group);
      });
      if (companyGroups.size < 2) return null;

      const latitude = component.reduce((total, point) => total + point.coordinates[0], 0) / component.length;
      const longitude = component.reduce((total, point) => total + point.coordinates[1], 0) / component.length;
      const companies = [...companyGroups.values()]
        .map((group) => ({
          id: group[0].companyId,
          name: group[0].companyName,
          slot: group[0].companySlot,
          color: group[0].color,
          locations: group.length,
        }))
        .sort((left, right) => left.slot - right.slot);
      const verifiedLocations = component.filter((point) => point.location.reviewStatus === "verified").length;

      return {
        id: `zone-${root}`,
        label: mostCommonLabel(component),
        coordinates: [latitude, longitude] as LatLngTuple,
        companies,
        points: component,
        verifiedLocations,
        score: companies.length * 100 + Math.min(component.length, 99),
      };
    })
    .filter((zone): zone is OverlapZone => Boolean(zone))
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));
}

function FitOverlapMap({ points, focusZone }: { points: CompanyPoint[]; focusZone: OverlapZone | null }) {
  const map = useMap();

  useEffect(() => {
    if (focusZone) {
      map.flyTo(focusZone.coordinates, 7, { animate: true, duration: 1.1 });
      return;
    }

    if (points.length === 0) {
      map.setView([20, 0], 2, { animate: true });
      return;
    }

    if (points.length === 1) {
      map.flyTo(points[0].coordinates, 8, { animate: true, duration: 1 });
      return;
    }

    map.fitBounds(latLngBounds(points.map((point) => point.coordinates)), {
      padding: [75, 75],
      maxZoom: 7,
      animate: true,
    });
  }, [focusZone, map, points]);

  return null;
}

function parseStoredCompanies() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SELECTED_COMPANIES_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [null, null, null, null] as Array<string | null>;
    return COMPANY_SLOTS.map((_, index) => typeof parsed[index] === "string" ? parsed[index] : null);
  } catch {
    return [null, null, null, null] as Array<string | null>;
  }
}

export default function LocationOverlap() {
  const [entities, setEntities] = useState<SavedGeographicEntity[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Array<string | null>>(parseStoredCompanies);
  const [radiusMiles, setRadiusMiles] = useState(() => {
    const stored = Number(sessionStorage.getItem(OVERLAP_RADIUS_KEY));
    return RADIUS_OPTIONS.includes(stored as (typeof RADIUS_OPTIONS)[number]) ? stored : 50;
  });
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSavedGeographicEntities()
      .then((response) => {
        if (!active) return;
        const available = response.entities
          .filter((entity) => mappableLocations(entity, false).length > 0)
          .sort((left, right) => mappableLocations(right, false).length - mappableLocations(left, false).length || left.name.localeCompare(right.name));
        setEntities(available);
        setSelectedCompanyIds((current) => {
          const validIds = new Set(available.map((entity) => String(entity.id)));
          const normalized = current.map((id) => id && validIds.has(id) ? id : null);
          if (normalized.filter(Boolean).length >= 2) return normalized;
          const defaults = available.slice(0, 2).map((entity) => String(entity.id));
          return COMPANY_SLOTS.map((_, index) => defaults[index] || null);
        });
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Saved company locations could not be loaded from Neon.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SELECTED_COMPANIES_KEY, JSON.stringify(selectedCompanyIds));
    setActiveZoneId(null);
  }, [selectedCompanyIds]);

  useEffect(() => {
    sessionStorage.setItem(OVERLAP_RADIUS_KEY, String(radiusMiles));
    setActiveZoneId(null);
  }, [radiusMiles, verifiedOnly]);

  const selectedCompanies = useMemo(() => selectedCompanyIds
    .map((id, slot) => {
      if (!id) return null;
      const entity = entities.find((candidate) => String(candidate.id) === id);
      if (!entity) return null;
      return { entity, slot, color: COMPANY_SLOTS[slot].color };
    })
    .filter((value): value is { entity: SavedGeographicEntity; slot: number; color: string } => Boolean(value)), [entities, selectedCompanyIds]);

  const points = useMemo<CompanyPoint[]>(() => selectedCompanies.flatMap(({ entity, slot, color }) => mappableLocations(entity, verifiedOnly)
    .map((location) => {
      const coordinates = locationCoordinates(location);
      if (!coordinates) return null;
      return {
        id: `${entity.id}-${location.id}`,
        companyId: entity.id,
        companyName: entity.name,
        companySlot: slot,
        color,
        coordinates,
        location,
      };
    })
    .filter((point): point is CompanyPoint => Boolean(point))), [selectedCompanies, verifiedOnly]);

  const zones = useMemo(() => buildOverlapZones(points, radiusMiles), [points, radiusMiles]);
  const activeZone = useMemo(() => zones.find((zone) => zone.id === activeZoneId) || null, [activeZoneId, zones]);
  const companiesInOverlap = useMemo(() => new Set(zones.flatMap((zone) => zone.companies.map((company) => company.id))).size, [zones]);
  const strongestZone = zones[0] || null;

  function selectCompany(slot: number, companyId: string) {
    setSelectedCompanyIds((current) => current.map((value, index) => index === slot ? (companyId || null) : value));
  }

  function resetView() {
    setActiveZoneId(null);
  }

  const selectedIdSet = new Set(selectedCompanyIds.filter((id): id is string => Boolean(id)));

  return (
    <main className="aurora-bg min-h-screen overflow-x-hidden text-white">
      <Sidebar />
      <style>{`
        .location-overlap-map .leaflet-control-zoom { border: 1px solid rgba(207,250,254,.18) !important; border-radius: 14px !important; overflow: hidden; box-shadow: 0 16px 38px rgba(0,0,0,.35) !important; }
        .location-overlap-map .leaflet-control-zoom a { background: rgba(4,12,24,.86) !important; color: rgba(236,254,255,.84) !important; border-color: rgba(207,250,254,.10) !important; backdrop-filter: blur(18px); }
        .location-overlap-map .leaflet-control-attribution { background: rgba(2,8,18,.66) !important; color: rgba(207,250,254,.48) !important; backdrop-filter: blur(12px); }
        .location-overlap-map .leaflet-control-attribution a { color: rgba(165,243,252,.70) !important; }
        .company-overlap-glow { mix-blend-mode: screen; filter: saturate(1.18); }
        .company-overlap-core { filter: drop-shadow(0 0 6px currentColor); }
        .overlap-zone-ring { filter: drop-shadow(0 0 9px rgba(255,255,255,.72)); animation: overlap-zone-pulse 2.8s ease-in-out infinite; }
        .overlap-map-tooltip { border: 1px solid rgba(207,250,254,.22) !important; border-radius: 16px !important; background: rgba(4,12,24,.88) !important; color: white !important; box-shadow: 0 18px 46px rgba(0,0,0,.52), inset 0 1px 0 rgba(255,255,255,.12) !important; backdrop-filter: blur(20px); padding: 10px 12px !important; }
        .overlap-map-tooltip:before { display: none !important; }
        @keyframes overlap-zone-pulse { 0%,100% { stroke-opacity: .46; fill-opacity: .06; } 50% { stroke-opacity: .95; fill-opacity: .14; } }
      `}</style>

      <section className="relative z-10 px-4 pb-12 pt-6 lg:ml-[210px] lg:px-7">
        <header className="mb-5 flex flex-col gap-3 px-1 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/38">Tab 2 · Network & Operations</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-white md:text-4xl">Location Overlap</h1>
          </div>
          <p className="max-w-3xl text-xs leading-5 text-cyan-100/46 xl:text-right">
            Compare as many as four saved employers, reveal shared operating areas, and rank the markets where provider-network investment can support multiple companies at once.
          </p>
        </header>

        <GlassCard
          variant="glass"
          className="relative overflow-hidden rounded-[32px] border border-cyan-100/18 bg-[#06101d]/68 p-4 shadow-[0_28px_90px_rgba(0,0,0,.42),0_0_42px_rgba(34,211,238,.08),inset_0_1px_0_rgba(255,255,255,.13)] md:p-5"
        >
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {COMPANY_SLOTS.map((slot, index) => {
              const selectedEntity = entities.find((entity) => String(entity.id) === selectedCompanyIds[index]);
              const locationCount = selectedEntity ? mappableLocations(selectedEntity, verifiedOnly).length : 0;
              return (
                <label
                  key={slot.label}
                  className="group relative overflow-hidden rounded-[24px] border bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.10)] transition hover:bg-white/[0.045]"
                  style={{ borderColor: `${slot.color}44`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.10), 0 0 28px ${slot.glow}` }}
                >
                  <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-3xl" style={{ background: slot.glow }} />
                  <span className="relative flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/45">
                      <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]" style={{ backgroundColor: slot.color, color: slot.color }} />
                      {slot.label}
                    </span>
                    <span className="text-[10px] text-cyan-100/34">{locationCount} sites</span>
                  </span>
                  <div className="relative mt-3 flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#030916]/64 px-3.5">
                    <Building2 size={15} style={{ color: slot.color }} />
                    <select
                      value={selectedCompanyIds[index] || ""}
                      onChange={(event) => selectCompany(index, event.target.value)}
                      className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-semibold text-cyan-50 outline-none"
                    >
                      <option value="" className="bg-[#07101d]">Select a company</option>
                      {entities.map((entity) => {
                        const entityId = String(entity.id);
                        const usedElsewhere = selectedIdSet.has(entityId) && selectedCompanyIds[index] !== entityId;
                        return (
                          <option key={entity.id} value={entityId} disabled={usedElsewhere} className="bg-[#07101d]">
                            {entity.name} ({mappableLocations(entity, verifiedOnly).length})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-4 border-t border-cyan-100/10 pt-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/38">Shared-area radius</span>
              {RADIUS_OPTIONS.map((radius) => (
                <button
                  key={radius}
                  type="button"
                  onClick={() => setRadiusMiles(radius)}
                  className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${radiusMiles === radius ? "border-cyan-200/30 bg-cyan-300/16 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,.12)]" : "border-cyan-100/10 bg-black/18 text-cyan-100/44 hover:border-cyan-100/20 hover:text-cyan-50"}`}
                >
                  {radius} mi
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setVerifiedOnly((current) => !current)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold transition ${verifiedOnly ? "border-emerald-200/30 bg-emerald-300/12 text-emerald-50" : "border-cyan-100/10 bg-black/18 text-cyan-100/44 hover:text-cyan-50"}`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${verifiedOnly ? "border-emerald-200/60 bg-emerald-300/18" : "border-cyan-100/20"}`}>
                  {verifiedOnly && <Check size={10} />}
                </span>
                Verified locations only
              </button>
              <button
                type="button"
                onClick={resetView}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-100/10 bg-black/18 px-3.5 py-2 text-xs font-bold text-cyan-100/46 transition hover:border-cyan-100/20 hover:text-cyan-50"
              >
                <RotateCcw size={13} />
                Fit all selected
              </button>
            </div>
          </div>
        </GlassCard>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200/18 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,.62fr)]">
          <GlassCard
            variant="glass"
            className="relative overflow-hidden rounded-[38px] border border-cyan-100/22 bg-[#020817]/76 p-[6px] shadow-[0_32px_110px_rgba(0,0,0,.56),0_0_54px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.16)]"
          >
            <div className="relative overflow-hidden rounded-[31px] border border-white/[0.08] bg-[#050913]">
              <div className="pointer-events-none absolute inset-0 z-[500] bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,.11),transparent_22%),linear-gradient(125deg,rgba(255,255,255,.055),transparent_24%,transparent_72%,rgba(34,211,238,.045))]" />
              <div className="pointer-events-none absolute inset-x-10 top-0 z-[510] h-px bg-gradient-to-r from-transparent via-white/75 to-transparent" />

              <div className="absolute left-5 top-5 z-[650] flex max-w-[calc(100%-40px)] flex-wrap items-center gap-3 rounded-full border border-white/14 bg-[#06101d]/72 px-4 py-2 shadow-[0_16px_42px_rgba(0,0,0,.36),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-2xl">
                <Layers3 size={15} className="text-cyan-100/72" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/80">Live convergence map</span>
                <span className="h-1 w-1 rounded-full bg-cyan-100/45" />
                <span className="text-[10px] text-cyan-100/48">{points.length} mapped sites · {zones.length} shared zones</span>
              </div>

              <div className="h-[68vh] min-h-[620px] max-h-[900px] bg-[#050913]">
                <MapContainer center={[20, 0]} zoom={2} minZoom={2} className="location-overlap-map h-full w-full" worldCopyJump>
                  {import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ? (
                    <TileLayer
                      attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url={`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN)}`}
                      tileSize={256}
                    />
                  ) : (
                    <TileLayer
                      attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Esri, TomTom, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors, and the GIS User Community'
                      url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                    />
                  )}
                  <FitOverlapMap points={points} focusZone={activeZone} />

                  <Pane name="company-overlap-glows" style={{ mixBlendMode: "screen", zIndex: 430 }}>
                    {points.map((point) => (
                      <CircleMarker
                        key={`glow-${point.id}`}
                        center={point.coordinates}
                        radius={25}
                        pathOptions={{
                          color: point.color,
                          fillColor: point.color,
                          fillOpacity: 0.12,
                          opacity: 0.08,
                          weight: 1,
                          className: "company-overlap-glow",
                        }}
                      />
                    ))}
                    {points.map((point) => (
                      <CircleMarker
                        key={`mid-${point.id}`}
                        center={point.coordinates}
                        radius={11}
                        pathOptions={{
                          color: point.color,
                          fillColor: point.color,
                          fillOpacity: 0.40,
                          opacity: 0.50,
                          weight: 1.5,
                          className: "company-overlap-glow",
                        }}
                      />
                    ))}
                  </Pane>

                  <Pane name="company-overlap-cores" style={{ zIndex: 450 }}>
                    {points.map((point) => (
                      <CircleMarker
                        key={`core-${point.id}`}
                        center={point.coordinates}
                        radius={5}
                        pathOptions={{
                          color: "rgba(255,255,255,.88)",
                          fillColor: point.color,
                          fillOpacity: 0.98,
                          opacity: 0.76,
                          weight: 1.5,
                          className: "company-overlap-core",
                        }}
                      >
                        <LeafletTooltip direction="top" offset={[0, -8]} className="overlap-map-tooltip">
                          <div className="min-w-[190px]">
                            <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: point.color }}>{point.companyName}</p>
                            <p className="mt-1 text-sm font-black text-white">{point.location.placeName}</p>
                            <p className="mt-1 text-[10px] leading-4 text-cyan-100/60">{point.location.formattedAddress || readableLocation(point.location)}</p>
                          </div>
                        </LeafletTooltip>
                      </CircleMarker>
                    ))}
                  </Pane>

                  <Pane name="overlap-zone-rings" style={{ zIndex: 470 }}>
                    {zones.map((zone) => {
                      const active = activeZoneId === zone.id;
                      return (
                        <CircleMarker
                          key={zone.id}
                          center={zone.coordinates}
                          radius={active ? 28 + zone.companies.length * 4 : 21 + zone.companies.length * 4}
                          pathOptions={{
                            color: active ? "#ffffff" : "rgba(236,254,255,.82)",
                            fillColor: "rgba(255,255,255,.16)",
                            fillOpacity: active ? 0.16 : 0.07,
                            opacity: active ? 1 : 0.68,
                            weight: active ? 3 : 2,
                            dashArray: active ? undefined : "4 7",
                            className: "overlap-zone-ring",
                          }}
                          eventHandlers={{ click: () => setActiveZoneId(zone.id) }}
                        >
                          <LeafletTooltip direction="top" offset={[0, -14]} className="overlap-map-tooltip">
                            <div className="min-w-[220px]">
                              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/52">Shared market · {radiusMiles} mi radius</p>
                              <p className="mt-1 text-sm font-black text-white">{zone.label}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {zone.companies.map((company) => (
                                  <span key={company.id} className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold" style={{ color: company.color }}>
                                    {company.name} · {company.locations}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </LeafletTooltip>
                        </CircleMarker>
                      );
                    })}
                  </Pane>
                </MapContainer>
              </div>

              {loading && (
                <div className="absolute inset-0 z-[700] flex items-center justify-center bg-[#020817]/72 backdrop-blur-lg">
                  <div className="flex items-center gap-3 rounded-full border border-cyan-100/16 bg-[#06101d]/82 px-5 py-3 text-sm font-semibold text-cyan-50 shadow-[0_20px_60px_rgba(0,0,0,.45)]">
                    <Loader2 size={18} className="animate-spin text-cyan-200" />
                    Loading saved locations from Neon…
                  </div>
                </div>
              )}

              {!loading && selectedCompanies.length < 2 && (
                <div className="absolute inset-0 z-[620] flex items-center justify-center bg-[#020817]/42 px-6 backdrop-blur-[2px]">
                  <div className="max-w-md rounded-[28px] border border-cyan-100/18 bg-[#06101d]/82 p-7 text-center shadow-[0_28px_80px_rgba(0,0,0,.52),inset_0_1px_0_rgba(255,255,255,.13)] backdrop-blur-2xl">
                    <UsersRound size={28} className="mx-auto text-cyan-200/72" />
                    <h2 className="mt-4 text-xl font-black text-white">Choose at least two companies</h2>
                    <p className="mt-2 text-xs leading-5 text-cyan-100/48">Their saved locations will illuminate in separate colors, while overlapping light reveals shared operating markets.</p>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon={Target} label="Shared zones" value={String(zones.length)} note={`${radiusMiles}-mile radius`} />
              <MetricCard icon={UsersRound} label="Companies converging" value={String(companiesInOverlap)} note={`of ${selectedCompanies.length} selected`} />
              <MetricCard icon={MapPin} label="Mapped sites" value={String(points.length)} note={verifiedOnly ? "verified only" : "all mappable"} />
              <MetricCard icon={Sparkles} label="Strongest overlap" value={strongestZone ? `${strongestZone.companies.length}-way` : "—"} note={strongestZone?.label || "No shared area yet"} />
            </div>

            <GlassCard
              variant="glass"
              className="overflow-hidden rounded-[30px] border border-cyan-100/18 bg-[#06101d]/72 p-5 shadow-[0_24px_70px_rgba(0,0,0,.38),inset_0_1px_0_rgba(255,255,255,.12)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/40">Provider investment priorities</p>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-white">Shared markets</h2>
                </div>
                <span className="rounded-full border border-cyan-100/12 bg-cyan-300/[0.07] px-3 py-1.5 text-[10px] font-bold text-cyan-100/58">Ranked</span>
              </div>

              <div className="mt-4 max-h-[580px] space-y-2 overflow-y-auto pr-1">
                {zones.map((zone, index) => {
                  const active = zone.id === activeZoneId;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setActiveZoneId(zone.id)}
                      className={`w-full rounded-[22px] border p-4 text-left transition ${active ? "border-cyan-100/28 bg-cyan-300/[0.10] shadow-[0_0_28px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.10)]" : "border-cyan-100/9 bg-black/16 hover:border-cyan-100/18 hover:bg-white/[0.045]"}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/12 bg-white/[0.04] text-xs font-black text-cyan-50/72">{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-white">{zone.label}</span>
                          <span className="mt-1 block text-[10px] text-cyan-100/42">{zone.points.length} sites · {zone.verifiedLocations} verified · {zone.companies.length} companies</span>
                          <span className="mt-3 flex flex-wrap gap-1.5">
                            {zone.companies.map((company) => (
                              <span key={company.id} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-bold" style={{ color: company.color }}>
                                {company.name} · {company.locations}
                              </span>
                            ))}
                          </span>
                        </span>
                        <ChevronRight size={16} className={`mt-1 shrink-0 ${active ? "text-cyan-100" : "text-cyan-100/28"}`} />
                      </div>
                    </button>
                  );
                })}

                {!loading && selectedCompanies.length >= 2 && zones.length === 0 && (
                  <div className="rounded-[24px] border border-cyan-100/10 bg-black/16 p-6 text-center">
                    <Radar size={24} className="mx-auto text-cyan-100/36" />
                    <p className="mt-3 text-sm font-bold text-cyan-50/76">No shared markets at {radiusMiles} miles</p>
                    <p className="mt-2 text-[11px] leading-5 text-cyan-100/38">Increase the comparison radius or include all mappable location candidates.</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <GlassCard
      variant="glass"
      className="rounded-[24px] border border-cyan-100/14 bg-[#06101d]/68 p-4 shadow-[0_18px_48px_rgba(0,0,0,.30),inset_0_1px_0_rgba(255,255,255,.10)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/38">{label}</p>
        <Icon size={14} className="text-cyan-200/52" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">{value}</p>
      <p className="mt-1 truncate text-[10px] text-cyan-100/38" title={note}>{note}</p>
    </GlassCard>
  );
}
