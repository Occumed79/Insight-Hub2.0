import type { IntelligenceFact, IntelligenceCategory, IntelligenceConfidence } from "./types";

const CATEGORY_LABELS: Record<string, string> = {
  contractAwards: "Contract Awards",
  opportunities: "Opportunities",
  secFilings: "SEC Filings",
  jobSignals: "Job Signals",
  sourceFacts: "Source Facts",
  sourceConfidence: "Source Confidence",
  timelineEvents: "Timeline Events",
  locationExposure: "Location Exposure",
  medicalNetworkGaps: "Medical Network Gaps",
  competitorSignals: "Competitor Signals",
  renewalOrExpirationEvents: "Renewal / Expiration Events",
};

export function categoryLabel(category?: string): string {
  return CATEGORY_LABELS[category ?? ""] ?? category ?? "Intelligence";
}

export function suggestedAction(
  category?: string,
  confidence?: string,
  sourceType?: string,
  value?: number,
  companyName?: string
): string {
  const cat = category ?? "";
  const conf = confidence ?? "";
  const src = sourceType ?? "";

  if (cat === "contractAwards") {
    if (src === "usaspending" && conf === "high")
      return `Review USASpending awards for ${companyName ?? "this entity"} — validate service geography expansion opportunities.`;
    return `Validate the contract award source before using it in outreach or client-facing material.`;
  }
  if (cat === "opportunities") {
    return `Cross-reference this opportunity against the opportunity matrix before outreach. Check if existing Occu-Med coverage overlaps the target region.`;
  }
  if (cat === "secFilings") {
    return `Use this SEC filing to validate contractor financial health before outreach. Check for risk factors affecting occupational health service demand.`;
  }
  if (cat === "jobSignals") {
    return `Prioritize clinic network search in this location — hiring signals indicate workforce expansion that may need occupational health coverage.`;
  }
  if (cat === "locationExposure") {
    return `Check whether this region has occupational health network coverage. Use this as a source-backed reason to prioritize provider network development.`;
  }
  if (cat === "medicalNetworkGaps") {
    return `Prioritize clinic network development in this region — gap score indicates unmet occupational health demand.`;
  }
  if (cat === "sourceConfidence") {
    if (conf === "link-only")
      return `This is a link-only source. Validate the source manually before using it in outreach or client-facing material.`;
    return `Use this high-confidence source to support outreach narratives and client proposals.`;
  }
  if (cat === "timelineEvents") {
    return `Review the timeline event for context on recent entity activity. Use it to time outreach or follow-up actions.`;
  }
  if (cat === "competitorSignals") {
    return `Compare competitor activity against Occu-Med's coverage in this region. Identify competitive gaps before outreach.`;
  }
  if (cat === "renewalOrExpirationEvents") {
    return `Track this renewal/expiration event — it may signal a window for Occu-Med to capture or retain occupational health coverage.`;
  }
  return `Use this intelligence to inform outreach strategy for ${companyName ?? "this entity"}.`;
}

export function suggestedQuestions(
  category?: string,
  confidence?: string,
  sourceType?: string
): string[] {
  const cat = category ?? "";
  const conf = confidence ?? "";
  const questions: string[] = [];

  if (cat === "contractAwards") {
    questions.push("Does this contract overlap with Occu-Med's current service geography?");
    questions.push("What is the contract performance period and does it align with our outreach timeline?");
    questions.push("Is the awarding agency a current or potential Occu-Med client?");
  } else if (cat === "opportunities") {
    questions.push("Is this opportunity in a region where Occu-Med already has clinic coverage?");
    questions.push("What is the expected award timeline?");
    questions.push("Does the opportunity require occupational health services that Occu-Med can provide?");
  } else if (cat === "secFilings") {
    questions.push("Does the filing indicate financial stability or risk?");
    questions.push("Are there risk factors that affect demand for occupational health services?");
    questions.push("Does the filing mention occupational health, safety, or workforce wellness initiatives?");
  } else if (cat === "jobSignals") {
    questions.push("Does hiring activity indicate workforce growth that needs occupational health coverage?");
    questions.push("Are the job locations in Occu-Med's current service areas?");
    questions.push("What types of roles are being hired — do they require pre-employment screening or OSHA compliance?");
  } else if (cat === "locationExposure") {
    questions.push("What is the concentration of entity activity in this region?");
    questions.push("Does Occu-Med have existing clinic coverage here?");
    questions.push("Is this a high-priority region for network expansion?");
  } else if (cat === "medicalNetworkGaps") {
    questions.push("How large is the uncovered workforce population in this region?");
    questions.push("What is the estimated timeline to establish clinic coverage here?");
    questions.push("Are there partner clinics or mobile units that could serve this gap?");
  } else if (cat === "sourceConfidence") {
    questions.push("Is this source reliable enough for client-facing materials?");
    questions.push("Should we seek additional corroborating sources?");
    questions.push("What is the freshness of this source — is it still current?");
  } else {
    questions.push("How does this intelligence impact Occu-Med's outreach strategy?");
    questions.push("Is there additional context needed before acting on this?");
    questions.push("Should this be shared with the business development team?");
  }

  if (conf === "link-only") {
    questions.push("This is a link-only source — should we manually verify the content before using it?");
  }
  if (conf === "low") {
    questions.push("Confidence is low — do we need additional sources to validate this?");
  }

  return questions;
}

export function whyThisMatters(
  category?: string,
  confidence?: string,
  value?: number,
  companyName?: string,
  chartTitle?: string
): string {
  const cat = category ?? "";
  const conf = confidence ?? "";
  const name = companyName ?? "this entity";

  if (cat === "contractAwards") {
    return `This federal contract award${value ? ` of $${value.toLocaleString()}` : ""} from USASpending.gov is a verified, high-confidence data point. It confirms active federal contracting activity for ${name}, which directly informs market sizing and outreach timing.`;
  }
  if (cat === "opportunities") {
    return `This opportunity signal indicates a potential federal contract pipeline item. Tracking opportunities helps Occu-Med anticipate demand for occupational health services in specific agencies and regions.`;
  }
  if (cat === "secFilings") {
    return `This SEC filing is an official regulatory disclosure. It provides verified financial and operational context about ${name} that can be used in client-facing intelligence packages.`;
  }
  if (cat === "jobSignals") {
    return `Hiring signals indicate workforce expansion or turnover. For Occu-Med, this translates to potential demand for pre-employment screening, OSHA compliance, and occupational health coverage.`;
  }
  if (cat === "locationExposure") {
    return `Geographic concentration of intelligence signals reveals where ${name} operates. This helps Occu-Med identify regions where occupational health network coverage may be needed.`;
  }
  if (cat === "medicalNetworkGaps") {
    return `Network gap scores highlight regions with unmet occupational health demand. These are priority targets for Occu-Med clinic network expansion.`;
  }
  if (cat === "sourceConfidence") {
    if (conf === "link-only")
      return `This is a link-only source — the URL was recorded but the content was not automatically verified. Manual review is required before using this in client-facing materials.`;
    return `Source confidence tracking helps prioritize which intelligence is safe to use in outreach and which needs additional validation.`;
  }
  if (cat === "timelineEvents") {
    return `Timeline events provide chronological context for ${name}'s intelligence profile. They help identify patterns and timing for outreach actions.`;
  }
  if (chartTitle) {
    return `This data point from "${chartTitle}" provides context about ${name}'s profile. ${conf === "high" ? "This is a high-confidence source." : conf === "medium" ? "This is a medium-confidence source." : conf === "low" ? "This is a low-confidence source — validate before using." : "Confidence level is unknown."}`;
  }
  return `This intelligence provides context about ${name}. Use it to inform outreach and business development strategy.`;
}

export function findRelatedFacts(
  facts: IntelligenceFact[],
  selection: { category?: string; date?: string; sourceType?: string; intelligenceCategory?: string }
): IntelligenceFact[] {
  const cat = selection.intelligenceCategory ?? selection.category;
  if (!facts.length) return [];
  let related = facts;
  if (cat) {
    const sameCategory = facts.filter((f) => f.category === cat);
    if (sameCategory.length > 0) related = sameCategory;
  }
  if (selection.date) {
    const dateStr = selection.date.slice(0, 10);
    const sameDate = related.filter((f) => f.date.startsWith(dateStr));
    if (sameDate.length > 0) related = sameDate;
  }
  if (selection.sourceType) {
    const sameSource = related.filter((f) => f.sourceType === selection.sourceType);
    if (sameSource.length > 0) related = sameSource;
  }
  return related.slice(0, 8);
}

export function confidenceSummary(facts: IntelligenceFact[]): { high: number; medium: number; low: number; linkOnly: number } {
  return {
    high: facts.filter((f) => f.confidence === "high").length,
    medium: facts.filter((f) => f.confidence === "medium").length,
    low: facts.filter((f) => f.confidence === "low").length,
    linkOnly: facts.filter((f) => f.confidence === "link-only").length,
  };
}

export function sourceTypeSummary(facts: IntelligenceFact[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of facts) {
    counts[f.sourceType] = (counts[f.sourceType] ?? 0) + 1;
  }
  return counts;
}

export function topSignal(facts: IntelligenceFact[]): IntelligenceFact | null {
  if (!facts.length) return null;
  const live = facts.filter((f) => f.confidence === "high");
  if (live.length > 0) {
    return live.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  }
  return facts.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
}

export function highestValueFact(facts: IntelligenceFact[], category?: IntelligenceCategory): IntelligenceFact | null {
  const filtered = category ? facts.filter((f) => f.category === category) : facts;
  if (!filtered.length) return null;
  return filtered.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
}

export function mostRecentFact(facts: IntelligenceFact[], category?: IntelligenceCategory): IntelligenceFact | null {
  const filtered = category ? facts.filter((f) => f.category === category) : facts;
  if (!filtered.length) return null;
  return filtered.sort((a, b) => b.date.localeCompare(a.date))[0];
}
