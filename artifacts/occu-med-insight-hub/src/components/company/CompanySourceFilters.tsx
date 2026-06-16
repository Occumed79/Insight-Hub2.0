import { GlassCard } from "../insight/GlassCard";
import type { SourceFilterDefinition } from "../../company-configs/types";

function FilterRow({ label, value }: { label: string; value: string | string[] | undefined }) {
  if (!value || (Array.isArray(value) && !value.length)) return null;
  const display = Array.isArray(value) ? value.join(", ") : value;
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 text-cyan-100/55">{label}:</span>
      <span className="text-white">{display}</span>
    </div>
  );
}

function SourceCategory({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/55">{title}</p>
      {children}
    </div>
  );
}

export function CompanySourceFilters({ filters }: { filters: SourceFilterDefinition | undefined }) {
  if (!filters) return null;
  const hasSec = filters.sec && (filters.sec.cik || filters.sec.ticker || filters.sec.legalEntities?.length || filters.sec.formerNames?.length);
  const hasSam = filters.sam && (filters.sam.uei || filters.sam.legalNames?.length || filters.sam.dbas?.length);
  const hasUsa = filters.usaSpending && (filters.usaSpending.recipientNames?.length || filters.usaSpending.parentOrgs?.length);
  const hasJobs = filters.jobSources && (filters.jobSources.linkedin || filters.jobSources.indeed || filters.jobSources.careerSite || filters.jobSources.clearanceJobs);
  const hasNews = filters.newsSources && (filters.newsSources.aliases?.length || filters.newsSources.acquisitionAliases?.length || filters.newsSources.subsidiaries?.length);
  if (!hasSec && !hasSam && !hasUsa && !hasJobs && !hasNews) return null;
  return (
    <GlassCard className="mt-5 p-5">
      <h3 className="text-lg font-bold text-white">Source filters</h3>
      <p className="mt-1 text-xs text-cyan-100/55">Configured identifiers for live data ingestion readiness.</p>
      <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {hasSec && (
          <SourceCategory title="SEC">
            <FilterRow label="CIK" value={filters.sec?.cik} />
            <FilterRow label="Ticker" value={filters.sec?.ticker} />
            <FilterRow label="Legal entities" value={filters.sec?.legalEntities} />
            <FilterRow label="Former names" value={filters.sec?.formerNames} />
          </SourceCategory>
        )}
        {hasSam && (
          <SourceCategory title="SAM.gov">
            <FilterRow label="UEI" value={filters.sam?.uei} />
            <FilterRow label="Legal names" value={filters.sam?.legalNames} />
            <FilterRow label="DBAs" value={filters.sam?.dbas} />
          </SourceCategory>
        )}
        {hasUsa && (
          <SourceCategory title="USA Spending">
            <FilterRow label="Recipients" value={filters.usaSpending?.recipientNames} />
            <FilterRow label="Parent orgs" value={filters.usaSpending?.parentOrgs} />
          </SourceCategory>
        )}
        {hasJobs && (
          <SourceCategory title="Job sources">
            <FilterRow label="LinkedIn" value={filters.jobSources?.linkedin} />
            <FilterRow label="Indeed" value={filters.jobSources?.indeed} />
            <FilterRow label="Career site" value={filters.jobSources?.careerSite} />
            <FilterRow label="ClearanceJobs" value={filters.jobSources?.clearanceJobs} />
          </SourceCategory>
        )}
        {hasNews && (
          <SourceCategory title="News sources">
            <FilterRow label="Aliases" value={filters.newsSources?.aliases} />
            <FilterRow label="Acquisition aliases" value={filters.newsSources?.acquisitionAliases} />
            <FilterRow label="Subsidiaries" value={filters.newsSources?.subsidiaries} />
          </SourceCategory>
        )}
      </div>
    </GlassCard>
  );
}
