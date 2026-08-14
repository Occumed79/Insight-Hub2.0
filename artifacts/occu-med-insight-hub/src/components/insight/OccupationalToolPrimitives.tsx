import { motion } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { size?: string | number }
>;

export function OccupationalToolShell({
  eyebrow,
  title,
  subtitle,
  notice,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  notice: string;
  children: ReactNode;
}) {
  return (
    <main className="aurora-bg min-h-screen pb-24 text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-10 2xl:px-14">
        <HeaderBar eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <GlassCard className="mb-6 border-cyan-100/14 bg-[#06101d]/58 p-4 backdrop-blur-2xl">
          <div className="flex items-start gap-3 text-xs leading-6 text-cyan-100/52">
            <ShieldCheck size={17} className="mt-1 shrink-0 text-cyan-200/58" />
            <p>{notice}</p>
          </div>
        </GlassCard>
        {children}
      </section>
    </main>
  );
}

export function ToolHero({
  kicker,
  title,
  description,
  children,
  accent = "cyan",
}: {
  kicker: string;
  title: string;
  description: string;
  children?: ReactNode;
  accent?: "cyan" | "violet" | "emerald" | "rose";
}) {
  const glow = {
    cyan: "from-cyan-300/20 via-transparent to-violet-400/12",
    violet: "from-violet-300/22 via-transparent to-cyan-300/10",
    emerald: "from-emerald-300/20 via-transparent to-cyan-300/10",
    rose: "from-rose-300/18 via-transparent to-violet-300/12",
  }[accent];
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-7 overflow-hidden rounded-[34px] border border-white/14 bg-[#040c18]/76 p-[1px] shadow-[0_34px_100px_rgba(0,0,0,.38)] backdrop-blur-3xl"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          glow,
        )}
      />
      <div className="relative rounded-[33px] border border-white/[0.065] bg-[radial-gradient(circle_at_82%_14%,rgba(34,211,238,.13),transparent_30%),radial-gradient(circle_at_12%_90%,rgba(139,92,246,.16),transparent_34%),rgba(3,9,20,.66)] p-6 md:p-8">
        <div className="grid gap-7 2xl:grid-cols-[1.05fr_.95fr] 2xl:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-100/42">
              {kicker}
            </p>
            <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.045em] text-white md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-50/55">
              {description}
            </p>
          </div>
          {children}
        </div>
      </div>
    </motion.section>
  );
}

export function SectionTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; icon?: IconComponent }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto rounded-[22px] border border-white/10 bg-black/20 p-2 backdrop-blur-2xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-xs font-bold transition",
              active === tab.id
                ? "border-cyan-200/24 bg-cyan-300/14 text-white shadow-[0_0_24px_rgba(34,211,238,.09)]"
                : "border-transparent text-cyan-100/48 hover:border-white/10 hover:bg-white/[0.04] hover:text-cyan-50",
            )}
          >
            {Icon ? <Icon size={15} /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function MetricOrb({
  label,
  value,
  note,
  icon: Icon = Sparkles,
  tone = "cyan",
}: {
  label: string;
  value: string;
  note: string;
  icon?: IconComponent;
  tone?: "cyan" | "violet" | "emerald" | "rose" | "amber";
}) {
  const toneClasses = {
    cyan: "border-cyan-200/14 bg-cyan-300/[0.045] text-cyan-200",
    violet: "border-violet-200/14 bg-violet-300/[0.05] text-violet-200",
    emerald: "border-emerald-200/14 bg-emerald-300/[0.05] text-emerald-200",
    rose: "border-rose-200/14 bg-rose-300/[0.05] text-rose-200",
    amber: "border-amber-200/14 bg-amber-300/[0.05] text-amber-200",
  }[tone];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "rounded-[25px] border p-[1px] shadow-[0_20px_55px_rgba(0,0,0,.28)] backdrop-blur-2xl",
        toneClasses,
      )}
    >
      <div className="h-full rounded-[24px] border border-white/[0.07] bg-[#071321]/78 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.19em] text-cyan-100/40">
            {label}
          </p>
          <Icon size={15} className="opacity-60" />
        </div>
        <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
          {value}
        </p>
        <p className="mt-1 text-xs leading-5 text-cyan-100/43">{note}</p>
      </div>
    </motion.div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/42">
        {label}
        {suffix ? <span className="text-cyan-100/24">{suffix}</span> : null}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/14 bg-[#06101c]/82 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-200/38 focus:shadow-[0_0_24px_rgba(34,211,238,.08)]"
      />
      {hint ? (
        <span className="mt-1.5 block text-[10px] leading-4 text-cyan-100/32">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function RangeField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const progress = ((value - min) / Math.max(max - min, 1)) * 100;
  return (
    <label className="block rounded-2xl border border-white/8 bg-white/[0.025] p-3">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-cyan-50/65">
        {label}
        <span className="text-white">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          background: `linear-gradient(90deg, rgba(34,211,238,.72) ${progress}%, rgba(255,255,255,.08) ${progress}%)`,
        }}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full accent-cyan-300"
      />
    </label>
  );
}

export function RingGauge({
  value,
  label,
  detail,
  tone = "cyan",
}: {
  value: number;
  label: string;
  detail: string;
  tone?: "cyan" | "violet" | "emerald" | "rose" | "amber";
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const colors = {
    cyan: "#67e8f9",
    violet: "#c4b5fd",
    emerald: "#6ee7b7",
    rose: "#fda4af",
    amber: "#fcd34d",
  };
  const circumference = 2 * Math.PI * 48;
  return (
    <div className="relative mx-auto grid w-full max-w-[240px] place-items-center text-center">
      <svg
        viewBox="0 0 120 120"
        className="w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="rgba(255,255,255,.07)"
          strokeWidth="8"
        />
        <motion.circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke={colors[tone]}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 9px ${colors[tone]}66)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div>
          <p className="text-3xl font-black tracking-[-0.05em] text-white">
            {clamped.toFixed(0)}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-100/38">
            {label}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-cyan-100/45">{detail}</p>
    </div>
  );
}

export function EvidenceGradeBadge({
  grade,
}: {
  grade: "A" | "B" | "C" | "D" | "Unavailable";
}) {
  const tone =
    grade === "A"
      ? "emerald"
      : grade === "B"
        ? "cyan"
        : grade === "C"
          ? "amber"
          : grade === "D"
            ? "violet"
            : "rose";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
        tone === "emerald" &&
          "border-emerald-200/18 bg-emerald-300/10 text-emerald-100",
        tone === "cyan" && "border-cyan-200/18 bg-cyan-300/10 text-cyan-100",
        tone === "amber" &&
          "border-amber-200/18 bg-amber-300/10 text-amber-100",
        tone === "violet" &&
          "border-violet-200/18 bg-violet-300/10 text-violet-100",
        tone === "rose" && "border-rose-200/18 bg-rose-300/10 text-rose-100",
      )}
    >
      Evidence {grade}
    </span>
  );
}
