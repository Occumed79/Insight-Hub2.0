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
import {
  AorRiskIntelligencePage,
  FecFilingsPage,
  FederalAwardsPage,
  IndustryBenchmarksPage,
  LegalReferencesPage,
  OccupationalDemandsPage,
} from "@/pages/standalone-public-tools";

const queryClient = new QueryClient();

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
      <Route path="/data-profiles" component={DataProfiles} />
      <Route path="/sec-filings" component={SecFilings} />
      <Route path="/leadership-map" component={LeadershipMap} />
      <Route path="/dba-intelligence" component={DbaIntelligence} />
      <Route path="/fec-filings" component={FecFilingsPage} />
      <Route path="/industry-injury-benchmarks" component={IndustryBenchmarksPage} />
      <Route path="/occupational-demands" component={OccupationalDemandsPage} />
      <Route path="/federal-awards" component={FederalAwardsPage} />
      <Route path="/public-legal-references" component={LegalReferencesPage} />
      <Route path="/aor-risk-intelligence" component={AorRiskIntelligencePage} />

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
