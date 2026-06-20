import { useState } from "react";
import { Search, MapPin, AlertTriangle, ExternalLink } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

type DiscoveredLocation = {
  id: string;
  companyName: string;
  placeName: string;
  formattedAddress: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  coordinates: [number, number];
  geocodeSource: "osm";
  geocodeConfidence: "exact" | "place" | "city" | "unknown";
  sourceType: string;
  sourceClass: string;
  sourceId: string;
  reviewStatus: "candidate" | "needs-review";
};

type DiscoveryResponse = {
  ok: boolean;
  entityName?: string;
  source?: string;
  generatedAt?: string;
  counts?: { candidates: number; mappable: number; needsReview: number };
  locations?: DiscoveredLocation[];
  warning?: string;
  error?: string;
};

function mapLink(location: DiscoveredLocation) {
  const [lng, lat] = location.coordinates;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function confidenceClass(confidence: DiscoveredLocation["geocodeConfidence"]) {
  if (confidence === "exact" || confidence === "place") return "border-emerald-200/20 bg-emerald-200/10 text-emerald-100";
  if (confidence === "city") return "border-cyan-200/20 bg-cyan-200/10 text-cyan-100";
  return "border-amber-200/20 bg-amber-200/10 text-amber-100";
}

export default function EntityDiscovery() {
  const [entityName, setEntityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscoveryResponse | undefined>();

  async function runDiscovery() {
    const cleanName = entityName.trim();
    if (!cleanName) return;
    setLoading(true);
    setResult(undefined);
    try {
      const response = await fetch("/api/entity-discovery/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName: cleanName }),
      });
      const payload = (await response.json()) as DiscoveryResponse;
      setResult(payload);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Discovery failed" });
    } finally {
      setLoading(false);
    }
  }

  const locations = result?.locations ?? [];
  const mappable = locations.filter((location) => ["exact", "place", "city"].includes(location.geocodeConfidence));
  const unresolved = locations.filter((location) => !["exact", "place", "city"].includes(location.geocodeConfidence));

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar eyebrow="Portal 04" title="Entity Discovery" subtitle="Add a company name and automatically generate public location candidates with source and confidence labels. Candidate locations must be verified before they become operational map pins." />

        <GlassCard className="p-6">
          <p className="text-xs uppercase tracking-[0.26em] text-emerald-200/60">Add entity</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              value={entityName}
              onChange={(event) => setEntityName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") runDiscovery(); }}
              placeholder="Enter company name, e.g. Boeing"
              className="min-h-12 flex-1 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35"
            />
            <button
              type="button"
              onClick={runDiscovery}
              disabled={loading || !entityName.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/15 bg-cyan-200/12 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45"
            >
              <Search size={16} />
              {loading ? "Discovering..." : "Discover locations"}
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-cyan-100/50">This uses free public geocoding candidates. It does not pretend candidate data is official. Exact/place/city confidence can be mapped; unknown results stay in review.</p>
        </GlassCard>

        {result?.error ? (
          <GlassCard className="mt-5 border border-amber-200/20 p-5">
            <div className="flex items-center gap-3 text-amber-100"><AlertTriangle size={18} /><p className="font-semibold">Discovery failed</p></div>
            <p className="mt-2 text-sm text-cyan-100/60">{result.error}</p>
          </GlassCard>
        ) : null}

        {result?.ok ? (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <GlassCard className="p-5"><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/40">Candidates</p><p className="mt-2 text-3xl font-black text-white">{result.counts?.candidates ?? locations.length}</p></GlassCard>
              <GlassCard className="p-5"><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/40">Mappable</p><p className="mt-2 text-3xl font-black text-emerald-100">{result.counts?.mappable ?? mappable.length}</p></GlassCard>
              <GlassCard className="p-5"><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/40">Needs review</p><p className="mt-2 text-3xl font-black text-amber-100">{result.counts?.needsReview ?? unresolved.length}</p></GlassCard>
            </div>

            <GlassCard className="mt-5 border border-amber-200/20 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-100/70">Verification rule</p>
              <p className="mt-2 text-sm leading-6 text-cyan-100/62">{result.warning}</p>
            </GlassCard>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {locations.map((location) => (
                <GlassCard key={location.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/40">{location.country}</p>
                      <h3 className="mt-2 text-xl font-black text-white">{location.placeName}</h3>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${confidenceClass(location.geocodeConfidence)}`}>{location.geocodeConfidence}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-cyan-100/62">{location.formattedAddress}</p>
                  <div className="mt-4 grid gap-2 text-xs text-cyan-100/55 md:grid-cols-2">
                    <p><span className="text-cyan-100/35">Source:</span> {location.geocodeSource}</p>
                    <p><span className="text-cyan-100/35">OSM:</span> {location.sourceClass}/{location.sourceType}</p>
                    <p><span className="text-cyan-100/35">Coordinates:</span> {location.coordinates[1].toFixed(5)}, {location.coordinates[0].toFixed(5)}</p>
                    <p><span className="text-cyan-100/35">Review:</span> {location.reviewStatus}</p>
                  </div>
                  {location.geocodeConfidence !== "unknown" ? (
                    <a href={mapLink(location)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/5 px-4 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-200/[0.08]"><ExternalLink size={12} />Open map candidate</a>
                  ) : null}
                </GlassCard>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
