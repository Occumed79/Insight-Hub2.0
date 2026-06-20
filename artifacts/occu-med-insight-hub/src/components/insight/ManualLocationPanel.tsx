import { useState } from "react";
import { CheckCircle2, PlusCircle, AlertTriangle } from "lucide-react";
import { GlassCard } from "./GlassCard";

type ManualDraft = {
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

const initialDraft: ManualDraft = {
  placeName: "",
  formattedAddress: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  facilityType: "Manual location",
  activity: "Manual entry",
  notes: "",
  longitude: "",
  latitude: "",
  geocodeConfidence: "exact",
};

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/35">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 min-h-9 w-full rounded-xl border border-cyan-100/12 bg-[#07111d] px-3 text-xs text-cyan-50 outline-none placeholder:text-cyan-100/30" />
    </label>
  );
}

export function ManualLocationPanel({ entityName }: { entityName: string }) {
  const [draft, setDraft] = useState<ManualDraft>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const setField = (field: keyof ManualDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  async function addManualLocation() {
    const cleanName = entityName.trim();
    const longitude = Number(draft.longitude);
    const latitude = Number(draft.latitude);
    setMessage(undefined);
    setError(undefined);

    if (!cleanName || !draft.placeName.trim() || !draft.country.trim() || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      setError("Entity name, place name, country, longitude, and latitude are required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/entities/manual-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, entityName: cleanName, longitude, latitude }),
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || "Manual location save failed");
      setMessage(payload.duplicate ? "That location already existed, so it was not duplicated." : "Manual location added to Geographic Data.");
      setDraft(initialDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual location save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="mt-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-emerald-200/60">Manual verified location</p>
          <p className="mt-2 text-sm leading-6 text-cyan-100/58">Use this when public discovery misses the actual site, clinic, base, office, or facility.</p>
        </div>
        <span className="rounded-full border border-emerald-100/20 bg-emerald-200/10 px-3 py-1 text-xs text-emerald-100">Direct to map</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Field label="Place / site name" value={draft.placeName} onChange={(value) => setField("placeName", value)} placeholder="Facility name" />
        <Field label="Country" value={draft.country} onChange={(value) => setField("country", value)} placeholder="United States" />
        <Field label="City" value={draft.city} onChange={(value) => setField("city", value)} placeholder="City" />
        <Field label="State / region" value={draft.state} onChange={(value) => setField("state", value)} placeholder="State or region" />
        <Field label="Longitude" value={draft.longitude} onChange={(value) => setField("longitude", value)} placeholder="-122.281" />
        <Field label="Latitude" value={draft.latitude} onChange={(value) => setField("latitude", value)} placeholder="47.929" />
        <Field label="Facility type" value={draft.facilityType} onChange={(value) => setField("facilityType", value)} placeholder="Clinic, office, base, facility" />
        <Field label="Activity" value={draft.activity} onChange={(value) => setField("activity", value)} placeholder="Occupational health, operations, etc." />
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/35">Confidence</span>
          <select value={draft.geocodeConfidence} onChange={(event) => setField("geocodeConfidence", event.target.value)} className="mt-1 min-h-9 w-full rounded-xl border border-cyan-100/12 bg-[#07111d] px-3 text-xs text-cyan-50 outline-none">
            <option value="exact">exact</option>
            <option value="place">place</option>
            <option value="city">city</option>
            <option value="unknown">unknown</option>
          </select>
        </label>
        <div className="md:col-span-3"><Field label="Address" value={draft.formattedAddress} onChange={(value) => setField("formattedAddress", value)} placeholder="Full address if available" /></div>
        <div className="md:col-span-3"><Field label="Notes" value={draft.notes} onChange={(value) => setField("notes", value)} placeholder="Source note, reason, or verification context" /></div>
      </div>

      <button type="button" onClick={addManualLocation} disabled={saving || !entityName.trim()} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-100/20 bg-emerald-200/12 px-5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-200/18 disabled:opacity-45">
        <PlusCircle size={16} />{saving ? "Adding..." : "Add manual location to map"}
      </button>

      {message ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200/20 bg-emerald-200/8 px-4 py-3 text-sm text-emerald-100"><CheckCircle2 size={16} />{message}</div> : null}
      {error ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200/20 bg-amber-200/8 px-4 py-3 text-sm text-amber-100"><AlertTriangle size={16} />{error}</div> : null}
    </GlassCard>
  );
}
