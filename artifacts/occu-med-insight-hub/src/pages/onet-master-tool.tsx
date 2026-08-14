import { useMemo, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  BriefcaseBusiness,
  ChevronRight,
  CircleGauge,
  CloudSun,
  HeartPulse,
  Layers3,
  ListChecks,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  Waves,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  EvidenceGradeBadge,
  MetricOrb,
  OccupationalToolShell,
  RingGauge,
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
  { id: "demands", label: "Demand Signature", icon: CircleGauge },
  { id: "tasks", label: "Task Explorer", icon: ListChecks },
  { id: "collision", label: "Condition Collision", icon: HeartPulse },
  { id: "matches", label: "Occupation Matches", icon: Layers3 },
];

const collisionModels = [
  {
    id: "musculoskeletal",
    label: "Musculoskeletal / arthritis",
    pattern:
      /lift|carry|bend|kneel|crawl|climb|repetitive|stand|walk|strength|balance|handling/i,
    icon: Activity,
    explanation:
      "Physical loading, repetition, posture, mobility, and material-handling demands.",
  },
  {
    id: "cardiovascular",
    label: "Cardiovascular / hypertension",
    pattern:
      /heat|weather|physical|strength|exert|climb|pace|time pressure|emergency/i,
    icon: HeartPulse,
    explanation:
      "Exertion, heat, pace, emergency response, and environmental demand signals.",
  },
  {
    id: "respiratory",
    label: "Respiratory condition",
    pattern:
      /contaminant|dust|fume|chemical|respirat|disease|infection|protective equipment/i,
    icon: Waves,
    explanation:
      "Airborne exposure, respiratory protection, contamination, and infection context.",
  },
  {
    id: "hearing",
    label: "Hearing impairment",
    pattern: /noise|hearing|auditory|sound|communication/i,
    icon: Waves,
    explanation:
      "Noise, auditory discrimination, communication, and warning-signal demands.",
  },
  {
    id: "fatigue",
    label: "Sleep / fatigue vulnerability",
    pattern:
      /night|schedule|driv|vehicle|attention|vigilance|time pressure|consequence|decision/i,
    icon: BrainCircuit,
    explanation:
      "Vigilance, driving, schedule, sustained attention, and consequential-decision signals.",
  },
  {
    id: "heat-metabolic",
    label: "Metabolic / heat vulnerability",
    pattern: /heat|hot|outdoor|weather|protective|physical|stand|walk|exert/i,
    icon: CloudSun,
    explanation:
      "Heat, PPE, outdoor work, mobility, and physical-workload interactions.",
  },
] as const;

function labels(items: Array<string | OnetNamedItem> | undefined): string[] {
  return (items ?? [])
    .map((item) =>
      [itemName(item), itemDescription(item)].filter(Boolean).join(" — "),
    )
    .filter(Boolean);
}

function signalScore(texts: string[], pattern: RegExp, scale = 8): number {
  const count = texts.filter((value) => pattern.test(value)).length;
  return Math.min(100, count * scale);
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
    cyan: "border-cyan-100/10 bg-cyan-300/[0.035] text-cyan-50/70",
    violet: "border-violet-100/10 bg-violet-300/[0.035] text-violet-50/70",
    emerald: "border-emerald-100/10 bg-emerald-300/[0.035] text-emerald-50/70",
    rose: "border-rose-100/10 bg-rose-300/[0.035] text-rose-50/70",
    amber: "border-amber-100/10 bg-amber-300/[0.035] text-amber-50/70",
  }[tone];
  return (
    <GlassCard className="p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/38">
            O*NET evidence
          </p>
          <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
        </div>
        <span className="text-xs text-cyan-100/32">{items.length} signals</span>
      </div>
      <div className="mt-4 space-y-2">
        {items.slice(0, limit).map((item, index) => (
          <motion.div
            key={`${item}-${index}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.025, 0.25) }}
            className={`rounded-2xl border px-4 py-3 text-xs leading-6 ${toneClasses}`}
          >
            {item}
          </motion.div>
        ))}
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-cyan-100/38">
            No signals returned for this section.
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

  const evidence = useMemo(() => {
    if (!context) return [];
    return [
      ...labels(context.physical_demands.abilities),
      ...labels(context.physical_demands.work_activities),
      ...labels(context.physical_demands.work_context),
      ...labels(context.cognitive_demands.abilities),
      ...labels(context.cognitive_demands.work_activities),
      ...labels(context.cognitive_demands.work_context),
      ...labels(context.environmental_indicators.work_context),
      ...context.safety_sensitive_indicators.indicators,
      ...labels(profile?.tasks),
      ...labels(profile?.work_context),
    ];
  }, [context, profile]);

  const signature = useMemo(
    () => [
      {
        subject: "Physical",
        score: signalScore(
          evidence,
          /lift|carry|bend|kneel|climb|stand|walk|strength|handling|repetitive/i,
          7,
        ),
      },
      {
        subject: "Environment",
        score: signalScore(
          evidence,
          /outdoor|weather|heat|cold|noise|vibration|contaminant|hazard/i,
          9,
        ),
      },
      {
        subject: "Safety",
        score: signalScore(
          evidence,
          /safety|hazard|protective|high places|equipment|consequence|emergency/i,
          9,
        ),
      },
      {
        subject: "Cognitive",
        score: signalScore(
          evidence,
          /decision|attention|problem|information|communication|monitor|analy/i,
          5,
        ),
      },
      {
        subject: "Fatigue",
        score: signalScore(
          evidence,
          /schedule|night|driv|vehicle|vigilance|time pressure|pace/i,
          13,
        ),
      },
      {
        subject: "Exposure",
        score: signalScore(
          evidence,
          /noise|contaminant|infection|radiation|chemical|respirat|weather/i,
          11,
        ),
      },
    ],
    [evidence],
  );

  const selectedCollision =
    collisionModels.find((model) => model.id === conditionId) ??
    collisionModels[0];
  const collisionMatches = evidence
    .filter((value) => selectedCollision.pattern.test(value))
    .slice(0, 18);
  const collisionIndex = Math.min(100, collisionMatches.length * 9);
  const overallSignal =
    signature.reduce((sum, item) => sum + item.score, 0) / signature.length;

  return (
    <OccupationalToolShell
      eyebrow="Independent Intelligence Tool · O*NET Web Services"
      title="O*NET Master Tool"
      subtitle="A unified occupational-demand workspace for job context, task intelligence, condition-demand collisions, and occupation comparison."
      notice="This tool is independent. It uses live O*NET occupational data only and does not read from, write to, or pass results into any other Insight Hub tool. Outputs describe occupations broadly and are not individualized medical, disability, legal, or fitness-for-duty determinations."
    >
      <ToolHero
        kicker="Live occupational intelligence"
        title="Turn any job title into an interactive demand signature."
        description="Search once to explore the occupation’s physical, cognitive, safety, environmental, task, and related-role evidence inside this standalone workspace."
      >
        <div className="rounded-[28px] border border-white/12 bg-black/20 p-4 backdrop-blur-2xl">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/42">
            Job title or occupation
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Aircraft mechanic, firefighter, bus driver…"
              className="min-h-12 flex-1 rounded-2xl border border-cyan-100/14 bg-[#06101c]/86 px-4 text-sm text-white outline-none placeholder:text-cyan-100/25 focus:border-cyan-200/40"
            />
            <button
              type="button"
              onClick={() => void analyze()}
              disabled={loading || !keyword.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/14 px-5 text-sm font-black text-white transition hover:bg-cyan-300/20 disabled:opacity-45"
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Search size={17} />
              )}
              {loading ? "Analyzing" : "Analyze"}
            </button>
          </div>
        </div>
      </ToolHero>

      {error ? (
        <GlassCard className="mb-6 border-rose-200/16 p-5">
          <div className="flex items-start gap-3 text-rose-100">
            <AlertTriangle size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-black">O*NET analysis unavailable</p>
              <p className="mt-2 text-xs leading-6 text-rose-100/62">{error}</p>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {!context && !loading && !error ? (
        <GlassCard className="p-10 text-center">
          <BriefcaseBusiness className="mx-auto h-10 w-10 text-cyan-200/40" />
          <p className="mt-4 text-lg font-black text-white">
            The O*NET workspace is ready.
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-cyan-100/45">
            Search an occupation to generate its live master profile. Nothing is
            prefilled from another tool.
          </p>
        </GlassCard>
      ) : null}

      {context ? (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricOrb
              label="Top occupation"
              value={context.occupation.title}
              note={context.occupation.code}
              icon={BriefcaseBusiness}
            />
            <MetricOrb
              label="Source evidence"
              value={evidence.length.toLocaleString()}
              note="Returned context and task signals"
              icon={Layers3}
              tone="violet"
            />
            <MetricOrb
              label="Safety context"
              value={
                context.safety_sensitive_indicators.safety_sensitive
                  ? "Elevated"
                  : "Limited"
              }
              note={`${context.safety_sensitive_indicators.indicators.length} direct indicators`}
              icon={ShieldAlert}
              tone={
                context.safety_sensitive_indicators.safety_sensitive
                  ? "rose"
                  : "emerald"
              }
            />
            <MetricOrb
              label="Signal density"
              value={`${overallSignal.toFixed(0)}/100`}
              note="Descriptive density, not injury probability"
              icon={Sparkles}
              tone="amber"
            />
          </section>

          <SectionTabs<ViewId>
            tabs={views}
            active={activeView}
            onChange={setActiveView}
          />

          {activeView === "command" ? (
            <div className="grid gap-6 xl:grid-cols-[.82fr_1.18fr]">
              <GlassCard className="grid place-items-center p-6">
                <RingGauge
                  value={overallSignal}
                  label="signal density"
                  detail="The amount of physical, environmental, safety, cognitive, fatigue, and exposure context returned for this occupation."
                  tone="cyan"
                />
              </GlassCard>
              <GlassCard className="p-5 md:p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/38">
                  Occupation master profile
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {context.occupation.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-cyan-100/55">
                  {context.occupation.description ||
                    profile?.description ||
                    "No occupation description returned."}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {context.essential_function_suggestions
                    .slice(0, 8)
                    .map((suggestion, index) => (
                      <div
                        key={`${suggestion}-${index}`}
                        className="rounded-2xl border border-cyan-100/10 bg-cyan-300/[0.035] px-4 py-3 text-xs leading-5 text-cyan-50/68"
                      >
                        {suggestion}
                      </div>
                    ))}
                </div>
              </GlassCard>
            </div>
          ) : null}

          {activeView === "demands" ? (
            <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
              <GlassCard className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/38">
                  Interactive occupation fingerprint
                </p>
                <div className="mt-4 h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={signature} outerRadius="72%">
                      <PolarGrid stroke="rgba(165,243,252,.14)" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "rgba(207,250,254,.58)", fontSize: 11 }}
                      />
                      <Radar
                        dataKey="score"
                        stroke="#67e8f9"
                        fill="#22d3ee"
                        fillOpacity={0.25}
                        strokeWidth={2}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(3,10,23,.96)",
                          border: "1px solid rgba(103,232,249,.18)",
                          borderRadius: 16,
                          color: "#ecfeff",
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs leading-5 text-cyan-100/38">
                  Signal density reflects keyword-matched O*NET context returned
                  for this role. It is not a worker risk score.
                </p>
              </GlassCard>
              <div className="grid gap-4 md:grid-cols-2">
                {signature.map((item, index) => (
                  <MetricOrb
                    key={item.subject}
                    label={item.subject}
                    value={`${item.score}/100`}
                    note="Returned O*NET context density"
                    tone={
                      (
                        [
                          "cyan",
                          "emerald",
                          "rose",
                          "violet",
                          "amber",
                          "cyan",
                        ] as const
                      )[index]
                    }
                  />
                ))}
              </div>
              <ResultList
                title="Physical demands"
                items={[
                  ...labels(context.physical_demands.abilities),
                  ...labels(context.physical_demands.work_activities),
                  ...labels(context.physical_demands.work_context),
                ]}
                tone="emerald"
              />
              <ResultList
                title="Environmental and safety context"
                items={[
                  ...labels(context.environmental_indicators.work_context),
                  ...context.safety_sensitive_indicators.indicators,
                ]}
                tone="rose"
              />
            </div>
          ) : null}

          {activeView === "tasks" ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <ResultList
                title="Tasks"
                items={labels(profile?.tasks)}
                tone="cyan"
                limit={24}
              />
              <ResultList
                title="Detailed work activities"
                items={labels(profile?.detailed_work_activities)}
                tone="violet"
                limit={24}
              />
              <ResultList
                title="Abilities"
                items={labels(profile?.abilities)}
                tone="emerald"
                limit={24}
              />
              <ResultList
                title="Work context"
                items={labels(profile?.work_context)}
                tone="amber"
                limit={24}
              />
            </div>
          ) : null}

          {activeView === "collision" ? (
            <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
              <GlassCard className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/38">
                  Select condition category
                </p>
                <div className="mt-4 space-y-2">
                  {collisionModels.map((model) => {
                    const Icon = model.icon;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setConditionId(model.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-xs font-semibold transition ${conditionId === model.id ? "border-rose-200/24 bg-rose-300/10 text-white" : "border-white/8 bg-white/[0.025] text-cyan-100/52 hover:border-white/14 hover:text-white"}`}
                      >
                        <Icon size={16} className="shrink-0" />
                        {model.label}
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
              <GlassCard className="p-5 md:p-6">
                <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
                  <RingGauge
                    value={collisionIndex}
                    label="interaction index"
                    detail="Descriptive O*NET signal overlap—not a medical probability or compensability decision."
                    tone={
                      collisionIndex >= 65
                        ? "rose"
                        : collisionIndex >= 35
                          ? "amber"
                          : "emerald"
                    }
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black text-white">
                        {selectedCollision.label}
                      </h2>
                      <EvidenceGradeBadge
                        grade={collisionMatches.length ? "C" : "Unavailable"}
                      />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-cyan-100/54">
                      {selectedCollision.explanation}
                    </p>
                    <p className="mt-3 text-xs leading-6 text-amber-100/55">
                      This view identifies possible demand interactions for
                      human review. It does not determine aggravation,
                      work-relatedness, disability, or fitness.
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-2 md:grid-cols-2">
                  {collisionMatches.map((match, index) => (
                    <div
                      key={`${match}-${index}`}
                      className="rounded-2xl border border-rose-100/10 bg-rose-300/[0.04] px-4 py-3 text-xs leading-6 text-rose-50/68"
                    >
                      {match}
                    </div>
                  ))}
                </div>
                {collisionMatches.length === 0 ? (
                  <p className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-cyan-100/38">
                    No matching O*NET interaction signals were returned for this
                    category.
                  </p>
                ) : null}
              </GlassCard>
            </div>
          ) : null}

          {activeView === "matches" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {context.matches.map((match, index) => (
                <motion.button
                  key={match.code}
                  type="button"
                  onClick={() => void analyze(match.title)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.3) }}
                  className="group rounded-[25px] border border-white/10 bg-white/[0.035] p-[1px] text-left shadow-[0_20px_55px_rgba(0,0,0,.25)] transition hover:-translate-y-1 hover:border-cyan-200/24"
                >
                  <div className="h-full rounded-[24px] border border-white/[0.06] bg-[#071321]/78 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-cyan-100/38">
                          Match {index + 1}
                        </p>
                        <h2 className="mt-2 text-lg font-black text-white">
                          {match.title}
                        </h2>
                        <p className="mt-1 text-xs text-cyan-100/40">
                          {match.code}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 text-cyan-100/30 transition group-hover:translate-x-1 group-hover:text-cyan-200" />
                    </div>
                    <p className="mt-5 text-xs text-cyan-100/44">
                      Analyze this occupation independently in the current tool.
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : null}

          <footer className="mt-8 border-t border-cyan-100/10 pt-4 text-[10px] leading-5 text-cyan-100/38">
            This application incorporates information from O*NET Web Services by
            the U.S. Department of Labor, Employment and Training
            Administration. O*NET® is a trademark of USDOL/ETA.
          </footer>
        </>
      ) : null}
    </OccupationalToolShell>
  );
}
