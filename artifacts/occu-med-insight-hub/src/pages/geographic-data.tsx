import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, WifiOff } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
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

function companyNameKey(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(the)\b/g, "")
    .replace(/\b(incorporated|corporation|corp|company|co|inc|llc|ltd|plc|ag|sa|group|services|service)\b/g, "")
    .replace(/\bverified\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

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

  const verifiedCompanyKeys = useMemo(() => new Set(databaseCompanies.map((company) => companyNameKey(company.name))), [databaseCompanies]);
  const workbookFallbackCompanies = useMemo(() => workbookCompanies.filter((company) => !verifiedCompanyKeys.has(companyNameKey(company.name))), [workbookCompanies, verifiedCompanyKeys]);
  const companies = useMemo(() => [...databaseCompanies, ...workbookFallbackCompanies], [databaseCompanies, workbookFallbackCompanies]);
  const { companyId, setCompanyId, company } = useSelectedCompany(companies);

  const locations = useMemo(() => {
    if (isDatabaseCompanyId(companyId)) {
      const entityId = Number(companyId.replace("db-", ""));
      const entity = verifiedEntities.find((item) => item.id === entityId);
      return entity ? entity.locations.map((loc) => toLocationRecord(entity, loc)) : [];
    }
    return dataset.locations.filter((location) => location.companyId === companyId);
  }, [companyId, dataset.locations, verifiedEntities]);

  const resetCompany = (nextCompanyId: string) => {
    setCompanyId(nextCompanyId);
    setSelected(undefined);
  };

  const countryCount = new Set(locations.map((location) => location.country)).size;
  const regionCount = new Set(locations.map((location) => location.region)).size;

  const geoMetrics = [
    { id: "geo-sites", companyId, label: "Locations", value: locations.length, unit: "count" as const, category: "risk" as const, trend: 8.2 },
    { id: "geo-countries", companyId, label: "Countries", value: countryCount, unit: "count" as const, category: "risk" as const, trend: 4.1 },
    { id: "geo-regions", companyId, label: "Regions", value: regionCount, unit: "count" as const, category: "workforce" as const, trend: 3.6 },
  ];

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-7 lg:ml-[210px] lg:px-10 xl:px-12">
        <HeaderBar
          eyebrow="Portal 03"
          title="Geographic Data"
          subtitle="Verified/imported location data is prioritized. Workbook data is used only when no verified version exists."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/entity-discovery" className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/5 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.08]">
                <Plus size={14} />
                Add Entity
              </Link>
              <select value={companyId} onChange={(event) => resetCompany(event.target.value)} className="rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-sm text-cyan-50 outline-none">
                <option value="">Select company</option>
                {databaseCompanies.length > 0 ? (
                  <optgroup label="Verified imported locations">
                    {databaseCompanies.map((item) => <option key={item.id} value={item.id}>{item.name} · Verified</option>)}
                  </optgroup>
                ) : null}
                {workbookFallbackCompanies.length > 0 ? (
                  <optgroup label="Workbook fallback">
                    {workbookFallbackCompanies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </optgroup>
                ) : null}
              </select>
            </div>
          }
        />
        {dbStatus === "unavailable" ? (
          <GlassCard className="mb-4 border border-amber-200/20 p-4">
            <div className="flex items-start gap-3 text-amber-100"><WifiOff size={18} className="mt-0.5" /><div><p className="font-semibold">Verified entity database unavailable</p><p className="mt-1 text-sm text-cyan-100/60">Workbook data is still available. Added entities will reappear when the database/API is reachable.</p></div></div>
          </GlassCard>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">{geoMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_360px] xl:grid-cols-[minmax(0,1.6fr)_390px]">
          <MapPanel locations={locations} onSelect={setSelected} />
          <GlassCard className="self-start p-5 lg:sticky lg:top-6">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Location register</p>
            <h2 className="mt-2 text-2xl font-black text-white">{company?.shortName ? `${company.shortName} footprint` : "Select a company"}</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-100/55">Click a row or map marker to open detail inside this register.</p>
            <div className="mt-4 max-h-[520px] overflow-auto pr-1">
              <SidePanel location={selected} onClose={() => setSelected(undefined)} />
              <div className="space-y-2">
                {locations.length === 0 ? (
                  <p className="rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4 text-sm text-cyan-100/50">No locations to display for the selected company.</p>
                ) : locations.slice(0, 42).map((location) => (
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
