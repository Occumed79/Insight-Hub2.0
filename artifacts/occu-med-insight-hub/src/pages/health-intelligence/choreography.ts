/**
 * Purposeful motion for the Strands rings.
 *
 * One ring orbits each hologram figure (0 = anterior, 1 = posterior) and a faint
 * ambient strand field sits behind everything. A single rAF loop eases every
 * ring toward the pose / strand parameters of the current phase, so changing
 * phase *morphs* the strands instead of cutting:
 *
 *   calibrate  initial load: tall scanning sweeps head -> feet
 *   idle       ambient orbital analysis around each figure
 *   focus      rings converge and spin tightly around the hovered / selected region
 *   analyze    occupation / condition lookup: strands reorganise into vertical helixes
 *
 * Everything is written straight to DOM style + the Strands params ref (no React
 * re-renders per frame) and only transforms/opacity are animated.
 */
import type { MutableRefObject } from "react";
import type { StrandsParams } from "./Strands";

export type Phase = "calibrate" | "idle" | "focus" | "analyze";

/** Stage-relative point (percent of stage) and the ribbon length wanted around it. */
export interface FocusPoint {
  x: number;
  y: number;
  /** Desired ribbon length, percent of stage width. */
  size: number;
}

export interface ChoreoInput {
  phase: Phase;
  /** Body-centre x of each figure, percent of stage. */
  bodyX: [number, number];
  focus: [FocusPoint | null, FocusPoint | null];
}

export interface RingBinding {
  el: HTMLElement | null;
  params: MutableRefObject<StrandsParams>;
}

/** Ring container is 86% of stage width; the ribbon fills ~79% of stage width at scale 1. */
const RING_WIDTH_PCT = 86;
const RIBBON_PCT_AT_UNIT_SCALE = 79;
/** Shader `scale` that makes the ribbon span the whole ring container. */
const SHADER_SCALE = 2.6;

interface RingState {
  x: number;
  y: number;
  rx: number;
  rz: number;
  scale: number;
  count: number;
  amplitude: number;
  waviness: number;
  thickness: number;
  speed: number;
  glow: number;
  intensity: number;
  opacity: number;
}

type Target = RingState;

const wrapDelta = (delta: number) => ((((delta + 180) % 360) + 360) % 360) - 180;

function target(ring: 0 | 1, input: ChoreoInput, t: number, stageW: number, stageH: number): Target {
  const side = ring === 0 ? 1 : -1;
  const bx = input.bodyX[ring];
  const focus = input.focus[ring];

  if (input.phase === "calibrate") {
    const sweep = 0.5 - 0.5 * Math.cos(t * 1.15 + ring * 0.6);
    return {
      x: bx, y: 6 + 90 * sweep, rx: 62, rz: side * 4,
      scale: 0.62, count: 6, amplitude: 0.9, waviness: 1.8, thickness: 0.45,
      speed: 0.9, glow: 3, intensity: 0.8, opacity: 1,
    };
  }

  if (input.phase === "analyze") {
    const vertical = (0.86 * stageH) / ((RIBBON_PCT_AT_UNIT_SCALE / 100) * stageW);
    return {
      x: bx, y: 52, rx: 28 * side, rz: side * 90,
      scale: Math.min(vertical, 1.2) * 0.9, count: 4, amplitude: 1.3, waviness: 1.6, thickness: 0.5,
      speed: 0.8, glow: 2.8, intensity: 0.75, opacity: 1,
    };
  }

  if (input.phase === "focus" && focus) {
    return {
      x: focus.x, y: focus.y, rx: 62, rz: (t * 55 * side) % 360,
      scale: Math.max(focus.size / RIBBON_PCT_AT_UNIT_SCALE, 0.1), count: 3, amplitude: 0.7, waviness: 1.2, thickness: 0.55,
      speed: 1.4, glow: 3, intensity: 0.85, opacity: 1,
    };
  }

  return {
    x: bx, y: 50 + 18 * Math.sin(t * 0.4 + ring * 2.1), rx: 58 + 6 * Math.sin(t * 0.31 + ring),
    rz: side * (10 + 6 * Math.sin(t * 0.2 + ring)),
    scale: 0.55, count: 5, amplitude: 1.3, waviness: 1.4, thickness: 0.45,
    speed: 0.35, glow: 2.4, intensity: 0.55, opacity: 0.85,
  };
}

export class Choreographer {
  private state: RingState[];
  private ambientOpacity = 0.28;
  private raf = 0;
  private last = 0;
  private t = 0;
  private stageW = 1;
  private stageH = 1;
  input: ChoreoInput;

  constructor(
    private rings: [RingBinding, RingBinding],
    private ambient: RingBinding,
    input: ChoreoInput,
    private reduceMotion = false,
  ) {
    this.input = input;
    this.state = ([0, 1] as const).map((ring) => target(ring, input, 0, 1000, 667));
  }

  setStageSize(width: number, height: number) {
    this.stageW = Math.max(width, 1);
    this.stageH = Math.max(height, 1);
    if (this.reduceMotion) this.step(0, true);
  }

  setInput(input: ChoreoInput) {
    this.input = input;
    if (this.reduceMotion) this.step(0, true);
  }

  start() {
    this.step(0, true);
    if (this.reduceMotion) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) {
        this.last = now;
        return;
      }
      // rAF timestamps can precede `last` while GL initialises: never let dt go negative.
      const dt = Math.min(Math.max((now - this.last) / 1000, 0), 0.1);
      this.last = now;
      this.t += dt;
      this.step(dt, false);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private step(dt: number, snap: boolean) {
    const kPose = snap ? 1 : 1 - Math.exp(-dt * 2.6);
    const kParam = snap ? 1 : 1 - Math.exp(-dt * 2);

    ([0, 1] as const).forEach((ring) => {
      const goal = target(ring, this.input, this.t, this.stageW, this.stageH);
      const cur = this.state[ring];

      cur.x += (goal.x - cur.x) * kPose;
      cur.y += (goal.y - cur.y) * kPose;
      cur.rx += (goal.rx - cur.rx) * kPose;
      cur.rz += wrapDelta(goal.rz - cur.rz) * kPose;
      cur.scale += (goal.scale - cur.scale) * kPose;

      cur.count += (goal.count - cur.count) * kParam;
      cur.amplitude += (goal.amplitude - cur.amplitude) * kParam;
      cur.waviness += (goal.waviness - cur.waviness) * kParam;
      cur.thickness += (goal.thickness - cur.thickness) * kParam;
      cur.speed += (goal.speed - cur.speed) * kParam;
      cur.glow += (goal.glow - cur.glow) * kParam;
      cur.intensity += (goal.intensity - cur.intensity) * kParam;
      cur.opacity += (goal.opacity - cur.opacity) * kParam;

      const binding = this.rings[ring];
      const params = binding.params.current;
      params.count = cur.count;
      params.amplitude = cur.amplitude;
      params.waviness = cur.waviness;
      params.thickness = cur.thickness;
      params.speed = cur.speed;
      params.glow = cur.glow;
      params.intensity = cur.intensity;
      params.opacity = cur.opacity;
      params.scale = SHADER_SCALE;

      if (binding.el) {
        const px = (cur.x / 100) * this.stageW;
        const py = (cur.y / 100) * this.stageH;
        binding.el.style.transform =
          `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotateZ(${cur.rz.toFixed(2)}deg) ` +
          `rotateX(${cur.rx.toFixed(2)}deg) scale(${cur.scale.toFixed(3)}) translate(-50%, -50%)`;
      }
    });

    const ambientGoal = this.input.phase === "calibrate" ? 0.5 : this.input.phase === "analyze" ? 0.42 : 0.28;
    this.ambientOpacity += (ambientGoal - this.ambientOpacity) * kParam;
    this.ambient.params.current.opacity = this.ambientOpacity;
  }
}

export const RING_BASE_WIDTH_PCT = RING_WIDTH_PCT;
