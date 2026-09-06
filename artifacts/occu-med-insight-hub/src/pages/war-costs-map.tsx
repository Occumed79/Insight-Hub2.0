import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { WarCostsArcGisMap } from "./war-costs-arcgis-map";
import { wcRows } from "./war-costs-utils";

const MAP_DATASETS = [
  "conflicts.json",
  "base-index.json",
  "overseas-presence.json",
  "operations.json",
  "drone-strikes.json",
] as const;

type DefensePresence = {
  ok: boolean;
  partial?: boolean;
  latestYear?: number | null;
  current?: Array<Record<string, unknown>>;
  construction?: Array<Record<string, unknown>>;
  warnings?: string[];
};

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

export default function WarCostsMap() {
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [pairs, defense] = await Promise.all([
        Promise.all(MAP_DATASETS.map(async (name) => {
          try { return [name, await getWarCostsDataset(name, force)] as const; }
          catch { return [name, null] as const; }
        })),
        getDefensePresence(force).catch((reason) => ({ ok: false, partial: true, current: [], construction: [], warnings: [reason instanceof Error ? reason.message : "Michael Allen defense-presence feed failed."] } as DefensePresence)),
      ]);
      const next: Record<string, WarCostsDatasetResponse> = {};
      for (const [name, response] of pairs) if (response) next[name] = response;
      setResponses(next);
      setDefensePresence(defense);
      const warnings = [
        !next["conflicts.json"] || !next["base-index.json"] ? "Some WarCosts map feeds are unavailable; every successful layer will still render." : "",
        ...(defense.warnings || []),
      ].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "WarCosts map data could not load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);
  const data = useMemo(() => Object.fromEntries(Object.entries(responses).map(([name, response]) => [name, response.data])) as Record<string, unknown>, [responses]);
  const feedCount = Object.keys(responses).length;
  const personnelCount = defensePresence?.current?.length ?? 0;

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 flex min-h-screen flex-col px-5 pb-5 pt-5 lg:ml-[210px] lg:px-6">
        <header className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-300/10 pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">WarCosts Intelligence</p>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <p className="text-[11px] font-semibold text-slate-500">ArcGIS defense workspace</p>
            </div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.04em] text-white">War Map</h1>
            <p className="mt-1 max-w-4xl text-[13px] leading-5 text-slate-400">
              Independent defense intelligence combining WarCosts conflict, base and operation records with force-presence and military-construction layers.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 pt-1">
            <div className="hidden items-center gap-4 border-r border-slate-300/10 pr-4 xl:flex">
              <div className="text-right"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Feeds</p><p className="mt-0.5 text-sm font-bold text-slate-200">{loading ? "—" : `${feedCount}/${MAP_DATASETS.length}`}</p></div>
              <div className="text-right"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Presence rows</p><p className="mt-0.5 text-sm font-bold text-slate-200">{loading ? "—" : personnelCount.toLocaleString()}</p></div>
            </div>
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300/14 bg-white/[0.035] px-3 text-[12px] font-semibold text-slate-200 transition hover:border-cyan-200/24 hover:bg-white/[0.055] disabled:opacity-50">
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />Refresh
            </button>
          </div>
        </header>

        <div className="shrink-0"><WarCostsWorkspaceNav /></div>

        {error ? <div className="mt-3 shrink-0 border-l-2 border-amber-300/50 bg-amber-300/[0.035] px-3 py-2 text-[12px] leading-5 text-amber-100/80">{error}</div> : null}

        <div className="relative mt-3 min-h-[680px] flex-1">
          <WarCostsArcGisMap
            conflicts={wcRows(data["conflicts.json"])}
            bases={wcRows(data["base-index.json"])}
            deployments={wcRows(data["overseas-presence.json"])}
            operations={wcRows(data["operations.json"])}
            strikes={wcRows(data["drone-strikes.json"])}
            personnel={defensePresence?.current || []}
            construction={defensePresence?.construction || []}
            personnelYear={defensePresence?.latestYear ?? null}
          />
          {loading ? (
            <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full border border-slate-300/12 bg-[#07101b]/88 px-4 py-2 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-200"><Loader2 size={14} className="animate-spin text-cyan-200" />Syncing defense feeds…</div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
