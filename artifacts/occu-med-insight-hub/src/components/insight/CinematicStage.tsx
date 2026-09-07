import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CinematicVariant = "corridors" | "climate" | "anima" | "zero" | "nasdaq" | "world";

type CinematicStageProps = {
  children: ReactNode;
  variant: CinematicVariant;
  page: string;
  className?: string;
};

const nodes = Array.from({ length: 18 }, (_, index) => index);
const ticks = Array.from({ length: 24 }, (_, index) => index);

function CorridorsScene() {
  return (
    <>
      <svg className="cinematic-flow cinematic-flow-a" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-80 760 C 180 480, 360 880, 620 560 S 1100 200, 1680 410" />
        <path d="M-120 300 C 220 620, 440 180, 760 420 S 1220 820, 1700 620" />
        <path d="M100 1030 C 360 680, 560 740, 850 470 S 1330 80, 1640 260" />
      </svg>
      <div className="cinematic-globe-rings" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="cinematic-scan-sweep" aria-hidden="true" />
    </>
  );
}

function NasdaqScene() {
  return (
    <>
      <div className="cinematic-market-grid" aria-hidden="true">
        {ticks.map((tick) => <i key={tick} style={{ left: `${(tick / (ticks.length - 1)) * 100}%` }} />)}
      </div>
      <svg className="cinematic-flow cinematic-market-trace" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-40 790 L120 730 L220 760 L330 600 L470 650 L590 420 L710 480 L820 330 L960 370 L1080 190 L1210 300 L1350 170 L1640 250" />
      </svg>
      <div className="cinematic-data-rain" aria-hidden="true">{ticks.slice(0, 14).map((tick) => <i key={tick} style={{ left: `${4 + tick * 7.1}%`, animationDelay: `${-tick * .37}s` }} />)}</div>
    </>
  );
}

function ZeroScene() {
  return (
    <>
      <div className="cinematic-perspective-grid" aria-hidden="true" />
      <div className="cinematic-orbit cinematic-orbit-one" aria-hidden="true" />
      <div className="cinematic-orbit cinematic-orbit-two" aria-hidden="true" />
      <div className="cinematic-reactor" aria-hidden="true"><i /><i /><i /></div>
    </>
  );
}

function ClimateScene() {
  return (
    <>
      <div className="cinematic-contours" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="cinematic-heat-field cinematic-heat-one" aria-hidden="true" />
      <div className="cinematic-heat-field cinematic-heat-two" aria-hidden="true" />
      <svg className="cinematic-flow cinematic-climate-river" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-100 560 C180 380 360 650 580 480 C790 315 980 530 1160 390 C1360 235 1510 350 1700 260" />
      </svg>
    </>
  );
}

function AnimaScene() {
  return (
    <>
      <div className="cinematic-anima-mesh cinematic-anima-a" aria-hidden="true" />
      <div className="cinematic-anima-mesh cinematic-anima-b" aria-hidden="true" />
      <div className="cinematic-anima-core" aria-hidden="true"><i /><i /></div>
      <div className="cinematic-light-slice" aria-hidden="true" />
    </>
  );
}

function WorldScene() {
  return (
    <>
      <div className="cinematic-network" aria-hidden="true">
        {nodes.map((node) => (
          <i
            key={node}
            style={{
              left: `${8 + ((node * 37) % 84)}%`,
              top: `${10 + ((node * 53) % 76)}%`,
              animationDelay: `${-(node % 7) * .58}s`,
            }}
          />
        ))}
      </div>
      <svg className="cinematic-flow cinematic-network-lines" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
        <path d="M140 230 L420 360 L670 220 L960 420 L1320 260 L1510 510" />
        <path d="M210 780 L510 610 L750 720 L1040 560 L1370 740" />
        <path d="M420 360 L510 610 M670 220 L750 720 M960 420 L1040 560 M1320 260 L1370 740" />
      </svg>
    </>
  );
}

function VariantScene({ variant }: { variant: CinematicVariant }) {
  if (variant === "corridors") return <CorridorsScene />;
  if (variant === "nasdaq") return <NasdaqScene />;
  if (variant === "zero") return <ZeroScene />;
  if (variant === "climate") return <ClimateScene />;
  if (variant === "anima") return <AnimaScene />;
  return <WorldScene />;
}

export function CinematicStage({ children, variant, page, className }: CinematicStageProps) {
  const pointerX = useMotionValue(50);
  const pointerY = useMotionValue(42);
  const smoothX = useSpring(pointerX, { stiffness: 95, damping: 22, mass: .8 });
  const smoothY = useSpring(pointerY, { stiffness: 95, damping: 22, mass: .8 });
  const spotlight = useMotionTemplate`radial-gradient(560px circle at ${smoothX}% ${smoothY}%, rgba(255,255,255,.085), rgba(125,211,252,.035) 30%, transparent 68%)`;

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointerX.set((event.clientX / Math.max(1, window.innerWidth)) * 100);
      pointerY.set((event.clientY / Math.max(1, window.innerHeight)) * 100);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [pointerX, pointerY]);

  return (
    <motion.div
      className={cn("insight-cinematic-stage", className)}
      data-cinematic-variant={variant}
      data-cinematic-page={page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: .42, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="cinematic-scene" aria-hidden="true">
        <div className="cinematic-vignette" />
        <div className="cinematic-noise" />
        <motion.div className="cinematic-pointer-light" style={{ background: spotlight }} />
        <div className="cinematic-horizon" />
        <VariantScene variant={variant} />
      </div>
      <motion.div
        className="cinematic-content"
        initial={{ opacity: 0, y: 14, scale: .995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: .7, ease: [0.16, 1, 0.3, 1], delay: .06 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
