import { useEffect, useState } from "react";
import ReviewerAorFactorsV3 from "./reviewer-aor-factors-v3";

export { default as LegacyAorFactorsV2 } from "./reviewer-aor-factors-v2";

declare global {
  interface Window {
    maptilersdk?: any;
  }
}

const MAPTILER_VERSION = "4.0.2";
const MAPTILER_SCRIPT = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.umd.min.js`;
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
    button.setAttribute("aria-pressed", "false");
    Object.assign(button.style, {
      minWidth: mode === "3d" ? "78px" : "48px",
      height: "30px",
      padding: "0 10px",
      border: "1px solid transparent",
      borderRadius: "5px",
      background: "transparent",
      color: "rgba(203,213,225,.58)",
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
      setMode("3d");
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
        projection: options?.projection || "globe",
        halo: options?.halo ?? false,
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

function ensureMapTilerPatch(): Promise<void> {
  if (patchMapTilerForAor()) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      if (patchMapTilerForAor()) resolve();
      else reject(new Error("MapTiler SDK loaded before the AOR globe patch could be installed."));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-maptiler-sdk="true"]');
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("MapTiler SDK failed to load.")), { once: true });
      if (window.maptilersdk) finish();
      return;
    }

    const script = document.createElement("script");
    script.src = MAPTILER_SCRIPT;
    script.async = true;
    script.dataset.maptilerSdk = "true";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("MapTiler SDK failed to load.")), { once: true });
    document.head.appendChild(script);
  });
}

export default function ReviewerAorFactorsLive() {
  const [ready, setReady] = useState(() => patchMapTilerForAor());
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (ready) return;
    let active = true;
    ensureMapTilerPatch()
      .then(() => { if (active) setReady(true); })
      .catch((reason) => { if (active) setLoadError(reason instanceof Error ? reason.message : "MapTiler SDK failed to initialize."); });
    return () => { active = false; };
  }, [ready]);

  if (!ready) {
    return <main className="min-h-screen bg-[#05080c] text-white"><div className="grid min-h-screen place-items-center px-6 text-center"><div><p className="text-xs font-bold text-slate-400">Preparing AOR globe…</p>{loadError ? <p className="mt-2 text-[10px] text-amber-100/65">{loadError}</p> : null}</div></div></main>;
  }

  return <ReviewerAorFactorsV3 />;
}