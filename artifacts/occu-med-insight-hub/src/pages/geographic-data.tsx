import { useMemo, useState } from "react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { FilterPills } from "@/components/insight/FilterPills";
import { MapPanel } from "@/components/insight/MapPanel";
import { SidePanel } from "@/components/insight/SidePanel";
import { MetricCard } from "@/components/insight/MetricCard";
import { GlassCard } from "@/components/insight/GlassCard";
import { useInsightData, useSelectedCompany } from "@/data/useInsightData";
import type { LocationRecord } from "@/data/types";

export default function GeographicData() {
  const { dataset } = useInsightData();
  const { companyId, setCompanyId, company } = useSelectedCompany(dataset.companies);
  const [country, setCountry] = useState("All");
  const [region, setRegion] = useState("All");
  const [facility, setFacility] = useState("All");
  const [activity, setActivity] = useState("All");
  const [selected, setSelected] = useState<LocationRecord | undefined>();
  const companyLocations = dataset.locations.filter((location) => location.companyId === companyId || companyId === "v2x");
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
        <HeaderBar eyebrow="Portal 03" title="Geographic Data" subtitle="A reusable geographic intelligence map that parses workbook location presence into filterable company, country, region, facility, and activity records." actions={<select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="rounded-full border border-cyan-100/15 bg-[#07111d] px-4 py-2 text-sm text-cyan-50 outline-none">{dataset.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>} />
        <div className="grid gap-4 md:grid-cols-3">{geoMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>
        <GlassCard className="mt-5 p-5">
          <div className="grid gap-5 xl:grid-cols-4">
            <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-100/38">Country</p><FilterPills options={countryOptions as string[]} value={country} onChange={setCountry} /></div>
            <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-100/38">Region</p><FilterPills options={regionOptions as string[]} value={region} onChange={setRegion} /></div>
            <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-100/38">Facility</p><FilterPills options={facilityOptions as string[]} value={facility} onChange={setFacility} /></div>
            <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-100/38">Activity</p><FilterPills options={activityOptions as string[]} value={activity} onChange={setActivity} /></div>
          </div>
        </GlassCard>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
          <MapPanel locations={filtered} onSelect={setSelected} />
          <GlassCard className="p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Location register</p>
            <h2 className="mt-2 text-2xl font-black text-white">{company?.shortName} footprint</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-100/55">Workbook rows are normalized as reusable location objects. Clicking a row or map marker opens the same side-panel detail model.</p>
            <div className="mt-5 max-h-[520px] space-y-2 overflow-auto pr-1">
              {filtered.slice(0, 42).map((location) => <button key={location.id} onClick={() => setSelected(location)} className="w-full rounded-2xl border border-cyan-100/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.06]"><p className="font-semibold text-cyan-50">{location.city}</p><p className="mt-1 text-xs text-cyan-100/48">{location.country} · {location.region}</p><p className="mt-2 text-xs leading-5 text-cyan-100/55">{location.facilityType}</p></button>)}
            </div>
          </GlassCard>
        </div>
      </section>
      <SidePanel location={selected} onClose={() => setSelected(undefined)} />
    </main>
  );
}
