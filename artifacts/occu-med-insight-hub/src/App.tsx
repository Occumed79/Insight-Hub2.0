import React from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmployerWorkflowProvider } from "@/components/insight/EmployerWorkflowContext";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import DataVisualization from "@/pages/data-visualization";
import QuantifiableData from "@/pages/quantifiable-data";
import GeographicData from "@/pages/geographic-data";
import LocationOverlap from "@/pages/location-overlap";
import JobIntelligence from "@/pages/job-intelligence";
import HiringIntelligence from "@/pages/hiring-intelligence";
import LeadershipMap from "@/pages/leadership-map";
import CorporateStructure from "@/pages/corporate-structure";
import EmployerWorkflow from "@/pages/employer-workflow";
import EmployerIntelligence from "@/pages/employer-intelligence";
import EntityResolution from "@/pages/entity-resolution";
import OccupationalExposure from "@/pages/occupational-exposure";
import CorporateSignals from "@/pages/company-live-intelligence";
import SecFilings from "@/pages/sec-filings";
import WorkersCompCoverage from "@/pages/workers-comp-coverage";
import DbaIntelligence from "@/pages/dba-intelligence";
import SourceGovernance from "@/pages/source-governance";
import AorRiskIntelligencePage from "@/pages/aor-risk-intelligence";
import { EntitiesPage } from "@/pages/entities";
import {
  CompetitorsPage,
  FederalAgenciesPage,
  StateAgenciesPage,
} from "@/pages/core-intelligence";
import {
  FecFilingsPage,
  FederalAwardsPage,
  IndustryBenchmarksPage,
  LegalReferencesPage,
  OccupationalDemandsPage,
} from "@/pages/standalone-public-tools";

const queryClient = new QueryClient();

const translucentToolCss = String.raw`
  .translucent-tool-page {
    position: relative;
    isolation: isolate;
    color-scheme: dark;
    --tool-glass-border: rgba(207, 250, 254, 0.48);
    --tool-glass-inner-border: rgba(255, 255, 255, 0.22);
    --tool-glass-surface: linear-gradient(145deg, rgba(45,212,191,.17), rgba(14,165,233,.14) 34%, rgba(59,130,246,.15) 66%, rgba(139,92,246,.16));
    --tool-glass-surface-soft: linear-gradient(145deg, rgba(94,234,212,.12), rgba(56,189,248,.10) 46%, rgba(129,140,248,.12));
    --tool-glass-shadow: 0 26px 76px rgba(0,0,0,.34), 0 0 48px rgba(34,211,238,.18), inset 0 1px 0 rgba(255,255,255,.42), inset 0 0 0 1px rgba(255,255,255,.12), inset 0 -26px 70px rgba(76,108,132,.08);
  }

  .translucent-tool-page::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(circle at 14% 12%, rgba(20,184,166,.28), transparent 31%),
      radial-gradient(circle at 48% 44%, rgba(14,165,233,.22), transparent 38%),
      radial-gradient(circle at 86% 18%, rgba(99,102,241,.22), transparent 32%),
      radial-gradient(circle at 68% 84%, rgba(139,92,246,.18), transparent 34%);
  }

  .translucent-tool-page > * { position: relative; z-index: 1; }

  .translucent-tool-page .glass-card {
    overflow: hidden;
    border: 1px solid var(--tool-glass-border) !important;
    background-color: rgba(18, 78, 102, .10) !important;
    background-image: var(--tool-glass-surface) !important;
    box-shadow: var(--tool-glass-shadow) !important;
    backdrop-filter: blur(34px) saturate(1.42) brightness(1.08) !important;
    -webkit-backdrop-filter: blur(34px) saturate(1.42) brightness(1.08) !important;
  }

  .translucent-tool-page .glass-card::before {
    background:
      linear-gradient(122deg, rgba(255,255,255,.36), rgba(255,255,255,.09) 18%, transparent 37%),
      radial-gradient(circle at 11% 0%, rgba(153,246,228,.26), transparent 34%),
      radial-gradient(circle at 100% 14%, rgba(196,181,253,.22), transparent 30%) !important;
    opacity: .82 !important;
  }

  .translucent-tool-page .glass-card::after {
    opacity: .28 !important;
    filter: blur(18px);
  }

  .translucent-tool-page[data-tool-page="sec"] main div.relative[class*="p-"],
  .translucent-tool-page[data-tool-page="sec"] main div.relative[class*="overflow-hidden"] {
    overflow: hidden;
    border: 1px solid var(--tool-glass-border) !important;
    border-radius: 28px !important;
    background: var(--tool-glass-surface) !important;
    box-shadow: var(--tool-glass-shadow) !important;
    backdrop-filter: blur(34px) saturate(1.42) !important;
    -webkit-backdrop-filter: blur(34px) saturate(1.42) !important;
  }

  .translucent-tool-page main div[class*="bg-[#"],
  .translucent-tool-page main section[class*="bg-[#"],
  .translucent-tool-page main label[class*="bg-[#"],
  .translucent-tool-page main article[class*="bg-[#"],
  .translucent-tool-page main aside[class*="bg-[#"],
  .translucent-tool-page main div[class*="bg-black/"],
  .translucent-tool-page main section[class*="bg-black/"],
  .translucent-tool-page main label[class*="bg-black/"],
  .translucent-tool-page main article[class*="bg-black/"] {
    background-color: rgba(17,94,117,.10) !important;
    background-image: var(--tool-glass-surface-soft) !important;
    border-color: rgba(207,250,254,.34) !important;
    box-shadow: 0 18px 48px rgba(0,0,0,.20), 0 0 30px rgba(34,211,238,.10), inset 0 1px 0 rgba(255,255,255,.34), inset 0 0 0 1px rgba(255,255,255,.09) !important;
    backdrop-filter: blur(28px) saturate(1.34) brightness(1.07) !important;
    -webkit-backdrop-filter: blur(28px) saturate(1.34) brightness(1.07) !important;
  }

  .translucent-tool-page main input,
  .translucent-tool-page main textarea,
  .translucent-tool-page main select {
    color: rgba(255,255,255,.99) !important;
    border-color: rgba(207,250,254,.40) !important;
    background: linear-gradient(145deg, rgba(45,212,191,.12), rgba(59,130,246,.11), rgba(139,92,246,.10)) !important;
    box-shadow: 0 12px 34px rgba(0,0,0,.18), 0 0 24px rgba(34,211,238,.08), inset 0 1px 0 rgba(255,255,255,.31), inset 0 0 0 1px rgba(255,255,255,.09) !important;
    backdrop-filter: blur(24px) saturate(1.30) !important;
    -webkit-backdrop-filter: blur(24px) saturate(1.30) !important;
  }

  .translucent-tool-page main select option {
    color: white;
    background: #0b1c2d;
  }

  .translucent-tool-page main input::placeholder,
  .translucent-tool-page main textarea::placeholder {
    color: rgba(236,254,255,.72) !important;
  }

  .translucent-tool-page main input:focus,
  .translucent-tool-page main textarea:focus,
  .translucent-tool-page main select:focus {
    border-color: rgba(207,250,254,.76) !important;
    box-shadow: 0 0 0 3px rgba(34,211,238,.12), 0 18px 44px rgba(0,0,0,.23), 0 0 32px rgba(34,211,238,.14), inset 0 1px 0 rgba(255,255,255,.38) !important;
  }

  .translucent-tool-page main div[class*="rounded-[27px]"][class*="border"],
  .translucent-tool-page main div[class*="rounded-[26px]"][class*="border"],
  .translucent-tool-page main div[class*="rounded-[25px]"][class*="border"],
  .translucent-tool-page main div[class*="rounded-[23px]"][class*="border"] {
    background-color: rgba(17,94,117,.08) !important;
    background-image: var(--tool-glass-surface-soft) !important;
    border-color: rgba(207,250,254,.30) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.30), inset 0 0 0 1px rgba(255,255,255,.08) !important;
  }

  .translucent-tool-page main [class*="text-cyan-100/"],
  .translucent-tool-page main [class*="text-cyan-50/"],
  .translucent-tool-page main [class*="text-sky-100/"],
  .translucent-tool-page main [class*="text-sky-50/"] {
    color: rgba(236,254,255,.93) !important;
  }

  .translucent-tool-page main h1,
  .translucent-tool-page main h2,
  .translucent-tool-page main h3 {
    text-shadow: 0 0 18px rgba(207,250,254,.16), 0 0 34px rgba(34,211,238,.08);
  }

  .translucent-tool-page main [class*="bg-rose-"],
  .translucent-tool-page main [class*="bg-amber-"],
  .translucent-tool-page main [class*="bg-emerald-"],
  .translucent-tool-page main [class*="bg-violet-"],
  .translucent-tool-page main [class*="bg-cyan-"] {
    backdrop-filter: blur(22px) saturate(1.30);
    -webkit-backdrop-filter: blur(22px) saturate(1.30);
  }

  .translucent-tool-page[data-tool-page="sec"] aside[role="dialog"] {
    border-color: rgba(207,250,254,.44) !important;
    background: linear-gradient(145deg, rgba(45,212,191,.16), rgba(59,130,246,.15), rgba(139,92,246,.14)) !important;
    box-shadow: -30px 0 90px rgba(0,0,0,.42), inset 1px 0 0 rgba(255,255,255,.34) !important;
    backdrop-filter: blur(38px) saturate(1.40) !important;
    -webkit-backdrop-filter: blur(38px) saturate(1.40) !important;
  }
`;

function TranslucentToolPage({ page, children }: { page: string; children: React.ReactNode }) {
  return (
    <div className="translucent-tool-page" data-tool-page={page}>
      <style>{translucentToolCss}</style>
      {children}
    </div>
  );
}

function EntitiesRoute() {
  return <EntitiesPage defaultTab="prospects" />;
}

function ClientsRoute() {
  return <EntitiesPage defaultTab="clients" />;
}

function CompetitorsRoute() {
  return <TranslucentToolPage page="competitors"><CompetitorsPage /></TranslucentToolPage>;
}

function FederalAgenciesRoute() {
  return <TranslucentToolPage page="federal-agencies"><FederalAgenciesPage /></TranslucentToolPage>;
}

function StateAgenciesRoute() {
  return <TranslucentToolPage page="state-agencies"><StateAgenciesPage /></TranslucentToolPage>;
}

function DbaRoute() {
  return (
    <div className="dba-hub-route">
      <style>{`.dba-hub-route main > section > .glass-card.border-amber-200\\/14 { display: none !important; }`}</style>
      <DbaIntelligence />
    </div>
  );
}

function SecFilingsRoute() {
  return <TranslucentToolPage page="sec"><SecFilings /></TranslucentToolPage>;
}

function LeadershipMapRoute() {
  return <TranslucentToolPage page="organizational-chart"><LeadershipMap /></TranslucentToolPage>;
}

function FecFilingsRoute() {
  return <TranslucentToolPage page="fec"><FecFilingsPage /></TranslucentToolPage>;
}

function IndustryBenchmarksRoute() {
  return <TranslucentToolPage page="bls"><IndustryBenchmarksPage /></TranslucentToolPage>;
}

function OccupationalDemandsRoute() {
  return <TranslucentToolPage page="onet"><OccupationalDemandsPage /></TranslucentToolPage>;
}

function FederalAwardsRoute() {
  return <TranslucentToolPage page="federal-awards"><FederalAwardsPage /></TranslucentToolPage>;
}

function LegalReferencesRoute() {
  return <TranslucentToolPage page="legal"><LegalReferencesPage /></TranslucentToolPage>;
}

function AorRiskRoute() {
  return <TranslucentToolPage page="aor"><AorRiskIntelligencePage /></TranslucentToolPage>;
}

function StandaloneMapPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="standalone-map-page">
      <style>{`
        .standalone-map-page main > aside { display: none !important; }
        .standalone-map-page main > section { margin-left: 0 !important; padding-top: 5.75rem !important; }
      `}</style>
      <Link
        href="/"
        aria-label="Back to the Insight Hub landing page"
        className="fixed left-4 top-4 z-[850] inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-100/18 bg-[#06101d]/78 px-4 text-xs font-bold text-cyan-50/76 shadow-[0_16px_48px_rgba(0,0,0,.42),0_0_28px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-2xl transition hover:border-cyan-200/34 hover:bg-cyan-300/[0.12] hover:text-white"
      >
        <ArrowLeft size={15} />
        Back
      </Link>
      {children}
    </div>
  );
}

function GlobalLocationsRoute() {
  return <StandaloneMapPage><GeographicData /></StandaloneMapPage>;
}

function GlobalLocationOverlapRoute() {
  return <StandaloneMapPage><LocationOverlap /></StandaloneMapPage>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/entities" component={EntitiesRoute} />
      <Route path="/prospects" component={EntitiesRoute} />
      <Route path="/clients" component={ClientsRoute} />
      <Route path="/competitors" component={CompetitorsRoute} />
      <Route path="/federal-agencies" component={FederalAgenciesRoute} />
      <Route path="/state-agencies" component={StateAgenciesRoute} />
      <Route path="/sec-filings" component={SecFilingsRoute} />
      <Route path="/leadership-map" component={LeadershipMapRoute} />
      <Route path="/dba-intelligence" component={DbaRoute} />
      <Route path="/fec-filings" component={FecFilingsRoute} />
      <Route path="/industry-injury-benchmarks" component={IndustryBenchmarksRoute} />
      <Route path="/occupational-demands" component={OccupationalDemandsRoute} />
      <Route path="/federal-awards" component={FederalAwardsRoute} />
      <Route path="/public-legal-references" component={LegalReferencesRoute} />
      <Route path="/aor-risk-intelligence" component={AorRiskRoute} />

      <Route path="/geographic-footprint" component={GlobalLocationsRoute} />
      <Route path="/geographic-data" component={GlobalLocationsRoute} />
      <Route path="/location-overlap" component={GlobalLocationOverlapRoute} />
      <Route path="/geographic-overlap" component={GlobalLocationOverlapRoute} />

      <Route path="/data-visualization" component={DataVisualization} />
      <Route path="/quantifiable-data" component={QuantifiableData} />
      <Route path="/hiring-intelligence" component={HiringIntelligence} />
      <Route path="/corporate-structure" component={CorporateStructure} />
      <Route path="/job-intelligence" component={JobIntelligence} />
      <Route path="/employer-workflow" component={EmployerWorkflow} />
      <Route path="/employer-intelligence" component={EmployerIntelligence} />
      <Route path="/entity-resolution" component={EntityResolution} />
      <Route path="/injury-workforce-exposure" component={OccupationalExposure} />
      <Route path="/occupational-exposure" component={OccupationalExposure} />
      <Route path="/corporate-signals" component={CorporateSignals} />
      <Route path="/company-live-intelligence" component={CorporateSignals} />
      <Route path="/workers-comp-coverage" component={WorkersCompCoverage} />
      <Route path="/source-governance" component={SourceGovernance} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <EmployerWorkflowProvider>
            <Router />
          </EmployerWorkflowProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
