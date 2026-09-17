import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

type AorProjectionDetail = {
  mode?: "2d" | "3d";
  projection?: "mercator" | "globe";
};

const MAP_SHELL_SELECTOR = '[data-testid="aor-map-shell"]';

export function AorOrbOverlay() {
  const reduceMotion = useReducedMotion();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const resolveHost = () => {
      const next = document.querySelector<HTMLElement>(MAP_SHELL_SELECTOR);
      if (next) setHost(next);
      return next;
    };

    if (resolveHost()) return;

    const observer = new MutationObserver(() => {
      if (resolveHost()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const initialMode = document.documentElement.dataset.aorProjectionMode;
    setVisible(initialMode !== "2d");

    const handleProjection = (event: Event) => {
      const detail = (event as CustomEvent<AorProjectionDetail>).detail;
      setVisible(detail?.mode !== "2d");
    };

    window.addEventListener("aor:projection-change", handleProjection as EventListener);
    return () => window.removeEventListener("aor:projection-change", handleProjection as EventListener);
  }, []);

  if (!host || !visible) return null;

  return createPortal(
    <div
      aria-hidden="true"
      data-testid="aor-orb-overlay"
      className="pointer-events-none absolute inset-0 z-[1] overflow-visible"
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: "min(116%, 820px)",
          transform: "translate(-50%, -50%)",
        }}
      >
        <motion.img
          src="/aor-orb-shell.webp"
          alt=""
          draggable={false}
          className="block h-auto w-full select-none"
          style={{
            opacity: 0.92,
            filter: "saturate(1.08) brightness(1.02)",
            transformOrigin: "50% 50%",
          }}
          animate={reduceMotion ? { opacity: 0.92 } : {
            rotate: [0, 360],
            scale: [1, 1.012, 1],
            opacity: [0.88, 0.96, 0.88],
          }}
          transition={reduceMotion ? undefined : {
            rotate: { duration: 72, ease: "linear", repeat: Infinity },
            scale: { duration: 9, ease: "easeInOut", repeat: Infinity },
            opacity: { duration: 9, ease: "easeInOut", repeat: Infinity },
          }}
        />
      </div>
    </div>,
    host,
  );
}

export default AorOrbOverlay;
