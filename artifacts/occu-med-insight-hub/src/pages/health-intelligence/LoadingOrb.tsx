/**
 * Source-based Strands loading visual, intentionally restricted to a small
 * circular indicator above the anatomy stage. Never mount across the bodies.
 */
import { useRef } from "react";
import Strands, { STRANDS_DEFAULTS, type StrandsParams } from "./Strands";

export default function LoadingOrb() {
  const params = useRef<StrandsParams>({
    ...STRANDS_DEFAULTS,
    colors: ["#FFF1CC", "#FFD24A", "#FF8A00", "#FFE9A8"],
    count: 5,
    speed: 0.6,
    amplitude: 0.72,
    waviness: 1.5,
    thickness: 0.65,
    glow: 2.25,
    taper: 2.5,
    scale: 2.5,
    saturation: 1.18,
    opacity: 0.88,
  });

  return (
    <div className="hi-loading-orb" aria-hidden="true">
      <div className="hi-loading-orb-field">
        <Strands paramsRef={params} maxDpr={1} />
      </div>
    </div>
  );
}
