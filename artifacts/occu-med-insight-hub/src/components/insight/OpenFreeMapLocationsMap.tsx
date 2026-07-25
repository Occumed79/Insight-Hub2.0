import { useEffect, useMemo, useRef, useState } from "react";
import type { GeographicLocation } from "@/data/geographicFootprintApi";

const MAPLIBRE_VERSION = "5.24.0";
const MAPLIBRE_SCRIPT_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
const MAPLIBRE_CSS_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const MAP_SOURCE_ID = "insight-hub-locations";
const MAP_GLOW_LAYER_ID = "insight-hub-location-glow";
const MAP_POINT_LAYER_ID = "insight-hub-location-points";
const MAP_LOAD_TIMEOUT_MS = 20_000;

type DisplayLocation = GeographicLocation & {
  companyName: string;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: number;
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: {
      locationId: number;
      selected: boolean;
      verified: boolean;
      companyName: string;
      placeName: string;
    };
  }>;
};

type MapLibreGeoJsonSource = {
  setData(data: GeoJsonFeatureCollection): void;
};

type MapLibreEvent = {
  features?: Array<{
    properties?: Record<string, unknown>;
  }>;
  error?: Error;
};

type MapLibreMap = {
  addControl(control: unknown, position?: string): void;
  addSource(id: string, source: Record<string, unknown>): void;
  addLayer(layer: Record<string, unknown>): void;
  getSource(id: string): MapLibreGeoJsonSource | undefined;
  fitBounds(bounds: [[number, number], [number, number]], options?: Record<string, unknown>): void;
  easeTo(options: Record<string, unknown>): void;
  on(event: string, callback: (event?: MapLibreEvent) => void): void;
  on(event: string, layerId: string, callback: (event: MapLibreEvent) => void): void;
  remove(): void;
  resize(): void;
  getCanvas(): HTMLCanvasElement;
};

type MapLibreGlobal = {
  Map: new (options: Record<string, unknown>) => MapLibreMap;
  NavigationControl: new (options?: Record<string, unknown>) => unknown;
};

declare global {
  interface Window {
    maplibregl?: MapLibreGlobal;
    __insightHubMapLibrePromise?: Promise<MapLibreGlobal>;
  }
}

function coordinatesFor(location: GeographicLocation): [number, number] | null {
  if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) return null;

  const rawLongitude = location.coordinates[0];
  const rawLatitude = location.coordinates[1];
  if (rawLongitude === null || rawLongitude === undefined || rawLatitude === null || rawLatitude === undefined) return null;

  const longitude = Number(rawLongitude);
  const latitude = Number(rawLatitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -85 || latitude > 85) return null;

  return [longitude, latitude];
}

function locationIdFor(location: GeographicLocation): number | null {
  const value = Number(location.id);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function loadMapLibre(): Promise<MapLibreGlobal> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (window.__insightHubMapLibrePromise) return window.__insightHubMapLibrePromise;

  const promise = new Promise<MapLibreGlobal>((resolve, reject) => {
    let stylesheet = document.querySelector<HTMLLinkElement>(`link[data-maplibre-version="${MAPLIBRE_VERSION}"]`);
    if (!stylesheet) {
      stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = MAPLIBRE_CSS_URL;
      stylesheet.dataset.maplibreVersion = MAPLIBRE_VERSION;
      document.head.appendChild(stylesheet);
    }

    const staleScripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-maplibre-version]"))
      .filter((script) => script.dataset.maplibreVersion !== MAPLIBRE_VERSION);
    staleScripts.forEach((script) => script.remove());

    const existing = document.querySelector<HTMLScriptElement>(`script[data-maplibre-version="${MAPLIBRE_VERSION}"]`);
    if (existing) {
      if (window.maplibregl) {
        resolve(window.maplibregl);
        return;
      }
      existing.addEventListener("load", () => {
        if (window.maplibregl) resolve(window.maplibregl);
        else reject(new Error("MapLibre loaded without exposing its browser API."));
      }, { once: true });
      existing.addEventListener("error", () => reject(new Error("MapLibre could not be loaded from the CDN.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MAPLIBRE_SCRIPT_URL;
    script.async = true;
    script.dataset.maplibreVersion = MAPLIBRE_VERSION;
    script.addEventListener("load", () => {
      if (window.maplibregl) resolve(window.maplibregl);
      else reject(new Error("MapLibre loaded without exposing its browser API."));
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("MapLibre could not be loaded from the CDN.")), { once: true });
    document.head.appendChild(script);
  });

  window.__insightHubMapLibrePromise = promise.catch((error) => {
    window.__insightHubMapLibrePromise = undefined;
    throw error;
  });

  return window.__insightHubMapLibrePromise;
}

function toGeoJson(locations: DisplayLocation[], selectedLocationId: number | null): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: locations.flatMap((location) => {
      const coordinates = coordinatesFor(location);
      const locationId = locationIdFor(location);
      if (!coordinates || locationId === null) return [];

      return [{
        type: "Feature" as const,
        id: locationId,
        geometry: {
          type: "Point" as const,
          coordinates,
        },
        properties: {
          locationId,
          selected: locationId === selectedLocationId,
          verified: location.reviewStatus === "verified",
          companyName: String(location.companyName || "Unknown company"),
          placeName: String(location.placeName || "Unnamed location"),
        },
      }];
    }),
  };
}

function boundsFor(locations: DisplayLocation[]): [[number, number], [number, number]] | null {
  const coordinates = locations
    .map(coordinatesFor)
    .filter((point): point is [number, number] => point !== null);

  const first = coordinates[0];
  if (!first) return null;

  let west = first[0];
  let east = first[0];
  let south = first[1];
  let north = first[1];

  for (const [longitude, latitude] of coordinates.slice(1)) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }

  return [[west, south], [east, north]];
}

function fitMap(map: MapLibreMap, locations: DisplayLocation[]): void {
  const bounds = boundsFor(locations);
  if (!bounds) {
    map.easeTo({ center: [0, 20], zoom: 1.45, duration: 650 });
    return;
  }

  const [southwest, northeast] = bounds;
  if (southwest[0] === northeast[0] && southwest[1] === northeast[1]) {
    map.easeTo({ center: southwest, zoom: 9, duration: 650 });
    return;
  }

  map.fitBounds(bounds, {
    padding: { top: 82, right: 82, bottom: 82, left: 82 },
    maxZoom: 8.5,
    duration: 750,
  });
}

function addLocationLayers(map: MapLibreMap, data: GeoJsonFeatureCollection): void {
  map.addSource(MAP_SOURCE_ID, {
    type: "geojson",
    data,
  });

  map.addLayer({
    id: MAP_GLOW_LAYER_ID,
    type: "circle",
    source: MAP_SOURCE_ID,
    paint: {
      "circle-radius": ["case", ["get", "selected"], 18, 13],
      "circle-color": ["case", ["get", "verified"], "#10b981", "#06b6d4"],
      "circle-opacity": 0.2,
      "circle-blur": 0.72,
    },
  });

  map.addLayer({
    id: MAP_POINT_LAYER_ID,
    type: "circle",
    source: MAP_SOURCE_ID,
    paint: {
      "circle-radius": ["case", ["get", "selected"], 10, 7],
      "circle-color": ["case", ["get", "verified"], "#10b981", "#06b6d4"],
      "circle-opacity": 0.92,
      "circle-stroke-color": ["case", ["get", "selected"], "#ffffff", ["get", "verified"], "#a7f3d0", "#cffafe"],
      "circle-stroke-width": ["case", ["get", "selected"], 3, 2],
    },
  });
}

export function OpenFreeMapLocationsMap({
  locations,
  selectedLocationId,
  onSelectLocation,
}: {
  locations: DisplayLocation[];
  selectedLocationId: number | null;
  onSelectLocation: (locationId: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const onSelectRef = useRef(onSelectLocation);
  const locationsRef = useRef(locations);
  const selectedLocationIdRef = useRef(selectedLocationId);
  const [mapError, setMapError] = useState<string | null>(null);
  const geoJson = useMemo(() => toGeoJson(locations, selectedLocationId), [locations, selectedLocationId]);

  useEffect(() => {
    onSelectRef.current = onSelectLocation;
  }, [onSelectLocation]);

  useEffect(() => {
    locationsRef.current = locations;
    selectedLocationIdRef.current = selectedLocationId;
  }, [locations, selectedLocationId]);

  useEffect(() => {
    let cancelled = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;

    setMapError(null);

    void loadMapLibre()
      .then((maplibregl) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        let map: MapLibreMap;
        try {
          map = new maplibregl.Map({
            container: containerRef.current,
            style: OPENFREEMAP_STYLE_URL,
            center: [0, 20],
            zoom: 1.45,
            pitch: 0,
            bearing: 0,
            attributionControl: true,
            renderWorldCopies: false,
          });
        } catch (error) {
          throw new Error(`MapLibre initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }

        mapRef.current = map;

        try {
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        } catch (controlError) {
          console.warn("MapLibre navigation control could not be added:", controlError);
        }

        loadTimer = setTimeout(() => {
          if (!cancelled && !loadedRef.current) {
            setMapError("The OpenFreeMap vector style did not finish loading.");
          }
        }, MAP_LOAD_TIMEOUT_MS);

        map.on("load", () => {
          if (cancelled) return;

          try {
            loadedRef.current = true;
            if (loadTimer) clearTimeout(loadTimer);
            const initialData = toGeoJson(locationsRef.current, selectedLocationIdRef.current);
            addLocationLayers(map, initialData);

            map.on("click", MAP_POINT_LAYER_ID, (event) => {
              const locationId = Number(event.features?.[0]?.properties?.locationId);
              if (Number.isSafeInteger(locationId) && locationId >= 0) onSelectRef.current(locationId);
            });
            map.on("mouseenter", MAP_POINT_LAYER_ID, () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", MAP_POINT_LAYER_ID, () => {
              map.getCanvas().style.cursor = "";
            });

            fitMap(map, locationsRef.current);
          } catch (error) {
            setMapError(`The location layer could not be initialized: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        });

        map.on("error", (event) => {
          if (event?.error) console.error("MapLibre runtime error:", event.error);
        });
      })
      .catch((error) => {
        if (!cancelled) setMapError(error instanceof Error ? error.message : "The map renderer could not be loaded.");
      });

    return () => {
      cancelled = true;
      if (loadTimer) clearTimeout(loadTimer);
      loadedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    try {
      map.getSource(MAP_SOURCE_ID)?.setData(geoJson);
      fitMap(map, locations);
    } catch (error) {
      console.error("MapLibre location update failed:", error);
    }
  }, [geoJson, locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !containerRef.current) return;

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="locations-map h-full w-full" aria-label="Interactive company locations map">
      <div ref={containerRef} className="h-full w-full" />
      {mapError && (
        <div className="locations-map-error" role="status">
          <p>{mapError}</p>
          <p className="mt-1 text-[10px] opacity-70">Company locations remain available through the saved-company controls below.</p>
        </div>
      )}
    </div>
  );
}
