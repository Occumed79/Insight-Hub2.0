import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { getWarDefensePresence, type WarDefensePresenceResponse } from "@/data/warDefensePresenceApi";
import { WarCostsArcGisMap } from "./war-costs-arcgis-map";
import { wcRows } from "./war-costs-utils";

const MAP_DATASETS = [
  "conflicts.json",
  "base-index.json",
  "overseas-presence.json",
  "operations.json",
  "drone-strikes.json",
] as const;

export default function WarCostsMap() {
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [defense, setDefense] = useState<WarDefensePresenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [pairs, defenseResult] = await Promise.all([
        Promise.all(MAP_DATASETS.map(async (name) => {
          try { return [name, await getWarCostsDataset(name, force)] as const; }
          catch { return [name, null] as const; }
        })),
        getWarDefensePresence(force).catch(() => null),
      ]);
      const next: Record<string, WarCostsDatasetResponse> = {};
      for (const [name, response] of pairs) if (response) next[name] = response;
      setResponses(next);
      setDefense(defenseResult);
      const warnings: string[] = [];
      if (!next["conflicts.json"] || !next["base-index.json"]) warnings.push("Some WarCosts map feeds are unavailable; every layer that loaded successfully will still render.");
      if (!defenseResult) warnings.push("Michael Allen / troopdata defense-presence feeds are temporarily unavailable.");
      setError(warnings.join(" "));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "War Map data could not load.");
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
          <HeaderBar eyebrow="WarCosts Intelligence" title="War Map" subtitle="The defense-only ArcGIS workspace: WarCosts operational geography plus Michael Allen / troopdata personnel, facilities, and military-construction intelligence. AOR remains a separate MapTiler health-and-risk map." />
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-50 disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh map data</button>
        </div>
        <WarCostsWorkspaceNav />
        {error && <GlassCard className="mt-5 border-amber-300/18 p-4 text-xs text-amber-100">{error}</GlassCard>}
        <div className="mt-5">
          {loading ? <GlassCard className="grid min-h-[720px] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-200" /><p className="mt-3 text-sm font-bold">Loading WarCosts + defense-presence map feeds…</p></div></GlassCard> : <WarCostsArcGisMap conflicts={wcRows(data["conflicts.json"])} bases={wcRows(data["base-index.json"])} deployments={wcRows(data["overseas-presence.json"])} operations={wcRows(data["operations.json"])} strikes={wcRows(data["drone-strikes.json"])} defense={defense} />}
        </div>
      </section>
    </main>
  );
}
