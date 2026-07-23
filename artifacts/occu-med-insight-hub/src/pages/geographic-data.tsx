import { useEffect, useMemo, useState } from "react";
import { latLngBounds, type LatLngTuple } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleOff,
  ExternalLink,
  Globe2,
  Layers3,
  Loader2,
  MapPin,
  MapPinned,
  Radar,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  discoverGeographicFootprint,
  verifyGeographicLocations,
  type GeographicFootprintResponse,
  type GeographicLocation,
  type GeographicResearchSource,
} from "@/data/geographicFootprintApi";

const SESSION_COMPANY_KEY = "insight-hub.geographic-footprint.company";
const MAPPABLE_CONFIDENCE = new Set(["exact", "place", "city"]);

function coordinatesFor(location: GeographicLocation): LatLngTuple | null {
  if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) return null;
  const longitude = Number(location.coordinates[0]);
  const latitude = Number(location.coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [latitude, longitude];
}

function confidenceLabel(location: GeographicLocation): string {
  if (location.geocodeConfidence === "exact") return "Exact match";
  if (location.geocodeConfidence === "place") return "Named place";
  if (location.geocodeConfidence === "city") return "City-level match";
  return "Needs review";
}

function confidenceClass(location: GeographicLocation): string {
  if (location.reviewStatus === "verified") return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (location.geocodeConfidence === "unknown") return "border-amber-200/20 bg-amber-300/10 text-amber-100";
  return "border-cyan-200/20 bg-cyan-300/10 text-cyan-100";
}

function evidenceUrl(location: GeographicLocation): string {
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

function FitMapToLocations({ locations }: { locations: GeographicLocation[] }) {
  const map = useMap();

  useEffect(() => {
    const points = locations.map(coordinatesFor).filter((point): point is LatLngTuple => Boolean(point));
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 8, { animate: true });
      return;
    }
    map.fitBounds(latLngBounds(points), { padding: [42, 42], maxZoom: 8, animate: true });
  }, [locations, map]);

  return null;
}

export default function GeographicData() {
  const [companyName, setCompanyName] = useState(() => sessionStorage.getItem(SESSION_COMPANY_KEY) || "");
  const [result, setResult] = useState<GeographicFootprintResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [locationFilter, setLocationFilter] = useState("");

  const mappableLocations = useMemo(
    () => (result?.locations ?? []).filter((location) => coordinatesFor(location) && MAPPABLE_CONFIDENCE.has(location.geocodeConfidence)),
    [result],
  );

  const visibleLocations = useMemo(() => {
    const query = locationFilter.trim().toLowerCase();
    if (!query) return result?.locations ?? [];
    return (result?.locations ?? []).filter((location) => [
      location.placeName,
      location.formattedAddress,
      location.city,
      location.state,
      location.country,
      location.facilityType,
      location.activity,
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [locationFilter, result]);

  const selectedLocation = useMemo(
    () => result?.locations.find((location) => location.id === selectedLocationId) ?? null,
    [result, selectedLocationId],
  );

  const countryCount = useMemo(
    () => new Set((result?.locations ?? []).map((location) => location.country).filter(Boolean)).size,
    [result],
  );

  const verifiedCount = useMemo(
    () => (result?.locations ?? []).filter((location) => location.reviewStatus === "verified").length,
    [result],
  );

  async function runDiscovery() {
    const company = companyName.trim();
    if (!company) {
      setError("Enter a company name before running location discovery.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);
    setSelectedLocationId(null);
    setSelectedIds(new Set());
    setLocationFilter("");
    sessionStorage.setItem(SESSION_COMPANY_KEY, company);

    try {
      const response = await discoverGeographicFootprint(company);
      setResult(response);
      const firstLocation = response.locations.find((location) => coordinatesFor(location)) ?? response.locations[0];
      setSelectedLocationId(firstLocation?.id ?? null);
      setSelectedIds(new Set(response.locations.filter((location) => location.reviewStatus === "verified").map((location) => location.id)));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Location discovery could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(locationId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  }

  async function confirmSelectedLocations() {
    if (!result || selectedIds.size === 0) return;
    setVerifying(true);
    setError(null);
    setNotice(null);

    try {
      await verifyGeographicLocations(result.entityId, Array.from(selectedIds));
      setResult({
        ...result,
        locations: result.locations.map((location) => ({
          ...location,
          reviewStatus: selectedIds.has(location.id) ? "verified" : "rejected",
        })),
      });
      setNotice(`${selectedIds.size} location${selectedIds.size === 1 ? "" : "s"} confirmed for ${result.entityName}.`);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Selected locations could not be confirmed.");
    } finally {
      setVerifying(false);
    }
  }

  function clearWorkspace() {
    setResult(null);
    setSelectedLocationId(null);
    setSelectedIds(new Set());
    setLocationFilter("");
    setError(null);
    setNotice(null);
    setCompanyName("");
    sessionStorage.removeItem(SESSION_COMPANY_KEY);
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10">
        <HeaderBar
          eyebrow="Standalone Intelligence Tool"
          title="Geographic Footprint"
          subtitle="Discover, review, map, and confirm public location evidence for one company without relying on committed static profiles."
        />

        <GlassCard className="mb-6 p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <label className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Company or legal entity</span>
              <div className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-black/20 px-4 focus-within:border-cyan-200/30">
                <Building2 size={17} className="shrink-0 text-cyan-200/45" />
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runDiscovery();
                  }}
                  placeholder="Enter a company name"
                  className="min-w-0 flex-1 bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-100/25"
                />
              </div>
            </label>

            <button
              type="button"
              onClick={() => void runDiscovery()}
              disabled={loading || !companyName.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/14 px-5 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Radar size={17} />}
              {loading ? "Discovering public locations…" : result ? "Run discovery again" : "Discover locations"}
            </button>

            {(result || companyName) && (
              <button
                type="button"
                onClick={clearWorkspace}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/10 bg-white/[0.035] px-4 text-sm font-semibold text-cyan-100/55 transition hover:bg-white/[0.06] hover:text-cyan-50"
              >
                <X size={16} />
                Clear
              </button>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-cyan-100/42">
            Discovery runs only when requested. Results are public geocoding candidates and must be reviewed before they are treated as confirmed company locations.
          </p>
          {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
          {notice && <p className="mt-3 text-sm text-emerald-200">{notice}</p>}
        </GlassCard>

        {!result && !loading && (
          <GlassCard className="p-10 text-center">
            <Globe2 className="mx-auto h-11 w-11 text-cyan-200/35" />
            <h2 className="mt-4 text-xl font-black text-white">Build a live company footprint</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-cyan-100/48">
              Enter a company name to discover location candidates from OpenStreetMap and Photon. Every mapped point exposes its address, source, confidence, review status, and public evidence link.
            </p>
          </GlassCard>
        )}

        {result && (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard icon={<MapPin size={17} />} label="Candidates" value={String(result.counts.candidates)} note="Public records returned" />
              <MetricCard icon={<MapPinned size={17} />} label="Mappable" value={String(mappableLocations.length)} note="Usable map coordinates" />
              <MetricCard icon={<Globe2 size={17} />} label="Countries" value={String(countryCount)} note="Unique countries represented" />
              <MetricCard icon={<ShieldCheck size={17} />} label="Confirmed" value={String(verifiedCount)} note="Human-reviewed locations" />
              <MetricCard icon={<AlertTriangle size={17} />} label="Review needed" value={String(result.counts.needsReview)} note="Low-confidence candidates" />
            </section>

            <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.6fr)_420px]">
              <GlassCard className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100/10 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/40">Interactive world map</p>
                    <h2 className="mt-1 text-lg font-black text-white">{result.entityName}</h2>
                  </div>
                  <p className="text-xs text-cyan-100/42">Click a marker for full location evidence</p>
                </div>
                <div className="h-[620px] min-h-[500px] bg-[#06101e]">
                  {mappableLocations.length > 0 ? (
                    <MapContainer center={[20, 0]} zoom={2} minZoom={2} className="h-full w-full" worldCopyJump>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <FitMapToLocations locations={mappableLocations} />
                      {mappableLocations.map((location) => {
                        const center = coordinatesFor(location);
                        if (!center) return null;
                        const active = location.id === selectedLocationId;
                        return (
                          <CircleMarker
                            key={location.id}
                            center={center}
                            radius={active ? 11 : 8}
                            pathOptions={{
                              color: location.reviewStatus === "verified" ? "#6ee7b7" : location.geocodeConfidence === "unknown" ? "#fbbf24" : "#67e8f9",
                              fillColor: location.reviewStatus === "verified" ? "#10b981" : location.geocodeConfidence === "unknown" ? "#f59e0b" : "#0891b2",
                              fillOpacity: active ? 0.9 : 0.72,
                              weight: active ? 3 : 2,
                            }}
                            eventHandlers={{ click: () => setSelectedLocationId(location.id) }}
                          >
                            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                              <strong>{location.placeName}</strong>
                              <br />
                              {location.city || location.state || location.country}
                            </Tooltip>
                          </CircleMarker>
                        );
                      })}
                    </MapContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center px-8 text-center">
                      <div>
                        <CircleOff className="mx-auto h-10 w-10 text-cyan-100/28" />
                        <p className="mt-3 text-sm font-semibold text-cyan-50">No mappable candidates returned</p>
                        <p className="mt-2 text-xs leading-5 text-cyan-100/40">The public sources did not return coordinates with sufficient confidence for this company name.</p>
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/40">Review queue</p>
                    <h2 className="mt-1 text-xl font-black text-white">Location candidates</h2>
                  </div>
                  <Layers3 size={20} className="text-cyan-200/35" />
                </div>

                <div className="mt-4 flex min-h-11 items-center gap-2 rounded-2xl border border-cyan-100/10 bg-black/20 px-3">
                  <Search size={15} className="text-cyan-100/35" />
                  <input
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    placeholder="Filter by city, country, address…"
                    className="min-w-0 flex-1 bg-transparent text-xs text-cyan-50 outline-none placeholder:text-cyan-100/25"
                  />
                </div>

                <div className="mt-4 max-h-[465px] space-y-2 overflow-y-auto pr-1">
                  {visibleLocations.length > 0 ? visibleLocations.map((location) => {
                    const active = location.id === selectedLocationId;
                    const checked = selectedIds.has(location.id);
                    return (
                      <div
                        key={location.id}
                        className={`rounded-2xl border p-3 transition ${active ? "border-cyan-200/28 bg-cyan-300/[0.08]" : "border-cyan-100/10 bg-white/[0.025] hover:bg-white/[0.045]"}`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelection(location.id)}
                            aria-label={`Confirm ${location.placeName}`}
                            className="mt-1 h-4 w-4 rounded border-cyan-100/20 bg-black/30"
                          />
                          <button type="button" onClick={() => setSelectedLocationId(location.id)} className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-bold text-white">{location.placeName}</p>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-cyan-100/44">{location.formattedAddress || [location.city, location.state, location.country].filter(Boolean).join(", ")}</p>
                            <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${confidenceClass(location)}`}>
                              {location.reviewStatus === "verified" ? "Confirmed" : confidenceLabel(location)}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="py-10 text-center text-xs text-cyan-100/38">No locations match this filter.</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void confirmSelectedLocations()}
                  disabled={verifying || selectedIds.size === 0}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/20 bg-emerald-300/10 px-4 text-sm font-bold text-emerald-100 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {verifying ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                  {verifying ? "Confirming locations…" : `Confirm selected (${selectedIds.size})`}
                </button>
              </GlassCard>
            </section>

            <GlassCard className="p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-sm font-bold text-amber-100">Human review is required</p>
                  <p className="mt-1 text-xs leading-5 text-amber-100/60">{result.warning}</p>
                </div>
              </div>
            </GlassCard>
          </div>
        )}
      </section>

      {selectedLocation && (
        <LocationEvidenceDrawer
          location={selectedLocation}
          researchSources={result?.researchSources ?? []}
          checked={selectedIds.has(selectedLocation.id)}
          onToggle={() => toggleSelection(selectedLocation.id)}
          onClose={() => setSelectedLocationId(null)}
        />
      )}
    </main>
  );
}

function MetricCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between gap-3 text-cyan-100/42">
        {icon}
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-cyan-100/38">{note}</p>
    </GlassCard>
  );
}

function LocationEvidenceDrawer({
  location,
  researchSources,
  checked,
  onToggle,
  onClose,
}: {
  location: GeographicLocation;
  researchSources: GeographicResearchSource[];
  checked: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const coordinates = coordinatesFor(location);

  return (
    <>
      <button type="button" aria-label="Close location details" onClick={onClose} className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-cyan-100/14 bg-[#030813]/96 p-6 shadow-[-30px_0_90px_rgba(0,0,0,.52)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/40">Location evidence</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{location.placeName}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-cyan-100/10 bg-white/[0.04] p-2 text-cyan-100/50 transition hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-cyan-100/58">{location.formattedAddress || [location.city, location.state, location.country].filter(Boolean).join(", ")}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <EvidenceField label="Country" value={location.country} />
          <EvidenceField label="Region" value={location.region || location.state || "Unknown"} />
          <EvidenceField label="Facility type" value={location.facilityType || location.sourceType || "Unclassified"} />
          <EvidenceField label="Activity" value={location.activity || "Not established"} />
          <EvidenceField label="Confidence" value={confidenceLabel(location)} />
          <EvidenceField label="Review status" value={location.reviewStatus.replace("-", " ")} />
          <EvidenceField label="Source" value={location.geocodeSource} />
          <EvidenceField label="Source class" value={location.sourceClass || "Unknown"} />
        </div>

        {coordinates && (
          <div className="mt-4 rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/38">Coordinates</p>
            <p className="mt-2 font-mono text-xs text-cyan-50">{coordinates[0].toFixed(6)}, {coordinates[1].toFixed(6)}</p>
          </div>
        )}

        {location.notes && (
          <div className="mt-4 rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/38">Notes</p>
            <p className="mt-2 text-xs leading-5 text-cyan-100/55">{location.notes}</p>
          </div>
        )}

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition ${checked ? "border-emerald-200/24 bg-emerald-300/12 text-emerald-100" : "border-cyan-200/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/16"}`}
          >
            {checked ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
            {checked ? "Selected for confirmation" : "Select for confirmation"}
          </button>
          <a
            href={evidenceUrl(location)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/12 bg-white/[0.035] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-white/[0.06]"
          >
            <ExternalLink size={16} />
            Open public map evidence
          </a>
        </div>

        {researchSources.length > 0 && (
          <section className="mt-7 border-t border-cyan-100/10 pt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/40">Additional verification paths</p>
            <div className="mt-3 space-y-2">
              {researchSources.map((source) => <ResearchSourceLink key={`${source.type}-${source.url}`} source={source} />)}
            </div>
          </section>
        )}
      </aside>
    </>
  );
}

function EvidenceField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-100/35">{label}</p>
      <p className="mt-2 text-xs font-semibold capitalize text-cyan-50">{value}</p>
    </div>
  );
}

function ResearchSourceLink({ source }: { source: GeographicResearchSource }) {
  return (
    <a href={source.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-cyan-100/10 bg-white/[0.025] p-3 transition hover:border-cyan-100/20 hover:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-cyan-50">{source.label}</p>
        <ExternalLink size={14} className="shrink-0 text-cyan-100/35" />
      </div>
      <p className="mt-1 text-[10px] leading-4 text-cyan-100/40">{source.note}</p>
    </a>
  );
}
