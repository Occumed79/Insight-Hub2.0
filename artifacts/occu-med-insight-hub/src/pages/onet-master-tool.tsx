import { useMemo, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  BriefcaseBusiness,
  ChevronRight,
  CloudSun,
  HeartPulse,
  Layers3,
  ListChecks,
  Loader2,
  Search,
  ShieldAlert,
  Waves,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  EvidenceGradeBadge,
  MetricOrb,
  OccupationalToolShell,
  SectionTabs,
  ToolHero,
} from "@/components/insight/OccupationalToolPrimitives";
import {
  fetchOnetJobContext,
  fetchOnetOccupation,
  itemDescription,
  itemName,
  type OnetJobContext,
  type OnetNamedItem,
  type OnetOccupationProfile,
} from "@/data/onetApi";

type ViewId = "command" | "demands" | "tasks" | "collision" | "matches";

const views: Array<{ id: ViewId; label: string; icon: typeof Activity }> = [
  { id: "command", label: "Command View", icon: Activity },
  { id: "demands", label: "Demand Evidence", icon: BrainCircuit },
  { id: "tasks", label: "Task Explorer", icon: ListChecks },
  { id: "collision", label: "Condition-Demand Filter", icon: HeartPulse },
  { id: "matches", label: "Occupation Matches", icon: Layers3 },
];

const collisionModels = [
  {
    id: "musculoskeletal",
    label: "Musculoskeletal / arthritis",
    terms: [
      "lifting",
      "carrying",
      "bending",
      "kneeling",
      "crouching",
      "crawling",
      "climbing",
      "repetitive motions",
      "standing",
      "walking",
      "static strength",
      "dynamic strength",
      "handling and moving objects",
    ],
    icon: Activity,
    explanation:
      "Filters returned O*NET items for explicit physical-loading, posture, mobility, and material-handling language.",
  },
  {
    id: "cardiovascular",
    label: "Cardiovascular / hypertension",
    terms: [
      "extreme heat",
      "very hot",
      "climbing",
      "stamina",
      "dynamic strength",
      "emergency",
      "time pressure",
    ],
    icon: HeartPulse,
    explanation:
      "Filters for explicit heat, endurance, exertion, emergency, and time-pressure language. It does not estimate cardiovascular risk.",
  },
  {
    id: "respiratory",
    label: "Respiratory condition",
    terms: [
      "contaminants",
      "dust",
      "fumes",
      "chemical",
      "disease or infections",
      "protective equipment",
      "respiratory",
    ],
    icon: Waves,
    explanation:
      "Filters for explicit airborne, contamination, infection, and respiratory-protection language.",
  },
  {
    id: "hearing",
    label: "Hearing impairment",
    terms: [
      "noise levels",
      "hearing sensitivity",
      "auditory attention",
      "sound localization",
      "warning signals",
    ],
    icon: Waves,
    explanation:
      "Filters for explicit noise, hearing, auditory, and warning-signal language.",
  },
  {
    id: "fatigue",
    label: "Sleep / fatigue vulnerability",
    terms: [
      "night work",
      "time pressure",
      "operating vehicles",
      "driving",
      "selective attention",
      "time sharing",
      "emergency",
    ],
    icon: BrainCircuit,
    explanation:
      "Filters for explicit schedule, vigilance, vehicle, attention, and time-pressure language. It does not infer impairment.",
  },
  {
    id: "heat-metabolic",
    label: "Metabolic / heat vulnerability",
    terms: [
      "extreme heat",
      "very hot",
      "outdoors",
      "weather",
      "protective equipment",
      "standing",
      "walking",
      "stamina",
    ],
    icon: CloudSun,
    explanation:
      "Filters for explicit heat, outdoor, PPE, mobility, and endurance language. It does not estimate an individual's tolerance.",
  },
] as const;

function labels(items: Array<string | OnetNamedItem> | undefined): string[] {
  return (items ?? [])
    .map((item) =>
      [itemName(item), itemDescription(item)].filter(Boolean).join(" — "),
    )
    .filter(Boolean);
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function phraseMatch(text: string, phrase: string): boolean {
  const escaped = phrase
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(
    text.toLowerCase(),
  );
}

function ResultList({
  title,
  items,
  tone = "cyan",
  limit = 16,
}: {
  title: string;
  items: string[];
  tone?: "cyan" | "violet" | "emerald" | "rose" | "amber";
  limit?: number;
}) {
  const toneClasses = {
    cyan: "border-cyan-100/14 bg-cyan-300/[0.045] text-cyan-50/78",
    violet: "border-violet-100/14 bg-violet-300/[0.045] text-violet-50/78",
    emerald: "border-emerald-100/14 bg-emerald-300/[0.045] text-emerald-50/78",
    rose: "border-rose-100/14 bg-rose-300/[0.045] text-rose-50/78",
    amber: "border-amber-100/14 bg-amber-300/[0.045] text-amber-50/78",
  }[tone];
  return (
    <GlassCard className="p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">
            O*NET source evidence
          </p>
          <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
        </div>
        <span className="text-xs text-cyan-50/52">{items.length} items</span>
      </div>
      <div className="mt-4 space-y-2">
        {items.slice(0, limit).map((item, index) => (
          <motion.div
            key={`${item}-${index}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.02, 0.2) }}
            className={`rounded-xl border px-4 py-3 text-xs leading-6 ${toneClasses}`}
          >
            {item}
          </motion.div>
        ))}
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/12 p-6 text-center text-xs text-cyan-50/55">
            No source items returned for this section.
          </p>
        ) : null}
      </div>
    </GlassCard>
  );
}

export default function OnetMasterTool() {
  const [keyword, setKeyword] = useState("");
  const [activeView, setActiveView] = useState<ViewId>("command");
  const [conditionId, setConditionId] =
    useState<(typeof collisionModels)[number]["id"]>("musculoskeletal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [context, setContext] = useState<OnetJobContext | null>(null);
  const [profile, setProfile] = useState<OnetOccupationProfile | null>(null);

  async function analyze(queryOverride?: string) {
    const query = (queryOverride ?? keyword).trim();
    if (!query) return;
    setKeyword(query);
    setLoading(true);
    setError("");
    setContext(null);
    setProfile(null);
    try {
      const jobResult = await fetchOnetJobContext(query);
      if (!jobResult.ok || !jobResult.context)
        throw new Error(
          jobResult.error ||
            jobResult.message ||
            "No O*NET occupation matched this search.",
        );
      setContext(jobResult.context);
      const occupationResult = await fetchOnetOccupation(
        jobResult.context.occupation.code,
      );
      if (occupationResult.ok && occupationResult.occupation)
        setProfile(occupationResult.occupation);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "O*NET analysis failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") void analyze();
  }

  const groups = useMemo(() => {
    if (!context)
      return {
        physical: [] as string[],
        cognitive: [] as string[],
        environmental: [] as string[],
        safety: [] as string[],
        tasks: [] as string[],
        detailed: [] as string[],
      };
    return {
      physical: unique([
        ...labels(context.physical_demands.abilities),
        ...labels(context.physical_demands.work_activities),
        ...labels(context.physical_demands.work_context),
        ...labels(context.physical_demands.detailed_work_activities),
      ]),
      cognitive: unique([
        ...labels(context.cognitive_demands.abilities),
        ...labels(context.cognitive_demands.work_activities),
        ...labels(context.cognitive_demands.work_context),
      ]),
      environmental: unique(labels(context.environmental_indicators.work_context)),
      safety: unique([
        ...context.safety_sensitive_indicators.indicators,
        ...labels(context.safety_sensitive_indicators.work_context),
        ...labels(context.safety_sensitive_indicators.work_activities),
        ...labels(context.safety_sensitive_indicators.tasks),
      ]),
      tasks: unique([
        ...labels(profile?.tasks),
        ...(context.essential_function_suggestions ?? []),
      ]),
      detailed: unique(labels(profile?.detailed_work_activities)),
    };
  }, [context, profile]);

  const evidence = useMemo(
    () =>
      unique([
        ...groups.physical,
        ...groups.cognitive,
        ...groups.environmental,
        ...groups.safety,
        ...groups.tasks,
        ...groups.detailed,
        ...labels(profile?.work_context),
      ]),
    [groups, profile],
  );

  const demandCounts = [
    { category: "Physical", items: groups.physical.length },
    { category: "Cognitive", items: groups.cognitive.length },
    { category: "Environment", items: groups.environmental.length },
    { category: "Safety", items: groups.safety.length },
  ];

  const selectedCollision =
    collisionModels.find((model) => model.id === conditionId) ??
    collisionModels[0];
  const collisionMatches = evidence.filter((value) =>
    selectedCollision.terms.some((term) => phraseMatch(value, term)),
  );

  return (
    <OccupationalToolShell
      eyebrow="Independent Intelligence Tool · O*NET Web Services"
      title="O*NET Master Tool"
      subtitle="Live occupational tasks, demands, work context, and transparent condition-demand filtering from O*NET."
      notice="This tool uses O*NET occupational data only. It does not read or write client/case data. Counts and filters below describe returned source items; they are not probabilities, medical-risk scores, disability findings, or fitness-for-duty determinations."
    >
      <ToolHero
        kicker="Live occupational evidence"
        title="Search a job title and inspect what O*NET actually says."
        description="The master tool keeps source fields separate, removes opaque demand scores, and shows the exact evidence behind every occupational-demand view."
      >
        <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/60">
            Job title or occupation
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Aircraft mechanic, firefighter, bus driver…"
              className="min-h-11 flex-1 rounded-xl border border-cyan-100/18 bg-[#040c16]/92 px-4 text-sm text-white outline-none placeholder:text-cyan-50/35 focus:border-cyan-200/46"
            />
            <button
              type="button"
              onClick={() => void analyze()}
              disabled={loading || !keyword.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200/24 bg-cyan-300/14 px-5 text-sm font-black text-white transition hover:bg-cyan-300/20 disabled:opacity-45"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
              {loading ? "Loading" : "Analyze"}
            </button>
          </div>
        </div>
      </ToolHero>

      {error ? (
        <GlassCard className="mb-5 border-rose-200/18 p-5">
          <div className="flex items-start gap-3 text-rose-100">
            <AlertTriangle size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-black">O*NET analysis unavailable</p>
              <p className="mt-2 text-xs leading-6 text-rose-50/72">{error}</p>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {!context && !loading && !error ? (
        <GlassCard className="p-9 text-center">
          <BriefcaseBusiness className="mx-auto h-9 w-9 text-cyan-200/55" />
          <p className="mt-3 text-lg font-black text-white">Search an occupation to begin.</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-cyan-50/62">
            No occupation, classification, or source record is preselected.
          </p>
        </GlassCard>
      ) : null}

      {context ? (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Resolved occupation"
              value={context.occupation.title}
              note={context.occupation.code}
              icon={BriefcaseBusiness}
            />
            <MetricOrb
              label="Returned source items"
              value={evidence.length.toLocaleString()}
              note="Deduplicated items used in this view"
              icon={Layers3}
              tone="violet"
            />
            <MetricOrb
              label="Explicit safety matches"
              value={context.safety_sensitive_indicators.safety_sensitive ? "Present" : "None found"}
              note="Bounded source-term classification"
              icon={ShieldAlert}
              tone={context.safety_sensitive_indicators.safety_sensitive ? "amber" : "emerald"}
            />
            <MetricOrb
              label="Alternative matches"
              value={context.matches.length.toString()}
              note="O*NET search results"
              icon={ChevronRight}
              tone="emerald"
            />
          </section>

          <SectionTabs<ViewId> tabs={views} active={activeView} onChange={setActiveView} />

          {activeView === "command" ? (
            <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
              <GlassCard className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <EvidenceGradeBadge grade="A" />
                  <span className="text-xs text-cyan-50/62">O*NET Web Services API v2</span>
                </div>
                <h2 className="mt-4 text-2xl font-black text-white">{context.occupation.title}</h2>
                <p className="mt-3 text-sm leading-7 text-cyan-50/70">
                  {context.occupation.description || "No occupation description was returned."}
                </p>
                {context.partialErrors?.length ? (
                  <div className="mt-4 rounded-xl border border-amber-200/18 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-50/72">
                    Some O*NET detail sections were unavailable: {context.partialErrors.map((item) => item.section).join(", ")}.
                  </div>
                ) : null}
              </GlassCard>
              <GlassCard className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">
                  Returned evidence counts
                </p>
                <div className="mt-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={demandCounts} layout="vertical">
                      <CartesianGrid stroke="rgba(165,243,252,.1)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: "rgba(207,250,254,.58)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="category" width={86} tick={{ fill: "rgba(207,250,254,.72)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#06101d", border: "1px solid rgba(103,232,249,.2)", borderRadius: 12 }} />
                      <Bar dataKey="items" name="Source items" fill="#67e8f9" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] leading-5 text-cyan-50/52">
                  Bar lengths are counts of returned O*NET evidence items—not severity or risk scores.
                </p>
              </GlassCard>
            </div>
          ) : null}

          {activeView === "demands" ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <ResultList title="Physical demand evidence" items={groups.physical} tone="cyan" />
              <ResultList title="Cognitive demand evidence" items={groups.cognitive} tone="violet" />
              <ResultList title="Environmental evidence" items={groups.environmental} tone="amber" />
              <ResultList title="Explicit safety evidence" items={groups.safety} tone="rose" />
            </div>
          ) : null}

          {activeView === "tasks" ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <ResultList title="Tasks / essential-function source statements" items={groups.tasks} tone="cyan" limit={24} />
              <ResultList title="Detailed work activities" items={groups.detailed} tone="emerald" limit={24} />
            </div>
          ) : null}

          {activeView === "collision" ? (
            <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
              <GlassCard className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-50/58">
                  Exploratory filter
                </p>
                <h2 className="mt-1 text-lg font-black text-white">Condition-demand overlap</h2>
                <p className="mt-2 text-xs leading-6 text-cyan-50/66">
                  Choose a condition category to filter the already-returned O*NET text for explicit demand terms. This does not calculate aggravation probability or medical risk.
                </p>
                <div className="mt-4 space-y-2">
                  {collisionModels.map((model) => {
                    const Icon = model.icon;
                    const active = model.id === conditionId;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setConditionId(model.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-xs transition ${active ? "border-amber-200/28 bg-amber-300/[0.09] text-white" : "border-white/10 bg-white/[0.025] text-cyan-50/62 hover:border-white/16"}`}
                      >
                        <Icon size={16} />
                        <span className="font-bold">{model.label}</span>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
              <GlassCard className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-50/62">{selectedCollision.label}</p>
                    <h2 className="mt-1 text-xl font-black text-white">{collisionMatches.length} explicit source matches</h2>
                  </div>
                  <EvidenceGradeBadge grade="D" />
                </div>
                <p className="mt-3 text-xs leading-6 text-cyan-50/66">{selectedCollision.explanation}</p>
                <p className="mt-2 text-[10px] leading-5 text-cyan-50/50">
                  Match terms: {selectedCollision.terms.join(", ")}.
                </p>
                <div className="mt-4 space-y-2">
                  {collisionMatches.slice(0, 24).map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-xl border border-amber-100/14 bg-amber-300/[0.045] px-4 py-3 text-xs leading-6 text-amber-50/78">
                      {item}
                    </div>
                  ))}
                  {!collisionMatches.length ? (
                    <div className="rounded-xl border border-dashed border-white/12 p-6 text-center text-xs text-cyan-50/55">
                      No explicit phrase match was found in the returned O*NET evidence.
                    </div>
                  ) : null}
                </div>
              </GlassCard>
            </div>
          ) : null}

          {activeView === "matches" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {context.matches.map((match, index) => (
                <motion.div
                  key={`${match.code}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.25) }}
                  className="rounded-2xl border border-white/12 bg-[#071321]/84 p-4"
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-50/52">{match.code}</p>
                  <p className="mt-2 font-black text-white">{match.title}</p>
                  {typeof match.score === "number" ? (
                    <p className="mt-2 text-xs text-cyan-50/55">O*NET search relevance: {match.score}</p>
                  ) : null}
                </motion.div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </OccupationalToolShell>
  );
}
