import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BadgeCheck,
  Building2,
  Database,
  ExternalLink,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  getSavedGeographicEntities,
  type SavedGeographicEntity,
} from "@/data/geographicFootprintApi";

function formatDate(value?: string) {
  if (!value) return "Not yet refreshed";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function locationLabel(entity: SavedGeographicEntity) {
  const countries = new Set(entity.locations.map((location) => location.country).filter(Boolean));
  if (entity.locations.length === 0) return "No saved locations";
  return `${entity.locations.length} saved location${entity.locations.length === 1 ? "" : "s"} · ${countries.size} countr${countries.size === 1 ? "y" : "ies"}`;
}

function CompanyDetail({ entity, onClose }: { entity: SavedGeographicEntity; onClose: () => void }) {
  const countries = Array.from(new Set(entity.locations.map((location) => location.country).filter(Boolean))).sort();
  const verified = entity.locations.filter((location) => location.reviewStatus === "verified").length;

  function restoreTriggerFocus() {
    window.setTimeout(() => {
      const trigger = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Open details for "]'),
      ).find((button) => button.getAttribute("aria-label") === `Open details for ${entity.name}`);
      trigger?.focus({ preventScroll: true });
    }, 0);
  }

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          restoreTriggerFocus();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[1099] bg-black/52 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreTriggerFocus();
          }}
          className="fixed inset-y-0 right-0 z-[1100] h-dvh w-full max-w-[560px] overflow-y-auto border-l border-cyan-100/14 bg-[#04101d]/98 p-6 text-white shadow-[-30px_0_90px_rgba(0,0,0,.62)] outline-none backdrop-blur-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-100/42">Public company record</p>
              <DialogPrimitive.Title className="mt-2 text-3xl font-black tracking-[-.04em]">{entity.name}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-sm text-cyan-50/55">Saved public-source intelligence only. No client or commercial relationship is implied.</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <button type="button" aria-label="Close company details" className="rounded-xl border border-white/10 bg-white/[0.035] p-2 text-cyan-100/55 transition hover:text-white">
                <X size={18} />
              </button>
            </DialogPrimitive.Close>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <GlassCard variant="glass" className="p-4"><p className="text-[9px] uppercase tracking-[.14em] text-cyan-100/35">Locations</p><p className="mt-1 text-2xl font-black">{entity.locations.length}</p></GlassCard>
            <GlassCard variant="glass" className="p-4"><p className="text-[9px] uppercase tracking-[.14em] text-cyan-100/35">Countries</p><p className="mt-1 text-2xl font-black">{countries.length}</p></GlassCard>
            <GlassCard variant="glass" className="p-4"><p className="text-[9px] uppercase tracking-[.14em] text-cyan-100/35">Verified</p><p className="mt-1 text-2xl font-black">{verified}</p></GlassCard>
          </div>

          <section className="mt-5 rounded-[24px] border border-white/9 bg-white/[0.025] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">Saved source state</p>
                <p className="mt-1 text-sm font-bold text-white/82">{entity.discoveryStatus || entity.status || "Saved"}</p>
              </div>
              <BadgeCheck size={20} className="text-cyan-200/62" />
            </div>
            <p className="mt-3 text-xs text-cyan-100/42">Last public-source discovery: {formatDate(entity.lastDiscoveryAt)}</p>
            {entity.wikidataId ? <p className="mt-1 text-xs text-cyan-100/42">Wikidata: {entity.wikidataId}</p> : null}
            {entity.officialWebsite ? <a href={entity.officialWebsite} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200/70 hover:text-white">Official website <ExternalLink size={12} /></a> : null}
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black">Saved public locations</h3>
              <span className="text-[10px] text-cyan-100/36">{entity.locations.length} records</span>
            </div>
            <div className="mt-3 space-y-2">
              {entity.locations.length === 0 ? <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-xs text-cyan-100/45">No saved public locations yet.</div> : entity.locations.slice(0, 40).map((location) => (
                <div key={location.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="flex items-start gap-3">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-cyan-200/55" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white/80">{location.placeName || location.formattedAddress || [location.city, location.state, location.country].filter(Boolean).join(", ")}</p>
                      <p className="mt-1 text-xs text-cyan-100/42">{[location.city, location.state, location.country].filter(Boolean).join(", ")}</p>
                      <p className="mt-1 text-[10px] text-cyan-100/32">{location.facilityType || "Public location"} · {location.reviewStatus}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function PublicCompanyLibraryPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SavedGeographicEntity | null>(null);
  const entitiesQ = useQuery({
    queryKey: ["public-company-library"],
    queryFn: getSavedGeographicEntities,
  });
  const entities = entitiesQ.data?.entities ?? [];
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => entities.filter((entity) => {
    if (!needle) return true;
    const locationText = entity.locations.map((location) => `${location.placeName || ""} ${location.city || ""} ${location.state || ""} ${location.country || ""}`).join(" ");
    return `${entity.name} ${entity.enteredName || ""} ${locationText}`.toLowerCase().includes(needle);
  }), [entities, needle]);
  const countryCount = useMemo(() => new Set(entities.flatMap((entity) => entity.locations.map((location) => location.country).filter(Boolean))).size, [entities]);
  const locationCount = useMemo(() => entities.reduce((sum, entity) => sum + entity.locations.length, 0), [entities]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(13,148,136,.28),transparent_32%),radial-gradient(circle_at_70%_34%,rgba(14,165,233,.22),transparent_38%),linear-gradient(145deg,#020817_8%,#06243b_48%,#071333_72%,#0b0824)]" />
      <Sidebar />
      <main className="relative min-h-screen px-5 py-8 sm:px-8 lg:ml-[210px] lg:px-10 xl:px-14">
        <HeaderBar eyebrow="Public Intelligence" title="Company Library" subtitle="Saved public-source company intelligence. Select a company once, then carry that company context into the other intelligence workspaces." />

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <GlassCard variant="glass" className="p-5"><div className="flex items-center gap-3"><Building2 size={18} className="text-cyan-200/65" /><div><p className="text-2xl font-black">{entities.length}</p><p className="text-xs text-cyan-100/40">Researched companies</p></div></div></GlassCard>
          <GlassCard variant="glass" className="p-5"><div className="flex items-center gap-3"><MapPin size={18} className="text-cyan-200/65" /><div><p className="text-2xl font-black">{locationCount}</p><p className="text-xs text-cyan-100/40">Saved public locations</p></div></div></GlassCard>
          <GlassCard variant="glass" className="p-5"><div className="flex items-center gap-3"><Database size={18} className="text-cyan-200/65" /><div><p className="text-2xl font-black">{countryCount}</p><p className="text-xs text-cyan-100/40">Countries represented</p></div></div></GlassCard>
        </div>

        <GlassCard variant="glass" className="mb-6 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex min-h-11 flex-1 items-center gap-3 rounded-2xl border border-cyan-100/12 bg-[#071321]/78 px-4">
              <Search size={16} className="shrink-0 text-cyan-100/45" />
              <span className="sr-only">Search researched companies</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search companies, cities, states, or countries…" className="w-full bg-transparent text-sm outline-none placeholder:text-cyan-100/28" />
            </label>
            <p className="text-[11px] text-cyan-100/38">Opening this library never triggers an external scan.</p>
          </div>
        </GlassCard>

        {entitiesQ.isLoading ? <GlassCard variant="glass" className="p-8 text-sm text-cyan-100/50">Loading saved company intelligence…</GlassCard> : entitiesQ.error ? <GlassCard variant="glass" className="border-rose-300/20 p-8 text-sm text-rose-100/80">{entitiesQ.error instanceof Error ? entitiesQ.error.message : "The company library could not be loaded."}</GlassCard> : filtered.length === 0 ? <GlassCard variant="glass" className="p-8 text-sm text-cyan-100/50">{entities.length === 0 ? "No saved public company records are available yet." : `No saved companies match “${query.trim()}”.`}</GlassCard> : <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((entity) => (
            <button key={entity.id} type="button" aria-label={`Open details for ${entity.name}`} onClick={() => setSelected(entity)} className="block h-full w-full rounded-[28px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/55">
              <GlassCard variant="glass" className="h-full p-5 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/28">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/38">Public research target</p>
                    <h2 className="mt-2 truncate text-xl font-black tracking-[-.025em]">{entity.name}</h2>
                  </div>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-100/10 bg-cyan-300/[0.055]"><Building2 size={17} className="text-cyan-200/66" /></div>
                </div>
                <p className="mt-4 text-sm text-cyan-50/54">{locationLabel(entity)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/8 bg-white/[0.025] px-2.5 py-1 text-[10px] text-cyan-100/44">{entity.status || "saved"}</span>
                  {entity.discoveryStatus ? <span className="rounded-full border border-white/8 bg-white/[0.025] px-2.5 py-1 text-[10px] text-cyan-100/44">{entity.discoveryStatus}</span> : null}
                  {entity.locations.some((location) => location.reviewStatus === "verified") ? <span className="rounded-full border border-emerald-200/12 bg-emerald-300/[0.04] px-2.5 py-1 text-[10px] text-emerald-100/58">verified evidence</span> : null}
                </div>
                <p className="mt-4 text-[10px] text-cyan-100/30">Last discovery: {formatDate(entity.lastDiscoveryAt)}</p>
              </GlassCard>
            </button>
          ))}
        </div>}
      </main>
      {selected ? <CompanyDetail entity={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

export default PublicCompanyLibraryPage;