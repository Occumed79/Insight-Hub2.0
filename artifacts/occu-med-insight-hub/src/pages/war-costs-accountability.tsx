import { useEffect, useState } from "react";
import { CheckCircle2, Database, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { WarCostsWorkspaceNav } from "@/components/insight/WarCostsWorkspaceNav";
import { getWarCostsDataset, type WarCostsDatasetResponse } from "@/data/warCostsApi";
import { wcRows } from "./war-costs-utils";

type DefensePresence = {
  ok: boolean;
  partial?: boolean;
  latestYear?: number | null;
  current?: Array<Record<string, unknown>>;
  construction?: Array<Record<string, unknown>>;
  warnings?: string[];
};

type FeedAudit = {
  name: string;
  purpose: string;
  status: "available" | "partial" | "unavailable";
  records: number;
  limitation: string;
};

const EXCLUDED = [
  ["Conflict / instability feeds", "Generic war-state context does not directly answer an Occu-Med provider, network, client, or opportunity question."],
  ["Drone / strike activity", "Removed because strike activity and casualty counts are not an Occu-Med medical-network planning input."],
  ["Naval deployments / operations", "Removed because universal operational-movement tracking is outside the Occu-Med workflow."],
  ["Military spending / taxpayer cost", "Removed because defense-budget and personal-cost views do not improve provider or referral decisions."],
  ["Weapons / hardware inventories", "Removed because equipment intelligence is unrelated to occupational-health network management."],
  ["Political / accountability / war-outcome scoring", "Removed because political judgment, war ROI, casualty accounting, and policy accountability are outside the app’s purpose."],
  ["Veteran / draft / personal-impact tools", "Removed because they are not part of Occu-Med’s contractor medical-support workflow."],
] as const;

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

export default function WarCostsAccountability() {
  const [installations, setInstallations] = useState<WarCostsDatasetResponse | null>(null);
  const [contractors, setContractors] = useState<WarCostsDatasetResponse | null>(null);
  const [defense, setDefense] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [baseFeed, contractorFeed, presence] = await Promise.all([
        getWarCostsDataset("base-index.json", force).catch(() => null),
        getWarCostsDataset("contractors.json", force).catch(() => null),
        getDefensePresence(force).catch((reason) => ({ ok: false, partial: true, current: [], construction: [], warnings: [reason instanceof Error ? reason.message : "Defense-presence feed failed."] } as DefensePresence)),
      ]);
      setInstallations(baseFeed);
      setContractors(contractorFeed);
      setDefense(presence);
      const warnings = [!baseFeed ? "Installation feed unavailable." : "", !contractorFeed ? "Contractor feed unavailable." : "", ...(presence.warnings || [])].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  const audits: FeedAudit[] = [
    {
      name: "Defense installation index",
      purpose: "Map defense sites that can trigger provider-network and referral-capacity review.",
      status: installations ? "available" : "unavailable",
      records: wcRows(installations?.data).length,
      limitation: "Installation presence does not establish an Occu-Med client relationship, contractor headcount, or service demand.",
    },
    {
      name: "Personnel footprint",
      purpose: "Prioritize countries where medical-network depth may matter.",
      status: defense?.current ? (defense.partial ? "partial" : "available") : "unavailable",
      records: defense?.current?.length || 0,
      limitation: "Personnel counts are not contractor counts and are never converted into referral forecasts.",
    },
    {
      name: "Site expansion / construction",
      purpose: "Identify emerging locations where provider recruitment may need to start before operations scale.",
      status: defense?.construction ? (defense.partial ? "partial" : "available") : "unavailable",
      records: defense?.construction?.length || 0,
      limitation: "Construction investment is an expansion signal only; it does not predict Occu-Med volume.",
    },
    {
      name: "Defense contractor directory",
      purpose: "Provide possible client, incumbent, competitor, or opportunity context for follow-up elsewhere in Insight Hub.",
      status: contractors ? "available" : "unavailable",
      records: wcRows(contractors?.data).length,
      limitation: "A contractor record does not prove a current Occu-Med relationship or operating location.",
    },
  ];

  return <main className="min-h-screen bg-[#06090d] pb-24 text-white"><Sidebar /><section className="px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Occu-Med · Defense network planning" title="Source Relevance Audit" subtitle="A hard boundary around which defense data belongs in this workspace and which universal war-intelligence categories are deliberately excluded." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.08] px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Recheck sources</button></div><WarCostsWorkspaceNav />{error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs text-amber-100/75">{error}</div> : null}{loading ? <div className="mt-5 grid min-h-[540px] place-items-center border border-white/10 bg-[#080c12]"><Loader2 className="animate-spin text-cyan-200" /></div> : <div className="mt-5 grid gap-5 2xl:grid-cols-[1.05fr_.95fr]">
    <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-200/70" /><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Included</p><h2 className="mt-1 text-xl font-black text-white">Occu-Med-relevant defense feeds</h2></div></div></header><div className="divide-y divide-white/[.06]">{audits.map((feed) => <article key={feed.name} className="p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><Database size={14} className="text-cyan-200/55" /><h3 className="text-sm font-black text-white">{feed.name}</h3></div><p className="mt-2 text-xs leading-6 text-slate-400">{feed.purpose}</p></div><span className={`shrink-0 border px-2.5 py-1 text-[9px] font-black uppercase ${feed.status === "available" ? "border-emerald-200/20 text-emerald-100" : feed.status === "partial" ? "border-amber-200/20 text-amber-100" : "border-rose-200/20 text-rose-100"}`}>{feed.status}</span></div><div className="mt-4 grid grid-cols-[110px_1fr] gap-3 border-t border-white/7 pt-3 text-[10px]"><span className="text-slate-600">Records</span><strong className="text-slate-300">{feed.records.toLocaleString()}</strong><span className="text-slate-600">Boundary</span><span className="leading-5 text-slate-500">{feed.limitation}</span></div></article>)}</div></section>

    <section className="border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><div className="flex items-center gap-2"><XCircle size={17} className="text-rose-200/70" /><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Excluded</p><h2 className="mt-1 text-xl font-black text-white">Universal military-intelligence categories</h2></div></div><p className="mt-2 text-xs leading-6 text-slate-400">These categories may exist in the underlying WarCosts source, but they are not surfaced in this Occu-Med workspace.</p></header><div className="divide-y divide-white/[.06]">{EXCLUDED.map(([label, reason]) => <div key={label} className="grid grid-cols-[24px_1fr] gap-3 p-4"><CheckCircle2 size={14} className="mt-0.5 text-rose-200/60" /><div><h3 className="text-sm font-black text-white">{label}</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">{reason}</p></div></div>)}</div></section>
  </div>}</section></main>;
}
