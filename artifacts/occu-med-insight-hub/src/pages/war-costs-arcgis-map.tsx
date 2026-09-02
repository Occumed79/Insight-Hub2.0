import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPinned } from "lucide-react";
import { GlassCard } from "@/components/insight/GlassCard";
import { wcConflictCost, wcConflictName, wcMoney, wcNumber, wcStringArray, wcText, type WarCostsRow } from "./war-costs-utils";

declare global {
  interface Window {
    $arcgis?: { import: (modules: string | string[]) => Promise<any> };
    esriConfig?: { apiKey?: string };
  }
}

const ARCGIS_VERSION = "5.1";
const ARCGIS_SCRIPT = `https://js.arcgis.com/${ARCGIS_VERSION}/`;
const ARCGIS_CSS = `https://js.arcgis.com/${ARCGIS_VERSION}/esri/themes/dark/main.css`;
const GEOCODE_URL = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

async function loadArcGis(apiKey: string) {
  let css = document.querySelector<HTMLLinkElement>(`link[href="${ARCGIS_CSS}"]`);
  if (!css) {
    css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = ARCGIS_CSS;
    css.dataset.arcgisWarCosts = "true";
    document.head.appendChild(css);
  }
  window.esriConfig = { ...(window.esriConfig ?? {}), apiKey };
  if (!window.$arcgis) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-arcgis-war-costs="true"]');
      const done = () => window.$arcgis ? resolve() : reject(new Error("ArcGIS SDK did not initialize."));
      if (existing) {
        existing.addEventListener("load", done, { once: true });
        existing.addEventListener("error", () => reject(new Error("ArcGIS SDK failed to load.")), { once: true });
        setTimeout(() => window.$arcgis && resolve(), 0);
        return;
      }
      const script = document.createElement("script");
      script.type = "module";
      script.src = ARCGIS_SCRIPT;
      script.dataset.arcgisWarCosts = "true";
      script.addEventListener("load", done, { once: true });
      script.addEventListener("error", () => reject(new Error("ArcGIS SDK failed to load.")), { once: true });
      document.head.appendChild(script);
    });
  }
  if (!window.$arcgis) throw new Error("ArcGIS SDK is unavailable.");
  const config = await window.$arcgis.import("@arcgis/core/config.js");
  config.apiKey = apiKey;
  return window.$arcgis;
}

async function geocode(label: string, apiKey: string): Promise<[number, number] | null> {
  const params = new URLSearchParams({
    SingleLine: label,
    maxLocations: "1",
    outFields: "Match_addr,Addr_type",
    forStorage: "false",
    f: "json",
    token: apiKey,
  });
  const response = await fetch(`${GEOCODE_URL}?${params.toString()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const location = payload?.candidates?.[0]?.location;
  return Number.isFinite(location?.x) && Number.isFinite(location?.y) ? [location.x, location.y] : null;
}

function activeConflict(row: WarCostsRow) {
  const status = wcText(row, "status").toLowerCase();
  return status.includes("ongoing") || status.includes("active") || !wcNumber(row, "endYear");
}

export function WarCostsArcGisMap({ conflicts, baseCountries }: { conflicts: WarCostsRow[]; baseCountries: WarCostsRow[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapped, setMapped] = useState({ conflicts: 0, bases: 0 });

  const conflictRows = useMemo(() => conflicts.filter(activeConflict).slice(0, 20), [conflicts]);
  const baseRows = useMemo(() => [...baseCountries].sort((a, b) => wcNumber(b, "total", "bases", "installations") - wcNumber(a, "total", "bases", "installations")).slice(0, 45), [baseCountries]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const configResponse = await fetch("/api/war-costs/arcgis-config", { cache: "no-store" });
        const config = await configResponse.json().catch(() => ({}));
        if (!configResponse.ok || !config?.configured || !config?.apiKey) throw new Error("ARCGIS_API_KEY is not configured on this service.");
        const arcgis = await loadArcGis(config.apiKey);
        if (cancelled || !hostRef.current) return;
        const [EsriMap, MapView, GraphicsLayer, Graphic] = await arcgis.import([
          "@arcgis/core/Map.js",
          "@arcgis/core/views/MapView.js",
          "@arcgis/core/layers/GraphicsLayer.js",
          "@arcgis/core/Graphic.js",
        ]);
        if (cancelled || !hostRef.current) return;

        if (!viewRef.current) {
          const map = new EsriMap({ basemap: "dark-gray-vector" });
          const layer = new GraphicsLayer({ title: "WarCosts intelligence" });
          map.add(layer);
          layerRef.current = layer;
          viewRef.current = new MapView({
            container: hostRef.current,
            map,
            center: [12, 23],
            zoom: 1.6,
            constraints: { minZoom: 1 },
            popup: { dockEnabled: false },
          });
          await viewRef.current.when();
        }

        const layer = layerRef.current;
        layer?.removeAll();
        let conflictCount = 0;
        let baseCount = 0;

        const cache = new Map<string, [number, number] | null>();
        const locate = async (place: string) => {
          if (cache.has(place)) return cache.get(place) ?? null;
          const location = await geocode(place, config.apiKey).catch(() => null);
          cache.set(place, location);
          return location;
        };

        for (const row of baseRows) {
          const country = wcText(row, "country", "countryName", "name");
          if (!country) continue;
          const point = await locate(country);
          if (!point || cancelled) continue;
          const installations = wcNumber(row, "total", "bases", "installations");
          layer.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [103, 232, 249, 0.72], size: Math.max(7, Math.min(20, 7 + Math.log10(Math.max(1, installations)) * 4)), outline: { color: [224, 247, 250, 0.8], width: 0.7 } },
            attributes: { title: country, type: "Military presence", installations },
            popupTemplate: { title: "{title}", content: `<b>US military presence</b><br/>Installations / source total: ${installations.toLocaleString()}` },
          }));
          baseCount += 1;
        }

        for (const row of conflictRows) {
          const countries = wcStringArray(row, "countries");
          const place = countries[0] || wcText(row, "country", "location", "region");
          if (!place) continue;
          const point = await locate(place);
          if (!point || cancelled) continue;
          const name = wcConflictName(row);
          const cost = wcConflictCost(row);
          layer.add(new Graphic({
            geometry: { type: "point", longitude: point[0], latitude: point[1] },
            symbol: { type: "simple-marker", color: [251, 113, 133, 0.92], size: 14, outline: { color: [255, 228, 230, 0.95], width: 1.2 } },
            attributes: { title: name, type: "Active conflict", place },
            popupTemplate: { title: "{title}", content: `<b>Active / ongoing conflict</b><br/>Location: ${place}<br/>Adjusted cost: ${wcMoney(cost)}` },
          }));
          conflictCount += 1;
        }
        if (!cancelled) setMapped({ conflicts: conflictCount, bases: baseCount });
      } catch (mapError) {
        if (!cancelled) setError(mapError instanceof Error ? mapError.message : "ArcGIS map failed to initialize.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [baseRows, conflictRows]);

  useEffect(() => () => {
    viewRef.current?.destroy?.();
    viewRef.current = null;
    layerRef.current = null;
  }, []);

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-5">
        <div><p className="text-[10px] uppercase tracking-[.22em] text-cyan-100/35">ArcGIS intelligence map</p><h3 className="mt-1 text-lg font-black text-white">Global WarCosts map</h3><p className="mt-1 text-[10px] text-cyan-100/38">ArcGIS Maps SDK 5.1 · World Geocoding · interactive pan, zoom and popups</p></div>
        <div className="flex gap-2 text-[9px]"><span className="rounded-full border border-rose-200/15 bg-rose-300/8 px-2.5 py-1 text-rose-100">{mapped.conflicts} conflicts</span><span className="rounded-full border border-cyan-200/15 bg-cyan-300/8 px-2.5 py-1 text-cyan-100">{mapped.bases} presence points</span></div>
      </div>
      <div className="relative h-[660px] bg-[#020611]">
        <div ref={hostRef} className="h-full w-full" aria-label="ArcGIS map of WarCosts conflicts and military presence" />
        {loading && <div className="absolute inset-0 grid place-items-center bg-[#020611]/80"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-200" /><p className="mt-3 text-xs font-bold text-cyan-50">Building ArcGIS WarCosts layers…</p></div></div>}
        {error && <div className="absolute left-4 top-4 max-w-md rounded-xl border border-rose-200/20 bg-[#1a070d]/95 p-3 text-xs text-rose-100"><div className="flex gap-2"><MapPinned size={15} className="shrink-0" /><span>{error}</span></div></div>}
      </div>
    </GlassCard>
  );
}
