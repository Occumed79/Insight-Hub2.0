import { AlertTriangle, ArrowUpRight, CircleDot, RadioTower } from "lucide-react";

export type AorPriorityLevel = "critical" | "elevated" | "monitor" | "context";
export type AorPrioritySignal = {
  id: string;
  level: AorPriorityLevel;
  source: string;
  title: string;
  detail?: string;
  timestamp?: string;
  href?: string;
};

type PriorityInput = {
  advisory?: any;
  outbreaks?: any[];
  disasters?: any[];
  earthquakes?: any[];
  crisisUpdates?: any[];
  healthNotices?: string[];
  environmentLabels?: string[];
};

const LEVEL_RANK: Record<AorPriorityLevel, number> = { critical: 0, elevated: 1, monitor: 2, context: 3 };

function safeUrl(value?: string) {
  if (!value) return "";
  try { const parsed = new URL(value); return parsed.protocol === "https:" ? parsed.toString() : ""; } catch { return ""; }
}

function signal(id: string, level: AorPriorityLevel, source: string, title: string, detail?: string, timestamp?: string, href?: string): AorPrioritySignal {
  return { id, level, source, title, detail, timestamp, href: safeUrl(href) || undefined };
}

function advisoryLevel(raw: unknown): AorPriorityLevel {
  const level = Number(raw);
  if (level >= 4) return "critical";
  if (level >= 3) return "elevated";
  if (level >= 2) return "monitor";
  return "context";
}

function gdacsLevel(raw: unknown): AorPriorityLevel {
  const level = String(raw || "").toUpperCase();
  if (level === "RED") return "critical";
  if (level === "ORANGE") return "elevated";
  if (level === "GREEN") return "monitor";
  return "context";
}

function earthquakeLevel(item: any): AorPriorityLevel {
  if (item?.tsunami) return "critical";
  const magnitude = Number(item?.magnitude);
  if (Number.isFinite(magnitude) && magnitude >= 7) return "critical";
  if (Number.isFinite(magnitude) && magnitude >= 6) return "elevated";
  if (Number.isFinite(magnitude) && magnitude >= 5) return "monitor";
  return "context";
}

export function buildAorPrioritySignals(input: PriorityInput): AorPrioritySignal[] {
  const items: AorPrioritySignal[] = [];
  const advisory = input.advisory;
  if (advisory) {
    items.push(signal(
      `state-${advisory.level || "advisory"}`,
      advisoryLevel(advisory.level),
      "U.S. Department of State",
      `Level ${advisory.level ?? "?"} · ${advisory.levelLabel || "Travel advisory"}`,
      advisory.summary || advisory.details || "Review the official travel advisory.",
      advisory.updatedAt || advisory.date,
      advisory.sourceUrl,
    ));
  }

  for (const [index, item] of (input.disasters || []).slice(0, 8).entries()) {
    items.push(signal(
      `gdacs-${item.eventId || item.id || index}`,
      gdacsLevel(item.alertLevel),
      "GDACS",
      `${String(item.alertLevel || "Alert").toUpperCase()} · ${item.name || item.title || "Natural hazard"}`,
      item.description || item.country,
      item.fromDate || item.publishedAt,
      item.sourceUrl || item.url,
    ));
  }

  for (const [index, item] of (input.earthquakes || []).slice(0, 8).entries()) {
    const magnitude = Number(item.magnitude);
    items.push(signal(
      `usgs-${item.id || index}`,
      earthquakeLevel(item),
      "USGS",
      item.title || item.place || (Number.isFinite(magnitude) ? `M${magnitude.toFixed(1)} earthquake` : "Earthquake"),
      `${Number.isFinite(magnitude) ? `Magnitude ${magnitude.toFixed(1)}` : "Magnitude not supplied"}${item.depthKm == null ? "" : ` · ${item.depthKm} km depth`}${item.tsunami ? " · tsunami flag" : ""}`,
      item.occurredAt,
      item.url,
    ));
  }

  for (const [index, item] of (input.outbreaks || []).slice(0, 6).entries()) {
    items.push(signal(
      `who-${item.id || index}`,
      "monitor",
      "WHO Disease Outbreak News",
      item.title || "WHO disease outbreak update",
      item.summary,
      item.publicationDate || item.publishedAt,
      item.sourceUrl || item.url,
    ));
  }

  for (const [index, item] of (input.crisisUpdates || []).slice(0, 4).entries()) {
    items.push(signal(
      `crisis-${item.id || index}`,
      "monitor",
      "CrisisWatch",
      item.title || item.headline || "CrisisWatch update",
      item.summary || item.description,
      item.publishedAt || item.date,
      item.sourceUrl || item.url,
    ));
  }

  for (const [index, notice] of (input.healthNotices || []).slice(0, 4).entries()) {
    items.push(signal(`cdc-notice-${index}`, "monitor", "CDC Travelers' Health", notice, "Destination-specific travel health notice."));
  }

  if ((input.environmentLabels || []).length) {
    items.push(signal(
      "reviewer-environment",
      "context",
      "Reviewer-confirmed conditions",
      `${input.environmentLabels!.length} environmental / human-performance factor${input.environmentLabels!.length === 1 ? "" : "s"} selected`,
      input.environmentLabels!.join(" · "),
    ));
  }

  return items
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || String(b.timestamp || "").localeCompare(String(a.timestamp || "")))
    .slice(0, 10);
}

const levelTone: Record<AorPriorityLevel, string> = {
  critical: "border-rose-200/24 bg-rose-300/[0.08] text-rose-50",
  elevated: "border-amber-200/24 bg-amber-300/[0.08] text-amber-50",
  monitor: "border-cyan-200/20 bg-cyan-300/[0.055] text-cyan-50",
  context: "border-white/11 bg-white/[0.025] text-white/72",
};

const levelLabel: Record<AorPriorityLevel, string> = {
  critical: "Critical",
  elevated: "Elevated",
  monitor: "Monitor",
  context: "Context",
};

export function AorPriorityBrief({ context, signals, loading = false, error = "" }: { context: string; signals: AorPrioritySignal[]; loading?: boolean; error?: string }) {
  const actionCount = signals.filter((item) => item.level === "critical" || item.level === "elevated").length;
  const monitorCount = signals.filter((item) => item.level === "monitor").length;
  return (
    <section data-testid="aor-priority-brief" className="rounded-[24px] border border-cyan-100/14 bg-gradient-to-br from-cyan-300/[0.07] via-[#03101b]/76 to-violet-300/[0.06] p-4 shadow-[0_18px_55px_rgba(0,0,0,.24)] backdrop-blur-2xl md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
<p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-100/46">Operational Priority Brief</p>
<h2 className="mt-1 text-lg font-black text-white">{context}</h2>
<p className="mt-1 max-w-3xl text-[10px] leading-5 text-cyan-100/42">Source-defined triage keeps urgent source signals above background context. It does not combine unrelated feeds into a fabricated danger score.</p>
        </div>
        <div className="flex gap-2 text-[9px] font-black uppercase tracking-[0.12em]">
<span className="rounded-full border border-amber-100/16 bg-amber-300/[0.055] px-2.5 py-1 text-amber-50/72">{actionCount} action</span>
<span className="rounded-full border border-cyan-100/16 bg-cyan-300/[0.055] px-2.5 py-1 text-cyan-50/72">{monitorCount} monitor</span>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-amber-200/16 bg-amber-300/[0.045] p-3 text-[10px] leading-5 text-amber-100/72"><AlertTriangle size={13} className="mr-2 inline" />{error}</div> : null}
      {loading && !signals.length ? <div className="mt-4 flex min-h-24 items-center justify-center gap-2 text-xs text-cyan-100/46"><RadioTower size={15} className="animate-pulse" />Loading current source signals…</div> : signals.length ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
{signals.slice(0, 6).map((item) => (
  <article key={item.id} className={`rounded-2xl border p-3.5 ${levelTone[item.level]}`}>
    <div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.12em]"><CircleDot size={9} />{levelLabel[item.level]}</span><span className="text-[8px] font-bold uppercase tracking-[0.1em] opacity-50">{item.source}</span></div>
    <h3 className="mt-2 text-[11px] font-black leading-4">{item.title}</h3>
    {item.detail ? <p className="mt-2 line-clamp-3 text-[9px] leading-4 opacity-60">{item.detail}</p> : null}
    {item.href ? <a href={item.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[9px] font-black opacity-70 hover:opacity-100">Open source<ArrowUpRight size={9} /></a> : null}
  </article>
))}
        </div>
      ) : <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-[10px] leading-5 text-cyan-100/42">No current signal met a source-specific display rule for this selection. Raw source sections remain available below.</div>}
    </section>
  );
}
