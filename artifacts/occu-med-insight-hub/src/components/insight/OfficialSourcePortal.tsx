import { useMemo, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";

export type OfficialSourcePortalMode = "occupational" | "onet";

type SourcePortal = {
  id: string;
  label: string;
  shortLabel: string;
  url: string;
  description: string;
  focus: string;
};

const OCCUPATIONAL_SOURCES: SourcePortal[] = [
  {
    id: "bls",
    label: "BLS Industry Injury & Illness Data",
    shortLabel: "BLS",
    url: "https://www.bls.gov/iif/nonfatal-injuries-and-illnesses-tables/soii-summary-historical.htm",
    description: "Detailed SOII industry incidence rates, case counts, DART measures, hours worked, quartiles, and historical tables.",
    focus: "Industry rates · case counts · DART · historical tables",
  },
  {
    id: "osha",
    label: "OSHA Injury & Workplace Data",
    shortLabel: "OSHA",
    url: "https://www.osha.gov/data",
    description: "OSHA injury and illness datasets, severe injury reports, fatalities, enforcement, inspections, and exposure data.",
    focus: "ITA · severe injuries · fatalities · enforcement · exposure",
  },
  {
    id: "datagov",
    label: "Data.gov Occupational Safety Catalog",
    shortLabel: "Data.gov",
    url: "https://catalog.data.gov/?q=occupational+safety+and+health",
    description: "Federal datasets already narrowed to occupational safety and health instead of the generic Data.gov home page.",
    focus: "OSHA · SOII · employee injury · medical evaluation datasets",
  },
];

const ONET_SOURCE: SourcePortal = {
  id: "onet",
  label: "O*NET Occupation Intelligence",
  shortLabel: "O*NET",
  url: "https://www.onetonline.org/find/quick",
  description: "Start directly with occupation title or O*NET-SOC code lookup, then move into tasks, work context, abilities, activities, job zones, industries, and crosswalks.",
  focus: "Occupation search · tasks · work context · physical/cognitive demands",
};

function PortalFrame({ source }: { source: SourcePortal }) {
  const [frameKey, setFrameKey] = useState(0);
  const proxyUrl = `/api/official-source-webview?source=${encodeURIComponent(source.id)}&url=${encodeURIComponent(source.url)}&reload=${frameKey}`;

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-cyan-100/24 bg-[#010611] shadow-[0_32px_100px_rgba(0,0,0,.55),0_0_48px_rgba(34,211,238,.08),inset_0_1px_0_rgba(255,255,255,.08)]">
      <div className="pointer-events-none absolute inset-0 z-10 rounded-[30px] ring-1 ring-inset ring-white/[0.045]" />
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100/12 bg-[#03101c]/94 px-4 py-3 backdrop-blur-2xl md:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-200/18 bg-cyan-300/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.16em] text-cyan-100/70">Official source</span>
            <span className="truncate text-xs font-black text-white">{source.label}</span>
          </div>
          <p className="mt-1 text-[10px] text-cyan-50/46">{source.focus}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFrameKey((value) => value + 1)}
            aria-label={`Reload ${source.shortLabel}`}
            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-[10px] font-bold text-cyan-50/64 transition hover:border-cyan-200/24 hover:text-white"
          >
            <RefreshCw size={13} />
            Reload
          </button>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-cyan-200/18 bg-cyan-300/[0.07] px-3 text-[10px] font-bold text-cyan-50/78 transition hover:border-cyan-200/35 hover:text-white"
          >
            Open source
            <ArrowUpRight size={13} />
          </a>
        </div>
      </div>

      <div className="relative min-h-[720px] bg-white">
        <iframe
          key={`${source.id}-${frameKey}`}
          src={proxyUrl}
          title={`${source.label} official data portal`}
          className="block h-[78vh] min-h-[720px] w-full bg-white"
          loading="eager"
          referrerPolicy="no-referrer"
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-scripts allow-downloads"
        />
      </div>
    </section>
  );
}

export function OfficialSourcePortal({ mode }: { mode: OfficialSourcePortalMode }) {
  const sources = useMemo(() => (mode === "onet" ? [ONET_SOURCE] : OCCUPATIONAL_SOURCES), [mode]);
  const [activeId, setActiveId] = useState(sources[0].id);
  const active = sources.find((source) => source.id === activeId) ?? sources[0];

  return (
    <div className="mb-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/52">Immersive official workspace</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-white">{active.label}</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-cyan-50/52">{active.description}</p>
        </div>
        {sources.length > 1 ? (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Official occupational data source">
            {sources.map((source) => (
              <button
                key={source.id}
                type="button"
                role="tab"
                aria-selected={active.id === source.id}
                onClick={() => setActiveId(source.id)}
                className={`min-h-10 rounded-xl border px-4 text-xs font-black transition ${
                  active.id === source.id
                    ? "border-cyan-200/30 bg-cyan-300/[0.12] text-white shadow-[0_0_24px_rgba(34,211,238,.08)]"
                    : "border-white/10 bg-[#071321]/76 text-cyan-50/58 hover:border-cyan-200/18 hover:text-white"
                }`}
              >
                {source.shortLabel}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <PortalFrame source={active} />
    </div>
  );
}
