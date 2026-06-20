import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { LocationRecord } from "@/data/types";
import { GlassCard } from "./GlassCard";

const WORLD_BOUNDS: [[number, number], [number, number]] = [[-85, -180], [85, 180]];
const DEFAULT_CENTER: [number, number] = [24, 18];
const MAPPABLE_CONFIDENCE = new Set<LocationRecord["geocodeConfidence"]>(["exact", "place", "city"]);

const customIcon = L.divIcon({
  className: "custom-marker",
  html: `
    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 30px; height: 30px; background: rgba(45, 212, 191, 0.13); border-radius: 50%; animation: pulse 2s ease-in-out infinite;"></div>
      <div style="position: absolute; width: 21px; height: 21px; background: rgba(45, 212, 191, 0.22); border-radius: 50%; box-shadow: 0 0 22px rgba(45, 212, 191, 0.38);"></div>
      <div style="position: relative; width: 11px; height: 11px; background: #a7fff3; border: 2px solid rgba(255, 255, 255, 0.92); border-radius: 50%; box-shadow: 0 0 14px rgba(45, 212, 191, 0.72);"></div>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 0.65; }
        50% { transform: scale(1.35); opacity: 0.28; }
      }
    </style>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function isMappable(location: LocationRecord) {
  const [lng, lat] = location.coordinates;
  const hasValidCoordinate = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  return hasValidCoordinate && MAPPABLE_CONFIDENCE.has(location.geocodeConfidence);
}

function getMarkerKey(location: LocationRecord, index: number) {
  return `${location.id}-${location.coordinates[0]}-${location.coordinates[1]}-${index}`;
}

function MapAutoFit({ locations }: { locations: LocationRecord[] }) {
  const map = useMap();
  const signature = locations.map((location) => location.id).join("|");

  useEffect(() => {
    if (locations.length === 0) {
      map.setView(DEFAULT_CENTER, 2);
      return;
    }
    const positions = locations.map((location) => {
      const [lng, lat] = location.coordinates;
      return [lat, lng] as [number, number];
    });
    if (positions.length === 1) {
      map.setView(positions[0], 8, { animate: true });
      return;
    }
    map.fitBounds(positions, { padding: [64, 64], maxZoom: 8, animate: true });
  }, [map, signature, locations]);

  return null;
}

export function MapPanel({ locations, onSelect }: { locations: LocationRecord[]; onSelect: (location: LocationRecord) => void }) {
  const mappableLocations = useMemo(() => locations.filter(isMappable), [locations]);
  const unresolvedCount = locations.length - mappableLocations.length;
  const countryCount = useMemo(() => new Set(locations.map((location) => location.country)).size, [locations]);
  const regionCount = useMemo(() => new Set(locations.map((location) => location.region)).size, [locations]);

  if (locations.length === 0) {
    return (
      <GlassCard className="map-card overflow-hidden p-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <div>
            <h3 className="font-bold text-white">Global intelligence map</h3>
            <p className="text-xs text-cyan-100/50">No locations to display.</p>
          </div>
          <span className="rounded-full border border-cyan-100/15 bg-cyan-200/10 px-3 py-1 text-xs text-cyan-50">0 sites</span>
        </div>
        <div className="map-shell relative h-[500px] rounded-[24px] border border-cyan-100/16 bg-[#020710]/78 flex items-center justify-center">
          <p className="text-sm text-cyan-100/40">Select a company to view locations</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="map-card overflow-hidden p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-2">
        <div>
          <h3 className="font-bold text-white">Global intelligence map</h3>
          <p className="text-xs text-cyan-100/50">Auto-fits to the selected company. Only exact, place, and city-confidence locations are plotted.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-cyan-100/15 bg-cyan-200/10 px-3 py-1 text-xs text-cyan-50">{mappableLocations.length} mapped</span>
          <span className="rounded-full border border-cyan-100/15 bg-white/[0.04] px-3 py-1 text-xs text-cyan-100/65">{locations.length} rows</span>
          <span className="rounded-full border border-cyan-100/15 bg-white/[0.04] px-3 py-1 text-xs text-cyan-100/65">{countryCount} countries</span>
          <span className="rounded-full border border-cyan-100/15 bg-white/[0.04] px-3 py-1 text-xs text-cyan-100/65">{regionCount} regions</span>
        </div>
      </div>
      <div className="map-shell insight-leaflet-map relative h-[500px] overflow-hidden rounded-[24px] border border-cyan-100/16 bg-[#020710]/78 shadow-[inset_0_0_70px_rgba(45,212,191,.08)]">
        <MapContainer center={DEFAULT_CENTER} zoom={2} minZoom={1} maxZoom={18} maxBounds={WORLD_BOUNDS} maxBoundsViscosity={0.95} style={{ width: "100%", height: "100%", background: "#020710" }} zoomControl={false} scrollWheelZoom worldCopyJump={false}>
          <MapAutoFit locations={mappableLocations} />
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" maxZoom={19} noWrap bounds={WORLD_BOUNDS} />
          {mappableLocations.map((location, index) => {
            const [lng, lat] = location.coordinates;
            return (
              <Marker key={getMarkerKey(location, index)} position={[lat, lng]} icon={customIcon} eventHandlers={{ click: () => onSelect(location) }}>
                <Popup className="custom-popup">
                  <div className="text-cyan-50"><strong>{location.placeName ?? location.city}</strong><br /><span className="text-cyan-100/70">{location.country}</span></div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-2xl border border-cyan-100/10 bg-[#07111d]/70 px-4 py-3 text-xs text-cyan-100/60 backdrop-blur-xl">
          <p className="font-semibold text-cyan-50">Operational address map</p>
          <p className="mt-1">{unresolvedCount > 0 ? `${unresolvedCount} low-confidence rows are hidden from map pins.` : "All rows have mappable coordinates."}</p>
        </div>
      </div>
    </GlassCard>
  );
}
