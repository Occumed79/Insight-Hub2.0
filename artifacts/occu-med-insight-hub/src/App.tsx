import React from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmployerWorkflowProvider } from "@/components/insight/EmployerWorkflowContext";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import DataProfiles from "@/pages/data-profiles";
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
import {
  CompetitorsPage,
  EntitiesPage,
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
    --tool-glass-border: rgba(255, 255, 255, 0.38);
    --tool-glass-inner-border: rgba(255, 255, 255, 0.16);
    --tool-glass-surface: linear-gradient(145deg, rgba(255,255,255,.145), rgba(225,241,250,.085) 34%, rgba(130,165,190,.105) 66%, rgba(255,255,255,.075));
    --tool-glass-surface-soft: linear-gradient(145deg, rgba(255,255,255,.105), rgba(210,232,245,.065) 48%, rgba(118,155,183,.085));
    --tool-glass-shadow: 0 26px 76px rgba(0,0,0,.34), 0 0 42px rgba(186,230,253,.12), inset 0 1px 0 rgba(255,255,255,.36), inset 0 0 0 1px rgba(255,255,255,.09), inset 0 -26px 70px rgba(76,108,132,.08);
  }

  .translucent-tool-page::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(circle at 16% 10%, rgba(224,242,254,.13), transparent 30%),
      radial-gradient(circle at 84% 18%, rgba(191,219,254,.10), transparent 32%),
      radial-gradient(circle at 62% 82%, rgba(216,180,254,.075), transparent 34%);
  }

  .translucent-tool-page > * { position: relative; z-index: 1; }

  .translucent-tool-page .glass-card {
    overflow: hidden;
    border: 1px solid var(--tool-glass-border) !important;
    background-color: rgba(180, 207, 224, .07) !important;
    background-image: var(--tool-glass-surface) !important;
    box-shadow: var(--tool-glass-shadow) !important;
    backdrop-filter: blur(34px) saturate(1.32) brightness(1.04) !important;
    -webkit-backdrop-filter: blur(34px) saturate(1.32) brightness(1.04) !important;
  }

  .translucent-tool-page .glass-card::before {
    background:
      linear-gradient(122deg, rgba(255,255,255,.31), rgba(255,255,255,.075) 18%, transparent 37%),
      radial-gradient(circle at 11% 0%, rgba(224,242,254,.22), transparent 34%),
      radial-gradient(circle at 100% 14%, rgba(221,214,254,.15), transparent 30%) !important;
    opacity: .74 !important;
  }

  .translucent-tool-page .glass-card::after {
    opacity: .22 !important;
    filter: blur(18px);
  }

  .translucent-tool-page[data-tool-page="sec"] main div.relative[class*="p-"],
  .translucent-tool-page[data-tool-page="sec"] main div.relative[class*="overflow-hidden"] {
    overflow: hidden;
    border: 1px solid var(--tool-glass-border) !important;
    border-radius: 28px !important;
    background: var(--tool-glass-surface) !important;
    box-shadow: var(--tool-glass-shadow) !important;
    backdrop-filter: blur(34px) saturate(1.32) !important;
    -webkit-backdrop-filter: blur(34px) saturate(1.32) !important;
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
    background-color: rgba(178,205,222,.065) !important;
    background-image: var(--tool-glass-surface-soft) !important;
    border-color: rgba(255,255,255,.26) !important;
    box-shadow: 0 18px 48px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.28), inset 0 0 0 1px rgba(255,255,255,.075) !important;
    backdrop-filter: blur(28px) saturate(1.24) brightness(1.035) !important;
    -webkit-backdrop-filter: blur(28px) saturate(1.24) brightness(1.035) !important;
  }

  .translucent-tool-page main input,
  .translucent-tool-page main textarea,
  .translucent-tool-page main select {
    color: rgba(255,255,255,.97) !important;
    border-color: rgba(255,255,255,.30) !important;
    background: linear-gradient(145deg, rgba(255,255,255,.105), rgba(176,205,225,.065)) !important;
    box-shadow: 0 12px 34px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.27), inset 0 0 0 1px rgba(255,255,255,.075) !important;
    backdrop-filter: blur(24px) saturate(1.22) !important;
    -webkit-backdrop-filter: blur(24px) saturate(1.22) !important;
  }

  .translucent-tool-page main select option {
    color: white;
    background: #17212d;
  }

  .translucent-tool-page main input::placeholder,
  .translucent-tool-page main textarea::placeholder {
    color: rgba(224,242,254,.58) !important;
  }

  .translucent-tool-page main input:focus,
  .translucent-tool-page main textarea:focus,
  .translucent-tool-page main select:focus {
    border-color: rgba(224,242,254,.62) !important;
    box-shadow: 0 0 0 3px rgba(186,230,253,.10), 0 18px 44px rgba(0,0,0,.23), inset 0 1px 0 rgba(255,255,255,.34) !important;
  }

  .translucent-tool-page main div[class*="rounded-[27px]"][class*="border"],
  .translucent-tool-page main div[class*="rounded-[26px]"][class*="border"],
  .translucent-tool-page main div[class*="rounded-[25px]"][class*="border"],
  .translucent-tool-page main div[class*="rounded-[23px]"][class*="border"] {
    background-color: rgba(176,204,222,.06) !important;
    background-image: var(--tool-glass-surface-soft) !important;
    border-color: rgba(255,255,255,.22) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.26), inset 0 0 0 1px rgba(255,255,255,.07) !important;
  }

  .translucent-tool-page main [class*="text-cyan-100/"],
  .translucent-tool-page main [class*="text-cyan-50/"] {
    color: rgba(232,247,255,.82) !important;
  }

  .translucent-tool-page main [class*="bg-rose-"],
  .translucent-tool-page main [class*="bg-amber-"],
  .translucent-tool-page main [class*="bg-emerald-"],
  .translucent-tool-page main [class*="bg-violet-"],
  .translucent-tool-page main [class*="bg-cyan-"] {
    backdrop-filter: blur(22px) saturate(1.22);
    -webkit-backdrop-filter: blur(22px) saturate(1.22);
  }

  .translucent-tool-page[data-tool-page="sec"] aside[role="dialog"] {
    border-color: rgba(255,255,255,.34) !important;
    background: linear-gradient(145deg, rgba(255,255,255,.14), rgba(122,154,178,.14)) !important;
    box-shadow: -30px 0 90px rgba(0,0,0,.42), inset 1px 0 0 rgba(255,255,255,.30) !important;
    backdrop-filter: blur(38px) saturate(1.34) !important;
    -webkit-backdrop-filter: blur(38px) saturate(1.34) !important;
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
  return <TranslucentToolPage page="entities"><EntitiesPage /></TranslucentToolPage>;
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

function CompanyLibraryRoute() {
  return <TranslucentToolPage page="company-library"><DataProfiles /></TranslucentToolPage>;
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
      <Route path="/competitors" component={CompetitorsRoute} />
      <Route path="/federal-agencies" component={FederalAgenciesRoute} />
      <Route path="/state-agencies" component={StateAgenciesRoute} />
      <Route path="/data-profiles" component={CompanyLibraryRoute} />
      <Route path="/sec-filings" component={SecFilingsRoute} />
      <Route path="/leadership-map" component={LeadershipMapRoute} />
      <Route path="/dba-intelligence" component={DbaIntelligence} />
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
