import { motion } from "framer-motion";
import type { ReactNode } from "react";

export type CinematicStat = {
  label: string;
  value: ReactNode;
  note?: string;
};

export type ApertureSegment = {
  label: string;
  value: number;
  color: string;
};

export function CinematicPortalHero({
  eyebrow,
  title,
  subtitle,
  actions,
  stats,
  visual,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  stats: CinematicStat[];
  visual: ReactNode;
}) {
  return (
    <section className="relative mb-8 min-h-[690px] overflow-hidden rounded-[42px] border border-violet-100/15 bg-[linear-gradient(145deg,rgba(10,7,25,.88),rgba(3,3,13,.72))] px-6 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,.11),0_48px_130px_rgba(0,0,0,.48),0_0_90px_rgba(91,33,182,.11)] backdrop-blur-3xl md:px-10 lg:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_34%,rgba(167,139,250,.22),transparent_28rem),radial-gradient(circle_at_20%_76%,rgba(103,232,249,.09),transparent_26rem)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.014)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(circle_at_70%_45%,black,transparent_78%)]" />

      <div className="relative z-10 grid min-h-[610px] items-center gap-12 xl:grid-cols-[minmax(0,1.04fr)_minmax(430px,.96fr)]">
        <motion.div initial={{ opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-violet-200/60">{eyebrow}</p>
          <h1 className="mt-5 max-w-[850px] bg-[linear-gradient(145deg,#fff_8%,#ede9fe_48%,#c4b5fd_73%,#a5f3fc)] bg-clip-text text-[clamp(3.5rem,7vw,7.5rem)] font-black leading-[.9] tracking-[-.07em] text-transparent">
            {title}
          </h1>
          <p className="mt-6 max-w-[760px] text-[15px] leading-8 text-slate-200/58 md:text-base">{subtitle}</p>
          {actions ? <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div> : null}

          <div className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + index * 0.06, duration: 0.55 }}
                className="rounded-[22px] border border-violet-100/12 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.075)] backdrop-blur-2xl"
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-200/38">{stat.label}</p>
                <p className="mt-2 text-2xl font-black tracking-[-.04em] text-violet-100">{stat.value}</p>
                {stat.note ? <p className="mt-1 text-[11px] leading-5 text-slate-300/40">{stat.note}</p> : null}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex min-h-[470px] items-center justify-center"
        >
          {visual}
        </motion.div>
      </div>
    </section>
  );
}

export function EvidenceAperture({
  segments,
  centerLabel,
  centerValue,
  centerNote,
}: {
  segments: ApertureSegment[];
  centerLabel: string;
  centerValue: ReactNode;
  centerNote: string;
}) {
  const positive = segments.map((segment) => ({ ...segment, value: Math.max(0, segment.value) }));
  const total = positive.reduce((sum, segment) => sum + segment.value, 0);
  let cursor = 0;
  const stops = positive.map((segment) => {
    const start = total ? cursor / total * 100 : cursor;
    cursor += segment.value;
    const end = total ? cursor / total * 100 : cursor;
    return `${segment.color} ${start}% ${end}%`;
  });
  const spectrum = total ? `conic-gradient(from -32deg, ${stops.join(", ")})` : "conic-gradient(from -32deg, rgba(148,163,184,.32), rgba(148,163,184,.08))";

  return (
    <div className="relative flex w-full max-w-[560px] items-center justify-center pb-16">
      <div className="absolute h-[112%] w-[112%] rounded-full border border-violet-100/8 [animation:spin_30s_linear_infinite]" />
      <div className="absolute h-[96%] w-[96%] rounded-full border border-cyan-100/7 [animation:spin_22s_linear_infinite_reverse]" />
      <div className="relative aspect-square w-[min(88vw,520px)] rounded-full p-[2px] shadow-[0_0_120px_rgba(139,92,246,.2),0_45px_110px_rgba(0,0,0,.46)]" style={{ background: spectrum }}>
        <div className="absolute inset-[7%] rounded-full border border-white/12" />
        <div className="absolute inset-[15%] rounded-full border border-violet-100/8" />
        <div className="absolute inset-[9%] grid place-items-center rounded-full bg-[radial-gradient(circle_at_34%_20%,rgba(255,255,255,.13),transparent_24%),linear-gradient(155deg,rgba(10,7,25,.98),rgba(3,2,10,.96))] p-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.13),inset_0_-60px_110px_rgba(76,29,149,.13)]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-slate-200/38">{centerLabel}</p>
            <div className="mt-3 text-[clamp(2.6rem,5vw,5.4rem)] font-black leading-[.9] tracking-[-.065em] text-white">{centerValue}</div>
            <p className="mx-auto mt-4 max-w-[250px] text-xs leading-6 text-slate-300/44">{centerNote}</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-1/2 grid min-w-[310px] -translate-x-1/2 grid-cols-2 gap-x-6 gap-y-2 rounded-[22px] border border-violet-100/14 bg-[#05030e]/78 px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,.38)] backdrop-blur-2xl">
        {positive.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-[11px] text-slate-200/54">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color, boxShadow: `0 0 14px ${segment.color}` }} />
            <span className="flex-1">{segment.label}</span>
            <b className="font-mono text-slate-100/80">{segment.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CostAperture({
  direct,
  burdened,
  total,
  formatter,
}: {
  direct?: number;
  burdened?: number;
  total?: number;
  formatter: (value: number) => string;
}) {
  const safeTotal = Math.max(total ?? 0, 1);
  const rings = [
    { label: "Direct", value: direct ?? 0, color: "#67e8f9", size: "100%" },
    { label: "Burdened", value: burdened ?? 0, color: "#a78bfa", size: "78%" },
    { label: "Total impact", value: total ?? 0, color: "#e879f9", size: "56%" },
  ];

  return (
    <div className="relative aspect-square w-[min(88vw,520px)]">
      {rings.map((ring, index) => {
        const degrees = Math.min(359.5, ring.value / safeTotal * 360);
        return (
          <div key={ring.label} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full p-[2px] shadow-[0_0_60px_rgba(139,92,246,.12)]" style={{ width: ring.size, height: ring.size, background: `conic-gradient(from -42deg, ${ring.color} 0deg ${degrees}deg, rgba(255,255,255,.045) ${degrees}deg 360deg)`, animation: `spin ${30 + index * 8}s linear infinite ${index % 2 ? "reverse" : "normal"}` }}>
            <div className="h-full w-full rounded-full border border-white/7 bg-[rgba(5,3,14,.86)] backdrop-blur-3xl" />
          </div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 grid h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-violet-100/12 bg-[radial-gradient(circle_at_34%_20%,rgba(255,255,255,.11),transparent_25%),rgba(5,3,14,.96)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_20px_70px_rgba(0,0,0,.5)]">
        <div><p className="text-[9px] uppercase tracking-[.2em] text-violet-100/42">Modeled impact</p><p className="mt-2 text-2xl font-black tracking-[-.04em] text-white">{total === undefined ? "Unavailable" : formatter(total)}</p></div>
      </div>
      <div className="absolute bottom-[-3.5rem] left-1/2 grid min-w-[320px] -translate-x-1/2 gap-2 rounded-[22px] border border-violet-100/13 bg-[#05030e]/78 px-5 py-4 backdrop-blur-2xl">
        {rings.map((ring) => <div key={ring.label} className="flex items-center gap-3 text-[11px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: ring.color, boxShadow: `0 0 13px ${ring.color}` }} /><span className="flex-1 text-slate-200/52">{ring.label}</span><b className="font-mono text-slate-100/82">{ring.value ? formatter(ring.value) : "—"}</b></div>)}
      </div>
    </div>
  );
}

export function SpatialAperture({
  locations,
  centerLabel,
}: {
  locations: Array<{ id: string; placeName?: string; city: string; country: string; coordinates: [number, number] }>;
  centerLabel: string;
}) {
  const plotted = locations.slice(0, 24).map((location) => ({
    ...location,
    left: Math.max(7, Math.min(93, (location.coordinates[0] + 180) / 360 * 100)),
    top: Math.max(7, Math.min(93, (90 - location.coordinates[1]) / 180 * 100)),
  }));

  return (
    <div className="relative aspect-square w-[min(88vw,540px)] rounded-full border border-violet-100/16 bg-[radial-gradient(circle_at_36%_25%,rgba(255,255,255,.1),transparent_22%),radial-gradient(circle_at_68%_64%,rgba(103,232,249,.11),transparent_26%),linear-gradient(155deg,rgba(9,6,24,.94),rgba(3,2,10,.96))] shadow-[inset_0_1px_0_rgba(255,255,255,.12),inset_0_-80px_130px_rgba(76,29,149,.13),0_0_120px_rgba(139,92,246,.18)]">
      <div className="absolute inset-[8%] rounded-full border border-violet-100/10" />
      <div className="absolute inset-[20%] rounded-full border border-cyan-100/7" />
      <div className="absolute left-[7%] right-[7%] top-1/2 h-px bg-gradient-to-r from-transparent via-violet-100/18 to-transparent" />
      <div className="absolute bottom-[7%] top-[7%] left-1/2 w-px bg-gradient-to-b from-transparent via-violet-100/15 to-transparent" />
      {plotted.map((location, index) => (
        <div key={location.id} className="group absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${location.left}%`, top: `${location.top}%` }}>
          <span className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-cyan-300/35" style={{ animationDelay: `${index * 90}ms` }} />
          <span className="relative block h-2.5 w-2.5 rounded-full border border-cyan-100/70 bg-violet-300 shadow-[0_0_18px_rgba(167,139,250,.9)]" />
          <span className="pointer-events-none absolute left-1/2 top-4 z-20 hidden min-w-max -translate-x-1/2 rounded-lg border border-violet-100/15 bg-[#05030e]/94 px-2 py-1 text-[9px] text-slate-100 shadow-xl backdrop-blur-xl group-hover:block">{location.placeName || location.city} · {location.country}</span>
        </div>
      ))}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-100/13 bg-[#05030e]/75 px-5 py-3 text-center backdrop-blur-2xl">
        <p className="text-[9px] uppercase tracking-[.2em] text-violet-100/42">Spatial intelligence</p>
        <p className="mt-1 text-lg font-black text-white">{centerLabel}</p>
      </div>
    </div>
  );
}

export function CinematicSection({
  index,
  eyebrow,
  title,
  description,
  children,
  compact = false,
}: {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`relative grid gap-8 py-12 xl:grid-cols-[minmax(250px,.31fr)_minmax(0,.69fr)] xl:gap-14 ${compact ? "xl:items-start" : "min-h-[720px] xl:items-start"}`}>
      <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="xl:sticky xl:top-24">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-200/55">{eyebrow}</p>
        <h2 className="mt-4 text-[clamp(2.6rem,4.7vw,5.4rem)] font-black leading-[.95] tracking-[-.06em] text-white">{title}</h2>
        <p className="mt-5 max-w-[520px] text-sm leading-7 text-slate-200/52">{description}</p>
        <span className="mt-8 block font-mono text-[clamp(4rem,8vw,8rem)] leading-none text-violet-100/[0.045]">{index}</span>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 42, scale: 0.99 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="min-w-0">
        {children}
      </motion.div>
    </section>
  );
}
