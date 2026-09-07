import { useEffect, useState } from "react";
import { Database, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
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

async function getDefensePresence(force = false): Promise<DefensePresence> {
  const response = await fetch(`/api/war-costs/defense-presence${force ? "?refresh=1" : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload?.partial) throw new Error(payload?.error || `Defense-presence request failed (${response.status}).`);
  return payload;
}

export default function WarCostsAccountability() {
  const [installations, setInstallations] = useState<WarCostsDatasetResponse | null>(null);
  const [contractors, setContractors] = useState<WarCostsDatasetResponse | null>(null);
  const [conflicts, setConflicts] = useState<WarCostsDatasetResponse | null>(null);
  const [strikes, setStrikes] = useState<WarCostsDatasetResponse | null>(null);
  const [operations, setOperations] = useState<WarCostsDatasetResponse | null>(null);
  const [deployments, setDeployments] = useState<WarCostsDatasetResponse | null>(null);
  const [defense, setDefense] = useState<DefensePresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [baseFeed, contractorFeed, conflictFeed, strikeFeed, operationFeed, deploymentFeed, presence] = await Promise.all([
        getWarCostsDataset("base-index.json", force).catch(() => null),
        getWarCostsDataset("contractors.json", force).catch(() => null),
        getWarCostsDataset("conflicts.json", force).catch(() => null),
        getWarCostsDataset("drone-strikes.json", force).catch(() => null),
        getWarCostsDataset("operations.json", force).catch(() => null),
        getWarCostsDataset("overseas-presence.json", force).catch(() => null),
        getDefensePresence(force).catch((reason) => ({ ok: false, partial: true, current: [], construction: [], warnings: [reason instanceof Error ? reason.message : "Defense-presence feed failed."] } as DefensePresence)),
      ]);
      setInstallations(baseFeed);
      setContractors(contractorFeed);
      setConflicts(conflictFeed);
      setStrikes(strikeFeed);
      setOperations(operationFeed);
      setDeployments(deploymentFeed);
      setDefense(presence);
      const warnings = [
        !baseFeed ? "Installation feed unavailable." : "",
        !contractorFeed ? "Contractor feed unavailable." : "",
        !conflictFeed && !strikeFeed ? "Instability feeds unavailable." : "",
        !operationFeed && !deploymentFeed ? "Naval-deployment feeds unavailable." : "",
        ...(presence.warnings || []),
      ].filter(Boolean);
      if (warnings.length) setError(warnings.join(" "));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(false); }, []);

  const instabilityRecords = wcRows(conflicts?.data).length + wcRows(strikes?.data).length;
  const navalRecords = wcRows(operations?.data).length + wcRows(deployments?.data).length;
  const audits: FeedAudit[] = [
    { name: "Defense installations", purpose: "Locate U.S. military bases and overseas installations that matter to network planning.", status: installations ? "available" : "unavailable", records: wcRows(installations?.data).length, limitation: "Installation presence does not prove an Occu-Med client relationship or referral volume." },
    { name: "Personnel footprint", purpose: "Show U.S. personnel presence and troop posture by country.", status: defense?.current ? (defense.partial ? "partial" : "available") : "unavailable", records: defense?.current?.length || 0, limitation: "Personnel counts are contextual and are not converted into contractor demand estimates." },
    { name: "Military construction", purpose: "Identify new or expanding defense locations before provider-network demand is obvious.", status: defense?.construction ? (defense.partial ? "partial" : "available") : "unavailable", records: defense?.construction?.length || 0, limitation: "Construction is an expansion signal, not a forecast of Occu-Med case volume." },
    { name: "Instability", purpose: "Combine active conflict, drone/strike activity, and civilian-casualty signals into one operating-environment layer.", status: conflicts || strikes ? "available" : "unavailable", records: instabilityRecords, limitation: "Instability is used as access and operating-context evidence; it is not a political or war-outcome assessment." },
    { name: "Naval deployments", purpose: "Retain maritime deployment and fleet-posture context that can affect regional access and contractor support tempo.", status: operations || deployments ? "available" : "unavailable", records: navalRecords, limitation: "Only sanitized naval/maritime rows are retained; covert and hardware intelligence is excluded." },
    { name: "Defense contractor directory", purpose: "Provide possible client, incumbent, competitor, or opportunity context for follow-up elsewhere in Insight Hub 2.0.", status: contractors ? "available" : "unavailable", records: wcRows(contractors?.data).length, limitation: "A contractor record does not prove a current Occu-Med relationship or operating location." },
  ];

  const available = audits.filter((feed) => feed.status === "available").length;
  const partial = audits.filter((feed) => feed.status === "partial").length;

  return <main className="min-h-screen bg-[#06090d] pb-24 text-white"><Sidebar /><section className="px-5 py-8 lg:ml-[210px] lg:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><HeaderBar eyebrow="Occu-Med · Defense intelligence" title="Source Relevance Audit" subtitle="Verify the approved defense feeds behind installations, personnel posture, construction, instability, naval deployments, and contractor context." /><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-cyan-200/20 bg-cyan-300/[.08] px-4 text-xs font-bold"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Recheck sources</button></div><WarCostsWorkspaceNav />{error ? <div className="mt-4 border border-amber-200/15 bg-amber-300/[.035] p-3 text-xs text-amber-100/75">{error}</div> : null}{loading ? <div className="mt-5 grid min-h-[540px] place-items-center border border-white/10 bg-[#080c12]"><Loader2 className="animate-spin text-cyan-200" /></div> : <>
    <section className="mt-5 grid border border-white/10 bg-[#080c12] md:grid-cols-3"><div className="border-r border-white/8 p-5"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Feeds checked</p><p className="mt-2 text-3xl font-black">{audits.length}</p></div><div className="border-r border-white/8 p-5"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Available</p><p className="mt-2 text-3xl font-black text-emerald-100">{available}</p></div><div className="p-5"><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Partial</p><p className="mt-2 text-3xl font-black text-amber-100">{partial}</p></div></section>
    <section className="mt-5 border border-white/10 bg-[#080c12]"><header className="border-b border-white/10 p-5"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-200/70" /><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-500">Approved source boundary</p><h2 className="mt-1 text-xl font-black text-white">War Map intelligence feeds</h2><p className="mt-2 text-xs leading-6 text-slate-400">Weapons/hardware, covert operations, taxpayer/war-cost tools, political/accountability content, and draft/personal-cost tools remain outside this boundary.</p></div></div></header><div className="divide-y divide-white/[.06]">{audits.map((feed) => <article key={feed.name} className="grid gap-4 p-5 xl:grid-cols-[1.1fr_1.5fr_110px_1.8fr]"><div><div className="flex items-center gap-2"><Database size={14} className="text-cyan-200/55" /><h3 className="text-sm font-black text-white">{feed.name}</h3></div><p className="mt-2 text-[10px] text-slate-600">{feed.records.toLocaleString()} records</p></div><p className="text-xs leading-6 text-slate-400">{feed.purpose}</p><span className={`h-fit border px-2.5 py-1 text-center text-[9px] font-black uppercase ${feed.status === "available" ? "border-emerald-200/20 text-emerald-100" : feed.status === "partial" ? "border-amber-200/20 text-amber-100" : "border-rose-200/20 text-rose-100"}`}>{feed.status}</span><p className="text-[11px] leading-5 text-slate-500">{feed.limitation}</p></article>)}</div></section>
  </>}</section></main>;
}
