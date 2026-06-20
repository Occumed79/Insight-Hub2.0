import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import type { LocationRecord } from "@/data/types";
import { GlassCard } from "./GlassCard";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const DEFAULT_VIEW = { coordinates: [15, 18] as [number, number], zoom: 1.05 };

type LocationCluster = {
  id: string;
  coordinates: [number, number];
  count: number;
  label: string;
  locations: LocationRecord[];
};

function buildClusters(locations: LocationRecord[]): LocationCluster[] {
  const byCoordinate = new Map<string, LocationCluster>();

  for (const location of locations) {
    const key = `${location.coordinates[0].toFixed(2)},${location.coordinates[1].toFixed(2)}`;
    const existing = byCoordinate.get(key);
    if (existing) {
      existing.count += 1;
      existing.locations.push(location);
      existing.label = existing.count > 1 ? `${location.city} +${existing.count - 1}` : location.city;
      continue;
    }

    byCoordinate.set(key, {
      id: key,
      coordinates: location.coordinates,
      count: 1,
      label: location.city,
      locations: [location],
    });
  }

  return Array.from(byCoordinate.values());
}

export function MapPanel({ locations, onSelect }: { locations: LocationRecord[]; onSelect: (location: LocationRecord) => void }) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const clusters = useMemo(() => buildClusters(locations), [locations]);
  const countryCount = useMemo(() => new Set(locations.map((location) => location.country)).size, [locations]);
  const regionCount = useMemo(() => new Set(locations.map((location) => location.region)).size, [locations]);

  const setZoom = (nextZoom: number) => {
    setView((current) => ({ ...current, zoom: Math.max(1, Math.min(5, nextZoom)) }));
  };

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

      <div className="map-shell relative min-h-[560px] overflow-hidden rounded-[28px] border border-cyan-100/16 bg-[#020710]/88 shadow-[inset_0_0_80px_rgba(45,212,191,.08)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(45,212,191,.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,.16),rgba(2,6,23,.88))]" />
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(103,232,249,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,.08)_1px,transparent_1px)] [background-size:38px_38px]" />

        <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-cyan-100/15 bg-[#07111d]/90 p-1 shadow-[0_18px_60px_rgba(0,0,0,.35)] backdrop-blur-xl">
          <button type="button" onClick={() => setZoom(view.zoom + 0.45)} className="rounded-full px-3 py-1 text-sm font-bold text-cyan-50 hover:bg-cyan-200/10">+</button>
          <button type="button" onClick={() => setZoom(view.zoom - 0.45)} className="rounded-full px-3 py-1 text-sm font-bold text-cyan-50 hover:bg-cyan-200/10">−</button>
          <button type="button" onClick={() => setView(DEFAULT_VIEW)} className="rounded-full px-3 py-1 text-xs font-semibold text-cyan-100/70 hover:bg-cyan-200/10">Reset</button>
        </div>

        <ComposableMap projectionConfig={{ rotate: [-8, 0, 0], scale: 166 }} style={{ width: "100%", height: "100%", minHeight: 560 }}>
          <defs>
            <filter id="mapGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <ZoomableGroup center={view.coordinates} zoom={view.zoom} minZoom={1} maxZoom={5} onMoveEnd={(position) => setView({ coordinates: position.coordinates as [number, number], zoom: position.zoom })}>
            <Geographies geography={geoUrl}>
              {({ geographies }) => geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="rgba(22, 78, 99, .56)"
                  stroke="rgba(165, 243, 252, .22)"
                  strokeWidth={0.45}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "rgba(45,212,191,.44)", outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))}
            </Geographies>

            {clusters.map((cluster) => {
              const radius = Math.min(28, 10 + cluster.count * 3);
              return (
                <Marker key={cluster.id} coordinates={cluster.coordinates} onClick={() => onSelect(cluster.locations[0])}>
                  <circle r={radius + 14} fill="rgba(45,212,191,.055)" filter="url(#mapGlow)" className="pointer-events-none" />
                  <circle r={radius} fill="rgba(45,212,191,.12)" stroke="rgba(103,232,249,.24)" strokeWidth={1} className="pointer-events-none" />
                  <circle r={5.5} fill="#b8fff7" stroke="rgba(255,255,255,.95)" strokeWidth={1.5} className="map-marker cursor-pointer" />
                  {cluster.count > 1 ? <text y={-12} textAnchor="middle" className="pointer-events-none fill-cyan-50 text-[10px] font-bold">{cluster.count}</text> : null}
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl border border-cyan-100/10 bg-[#07111d]/70 px-4 py-3 text-xs text-cyan-100/60 backdrop-blur-xl">
          <p className="font-semibold text-cyan-50">Operational coverage layer</p>
          <p className="mt-1">Marker glow scales by stacked locations at the same coordinate.</p>
        </div>
      </div>
    </GlassCard>
  );
}
