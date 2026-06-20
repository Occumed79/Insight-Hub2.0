import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Upload } from "lucide-react";
import { GlassCard } from "./GlassCard";

type ParsedLocation = {
  placeName: string;
  formattedAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  longitude: number;
  latitude: number;
  facilityType?: string;
  activity?: string;
  notes?: string;
  geocodeConfidence?: string;
};

type ImportResult = {
  ok: boolean;
  counts?: {
    received: number;
    inserted: number;
    rejected: number;
    duplicatesSkipped: number;
  };
  rejected?: Array<{ index: number; error: string }>;
  error?: string;
};

const sampleRows = `placeName\tformattedAddress\tcity\tstate\tpostalCode\tcountry\tlongitude\tlatitude\tfacilityType\tactivity\tnotes\nBoeing Everett Factory\t3003 W Casino Rd, Everett, WA 98204\tEverett\tWA\t98204\tUnited States\t-122.2808\t47.9292\tManufacturing site\tAerospace operations\tVerified from source\nBoeing Renton Factory\t737 Logan Ave N, Renton, WA 98057\tRenton\tWA\t98057\tUnited States\t-122.2132\t47.4934\tManufacturing site\tAerospace operations\tVerified from source`;

const headerAliases: Record<string, keyof ParsedLocation> = {
  place: "placeName",
  placename: "placeName",
  site: "placeName",
  sitename: "placeName",
  name: "placeName",
  address: "formattedAddress",
  formattedaddress: "formattedAddress",
  city: "city",
  state: "state",
  region: "state",
  postal: "postalCode",
  postalcode: "postalCode",
  zip: "postalCode",
  zipcode: "postalCode",
  country: "country",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude",
  latitude: "latitude",
  lat: "latitude",
  facility: "facilityType",
  facilitytype: "facilityType",
  activity: "activity",
  notes: "notes",
  note: "notes",
  confidence: "geocodeConfidence",
  geocodeconfidence: "geocodeConfidence",
};

const fallbackColumns: Array<keyof ParsedLocation> = ["placeName", "formattedAddress", "city", "state", "postalCode", "country", "longitude", "latitude", "facilityType", "activity", "notes"];

function splitRow(line: string, delimiter: string) {
  if (delimiter === "\t") return line.split("\t").map((cell) => cell.trim());
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function detectDelimiter(text: string) {
  return text.includes("\t") ? "\t" : ",";
}

function parseBulkText(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { locations: [] as ParsedLocation[], errors: [] as string[] };

  const delimiter = detectDelimiter(text);
  const firstRow = splitRow(lines[0], delimiter);
  const mappedHeaders = firstRow.map((header) => headerAliases[normalizeHeader(header)]);
  const hasHeader = mappedHeaders.some(Boolean);
  const columns = hasHeader ? mappedHeaders : fallbackColumns;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const errors: string[] = [];
  const locations: ParsedLocation[] = [];

  dataLines.forEach((line, rowIndex) => {
    const cells = splitRow(line, delimiter);
    const raw: Record<string, string> = {};
    columns.forEach((column, index) => {
      if (column) raw[column] = cells[index] ?? "";
    });

    const longitude = Number(raw.longitude);
    const latitude = Number(raw.latitude);
    if (!raw.placeName || !raw.country || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      errors.push(`Row ${rowIndex + 1}: missing placeName/country/longitude/latitude`);
      return;
    }

    locations.push({
      placeName: raw.placeName,
      formattedAddress: raw.formattedAddress,
      city: raw.city,
      state: raw.state,
      postalCode: raw.postalCode,
      country: raw.country,
      longitude,
      latitude,
      facilityType: raw.facilityType,
      activity: raw.activity,
      notes: raw.notes,
      geocodeConfidence: raw.geocodeConfidence || "exact",
    });
  });

  return { locations, errors };
}

export function BulkLocationImportPanel({ entityName }: { entityName: string }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | undefined>();
  const parsed = useMemo(() => parseBulkText(text), [text]);

  async function importLocations() {
    setResult(undefined);
    if (!entityName.trim()) {
      setResult({ ok: false, error: "Enter the entity name before importing locations." });
      return;
    }
    if (parsed.locations.length === 0) {
      setResult({ ok: false, error: "No valid rows found. Required fields: placeName, country, longitude, latitude." });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/entities/manual-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName: entityName.trim(), locations: parsed.locations }),
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || "Bulk import failed");
      setResult(payload);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Bulk import failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="mt-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-emerald-200/60">Bulk location paste import</p>
          <p className="mt-2 text-sm leading-6 text-cyan-100/58">Paste TSV or CSV rows to add many verified locations at once. Headers are supported.</p>
        </div>
        <button type="button" onClick={() => setText(sampleRows)} className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-200/[0.08]"><ClipboardList size={13} />Use sample</button>
      </div>

      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={sampleRows} className="mt-5 min-h-[180px] w-full rounded-2xl border border-cyan-100/12 bg-[#07111d] p-4 font-mono text-xs leading-5 text-cyan-50 outline-none placeholder:text-cyan-100/25" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-cyan-100/55">
          <span className="text-emerald-100">{parsed.locations.length}</span> valid rows
          {parsed.errors.length ? <span className="ml-3 text-amber-100">{parsed.errors.length} row issues</span> : null}
        </div>
        <button type="button" onClick={importLocations} disabled={saving || parsed.locations.length === 0 || !entityName.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-100/20 bg-emerald-200/12 px-5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-200/18 disabled:opacity-45"><Upload size={16} />{saving ? "Importing..." : "Import verified locations"}</button>
      </div>

      {parsed.errors.length ? <div className="mt-3 rounded-2xl border border-amber-200/20 bg-amber-200/8 p-3 text-xs leading-5 text-amber-100">{parsed.errors.slice(0, 5).map((error) => <p key={error}>{error}</p>)}</div> : null}
      {result?.ok ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200/20 bg-emerald-200/8 px-4 py-3 text-sm text-emerald-100"><CheckCircle2 size={16} />Imported {result.counts?.inserted ?? 0} locations. {result.counts?.duplicatesSkipped ? `${result.counts.duplicatesSkipped} duplicates skipped.` : ""}</div> : null}
      {result && !result.ok ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200/20 bg-amber-200/8 px-4 py-3 text-sm text-amber-100"><AlertTriangle size={16} />{result.error}</div> : null}
    </GlassCard>
  );
}
