import { ArrowUpRight, BarChart3, Building2, Globe2, Landmark, Layers, Network } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { portalCards } from "@/data/portals";
import type { PortalConfig } from "@/data/portals";
import occuMedLogo from "@assets/OM-logo-large_1776156663807.png";

const iconMap = { profile: Building2, quant: BarChart3, geo: Globe2, client: Network, prospect: Layers, federal: Landmark };

function PortalArt({ kind }: { kind: PortalConfig["imageKind"] }) {
  const Icon = iconMap[kind];
  return (
    <div className="portal-banner relative h-[142px] overflow-hidden rounded-[18px] border border-cyan-100/16 bg-[#030913]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_34%,rgba(45,212,191,.5),transparent_34%),radial-gradient(circle_at_78%_28%,rgba(34,211,238,.36),transparent_34%),radial-gradient(circle_at_52%_82%,rgba(167,139,250,.23),transparent_39%),linear-gradient(135deg,rgba(13,148,136,.28),rgba(12,74,110,.16)_48%,rgba(76,29,149,.18))]" />
      <div className="portal-shimmer absolute inset-0" />
      <div className="absolute inset-x-6 top-8 h-px bg-cyan-100/32" />
      <div className="absolute inset-x-10 top-14 h-px bg-emerald-100/22" />
      <div className="absolute inset-x-8 top-[88px] h-px bg-violet-100/16" />
      <div className="absolute bottom-5 left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-100/38 to-transparent" />
      <div className="absolute right-5 top-5 grid grid-cols-4 gap-1 opacity-55">
        {Array.from({ length: 16 }).map((_, index) => <span key={index} className="h-1 w-4 rounded-full bg-cyan-100/50" />)}
      </div>
      <Icon className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-cyan-50/58 drop-shadow-[0_0_22px_rgba(103,232,249,.66)]" />
    </div>
  );
}

function PortalCard({ portal, index }: { portal: PortalConfig; index: number }) {
  const body = (
    <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.06, duration: 0.55 }} className="portal-card glass-card group relative h-full min-h-[276px] overflow-hidden rounded-[28px] p-4">
      <div className="absolute left-5 top-5 z-10 h-7 w-7 rounded-full border border-cyan-200/40 bg-cyan-200/14 shadow-[0_0_28px_rgba(34,211,238,.34)]" />
      <PortalArt kind={portal.imageKind} />
      <div className="px-1 pb-2 pt-5">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-bold tracking-tight text-white transition group-hover:text-cyan-50">{portal.title}</h3>
          <ArrowUpRight className="h-4 w-4 text-cyan-100/35 transition group-hover:text-cyan-100" />
        </div>
        <p className="mt-3 text-sm leading-6 text-cyan-100/60 transition group-hover:text-cyan-50/72">{portal.description}</p>
      </div>
    </motion.div>
  );
  if (portal.mode === "external") return <a href={portal.href} target="_blank" rel="noreferrer" className="block h-full">{body}</a>;
  return <Link href={portal.href} className="block h-full">{body}</Link>;
}

export default function Landing() {
  return (
    <main className="aurora-bg aurora-home min-h-screen px-6 py-8 text-white">
      <section className="relative z-10 mx-auto max-w-[890px] pt-1">
        <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="logo-plaque mx-auto flex h-[82px] w-[160px] items-center justify-center overflow-hidden rounded-2xl bg-white px-5 py-3 shadow-[0_0_58px_rgba(94,234,212,.35)]">
          <img src={occuMedLogo} alt="Occu-Med" className="h-full w-full object-contain" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-7 text-center">
          <h1 className="text-6xl font-black tracking-[-0.065em] text-white drop-shadow-[0_0_34px_rgba(125,211,252,.18)] md:text-7xl">Insight Hub</h1>
          <p className="mx-auto mt-5 max-w-[620px] text-base leading-8 text-cyan-50/68">The strategic intelligence command center for Occu-Med — surfacing occupational health opportunities, quantifying workforce risk, and mapping the competitive landscape.</p>
        </motion.div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {portalCards.map((portal, index) => <PortalCard key={portal.title} portal={portal} index={index} />)}
        </div>
      </section>
    </main>
  );
}
