import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
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
        !next["conflicts.json"] || !next["base-index.json"] ? "Some WarCosts map feeds are unavailable; every successful WarCosts layer will still render." : "",
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

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <HeaderBar eyebrow="WarCosts Intelligence" title="War Map" subtitle="Independent ArcGIS defense intelligence: WarCosts conflict/base/operation data plus Michael Allen / troopdata force-presence and construction layers. It does not reuse the AOR MapTiler map, AOR state, or AOR health layers." />
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-50 disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh defense data</button>
        </div>
        <WarCostsWorkspaceNav />
        {error && <GlassCard className="mt-5 border-amber-300/18 p-4 text-xs text-amber-100">{error}</GlassCard>}
        <div className="mt-5">
          {loading ? <GlassCard className="grid min-h-[720px] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-200" /><p className="mt-3 text-sm font-bold">Loading independent defense-intelligence feeds…</p></div></GlassCard> : <WarCostsArcGisMap conflicts={wcRows(data["conflicts.json"])} bases={wcRows(data["base-index.json"])} deployments={wcRows(data["overseas-presence.json"])} operations={wcRows(data["operations.json"])} strikes={wcRows(data["drone-strikes.json"])} personnel={defensePresence?.current || []} construction={defensePresence?.construction || []} personnelYear={defensePresence?.latestYear ?? null} />}
        </div>
      </section>
    </main>
  );
}
