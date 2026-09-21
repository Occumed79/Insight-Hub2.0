import { useEffect, useRef } from "react";

type FederalAgencyDataLightsProps = {
  counts: {
    solicitations: number;
    recompetes: number;
    forecasts: number;
    medical: number;
  };
  selectedView: string;
  agencyKey: string;
};

/**
 * FederalAgencyDataLights
 *
 * Runtime/source basis: Edolus DataLights extracted from __game-scripts.js.
 * This adapts the extracted thread-curve and particle-twinkle mechanics to
 * Federal Agencies data without reusing Edolus image/model assets.
 */
export default function FederalAgencyDataLights({
  counts,
  selectedView,
  agencyKey,
}: FederalAgencyDataLightsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let app: import("playcanvas").Application | null = null;
    let resizeHandler: (() => void) | null = null;

    const boot = async () => {
      try {
        const pc = await import("playcanvas");
        if (disposed) return;

        app = new pc.Application(canvas, {});
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        const camera = new pc.Entity("Federal Camera");
        camera.addComponent("camera", {
          clearColor: new pc.Color(0.004, 0.007, 0.009, 1),
          farClip: 120,
          nearClip: 0.1,
          fov: 46,
        });
        camera.setPosition(0, 0, 10.8);
        app.root.addChild(camera);

        const white = new pc.Color(0.95, 0.98, 0.98, 0.9);
        const cool = new pc.Color(0.55, 0.83, 0.9, 0.9);
        const green = new pc.Color(0.5, 0.98, 0.72, 0.92);
        const dim = new pc.Color(0.38, 0.5, 0.52, 0.62);

    const values = [counts.solicitations, counts.recompetes, counts.forecasts, counts.medical];
    const total = values.reduce((sum, value) => sum + value, 0);
    const maxValue = Math.max(1, ...values);

    // Source-derived DataLights constants / harmonic ratios.
    const TAU = Math.PI * 2;
    const segmentCount = 96;
    const stringCount = 22;
    const length = 15.4;
    const bundleRadius = 2.8;
    const waveSpeed = 0.78;
    const waveComplexity = 1.06;
    const waveIntensity = 0.68;
    const endFade = 0.1;
    const startSpread = 0.56;
    const endSpread = 0.56;

    const positions: import("playcanvas").Vec3[] = [];
    const colors: import("playcanvas").Color[] = [];
    const particlePositions: import("playcanvas").Vec3[] = [];
    const particleColors: import("playcanvas").Color[] = [];

    const viewSeed = Array.from(selectedView).reduce((sum, char) => sum + char.charCodeAt(0), 0) * 0.0017;
    const agencySeed = Array.from(agencyKey).reduce((sum, char) => sum + char.charCodeAt(0), 0) * 0.0009;

    function bundleScale(u: number) {
      // Same spread model as the extracted Edolus DataLights shader:
      // the bundle may remain open at both ends instead of collapsing to one point.
      const smooth = (x: number) => x * x * (3 - 2 * x);
      if (u < 0.5) {
        const t = smooth(Math.max(0, Math.min(1, u / 0.5)));
        return startSpread + (1 - startSpread) * t;
      }
      const t = smooth(Math.max(0, Math.min(1, (1 - u) / 0.5)));
      return endSpread + (1 - endSpread) * t;
    }

    function curvePoint(u: number, phase: number, angle: number, time: number, strandIndex: number) {
      const x = (u - 0.5) * length;
      const scale = bundleRadius * bundleScale(u);
      const latY = scale * Math.cos(angle);
      const latZ = scale * Math.sin(angle);
      const waveEnv = Math.sin(Math.PI * u);
      const t = time * waveSpeed;
      const w = waveComplexity + (strandIndex % 4) * 0.045;

      // Exact harmonic structure from the extracted Edolus DataLights curve.
      const y =
        Math.sin(u * w * TAU + t + phase) +
        0.45 * Math.sin(u * w * 2.3 * TAU - t * 0.7 + phase * 1.7);
      const z =
        Math.sin(u * w * 1.3 * TAU + t * 0.8 + phase * 1.3 + 1.57) +
        0.4 * Math.sin(u * w * 3.1 * TAU + t * 1.3 + phase);

      return new pc.Vec3(
        x,
        latY + waveIntensity * waveEnv * y,
        latZ + waveIntensity * waveEnv * z
      );
    }

    let time = 0;

        app.on("update", (dt) => {
          try {
            time += dt;
      positions.length = 0;
      colors.length = 0;
      particlePositions.length = 0;
      particleColors.length = 0;

      for (let strand = 0; strand < stringCount; strand += 1) {
        const phase = strand * 0.73 + viewSeed + agencySeed;
        const angle = (strand / stringCount) * TAU + agencySeed * 2.4;
        const category = strand % 4;
        const categoryValue = values[category] || 0;
        const normalized = categoryValue / maxValue;
        const dataBoost = total > 0 ? 0.62 + normalized * 0.38 : 0.56;

        const strandColor =
          category === 0 ? cool :
          category === 1 ? white :
          category === 2 ? green :
          dim;

        for (let i = 0; i < segmentCount; i += 1) {
          const u0 = i / segmentCount;
          const u1 = (i + 1) / segmentCount;
          const p0 = curvePoint(u0, phase, angle, time, strand);
          const p1 = curvePoint(u1, phase, angle, time, strand);

          const fade0 = Math.min(1, u0 / endFade) * Math.min(1, (1 - u0) / endFade);
          const fade1 = Math.min(1, u1 / endFade) * Math.min(1, (1 - u1) / endFade);
          const alpha0 = Math.max(0.08, fade0 * dataBoost);
          const alpha1 = Math.max(0.08, fade1 * dataBoost);

          positions.push(p0, p1);
          colors.push(
            new pc.Color(strandColor.r, strandColor.g, strandColor.b, strandColor.a * alpha0),
            new pc.Color(strandColor.r, strandColor.g, strandColor.b, strandColor.a * alpha1)
          );
        }

        // Extracted Edolus particle behavior: soft travelling points with
        // 0.7 + 0.3 * sin(time * 6 + seed * 40) twinkle.
        for (let particle = 0; particle < 6; particle += 1) {
          const seed = (strand * 0.137 + particle * 0.211 + agencySeed) % 1;
          const u = (seed + time * (0.026 + category * 0.004)) % 1;
          if (u < endFade || u > 1 - endFade) continue;
          const p = curvePoint(u, phase, angle, time, strand);
          const twinkle = 0.7 + 0.3 * Math.sin(time * 6 + seed * 40);
          const radius = 0.026 + 0.034 * twinkle;
          const alpha = (0.2 + 0.8 * dataBoost) * twinkle;
          const c = new pc.Color(strandColor.r, strandColor.g, strandColor.b, Math.min(1, alpha));

          particlePositions.push(
            new pc.Vec3(p.x - radius, p.y, p.z),
            new pc.Vec3(p.x + radius, p.y, p.z),
            new pc.Vec3(p.x, p.y - radius, p.z),
            new pc.Vec3(p.x, p.y + radius, p.z)
          );
          particleColors.push(c, c, c, c);
        }
      }

      app.drawLines(positions, colors, false);
      app.drawLines(particlePositions, particleColors, false);

      // Keep the scene alive as an environment rather than a static hero.
      const drift = Math.sin(time * 0.16 + agencySeed * 10) * 0.42;
      camera.setPosition(drift, Math.sin(time * 0.11) * 0.18, 13.5);
            camera.setEulerAngles(Math.sin(time * 0.09) * 0.7, drift * -1.2, 0);
          } catch (error) {
            // Keep the operational workspace alive even if a frame-level visual
            // operation is unavailable on a specific GPU/browser.
            console.warn("Federal DataLights frame skipped", error);
          }
        });

        resizeHandler = () => app?.resizeCanvas();
        window.addEventListener("resize", resizeHandler);
        canvas.dataset.sceneReady = "true";
        app.start();

        if (disposed) {
          if (resizeHandler) window.removeEventListener("resize", resizeHandler);
          app.destroy();
          app = null;
        }
      } catch (error) {
        canvas.dataset.sceneReady = "false";
        console.error("Federal DataLights scene unavailable", error);
      }
    };

    void boot();

    return () => {
      disposed = true;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (app) {
        app.destroy();
        app = null;
      }
    };
  }, [
    counts.solicitations,
    counts.recompetes,
    counts.forecasts,
    counts.medical,
    selectedView,
    agencyKey,
  ]);

  return <canvas ref={canvasRef} className="fa-playcanvas" aria-hidden="true" />;
}
