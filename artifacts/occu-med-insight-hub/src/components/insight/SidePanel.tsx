import { X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LocationRecord } from "@/data/types";

const LINKABLE_CONFIDENCE = new Set<LocationRecord["geocodeConfidence"]>(["exact", "place", "city"]);

function getBestAddress(location: LocationRecord): string {
  if (location.formattedAddress) return location.formattedAddress;
  if (location.addressLine1) {
    const parts = [location.addressLine1];
    if (location.addressLine2) parts.push(location.addressLine2);
    if (location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    if (location.postalCode) parts.push(location.postalCode);
    if (location.country) parts.push(location.country);
    return parts.join(", ");
  }
  if (location.placeName) {
    return `${location.placeName}, ${location.city}, ${location.country}`;
  }
  return `${location.city}, ${location.country}`;
}

function getGeocodeLabel(location: LocationRecord): string {
  if (!location.geocodeConfidence) return "Unknown confidence";
  const confidence = location.geocodeConfidence.charAt(0).toUpperCase() + location.geocodeConfidence.slice(1);
  const source = location.geocodeSource ? ` (${location.geocodeSource})` : "";
  return `${confidence}${source}`;
}

function canOpenExternalMap(location: LocationRecord) {
  const [lng, lat] = location.coordinates;
  const validCoordinate = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  return validCoordinate && LINKABLE_CONFIDENCE.has(location.geocodeConfidence);
}

export function SidePanel({ location, onClose }: { location?: LocationRecord; onClose: () => void }) {
  if (!location) return null;

  const [lng, lat] = location.coordinates;
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`;
  const bestAddress = getBestAddress(location);
  const geocodeLabel = getGeocodeLabel(location);
  const showMapLinks = canOpenExternalMap(location);

  return (
    <AnimatePresence mode="wait">
      {location ? (
        <motion.aside
          key={location.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="mb-4 rounded-[24px] border border-cyan-100/16 bg-[#06111d]/72 p-5 shadow-[inset_0_0_44px_rgba(45,212,191,.06)] backdrop-blur-xl"
        >
          <button onClick={onClose} className="float-right rounded-full border border-cyan-100/10 p-2 text-cyan-100/60 hover:text-white"><X size={15} /></button>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Location detail</p>
          <h3 className="mt-3 pr-8 text-2xl font-black text-white">{location.placeName || location.city}</h3>
          <p className="mt-1 text-sm text-cyan-100/55">{location.country}</p>
          <div className="mt-5 space-y-3 text-sm">
            <Info label="Address" value={bestAddress} />
            <Info label="Company" value={location.company} />
            <Info label="Region" value={location.region} />
            <Info label="Facility Type" value={location.facilityType} />
            <Info label="Activity" value={location.activity} />
            <Info label="Notes" value={location.notes} />
            <div className="pt-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/35">Geocode confidence</p>
              <p className="mt-1 leading-6 text-cyan-50/82">{geocodeLabel}</p>
            </div>
            <div className="pt-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/35">Coordinates</p>
              <p className="mt-1 leading-6 text-cyan-50/82 font-mono text-xs">{showMapLinks ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "Not shown until location is place/city-confidence or better"}</p>
            </div>
            {showMapLinks ? (
              <div className="pt-4 flex gap-2">
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/5 px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.08]"><ExternalLink size={12} />Google Maps</a>
                <a href={osmUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/5 px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.08]"><ExternalLink size={12} />OpenStreetMap</a>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200/20 bg-amber-200/8 px-4 py-3 text-xs leading-5 text-amber-100/80">
                Map links are hidden because this row is not geocoded to a city/place-level coordinate yet.
              </div>
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/35">{label}</p><p className="mt-1 leading-6 text-cyan-50/82">{value}</p></div>;
}
