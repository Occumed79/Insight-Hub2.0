import { useEffect, useMemo, useState } from "react";
import { Database, MapPin, Radar, WifiOff } from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { MapPanel } from "@/components/insight/MapPanel";
import { SidePanel } from "@/components/insight/SidePanel";
import { MetricCard } from "@/components/insight/MetricCard";
import { GlassCard } from "@/components/insight/GlassCard";
import { CinematicPortalHero, CinematicSection, SpatialAperture } from "@/components/insight/CinematicPortal";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import type { Company, LocationRecord } from "@/data/types";

type VerifiedEntity = {
  id: number;
  name: string;
  company: string;
  locations: Array<{
    id: number;
    placeName: string;
    city: string | null;
    country: string;
    region: string;
    coordinates: [number, number];
    geocodeConfidence: string;
    geocodeSource: string;
    facilityType: string | null;
    activity: string | null;
    notes: string | null;
    formattedAddress: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    state: string | null;
    postalCode: string | null;
  }>;
};

type DbStatus = "checking" | "available" | "unavailable";

const databaseCompanyId = (id: number) => `db-${id}`;
const isDatabaseCompanyId = (id: string) => id.startsWith("db-");

function toLocationRecord(entity: VerifiedEntity, loc: VerifiedEntity["locations"][number]): LocationRecord {
  return {
    id: `db-location-${loc.id}`,
    companyId: databaseCompanyId(entity.id),
    company: entity.company || entity.name,
    city: loc.city || loc.placeName,
    state: loc.state ?? undefined,
    country: loc.country,
    region: loc.region,
    facilityType: loc.facilityType || "Verified location",
    activity: loc.activity || "Entity discovery",
    notes: loc.notes || "Verified through entity discovery.",
    coordinates: loc.coordinates,
    placeName: loc.placeName,
    formattedAddress: loc.formattedAddress ?? undefined,
    addressLine1: loc.addressLine1 ?? undefined,
    addressLine2: loc.addressLine2 ?? undefined,
    postalCode: loc.postalCode ?? undefined,
    geocodeSource: loc.geocodeSource as LocationRecord["geocodeSource"],
    geocodeConfidence: loc.geocodeConfidence as LocationRecord["geocodeConfidence"],
  };
}

export default function GeographicData() {
  const { dataset } = useInsightData();
  const [verifiedEntities, setVerifiedEntities] = useState<VerifiedEntity[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>("checking");
  const [selected, setSelected] = useState<LocationRecord | undefined>();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/entities/health")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Entity database unavailable")))
      .then(() => { if (!cancelled) setDbStatus("available"); })
      .catch(() => { if (!cancelled) setDbStatus("unavailable"); });

    fetch("/api/entities/verified")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Verified entity endpoint unavailable")))
      .then((payload) => {
        if (!cancelled && payload?.ok && Array.isArray(payload.entities)) setVerifiedEntities(payload.entities);
      })
      .catch(() => {
        if (!cancelled) {
          setVerifiedEntities([]);
          setDbStatus("unavailable");
        }
      });

    return () => { cancelled = true; };
  }, []);

  const workbookCompanies = useMemo(() => {
    const companyIdsWithLocations = new Set(dataset.locations.map((location) => location.companyId));
    return dataset.companies.filter((company) => companyIdsWithLocations.has(company.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [dataset.companies, dataset.locations]);

  const databaseCompanies = useMemo<Company[]>(() => verifiedEntities.map((entity) => ({
    id: databaseCompanyId(entity.id),
    name: entity.name,
    shortName: entity.name,
    sector: "Verified entity",
    headquarters: "Reviewed entity discovery",
    employees: 0,
    employeesAsOf: "Verified database",
    summary: "Verified entity locations from the discovery workflow.",
    tags: ["Verified DB"],
  })).sort((a, b) => a.name.localeCompare(b.name)), [verifiedEntities]);

  const hasVerifiedImports = databaseCompanies.length > 0;
  const workbookFallbackCompanies = useMemo(() => hasVerifiedImports ? [] : workbookCompanies, [workbookCompanies, hasVerifiedImports]);
  const companies = useMemo(() => hasVerifiedImports ? databaseCompanies : workbookCompanies, [hasVerifiedImports, databaseCompanies, workbookCompanies]);
  const { companyId, setCompanyId, company } = useSelectedCompany(companies);

  const locations = useMemo(() => {
    if (isDatabaseCompanyId(companyId)) {
      const entityId = Number(companyId.replace("db-", ""));
      const entity = verifiedEntities.find((item) => item.id === entityId);
      return entity ? entity.locations.map((loc) => toLocationRecord(entity, loc)) : [];
    }
    return hasVerifiedImports ? [] : dataset.locations.filter((location) => location.companyId === companyId);
  }, [companyId, dataset.locations, verifiedEntities, hasVerifiedImports]);

  const resetCompany = (nextCompanyId: string) => {
    setCompanyId(nextCompanyId);
    setSelected(undefined);
  };

  const countryCount = new Set(locations.map((location) => location.country)).size;
  const regionCount = new Set(locations.map((location) => location.region)).size;
  const geocodedCount = locations.filter((location) => Number.isFinite(location.coordinates?.[0]) && Number.isFinite(location.coordinates?.[1])).length;
  const geoMetrics = [
    { id: "geo-sites", companyId, label: "Locations", value: locations.length, unit: "count" as const, category: "risk" as const },
    { id: "geo-countries", companyId, label: "Countries", value: countryCount, unit: "count" as const, category: "risk" as const },
    { id: "geo-regions", companyId, label: "Regions", value: regionCount, unit: "count" as const, category: "workforce" as const },
  ];

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-4 py-6 lg:ml-[210px] lg:px-8 xl:px-10">
        <CinematicPortalHero
          eyebrow="Portal 03 · Spatial intelligence"
          title="Turn the footprint into a field of view."
          subtitle={hasVerifiedImports ? "The workspace is using imported, verified company-location records only. Every point remains connected to its address, facility type, activity, notes, and geocoding provenance." : "The verified entity database is empty, so the same spatial experience is using workbook locations as a clearly labeled fallback."}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <select value={companyId} onChange={(event) => resetCompany(event.target.value)} className="rounded-full border border-violet-100/18 bg-[#070512]/86 px-4 py-2.5 text-sm text-violet-50 outline-none backdrop-blur-xl transition focus:border-violet-200/40">
                <option value="">Select company</option>
                {hasVerifiedImports ? (
                  <optgroup label="Imported company-location file">{databaseCompanies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
                ) : (
                  <optgroup label="Workbook fallback">{workbookFallbackCompanies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
                )}
              </select>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[.16em] ${dbStatus === "available" ? "border-emerald-200/16 bg-emerald-200/[0.055] text-emerald-100/68" : dbStatus === "unavailable" ? "border-amber-200/16 bg-amber-200/[0.055] text-amber-100/68" : "border-violet-100/14 bg-violet-100/[0.04] text-violet-100/55"}`}><Database className="h-3.5 w-3.5" />{dbStatus === "checking" ? "Checking source" : dbStatus === "available" ? "Verified DB online" : "Workbook fallback"}</span>
            </div>
          }
          stats={[
            { label: "Locations", value: locations.length, note: hasVerifiedImports ? "Verified imports" : "Workbook fallback" },
            { label: "Countries", value: countryCount, note: "Distinct countries" },
            { label: "Regions", value: regionCount, note: "Distinct operating regions" },
            { label: "Mapped points", value: geocodedCount, note: "Finite coordinates" },
          ]}
          visual={<SpatialAperture locations={locations} centerLabel={company?.shortName || "Select company"} />}
        />

        {dbStatus === "unavailable" ? (
          <GlassCard className="mb-4 border border-amber-200/20 p-4">
            <div className="flex items-start gap-3 text-amber-100"><WifiOff size={18} className="mt-0.5" /><div><p className="font-semibold">Verified entity database unavailable</p><p className="mt-1 text-sm text-slate-200/52">Workbook data remains available. Added entities will reappear when the database/API is reachable.</p></div></div>
          </GlassCard>
        ) : null}

        <CinematicSection
          index="01"
          eyebrow="Footprint overview"
          title="The operating scale, before the map."
          description="Counts are kept deliberately simple and source-backed. Unsupported growth percentages have been removed; the page now reports only the locations, countries, regions, and usable coordinates actually present."
          compact
        >
          <div className="grid gap-4 md:grid-cols-3">{geoMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>
        </CinematicSection>

        <CinematicSection
          index="02"
          eyebrow="Interactive map stage"
          title="Navigate the footprint at full scale."
          description="The map is the primary visual surface. Selecting a marker or register item opens its exact address and operating context without leaving the spatial scene."
        >
          <div className="overflow-hidden rounded-[34px] border border-violet-100/14 bg-[linear-gradient(145deg,rgba(10,7,24,.72),rgba(3,3,12,.7))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.09),0_38px_110px_rgba(0,0,0,.42)]">
            <MapPanel locations={locations} onSelect={setSelected} />
          </div>
        </CinematicSection>

        <CinematicSection
          index="03"
          eyebrow="Location register"
          title="Every point has an operational story."
          description="Facility type, region, activity, notes, address, and geocoding evidence remain available in a premium register designed for focused review rather than a crowded sidebar."
          compact
        >
          <GlassCard className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-violet-100/14 bg-violet-200/8 text-violet-100"><Radar className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-violet-200/45">Spatial register</p><h2 className="mt-1 text-2xl font-black tracking-[-.04em] text-white">{company?.shortName ? `${company.shortName} footprint` : "Select a company"}</h2></div></div>
              <span className="rounded-full border border-violet-100/12 bg-violet-100/[0.04] px-3 py-1.5 font-mono text-[10px] text-violet-100/55">{locations.length} records</span>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
              <div className="max-h-[640px] space-y-2 overflow-auto pr-1">
                {locations.length === 0 ? (
                  <p className="rounded-[22px] border border-violet-100/10 bg-white/[0.028] p-5 text-sm text-slate-200/48">No locations to display for the selected company.</p>
                ) : locations.slice(0, 60).map((location, index) => (
                  <button key={location.id} onClick={() => setSelected(location)} className={`group w-full rounded-[22px] border p-4 text-left transition duration-500 hover:-translate-y-0.5 hover:border-violet-100/24 hover:bg-violet-100/[0.05] ${selected?.id === location.id ? "border-violet-200/28 bg-violet-200/[0.075] shadow-[0_0_30px_rgba(139,92,246,.09)]" : "border-violet-100/9 bg-white/[0.025]"}`}>
                    <div className="flex items-start gap-3"><span className="mt-0.5 font-mono text-[9px] text-violet-100/34">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-50">{location.placeName || location.city}</p><p className="mt-1 text-[10px] uppercase tracking-[.14em] text-violet-100/38">{location.country} · {location.region}</p><p className="mt-3 text-xs leading-5 text-slate-200/48">{location.facilityType}</p></div><MapPin className="h-4 w-4 text-violet-100/28 transition group-hover:text-violet-100" /></div>
                  </button>
                ))}
              </div>
              <div className="min-h-[420px] rounded-[28px] border border-violet-100/10 bg-[#03020a]/55 p-4 md:p-5">
                <SidePanel location={selected} onClose={() => setSelected(undefined)} />
                {!selected ? <div className="grid min-h-[360px] place-items-center text-center"><div><MapPin className="mx-auto h-8 w-8 text-violet-100/22" /><p className="mt-4 text-sm font-semibold text-slate-100/70">Select a location</p><p className="mx-auto mt-2 max-w-[320px] text-xs leading-6 text-slate-200/38">Choose a record or map marker to reveal address, activity, notes, facility type, and geocoding provenance.</p></div></div> : null}
              </div>
            </div>
          </GlassCard>
        </CinematicSection>
      </section>
    </main>
  );
}
