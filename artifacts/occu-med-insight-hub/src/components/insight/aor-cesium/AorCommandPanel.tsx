import { useMemo, useState } from "react";
import { MapPin, X } from "lucide-react";
import { AorCommandNews } from "./AorCommandNews";
import { COMMAND_VIEW, EVIDENCE_CLASS_LABEL, geographicClassLabel, type CommandId, type DirectoryIndex, type DirectoryLocation } from "./aor-directory";

/** Command-level navigation: every location the registry assigns to the command, with how well each assignment is evidenced. */
export function AorCommandPanel({ command, directory, onPick, onClose }: { command: CommandId; directory: DirectoryIndex; onPick: (id: string) => void; onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"locations" | "news">("locations");
  const summary = directory.directory.commands.find((entry) => entry.id === command);
  const view = COMMAND_VIEW[command];
  const members = useMemo(() => directory.directory.locations.filter((entry) => entry.command === command), [directory, command]);
  const needle = filter.trim().toLowerCase();
  const shown = members.filter((entry) => !needle || entry.name.toLowerCase().includes(needle) || entry.aliases.some((alias) => alias.toLowerCase().includes(needle)) || entry.iso2?.toLowerCase() === needle || entry.iso3?.toLowerCase() === needle);
  const sovereign = shown.filter((entry) => entry.entityType === "sovereign");
  const entities = shown.filter((entry) => entry.entityType === "entity");
  const classCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of members) counts.set(entry.evidenceClass ?? "unknown", (counts.get(entry.evidenceClass ?? "unknown") ?? 0) + 1);
    return counts;
  }, [members]);

  const row = (entry: DirectoryLocation) => (
    <li key={entry.id}>
      <button type="button" data-testid="aor-command-location" data-location-id={entry.id} onClick={() => onPick(entry.id)} className="flex w-full items-center justify-between gap-2 border-b border-white/[.04] px-1 py-1.5 text-left hover:bg-white/[.05]">
        <span className="min-w-0"><span className="block truncate text-[13px] text-white/90">{entry.name}</span><span className="block truncate text-[11px] text-slate-500">{entry.entityType === "entity" ? geographicClassLabel(entry) : entry.iso3 ?? ""}{entry.parentName ? ` · part of ${entry.parentName}` : ""}</span></span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">{!entry.boundaryIso2 ? <span title="No boundary polygon; shown as a reference point" className="inline-flex items-center gap-0.5"><MapPin size={8} />point</span> : null}{entry.evidenceClass && entry.evidenceClass !== "individually_verified" ? <span className={entry.evidenceClass === "provisional" ? "text-amber-300" : "text-slate-400"}>{EVIDENCE_CLASS_LABEL[entry.evidenceClass]}</span> : null}</span>
      </button>
    </li>
  );

  return (
    <aside data-testid="aor-command-panel" className="pointer-events-auto absolute bottom-4 right-4 top-4 z-30 flex w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[22px] border border-white/[.09] bg-[#050d14]/82 text-white shadow-[0_18px_60px_rgba(0,0,0,.5)] backdrop-blur-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-white/[.07] px-4 py-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-cyan-100/45">Combatant command</p>
          <h2 className="text-[15px] font-bold leading-5"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: view.color }} />{view.label}</h2>
          <p className="mt-0.5 text-[12px] leading-4 text-slate-400">{summary ? `${summary.total} locations in the registry — ${summary.sovereign} sovereign, ${summary.entities} territories and other entities.` : `${members.length} locations.`} Select one to see its health and medical requirements.</p>
          <p className="mt-0.5 text-[11px] leading-3 text-slate-500">{[...classCounts].map(([key, count]) => `${count} ${key === "unknown" ? "unclassified" : EVIDENCE_CLASS_LABEL[key as keyof typeof EVIDENCE_CLASS_LABEL].toLowerCase()}`).join(" · ")}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close command panel" className="rounded-full border border-white/10 p-1.5 text-slate-400 hover:text-white"><X size={13} /></button>
      </header>
      <nav className="flex gap-1 border-b border-white/[.06] px-3 py-2" aria-label="Command panel sections">
        {([["locations", "Locations"], ["news", "News & publications"]] as const).map(([id, text]) => (
          <button key={id} type="button" data-testid={`aor-command-tab-${id}`} aria-pressed={tab === id} onClick={() => setTab(id)} className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${tab === id ? "border-cyan-200/25 bg-cyan-200/10 text-white" : "border-white/[.06] text-slate-400 hover:text-white"}`}>{text}</button>
        ))}
      </nav>
      {tab === "news" ? <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2"><AorCommandNews key={command} command={command} active /></div> : <>
      <div className="border-b border-white/[.06] px-3 py-2"><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Filter ${view.short} locations`} aria-label={`Filter ${view.short} locations`} className="min-h-8 w-full rounded-lg border border-white/[.08] bg-black/25 px-3 text-[13px] text-white outline-none placeholder:text-slate-600" /></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {sovereign.length ? <section><h3 className="text-[12px] font-black uppercase tracking-[.14em] text-slate-400">Sovereign states ({sovereign.length})</h3><ul>{sovereign.map(row)}</ul></section> : null}
        {entities.length ? <section className="mt-3"><h3 className="text-[12px] font-black uppercase tracking-[.14em] text-slate-400">Territories, dependencies and other entities ({entities.length})</h3><ul>{entities.map(row)}</ul></section> : null}
        {!shown.length ? <p className="py-3 text-[13px] text-slate-500">No location matches “{filter}”.</p> : null}
      </div>
      </>}
    </aside>
  );
}
