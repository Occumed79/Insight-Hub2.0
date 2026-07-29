import { ArrowUpRight, Building2, Globe2, Landmark, Layers, Network, Save, Settings2, Sigma, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { portalCards } from "@/data/portals";
import type { PortalConfig, PortalLinkKey } from "@/data/portals";
import occuMedLogoDataUrl from "@/assets/occu-med-logo-data";

const iconMap = { profile: Building2, quant: Sigma, geo: Globe2, entity: Network, discovery: Layers, federal: Landmark };

const portalImageMap: Record<PortalConfig["imageKind"], string> = {
  profile: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=72",
  quant: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=72",
  geo: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=72",
  entity: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=72",
  discovery: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=900&q=72",
  federal: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?auto=format&fit=crop&w=900&q=72",
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
  return (
    <img
      src={occuMedLogoDataUrl}
      alt="Occu-Med"
      style={{
        width: "380px",
        maxWidth: "74vw",
        height: "auto",
        display: "block",
        margin: "0 auto 4px",
        filter: "drop-shadow(0 0 22px rgba(255,255,255,0.30)) drop-shadow(0 0 34px rgba(125,211,252,0.12))",
      }}
    />
  );
}

function PortalArt({ kind }: { kind: PortalConfig["imageKind"] }) {
  const Icon = iconMap[kind];
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="relative isolate h-[156px] overflow-hidden rounded-[20px] border border-violet-200/24 bg-[#060616]"
      style={{ contain: "paint", transform: "translateZ(0)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
    >
      <img
        src={portalImageMap[kind]}
        alt=""
        aria-hidden="true"
        className="block h-full w-full select-none object-cover object-center"
        loading="eager"
        decoding="async"
        draggable={false}
        style={{ transform: "translateZ(0)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(170deg,rgba(2,4,17,.25),rgba(9,2,26,.76)),radial-gradient(circle_at_16%_22%,rgba(52,211,153,.30),transparent_40%),radial-gradient(circle_at_84%_20%,rgba(34,211,238,.28),transparent_40%),radial-gradient(circle_at_50%_76%,rgba(139,92,246,.62),transparent_58%)]" />
      <motion.div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        initial={false}
        animate={reduceMotion
          ? { opacity: 0.35, backgroundPosition: "50% 0%" }
          : { opacity: [0, 0.85, 0], backgroundPosition: ["-140% 0%", "140% 0%"] }}
        transition={reduceMotion
          ? { duration: 0 }
          : { duration: 7.5, repeat: Infinity, repeatDelay: 1.25, ease: "easeInOut" }}
        style={{
          backgroundImage: "linear-gradient(110deg, transparent 0%, rgba(255,255,255,.08) 42%, rgba(125,211,252,.18) 50%, rgba(255,255,255,.08) 58%, transparent 100%)",
          backgroundSize: "240% 100%",
          willChange: reduceMotion ? "auto" : "background-position, opacity",
        }}
      />
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
  const reduceMotion = useReducedMotion();

  const body = (
    <motion.div
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { delay: 0.2 + index * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
      style={{ willChange: reduceMotion ? "auto" : "transform, opacity" }}
    >
      <div
        className={`group relative isolate h-full min-h-[300px] overflow-hidden rounded-[32px] border border-cyan-200/20 bg-[linear-gradient(145deg,rgba(4,13,26,.94),rgba(3,10,24,.82)_48%,rgba(8,19,42,.90))] p-[6px] shadow-[0_26px_72px_rgba(0,0,0,.46),0_0_0_1px_rgba(255,255,255,.035),inset_0_1px_0_rgba(255,255,255,.12),inset_0_-42px_80px_rgba(15,23,42,.42),inset_0_0_55px_rgba(45,212,191,.07)] backdrop-blur-2xl ${missingExternalUrl ? "opacity-70" : ""}`}
        style={{ contain: "paint", transform: "translateZ(0)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(122deg,rgba(255,255,255,.14)_0%,rgba(255,255,255,.06)_12%,transparent_30%),radial-gradient(circle_at_18%_0%,rgba(125,211,252,.14),transparent_36%),radial-gradient(circle_at_100%_8%,rgba(167,139,250,.11),transparent_32%)] opacity-80" />
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          aria-hidden="true"
          initial={false}
          animate={reduceMotion
            ? { opacity: 0.3, backgroundPosition: "50% 0%" }
            : { opacity: [0, 0, 0.52, 0, 0], backgroundPosition: ["-130% 0%", "-130% 0%", "130% 0%", "130% 0%", "130% 0%"] }}
          transition={reduceMotion
            ? { duration: 0 }
            : { duration: 9, repeat: Infinity, ease: "easeInOut", times: [0, 0.56, 0.68, 0.82, 1] }}
          style={{
            backgroundImage: "linear-gradient(108deg, transparent 0%, rgba(255,255,255,.06) 43%, rgba(125,211,252,.12) 50%, rgba(255,255,255,.06) 57%, transparent 100%)",
            backgroundSize: "240% 100%",
            willChange: reduceMotion ? "auto" : "background-position, opacity",
          }}
        />
        <div className="relative z-[1] h-full rounded-[26px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(2,8,23,.86),rgba(5,18,37,.64)_52%,rgba(2,6,23,.90))] px-3 pb-3 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,.10),inset_0_0_34px_rgba(45,212,191,.07)]">
          <div className="absolute left-6 top-6 z-10 h-7 w-7 rounded-full border border-cyan-200/40 bg-cyan-200/14 shadow-[0_0_28px_rgba(34,211,238,.34)]" />
          <PortalArt kind={portal.imageKind} />
          <div className="px-3 pb-3 pt-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-bold tracking-tight text-white transition group-hover:text-cyan-50">{portal.title}</h3>
              <ArrowUpRight className="h-4 w-4 text-cyan-100/35 transition group-hover:text-cyan-100" />
            </div>
            <p className="mt-3 text-sm leading-6 text-cyan-100/66 transition group-hover:text-cyan-50/78">{portal.description}</p>
            {missingExternalUrl && (
              <p className="mt-2 text-[10px] text-yellow-300/70">
                Add this URL through Manage portal links.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (missingExternalUrl) {
    return <div className="block h-full cursor-not-allowed" title="Add this URL through Manage portal links.">{body}</div>;
  }

  if (portal.mode === "external") {
    return <a href={portal.href} target="_blank" rel="noreferrer" className="block h-full">{body}</a>;
  }

  return <Link href={portal.href} className="block h-full">{body}</Link>;
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

      if (!response.ok || !data.links) {
        throw new Error(data.error || "Unable to save portal links.");
      }

      onSaved(data.links);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save portal links.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02030d]/80 px-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="portal-link-manager-title">
      <motion.form
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onSubmit={saveLinks}
        className="w-full max-w-2xl rounded-[28px] border border-cyan-100/20 bg-[#080b1b]/95 p-6 shadow-[0_0_80px_rgba(34,211,238,.16)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="portal-link-manager-title" className="text-2xl font-bold text-white">Manage portal links</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-50/62">These links are saved to the shared database and apply to every user and device.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 p-2 text-cyan-50/70 transition hover:border-cyan-100/30 hover:text-white" aria-label="Close portal link manager">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {(Object.keys(portalLinkLabels) as PortalLinkKey[]).map((key) => (
            <label key={key} className="block">
              <span className="mb-2 block text-sm font-semibold text-cyan-50/86">{portalLinkLabels[key]}</span>
              <input
                type="text"
                inputMode="url"
                value={draft[key]}
                onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                placeholder="https://portal.example.com"
                className="w-full rounded-2xl border border-cyan-100/16 bg-white/[0.055] px-4 py-3 text-sm text-white outline-none transition placeholder:text-cyan-50/28 focus:border-cyan-200/45 focus:bg-white/[0.075]"
              />
            </label>
          ))}
        </div>

        {error && <p className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-cyan-50/70 transition hover:border-white/20 hover:text-white">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/35 bg-cyan-200/12 px-4 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:cursor-wait disabled:opacity-60">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save links"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

export default function Landing() {
  const [portalLinks, setPortalLinks] = useState<PortalLinks>(initialPortalLinks);
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPortalLinks() {
      try {
        const response = await fetch("/api/portal-links");
        if (!response.ok) return;

        const data = await response.json() as { links?: PortalLinks };
        if (!cancelled && data.links) setPortalLinks(data.links);
      } catch {
        // Legacy build-time links remain available if the API is temporarily unavailable.
      }
    }

    void loadPortalLinks();
    return () => { cancelled = true; };
  }, []);

  const resolvedPortalCards = portalCards.map((portal) => {
    if (!portal.portalKey) return portal;
    return { ...portal, href: portalLinks[portal.portalKey] };
  });

  return (
    <main className="aurora-bg aurora-home min-h-screen px-6 py-8 text-white">
      <div className="aurora-orbs" aria-hidden="true" />
      <section className="relative z-10 mx-auto max-w-[900px] pt-1">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
        >
          <OccuMedWordmark />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-2 text-center">
          <h1 className="text-6xl font-black tracking-[-0.065em] text-white drop-shadow-[0_0_34px_rgba(167,139,250,.26)] md:text-7xl">Insight Hub</h1>
          <p className="mx-auto mt-5 max-w-[620px] text-base leading-8 text-cyan-50/72">
            The strategic intelligence command center for Occu-Med — surfacing occupational health opportunities, quantifying workforce risk, and mapping the competitive landscape.
          </p>
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-white/[0.045] px-4 py-2 text-xs font-semibold tracking-wide text-cyan-50/76 transition hover:border-cyan-100/36 hover:bg-white/[0.075] hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
            Manage portal links
          </button>
        </motion.div>
        <div className="mt-10 grid items-stretch gap-5 md:grid-cols-3">
          {resolvedPortalCards.map((portal, index) => (
            <PortalCard key={portal.title} portal={portal} index={index} />
          ))}
        </div>
      </section>

      {managerOpen && (
        <PortalLinkManager
          links={portalLinks}
          onClose={() => setManagerOpen(false)}
          onSaved={setPortalLinks}
        />
      )}
    </main>
  );
}
