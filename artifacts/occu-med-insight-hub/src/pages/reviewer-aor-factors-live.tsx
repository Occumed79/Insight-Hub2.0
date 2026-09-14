import { useLayoutEffect } from "react";
import ReviewerAorFactorsV3 from "./reviewer-aor-factors-v3";

export { default as LegacyAorFactorsV2 } from "./reviewer-aor-factors-v2";

declare global {
  interface Window {
    maptilersdk?: any;
  }
}

const AOR_PATCH_FLAG = "__insightHubAorProjectionPatched";

function createProjectionControl(map: any) {
  const root = document.createElement("div");
  root.className = "maplibregl-ctrl maplibregl-ctrl-group aor-projection-control";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "AOR map dimensional view");
  Object.assign(root.style, {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    padding: "3px",
    border: "1px solid rgba(165,243,252,.18)",
    borderRadius: "8px",
    background: "rgba(3,9,15,.90)",
    boxShadow: "0 12px 34px rgba(0,0,0,.34)",
    backdropFilter: "blur(16px)",
    position: "relative",
    zIndex: "30",
    pointerEvents: "auto",
  });

  const buttons = new Map<"2d" | "3d", HTMLButtonElement>();
  const setMode = (mode: "2d" | "3d") => {
    const projection = mode === "3d" ? "globe" : "mercator";
    map.setProjection?.(projection);
    map.easeTo?.({ pitch: mode === "3d" ? 18 : 0, bearing: 0, duration: 650 });
    for (const [key, button] of buttons) {
      const active = key === mode;
      button.setAttribute("aria-pressed", String(active));
      button.style.background = active ? (mode === "3d" ? "rgba(103,232,249,.16)" : "rgba(255,255,255,.10)") : "transparent";
      button.style.color = active ? "#ecfeff" : "rgba(203,213,225,.58)";
      button.style.borderColor = active ? "rgba(165,243,252,.20)" : "transparent";
    }
    window.setTimeout(() => map.resize?.(), 0);
  };

  const addButton = (mode: "2d" | "3d", label: string, title: string) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.setAttribute("aria-pressed", String(mode === "2d"));
    Object.assign(button.style, {
      minWidth: mode === "3d" ? "78px" : "48px",
      height: "30px",
      padding: "0 10px",
      border: "1px solid transparent",
      borderRadius: "5px",
      background: mode === "2d" ? "rgba(255,255,255,.10)" : "transparent",
      color: mode === "2d" ? "#ecfeff" : "rgba(203,213,225,.58)",
      fontSize: "11px",
      fontWeight: "800",
      letterSpacing: ".01em",
      cursor: "pointer",
    });
    button.addEventListener("click", () => setMode(mode));
    buttons.set(mode, button);
    root.appendChild(button);
  };

  addButton("2d", "2D", "Show flat 2D AOR map");
  addButton("3d", "3D Globe", "Show 3D globe AOR map");

  return {
    onAdd() {
      setMode("2d");
      queueMicrotask(() => {
        const corner = root.parentElement;
        if (corner) corner.style.zIndex = "30";
      });
      return root;
    },
    onRemove() {
      root.remove();
    },
  };
}

function patchMapTilerForAor() {
  const sdk = window.maptilersdk;
  if (!sdk?.Map) return false;
  if (sdk[AOR_PATCH_FLAG]) return true;

  const OriginalMap = sdk.Map;
  class AorAwareMap extends OriginalMap {
    __insightHubAor = false;

    constructor(options: any) {
      const host = typeof options?.container === "string" ? document.getElementById(options.container) : options?.container;
      const isAor = host instanceof HTMLElement && host.classList.contains("aor-map-tiler-host");
      super(isAor ? {
        ...options,
        projection: options?.projection || "mercator",
        halo: options?.halo ?? true,
        space: options?.space ?? { color: "#01050a" },
      } : options);
      this.__insightHubAor = isAor;
      if (isAor) queueMicrotask(() => this.addControl?.(createProjectionControl(this), "top-right"));
    }

    addSource(id: string, source: any) {
      const result = super.addSource(id, source);
      if (this.__insightHubAor && id === "aor-v3-countries" && !this.getSource?.("aor-countries")) {
        super.addSource("aor-countries", source);
      }
      return result;
    }
  }

  sdk.Map = AorAwareMap;
  sdk[AOR_PATCH_FLAG] = true;
  return true;
}

function installAorCountryResolverBridge() {
  const originalFetch = window.fetch.bind(window);
  const bridgedFetch: typeof window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let url: URL | null = null;
    try { url = new URL(raw, window.location.href); } catch { url = null; }
    const isLegacyCountryGeocode = url?.hostname === "api.maptiler.com"
      && url.pathname.startsWith("/geocoding/")
      && url.searchParams.get("types") === "country";
    if (!isLegacyCountryGeocode || !url) return originalFetch(input, init);

    const encoded = url.pathname.slice("/geocoding/".length).replace(/\.json$/, "");
    const query = decodeURIComponent(encoded);
    const response = await originalFetch("/api/geospatial/resolve", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ query, kind: "country" }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    const resolution = payload?.resolution;
    if (!response.ok || resolution?.status !== "resolved" || !resolution?.coordinates || !resolution?.iso2) {
      const localTestHost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
      if (localTestHost) return originalFetch(input, init);
      return new Response(JSON.stringify({ features: [] }), {
        status: response.ok ? 200 : response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const name = String(resolution.country || resolution.matchedAddress || query);
    const iso2 = String(resolution.iso2).toUpperCase();
    const center = [Number(resolution.coordinates.lon), Number(resolution.coordinates.lat)];
    return new Response(JSON.stringify({
      features: [{
        id: `country.${iso2.toLowerCase()}`,
        type: "Feature",
        place_type: ["country"],
        text: name,
        place_name: name,
        center,
        bbox: Array.isArray(resolution.bbox) ? resolution.bbox : undefined,
        properties: { country_code: iso2, iso_a2: iso2, resolution_provider: resolution.provider },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  window.fetch = bridgedFetch;
  return () => {
    if (window.fetch === bridgedFetch) window.fetch = originalFetch;
  };
}

export default function ReviewerAorFactorsLive() {
  useLayoutEffect(() => {
    const restoreFetch = installAorCountryResolverBridge();
    if (patchMapTilerForAor()) return restoreFetch;

    const attachToExistingScript = () => {
      const script = document.querySelector<HTMLScriptElement>('script[data-maptiler-sdk="true"]');
      if (!script) return false;
      script.addEventListener("load", patchMapTilerForAor, { once: true });
      return true;
    };

    attachToExistingScript();
    const observer = new MutationObserver(() => {
      if (patchMapTilerForAor() || attachToExistingScript()) observer.disconnect();
    });
    observer.observe(document.head, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      restoreFetch();
    };
  }, []);

  return <ReviewerAorFactorsV3 />;
}
