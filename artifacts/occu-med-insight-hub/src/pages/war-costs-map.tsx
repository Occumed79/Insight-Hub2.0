import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Sidebar } from "@/components/insight/Sidebar";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { WarCostsArcGisMap } from "./war-costs-arcgis-map";
import { wcRows } from "./war-costs-utils";

const INSTALLATION_DATASET = "base-index.json" as const;

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

export default function WarCostsMap() {
  const [installations, setInstallations] = useState<WarCostsDatasetResponse | null>(null);
  const [defensePresence, setDefensePresence] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [installationResponse, defense] = await Promise.all([
        getWarCostsDataset(INSTALLATION_DATASET, force).catch(() => null),
        getDefensePresence(force).catch((reason) => ({
          ok: false,
          partial: true,
          current: [],
          construction: [],
          warnings: [reason instanceof Error ? reason.message : "Defense-presence feed failed."],
        } as DefensePresence)),
      ]);

      setInstallations(installationResponse);
      setDefensePresence(defense);

      const warnings = [
        !installationResponse ? "Defense installation locations are temporarily unavailable." : "",
        ...(defense.warnings || []),
      ].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Defense medical-support context could not load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  const personnelCount = defensePresence?.current?.length ?? 0;
  const constructionCount = defensePresence?.construction?.length ?? 0;

  return (
    <main className="war-map-command-page min-h-screen bg-[#090c10] text-slate-100">
      <Sidebar />
      <section className="flex min-h-screen flex-col lg:ml-[210px]">
        <header className="flex min-h-[68px] shrink-0 items-center justify-between gap-6 border-b border-white/8 bg-[#0b0f14] px-6 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Occu-Med / Defense network planning</div>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-.035em] text-white">Defense Medical Support Footprint</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-6 text-right">
              <Metric label="Personnel locations" value={loading ? "—" : personnelCount.toLocaleString()} />
              <Metric label="Expansion sites" value={loading ? "—" : constructionCount.toLocaleString()} />
              <Metric label="Personnel year" value={defensePresence?.latestYear ? String(defensePresence.latestYear) : "—"} />
            </div>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[.035] px-3 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[.06] disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />Refresh
            </button>
          </div>
        </header>

        {error ? <div className="shrink-0 border-b border-amber-300/15 bg-amber-400/[.035] px-6 py-2 text-[11px] leading-5 text-amber-100/80">{error}</div> : null}

        <div className="war-map-surface relative min-h-[690px] flex-1 overflow-hidden bg-[#05080c]">
          <WarCostsArcGisMap
            bases={wcRows(installations?.data)}
            personnel={defensePresence?.current || []}
            construction={defensePresence?.construction || []}
            personnelYear={defensePresence?.latestYear ?? null}
          />
          {loading ? (
            <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-md border border-white/10 bg-[#0a0f15]/92 px-3 py-2 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-200"><Loader2 size={13} className="animate-spin text-sky-300" />Syncing Occu-Med-relevant defense context…</div>
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
