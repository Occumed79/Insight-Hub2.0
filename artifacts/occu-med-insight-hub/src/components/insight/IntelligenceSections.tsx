import { GlassCard } from "@/components/insight/GlassCard";
import type { CompanyIntelligence, IntelligenceFact, IntelligenceCategory } from "@/data/types";
import { intelligenceFactsByCategory } from "@/data/intelligenceCharts";
import { confidenceSummary, sourceTypeSummary, mostRecentFact, highestValueFact, categoryLabel, suggestedAction } from "@/data/intelligenceActions";

const SECTION_ORDER: IntelligenceCategory[] = [
  "contractAwards",
  "opportunities",
  "secFilings",
  "jobSignals",
  "sourceConfidence",
  "timelineEvents",
  "locationExposure",
  "medicalNetworkGaps",
];

const CATEGORY_COLORS: Record<string, string> = {
  contractAwards: "#22d3ee",
  opportunities: "#a78bfa",
  secFilings: "#fbbf24",
  jobSignals: "#34d399",
  sourceConfidence: "#60a5fa",
  timelineEvents: "#fb7185",
  locationExposure: "#a3e635",
  medicalNetworkGaps: "#fb923c",
};

export function IntelligenceSections({
  intelligence,
  companyName,
}: {
  intelligence: CompanyIntelligence | undefined;
  companyName: string;
}) {
  const facts = intelligence?.facts ?? [];
  if (!facts.length) return null;
  const byCategory = intelligenceFactsByCategory(facts);

  const sections = SECTION_ORDER.filter((cat) => byCategory[cat]?.length > 0);

  if (!sections.length) return null;

  return (
    <div className="mb-5">
      <p className="mb-3 text-xs uppercase tracking-[0.25em] text-cyan-100/35">Intelligence Sections</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((category) => {
          const catFacts = byCategory[category];
          const conf = confidenceSummary(catFacts);
          const srcTypes = sourceTypeSummary(catFacts);
          const recent = mostRecentFact(catFacts, category);
          const highest = highestValueFact(catFacts, category);
          const color = CATEGORY_COLORS[category] ?? "#22d3ee";

          return (
            <GlassCard key={category} className="p-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                <h4 className="text-sm font-bold text-cyan-50">{categoryLabel(category)}</h4>
                <span className="ml-auto rounded-full bg-cyan-100/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100/70">
                  {catFacts.length}
                </span>
              </div>

              {recent && (
                <div className="mt-3">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/40">Most Recent</p>
                  <p className="mt-0.5 text-xs font-semibold text-cyan-50 truncate">{recent.title}</p>
                  <p className="text-[10px] text-cyan-100/45">{recent.date} — {recent.sourceType}</p>
                </div>
              )}

              {highest && highest.value && (
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/40">Highest Value</p>
                  <p className="mt-0.5 text-xs font-semibold text-cyan-50">
                    {highest.valueUnit === "usd" ? `$${highest.value.toLocaleString()}` : highest.value.toLocaleString()}
                  </p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {conf.high > 0 && <Badge label={`High ${conf.high}`} color="#34d399" />}
                {conf.medium > 0 && <Badge label={`Med ${conf.medium}`} color="#fbbf24" />}
                {conf.low > 0 && <Badge label={`Low ${conf.low}`} color="#fb7185" />}
                {conf.linkOnly > 0 && <Badge label={`Link ${conf.linkOnly}`} color="#94a3b8" />}
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(srcTypes).slice(0, 4).map(([type, count]) => (
                  <span key={type} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-cyan-100/50">
                    {type}: {count}
                  </span>
                ))}
              </div>

              <div className="mt-3 rounded-lg border border-amber-200/10 bg-amber-200/[0.03] px-2 py-1.5">
                <p className="text-[9px] leading-4 text-amber-100/60">
                  {suggestedAction(category, recent?.confidence, recent?.sourceType, highest?.value, companyName)}
                </p>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: `${color}15`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
