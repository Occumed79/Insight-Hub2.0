import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, AlertTriangle, ExternalLink, CheckCircle2, ArrowLeft, MapPin, Pencil, Save, X } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";

type DiscoveredLocation = {
  id: number;
  entityId: number;
  placeName: string;
  formattedAddress?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country: string;
  coordinates: [number, number];
  geocodeSource: "osm" | "photon" | "manual" | string;
  geocodeConfidence: "exact" | "place" | "city" | "unknown" | string;
  sourceType?: string | null;
  sourceClass?: string | null;
  sourceId?: string | null;
  facilityType?: string | null;
  activity?: string | null;
  notes?: string | null;
  reviewStatus: "candidate" | "needs-review" | "verified" | "rejected" | string;
};

type ResearchSource = {
  label: string;
  type: string;
  url: string;
  note: string;
};

type DiscoveryResponse = {
  ok: boolean;
  entityName?: string;
  entityId?: number;
  source?: string;
  generatedAt?: string;
  counts?: { candidates: number; mappable: number; needsReview: number; newCandidates?: number; duplicatesSkipped?: number };
  locations?: DiscoveredLocation[];
  researchSources?: ResearchSource[];
  warning?: string;
  error?: string;
};

type LocationDraft = {
  placeName: string;
  formattedAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  facilityType: string;
  activity: string;
  notes: string;
  longitude: string;
  latitude: string;
  geocodeConfidence: string;
};

function mapLink(location: DiscoveredLocation) {
  const [lng, lat] = location.coordinates;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function isMappable(location: DiscoveredLocation) {
  return ["exact", "place", "city"].includes(location.geocodeConfidence);
}

function confidenceClass(confidence: string) {
  if (confidence === "exact" || confidence === "place") return "border-emerald-200/20 bg-emerald-200/10 text-emerald-100";
  if (confidence === "city") return "border-cyan-200/20 bg-cyan-200/10 text-cyan-100";
  return "border-amber-200/20 bg-amber-200/10 text-amber-100";
}

function draftFromLocation(location: DiscoveredLocation): LocationDraft {
  const [longitude, latitude] = location.coordinates;
  return {
    placeName: location.placeName || "",
    formattedAddress: location.formattedAddress || "",
    city: location.city || "",
    state: location.state || "",
    postalCode: location.postalCode || "",
    country: location.country || "",
    facilityType: location.facilityType || "Verified location",
    activity: location.activity || "Entity discovery",
    notes: location.notes || "",
    longitude: String(longitude ?? ""),
    latitude: String(latitude ?? ""),
    geocodeConfidence: location.geocodeConfidence || "place",
  };
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/35">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 min-h-9 w-full rounded-xl border border-cyan-100/12 bg-[#07111d] px-3 text-xs text-cyan-50 outline-none placeholder:text-cyan-100/30" />
    </label>
  );
}

export default function EntityDiscovery() {
  const [entityName, setEntityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, LocationDraft>>({});
  const [result, setResult] = useState<DiscoveryResponse | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [verified, setVerified] = useState(false);

  async function runDiscovery() {
    const cleanName = entityName.trim();
    if (!cleanName) return;
    setLoading(true);
    setResult(undefined);
    setSelectedIds(new Set());
    setVerified(false);
    setEditingId(null);
    setDrafts({});
    try {
      const response = await fetch("/api/entity-discovery/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName: cleanName }),
      });
      const payload = (await response.json()) as DiscoveryResponse;
      setResult(payload);
      const defaultSelected = new Set<number>((payload.locations ?? []).filter(isMappable).slice(0, 25).map((location) => Number(location.id)));
      setSelectedIds(defaultSelected);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Discovery failed" });
    } finally {
      setLoading(false);
    }
  }

  async function verifySelected() {
    if (!result?.entityId || selectedIds.size === 0) return;
    setVerifying(true);
    try {
      const response = await fetch(`/api/entities/${result.entityId}/verify-selected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationIds: Array.from(selectedIds) }),
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || "Verification failed");
      setVerified(true);
    } catch (error) {
      setResult((current) => ({ ...(current ?? { ok: false }), ok: false, error: error instanceof Error ? error.message : "Verification failed" }));
    } finally {
      setVerifying(false);
    }
  }

  function startEdit(location: DiscoveredLocation) {
    setEditingId(Number(location.id));
    setDrafts((current) => ({ ...current, [location.id]: draftFromLocation(location) }));
  }

  function updateDraft(id: number, field: keyof LocationDraft, value: string) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? ({} as LocationDraft)), [field]: value } }));
  }

  async function saveLocation(location: DiscoveredLocation) {
    const id = Number(location.id);
    const draft = drafts[id];
    if (!draft) return;
    const longitude = Number(draft.longitude);
    const latitude = Number(draft.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      setResult((current) => ({ ...(current ?? { ok: false }), ok: false, error: "Longitude and latitude must be valid numbers before saving." }));
      return;
    }
    setSavingId(id);
    try {
      const response = await fetch(`/api/locations/${id}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeName: draft.placeName,
          formattedAddress: draft.formattedAddress,
          city: draft.city,
          state: draft.state,
          postalCode: draft.postalCode,
          country: draft.country,
          region: draft.country,
          facilityType: draft.facilityType,
          activity: draft.activity,
          notes: draft.notes,
          coordinates: [longitude, latitude],
          geocodeConfidence: draft.geocodeConfidence,
        }),
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || "Save failed");
      setResult((current) => current ? { ...current, ok: true, error: undefined, locations: (current.locations ?? []).map((item) => item.id === id ? payload.location : item) } : current);
      setEditingId(null);
    } catch (error) {
      setResult((current) => ({ ...(current ?? { ok: false }), ok: false, error: error instanceof Error ? error.message : "Save failed" }));
    } finally {
      setSavingId(null);
    }
  }

  const locations = result?.locations ?? [];
  const mappable = useMemo(() => locations.filter(isMappable), [locations]);
  const unresolved = useMemo(() => locations.filter((location) => !isMappable(location)), [locations]);

  const toggleLocation = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar eyebrow="Portal 04" title="Add Entity" subtitle="Search for a company, correct candidates if needed, select good locations, and add them into Geographic Data." actions={<Link href="/geographic-data" className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/5 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.08]"><ArrowLeft size={14} />Geographic Data</Link>} />

        <GlassCard className="p-6">
          <p className="text-xs uppercase tracking-[0.26em] text-emerald-200/60">Company search</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input value={entityName} onChange={(event) => setEntityName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") runDiscovery(); }} placeholder="Enter company name, e.g. Boeing" className="min-h-12 flex-1 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35" />
            <button type="button" onClick={runDiscovery} disabled={loading || !entityName.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/15 bg-cyan-200/12 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45"><Search size={16} />{loading ? "Discovering..." : "Discover locations"}</button>
          </div>
          <p className="mt-3 text-xs leading-5 text-cyan-100/50">This uses public geocoding candidates and avoids duplicates on repeated searches. Low-confidence rows are not selected by default.</p>
        </GlassCard>

        {result?.error ? <GlassCard className="mt-5 border border-amber-200/20 p-5"><div className="flex items-center gap-3 text-amber-100"><AlertTriangle size={18} /><p className="font-semibold">Action failed</p></div><p className="mt-2 text-sm text-cyan-100/60">{result.error}</p></GlassCard> : null}
        {verified ? <GlassCard className="mt-5 border border-emerald-200/20 p-5"><div className="flex items-center gap-3 text-emerald-100"><CheckCircle2 size={18} /><p className="font-semibold">Added to Geographic Data</p></div><p className="mt-2 text-sm text-cyan-100/60">Selected locations are now verified. Return to Geographic Data and select the entity from the company dropdown.</p></GlassCard> : null}

        {result?.ok ? (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <GlassCard className="p-5"><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/40">Candidates</p><p className="mt-2 text-3xl font-black text-white">{result.counts?.candidates ?? locations.length}</p><p className="mt-1 text-xs text-cyan-100/40">{result.counts?.newCandidates ?? 0} new · {result.counts?.duplicatesSkipped ?? 0} duplicate</p></GlassCard>
              <GlassCard className="p-5"><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/40">Mappable</p><p className="mt-2 text-3xl font-black text-emerald-100">{result.counts?.mappable ?? mappable.length}</p></GlassCard>
              <GlassCard className="p-5"><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/40">Needs review</p><p className="mt-2 text-3xl font-black text-amber-100">{result.counts?.needsReview ?? unresolved.length}</p></GlassCard>
              <GlassCard className="p-5"><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/40">Selected</p><p className="mt-2 text-3xl font-black text-cyan-100">{selectedIds.size}</p></GlassCard>
            </div>

            {result.researchSources?.length ? (
              <GlassCard className="mt-5 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/40">Source expansion</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {result.researchSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-cyan-100/12 bg-white/[0.03] p-4 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.06]"><p className="text-sm font-semibold text-cyan-50">{source.label}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-100/35">{source.type}</p><p className="mt-2 text-xs leading-5 text-cyan-100/55">{source.note}</p></a>)}
                </div>
              </GlassCard>
            ) : null}

            <GlassCard className="mt-5 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div><p className="text-xs uppercase tracking-[0.24em] text-cyan-100/40">Verify selected locations</p><p className="mt-2 text-sm leading-6 text-cyan-100/62">Edit questionable rows first. Only selected locations will appear in Geographic Data.</p></div>
                <button type="button" onClick={verifySelected} disabled={verifying || selectedIds.size === 0 || verified} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-100/20 bg-emerald-200/12 px-5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-200/18 disabled:opacity-45"><CheckCircle2 size={16} />{verifying ? "Adding..." : verified ? "Added" : "Add selected to map"}</button>
              </div>
            </GlassCard>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {locations.map((location) => {
                const id = Number(location.id);
                const selected = selectedIds.has(id);
                const mappableCandidate = isMappable(location);
                const editing = editingId === id;
                const draft = drafts[id] ?? draftFromLocation(location);
                return (
                  <GlassCard key={location.id} className={`p-5 transition ${selected ? "border border-emerald-200/30 bg-emerald-200/[0.035]" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" checked={selected} disabled={!mappableCandidate || verified} onChange={() => toggleLocation(id)} className="mt-1 h-4 w-4 accent-cyan-300" />
                        <div><p className="text-xs uppercase tracking-[0.22em] text-cyan-100/40">{location.country}</p><h3 className="mt-2 text-xl font-black text-white">{location.placeName}</h3></div>
                      </label>
                      <span className={`rounded-full border px-3 py-1 text-xs ${confidenceClass(location.geocodeConfidence)}`}>{location.geocodeConfidence}</span>
                    </div>
                    {editing ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Field label="Place" value={draft.placeName} onChange={(value) => updateDraft(id, "placeName", value)} />
                        <Field label="Country" value={draft.country} onChange={(value) => updateDraft(id, "country", value)} />
                        <Field label="City" value={draft.city} onChange={(value) => updateDraft(id, "city", value)} />
                        <Field label="State" value={draft.state} onChange={(value) => updateDraft(id, "state", value)} />
                        <Field label="Longitude" value={draft.longitude} onChange={(value) => updateDraft(id, "longitude", value)} />
                        <Field label="Latitude" value={draft.latitude} onChange={(value) => updateDraft(id, "latitude", value)} />
                        <Field label="Facility" value={draft.facilityType} onChange={(value) => updateDraft(id, "facilityType", value)} />
                        <label className="block"><span className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/35">Confidence</span><select value={draft.geocodeConfidence} onChange={(event) => updateDraft(id, "geocodeConfidence", event.target.value)} className="mt-1 min-h-9 w-full rounded-xl border border-cyan-100/12 bg-[#07111d] px-3 text-xs text-cyan-50 outline-none"><option value="exact">exact</option><option value="place">place</option><option value="city">city</option><option value="unknown">unknown</option></select></label>
                        <div className="md:col-span-2"><Field label="Address" value={draft.formattedAddress} onChange={(value) => updateDraft(id, "formattedAddress", value)} /></div>
                        <div className="md:col-span-2"><Field label="Notes" value={draft.notes} onChange={(value) => updateDraft(id, "notes", value)} /></div>
                      </div>
                    ) : <p className="mt-3 text-sm leading-6 text-cyan-100/62">{location.formattedAddress}</p>}
                    <div className="mt-4 grid gap-2 text-xs text-cyan-100/55 md:grid-cols-2"><p><span className="text-cyan-100/35">Source:</span> {location.geocodeSource}</p><p><span className="text-cyan-100/35">Type:</span> {location.sourceClass}/{location.sourceType}</p><p><span className="text-cyan-100/35">Coordinates:</span> {location.coordinates[1].toFixed(5)}, {location.coordinates[0].toFixed(5)}</p><p><span className="text-cyan-100/35">Status:</span> {mappableCandidate ? "Selectable" : "Low confidence"}</p></div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {mappableCandidate ? <a href={mapLink(location)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/5 px-4 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-200/[0.08]"><ExternalLink size={12} />Open map candidate</a> : <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/8 px-4 py-2 text-xs font-semibold text-amber-100"><MapPin size={12} />Hidden until edited</span>}
                      {editing ? <button type="button" onClick={() => saveLocation(location)} disabled={savingId === id} className="inline-flex items-center gap-2 rounded-full border border-emerald-100/20 bg-emerald-200/10 px-4 py-2 text-xs font-semibold text-emerald-50 disabled:opacity-45"><Save size={12} />{savingId === id ? "Saving..." : "Save"}</button> : <button type="button" onClick={() => startEdit(location)} disabled={verified} className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-cyan-50 disabled:opacity-45"><Pencil size={12} />Edit</button>}
                      {editing ? <button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-cyan-50"><X size={12} />Cancel</button> : null}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
