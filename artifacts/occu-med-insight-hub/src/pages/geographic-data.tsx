import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Search, WifiOff } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { FilterPills } from "@/components/insight/FilterPills";
import { MapPanel } from "@/components/insight/MapPanel";
import { SidePanel } from "@/components/insight/SidePanel";
import { MetricCard } from "@/components/insight/MetricCard";
import { GlassCard } from "@/components/insight/GlassCard";
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

function locationMatchesSearch(location: LocationRecord, search: string) {
  if (!search.trim()) return true;
  const haystack = [location.placeName, location.city, location.state, location.country, location.region, location.facilityType, location.activity, location.formattedAddress, location.addressLine1, location.notes].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(search.toLowerCase().trim());
}

export default function GeographicData() {
  const { dataset } = useInsightData();
  const [verifiedEntities, setVerifiedEntities] = useState<VerifiedEntity[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>("checking");
  const [selected, setSelected] = useState<LocationRecord | undefined>();
  const [country, setCountry] = useState("All");
  const [region, setRegion] = useState("All");
  const [facility, setFacility] = useState("All");
  const [activity, setActivity] = useState("All");
  const [locationSearch, setLocationSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/entities/health")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Entity database unavailable")))
      .then(() => {
        if (!cancelled) setDbStatus("available");
      })
      .catch(() => {
        if (!cancelled) setDbStatus("unavailable");
      });

    fetch("/api/entities/verified")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Verified entity endpoint unavailable")))
      .then((payload) => {
        if (!cancelled && payload?.ok && Array.isArray(payload.entities)) {
          setVerifiedEntities(payload.entities);
        }
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
  })), [verifiedEntities]);

  const companies = useMemo(() => [...workbookCompanies, ...databaseCompanies], [workbookCompanies, databaseCompanies]);
  const { companyId, setCompanyId, company } = useSelectedCompany(companies);

  const companyLocations = useMemo(() => {
    if (isDatabaseCompanyId(companyId)) {
      const entityId = Number(companyId.replace("db-", ""));
      const entity = verifiedEntities.find((item) => item.id === entityId);
      return entity ? entity.locations.map((loc) => toLocationRecord(entity, loc)) : [];
    }
    return dataset.locations.filter((location) => location.companyId === companyId);
  }, [companyId, dataset.locations, verifiedEntities]);

  const resetFiltersForCompany = (nextCompanyId: string) => {
    setCompanyId(nextCompanyId);
    setSelected(undefined);
    setCountry("All");
    setRegion("All");
    setFacility("All");
    setActivity("All");
    setLocationSearch("");
  };

  const countryOptions = useMemo(() => ["All", ...Array.from(new Set(companyLocations.map((location) => location.country))).slice(0, 12)], [companyLocations]);
  const regionOptions = useMemo(() => ["All", ...Array.from(new Set(companyLocations.map((location) => location.region))).slice(0, 12)], [companyLocations]);
  const facilityOptions = useMemo(() => ["All", ...Array.from(new Set(companyLocations.map((location) => location.facilityType))).slice(0, 8)], [companyLocations]);
  const activityOptions = useMemo(() => ["All", ...Array.from(new Set(companyLocations.map((location) => location.activity))).slice(0, 8)], [companyLocations]);

  const filtered = companyLocations.filter((location) => (country === "All" || location.country === country) && (region === "All" || location.region === region) && (facility === "All" || location.facilityType === facility) && (activity === "All" || location.activity === activity) && locationMatchesSearch(location, locationSearch));
  const countries = new Set(filtered.map((location) => location.country)).size;

  const geoMetrics = [
    { id: "geo-sites", companyId, label: "Filtered locations", value: filtered.length, unit: "count" as const, category: "risk" as const, trend: 8.2 },
    { id: "geo-countries", companyId, label: "Countries", value: countries, unit: "count" as const, category: "risk" as const, trend: 4.1 },
    { id: "geo-regions", companyId, label: "Regions", value: new Set(filtered.map((location) => location.region)).size, unit: "count" as const, category: "workforce" as const, trend: 3.6 },
  ];

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Portal 03"
          title="Geographic Data"
          subtitle="A reusable geographic intelligence map that parses verified and workbook location records into filterable company, country, region, facility, and activity records."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/entity-discovery" className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/5 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.08]">
                <Plus size={14} />
                Add Entity
              </Link>
              <select value={companyId} onChange={(event) => resetFiltersForCompany(event.target.value)} className="rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-sm text-cyan-50 outline-none">
                <option value="">Select company</option>
                {companies.map((item) => <option key={item.id} value={item.id}>{item.name}{item.tags?.includes("Verified DB") ? " · Verified" : ""}</option>)}
              </select>
            </div>
          }
        />
        {dbStatus === "unavailable" ? (
          <GlassCard className="mb-5 border border-amber-200/20 p-4">
            <div className="flex items-start gap-3 text-amber-100"><WifiOff size={18} className="mt-0.5" /><div><p className="font-semibold">Verified entity database unavailable</p><p className="mt-1 text-sm text-cyan-100/60">Workbook data is still available. Added entities will reappear when the database/API is reachable.</p></div></div>
          </GlassCard>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">{geoMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>
        <GlassCard className="mt-5 p-5">
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-cyan-100/10 bg-white/[0.03] px-4 py-3">
            <Search size={15} className="text-cyan-100/45" />
            <input value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} placeholder="Search locations, address, country, activity..." className="w-full bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35" />
          </div>
          <div className="grid gap-5 xl:grid-cols-4">
            <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-100/38">Country</p><FilterPills options={countryOptions as string[]} value={country} onChange={setCountry} /></div>
            <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-100/38">Region</p><FilterPills options={regionOptions as string[]} value={region} onChange={setRegion} /></div>
            <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-100/38">Facility</p><FilterPills options={facilityOptions as string[]} value={facility} onChange={setFacility} /></div>
            <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-100/38">Activity</p><FilterPills options={activityOptions as string[]} value={activity} onChange={setActivity} /></div>
          </div>
        </GlassCard>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
          <MapPanel locations={filtered} onSelect={setSelected} />
          <GlassCard className="p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Location register</p>
            <h2 className="mt-2 text-2xl font-black text-white">{company?.shortName ? `${company.shortName} footprint` : "Select a company"}</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-100/55">Click a row or map marker to open detail inside this register.</p>
            <div className="mt-5 max-h-[620px] overflow-auto pr-1">
              <SidePanel location={selected} onClose={() => setSelected(undefined)} />
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <p className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4 text-sm text-cyan-100/50">No locations to display for the selected company and filters.</p>
                ) : filtered.slice(0, 42).map((location) => (
                  <button key={location.id} onClick={() => setSelected(location)} className="w-full rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.06]">
                    <p className="font-semibold text-cyan-50">{location.placeName || location.city}</p>
                    <p className="mt-1 text-xs text-cyan-100/48">{location.country} · {location.region}</p>
                    <p className="mt-2 text-xs leading-5 text-cyan-100/55">{location.facilityType}</p>
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
    </main>
  );
}
