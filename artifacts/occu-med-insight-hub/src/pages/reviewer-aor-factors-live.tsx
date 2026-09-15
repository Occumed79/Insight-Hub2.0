import { useLayoutEffect } from "react";
import ReviewerAorFactorsV3 from "./reviewer-aor-factors-v3";

export { default as LegacyAorFactorsV2 } from "./reviewer-aor-factors-v2";

declare global {
  interface Window {
    maptilersdk?: any;
  }
}

const AOR_PATCH_FLAG = "__insightHubAorProjectionPatched";
const AOR_SHELL_STYLE_ID = "aor-holographic-globe-styles";
const AOR_SHELL_CLASS = "aor-holographic-shell";

function ensureHolographicShellStyles() {
  if (document.getElementById(AOR_SHELL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = AOR_SHELL_STYLE_ID;
  style.textContent = `
    .${AOR_SHELL_CLASS} {
      --aor-shell-scale: 1;
      transform: translate(-50%, -50%) scale(var(--aor-shell-scale));
      mix-blend-mode: screen;
      isolation: isolate;
      will-change: opacity, transform;
    }
    .${AOR_SHELL_CLASS}[data-projection="2d"] { opacity: 0 !important; }
    .${AOR_SHELL_CLASS}::before,
    .${AOR_SHELL_CLASS}::after,
    .${AOR_SHELL_CLASS} > span {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 9999px;
      pointer-events: none;
    }
    .${AOR_SHELL_CLASS}::before {
      inset: -3.5%;
      background:
        radial-gradient(circle at 18% 32%, rgba(1,239,172,.92) 0 7%, rgba(1,203,174,.46) 15%, transparent 34%),
        radial-gradient(circle at 82% 26%, rgba(170,239,207,.82) 0 6%, rgba(132,186,174,.34) 16%, transparent 34%),
        radial-gradient(circle at 80% 76%, rgba(95,42,132,.88) 0 8%, rgba(82,64,150,.46) 18%, transparent 36%),
        radial-gradient(circle at 22% 80%, rgba(32,130,166,.78) 0 7%, rgba(93,134,142,.32) 19%, transparent 38%),
        conic-gradient(from 205deg, #101c4f 0deg, #524096 62deg, #5f2a84 112deg, #2082a6 190deg, #01cbae 248deg, #01efac 304deg, #aaefcf 342deg, #101c4f 360deg);
      filter: blur(11px) saturate(1.28);
      opacity: .84;
      -webkit-mask: radial-gradient(circle, transparent 0 55%, rgba(0,0,0,.14) 61%, rgba(0,0,0,.72) 72%, #000 80% 100%);
      mask: radial-gradient(circle, transparent 0 55%, rgba(0,0,0,.14) 61%, rgba(0,0,0,.72) 72%, #000 80% 100%);
      animation: aor-shell-orbit-a 18s linear infinite;
    }
    .${AOR_SHELL_CLASS}::after {
      inset: 2%;
      border: 1px solid rgba(163,232,215,.22);
      box-shadow:
        inset 0 0 34px rgba(170,239,207,.08),
        inset 0 0 78px rgba(32,130,166,.08),
        0 0 24px rgba(1,239,172,.12),
        0 0 58px rgba(82,64,150,.12);
      opacity: .74;
    }
    .${AOR_SHELL_CLASS} .aor-shell-field-a {
      inset: 1%;
      background:
        radial-gradient(ellipse at 28% 24%, rgba(1,239,172,.74) 0 9%, transparent 30%),
        radial-gradient(ellipse at 72% 68%, rgba(95,42,132,.70) 0 10%, transparent 32%),
        radial-gradient(ellipse at 60% 18%, rgba(163,232,215,.48) 0 8%, transparent 26%);
      filter: blur(7px);
      -webkit-mask: radial-gradient(circle, transparent 0 57%, rgba(0,0,0,.32) 66%, #000 78% 100%);
      mask: radial-gradient(circle, transparent 0 57%, rgba(0,0,0,.32) 66%, #000 78% 100%);
      animation: aor-shell-orbit-b 13s ease-in-out infinite alternate;
    }
    .${AOR_SHELL_CLASS} .aor-shell-field-b {
      inset: -1%;
      background:
        radial-gradient(circle at 14% 68%, rgba(32,130,166,.64) 0 8%, transparent 29%),
        radial-gradient(circle at 88% 46%, rgba(1,203,174,.58) 0 9%, transparent 28%),
        radial-gradient(circle at 48% 90%, rgba(82,64,150,.62) 0 8%, transparent 28%);
      filter: blur(14px);
      opacity: .78;
      -webkit-mask: radial-gradient(circle, transparent 0 60%, rgba(0,0,0,.46) 70%, #000 81% 100%);
      mask: radial-gradient(circle, transparent 0 60%, rgba(0,0,0,.46) 70%, #000 81% 100%);
      animation: aor-shell-orbit-c 21s linear infinite reverse;
    }
    .${AOR_SHELL_CLASS} .aor-shell-glass {
      inset: 4%;
      background: radial-gradient(circle at 50% 44%, rgba(170,239,207,.035), rgba(16,28,79,.02) 48%, rgba(82,64,150,.11) 72%, transparent 82%);
      box-shadow: inset 0 -28px 70px rgba(95,42,132,.08), inset 20px 0 58px rgba(1,203,174,.05);
      opacity: .78;
    }
    .${AOR_SHELL_CLASS}[data-interacting="true"]::before {
      filter: blur(9px) saturate(1.48) brightness(1.16);
      opacity: .98;
    }
    .${AOR_SHELL_CLASS}[data-interacting="true"]::after {
      border-color: rgba(170,239,207,.32);
      box-shadow: inset 0 0 42px rgba(170,239,207,.11), 0 0 34px rgba(1,239,172,.18), 0 0 70px rgba(95,42,132,.15);
    }
    @keyframes aor-shell-orbit-a {
      0% { transform: rotate(0deg) scale(1); }
      50% { transform: rotate(180deg) scale(1.025); }
      100% { transform: rotate(360deg) scale(1); }
    }
    @keyframes aor-shell-orbit-b {
      0% { transform: rotate(-16deg) scale(.98); }
      100% { transform: rotate(42deg) scale(1.035); }
    }
    @keyframes aor-shell-orbit-c {
      0% { transform: rotate(0deg) scale(1.015); }
      100% { transform: rotate(360deg) scale(.985); }
    }
    @media (prefers-reduced-motion: reduce) {
      .${AOR_SHELL_CLASS}::before,
      .${AOR_SHELL_CLASS} .aor-shell-field-a,
      .${AOR_SHELL_CLASS} .aor-shell-field-b { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

function syncHolographicShell(map: any) {
  const shell = map?.__aorHolographicShell as HTMLElement | undefined;
  if (!shell) return;
  const rawZoom = Number(map.getZoom?.() ?? 1.15);
  const zoom = Number.isFinite(rawZoom) ? rawZoom : 1.15;
  const fade = Math.max(0.12, Math.min(1, 1 - Math.max(0, zoom - 1.2) * 0.42));
  const scale = Math.max(0.97, Math.min(1.07, 1 + (zoom - 1.15) * 0.025));
  shell.style.setProperty("--aor-shell-scale", String(scale));
  shell.style.opacity = shell.dataset.projection === "2d" ? "0" : String(0.9 * fade);
}

function setHolographicShellMode(map: any, mode: "2d" | "3d") {
  const shell = map?.__aorHolographicShell as HTMLElement | undefined;
  if (!shell) return;
  shell.dataset.projection = mode;
  syncHolographicShell(map);
}

function installHolographicShell(map: any, host: HTMLElement) {
  ensureHolographicShellStyles();
  const existing = host.querySelector<HTMLElement>(`.${AOR_SHELL_CLASS}`);
  if (existing) {
    map.__aorHolographicShell = existing;
    return existing;
  }

  const shell = document.createElement("div");
  shell.className = AOR_SHELL_CLASS;
  shell.dataset.projection = "3d";
  shell.setAttribute("aria-hidden", "true");
  shell.innerHTML = [
    '<span class="aor-shell-field-a"></span>',
    '<span class="aor-shell-field-b"></span>',
    '<span class="aor-shell-glass"></span>',
  ].join("");
  Object.assign(shell.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "min(92%, 610px)",
    aspectRatio: "1 / 1",
    borderRadius: "50%",
    pointerEvents: "none",
    zIndex: "1",
    opacity: "0.9",
    transition: "opacity 320ms ease, transform 320ms ease, filter 220ms ease",
  });
  host.appendChild(shell);
  map.__aorHolographicShell = shell;

  const energize = (active: boolean) => {
    shell.dataset.interacting = String(active);
  };
  map.on?.("movestart", () => energize(true));
  map.on?.("move", () => syncHolographicShell(map));
  map.on?.("moveend", () => { energize(false); syncHolographicShell(map); });
  map.on?.("zoomstart", () => energize(true));
  map.on?.("zoom", () => syncHolographicShell(map));
  map.on?.("zoomend", () => { energize(false); syncHolographicShell(map); });
  map.on?.("resize", () => syncHolographicShell(map));
  syncHolographicShell(map);
  return shell;
}

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
    setHolographicShellMode(map, mode);
    for (const [key, button] of buttons) {
      const active = key === mode;
      button.setAttribute("aria-pressed", String(active));
      button.style.background = active ? (mode === "3d" ? "rgba(1,239,172,.13)" : "rgba(255,255,255,.10)") : "transparent";
      button.style.color = active ? "#ecfeff" : "rgba(203,213,225,.58)";
      button.style.borderColor = active ? "rgba(170,239,207,.20)" : "transparent";
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
  addButton("3d", "3D Globe", "Show holographic 3D globe AOR map");

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
    __aorHolographicShell: HTMLElement | null = null;

    constructor(options: any) {
      const host = typeof options?.container === "string" ? document.getElementById(options.container) : options?.container;
      const isAor = host instanceof HTMLElement && host.classList.contains("aor-map-tiler-host");
      super(isAor ? {
        ...options,
        projection: options?.projection || "globe",
        halo: options?.halo ?? false,
        space: options?.space ?? { color: "#030713" },
      } : options);
      this.__insightHubAor = isAor;
      if (isAor && host instanceof HTMLElement) {
        queueMicrotask(() => {
          installHolographicShell(this, host);
          this.addControl?.(createProjectionControl(this), "top-right");
        });
      }
    }

    addSource(id: string, source: any) {
      const result = super.addSource(id, source);
      // The active v3 page historically renamed this source, while the epidemic
      // and surveillance modules still consume the stable `aor-countries` id.
      // Mirror the same vector source so all health layers attach to the active map.
      if (this.__insightHubAor && id === "aor-v3-countries" && !this.getSource?.("aor-countries")) {
        super.addSource("aor-countries", source);
      }
      return result;
    }

    remove() {
      this.__aorHolographicShell?.remove();
      this.__aorHolographicShell = null;
      return super.remove();
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
