import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleDashed,
  GitBranch,
  Link2,
  ListChecks,
  Loader2,
  MapPin,
  Network,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  fetchOshaEstablishments,
  resolveEmployer,
  type EntityMatch,
  type OshaEstablishment,
} from "@/data/employerIntelligenceApi";

const ENTITY_WARNING =
  "Entity and DBA relationships are research signals assembled from source evidence. Insight Hub does not claim ownership, control, affiliation, or legal identity without supporting source fields and human review.";

type ReviewDecision = "approved" | "rejected" | "merged" | "separate";

type NodeKind =
  | "canonical"
  | "dba"
  | "alias"
  | "subsidiary"
  | "legacy"
  | "matched-establishment"
  | "unresolved-establishment";

type GraphNode = {
  id: string;
  label: string;
  kind: NodeKind;
  relation: string;
  source: string;
  confidence: number;
  evidence: string[];
  address?: string;
  matched: boolean;
};

type ResolutionResult = {
  query: string;
  entity: EntityMatch;
  oshaRecords: OshaEstablishment[];
  completedAt: string;
  notes: string[];
};

type SettledValue<T> = { data: T | null; error?: string };

async function settle<T>(operation: () => Promise<T>): Promise<SettledValue<T>> {
  try {
    return { data: await operation() };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Request failed" };
  }
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);
}

function buildNodes(entity: EntityMatch, canonicalOverride: string): GraphNode[] {
  const canonicalName = canonicalOverride.trim() || entity.canonicalName;
  const nodes: GraphNode[] = [{
    id: "canonical",
    label: canonicalName,
    kind: "canonical",
    relation: "Canonical entity",
    source: entity.source,
    confidence: entity.confidence,
    evidence: entity.evidenceFields,
    address: entity.address,
    matched: true,
  }];

  const dbaNames = dedupe(entity.dbaNames);
  const aliases = dedupe(entity.aliases).filter(
    (value) => value.toLowerCase() !== canonicalName.toLowerCase()
      && !dbaNames.some((dba) => dba.toLowerCase() === value.toLowerCase()),
  );

  const addNames = (
    values: string[],
    kind: NodeKind,
    relation: string,
    matched: boolean,
  ) => {
    values.forEach((label, index) => {
      nodes.push({
        id: `${kind}-${index}-${slug(label)}`,
        label,
        kind,
        relation,
        source: entity.source,
        confidence: matched ? entity.confidence : Math.min(entity.confidence, 0.4),
        evidence: entity.evidenceFields,
        matched,
      });
    });
  };

  addNames(dbaNames, "dba", "Doing-business-as name", true);
  addNames(aliases, "alias", "Alternate or searched name", true);
  addNames(dedupe(entity.subsidiaryNames), "subsidiary", "Possible subsidiary", false);
  addNames(dedupe(entity.legacyNames), "legacy", "Former or legacy name", false);

  entity.matchedEstablishments?.forEach((establishment, index) => {
    nodes.push({
      id: `matched-establishment-${index}-${slug(establishment.name)}`,
      label: establishment.name,
      kind: "matched-establishment",
      relation: "Matched OSHA establishment",
      source: establishment.source,
      confidence: entity.confidence,
      evidence: [`Name and address evidence returned by ${establishment.source}`, ...entity.evidenceFields],
      address: establishment.address,
      matched: true,
    });
  });

  entity.unmatchedEstablishments?.forEach((establishment, index) => {
    nodes.push({
      id: `unresolved-establishment-${index}-${slug(establishment.name)}`,
      label: establishment.name,
      kind: "unresolved-establishment",
      relation: "Unresolved OSHA establishment",
      source: establishment.source,
      confidence: Math.min(entity.confidence, 0.4),
      evidence: ["The resolver returned this establishment for review but did not support an automatic match."],
      matched: false,
    });
  });

  return nodes;
}

function confidenceTone(confidence: number): string {
  if (confidence >= 0.7) return "border-emerald-200/20 bg-emerald-300/10 text-emerald-100";
  if (confidence >= 0.4) return "border-amber-200/20 bg-amber-300/10 text-amber-100";
  return "border-rose-200/20 bg-rose-300/10 text-rose-100";
}

function nodeTone(node: GraphNode, decision?: ReviewDecision): string {
  if (decision === "approved" || decision === "merged") {
    return "border-emerald-200/35 bg-emerald-300/12 text-emerald-50 shadow-[0_0_28px_rgba(52,211,153,.15)]";
  }
  if (decision === "rejected") {
    return "border-rose-200/30 bg-rose-300/10 text-rose-100 opacity-60";
  }
  if (decision === "separate") {
    return "border-violet-200/30 bg-violet-300/10 text-violet-50";
  }
  if (node.kind === "canonical") {
    return "border-cyan-100/35 bg-cyan-200/14 text-white shadow-[0_0_44px_rgba(34,211,238,.18)]";
  }
  if (!node.matched) {
    return "border-dashed border-amber-200/30 bg-amber-200/[0.07] text-amber-50";
  }
  return "border-cyan-100/18 bg-slate-950/75 text-cyan-50";
}

function formatRate(value?: number): string {
  return value === undefined ? "—" : value.toFixed(2);
}

export default function EntityResolution() {
  const [companyName, setCompanyName] = useState("");
  const [dbaNames, setDbaNames] = useState("");
  const [state, setState] = useState("");
  const [naics, setNaics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolutionResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [canonicalOverride, setCanonicalOverride] = useState("");

  const nodes = useMemo(
    () => result ? buildNodes(result.entity, canonicalOverride) : [],
    [result, canonicalOverride],
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
    ?? nodes.find((node) => node.kind === "canonical")
    ?? null;

  const visibleRecords = useMemo(() => {
    if (!result) return [];
    if (!selectedNode || (selectedNode.kind !== "matched-establishment" && selectedNode.kind !== "unresolved-establishment")) {
      return result.oshaRecords;
    }
    const selectedName = selectedNode.label.toLowerCase();
    return result.oshaRecords.filter((record) => {
      return record.establishmentName.toLowerCase() === selectedName
        || record.companyName.toLowerCase() === selectedName
        || record.dbaName?.toLowerCase() === selectedName;
    });
  }, [result, selectedNode]);

  async function runResolution(): Promise<void> {
    const employer = companyName.trim();
    if (!employer) {
      setError("Enter an employer, legal entity, or DBA name.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedNodeId(null);
    setDecisions({});
    setCanonicalOverride("");

    const stateCode = state.trim().toUpperCase();
    const naicsCode = naics.trim();
    const suppliedDbas = dbaNames
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const [entityCall, oshaCall] = await Promise.all([
      settle(() => resolveEmployer({
        companyName: employer,
        dbaNames: suppliedDbas.length > 0 ? suppliedDbas : undefined,
        state: stateCode || undefined,
        naics: naicsCode || undefined,
      })),
      settle(() => fetchOshaEstablishments({
        company: employer,
        state: stateCode || undefined,
        naics: naicsCode || undefined,
      })),
    ]);

    try {
      if (!entityCall.data?.ok) {
        throw new Error(entityCall.error ?? entityCall.data?.error ?? "No entity match was returned.");
      }

      const notes = [
        entityCall.error,
        oshaCall.error,
        oshaCall.data && !oshaCall.data.ok ? oshaCall.data.error : undefined,
        oshaCall.data?.warning,
      ].filter((value): value is string => Boolean(value));

      setResult({
        query: employer,
        entity: entityCall.data.entity,
        oshaRecords: oshaCall.data?.ok ? oshaCall.data.records : [],
        completedAt: new Date().toISOString(),
        notes: [...new Set(notes)],
      });
      setSelectedNodeId("canonical");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Entity resolution failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Employer Intelligence"
          title="Entity & DBA Resolution"
          subtitle="Resolve legal names, DBAs, aliases, possible corporate relationships, and OSHA establishments with visible evidence and human review controls."
        />

        <GlassCard className="mb-6 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p className="text-xs leading-5 text-amber-100/70">{ENTITY_WARNING}</p>
          </div>
        </GlassCard>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[34px] border border-cyan-100/12 bg-[radial-gradient(circle_at_82%_18%,rgba(139,92,246,.18),transparent_34%),radial-gradient(circle_at_18%_72%,rgba(8,145,178,.18),transparent_36%),rgba(2,8,23,.80)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.35)] backdrop-blur-2xl md:p-8"
        >
          <div className="relative grid gap-7 xl:grid-cols-[1.05fr_.95fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-100/42">Evidence-first identity review</p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
                See the identity chain before accepting the employer match.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-cyan-100/55">
                Weak names and establishments enter a review queue instead of being silently discarded. Every relationship keeps its source, evidence, confidence, and limitation state.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Employer / legal name" value={companyName} onChange={setCompanyName} placeholder="Example: V2X" />
              <Field label="Known DBAs" value={dbaNames} onChange={setDbaNames} placeholder="Comma-separated, optional" />
              <Field label="State" value={state} onChange={setState} placeholder="Example: VA" />
              <Field label="NAICS" value={naics} onChange={setNaics} placeholder="Optional industry code" />
              <button
                type="button"
                onClick={() => void runResolution()}
                disabled={loading || !companyName.trim()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/20 bg-cyan-200/12 px-5 text-sm font-bold text-cyan-50 transition hover:bg-cyan-200/18 disabled:cursor-not-allowed disabled:opacity-45 md:col-span-2"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
                {loading ? "Resolving sources…" : "Resolve entity and establishments"}
              </button>
              {error && <p className="text-sm text-rose-200 md:col-span-2">{error}</p>}
            </div>
          </div>
        </motion.section>

        {!result && !loading && (
          <GlassCard className="mt-6 p-8 text-center">
            <Network className="mx-auto h-10 w-10 text-cyan-200/35" />
            <p className="mt-3 text-sm font-semibold text-cyan-50">Ready to build an entity relationship graph</p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-cyan-100/42">
              Start with the name used by the employer, contractor, or establishment. Known DBAs, state, and NAICS improve review precision.
            </p>
          </GlassCard>
        )}

        {result && (
          <div className="mt-8 space-y-6">
            <ResolutionSummary result={result} nodes={nodes} decisions={decisions} />

            <section className="overflow-hidden rounded-[36px] border border-cyan-100/12 bg-[radial-gradient(circle_at_18%_15%,rgba(34,211,238,.14),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(139,92,246,.16),transparent_32%),rgba(2,8,23,.82)] p-5 shadow-[0_35px_100px_rgba(0,0,0,.38)] md:p-8">
              <div className="grid gap-5 2xl:grid-cols-[1.35fr_.65fr]">
                <div className="space-y-4">
                  <EntityOrbit
                    nodes={nodes}
                    selectedNodeId={selectedNodeId}
                    decisions={decisions}
                    onSelectNode={setSelectedNodeId}
                  />
                  <RelationshipInventory
                    nodes={nodes}
                    selectedNodeId={selectedNodeId}
                    decisions={decisions}
                    onSelectNode={setSelectedNodeId}
                  />
                </div>

                <div className="space-y-4">
                  <SelectedNodePanel
                    entity={result.entity}
                    node={selectedNode}
                    decision={selectedNode ? decisions[selectedNode.id] : undefined}
                    onDecision={(nodeId, decision) => {
                      setDecisions((current) => ({ ...current, [nodeId]: decision }));
                    }}
                    canonicalOverride={canonicalOverride}
                    onCanonicalOverride={setCanonicalOverride}
                  />
                  <ReviewQueue
                    nodes={nodes}
                    decisions={decisions}
                    onSelectNode={setSelectedNodeId}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDecisions({});
                      setCanonicalOverride("");
                      setSelectedNodeId("canonical");
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-100/12 bg-white/[0.035] px-4 py-3 text-xs font-semibold text-cyan-100/55 transition hover:bg-white/[0.06] hover:text-cyan-50"
                  >
                    <RotateCcw size={14} />
                    Reset review-session decisions
                  </button>
                </div>
              </div>
            </section>

            <OshaDrilldown
              records={visibleRecords}
              selectedNode={selectedNode}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/42">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-12 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/30"
      />
    </label>
  );
}

function ResolutionSummary({
  result,
  nodes,
  decisions,
}: {
  result: ResolutionResult;
  nodes: GraphNode[];
  decisions: Record<string, ReviewDecision>;
}) {
  const unresolved = nodes.filter((node) => !node.matched).length;
  const reviewed = Object.keys(decisions).length;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/42">Resolution complete</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">{result.query}</h2>
          <p className="mt-2 text-xs text-cyan-100/45">
            {result.entity.canonicalName} · {result.entity.matchType} match · {Math.round(result.entity.confidence * 100)}% confidence
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/30">
          {new Date(result.completedAt).toLocaleString()}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Building2 size={16} />} label="Canonical entity" value={result.entity.canonicalName} />
        <Metric icon={<Link2 size={16} />} label="Relationships" value={String(Math.max(nodes.length - 1, 0))} />
        <Metric icon={<MapPin size={16} />} label="OSHA records" value={String(result.oshaRecords.length)} />
        <Metric icon={<ListChecks size={16} />} label="Reviewed" value={String(reviewed)} />
        <Metric icon={<CircleDashed size={16} />} label="Unresolved" value={String(unresolved)} />
      </div>

      {result.notes.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200/12 bg-amber-200/[0.035] p-4">
          {result.notes.map((note) => <p key={note} className="text-xs leading-5 text-amber-100/55">{note}</p>)}
        </div>
      )}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between text-cyan-100/42">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-4 truncate text-lg font-black text-white">{value}</p>
    </GlassCard>
  );
}

function EntityOrbit({
  nodes,
  selectedNodeId,
  decisions,
  onSelectNode,
}: {
  nodes: GraphNode[];
  selectedNodeId: string | null;
  decisions: Record<string, ReviewDecision>;
  onSelectNode: (nodeId: string) => void;
}) {
  const canonical = nodes.find((node) => node.kind === "canonical");
  const orbitNodes = nodes.filter((node) => node.kind !== "canonical").slice(0, 10);
  if (!canonical) return null;

  const positions = orbitNodes.map((node, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(orbitNodes.length, 1);
    return {
      node,
      left: 50 + Math.cos(angle) * 37,
      top: 50 + Math.sin(angle) * 35,
    };
  });

  return (
    <div className="relative h-[520px] overflow-hidden rounded-[30px] border border-cyan-100/10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.10),transparent_28%),linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:10%_10%]" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {positions.map(({ node, left, top }) => (
          <motion.line
            key={node.id}
            x1="50"
            y1="50"
            x2={left}
            y2={top}
            stroke={node.matched ? "rgba(103,232,249,.28)" : "rgba(253,230,138,.28)"}
            strokeWidth="0.35"
            strokeDasharray={node.matched ? undefined : "1.4 1.4"}
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          />
        ))}
      </svg>

      <motion.button
        type="button"
        onClick={() => onSelectNode(canonical.id)}
        initial={{ opacity: 0, scale: 0.75 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className={`absolute left-1/2 top-1/2 z-20 w-48 -translate-x-1/2 -translate-y-1/2 rounded-[26px] border px-4 py-5 text-center backdrop-blur-xl ${nodeTone(canonical, decisions[canonical.id])} ${selectedNodeId === canonical.id ? "ring-2 ring-cyan-100/35" : ""}`}
      >
        <Building2 className="mx-auto h-5 w-5 text-cyan-100/75" />
        <p className="mt-3 truncate text-sm font-black">{canonical.label}</p>
        <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-cyan-100/42">Canonical entity</p>
        <p className="mt-2 text-[10px] text-cyan-100/50">{Math.round(canonical.confidence * 100)}% confidence</p>
      </motion.button>

      {positions.map(({ node, left, top }, index) => (
        <motion.button
          key={node.id}
          type="button"
          onClick={() => onSelectNode(node.id)}
          initial={{ opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: index * 0.045 }}
          className={`absolute z-10 w-36 -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-3 text-left backdrop-blur-xl transition hover:scale-[1.03] ${nodeTone(node, decisions[node.id])} ${selectedNodeId === node.id ? "ring-2 ring-white/30" : ""}`}
          style={{ left: `${left}%`, top: `${top}%` }}
        >
          <div className="flex items-center justify-between gap-2">
            <NodeIcon kind={node.kind} />
            <span className="text-[8px] uppercase tracking-[0.1em] opacity-55">{decisions[node.id] ?? (node.matched ? "Matched" : "Review")}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-4">{node.label}</p>
          <p className="mt-1 truncate text-[8px] uppercase tracking-[0.1em] opacity-45">{node.relation}</p>
        </motion.button>
      ))}
    </div>
  );
}

function NodeIcon({ kind }: { kind: NodeKind }) {
  const className = "h-3.5 w-3.5 opacity-70";
  if (kind === "matched-establishment" || kind === "unresolved-establishment") return <MapPin className={className} />;
  if (kind === "dba" || kind === "alias") return <Link2 className={className} />;
  if (kind === "subsidiary" || kind === "legacy") return <GitBranch className={className} />;
  return <Building2 className={className} />;
}

function RelationshipInventory({
  nodes,
  selectedNodeId,
  decisions,
  onSelectNode,
}: {
  nodes: GraphNode[];
  selectedNodeId: string | null;
  decisions: Record<string, ReviewDecision>;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/38">Relationship inventory</p>
          <p className="mt-1 text-sm font-bold text-cyan-50">All identities and establishments returned by the resolver</p>
        </div>
        <Network size={18} className="text-cyan-200/55" />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelectNode(node.id)}
            className={`rounded-2xl border p-3 text-left transition ${nodeTone(node, decisions[node.id])} ${selectedNodeId === node.id ? "ring-2 ring-white/20" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] opacity-55">
                <NodeIcon kind={node.kind} />
                {node.relation}
              </span>
              <span className="text-[9px] opacity-45">{Math.round(node.confidence * 100)}%</span>
            </div>
            <p className="mt-2 truncate text-xs font-bold">{node.label}</p>
            <p className="mt-1 truncate text-[9px] opacity-40">{node.source}</p>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

function SelectedNodePanel({
  entity,
  node,
  decision,
  onDecision,
  canonicalOverride,
  onCanonicalOverride,
}: {
  entity: EntityMatch;
  node: GraphNode | null;
  decision?: ReviewDecision;
  onDecision: (nodeId: string, decision: ReviewDecision) => void;
  canonicalOverride: string;
  onCanonicalOverride: (value: string) => void;
}) {
  if (!node) return null;

  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/38">Selected relationship</p>
          <p className="mt-2 break-words text-lg font-black text-white">{node.label}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100/38">{node.relation}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] ${confidenceTone(node.confidence)}`}>
          {Math.round(node.confidence * 100)}%
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <KeyValue label="Source" value={node.source} />
        <KeyValue label="Match state" value={node.matched ? "Resolver matched" : "Unresolved — manual review required"} />
        {node.address && <KeyValue label="Address evidence" value={node.address} />}
        <KeyValue label="Review decision" value={decision ?? "Not reviewed"} />
      </div>

      <div className="mt-4">
        <p className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/32">Evidence used</p>
        <div className="mt-2 space-y-2">
          {node.evidence.length > 0 ? node.evidence.slice(0, 6).map((evidence) => (
            <p key={evidence} className="rounded-xl border border-cyan-100/7 bg-white/[0.025] px-3 py-2 text-[10px] leading-5 text-cyan-100/52">
              {evidence}
            </p>
          )) : <p className="text-xs text-cyan-100/35">No detailed evidence fields were returned.</p>}
        </div>
      </div>

      {node.kind === "canonical" ? (
        <label className="mt-5 block border-t border-cyan-100/8 pt-4">
          <span className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-cyan-100/38">
            <Pencil size={12} />
            Review-session canonical override
          </span>
          <input
            value={canonicalOverride}
            onChange={(event) => onCanonicalOverride(event.target.value)}
            placeholder={entity.canonicalName}
            className="mt-2 min-h-11 w-full rounded-2xl border border-cyan-100/12 bg-black/20 px-3 text-xs text-cyan-50 outline-none placeholder:text-cyan-100/25"
          />
          <span className="mt-2 block text-[9px] leading-4 text-cyan-100/30">
            Display-only review override. Source records and legal identity are not rewritten.
          </span>
        </label>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <DecisionButton active={decision === "approved"} icon={<CheckCircle2 size={14} />} label="Approve link" onClick={() => onDecision(node.id, "approved")} tone="emerald" />
          <DecisionButton active={decision === "rejected"} icon={<XCircle size={14} />} label="Reject link" onClick={() => onDecision(node.id, "rejected")} tone="rose" />
          <DecisionButton active={decision === "merged"} icon={<Link2 size={14} />} label="Merge as alias" onClick={() => onDecision(node.id, "merged")} tone="cyan" />
          <DecisionButton active={decision === "separate"} icon={<GitBranch size={14} />} label="Keep separate" onClick={() => onDecision(node.id, "separate")} tone="violet" />
        </div>
      )}

      {entity.warnings.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200/10 bg-amber-200/[0.035] p-3">
          <p className="text-[9px] uppercase tracking-[0.16em] text-amber-100/42">Resolver warnings</p>
          {entity.warnings.slice(0, 4).map((warning) => (
            <p key={warning} className="mt-2 text-[10px] leading-5 text-amber-100/52">{warning}</p>
          ))}
        </div>
      )}

      <p className="mt-4 text-[9px] leading-4 text-cyan-100/28">
        Review decisions remain in this page session and are not presented as changes to SAM.gov, SEC, OSHA, or any legal record.
      </p>
    </GlassCard>
  );
}

function DecisionButton({
  active,
  icon,
  label,
  onClick,
  tone,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone: "emerald" | "rose" | "cyan" | "violet";
}) {
  const tones = {
    emerald: active ? "border-emerald-200/35 bg-emerald-300/14 text-emerald-50" : "border-emerald-200/12 bg-emerald-300/[0.04] text-emerald-100/55",
    rose: active ? "border-rose-200/35 bg-rose-300/14 text-rose-50" : "border-rose-200/12 bg-rose-300/[0.04] text-rose-100/55",
    cyan: active ? "border-cyan-200/35 bg-cyan-300/14 text-cyan-50" : "border-cyan-200/12 bg-cyan-300/[0.04] text-cyan-100/55",
    violet: active ? "border-violet-200/35 bg-violet-300/14 text-violet-50" : "border-violet-200/12 bg-violet-300/[0.04] text-violet-100/55",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-[10px] font-semibold transition hover:brightness-125 ${tones[tone]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ReviewQueue({
  nodes,
  decisions,
  onSelectNode,
}: {
  nodes: GraphNode[];
  decisions: Record<string, ReviewDecision>;
  onSelectNode: (nodeId: string) => void;
}) {
  const unresolved = nodes.filter((node) => !node.matched);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/38">Review queue</p>
          <p className="mt-1 text-sm font-bold text-cyan-50">{unresolved.length} unresolved relationship{unresolved.length === 1 ? "" : "s"}</p>
        </div>
        <ListChecks size={18} className="text-cyan-200/55" />
      </div>
      <div className="mt-4 space-y-2">
        {unresolved.length > 0 ? unresolved.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => onSelectNode(node.id)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200/10 bg-amber-200/[0.035] px-3 py-3 text-left hover:border-amber-200/20"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-amber-50">{node.label}</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-amber-100/36">{node.relation}</p>
            </div>
            <span className="text-[9px] uppercase tracking-[0.12em] text-amber-100/45">{decisions[node.id] ?? "Review"}</span>
          </button>
        )) : (
          <p className="rounded-2xl border border-emerald-200/10 bg-emerald-200/[0.035] p-4 text-xs leading-5 text-emerald-100/55">
            No unresolved names or establishments were returned.
          </p>
        )}
      </div>
    </GlassCard>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-cyan-100/7 py-2 first:border-t-0">
      <span className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/32">{label}</span>
      <span className="text-xs leading-5 text-cyan-100/62">{value}</span>
    </div>
  );
}

function OshaDrilldown({
  records,
  selectedNode,
}: {
  records: OshaEstablishment[];
  selectedNode: GraphNode | null;
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">OSHA establishment drill-down</p>
          <p className="mt-1 text-sm font-semibold text-cyan-50">
            {records.length} record{records.length === 1 ? "" : "s"} for {selectedNode?.label ?? "the canonical entity"}
          </p>
        </div>
        <span className="rounded-full border border-cyan-100/10 bg-cyan-200/[0.05] px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-cyan-100/42">
          Observed source data
        </span>
      </div>

      {records.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[9px] uppercase tracking-[0.16em] text-cyan-100/35">
              <tr>
                <th className="px-3 py-2">Establishment</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">NAICS</th>
                <th className="px-3 py-2">TRC</th>
                <th className="px-3 py-2">DART</th>
                <th className="px-3 py-2">Cases</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 30).map((record, index) => (
                <tr key={`${record.establishmentName}-${record.year}-${index}`} className="border-t border-cyan-100/7 text-cyan-100/58">
                  <td className="px-3 py-3 font-semibold text-cyan-50">{record.establishmentName}</td>
                  <td className="px-3 py-3">{record.city}, {record.state}</td>
                  <td className="px-3 py-3">{record.year}</td>
                  <td className="px-3 py-3">{record.naics}</td>
                  <td className="px-3 py-3">{formatRate(record.trcRate)}</td>
                  <td className="px-3 py-3">{formatRate(record.dartRate)}</td>
                  <td className="px-3 py-3">{record.totalCases?.toLocaleString() ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-cyan-100/7 bg-black/12 p-4 text-xs leading-6 text-cyan-100/38">
          No OSHA records match the selected relationship. Select the canonical entity to restore all returned establishment records.
        </p>
      )}

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200/10 bg-amber-200/[0.035] p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/60" />
        <p className="text-[10px] leading-5 text-amber-100/48">
          OSHA records are used for occupational-health service research and human review. They do not establish that an employer is unsafe, negligent, noncompliant, or legally liable.
        </p>
      </div>
    </GlassCard>
  );
}
