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

export default function WarCostsMap() {
  const [responses, setResponses] = useState<Record<string, WarCostsDatasetResponse>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const pairs = await Promise.all(MAP_DATASETS.map(async (name) => {
        try { return [name, await getWarCostsDataset(name, force)] as const; }
        catch { return [name, null] as const; }
      }));
      const next: Record<string, WarCostsDatasetResponse> = {};
      for (const [name, response] of pairs) if (response) next[name] = response;
      setResponses(next);
      if (!next["conflicts.json"] || !next["base-index.json"]) setError("Some WarCosts map feeds are unavailable; the independent map will render every layer that loaded successfully.");
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
          <HeaderBar eyebrow="WarCosts Intelligence" title="War Map" subtitle="A completely independent ArcGIS workspace for WarCosts operational geography. It uses installation-level WarCosts base records and does not reuse the AOR MapTiler map, AOR state, or AOR layers." />
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-50 disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh map data</button>
        </div>
        <WarCostsWorkspaceNav />
        {error && <GlassCard className="mt-5 border-amber-300/18 p-4 text-xs text-amber-100">{error}</GlassCard>}
        <div className="mt-5">
          {loading ? <GlassCard className="grid min-h-[720px] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-200" /><p className="mt-3 text-sm font-bold">Loading the independent WarCosts map feeds…</p></div></GlassCard> : <WarCostsArcGisMap conflicts={wcRows(data["conflicts.json"])} bases={wcRows(data["base-index.json"])} deployments={wcRows(data["overseas-presence.json"])} operations={wcRows(data["operations.json"])} strikes={wcRows(data["drone-strikes.json"])} />}
        </div>
      </section>
    </main>
  );
}
