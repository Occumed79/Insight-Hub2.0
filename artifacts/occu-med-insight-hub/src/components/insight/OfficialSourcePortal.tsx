import { useMemo, useState } from "react";
import { ArrowUpRight, Database, RefreshCw } from "lucide-react";

export type OfficialSourcePortalMode = "occupational" | "onet";

type SourcePortal = {
  id: string;
  label: string;
  shortLabel: string;
  url: string;
  description: string;
};

const OCCUPATIONAL_SOURCES: SourcePortal[] = [
  {
    id: "bls",
    label: "BLS Injuries, Illnesses & Fatalities",
    shortLabel: "BLS",
    url: "https://www.bls.gov/iif/data-overview.htm",
    description: "Official BLS occupational injury, illness, fatality, state, table, chart, and database access.",
  },
  {
    id: "osha",
    label: "OSHA Data",
    shortLabel: "OSHA",
    url: "https://www.osha.gov/data",
    description: "Official OSHA injury, illness, fatality, enforcement, chemical exposure, inspection, and historical data portal.",
  },
  {
    id: "datagov",
    label: "Data.gov Catalog",
    shortLabel: "Data.gov",
    url: "https://catalog.data.gov/",
    description: "The federal open-data catalog, shown directly inside the Occupational Data Explorer workspace.",
  },
];

const ONET_SOURCE: SourcePortal = {
  id: "onet",
  label: "O*NET OnLine",
  shortLabel: "O*NET",
  url: "https://www.onetonline.org/",
  description: "Official O*NET occupation, task, work-context, ability, skill, knowledge, activity, technology, and work-style portal.",
};

function PortalFrame({ source }: { source: SourcePortal }) {
  const [frameKey, setFrameKey] = useState(0);
  const proxyUrl = `/api/official-source-webview?source=${encodeURIComponent(source.id)}&url=${encodeURIComponent(source.url)}&reload=${frameKey}`;

  return (
    <section className="overflow-hidden rounded-[24px] border border-cyan-100/16 bg-[#020812] shadow-[0_24px_70px_rgba(0,0,0,.42)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#08121f]/96 px-3 py-2.5 md:px-4">
        <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300/75" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/75" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/75" />
        </div>

        <div className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
          <div className="flex items-center gap-2">
            <Database size={13} className="shrink-0 text-cyan-200/65" />
            <span className="truncate text-[10px] font-semibold text-cyan-50/60">{source.url}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFrameKey((value) => value + 1)}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-[10px] font-bold text-cyan-50/65 transition hover:border-cyan-200/25 hover:text-white"
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
          Open official
          <ArrowUpRight size={13} />
        </a>
      </div>

      <div className="relative bg-white">
        <iframe
          key={`${source.id}-${frameKey}`}
          src={proxyUrl}
          title={`${source.label} official data portal`}
          className="block h-[72vh] min-h-[680px] w-full bg-white"
          loading="eager"
          referrerPolicy="no-referrer"
          sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-scripts allow-downloads"
        />
      </div>

      <div className="border-t border-white/10 bg-[#07111d] px-4 py-2.5 text-[10px] leading-5 text-cyan-50/45">
        Official public-source content is rendered through Insight Hub's isolated webview so publisher anti-framing rules do not leave the workspace blank. Navigation remains restricted to the selected official domain.
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
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/52">Official source portal</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-white">{active.label}</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-cyan-50/52">{active.description}</p>
        </div>
        {sources.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => setActiveId(source.id)}
                className={`min-h-10 rounded-xl border px-4 text-xs font-black transition ${
                  active.id === source.id
                    ? "border-cyan-200/30 bg-cyan-300/[0.12] text-white"
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
