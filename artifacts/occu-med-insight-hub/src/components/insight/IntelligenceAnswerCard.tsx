import { GlassCard } from "@/components/insight/GlassCard";
import type { CompanyIntelligence, IntelligenceFact } from "@/data/types";
import { categoryLabel, suggestedAction, topSignal, highestValueFact, mostRecentFact, confidenceSummary } from "@/data/intelligenceActions";

interface AnswerCardProps {
  companyName: string;
  intelligence: CompanyIntelligence | undefined;
  metrics: { label: string; value: number; unit?: string; category?: string }[];
  signals: { label: string; value: string; note?: string }[];
  dossierSections: { title: string; narrative?: string; bullets?: string[] }[];
  riskMatrix: any[];
  opportunityMatrix: any[];
}

type CoverageCard = {
  label: string;
  status: "live" | "static" | "none";
  detail: string;
  color: string;
};

export function IntelligenceAnswerCard({
  companyName,
  intelligence,
  metrics,
  signals,
  dossierSections,
  riskMatrix,
  opportunityMatrix,
}: AnswerCardProps) {
  const facts = intelligence?.facts ?? [];
  const liveFacts = facts.filter((f) => f.confidence !== "link-only");
  const sourceLeads = facts.filter((f) => f.confidence === "link-only");
  const hasLive = liveFacts.length > 0;
  const conf = confidenceSummary(liveFacts);

  const top = topSignal(liveFacts);
  const highestAward = highestValueFact(liveFacts, "contractAwards");
  const highestRisk = highestValueFact(liveFacts, "medicalNetworkGaps");
  const recentFact = mostRecentFact(liveFacts);

  const bullets = generateBullets(hasLive, liveFacts, metrics, signals, dossierSections, riskMatrix, opportunityMatrix, companyName);
  const action = top
    ? suggestedAction(top.category, top.confidence, top.sourceType, top.value, companyName)
    : generateStaticAction(metrics, signals, riskMatrix, opportunityMatrix, companyName);

  const coverageCards = buildCoverageCards(liveFacts, sourceLeads, metrics, signals, riskMatrix, opportunityMatrix);

  const evidenceStatus = hasLive
    ? `${liveFacts.length} live facts from ${new Set(liveFacts.map((f) => f.sourceType)).size} source(s)`
    : sourceLeads.length > 0
      ? `${sourceLeads.length} source leads (link-only) — no live facts yet`
      : "No intelligence ingested — using static profile data only";

  return (
    <div className="mb-5 space-y-4">
      <GlassCard className="p-6">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${hasLive ? "bg-emerald-400" : "bg-amber-400"}`} />
          <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/45">Intelligence Answer</p>
        </div>
        <h2 className="mt-2 text-xl font-black text-white">
          What matters now for {companyName}
        </h2>

        <div className="mt-4 space-y-2">
          {bullets.map((bullet, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
              <p className="text-sm leading-6 text-cyan-100/80">{bullet}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/50">Recommended Occu-Med Next Action</p>
            <p className="mt-2 text-sm leading-6 text-cyan-100/80">{action}</p>
          </div>
          <div className="rounded-xl border border-cyan-100/10 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/42">Evidence Status</p>
            <p className="mt-2 text-sm leading-6 text-cyan-100/70">{evidenceStatus}</p>
            {hasLive && (
              <div className="mt-2 flex flex-wrap gap-2">
                {conf.high > 0 && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-300">High: {conf.high}</span>}
                {conf.medium > 0 && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-300">Medium: {conf.medium}</span>}
                {conf.low > 0 && <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-300">Low: {conf.low}</span>}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {coverageCards.map((card) => (
          <GlassCard key={card.label} className="p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: card.color }} />
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/45">{card.label}</p>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  card.status === "live"
                    ? "bg-emerald-400/15 text-emerald-300"
                    : card.status === "static"
                      ? "bg-cyan-100/10 text-cyan-100/60"
                      : "bg-rose-400/10 text-rose-300/60"
                }`}
              >
                {card.status === "live" ? "LIVE" : card.status === "static" ? "STATIC" : "NONE"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-cyan-100/65">{card.detail}</p>
          </GlassCard>
        ))}
      </div>

      {!hasLive && (
        <GlassCard className="border-amber-400/20 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg text-amber-400">⚠</span>
            <div>
              <p className="text-sm font-bold text-amber-200">No live intelligence facts yet</p>
              <p className="mt-1 text-xs leading-5 text-cyan-100/60">
                This workspace is using static profile data and source leads. Run Intelligence Ingest to fetch live facts from USASpending and SEC EDGAR.
                If ingest returns no live facts, the company may not have federal contract awards or SEC filings under the queried aliases.
              </p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function generateBullets(
  hasLive: boolean,
  liveFacts: IntelligenceFact[],
  metrics: { label: string; value: number; unit?: string; category?: string }[],
  signals: { label: string; value: string; note?: string }[],
  dossierSections: { title: string; narrative?: string; bullets?: string[] }[],
  riskMatrix: any[],
  opportunityMatrix: any[],
  companyName: string
): string[] {
  const bullets: string[] = [];

  if (hasLive) {
    const awardFacts = liveFacts.filter((f) => f.category === "contractAwards");
    if (awardFacts.length > 0) {
      const total = awardFacts.reduce((sum, f) => sum + (f.value ?? 0), 0);
      const top = awardFacts.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
      bullets.push(
        `${awardFacts.length} federal contract award(s) found totaling $${total.toLocaleString()}. Largest: ${top.title} ($${(top.value ?? 0).toLocaleString()} from ${top.metadata?.awardingAgency ?? "unknown agency"}).`
      );
    }

    const secFacts = liveFacts.filter((f) => f.category === "secFilings");
    if (secFacts.length > 0) {
      bullets.push(`${secFacts.length} SEC filing(s) found. Most recent: ${secFacts[0].title} (${secFacts[0].date}).`);
    }

    const jobFacts = liveFacts.filter((f) => f.category === "jobSignals" && f.confidence !== "link-only");
    if (jobFacts.length > 0) {
      bullets.push(`${jobFacts.length} live job signal(s) detected — workforce expansion indicators for occupational health coverage planning.`);
    }

    const locFacts = liveFacts.filter((f) => f.category === "locationExposure");
    if (locFacts.length > 0) {
      const regions = new Set(locFacts.map((f) => f.metadata?.region ?? "Unknown"));
      bullets.push(`Geographic exposure across ${regions.size} region(s) from live intelligence — prioritize clinic network coverage in these areas.`);
    }

    if (bullets.length < 3 && liveFacts.length > 0) {
      const recent = liveFacts.sort((a, b) => b.date.localeCompare(a.date))[0];
      bullets.push(`Most recent intelligence: ${recent.title} — ${recent.summary.slice(0, 120)}`);
    }
  }

  if (riskMatrix.length > 0) {
    const highRisk = riskMatrix.filter((r) => r.risk >= 7);
    if (highRisk.length > 0) {
      bullets.push(`${highRisk.length} high-risk area(s) identified in the risk matrix — revenue exposure with elevated worker risk scores.`);
    } else {
      bullets.push(`Risk matrix shows ${riskMatrix.length} tracked area(s) with manageable risk scores.`);
    }
  }

  if (opportunityMatrix.length > 0) {
    const topOpp = opportunityMatrix.sort((a, b) => (b.revenuePotential ?? 0) - (a.revenuePotential ?? 0))[0];
    bullets.push(`Top opportunity: ${topOpp.name} — revenue potential ${topOpp.revenuePotential ?? "N/A"}, strategic value ${topOpp.strategicValue ?? "N/A"}.`);
  }

  if (signals.length > 0 && bullets.length < 4) {
    const topSignal = signals[0];
    bullets.push(`Executive signal: ${topSignal.label} — ${topSignal.value}${topSignal.note ? ` (${topSignal.note})` : ""}`);
  }

  if (metrics.length > 0 && bullets.length < 5) {
    const workforceMetrics = metrics.filter((m) => m.category === "workforce" || m.label.toLowerCase().includes("employee") || m.label.toLowerCase().includes("worker"));
    if (workforceMetrics.length > 0) {
      const m = workforceMetrics[0];
      bullets.push(`Workforce metric: ${m.label} = ${m.value}${m.unit ? ` ${m.unit}` : ""} — use this for occupational health coverage sizing.`);
    }
  }

  if (bullets.length === 0) {
    bullets.push(`No intelligence signals available for ${companyName}. Run Intelligence Ingest or add profile data to generate insights.`);
  }

  return bullets.slice(0, 5);
}

function generateStaticAction(
  metrics: { label: string; value: number; unit?: string }[],
  signals: { label: string; value: string }[],
  riskMatrix: any[],
  opportunityMatrix: any[],
  companyName: string
): string {
  if (opportunityMatrix.length > 0) {
    const top = opportunityMatrix.sort((a, b) => (b.revenuePotential ?? 0) - (a.revenuePotential ?? 0))[0];
    return `Pursue opportunity: ${top.name} for ${companyName}. Revenue potential is ${top.revenuePotential ?? "unknown"}. Run intelligence ingest to validate with live federal contract data.`;
  }
  if (riskMatrix.length > 0) {
    const high = riskMatrix.filter((r) => r.risk >= 7);
    if (high.length > 0) {
      return `Address high-risk area: ${high[0].name} for ${companyName}. Worker risk score is ${high[0].risk}. Prioritize occupational health coverage review.`;
    }
  }
  if (signals.length > 0) {
    return `Act on executive signal: ${signals[0].label} — ${signals[0].value}. Run intelligence ingest to get live source-backed evidence.`;
  }
  return `Run Intelligence Ingest for ${companyName} to fetch live federal contract awards and SEC filings. Static profile data is being used as fallback.`;
}

function buildCoverageCards(
  liveFacts: IntelligenceFact[],
  sourceLeads: IntelligenceFact[],
  metrics: { label: string; value: number; unit?: string; category?: string }[],
  signals: { label: string; value: string }[],
  riskMatrix: any[],
  opportunityMatrix: any[]
): CoverageCard[] {
  const contractLive = liveFacts.filter((f) => f.category === "contractAwards");
  const contractLeads = sourceLeads.filter((f) => f.category === "contractAwards" || f.category === "opportunities");

  const workforceLive = liveFacts.filter((f) => f.category === "jobSignals");
  const workforceMetrics = metrics.filter((m) => m.category === "workforce" || m.label.toLowerCase().includes("employee") || m.label.toLowerCase().includes("worker"));

  const locationLive = liveFacts.filter((f) => f.category === "locationExposure" || f.category === "medicalNetworkGaps");

  const sourceLive = liveFacts.filter((f) => f.category === "secFilings" || f.category === "sourceConfidence");

  return [
    {
      label: "Contract Signal",
      status: contractLive.length > 0 ? "live" : contractLeads.length > 0 ? "static" : "none",
      detail: contractLive.length > 0
        ? `${contractLive.length} live award(s) found. Total: $${contractLive.reduce((s, f) => s + (f.value ?? 0), 0).toLocaleString()}`
        : contractLeads.length > 0
          ? `${contractLeads.length} source lead(s) — run ingest for live awards`
          : "No contract intelligence available",
      color: "#22d3ee",
    },
    {
      label: "Workforce / Job Signal",
      status: workforceLive.length > 0 ? "live" : workforceMetrics.length > 0 ? "static" : "none",
      detail: workforceLive.length > 0
        ? `${workforceLive.length} live job signal(s) detected`
        : workforceMetrics.length > 0
          ? `${workforceMetrics.length} static workforce metric(s) available`
          : "No workforce intelligence available",
      color: "#34d399",
    },
    {
      label: "Location / Network Gap",
      status: locationLive.length > 0 ? "live" : riskMatrix.length > 0 ? "static" : "none",
      detail: locationLive.length > 0
        ? `${locationLive.length} live location signal(s) across regions`
        : riskMatrix.length > 0
          ? `${riskMatrix.length} static risk matrix point(s) — run ingest for live location data`
          : "No location intelligence available",
      color: "#a3e635",
    },
    {
      label: "Source Confidence",
      status: sourceLive.length > 0 ? "live" : signals.length > 0 ? "static" : "none",
      detail: sourceLive.length > 0
        ? `${sourceLive.length} live high-confidence source(s)`
        : signals.length > 0
          ? `${signals.length} static executive signal(s) — run ingest for live sources`
          : "No source confidence data available",
      color: "#60a5fa",
    },
  ];
}
