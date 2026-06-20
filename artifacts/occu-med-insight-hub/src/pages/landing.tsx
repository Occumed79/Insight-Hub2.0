import { ArrowUpRight, Building2, Globe2, Landmark, Layers, Network, Sigma } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { portalCards } from "@/data/portals";
import type { PortalConfig } from "@/data/portals";

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
    <div className="mx-auto flex w-fit items-center gap-3 rounded-[28px] border border-cyan-100/16 bg-white/[0.035] px-5 py-3 shadow-[0_0_44px_rgba(45,212,191,.10),inset_0_0_28px_rgba(255,255,255,.035)] backdrop-blur-xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-100/8">
        <span className="h-4 w-7 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.42)]" />
      </div>
      <div className="text-left">
        <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/42">Occu-Med</p>
        <p className="text-sm font-semibold tracking-[0.18em] text-white/90">Insight Hub</p>
      </div>
    </div>
  );
}

function PortalArt({ kind }: { kind: PortalConfig["imageKind"] }) {
  const Icon = iconMap[kind];
  return (
    <div className="portal-banner portal-photo relative h-[132px] overflow-hidden rounded-[20px] border border-violet-200/24 bg-[#060616]">
      <img src={portalImageMap[kind]} alt="" className="h-full w-full object-cover object-center" loading="lazy" decoding="async" />
      <div className="absolute inset-0 bg-[linear-gradient(170deg,rgba(2,4,17,.25),rgba(9,2,26,.76)),radial-gradient(circle_at_16%_22%,rgba(52,211,153,.30),transparent_40%),radial-gradient(circle_at_84%_20%,rgba(34,211,238,.28),transparent_40%),radial-gradient(circle_at_50%_76%,rgba(139,92,246,.62),transparent_58%)]" />
      <div className="portal-shimmer absolute inset-0" />
      <div className="absolute inset-x-6 top-8 h-px bg-cyan-100/36" />
      <div className="absolute inset-x-10 top-14 h-px bg-emerald-100/26" />
      <div className="absolute inset-x-8 top-[88px] h-px bg-violet-100/22" />
      <div className="absolute bottom-5 left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-100/46 to-transparent" />
      <div className="absolute right-5 top-5 grid grid-cols-4 gap-1 opacity-60">
        {Array.from({ length: 16 }).map((_, index) => <span key={index} className="h-1 w-4 rounded-full bg-cyan-100/60" />)}
      </div>
      <div className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100/44 bg-slate-900/48 backdrop-blur-md">
        <Icon className="h-5 w-5 text-cyan-50/86 drop-shadow-[0_0_14px_rgba(103,232,249,.86)]" />
      </div>
    </div>
  );
}

function PortalCard({ portal, index }: { portal: PortalConfig; index: number }) {
  const missingExternalUrl = portal.mode === "external" && !portal.href;
  const body = (
    <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.06, duration: 0.55 }} className={`portal-card glass-card group relative h-full min-h-[270px] overflow-hidden rounded-[32px] p-[6px] ${missingExternalUrl ? "opacity-70" : ""}`} style={{ position: "relative" }}>
      <div className="portal-card-inner relative rounded-[26px] px-3 pb-3 pt-3">
        <div className="absolute left-6 top-6 z-10 h-7 w-7 rounded-full border border-cyan-200/40 bg-cyan-200/14 shadow-[0_0_28px_rgba(34,211,238,.34)]" />
        <PortalArt kind={portal.imageKind} />
        <div className="px-3 pb-3 pt-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-bold tracking-tight text-white transition group-hover:text-cyan-50">{portal.title}</h3>
            <ArrowUpRight className="h-4 w-4 text-cyan-100/35 transition group-hover:text-cyan-100" />
          </div>
          <p className="mt-3 text-sm leading-6 text-cyan-100/66 transition group-hover:text-cyan-50/78">{portal.description}</p>
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
    <main className="aurora-bg aurora-home min-h-screen px-6 py-8 text-white">
      <div className="aurora-orbs" aria-hidden="true" />
      <section className="relative z-10 mx-auto max-w-[900px] pt-5">
        <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}><OccuMedWordmark /></motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-8 text-center">
          <h1 className="text-6xl font-black tracking-[-0.065em] text-white drop-shadow-[0_0_34px_rgba(167,139,250,.26)] md:text-7xl">Insight Hub</h1>
          <p className="mx-auto mt-5 max-w-[620px] text-base leading-8 text-cyan-50/72">The strategic intelligence command center for Occu-Med — surfacing occupational health opportunities, quantifying workforce risk, and mapping the competitive landscape.</p>
        </motion.div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">{portalCards.map((portal, index) => <PortalCard key={portal.title} portal={portal} index={index} />)}</div>
      </section>
    </main>
  );
}
