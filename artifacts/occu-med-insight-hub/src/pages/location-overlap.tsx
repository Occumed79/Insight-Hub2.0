import { useEffect, useMemo, useState } from "react";
import { latLngBounds, type LatLngTuple } from "leaflet";
import {
  CircleMarker,
  MapContainer,
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
  type LucideIcon,
} from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  getSavedGeographicEntities,
  type GeographicLocation,
  type SavedGeographicEntity,
} from "@/data/geographicFootprintApi";

const STORAGE_SELECTIONS = "insight-hub.location-overlap.companies";
const STORAGE_RADIUS = "insight-hub.location-overlap.radius";
const MAPPABLE_CONFIDENCE = new Set(["exact", "place", "city"]);
const RADIUS_OPTIONS = [25, 50, 100, 200];
const SLOT_STYLES = [
  { label: "Company A", color: "#ff8a3d", glow: "rgba(255,138,61,.30)" },
  { label: "Company B", color: "#44f0a7", glow: "rgba(68,240,167,.28)" },
  { label: "Company C", color: "#a78bfa", glow: "rgba(167,139,250,.28)" },
  { label: "Company D", color: "#38bdf8", glow: "rgba(56,189,248,.28)" },
] as const;

type SelectedCompany = {
  entity: SavedGeographicEntity;
  slot: number;
  color: string;
};

type CompanyPoint = {
  id: string;
  companyId: number;
  companyName: string;
  slot: number;
  color: string;
  coordinates: LatLngTuple;
  location: GeographicLocation;
};

type ZoneCompany = {
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
  companies: ZoneCompany[];
  points: CompanyPoint[];
  verified: number;
  score: number;
};

function coordinatesFor(location: GeographicLocation): LatLngTuple | null {
  if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) return null;
  const longitude = Number(location.coordinates[0]);
  const latitude = Number(location.coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [latitude, longitude];
}

function locationsFor(entity: SavedGeographicEntity, verifiedOnly: boolean): GeographicLocation[] {
  return entity.locations.filter((location) => {
    if (!coordinatesFor(location) || !MAPPABLE_CONFIDENCE.has(location.geocodeConfidence)) return false;
    return !verifiedOnly || location.reviewStatus === "verified";
  });
}

function locationLabel(location: GeographicLocation): string {
  const city = location.city?.trim() || location.placeName?.trim();
  const region = location.state?.trim() || location.region?.trim();
  return [city, region, location.country?.trim()].filter(Boolean).join(", ") || "Shared operating area";
}

function distanceKilometers(left: LatLngTuple, right: LatLngTuple): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(left[0]);
  const lat2 = toRadians(right[0]);
  const deltaLat = toRadians(right[0] - left[0]);
  const deltaLng = toRadians(right[1] - left[1]);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const value = Math.min(1, sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng);
  return 12742 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function strongestLabel(points: CompanyPoint[]): string {
  const counts = new Map<string, number>();
  for (const point of points) {
    const label = locationLabel(point.location);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Shared operating area";
}

function buildZones(points: CompanyPoint[], radiusMiles: number): OverlapZone[] {
  if (points.length < 2) return [];
  const radiusKm = radiusMiles * 1.609344;
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
      if (distanceKilometers(points[left].coordinates, points[right].coordinates) <= radiusKm) union(left, right);
    }
  }

  const groups = new Map<number, CompanyPoint[]>();
  points.forEach((point, index) => {
    const root = find(index);
    const group = groups.get(root) || [];
    group.push(point);
    groups.set(root, group);
  });

  const zones: OverlapZone[] = [];
  for (const [root, group] of groups.entries()) {
    const companyGroups = new Map<number, CompanyPoint[]>();
    for (const point of group) {
      const companyGroup = companyGroups.get(point.companyId) || [];
      companyGroup.push(point);
      companyGroups.set(point.companyId, companyGroup);
    }
    if (companyGroups.size < 2) continue;

    const companies: ZoneCompany[] = [];
    for (const companyGroup of companyGroups.values()) {
      const first = companyGroup[0];
      companies.push({
        id: first.companyId,
        name: first.companyName,
        slot: first.slot,
        color: first.color,
        locations: companyGroup.length,
      });
    }
    companies.sort((a, b) => a.slot - b.slot);

    const latitude = group.reduce((sum, point) => sum + point.coordinates[0], 0) / group.length;
    const longitude = group.reduce((sum, point) => sum + point.coordinates[1], 0) / group.length;
    zones.push({
      id: `zone-${root}`,
      label: strongestLabel(group),
      coordinates: [latitude, longitude],
      companies,
      points: group,
      verified: group.filter((point) => point.location.reviewStatus === "verified").length,
      score: companies.length * 100 + Math.min(group.length, 99),
    });
  }

  return zones.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function storedSelections(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_SELECTIONS) || "[]") as unknown;
    if (!Array.isArray(parsed)) return ["", "", "", ""];
    return SLOT_STYLES.map((_, index) => typeof parsed[index] === "string" ? parsed[index] : "");
  } catch {
    return ["", "", "", ""];
  }
}

function FitMap({ points, zone }: { points: CompanyPoint[]; zone: OverlapZone | null }) {
  const map = useMap();
  useEffect(() => {
    if (zone) {
      map.flyTo(zone.coordinates, 7, { animate: true, duration: 1.05 });
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
      padding: [70, 70],
      maxZoom: 7,
      animate: true,
    });
  }, [map, points, zone]);
  return null;
}

export default function LocationOverlap() {
  const [entities, setEntities] = useState<SavedGeographicEntity[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(storedSelections);
  const [radiusMiles, setRadiusMiles] = useState(() => {
    const stored = Number(sessionStorage.getItem(STORAGE_RADIUS));
    return RADIUS_OPTIONS.includes(stored) ? stored : 50;
  });
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getSavedGeographicEntities()
      .then((response) => {
        if (!mounted) return;
        const available = response.entities
          .filter((entity) => locationsFor(entity, false).length > 0)
          .sort((a, b) => locationsFor(b, false).length - locationsFor(a, false).length || a.name.localeCompare(b.name));
        setEntities(available);
        setSelectedIds((current) => {
          const valid = new Set(available.map((entity) => String(entity.id)));
          const normalized = SLOT_STYLES.map((_, index) => valid.has(current[index]) ? current[index] : "");
          if (normalized.filter(Boolean).length >= 2) return normalized;
          return SLOT_STYLES.map((_, index) => available[index] && index < 2 ? String(available[index].id) : "");
        });
        setError(null);
      })
      .catch((loadError) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Saved locations could not be loaded from Neon.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_SELECTIONS, JSON.stringify(selectedIds));
    setActiveZoneId(null);
  }, [selectedIds]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_RADIUS, String(radiusMiles));
    setActiveZoneId(null);
  }, [radiusMiles, verifiedOnly]);

  const selectedCompanies = useMemo<SelectedCompany[]>(() => {
    const result: SelectedCompany[] = [];
    selectedIds.forEach((id, slot) => {
      if (!id) return;
      const entity = entities.find((candidate) => String(candidate.id) === id);
      if (entity) result.push({ entity, slot, color: SLOT_STYLES[slot].color });
    });
    return result;
  }, [entities, selectedIds]);

  const points = useMemo<CompanyPoint[]>(() => {
    const result: CompanyPoint[] = [];
    for (const selected of selectedCompanies) {
      for (const location of locationsFor(selected.entity, verifiedOnly)) {
        const coordinates = coordinatesFor(location);
        if (!coordinates) continue;
        result.push({
          id: `${selected.entity.id}-${location.id}`,
          companyId: selected.entity.id,
          companyName: selected.entity.name,
          slot: selected.slot,
          color: selected.color,
          coordinates,
          location,
        });
      }
    }
    return result;
  }, [selectedCompanies, verifiedOnly]);

  const zones = useMemo(() => buildZones(points, radiusMiles), [points, radiusMiles]);
  const activeZone = zones.find((zone) => zone.id === activeZoneId) || null;
  const overlappingCompanies = new Set(zones.flatMap((zone) => zone.companies.map((company) => company.id))).size;
  const selectedSet = new Set(selectedIds.filter(Boolean));

  function chooseCompany(slot: number, companyId: string) {
    setSelectedIds((current) => current.map((value, index) => index === slot ? companyId : value));
  }

  return (
    <main className="aurora-bg min-h-screen overflow-x-hidden text-white">
      <Sidebar />
      <style>{`
        .location-overlap-map .leaflet-control-zoom{border:1px solid rgba(207,250,254,.18)!important;border-radius:14px!important;overflow:hidden;box-shadow:0 16px 38px rgba(0,0,0,.35)!important}
        .location-overlap-map .leaflet-control-zoom a{background:rgba(4,12,24,.86)!important;color:rgba(236,254,255,.84)!important;border-color:rgba(207,250,254,.10)!important;backdrop-filter:blur(18px)}
        .location-overlap-map .leaflet-control-attribution{background:rgba(2,8,18,.66)!important;color:rgba(207,250,254,.48)!important;backdrop-filter:blur(12px)}
        .location-overlap-map .leaflet-control-attribution a{color:rgba(165,243,252,.70)!important}
        .company-overlap-glow{mix-blend-mode:screen;filter:saturate(1.2)}
        .overlap-zone-ring{filter:drop-shadow(0 0 9px rgba(255,255,255,.72));animation:overlapPulse 2.8s ease-in-out infinite}
        .overlap-map-tooltip{border:1px solid rgba(207,250,254,.22)!important;border-radius:16px!important;background:rgba(4,12,24,.90)!important;color:white!important;box-shadow:0 18px 46px rgba(0,0,0,.52)!important;backdrop-filter:blur(20px);padding:10px 12px!important}
        .overlap-map-tooltip:before{display:none!important}
        @keyframes overlapPulse{0%,100%{stroke-opacity:.45;fill-opacity:.05}50%{stroke-opacity:1;fill-opacity:.15}}
      `}</style>

      <section className="relative z-10 px-4 pb-12 pt-6 lg:ml-[210px] lg:px-7">
        <header className="mb-5 flex flex-col gap-3 px-1 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/38">Tab 2 · Network & Operations</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-white md:text-4xl">Location Overlap</h1>
          </div>
          <p className="max-w-3xl text-xs leading-5 text-cyan-100/46 xl:text-right">
            Compare up to four saved employers, reveal shared operating areas, and rank the markets where one provider network can support multiple companies.
          </p>
        </header>

        <GlassCard variant="glass" className="relative overflow-hidden rounded-[32px] border border-cyan-100/18 bg-[#06101d]/68 p-4 shadow-[0_28px_90px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.13)] md:p-5">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {SLOT_STYLES.map((slot, index) => {
              const entity = entities.find((candidate) => String(candidate.id) === selectedIds[index]);
              const siteCount = entity ? locationsFor(entity, verifiedOnly).length : 0;
              return (
                <label key={slot.label} className="relative overflow-hidden rounded-[24px] border bg-black/20 p-4" style={{ borderColor: `${slot.color}55`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.10),0 0 28px ${slot.glow}` }}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/48">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slot.color, boxShadow: `0 0 13px ${slot.color}` }} />
                      {slot.label}
                    </span>
                    <span className="text-[10px] text-cyan-100/34">{siteCount} sites</span>
                  </span>
                  <div className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#030916]/64 px-3.5">
                    <Building2 size={15} style={{ color: slot.color }} />
                    <select value={selectedIds[index] || ""} onChange={(event) => chooseCompany(index, event.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-semibold text-cyan-50 outline-none">
                      <option value="" className="bg-[#07101d]">Select a company</option>
                      {entities.map((candidate) => {
                        const id = String(candidate.id);
                        const disabled = selectedSet.has(id) && selectedIds[index] !== id;
                        return <option key={candidate.id} value={id} disabled={disabled} className="bg-[#07101d]">{candidate.name} ({locationsFor(candidate, verifiedOnly).length})</option>;
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
                <button key={radius} type="button" onClick={() => setRadiusMiles(radius)} className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${radiusMiles === radius ? "border-cyan-200/30 bg-cyan-300/16 text-cyan-50" : "border-cyan-100/10 bg-black/18 text-cyan-100/44 hover:text-cyan-50"}`}>{radius} mi</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setVerifiedOnly((value) => !value)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold ${verifiedOnly ? "border-emerald-200/30 bg-emerald-300/12 text-emerald-50" : "border-cyan-100/10 bg-black/18 text-cyan-100/44"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${verifiedOnly ? "border-emerald-200/60" : "border-cyan-100/20"}`}>{verifiedOnly && <Check size={10} />}</span>
                Verified only
              </button>
              <button type="button" onClick={() => setActiveZoneId(null)} className="inline-flex items-center gap-2 rounded-full border border-cyan-100/10 bg-black/18 px-3.5 py-2 text-xs font-bold text-cyan-100/46 hover:text-cyan-50"><RotateCcw size={13} />Fit all selected</button>
            </div>
          </div>
        </GlassCard>

        {error && <div className="mt-5 rounded-2xl border border-rose-200/18 bg-rose-300/[0.07] px-4 py-3 text-sm text-rose-100">{error}</div>}

        <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,.62fr)]">
          <GlassCard variant="glass" className="relative overflow-hidden rounded-[38px] border border-cyan-100/22 bg-[#020817]/76 p-[6px] shadow-[0_32px_110px_rgba(0,0,0,.56),inset_0_1px_0_rgba(255,255,255,.16)]">
            <div className="relative overflow-hidden rounded-[31px] border border-white/[0.08] bg-[#050913]">
              <div className="pointer-events-none absolute inset-0 z-[500] bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,.11),transparent_22%),linear-gradient(125deg,rgba(255,255,255,.055),transparent_24%,transparent_72%,rgba(34,211,238,.045))]" />
              <div className="absolute left-5 top-5 z-[650] flex max-w-[calc(100%-40px)] flex-wrap items-center gap-3 rounded-full border border-white/14 bg-[#06101d]/72 px-4 py-2 shadow-[0_16px_42px_rgba(0,0,0,.36)] backdrop-blur-2xl">
                <Layers3 size={15} className="text-cyan-100/72" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/80">Live convergence map</span>
                <span className="h-1 w-1 rounded-full bg-cyan-100/45" />
                <span className="text-[10px] text-cyan-100/48">{points.length} sites · {zones.length} shared zones</span>
              </div>

              <div className="h-[68vh] min-h-[620px] max-h-[900px] bg-[#050913]">
                <MapContainer center={[20, 0]} zoom={2} minZoom={2} className="location-overlap-map h-full w-full" worldCopyJump>
                  {import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ? (
                    <TileLayer attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url={`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN)}`} tileSize={256} />
                  ) : (
                    <TileLayer attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>' url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}" />
                  )}
                  <FitMap points={points} zone={activeZone} />

                  {points.map((point) => <CircleMarker key={`halo-${point.id}`} center={point.coordinates} radius={25} pathOptions={{ color: point.color, fillColor: point.color, fillOpacity: 0.12, opacity: 0.08, weight: 1, className: "company-overlap-glow" }} />)}
                  {points.map((point) => <CircleMarker key={`glow-${point.id}`} center={point.coordinates} radius={11} pathOptions={{ color: point.color, fillColor: point.color, fillOpacity: 0.42, opacity: 0.52, weight: 1.5, className: "company-overlap-glow" }} />)}
                  {points.map((point) => (
                    <CircleMarker key={`point-${point.id}`} center={point.coordinates} radius={5} pathOptions={{ color: "#ffffff", fillColor: point.color, fillOpacity: 0.98, opacity: 0.78, weight: 1.5 }}>
                      <LeafletTooltip direction="top" offset={[0, -8]} className="overlap-map-tooltip">
                        <div className="min-w-[190px]">
                          <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: point.color }}>{point.companyName}</p>
                          <p className="mt-1 text-sm font-black text-white">{point.location.placeName}</p>
                          <p className="mt-1 text-[10px] leading-4 text-cyan-100/60">{point.location.formattedAddress || locationLabel(point.location)}</p>
                        </div>
                      </LeafletTooltip>
                    </CircleMarker>
                  ))}
                  {zones.map((zone) => {
                    const active = zone.id === activeZoneId;
                    return (
                      <CircleMarker key={zone.id} center={zone.coordinates} radius={(active ? 28 : 21) + zone.companies.length * 4} pathOptions={{ color: active ? "#ffffff" : "#ecfeff", fillColor: "#ffffff", fillOpacity: active ? 0.16 : 0.07, opacity: active ? 1 : 0.68, weight: active ? 3 : 2, dashArray: active ? undefined : "4 7", className: "overlap-zone-ring" }} eventHandlers={{ click: () => setActiveZoneId(zone.id) }}>
                        <LeafletTooltip direction="top" offset={[0, -14]} className="overlap-map-tooltip">
                          <div className="min-w-[220px]">
                            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/52">Shared market · {radiusMiles} mi</p>
                            <p className="mt-1 text-sm font-black text-white">{zone.label}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">{zone.companies.map((company) => <span key={company.id} className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold" style={{ color: company.color }}>{company.name} · {company.locations}</span>)}</div>
                          </div>
                        </LeafletTooltip>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              </div>

              {loading && <div className="absolute inset-0 z-[700] flex items-center justify-center bg-[#020817]/72 backdrop-blur-lg"><div className="flex items-center gap-3 rounded-full border border-cyan-100/16 bg-[#06101d]/82 px-5 py-3 text-sm font-semibold text-cyan-50"><Loader2 size={18} className="animate-spin text-cyan-200" />Loading saved locations from Neon…</div></div>}
              {!loading && selectedCompanies.length < 2 && <div className="absolute inset-0 z-[620] flex items-center justify-center bg-[#020817]/42 px-6"><div className="max-w-md rounded-[28px] border border-cyan-100/18 bg-[#06101d]/86 p-7 text-center backdrop-blur-2xl"><UsersRound size={28} className="mx-auto text-cyan-200/72" /><h2 className="mt-4 text-xl font-black">Choose at least two companies</h2><p className="mt-2 text-xs leading-5 text-cyan-100/48">Their saved locations illuminate separately; overlapping light reveals shared operating markets.</p></div></div>}
            </div>
          </GlassCard>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={Target} label="Shared zones" value={String(zones.length)} note={`${radiusMiles}-mile radius`} />
              <Metric icon={UsersRound} label="Companies converging" value={String(overlappingCompanies)} note={`of ${selectedCompanies.length} selected`} />
              <Metric icon={MapPin} label="Mapped sites" value={String(points.length)} note={verifiedOnly ? "verified only" : "all mappable"} />
              <Metric icon={Sparkles} label="Strongest overlap" value={zones[0] ? `${zones[0].companies.length}-way` : "—"} note={zones[0]?.label || "No shared area yet"} />
            </div>

            <GlassCard variant="glass" className="overflow-hidden rounded-[30px] border border-cyan-100/18 bg-[#06101d]/72 p-5 shadow-[0_24px_70px_rgba(0,0,0,.38),inset_0_1px_0_rgba(255,255,255,.12)]">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/40">Provider investment priorities</p><h2 className="mt-1 text-xl font-black">Shared markets</h2></div><span className="rounded-full border border-cyan-100/12 bg-cyan-300/[0.07] px-3 py-1.5 text-[10px] font-bold text-cyan-100/58">Ranked</span></div>
              <div className="mt-4 max-h-[580px] space-y-2 overflow-y-auto pr-1">
                {zones.map((zone, index) => (
                  <button key={zone.id} type="button" onClick={() => setActiveZoneId(zone.id)} className={`w-full rounded-[22px] border p-4 text-left transition ${zone.id === activeZoneId ? "border-cyan-100/28 bg-cyan-300/[0.10]" : "border-cyan-100/10 bg-black/16 hover:bg-white/[0.045]"}`}>
                    <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/12 bg-white/[0.04] text-xs font-black">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{zone.label}</span><span className="mt-1 block text-[10px] text-cyan-100/42">{zone.points.length} sites · {zone.verified} verified · {zone.companies.length} companies</span><span className="mt-3 flex flex-wrap gap-1.5">{zone.companies.map((company) => <span key={company.id} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-bold" style={{ color: company.color }}>{company.name} · {company.locations}</span>)}</span></span><ChevronRight size={16} className="mt-1 shrink-0 text-cyan-100/32" /></div>
                  </button>
                ))}
                {!loading && selectedCompanies.length >= 2 && zones.length === 0 && <div className="rounded-[24px] border border-cyan-100/10 bg-black/16 p-6 text-center"><Radar size={24} className="mx-auto text-cyan-100/36" /><p className="mt-3 text-sm font-bold text-cyan-50/76">No shared markets at {radiusMiles} miles</p><p className="mt-2 text-[11px] leading-5 text-cyan-100/38">Increase the radius or include all mappable candidates.</p></div>}
              </div>
            </GlassCard>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <GlassCard variant="glass" className="rounded-[24px] border border-cyan-100/14 bg-[#06101d]/68 p-4 shadow-[0_18px_48px_rgba(0,0,0,.30),inset_0_1px_0_rgba(255,255,255,.10)]">
      <div className="flex items-center justify-between gap-3"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/38">{label}</p><Icon size={14} className="text-cyan-200/52" /></div>
      <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">{value}</p>
      <p className="mt-1 truncate text-[10px] text-cyan-100/38" title={note}>{note}</p>
    </GlassCard>
  );
}
