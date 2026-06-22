import { useState, type KeyboardEvent } from "react";
import { Briefcase, Search, AlertTriangle, Loader2, ChevronRight, Info } from "lucide-react";
import { HeaderBar } from "@/components/insight/HeaderBar";
import { Sidebar } from "@/components/insight/Sidebar";
import { GlassCard } from "@/components/insight/GlassCard";
import {
  fetchOnetJobContext,
  fetchOnetOccupation,
  itemName,
  itemDescription,
  type OnetOccupationMatch,
  type OnetOccupationProfile,
  type OnetJobContext,
} from "@/data/onetApi";

export default function JobIntelligence() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobContext, setJobContext] = useState<OnetJobContext | null>(null);
  const [selectedOccupation, setSelectedOccupation] = useState<OnetOccupationProfile | null>(null);
  const [occupationLoading, setOccupationLoading] = useState(false);
  const [occupationError, setOccupationError] = useState<string | null>(null);

  async function handleSearch() {
    const query = keyword.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    setJobContext(null);
    setSelectedOccupation(null);
    setOccupationError(null);
    try {
      const result = await fetchOnetJobContext(query);
      if (!result.ok) {
        setError(result.error || "O*NET lookup failed");
        return;
      }
      if (result.context) {
        setJobContext(result.context);
        if (result.context.occupation?.code) {
          await loadOccupationDetails(result.context.occupation.code);
        }
      } else {
        setError(result.message || "No matching occupations found.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "O*NET request failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadOccupationDetails(code: string) {
    setOccupationLoading(true);
    setOccupationError(null);
    try {
      const result = await fetchOnetOccupation(code);
      if (result.ok && result.occupation) {
        setSelectedOccupation(result.occupation);
      } else {
        setOccupationError(result.error || "Could not load occupation details");
      }
    } catch (e) {
      setOccupationError(e instanceof Error ? e.message : "Failed to load occupation details");
    } finally {
      setOccupationLoading(false);
    }
  }

  async function handleSelectMatch(match: OnetOccupationMatch) {
    setKeyword(match.title);
    setJobContext(null);
    setSelectedOccupation(null);
    setError(null);
    setOccupationError(null);
    setLoading(true);
    try {
      const result = await fetchOnetJobContext(match.title);
      if (!result.ok) {
        setError(result.error || "O*NET lookup failed");
        return;
      }
      if (result.context) {
        setJobContext(result.context);
      }
      await loadOccupationDetails(match.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "O*NET request failed");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") handleSearch();
  }

  return (
    <main className="aurora-bg min-h-screen text-white">
      <Sidebar />
      <section className="relative z-10 px-5 py-8 lg:ml-[210px] lg:px-12">
        <HeaderBar
          eyebrow="Portal 05"
          title="Job Intelligence Engine"
          subtitle="O*NET-powered occupational context for physical, cognitive, safety, and environmental demand analysis."
        />

        <GlassCard className="mb-5 border-amber-200/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                O*NET occupational context only — not employer-specific essential functions
              </p>
              <p className="mt-1 text-xs leading-5 text-cyan-100/60">
                Results reflect national occupational data from O*NET Web Services. Final essential functions, physical demands, and return-to-work decisions must be validated against the employer's actual job requirements, worksite conditions, and medical/legal review.
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <p className="text-xs uppercase tracking-[0.26em] text-emerald-200/60">Occupation search</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Enter a job title, e.g. Bus Driver"
              className="min-h-12 flex-1 rounded-2xl border border-cyan-100/15 bg-[#07111d] px-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/35"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !keyword.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/15 bg-cyan-200/12 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-45"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search size={16} />}
              {loading ? "Analyzing..." : "Analyze occupation"}
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-cyan-100/50">
            Searches O*NET by keyword and returns likely matches, extracted demand categories, and essential-function suggestions.
          </p>
        </GlassCard>

        {error && (
          <GlassCard className="mt-5 border-rose-400/20 p-4">
            <div className="flex items-start gap-3 text-rose-200">
              <Info className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">O*NET lookup error</p>
                <p className="mt-1 text-xs leading-5 text-rose-200/70">{error}</p>
              </div>
            </div>
          </GlassCard>
        )}

        {occupationError && !error && (
          <GlassCard className="mt-5 border-amber-200/20 p-4">
            <div className="flex items-start gap-3 text-amber-200">
              <Info className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Occupation details unavailable</p>
                <p className="mt-1 text-xs leading-5 text-amber-200/70">{occupationError}</p>
              </div>
            </div>
          </GlassCard>
        )}

        {jobContext && (
          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <GlassCard className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15">
                    <Briefcase className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/45">Top O*NET match</p>
                    <h2 className="mt-1 text-xl font-black text-white">
                      {jobContext.occupation.title} ({jobContext.occupation.code})
                    </h2>
                    {jobContext.occupation.score !== undefined && (
                      <p className="mt-1 text-xs text-cyan-100/55">Relevance score: {jobContext.occupation.score}</p>
                    )}
                    {jobContext.occupation.description && (
                      <p className="mt-3 text-sm leading-6 text-cyan-100/65">{jobContext.occupation.description}</p>
                    )}
                  </div>
                </div>
              </GlassCard>

              <DemandCard
                title="Physical Demands"
                subtitle={jobContext.physical_demands.summary}
                items={[
                  ...jobContext.physical_demands.abilities.slice(0, 5),
                  ...jobContext.physical_demands.work_activities.slice(0, 5),
                  ...(jobContext.physical_demands.work_context ?? []).slice(0, 5),
                ]}
                accent="emerald"
              />

              <DemandCard
                title="Cognitive Demands"
                subtitle={jobContext.cognitive_demands.summary}
                items={[
                  ...jobContext.cognitive_demands.abilities.slice(0, 5),
                  ...jobContext.cognitive_demands.work_activities.slice(0, 5),
                  ...(jobContext.cognitive_demands.work_context ?? []).slice(0, 5),
                ]}
                accent="cyan"
              />

              <GlassCard className="p-5">
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/45">Safety-sensitive indicators</p>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      jobContext.safety_sensitive_indicators.safety_sensitive
                        ? "bg-rose-400/15 text-rose-200"
                        : "bg-emerald-400/15 text-emerald-200"
                    }`}
                  >
                    {jobContext.safety_sensitive_indicators.safety_sensitive ? "Safety-sensitive" : "Not strongly indicated"}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {jobContext.safety_sensitive_indicators.indicators.map((indicator, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs leading-5 text-cyan-100/65">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      {indicator}
                    </li>
                  ))}
                </ul>
              </GlassCard>

              <DemandCard
                title="Environmental / Work Context Indicators"
                subtitle={jobContext.environmental_indicators.summary}
                items={jobContext.environmental_indicators.work_context.slice(0, 8)}
                accent="amber"
              />

              <GlassCard className="p-5">
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/45">Suggested essential functions</p>
                <p className="mt-1 text-xs leading-5 text-cyan-100/55">
                  Derived from O*NET tasks, work activities, and abilities. Validate against employer-specific requirements.
                </p>
                <ul className="mt-3 space-y-1.5">
                  {jobContext.essential_function_suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs leading-5 text-cyan-100/70">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </div>

            <div className="space-y-5">
              <GlassCard className="p-5">
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/45">Likely occupation matches</p>
                <div className="mt-3 space-y-2">
                  {jobContext.matches.map((match) => (
                    <button
                      key={match.code}
                      onClick={() => handleSelectMatch(match)}
                      className="flex w-full items-center justify-between rounded-xl border border-cyan-100/10 bg-white/[0.02] p-3 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.04]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-cyan-50">{match.title}</p>
                        <p className="text-xs text-cyan-100/45">{match.code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {match.score !== undefined && (
                          <span className="text-xs text-cyan-100/55">{match.score}</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-cyan-100/40" />
                      </div>
                    </button>
                  ))}
                </div>
              </GlassCard>

              {occupationLoading && (
                <GlassCard className="p-5 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-cyan-300" />
                  <p className="mt-2 text-xs text-cyan-100/55">Loading full occupation profile...</p>
                </GlassCard>
              )}

              {selectedOccupation && (
                <GlassCard className="p-5">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/45">Full occupation profile</p>
                  <h3 className="mt-1 text-lg font-bold text-white">{selectedOccupation.title}</h3>
                  <p className="text-xs text-cyan-100/55">{selectedOccupation.code}</p>

                  <ProfileSection title="Tasks" items={selectedOccupation.tasks} />
                  <ProfileSection title="Work Activities" items={selectedOccupation.work_activities} />
                  <ProfileSection title="Detailed Work Activities" items={selectedOccupation.detailed_work_activities} />
                  <ProfileSection title="Abilities" items={selectedOccupation.abilities} />
                  <ProfileSection title="Work Context" items={selectedOccupation.work_context} />
                  <ProfileSection title="Skills" items={selectedOccupation.skills} />
                  <ProfileSection title="Knowledge" items={selectedOccupation.knowledge} />
                  <ProfileSection title="Related Occupations" items={selectedOccupation.related_occupations} />
                </GlassCard>
              )}
            </div>
          </div>
        )}

        <footer className="mt-8 border-t border-cyan-100/10 pt-4">
          <p className="text-[10px] leading-5 text-cyan-100/40">
            This application incorporates information from O*NET Web Services by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). O*NET® is a trademark of USDOL/ETA.
          </p>
        </footer>
      </section>
    </main>
  );
}

function DemandCard({
  title,
  subtitle,
  items,
  accent,
}: {
  title: string;
  subtitle: string;
  items: (string | { name: string; description?: string; value?: unknown })[];
  accent: "emerald" | "cyan" | "amber";
}) {
  if (items.length === 0) return null;
  const dotColor = accent === "emerald" ? "bg-emerald-400" : accent === "cyan" ? "bg-cyan-400" : "bg-amber-400";
  return (
    <GlassCard className="p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-100/45">{title}</p>
      <p className="mt-1 text-xs leading-5 text-cyan-100/55">{subtitle}</p>
      <ul className="mt-3 space-y-1.5">
        {items.slice(0, 10).map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-xs leading-5 text-cyan-100/70">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
            <span className="min-w-0">
              <span className="font-medium text-cyan-50">{itemName(item)}</span>
              {itemDescription(item) && <span className="text-cyan-100/55"> — {itemDescription(item)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

function ProfileSection({
  title,
  items,
}: {
  title: string;
  items: (string | { name: string; description?: string; value?: unknown })[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/40">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.slice(0, 8).map((item, index) => (
          <li key={index} className="text-xs leading-5 text-cyan-100/65">
            {itemName(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}
