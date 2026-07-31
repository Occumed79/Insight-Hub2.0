import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Globe2, Maximize2, Sparkles } from "lucide-react";

const MAPBOX_STYLE = "mapbox://styles/alexayvazian999/cms87mmb8000e01sndau9bs5g";
const MAPBOX_GL_VERSION = "3.25.0";
const MAPBOX_SCRIPT_URL = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`;
const MAPBOX_CSS_URL = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`;

type LngLat = [number, number];

export type LocationsGlobePoint = {
  id: number;
  entityId: number;
  companyName: string;
  placeName: string;
  reviewStatus?: string;
  coordinates?: unknown;
};

type MapboxMarker = {
  remove: () => void;
};

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  fitBounds: (bounds: [LngLat, LngLat], options?: Record<string, unknown>) => void;
  flyTo: (options: Record<string, unknown>) => void;
  on: (event: string, handler: () => void) => void;
  remove: () => void;
  resize: () => void;
  setFog: (fog: Record<string, unknown>) => void;
};

type MapboxGlobal = {
  accessToken: string;
  Map: new (options: Record<string, unknown>) => MapboxMap;
  Marker: new (options: { element: HTMLElement; anchor?: string }) => {
    setLngLat: (coordinates: LngLat) => {
      addTo: (map: MapboxMap) => MapboxMarker;
    };
  };
  NavigationControl: new (options?: Record<string, unknown>) => unknown;
};

declare global {
  interface Window {
    mapboxgl?: MapboxGlobal;
  }
}

let mapboxLoader: Promise<MapboxGlobal> | null = null;

function loadMapboxGl(): Promise<MapboxGlobal> {
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (mapboxLoader) return mapboxLoader;

  mapboxLoader = new Promise<MapboxGlobal>((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPBOX_CSS_URL}"]`)) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = MAPBOX_CSS_URL;
      document.head.appendChild(stylesheet);
    }

    const finish = () => {
      if (window.mapboxgl) {
        resolve(window.mapboxgl);
      } else {
        reject(new Error("Mapbox GL loaded without exposing the browser API."));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${MAPBOX_SCRIPT_URL}"]`);
    if (existingScript) {
      if (window.mapboxgl) {
        finish();
        return;
      }
      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Mapbox GL could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MAPBOX_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Mapbox GL could not be loaded.")), { once: true });
    document.head.appendChild(script);
  });

  return mapboxLoader;
}

function coordinatesFor(location: LocationsGlobePoint): LngLat | null {
  if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) return null;
  const longitude = Number(location.coordinates[0]);
  const latitude = Number(location.coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [longitude, latitude];
}

function companyPinPalette(companyName: string) {
  const normalizedName = companyName.trim().toLowerCase() || "unknown-company";
  let hash = 2166136261;

  for (let index = 0; index < normalizedName.length; index += 1) {
    hash ^= normalizedName.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const unsignedHash = hash >>> 0;
  const hue = (unsignedHash / 0xffffffff) * 360;
  const saturation = 72 + ((unsignedHash >>> 8) % 17);
  const lightness = 44 + ((unsignedHash >>> 16) % 10);

  return {
    fillColor: `hsl(${hue.toFixed(2)} ${saturation}% ${lightness}%)`,
    borderColor: `hsl(${hue.toFixed(2)} ${Math.min(saturation + 5, 94)}% ${Math.min(lightness + 27, 82)}%)`,
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
  .locations-mapbox-canvas .mapboxgl-canvas {
    width: 100%;
    height: 100%;
  }

  .locations-mapbox-canvas .mapboxgl-canvas {
    outline: none;
  }

  .locations-mapbox-canvas .mapboxgl-ctrl-bottom-left,
  .locations-mapbox-canvas .mapboxgl-ctrl-bottom-right {
    z-index: 40;
  }

  .locations-mapbox-canvas .mapboxgl-ctrl-group {
    overflow: hidden;
    border: 1px solid rgba(207, 250, 254, .20);
    border-radius: 16px;
    background: rgba(4, 15, 28, .64);
    box-shadow: 0 16px 42px rgba(0, 0, 0, .34), inset 0 1px 0 rgba(255, 255, 255, .10);
    backdrop-filter: blur(18px) saturate(1.35);
    -webkit-backdrop-filter: blur(18px) saturate(1.35);
  }

  .locations-mapbox-canvas .mapboxgl-ctrl-group button {
    width: 36px;
    height: 36px;
  }

  .locations-mapbox-canvas .mapboxgl-ctrl-group button + button {
    border-top-color: rgba(207, 250, 254, .12);
  }

  .locations-mapbox-canvas .mapboxgl-ctrl-icon {
    filter: invert(1) brightness(1.7);
  }

  .locations-mapbox-marker {
    position: relative;
    width: 18px;
    height: 18px;
    padding: 0;
    cursor: pointer;
    border: 3px solid var(--pin-border);
    border-radius: 999px;
    background: var(--pin-fill);
    box-shadow:
      0 0 0 2px rgba(2, 8, 23, .62),
      0 0 18px color-mix(in srgb, var(--pin-fill) 80%, transparent),
      0 8px 22px rgba(0, 0, 0, .46);
    transition: width .18s ease, height .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }

  .locations-mapbox-marker::after {
    content: "";
    position: absolute;
    inset: -8px;
    border: 1px solid color-mix(in srgb, var(--pin-border) 60%, transparent);
    border-radius: inherit;
    opacity: .45;
    animation: locations-pin-pulse 2.4s ease-out infinite;
  }

  .locations-mapbox-marker:hover,
  .locations-mapbox-marker[data-active="true"] {
    width: 26px;
    height: 26px;
    border-color: white;
    box-shadow:
      0 0 0 3px rgba(2, 8, 23, .72),
      0 0 30px var(--pin-fill),
      0 12px 30px rgba(0, 0, 0, .54);
  }

  .locations-mapbox-marker[data-saved="true"] {
    border-width: 4px;
  }

  .locations-light-burst {
    position: fixed;
    inset: 0;
    z-index: 1300;
    overflow: hidden;
    pointer-events: none;
    background:
      radial-gradient(circle at 50% 50%, rgba(255,255,255,.98), rgba(125,249,255,.58) 12%, rgba(82,126,255,.24) 28%, transparent 58%),
      radial-gradient(circle at 28% 32%, rgba(253,224,71,.46), transparent 26%),
      radial-gradient(circle at 72% 66%, rgba(216,180,254,.52), transparent 28%);
    animation: locations-portal-wash 1.12s cubic-bezier(.22,.8,.25,1) both;
  }

  .locations-light-burst::before,
  .locations-light-burst::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 24vmin;
    height: 24vmin;
    border: 2px solid rgba(255,255,255,.86);
    border-radius: 999px;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 70px rgba(103,232,249,.78), inset 0 0 70px rgba(255,255,255,.46);
    animation: locations-portal-ring .88s cubic-bezier(.12,.78,.18,1) both;
  }

  .locations-light-burst::after {
    animation-delay: 90ms;
  }

  .locations-light-particle {
    position: absolute;
    left: calc(var(--particle-left) * 1%);
    top: calc(var(--particle-top) * 1%);
    width: calc(var(--particle-size) * 1px);
    height: calc(var(--particle-size) * 1px);
    border-radius: 999px;
    background: hsl(var(--particle-hue) 100% 76%);
    box-shadow:
      0 0 8px hsl(var(--particle-hue) 100% 82%),
      0 0 24px hsl(var(--particle-hue) 100% 66% / .82);
    animation: locations-confetti-light calc(var(--particle-duration) * 1ms) cubic-bezier(.16,.74,.2,1) calc(var(--particle-delay) * 1ms) both;
  }

  @keyframes locations-pin-pulse {
    0% { transform: scale(.55); opacity: .78; }
    72%, 100% { transform: scale(1.5); opacity: 0; }
  }

  @keyframes locations-portal-wash {
    0% { opacity: 0; transform: scale(.72); filter: brightness(1); }
    28% { opacity: 1; transform: scale(1); filter: brightness(1.8); }
    62% { opacity: .96; filter: brightness(2.4); }
    100% { opacity: 0; transform: scale(1.2); filter: brightness(1.1); }
  }

  @keyframes locations-portal-ring {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(.18); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(8.4); }
  }

  @keyframes locations-confetti-light {
    0% { opacity: 0; transform: translate3d(0, 0, 0) scale(.2); }
    24% { opacity: 1; }
    100% {
      opacity: 0;
      transform: translate3d(calc(var(--particle-drift) * 1px), -170px, 0) scale(1.8);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .locations-mapbox-marker::after,
    .locations-light-burst,
    .locations-light-burst::before,
    .locations-light-burst::after,
    .locations-light-particle {
      animation: none !important;
    }
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
  const markersRef = useRef<MapboxMarker[]>([]);
  const enterTimerRef = useRef<number | null>(null);
  const burstTimerRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [lightBurst, setLightBurst] = useState(false);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

  const mappableLocations = useMemo(
    () => locations.filter((location) => coordinatesFor(location)),
    [locations],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    if (!token) {
      setMapError("The Mapbox access token is not configured.");
      return undefined;
    }

    let disposed = false;

    void loadMapboxGl()
      .then((mapboxgl) => {
        if (disposed || !containerRef.current) return;

        mapboxgl.accessToken = token;
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: MAPBOX_STYLE,
          projection: "globe",
          center: [0, 18],
          zoom: 1.35,
          minZoom: 0.8,
          maxZoom: 16,
          antialias: true,
          attributionControl: true,
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
        map.on("style.load", () => {
          map.setFog({
            color: "rgb(186, 226, 255)",
            "high-color": "rgb(36, 92, 223)",
            "horizon-blend": 0.12,
            "space-color": "rgb(1, 5, 15)",
            "star-intensity": 0.32,
          });
        });
        map.on("load", () => {
          if (!disposed) setMapReady(true);
        });

        mapRef.current = map;
      })
      .catch((loadError) => {
        if (!disposed) {
          setMapError(loadError instanceof Error ? loadError.message : "The Mapbox globe could not be loaded.");
        }
      });

    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    for (const location of mappableLocations) {
      const coordinates = coordinatesFor(location);
      if (!coordinates || !window.mapboxgl) continue;

      const palette = companyPinPalette(location.companyName);
      const element = document.createElement("button");
      element.type = "button";
      element.className = "locations-mapbox-marker";
      element.title = `${location.companyName} — ${location.placeName}`;
      element.setAttribute("aria-label", `Open ${location.placeName} for ${location.companyName}`);
      element.dataset.active = String(location.id === selectedLocationId);
      element.dataset.saved = String(location.reviewStatus === "verified");
      element.style.setProperty("--pin-fill", palette.fillColor);
      element.style.setProperty("--pin-border", palette.borderColor);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectLocation(location.id);
      });

      const marker = new window.mapboxgl.Marker({ element, anchor: "center" })
        .setLngLat(coordinates)
        .addTo(mapRef.current as MapboxMap);
      markersRef.current.push(marker);
    }
  }, [mapReady, mappableLocations, onSelectLocation, selectedLocationId]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const points = mappableLocations
      .map(coordinatesFor)
      .filter((coordinates): coordinates is LngLat => Boolean(coordinates));

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
    const bounds: [LngLat, LngLat] = [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ];

    mapRef.current.fitBounds(bounds, {
      padding: immersive ? 120 : 76,
      maxZoom: immersive ? 5.6 : 4.8,
      duration: 1200,
    });
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
      if (event.key === "Escape") onExitImmersive();
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
    setLightBurst(true);

    enterTimerRef.current = window.setTimeout(() => {
      onEnterImmersive();
    }, 420);

    burstTimerRef.current = window.setTimeout(() => {
      setLightBurst(false);
    }, 1120);
  }

  return (
    <>
      <style>{globeCss}</style>
      <div ref={containerRef} className="locations-mapbox-canvas absolute inset-0" />

      {!mapReady && !mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#020711] text-sm font-semibold text-cyan-50/68">
          <span className="inline-flex items-center gap-3 rounded-full border border-cyan-100/14 bg-[#06101d]/72 px-5 py-3 backdrop-blur-xl">
            <Globe2 size={17} className="animate-pulse text-cyan-200" />
            Loading the Mapbox world…
          </span>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#020711] px-6 text-center">
          <div className="max-w-md rounded-[24px] border border-rose-200/18 bg-rose-300/[0.07] px-6 py-5 text-sm leading-6 text-rose-100">
            {mapError}
          </div>
        </div>
      )}

      {!immersive && (
        <button
          type="button"
          onClick={enterImmersiveWorld}
          className="absolute right-5 top-5 z-[670] inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-100/24 bg-[#07101d]/68 px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-50/84 shadow-[0_16px_48px_rgba(0,0,0,.38),0_0_32px_rgba(34,211,238,.16),inset_0_1px_0_rgba(255,255,255,.16)] backdrop-blur-2xl transition hover:border-cyan-100/44 hover:bg-cyan-300/[0.12] hover:text-white"
        >
          <Sparkles size={14} className="text-amber-100" />
          Enter immersive globe
          <Maximize2 size={14} className="text-cyan-100/72" />
        </button>
      )}

      {immersive && (
        <button
          type="button"
          onClick={onExitImmersive}
          className="absolute left-5 top-5 z-[690] inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-100/24 bg-[#030a15]/72 px-4 text-xs font-bold text-cyan-50/88 shadow-[0_18px_54px_rgba(0,0,0,.48),0_0_34px_rgba(34,211,238,.14),inset_0_1px_0_rgba(255,255,255,.16)] backdrop-blur-2xl transition hover:border-cyan-100/44 hover:bg-cyan-300/[0.12] hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Locations
        </button>
      )}

      {lightBurst && (
        <div className="locations-light-burst" aria-hidden="true">
          {lightParticles.map((particle, index) => (
            <span
              key={index}
              className="locations-light-particle"
              style={{
                "--particle-left": particle.left,
                "--particle-top": particle.top,
                "--particle-delay": particle.delay,
                "--particle-duration": particle.duration,
                "--particle-size": particle.size,
                "--particle-drift": particle.drift,
                "--particle-hue": particle.hue,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
    </>
  );
}
