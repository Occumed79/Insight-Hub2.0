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
    constructor(options: any) {
      const host = typeof options?.container === "string" ? document.getElementById(options.container) : options?.container;
      const isAor = host instanceof HTMLElement && host.classList.contains("aor-map-tiler-host");
      super(isAor ? {
        ...options,
        projection: options?.projection || "mercator",
        halo: options?.halo ?? true,
        space: options?.space ?? { color: "#01050a" },
      } : options);
      if (isAor) queueMicrotask(() => this.addControl?.(createProjectionControl(this), "top-right"));
    }
  }

  sdk.Map = AorAwareMap;
  sdk[AOR_PATCH_FLAG] = true;
  return true;
}

export default function ReviewerAorFactorsLive() {
  useLayoutEffect(() => {
    if (patchMapTilerForAor()) return;

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
    return () => observer.disconnect();
  }, []);

  return <ReviewerAorFactorsV3 />;
}
