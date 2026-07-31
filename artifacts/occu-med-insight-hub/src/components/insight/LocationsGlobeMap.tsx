import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Globe2, Maximize2, Sparkles } from "lucide-react";

const MAPBOX_STYLE = "mapbox://styles/alexayvazian999/cms87mmb8000e01sndau9bs5g";
const MAPBOX_GL_VERSION = "3.25.0";
const MAPBOX_SCRIPT_URL = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`;
const MAPBOX_CSS_URL = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`;
const MAPBOX_LOAD_TIMEOUT_MS = 12_000;
const LOCATIONS_SOURCE_ID = "occu-med-location-points";
const LOCATIONS_GLOW_LAYER_ID = "occu-med-location-glow";
const LOCATIONS_HALO_LAYER_ID = "occu-med-location-halo";
const LOCATIONS_CORE_LAYER_ID = "occu-med-location-core";

type LngLat = [number, number];
type MapLayerFeature = { properties?: Record<string, unknown> };
type MapLayerEvent = { features?: MapLayerFeature[] };
type GeoJsonSource = { setData: (data: unknown) => void };

export type LocationsGlobePoint = {
  id: number;
  entityId: number;
  companyName: string;
  placeName: string;
  reviewStatus?: string;
  coordinates?: unknown;
};

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  addLayer: (layer: Record<string, unknown>, beforeId?: string) => void;
  addSource: (id: string, source: Record<string, unknown>) => void;
  fitBounds: (bounds: [LngLat, LngLat], options?: Record<string, unknown>) => void;
  flyTo: (options: Record<string, unknown>) => void;
  getCanvas: () => HTMLCanvasElement;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => GeoJsonSource | undefined;
  on: {
    (event: string, handler: (...args: unknown[]) => void): void;
    (event: string, layerId: string, handler: (event: MapLayerEvent) => void): void;
  };
  remove: () => void;
  resize: () => void;
  setFog: (fog: Record<string, unknown>) => void;
};

type MapboxGlobal = {
  Map: new (options: Record<string, unknown>) => MapboxMap;
  NavigationControl: new (options?: Record<string, unknown>) => unknown;
  AttributionControl: new (options?: Record<string, unknown>) => unknown;
};

declare global {
  interface Window { mapboxgl?: MapboxGlobal }
}

let mapboxLoader: Promise<MapboxGlobal> | null = null;

function loadMapboxGl(): Promise<MapboxGlobal> {
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (mapboxLoader) return mapboxLoader;

  const loader = new Promise<MapboxGlobal>((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPBOX_CSS_URL}"]`)) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = MAPBOX_CSS_URL;
      document.head.appendChild(stylesheet);
    }

    let timeoutId: number | null = null;
    const clearLoadTimeout = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = null;
    };
    const finish = () => {
      clearLoadTimeout();
      if (window.mapboxgl) resolve(window.mapboxgl);
      else reject(new Error("Mapbox GL loaded without exposing the browser API."));
    };
    const fail = (script: HTMLScriptElement) => {
      clearLoadTimeout();
      script.dataset.mapboxLoadState = "failed";
      reject(new Error("Mapbox GL could not be loaded."));
    };
    const watchScript = (script: HTMLScriptElement) => {
      script.addEventListener("load", () => {
        script.dataset.mapboxLoadState = "loaded";
        finish();
      }, { once: true });
      script.addEventListener("error", () => fail(script), { once: true });
      timeoutId = window.setTimeout(() => fail(script), MAPBOX_LOAD_TIMEOUT_MS);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${MAPBOX_SCRIPT_URL}"]`);
    if (existingScript) {
      if (window.mapboxgl) {
        finish();
        return;
      }
      if (existingScript.dataset.mapboxLoadState === "loaded") {
        reject(new Error("Mapbox GL loaded without exposing the browser API."));
        return;
      }
      if (existingScript.dataset.mapboxLoadState === "failed") existingScript.remove();
      else {
        watchScript(existingScript);
        return;
      }
    }

    const script = document.createElement("script");
    script.src = MAPBOX_SCRIPT_URL;
    script.async = true;
    script.dataset.mapboxLoadState = "loading";
    watchScript(script);
    document.head.appendChild(script);
  });

  mapboxLoader = loader;
  void loader.catch(() => {
    mapboxLoader = null;
  });
  return loader;
}

function coordinatesFor(location: LocationsGlobePoint): LngLat | null {
  if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) return null;
  const longitude = Number(location.coordinates[0]);
  const latitude = Number(location.coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [longitude, latitude];
}

const pinPalettes = [
  { fillColor: "#ec4899", borderColor: "#f9a8d4" },
  { fillColor: "#8b5cf6", borderColor: "#c4b5fd" },
  { fillColor: "#3b82f6", borderColor: "#93c5fd" },
  { fillColor: "#06b6d4", borderColor: "#67e8f9" },
  { fillColor: "#14b8a6", borderColor: "#5eead4" },
  { fillColor: "#22c55e", borderColor: "#86efac" },
  { fillColor: "#84cc16", borderColor: "#bef264" },
  { fillColor: "#eab308", borderColor: "#fde047" },
  { fillColor: "#f59e0b", borderColor: "#fcd34d" },
  { fillColor: "#f97316", borderColor: "#fdba74" },
  { fillColor: "#ef4444", borderColor: "#fca5a5" },
  { fillColor: "#d946ef", borderColor: "#f0abfc" },
];

function companyPinPalette(companyName: string) {
  const normalizedName = companyName.trim().toLowerCase() || "unknown-company";
  let hash = 2166136261;
  for (let index = 0; index < normalizedName.length; index += 1) {
    hash ^= normalizedName.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return pinPalettes[(hash >>> 0) % pinPalettes.length];
}

function locationsGeoJson(locations: LocationsGlobePoint[], selectedLocationId: number | null) {
  return {
    type: "FeatureCollection",
    features: locations.flatMap((location) => {
      const coordinates = coordinatesFor(location);
      if (!coordinates) return [];
      const palette = companyPinPalette(location.companyName);
      return [{
        type: "Feature",
        id: location.id,
        properties: {
          locationId: location.id,
          companyName: location.companyName,
          placeName: location.placeName,
          fillColor: palette.fillColor,
          borderColor: palette.borderColor,
          selected: location.id === selectedLocationId,
          verified: location.reviewStatus === "verified",
        },
        geometry: { type: "Point", coordinates },
      }];
    }),
  };
}

const lightParticles = Array.from({ length: 64 }, (_, index) => ({
  left: (index * 37 + 9) % 100,
  top: (index * 61 + 7) % 100,
  delay: (index % 13) * 28,
  duration: 620 + (index % 9) * 52,
  size: 3 + (index % 5) * 2,
  drift: -80 + (index % 11) * 16,
  hue: 168 + (index % 8) * 19,
}));

const globeCss = String.raw`
  .locations-mapbox-canvas,
  .locations-mapbox-canvas .mapboxgl-map,
  .locations-mapbox-canvas .mapboxgl-canvas-container,
  .locations-mapbox-canvas .mapboxgl-canvas { width: 100%; height: 100%; }
  .locations-mapbox-canvas .mapboxgl-canvas { outline: none; }
  .locations-mapbox-canvas .mapboxgl-ctrl-bottom-left,
  .locations-mapbox-canvas .mapboxgl-ctrl-bottom-right { z-index: 40; }
  .locations-mapbox-canvas .mapboxgl-ctrl-group {
    overflow: hidden; border: 1px solid rgba(207,250,254,.20); border-radius: 16px;
    background: rgba(4,15,28,.64); box-shadow: 0 16px 42px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.10);
    backdrop-filter: blur(18px) saturate(1.35); -webkit-backdrop-filter: blur(18px) saturate(1.35);
  }
  .locations-mapbox-canvas .mapboxgl-ctrl-group button { width: 36px; height: 36px; }
  .locations-mapbox-canvas .mapboxgl-ctrl-group button + button { border-top-color: rgba(207,250,254,.12); }
  .locations-mapbox-canvas .mapboxgl-ctrl-icon { filter: invert(1) brightness(1.7); }
  .locations-mapbox-canvas .mapboxgl-ctrl-attrib.mapboxgl-compact {
    min-height: 26px; min-width: 26px; margin: 0 0 8px 8px; border: 1px solid rgba(207,250,254,.16);
    border-radius: 999px; background-color: rgba(4,15,28,.72); box-shadow: 0 10px 28px rgba(0,0,0,.30);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  }
  .locations-mapbox-canvas .mapboxgl-ctrl-attrib.mapboxgl-compact-show {
    max-width: min(86vw, 520px); border-radius: 12px; color: rgba(224,247,250,.78);
  }
  .locations-mapbox-canvas .mapboxgl-ctrl-attrib a { color: rgba(224,247,250,.82); }
  .locations-mapbox-canvas .mapboxgl-ctrl-logo { margin: 0 0 8px 8px; opacity: .78; }
  .locations-light-burst {
    position: fixed; inset: 0; z-index: 1300; overflow: hidden; pointer-events: none;
    background: radial-gradient(circle at 50% 50%,rgba(255,255,255,.98),rgba(125,249,255,.58) 12%,rgba(82,126,255,.24) 28%,transparent 58%),
      radial-gradient(circle at 28% 32%,rgba(253,224,71,.46),transparent 26%), radial-gradient(circle at 72% 66%,rgba(216,180,254,.52),transparent 28%);
    animation: locations-portal-wash 1.12s cubic-bezier(.22,.8,.25,1) both;
  }
  .locations-light-burst::before,
  .locations-light-burst::after {
    content: ""; position: absolute; left: 50%; top: 50%; width: 24vmin; height: 24vmin;
    border: 2px solid rgba(255,255,255,.86); border-radius: 999px; transform: translate(-50%,-50%);
    box-shadow: 0 0 70px rgba(103,232,249,.78), inset 0 0 70px rgba(255,255,255,.46);
    animation: locations-portal-ring .88s cubic-bezier(.12,.78,.18,1) both;
  }
  .locations-light-burst::after { animation-delay: 90ms; }
  .locations-light-particle {
    position: absolute; left: calc(var(--particle-left) * 1%); top: calc(var(--particle-top) * 1%);
    width: calc(var(--particle-size) * 1px); height: calc(var(--particle-size) * 1px); border-radius: 999px;
    background: hsl(var(--particle-hue) 100% 76%); box-shadow: 0 0 8px hsl(var(--particle-hue) 100% 82%), 0 0 24px hsl(var(--particle-hue) 100% 66% / .82);
    animation: locations-confetti-light calc(var(--particle-duration) * 1ms) cubic-bezier(.16,.74,.2,1) calc(var(--particle-delay) * 1ms) both;
  }
  @keyframes locations-portal-wash {
    0% { opacity: 0; transform: scale(.72); filter: brightness(1); }
    28% { opacity: 1; transform: scale(1); filter: brightness(1.8); }
    62% { opacity: .96; filter: brightness(2.4); }
    100% { opacity: 0; transform: scale(1.2); filter: brightness(1.1); }
  }
  @keyframes locations-portal-ring {
    0% { opacity: 0; transform: translate(-50%,-50%) scale(.18); } 20% { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%,-50%) scale(8.4); }
  }
  @keyframes locations-confetti-light {
    0% { opacity: 0; transform: translate3d(0,0,0) scale(.2); } 24% { opacity: 1; }
    100% { opacity: 0; transform: translate3d(calc(var(--particle-drift) * 1px),-170px,0) scale(1.8); }
  }
`;

export function LocationsGlobeMap({
  locations,
  selectedLocationId,
  immersive,
  onSelectLocation,
  onEnterImmersive,
  onExitImmersive,
}: {
  locations: LocationsGlobePoint[];
  selectedLocationId: number | null;
  immersive: boolean;
  onSelectLocation: (locationId: number) => void;
  onEnterImmersive: () => void;
  onExitImmersive: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const selectLocationRef = useRef(onSelectLocation);
  const enterTimerRef = useRef<number | null>(null);
  const burstTimerRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [lightBurst, setLightBurst] = useState(false);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
  const mappableLocations = useMemo(() => locations.filter((location) => coordinatesFor(location)), [locations]);
  const pointData = useMemo(
    () => locationsGeoJson(mappableLocations, selectedLocationId),
    [mappableLocations, selectedLocationId],
  );

  useEffect(() => {
    selectLocationRef.current = onSelectLocation;
  }, [onSelectLocation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    if (!token) {
      setMapError("The Mapbox access token is not configured.");
      return undefined;
    }

    let disposed = false;
    void loadMapboxGl().then((mapboxgl) => {
      if (disposed || !containerRef.current) return;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        accessToken: token,
        style: MAPBOX_STYLE,
        projection: "globe",
        center: [0, 18],
        zoom: 1.35,
        minZoom: 0.8,
        maxZoom: 16,
        antialias: true,
        attributionControl: false,
        logoPosition: "bottom-left",
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

      map.on("style.load", () => map.setFog({
        color: "rgb(186, 226, 255)",
        "high-color": "rgb(36, 92, 223)",
        "horizon-blend": 0.12,
        "space-color": "rgb(1, 5, 15)",
        "star-intensity": 0.32,
      }));

      map.on("load", () => {
        if (disposed) return;
        map.addSource(LOCATIONS_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: LOCATIONS_GLOW_LAYER_ID,
          type: "circle",
          source: LOCATIONS_SOURCE_ID,
          paint: {
            "circle-radius": ["case", ["boolean", ["get", "selected"], false], 20, ["boolean", ["get", "verified"], false], 13, 11],
            "circle-color": ["get", "fillColor"],
            "circle-opacity": ["case", ["boolean", ["get", "selected"], false], 0.48, 0.30],
            "circle-blur": 0.78,
            "circle-emissive-strength": 1,
          },
        });
        map.addLayer({
          id: LOCATIONS_HALO_LAYER_ID,
          type: "circle",
          source: LOCATIONS_SOURCE_ID,
          paint: {
            "circle-radius": ["case", ["boolean", ["get", "selected"], false], 11, ["boolean", ["get", "verified"], false], 8.5, 7.5],
            "circle-color": "rgba(2, 8, 23, 0.72)",
            "circle-stroke-color": ["get", "borderColor"],
            "circle-stroke-width": ["case", ["boolean", ["get", "selected"], false], 4, ["boolean", ["get", "verified"], false], 3.2, 2.4],
            "circle-opacity": 0.96,
            "circle-emissive-strength": 1,
          },
        });
        map.addLayer({
          id: LOCATIONS_CORE_LAYER_ID,
          type: "circle",
          source: LOCATIONS_SOURCE_ID,
          paint: {
            "circle-radius": ["case", ["boolean", ["get", "selected"], false], 6.5, 4.5],
            "circle-color": ["get", "fillColor"],
            "circle-stroke-color": ["case", ["boolean", ["get", "selected"], false], "#ffffff", ["get", "borderColor"]],
            "circle-stroke-width": ["case", ["boolean", ["get", "selected"], false], 2.5, 1.5],
            "circle-emissive-strength": 1,
          },
        });

        const selectFeature = (event: MapLayerEvent) => {
          const locationId = Number(event.features?.[0]?.properties?.locationId);
          if (Number.isFinite(locationId)) selectLocationRef.current(locationId);
        };
        map.on("click", LOCATIONS_HALO_LAYER_ID, selectFeature);
        map.on("mouseenter", LOCATIONS_HALO_LAYER_ID, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", LOCATIONS_HALO_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
        });
        setMapReady(true);
      });
      mapRef.current = map;
    }).catch((loadError) => {
      if (!disposed) setMapError(loadError instanceof Error ? loadError.message : "The Mapbox globe could not be loaded.");
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mapRef.current.getSource(LOCATIONS_SOURCE_ID)?.setData(pointData);
  }, [mapReady, pointData]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const points = mappableLocations.map(coordinatesFor).filter((point): point is LngLat => Boolean(point));
    if (points.length === 0) {
      mapRef.current.flyTo({ center: [0, 18], zoom: immersive ? 1.55 : 1.25, duration: 1000 });
      return;
    }
    if (points.length === 1) {
      mapRef.current.flyTo({ center: points[0], zoom: immersive ? 5.4 : 4.4, duration: 1100 });
      return;
    }
    const longitudes = points.map(([longitude]) => longitude);
    const latitudes = points.map(([, latitude]) => latitude);
    mapRef.current.fitBounds([
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ], { padding: immersive ? 120 : 76, maxZoom: immersive ? 5.6 : 4.8, duration: 1200 });
  }, [immersive, mapReady, mappableLocations]);

  useEffect(() => {
    const resizeMap = () => mapRef.current?.resize();
    const firstFrame = window.requestAnimationFrame(resizeMap);
    const settleTimer = window.setTimeout(resizeMap, 560);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(settleTimer);
    };
  }, [immersive]);

  useEffect(() => {
    if (!immersive) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[aria-label="Close location details"]')) return;
      onExitImmersive();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [immersive, onExitImmersive]);

  useEffect(() => () => {
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
    if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
  }, []);

  function enterImmersiveWorld() {
    if (immersive || lightBurst) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onEnterImmersive();
      return;
    }
    setLightBurst(true);
    enterTimerRef.current = window.setTimeout(onEnterImmersive, 420);
    burstTimerRef.current = window.setTimeout(() => setLightBurst(false), 1120);
  }

  return (
    <>
      <style>{globeCss}</style>
      <div ref={containerRef} className="locations-mapbox-canvas absolute inset-0" />
      {!mapReady && !mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#020711] text-sm font-semibold text-cyan-50/68">
          <span className="inline-flex items-center gap-3 rounded-full border border-cyan-100/14 bg-[#06101d]/72 px-5 py-3 backdrop-blur-xl">
            <Globe2 size={17} className="animate-pulse text-cyan-200" /> Loading the Mapbox world…
          </span>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#020711] px-6 text-center">
          <div className="max-w-md rounded-[24px] border border-rose-200/18 bg-rose-300/[0.07] px-6 py-5 text-sm leading-6 text-rose-100">{mapError}</div>
        </div>
      )}
      {!immersive && (
        <button type="button" onClick={enterImmersiveWorld} className="absolute right-5 top-5 z-[670] inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-100/24 bg-[#07101d]/68 px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-50/84 shadow-[0_16px_48px_rgba(0,0,0,.38),0_0_32px_rgba(34,211,238,.16),inset_0_1px_0_rgba(255,255,255,.16)] backdrop-blur-2xl transition hover:border-cyan-100/44 hover:bg-cyan-300/[0.12] hover:text-white">
          <Sparkles size={14} className="text-amber-100" /> Enter immersive globe <Maximize2 size={14} className="text-cyan-100/72" />
        </button>
      )}
      {immersive && (
        <button type="button" onClick={onExitImmersive} className="absolute left-5 top-5 z-[690] inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-100/24 bg-[#030a15]/72 px-4 text-xs font-bold text-cyan-50/88 shadow-[0_18px_54px_rgba(0,0,0,.48),0_0_34px_rgba(34,211,238,.14),inset_0_1px_0_rgba(255,255,255,.16)] backdrop-blur-2xl transition hover:border-cyan-100/44 hover:bg-cyan-300/[0.12] hover:text-white">
          <ArrowLeft size={16} /> Back to Locations
        </button>
      )}
      {lightBurst && (
        <div className="locations-light-burst" aria-hidden="true">
          {lightParticles.map((particle, index) => (
            <span key={index} className="locations-light-particle" style={{
              "--particle-left": particle.left,
              "--particle-top": particle.top,
              "--particle-delay": particle.delay,
              "--particle-duration": particle.duration,
              "--particle-size": particle.size,
              "--particle-drift": particle.drift,
              "--particle-hue": particle.hue,
            } as CSSProperties} />
          ))}
        </div>
      )}
    </>
  );
}
