import { useMemo, useState, useEffect } from "react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { FilterPills } from "@/components/insight/FilterPills";
import { MapPanel } from "@/components/insight/MapPanel";
import { SidePanel } from "@/components/insight/SidePanel";
import { MetricCard } from "@/components/insight/MetricCard";
import { GlassCard } from "@/components/insight/GlassCard";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import type { LocationRecord } from "@/data/types";

type DataSource = "workbook" | "database";

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

export default function GeographicData() {
  const { dataset } = useInsightData();
  const [dataSource, setDataSource] = useState<DataSource>("workbook");
  const [verifiedEntities, setVerifiedEntities] = useState<VerifiedEntity[]>([]);
  const [loadingDatabase, setLoadingDatabase] = useState(false);

  // Load verified entities from database
  useEffect(() => {
    if (dataSource === "database") {
      setLoadingDatabase(true);
      fetch("/api/entities/verified")
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) {
            setVerifiedEntities(data.entities);
          }
        })
        .catch((error) => console.error("Failed to load verified entities:", error))
        .finally(() => setLoadingDatabase(false));
    }
  }, [dataSource]);

  // Workbook data
  const companyIdsWithLocations = new Set(
    dataset.locations.map((location) => location.companyId)
  );
  const geographicCompanies = dataset.companies
    .filter((company) => companyIdsWithLocations.has(company.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Database entities transformed to company format
  const databaseCompanies = verifiedEntities.map((entity) => ({
    id: String(entity.id),
    name: entity.name,
    shortName: entity.name,
    sector: "Unknown" as const,
    headquarters: "Unknown" as const,
    employees: 0,
    employeesAsOf: "" as const,
    revenue: 0,
    revenueAsOf: "" as const,
    summary: "" as const,
    tags: [] as string[],
  }));

  // Combine based on data source
  const allCompanies = dataSource === "workbook" ? geographicCompanies : databaseCompanies;
  const { companyId, setCompanyId, company } = useSelectedCompany(allCompanies);

  const [country, setCountry] = useState("All");
  const [region, setRegion] = useState("All");
  const [facility, setFacility] = useState("All");
  const [activity, setActivity] = useState("All");
  const [selected, setSelected] = useState<LocationRecord | undefined>();

  // Get locations based on data source
  const companyLocations = useMemo(() => {
    if (dataSource === "workbook") {
      return dataset.locations.filter((location) => location.companyId === companyId);
    } else {
      const entity = verifiedEntities.find((e) => String(e.id) === companyId);
      if (!entity) return [];
      return entity.locations.map((loc, index) => ({
        id: String(loc.id),
        companyId: String(entity.id),
        company: entity.company,
        city: loc.city || loc.placeName,
        state: loc.state ?? undefined,
        country: loc.country,
        region: loc.region,
        facilityType: loc.facilityType || "Unknown",
        activity: loc.activity || "Unknown",
        notes: loc.notes || "",
        coordinates: loc.coordinates,
        placeName: loc.placeName,
        formattedAddress: loc.formattedAddress ?? undefined,
        addressLine1: loc.addressLine1 ?? undefined,
        addressLine2: loc.addressLine2 ?? undefined,
        postalCode: loc.postalCode ?? undefined,
        geocodeSource: loc.geocodeSource as LocationRecord["geocodeSource"],
        geocodeConfidence: loc.geocodeConfidence as LocationRecord["geocodeConfidence"],
      }));
    }
  }, [dataSource, companyId, dataset.locations, verifiedEntities]);

  const countryOptions = useMemo(() => ["All", ...Array.from(new Set(companyLocations.map((location) => location.country))).slice(0, 12)], [companyLocations]);
  const regionOptions = useMemo(() => ["All", ...Array.from(new Set(companyLocations.map((location) => location.region))).slice(0, 12)], [companyLocations]);
  const facilityOptions = useMemo(() => ["All", ...Array.from(new Set(companyLocations.map((location) => location.facilityType))).slice(0, 8)], [companyLocations]);
  const activityOptions = useMemo(() => ["All", ...Array.from(new Set(companyLocations.map((location) => location.activity))).slice(0, 8)], [companyLocations]);

  const filtered = companyLocations.filter((location) => (country === "All" || location.country === country) && (region === "All" || location.region === region) && (facility === "All" || location.facilityType === facility) && (activity === "All" || location.activity === activity));
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
          subtitle="A reusable geographic intelligence map that parses workbook location presence into filterable company, country, region, facility, and activity records."
          actions={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-cyan-100/15 bg-[#07111d] px-3 py-1.5">
                <button
                  onClick={() => { setDataSource("workbook"); setCompanyId(""); setSelected(undefined); }}
                  className={`text-xs font-medium transition ${dataSource === "workbook" ? "text-cyan-50" : "text-cyan-100/50 hover:text-cyan-50"}`}
                >
                  Workbook
                </button>
                <span className="text-cyan-100/30">|</span>
                <button
                  onClick={() => { setDataSource("database"); setCompanyId(""); setSelected(undefined); }}
                  className={`text-xs font-medium transition ${dataSource === "database" ? "text-cyan-50" : "text-cyan-100/50 hover:text-cyan-50"}`}
                >
                  Database
                </button>
              </div>
              <select
                value={companyId}
                onChange={(event) => { setCompanyId(event.target.value); setSelected(undefined); }}
                disabled={dataSource === "database" && loadingDatabase}
                className="rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-sm text-cyan-50 outline-none disabled:opacity-50"
              >
                <option value="">Select company</option>
                {allCompanies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          }
        />
        <div className="grid gap-4 md:grid-cols-3">{geoMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>
        <GlassCard className="mt-5 p-5">
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
            <h2 className="mt-2 text-2xl font-black text-white">{company?.shortName} footprint</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-100/55">
              {dataSource === "workbook"
                ? "Workbook rows are normalized as reusable location objects. Clicking a row or map marker opens detail inside this register."
                : "Verified database locations from entity discovery. Clicking a row or map marker opens detail inside this register."
              }
            </p>
            <div className="mt-5 max-h-[620px] overflow-auto pr-1">
              <SidePanel location={selected} onClose={() => setSelected(undefined)} />
              <div className="space-y-2">
                {loadingDatabase ? (
                  <p className="text-center text-sm text-cyan-100/50">Loading...</p>
                ) : filtered.slice(0, 42).map((location) => (
                  <button
                    key={location.id}
                    onClick={() => setSelected(location)}
                    className="w-full rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.06]"
                  >
                    <p className="font-semibold text-cyan-50">{location.city}</p>
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
