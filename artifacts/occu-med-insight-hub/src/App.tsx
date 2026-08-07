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

function TranslucentToolPage({
  page,
  children,
}: {
  page: string;
  children: React.ReactNode;
}) {
  return (
    <div className="translucent-tool-page" data-tool-page={page}>
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
  return (
    <TranslucentToolPage page="competitors">
      <CompetitorsPage />
    </TranslucentToolPage>
  );
}

function FederalAgenciesRoute() {
  return (
    <TranslucentToolPage page="federal-agencies">
      <FederalAgenciesPage />
    </TranslucentToolPage>
  );
}

function StateAgenciesRoute() {
  return (
    <TranslucentToolPage page="state-agencies">
      <StateAgenciesPage />
    </TranslucentToolPage>
  );
}

function DbaRoute() {
  return (
    <div className="dba-hub-route">
      <DbaIntelligence />
    </div>
  );
}

function SecFilingsRoute() {
  return (
    <TranslucentToolPage page="sec">
      <SecFilings />
    </TranslucentToolPage>
  );
}

function LeadershipMapRoute() {
  return (
    <TranslucentToolPage page="organizational-chart">
      <LeadershipMap />
    </TranslucentToolPage>
  );
}

function FecFilingsRoute() {
  return (
    <TranslucentToolPage page="fec">
      <FecFilingsPage />
    </TranslucentToolPage>
  );
}

function IndustryBenchmarksRoute() {
  return (
    <TranslucentToolPage page="bls">
      <IndustryBenchmarksPage />
    </TranslucentToolPage>
  );
}

function OccupationalDemandsRoute() {
  return (
    <TranslucentToolPage page="onet">
      <OccupationalDemandsPage />
    </TranslucentToolPage>
  );
}

function FederalAwardsRoute() {
  return (
    <TranslucentToolPage page="federal-awards">
      <FederalAwardsPage />
    </TranslucentToolPage>
  );
}

function LegalReferencesRoute() {
  return (
    <TranslucentToolPage page="legal">
      <LegalReferencesPage />
    </TranslucentToolPage>
  );
}

function AorRiskRoute() {
  return (
    <TranslucentToolPage page="aor">
      <AorRiskIntelligencePage />
    </TranslucentToolPage>
  );
}

function StandaloneMapPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="standalone-map-page">
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
  return (
    <StandaloneMapPage>
      <GeographicData />
    </StandaloneMapPage>
  );
}

function GlobalLocationOverlapRoute() {
  return (
    <StandaloneMapPage>
      <LocationOverlap />
    </StandaloneMapPage>
  );
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
