import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { LocationRecord } from "@/data/types";
import { GlassCard } from "./GlassCard";

const customIcon = L.divIcon({
  className: "custom-marker",
  html: `
    <div style="
      position: relative;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 28px;
        height: 28px;
        background: rgba(45, 212, 191, 0.12);
        border-radius: 50%;
        animation: pulse 2s ease-in-out infinite;
      "></div>
      <div style="
        position: absolute;
        width: 20px;
        height: 20px;
        background: rgba(45, 212, 191, 0.2);
        border-radius: 50%;
      "></div>
      <div style="
        position: relative;
        width: 11px;
        height: 11px;
        background: #a7fff3;
        border: 2px solid rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        box-shadow: 0 0 12px rgba(45, 212, 191, 0.6);
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.3); opacity: 0.3; }
      }
    </style>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export function MapPanel({ locations, onSelect }: { locations: LocationRecord[]; onSelect: (location: LocationRecord) => void }) {
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
        <div className="map-shell h-[500px] rounded-[24px] border border-cyan-100/16 bg-[#020710]/78 flex items-center justify-center">
          <p className="text-sm text-cyan-100/40">Select a company to view locations</p>
        </div>
      </GlassCard>
    );
  }

  const bounds = locations.map((loc) => {
    const [lng, lat] = loc.coordinates;
    return [lat, lng] as [number, number];
  });

  return (
    <GlassCard className="map-card overflow-hidden p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-2">
        <div>
          <h3 className="font-bold text-white">Global intelligence map</h3>
          <p className="text-xs text-cyan-100/50">Zoom, pan, and click a location glow to open operational context.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-cyan-100/15 bg-cyan-200/10 px-3 py-1 text-xs text-cyan-50">{locations.length} sites</span>
          <span className="rounded-full border border-cyan-100/15 bg-white/[0.04] px-3 py-1 text-xs text-cyan-100/65">{countryCount} countries</span>
          <span className="rounded-full border border-cyan-100/15 bg-white/[0.04] px-3 py-1 text-xs text-cyan-100/65">{regionCount} regions</span>
        </div>
      </div>
      <div className="map-shell h-[500px] rounded-[24px] border border-cyan-100/16 bg-[#020710]/78 overflow-hidden">
        <MapContainer
          bounds={bounds}
          boundsOptions={{ padding: [50, 50] }}
          style={{ width: "100%", height: "100%", background: "#020710" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />
          {locations.map((location) => {
            const [lng, lat] = location.coordinates;
            return (
              <Marker
                key={location.id}
                position={[lat, lng]}
                icon={customIcon}
                eventHandlers={{
                  click: () => onSelect(location),
                }}
              >
                <Popup className="custom-popup">
                  <div style={{ color: "#a7fff3" }}>
                    <strong>{location.city}</strong>
                    <br />
                    {location.country}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </GlassCard>
  );
}
