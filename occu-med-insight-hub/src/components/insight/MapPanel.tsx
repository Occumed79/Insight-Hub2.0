import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import type { LocationRecord } from "@/data/types";
import { GlassCard } from "./GlassCard";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function MapPanel({ locations, onSelect }: { locations: LocationRecord[]; onSelect: (location: LocationRecord) => void }) {
  return (
    <GlassCard className="map-card overflow-hidden p-4">
      <div className="mb-2 flex items-center justify-between px-2">
        <div>
          <h3 className="font-bold text-white">Global intelligence map</h3>
          <p className="text-xs text-cyan-100/50">Click a plotted location to open operational context.</p>
        </div>
        <span className="rounded-full border border-cyan-100/15 bg-cyan-200/10 px-3 py-1 text-xs text-cyan-50">{locations.length} sites</span>
      </div>
      <div className="map-shell h-[500px] rounded-[24px] border border-cyan-100/16 bg-[#020710]/78 p-2">
        <ComposableMap projectionConfig={{ rotate: [-10, 0, 0], scale: 145 }} style={{ width: "100%", height: "100%" }}>
          <Geographies geography={geoUrl}>
            {({ geographies }) => geographies.map((geo) => <Geography key={geo.rsmKey} geography={geo} fill="rgba(24, 92, 98, .43)" stroke="rgba(165, 243, 252, .18)" strokeWidth={0.55} style={{ default: { outline: "none" }, hover: { fill: "rgba(45,212,191,.42)", outline: "none" }, pressed: { outline: "none" } }} />)}
          </Geographies>
          {locations.map((location) => (
            <Marker key={location.id} coordinates={location.coordinates} onClick={() => onSelect(location)}>
              <circle r={14} fill="rgba(45,212,191,.12)" className="map-marker-pulse pointer-events-none" />
              <circle r={5.5} fill="#a7fff3" stroke="rgba(255,255,255,.9)" strokeWidth={1.5} className="map-marker cursor-pointer" />
              <circle r={10} fill="rgba(45,212,191,.2)" className="pointer-events-none" />
            </Marker>
          ))}
        </ComposableMap>
      </div>
    </GlassCard>
  );
}
