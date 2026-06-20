import { ArrowUpRight, Building2, Globe2, Landmark, Layers, Network, Sigma } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { portalCards } from "@/data/portals";
import type { PortalConfig } from "@/data/portals";
import occuMedLogoDataUrl from "@/assets/occu-med-logo-data";

const iconMap = { profile: Building2, quant: Sigma, geo: Globe2, entity: Network, discovery: Layers, federal: Landmark };

const portalImageMap: Record<PortalConfig["imageKind"], string> = {
  profile: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
  quant: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  geo: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
  entity: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  discovery: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80",
  federal: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?auto=format&fit=crop&w=1200&q=80",
};

function OccuMedWordmark() {
  return (
    <img
      src={occuMedLogoDataUrl}
      alt="Occu-Med"
      style={{
        width: "300px",
        maxWidth: "68vw",
        height: "auto",
        display: "block",
        margin: "0 auto",
        filter: "drop-shadow(0 0 18px rgba(255,255,255,0.24)) drop-shadow(0 0 28px rgba(125,211,252,0.10))",
      }}
    />
  );
}

function PortalArt({ kind }: { kind: PortalConfig["imageKind"] }) {
  const Icon = iconMap[kind];
  return (
    <div className="portal-banner portal-photo relative h-[118px] overflow-hidden rounded-[18px] border border-violet-200/20 bg-[#060616]">
      <img src={portalImageMap[kind]} alt="" className="h-full w-full object-cover object-center" loading="lazy" decoding="async" />
      <div className="absolute inset-0 bg-[linear-gradient(170deg,rgba(2,4,17,.20),rgba(9,2,26,.72)),radial-gradient(circle_at_16%_22%,rgba(52,211,153,.26),transparent_40%),radial-gradient(circle_at_84%_20%,rgba(34,211,238,.24),transparent_40%),radial-gradient(circle_at_50%_76%,rgba(139,92,246,.55),transparent_58%)]" />
      <div className="portal-shimmer absolute inset-0" />
      <div className="absolute right-5 top-5 grid grid-cols-4 gap-1 opacity-54">
        {Array.from({ length: 12 }).map((_, index) => <span key={index} className="h-1 w-4 rounded-full bg-cyan-100/52" />)}
      </div>
      <div className="absolute bottom-4 left-4 flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-100/36 bg-slate-900/48 backdrop-blur-md">
        <Icon className="h-4 w-4 text-cyan-50/86 drop-shadow-[0_0_14px_rgba(103,232,249,.78)]" />
      </div>
    </div>
  );
}

function PortalCard({ portal, index }: { portal: PortalConfig; index: number }) {
  const missingExternalUrl = portal.mode === "external" && !portal.href;

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 + index * 0.04, duration: 0.45 }}
      className={`portal-card glass-card group relative h-full min-h-[242px] overflow-hidden rounded-[26px] p-[5px] ${missingExternalUrl ? "opacity-70" : ""}`}
      style={{ position: "relative" }}
    >
      <div className="portal-card-inner relative rounded-[21px] px-3 pb-3 pt-3">
        <PortalArt kind={portal.imageKind} />
        <div className="px-2 pb-2 pt-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-bold tracking-tight text-white transition group-hover:text-cyan-50">{portal.title}</h3>
            <ArrowUpRight className="h-4 w-4 text-cyan-100/35 transition group-hover:text-cyan-100" />
          </div>
          <p className="mt-2 text-sm leading-6 text-cyan-100/64 transition group-hover:text-cyan-50/78">{portal.description}</p>
          {missingExternalUrl && <p className="mt-2 text-[10px] text-yellow-300/70">Set {portal.envName ?? "the Render env var"} in Render to enable this portal.</p>}
        </div>
      </div>
    </motion.div>
  );

  if (missingExternalUrl) return <div className="block h-full cursor-not-allowed" title={`Set ${portal.envName ?? "the Render env var"} to enable this portal.`}>{body}</div>;
  if (portal.mode === "external") return <a href={portal.href} target="_blank" rel="noreferrer" className="block h-full">{body}</a>;
  return <Link href={portal.href} className="block h-full">{body}</Link>;
}

export default function Landing() {
  return (
    <main className="aurora-bg aurora-home min-h-screen px-6 py-7 text-white">
      <div className="aurora-orbs" aria-hidden="true" />
      <section className="relative z-10 mx-auto max-w-[980px] pt-0">
        <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
          <OccuMedWordmark />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-1 text-center">
          <h1 className="text-5xl font-black tracking-[-0.06em] text-white drop-shadow-[0_0_30px_rgba(167,139,250,.22)] md:text-6xl">Insight Hub</h1>
          <p className="mx-auto mt-3 max-w-[640px] text-sm leading-7 text-cyan-50/70">The strategic intelligence command center for Occu-Med — surfacing occupational health opportunities, quantifying workforce risk, and mapping the competitive landscape.</p>
        </motion.div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {portalCards.map((portal, index) => <PortalCard key={portal.title} portal={portal} index={index} />)}
        </div>
      </section>
    </main>
  );
}
