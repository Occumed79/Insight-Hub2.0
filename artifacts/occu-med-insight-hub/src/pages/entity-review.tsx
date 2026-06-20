import { useState, useEffect } from "react";
import { Check, X, Search, AlertTriangle, ExternalLink } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

type Entity = {
  id: number;
  name: string;
  displayName: string;
  type: string;
  status: "candidate" | "verified" | "rejected";
  source: string;
  createdAt: string;
  updatedAt: string;
};

type Location = {
  id: number;
  entityId: number;
  placeName: string;
  formattedAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  region: string;
  coordinates: [number, number];
  geocodeSource: string;
  geocodeConfidence: "exact" | "place" | "city" | "country" | "unknown";
  reviewStatus: "candidate" | "verified" | "rejected" | "needs_research";
  createdAt: string;
};

const statusColors = {
  candidate: "border-amber-200/20 bg-amber-200/10 text-amber-100",
  verified: "border-emerald-200/20 bg-emerald-200/10 text-emerald-100",
  rejected: "border-red-200/20 bg-red-200/10 text-red-100",
};

const confidenceColors = {
  exact: "border-emerald-200/20 bg-emerald-200/10 text-emerald-100",
  place: "border-cyan-200/20 bg-cyan-200/10 text-cyan-100",
  city: "border-blue-200/20 bg-blue-200/10 text-blue-100",
  country: "border-amber-200/20 bg-amber-200/10 text-amber-100",
  unknown: "border-red-200/20 bg-red-200/10 text-red-100",
};

export default function EntityReview() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "candidate" | "verified" | "rejected">("all");

  useEffect(() => {
    loadEntities();
  }, []);

  async function loadEntities() {
    try {
      const response = await fetch("/api/entities");
      const data = await response.json();
      if (data.ok) {
        setEntities(data.entities);
      }
    } catch (error) {
      console.error("Failed to load entities:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLocations(entityId: number) {
    try {
      const response = await fetch(`/api/entities/${entityId}/locations`);
      const data = await response.json();
      if (data.ok) {
        setLocations(data.locations);
      }
    } catch (error) {
      console.error("Failed to load locations:", error);
    }
  }

  async function updateEntityStatus(entityId: number, status: "verified" | "rejected") {
    try {
      const response = await fetch(`/api/entities/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.ok) {
        setEntities((prev) => prev.map((e) => (e.id === entityId ? data.entity : e)));
        if (selectedEntity?.id === entityId) {
          setSelectedEntity(data.entity);
        }
      }
    } catch (error) {
      console.error("Failed to update entity:", error);
    }
  }

  async function updateLocationReviewStatus(locationId: number, reviewStatus: "verified" | "rejected" | "needs_research") {
    try {
      const response = await fetch(`/api/locations/${locationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus }),
      });
      const data = await response.json();
      if (data.ok) {
        setLocations((prev) => prev.map((l) => (l.id === locationId ? data.location : l)));
      }
    } catch (error) {
      console.error("Failed to update location:", error);
    }
  }

  function handleEntityClick(entity: Entity) {
    setSelectedEntity(entity);
    loadLocations(entity.id);
  }

  const filteredEntities = entities.filter((e) => filter === "all" || e.status === filter);

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar eyebrow="Portal 05" title="Entity Review" subtitle="Review discovered entities and their location candidates. Verify or reject locations to build the operational map database." />

        <div className="mt-6 flex gap-4">
          <div className="w-80 flex-shrink-0">
            <GlassCard className="p-4">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search entities..."
                  className="w-full rounded-xl border border-cyan-100/15 bg-[#07111d] px-3 py-2 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35"
                />
              </div>
              <div className="mb-4 flex gap-2">
                {(["all", "candidate", "verified", "rejected"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition ${
                      filter === status
                        ? "bg-cyan-200/15 text-cyan-50"
                        : "text-cyan-100/50 hover:bg-white/[0.05]"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <p className="text-center text-sm text-cyan-100/50">Loading...</p>
                ) : filteredEntities.length === 0 ? (
                  <p className="text-center text-sm text-cyan-100/50">No entities found</p>
                ) : (
                  filteredEntities.map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => handleEntityClick(entity)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedEntity?.id === entity.id
                          ? "border-cyan-200/30 bg-cyan-200/10"
                          : "border-cyan-100/10 bg-[#07111d]/50 hover:border-cyan-100/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{entity.displayName}</p>
                          <p className="text-xs text-cyan-100/60">{entity.type}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusColors[entity.status]}`}>
                          {entity.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </GlassCard>
          </div>

          <div className="flex-1">
            {selectedEntity ? (
              <>
                <GlassCard className="mb-4 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/35">Entity</p>
                      <h2 className="mt-2 text-2xl font-black text-white">{selectedEntity.displayName}</h2>
                      <p className="mt-1 text-sm text-cyan-100/60">{selectedEntity.type} • {selectedEntity.source}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateEntityStatus(selectedEntity.id, "verified")}
                        disabled={selectedEntity.status === "verified"}
                        className="flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-200/15 disabled:opacity-50"
                      >
                        <Check size={16} /> Verify
                      </button>
                      <button
                        onClick={() => updateEntityStatus(selectedEntity.id, "rejected")}
                        disabled={selectedEntity.status === "rejected"}
                        className="flex items-center gap-2 rounded-full border border-red-200/20 bg-red-200/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-200/15 disabled:opacity-50"
                      >
                        <X size={16} /> Reject
                      </button>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/35">Location candidates ({locations.length})</p>
                    <div className="flex gap-2 text-xs">
                      <span className="text-cyan-100/60">{locations.filter((l) => l.reviewStatus === "verified").length} verified</span>
                      <span className="text-cyan-100/60">{locations.filter((l) => l.reviewStatus === "candidate").length} pending</span>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {locations.length === 0 ? (
                      <p className="text-center text-sm text-cyan-100/50">No locations found</p>
                    ) : (
                      locations.map((location) => (
                        <div key={location.id} className="rounded-xl border border-cyan-100/10 bg-[#07111d]/50 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-white truncate">{location.placeName}</h3>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${confidenceColors[location.geocodeConfidence]}`}>
                                  {location.geocodeConfidence}
                                </span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusColors[location.reviewStatus]}`}>
                                  {location.reviewStatus}
                                </span>
                              </div>
                              <p className="text-sm text-cyan-100/60 truncate">{location.formattedAddress || `${location.city}, ${location.country}`}</p>
                              <div className="mt-2 grid gap-1 text-xs text-cyan-100/50">
                                <p><span className="text-cyan-100/35">Coordinates:</span> {location.coordinates[1].toFixed(5)}, {location.coordinates[0].toFixed(5)}</p>
                                <p><span className="text-cyan-100/35">Source:</span> {location.geocodeSource}</p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              {(location.geocodeConfidence === "exact" || location.geocodeConfidence === "place" || location.geocodeConfidence === "city") && (
                                <a
                                  href={`https://www.google.com/maps?q=${location.coordinates[1]},${location.coordinates[0]}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan-100/15 bg-cyan-100/5 px-3 py-1.5 text-xs font-medium text-cyan-50 hover:bg-cyan-200/[0.08]"
                                >
                                  <ExternalLink size={12} /> View
                                </a>
                              )}
                              <div className="flex gap-1">
                                <button
                                  onClick={() => updateLocationReviewStatus(location.id, "verified")}
                                  disabled={location.reviewStatus === "verified"}
                                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-emerald-200/20 bg-emerald-200/10 px-2 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-200/15 disabled:opacity-50"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => updateLocationReviewStatus(location.id, "rejected")}
                                  disabled={location.reviewStatus === "rejected"}
                                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-red-200/20 bg-red-200/10 px-2 py-1.5 text-xs font-medium text-red-100 hover:bg-red-200/15 disabled:opacity-50"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </GlassCard>
              </>
            ) : (
              <GlassCard className="p-12 text-center">
                <Search className="mx-auto h-12 w-12 text-cyan-100/30" />
                <p className="mt-4 text-sm text-cyan-100/50">Select an entity to review its locations</p>
              </GlassCard>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
