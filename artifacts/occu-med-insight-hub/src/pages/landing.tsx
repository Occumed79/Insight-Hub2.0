import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  ChevronDown,
  Globe2,
  Landmark,
  Layers,
  Network,
  Save,
  Settings2,
  Sigma,
  X,
} from "lucide-react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { portalCards } from "@/data/portals";
import type { PortalConfig, PortalLinkKey } from "@/data/portals";
import occuMedLogoDataUrl from "@/assets/occu-med-logo-data";

const iconMap = {
  profile: Building2,
  visualization: BarChart3,
  quant: Sigma,
  geo: Globe2,
  entity: Network,
  discovery: Layers,
  federal: Landmark,
};

const portalImageMap: Record<PortalConfig["imageKind"], string> = {
  profile: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
  visualization: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=82",
  quant: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  geo: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
  entity: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  discovery: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80",
  federal: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?auto=format&fit=crop&w=1200&q=80",
};

type PortalLinks = Record<PortalLinkKey, string>;

const portalLinkLabels: Record<PortalLinkKey, string> = {
  entity: "Entity Intelligence",
  discovery: "Entity Discovery",
  federal: "Federal Agencies",
};

function initialPortalLinks(): PortalLinks {
  return {
    entity: portalCards.find((portal) => portal.portalKey === "entity")?.href ?? "",
    discovery: portalCards.find((portal) => portal.portalKey === "discovery")?.href ?? "",
    federal: portalCards.find((portal) => portal.portalKey === "federal")?.href ?? "",
  };
}

function OccuMedWordmark() {
  return <img src={occuMedLogoDataUrl} alt="Occu-Med" className="home-cinematic-wordmark" />;
}

function PortalArt({ kind }: { kind: PortalConfig["imageKind"] }) {
  const Icon = iconMap[kind];
  return (
    <div className={`portal-banner portal-photo portal-photo-${kind} relative h-[156px] overflow-hidden rounded-[20px] border border-violet-200/24 bg-[#060616]`}>
      <img src={portalImageMap[kind]} alt="" className="h-full w-full object-cover object-center" loading="lazy" decoding="async" />
      <div className="portal-photo-grade absolute inset-0" />
      <div className="portal-shimmer absolute inset-0" />
      <div className="portal-photo-scanlines" aria-hidden="true" />
      <div className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100/36 bg-slate-950/52 backdrop-blur-xl">
        <Icon className="h-5 w-5 text-cyan-50/86 drop-shadow-[0_0_14px_rgba(196,181,253,.72)]" />
      </div>
    </div>
  );
}

function PortalCard({ portal, index }: { portal: PortalConfig; index: number }) {
  const missingExternalUrl = portal.mode === "external" && !portal.href;
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 34, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: index * 0.045, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`portal-card home-portal-card group relative h-full min-h-[310px] overflow-hidden rounded-[32px] p-[6px] ${missingExternalUrl ? "opacity-60" : ""}`}
    >
      <div className="portal-card-inner relative rounded-[26px] px-3 pb-3 pt-3">
        <PortalArt kind={portal.imageKind} />
        <div className="px-3 pb-3 pt-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-bold tracking-tight text-white transition group-hover:text-violet-50">{portal.title}</h3>
            <ArrowUpRight className="h-4 w-4 text-violet-100/35 transition duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-100" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-200/62 transition group-hover:text-slate-100/78">{portal.description}</p>
          {missingExternalUrl && <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-amber-200/60">Portal URL not configured</p>}
        </div>
      </div>
    </motion.div>
  );

  if (missingExternalUrl) return <div className="block h-full cursor-not-allowed" title="Add this URL through Manage portal links.">{body}</div>;
  if (portal.mode === "external") return <a href={portal.href} target="_blank" rel="noreferrer" className="block h-full">{body}</a>;
  return <Link href={portal.href} className="block h-full">{body}</Link>;
}

function FeaturedVisualization({ portal }: { portal: PortalConfig }) {
  return (
    <Link href={portal.href} className="home-feature-link block">
      <motion.article
        className="home-feature-stage group"
        initial={{ opacity: 0, y: 48 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="home-feature-copy">
          <p className="home-cinematic-eyebrow">Featured workspace</p>
          <h2>See the evidence change shape as you move through it.</h2>
          <p>
            Scroll through source-aware contract, workforce, geography, matrix, and evidence scenes. Weak data becomes proof cards or warnings instead of impressive-looking fiction.
          </p>
          <span className="home-feature-cta">Open Data Visualization <ArrowRight className="h-4 w-4" /></span>
        </div>
        <div className="home-feature-device" aria-hidden="true">
          <div className="home-device-menubar"><span /><span /><span /><b>Insight Hub · Visual Intelligence</b></div>
          <div className="home-device-canvas">
            <div className="home-device-copy"><small>Source-aware scene</small><strong>Evidence becomes spatial.</strong><span>Validated charts · matrices · source ledger</span></div>
            <div className="home-device-lens">
              <div className="home-device-lens-core"><span>VALIDATED</span><b>Visual<br />Intelligence</b><small>scroll to explore</small></div>
            </div>
            <div className="home-device-rail"><i /><i /><i /><i /><i /></div>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}

function PortalLinkManager({ links, onClose, onSaved }: { links: PortalLinks; onClose: () => void; onSaved: (links: PortalLinks) => void }) {
  const [draft, setDraft] = useState<PortalLinks>(links);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveLinks(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/portal-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: draft }),
      });
      const data = await response.json() as { links?: PortalLinks; error?: string };
      if (!response.ok || !data.links) throw new Error(data.error || "Unable to save portal links.");
      onSaved(data.links);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save portal links.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02030d]/84 px-4 backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="portal-link-manager-title">
      <motion.form initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onSubmit={saveLinks} className="home-link-manager w-full max-w-2xl rounded-[30px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="portal-link-manager-title" className="text-2xl font-bold text-white">Manage portal links</h2><p className="mt-2 text-sm leading-6 text-slate-200/60">These URLs are stored in the shared database and used by every device.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 p-2 text-slate-200/70 transition hover:border-violet-100/30 hover:text-white" aria-label="Close portal link manager"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-6 space-y-5">
          {(Object.keys(portalLinkLabels) as PortalLinkKey[]).map((key) => <label key={key} className="block"><span className="mb-2 block text-sm font-semibold text-slate-100/84">{portalLinkLabels[key]}</span><input type="text" inputMode="url" value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} placeholder="https://portal.example.com" className="w-full rounded-2xl border border-violet-100/14 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-200/24 focus:border-violet-200/38 focus:bg-white/[0.075]" /></label>)}
        </div>
        {error && <p className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200/70 transition hover:border-white/20 hover:text-white">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-violet-200/30 bg-violet-200/10 px-4 py-2.5 text-sm font-semibold text-violet-50 transition hover:bg-violet-200/16 disabled:cursor-wait disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save links"}</button></div>
      </motion.form>
    </div>
  );
}

export default function Landing() {
  const pageRef = useRef<HTMLElement>(null);
  const [portalLinks, setPortalLinks] = useState<PortalLinks>(initialPortalLinks);
  const [managerOpen, setManagerOpen] = useState(false);
  const { scrollYProgress } = useScroll({ target: pageRef, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.3 });
  const heroY = useTransform(scrollYProgress, [0, 0.24], [0, 130]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0.2]);

  useEffect(() => {
    let cancelled = false;
    async function loadPortalLinks() {
      try {
        const response = await fetch("/api/portal-links");
        if (!response.ok) return;
        const data = await response.json() as { links?: PortalLinks };
        if (!cancelled && data.links) setPortalLinks(data.links);
      } catch {
        // Build-time Render/Vite links remain available if the API is temporarily unavailable.
      }
    }
    void loadPortalLinks();
    return () => { cancelled = true; };
  }, []);

  const resolvedPortalCards = portalCards.map((portal) => portal.portalKey ? { ...portal, href: portalLinks[portal.portalKey] } : portal);
  const featuredPortal = resolvedPortalCards.find((portal) => portal.featured) ?? resolvedPortalCards[0];
  const supportingPortals = resolvedPortalCards.filter((portal) => portal !== featuredPortal);

  return (
    <main ref={pageRef} className="aurora-bg aurora-home home-cinematic-page min-h-screen text-white">
      <motion.div className="home-scroll-progress" style={{ scaleX: progress }} />
      <div className="aurora-orbs" aria-hidden="true" />

      <section className="home-cinematic-hero">
        <motion.div className="home-hero-copy" style={{ y: heroY, opacity: heroOpacity }}>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}><OccuMedWordmark /></motion.div>
          <motion.p className="home-cinematic-eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>Strategic intelligence, spatially understood</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>See the signal<br />before it becomes obvious.</motion.h1>
          <motion.p className="home-hero-subtitle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.75 }}>An Apple-style intelligence environment for exploring company evidence, workforce exposure, geographic reach, quantifiable assumptions, and source-backed opportunity.</motion.p>
          <motion.div className="home-hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Link href="/data-visualization" className="home-primary-action">Enter visual intelligence <ArrowRight className="h-4 w-4" /></Link>
            <button type="button" onClick={() => document.getElementById("home-portals")?.scrollIntoView({ behavior: "smooth" })} className="home-secondary-action">Explore the system <ChevronDown className="h-4 w-4" /></button>
          </motion.div>
        </motion.div>

        <div className="home-hero-object" aria-hidden="true">
          <div className="home-hero-halo home-hero-halo-one" />
          <div className="home-hero-halo home-hero-halo-two" />
          <div className="home-hero-glass-orb"><div><span>INSIGHT HUB</span><b>Evidence<br />in motion.</b><small>Profiles · maps · models · sources</small></div></div>
          <div className="home-hero-caption home-hero-caption-one"><span>01</span><b>Validated visual scenes</b></div>
          <div className="home-hero-caption home-hero-caption-two"><span>02</span><b>Source-aware interaction</b></div>
          <div className="home-hero-caption home-hero-caption-three"><span>03</span><b>Company-specific intelligence</b></div>
        </div>

        <button type="button" className="home-scroll-cue" onClick={() => document.getElementById("home-feature")?.scrollIntoView({ behavior: "smooth" })}><span>Scroll to reveal</span><ChevronDown className="h-4 w-4" /></button>
      </section>

      <section id="home-feature" className="home-feature-section">
        <div className="home-section-heading"><p className="home-cinematic-eyebrow">The visual layer</p><h2>Not another dashboard.<br />A guided intelligence experience.</h2><p>Scenes change their composition according to the evidence. Strong multi-point data earns charts. Sparse or weak data becomes proof, context, or an explicit warning.</p></div>
        <FeaturedVisualization portal={featuredPortal} />
      </section>

      <section id="home-portals" className="home-portals-section">
        <div className="home-section-heading home-section-heading-wide"><p className="home-cinematic-eyebrow">Intelligence workspaces</p><h2>Move from evidence<br />to decision without losing the source.</h2></div>
        <div className="home-portal-grid">{supportingPortals.map((portal, index) => <PortalCard key={portal.title} portal={portal} index={index} />)}</div>
        <div className="home-portal-controls"><button type="button" onClick={() => setManagerOpen(true)} className="home-secondary-action"><Settings2 className="h-4 w-4" /> Manage external portal links</button></div>
      </section>

      <footer className="home-cinematic-footer"><span>Occu-Med Insight Hub 2.0</span><span>Source-aware · company-specific · visually validated</span></footer>
      {managerOpen && <PortalLinkManager links={portalLinks} onClose={() => setManagerOpen(false)} onSaved={setPortalLinks} />}
    </main>
  );
}
