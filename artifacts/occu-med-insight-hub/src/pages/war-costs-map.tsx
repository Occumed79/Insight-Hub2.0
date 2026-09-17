import { useEffect, useState } from "react";
import { Globe2, Loader2, Map as MapIcon, RefreshCw } from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { WarCostsArcGisMap } from "./war-costs-arcgis-map";
import { WarCostsMapTilerGlobe } from "./war-costs-maptiler-globe";
import { resolveDefenseMapInputs, warCostsSourceCoordinate, type ResolvedMapInputs } from "./war-costs-geospatial";
import { wcRows, type WarCostsRow } from "./war-costs-utils";

const MAP_DATASETS = ["base-index.json", "conflicts.json", "drone-strikes.json", "operations.json", "overseas-presence.json"] as const;

type DatasetName = typeof MAP_DATASETS[number];
type MapDimension = "2d" | "3d";
type DefensePresence = {
  ok: boolean;
  partial?: boolean;
  latestYear?: number | null;
  current?: Array<Record<string, unknown>>;
  construction?: Array<Record<string, unknown>>;
  warnings?: string[];
};

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

function directOnly(rows: WarCostsRow[]): WarCostsRow[] {
  return rows.filter((row) => Boolean(warCostsSourceCoordinate(row)));
}

export default function WarCostsMap() {
  const [datasets, setDatasets] = useState<Partial<Record<DatasetName, WarCostsDatasetResponse>>>({});
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [resolvedInputs, setResolvedInputs] = useState<ResolvedMapInputs | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mapDimension, setMapDimension] = useState<MapDimension>("2d");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [entries, defense] = await Promise.all([
        Promise.all(MAP_DATASETS.map(async (name) => [name, await getWarCostsDataset(name, force).catch(() => null)] as const)),
        getDefensePresence(force).catch((reason) => ({
          ok: false,
          partial: true,
          current: [],
          construction: [],
          warnings: [reason instanceof Error ? reason.message : "Defense-presence feed failed."],
        } as DefensePresence)),
      ]);
      const next: Partial<Record<DatasetName, WarCostsDatasetResponse>> = {};
      for (const [name, response] of entries) if (response) next[name] = response;
      setDatasets(next);
      setDefensePresence(defense);

      const raw = {
        bases: wcRows(next["base-index.json"]?.data),
        personnel: (defense.current || []) as WarCostsRow[],
        conflicts: wcRows(next["conflicts.json"]?.data),
        strikes: wcRows(next["drone-strikes.json"]?.data),
        operations: wcRows(next["operations.json"]?.data),
        deployments: wcRows(next["overseas-presence.json"]?.data),
      };

      let geospatialWarning = "";
      try {
        const resolved = await resolveDefenseMapInputs({ ...raw, force });
        setResolvedInputs(resolved);
        if (resolved.unresolved) geospatialWarning = `${resolved.unresolved.toLocaleString()} map records were left unplaced because no validated coordinate was available.`;
      } catch (reason) {
        setResolvedInputs({
          bases: directOnly(raw.bases),
          personnel: directOnly(raw.personnel),
          conflicts: directOnly(raw.conflicts),
          strikes: directOnly(raw.strikes),
          operations: directOnly(raw.operations),
          deployments: directOnly(raw.deployments),
          unresolved: raw.bases.length + raw.personnel.length + raw.conflicts.length + raw.strikes.length + raw.operations.length + raw.deployments.length,
        });
        geospatialWarning = `Validated geospatial resolution is temporarily unavailable; only source-coordinate records are plotted. ${reason instanceof Error ? reason.message : ""}`.trim();
      }

      const missing = entries.filter(([, response]) => !response).map(([name]) => name);
      const warnings = [
        missing.length ? `Some approved War Map feeds are temporarily unavailable: ${missing.join(", ")}.` : "",
        ...(defense.warnings || []),
        geospatialWarning,
      ].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Defense intelligence context could not load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  const personnelCount = defensePresence?.current?.length ?? 0;
  const constructionCount = defensePresence?.construction?.length ?? 0;
  const instabilityCount = wcRows(datasets["conflicts.json"]?.data).length + wcRows(datasets["drone-strikes.json"]?.data).length;
  const navalCount = wcRows(datasets["operations.json"]?.data).length + wcRows(datasets["overseas-presence.json"]?.data).length;

  const mapProps = {
    bases: resolvedInputs?.bases || [],
    personnel: resolvedInputs?.personnel || [],
    construction: defensePresence?.construction || [],
    conflicts: resolvedInputs?.conflicts || [],
    strikes: resolvedInputs?.strikes || [],
    operations: resolvedInputs?.operations || [],
    deployments: resolvedInputs?.deployments || [],
    personnelYear: defensePresence?.latestYear ?? null,
  };

  return (
    <main className="war-map-operations-page min-h-screen bg-[#090c10] text-slate-100">
      <Sidebar />
      <section className="flex min-h-screen flex-col lg:ml-[210px]">
        <header className="flex min-h-[68px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/8 bg-[#0b0f14] px-6 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Occu-Med / Defense intelligence</div>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-.035em] text-white">Defense Medical Support Footprint</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex h-10 items-center rounded-md border border-white/10 bg-black/20 p-1" aria-label="Defense map dimensional view">
              <button type="button" aria-pressed={mapDimension === "2d"} onClick={() => setMapDimension("2d")} className={`inline-flex h-8 items-center gap-2 rounded px-3 text-[11px] font-bold transition ${mapDimension === "2d" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-200"}`}><MapIcon size={13} />2D Map</button>
              <button type="button" aria-pressed={mapDimension === "3d"} onClick={() => setMapDimension("3d")} className={`inline-flex h-8 items-center gap-2 rounded px-3 text-[11px] font-bold transition ${mapDimension === "3d" ? "bg-cyan-300/12 text-cyan-50" : "text-slate-500 hover:text-slate-200"}`}><Globe2 size={13} />3D Globe</button>
            </div>
            <div className="flex items-center gap-6 text-right">
              <Metric label="Personnel locations" value={loading ? "—" : personnelCount.toLocaleString()} />
              <Metric label="Expansion sites" value={loading ? "—" : constructionCount.toLocaleString()} />
              <Metric label="Instability signals" value={loading ? "—" : instabilityCount.toLocaleString()} />
              <Metric label="Naval signals" value={loading ? "—" : navalCount.toLocaleString()} />
            </div>
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[.035] px-3 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[.06] disabled:opacity-50">
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />Refresh
            </button>
          </div>
        </header>

        {error ? <div className="shrink-0 border-b border-amber-300/15 bg-amber-400/[.035] px-6 py-2 text-[11px] leading-5 text-amber-100/80">{error}</div> : null}

        <div className="relative min-h-[720px] flex-1 overflow-hidden bg-[#05080c]">
          {mapDimension === "2d" ? <WarCostsArcGisMap {...mapProps} /> : <WarCostsMapTilerGlobe {...mapProps} />}
          {loading ? (
            <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-md border border-white/10 bg-[#0a0f15]/92 px-3 py-2 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-200"><Loader2 size={13} className="animate-spin text-sky-300" />Syncing approved defense intelligence…</div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[9px] font-semibold uppercase tracking-[.11em] text-slate-600">{label}</div><div className="mt-0.5 text-[11px] font-medium text-slate-300">{value}</div></div>;
}
