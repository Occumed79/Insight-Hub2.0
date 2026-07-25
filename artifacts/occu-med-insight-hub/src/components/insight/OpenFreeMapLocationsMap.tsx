import { useEffect, useMemo, useRef, useState } from "react";
import type { GeographicLocation } from "@/data/geographicFootprintApi";

const MAPLIBRE_VERSION = "5.12.0";
const MAPLIBRE_SCRIPT_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
const MAPLIBRE_CSS_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const MAP_SOURCE_ID = "insight-hub-locations";
const MAP_GLOW_LAYER_ID = "insight-hub-location-glow";
const MAP_POINT_LAYER_ID = "insight-hub-location-points";

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

type MapLibreEvent = {
  features?: Array<{
    properties?: Record<string, unknown>;
  }>;
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
  const longitude = Number(location.coordinates[0]);
  const latitude = Number(location.coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return [longitude, latitude];
}

function loadMapLibre(): Promise<MapLibreGlobal> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (window.__insightHubMapLibrePromise) return window.__insightHubMapLibrePromise;

  window.__insightHubMapLibrePromise = new Promise<MapLibreGlobal>((resolve, reject) => {
    let stylesheet = document.querySelector<HTMLLinkElement>(`link[data-maplibre-version="${MAPLIBRE_VERSION}"]`);
    if (!stylesheet) {
      stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = MAPLIBRE_CSS_URL;
      stylesheet.dataset.maplibreVersion = MAPLIBRE_VERSION;
      document.head.appendChild(stylesheet);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[data-maplibre-version="${MAPLIBRE_VERSION}"]`);
    if (existing) {
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

  return window.__insightHubMapLibrePromise;
}

function toGeoJson(locations: DisplayLocation[], selectedLocationId: number | null): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: locations.flatMap((location) => {
      const coordinates = coordinatesFor(location);
      if (!coordinates) return [];
      return [{
        type: "Feature" as const,
        id: location.id,
        geometry: {
          type: "Point" as const,
          coordinates,
        },
        properties: {
          locationId: location.id,
          selected: location.id === selectedLocationId,
          verified: location.reviewStatus === "verified",
          companyName: location.companyName,
          placeName: location.placeName,
        },
      }];
    }),
  };
}

function boundsFor(locations: DisplayLocation[]): [[number, number], [number, number]] | null {
  const coordinates = locations.map(coordinatesFor).filter((point): point is [number, number] => Boolean(point));
  if (coordinates.length === 0) return null;

  let west = coordinates[0][0];
  let east = coordinates[0][0];
  let south = coordinates[0][1];
  let north = coordinates[0][1];

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

  if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
    map.easeTo({ center: bounds[0], zoom: 9, duration: 650 });
    return;
  }

  map.fitBounds(bounds, {
    padding: { top: 82, right: 82, bottom: 82, left: 82 },
    maxZoom: 8.5,
    duration: 750,
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

    void loadMapLibre()
      .then((maplibregl) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: OPENFREEMAP_STYLE_URL,
          center: [0, 20],
          zoom: 1.45,
          minZoom: 1.2,
          maxZoom: 17,
          pitch: 0,
          bearing: 0,
          attributionControl: true,
          renderWorldCopies: false,
          maxBounds: [[-180, -85], [180, 85]],
          cooperativeGestures: false,
        });

        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");

        map.on("load", () => {
          if (cancelled) return;
          loadedRef.current = true;
          const initialData = toGeoJson(locationsRef.current, selectedLocationIdRef.current);
          map.addSource(MAP_SOURCE_ID, {
            type: "geojson",
            data: initialData,
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

          map.on("click", MAP_POINT_LAYER_ID, (event) => {
            const locationId = Number(event.features?.[0]?.properties?.locationId);
            if (Number.isInteger(locationId)) onSelectRef.current(locationId);
          });
          map.on("mouseenter", MAP_POINT_LAYER_ID, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", MAP_POINT_LAYER_ID, () => {
            map.getCanvas().style.cursor = "";
          });

          fitMap(map, locationsRef.current);
        });

        map.on("error", () => {
          if (!cancelled) setMapError("The token-free vector basemap could not be loaded from OpenFreeMap.");
        });
      })
      .catch((error) => {
        if (!cancelled) setMapError(error instanceof Error ? error.message : "The map renderer could not be loaded.");
      });

    return () => {
      cancelled = true;
      loadedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.getSource(MAP_SOURCE_ID)?.setData(geoJson);
    fitMap(map, locations);
  }, [geoJson, locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const observer = new ResizeObserver(() => map.resize());
    if (containerRef.current) observer.observe(containerRef.current);
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
