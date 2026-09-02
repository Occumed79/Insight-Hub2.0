import React from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmployerWorkflowProvider } from "@/components/insight/EmployerWorkflowContext";

const NotFound = React.lazy(() => import("@/pages/not-found"));
const Landing = React.lazy(() => import("@/pages/landing"));
const DataVisualization = React.lazy(() => import("@/pages/data-visualization"));
const QuantifiableData = React.lazy(() => import("@/pages/quantifiable-data"));
const GeographicData = React.lazy(() => import("@/pages/geographic-data"));
const LocationOverlap = React.lazy(() => import("@/pages/location-overlap"));
const LegacyJobIntelligence = React.lazy(() => import("@/pages/job-intelligence"));
const HiringIntelligence = React.lazy(() => import("@/pages/hiring-intelligence"));
const LeadershipMap = React.lazy(() => import("@/pages/leadership-map"));
const CorporateStructure = React.lazy(() => import("@/pages/corporate-structure"));
const EmployerWorkflow = React.lazy(() => import("@/pages/employer-workflow"));
const EmployerIntelligence = React.lazy(() => import("@/pages/employer-intelligence"));
const EntityResolution = React.lazy(() => import("@/pages/entity-resolution"));
const OccupationalExposure = React.lazy(() => import("@/pages/occupational-exposure"));
const CorporateSignals = React.lazy(() => import("@/pages/company-live-intelligence"));
const SecFilings = React.lazy(() => import("@/pages/sec-filings"));
const WorkersCompCoverage = React.lazy(() => import("@/pages/workers-comp-coverage"));
const DbaIntelligence = React.lazy(() => import("@/pages/dba-intelligence"));
const SourceGovernance = React.lazy(() => import("@/pages/source-governance"));
const WarCostsIntelligence = React.lazy(() => import("@/pages/war-costs-intelligence"));
const WarCostsSiteEvidence = React.lazy(() => import("@/pages/war-costs-site-evidence"));
const ReviewerInjuriesMedicalPage = React.lazy(() => import("@/pages/reviewer-injuries-medical"));
const ReviewerJobIntelligencePage = React.lazy(() => import("@/pages/job-intelligence-v2"));
const ReviewerAorFactorsPage = React.lazy(() => import("@/pages/reviewer-aor-factors-live"));
const ReviewerDrugCheckerPage = React.lazy(() => import("@/pages/reviewer-drug-checker"));
const ReviewerClinicalCalculatorsPage = React.lazy(() => import("@/pages/reviewer-clinical-calculators"));
const ReviewerStandardsIntelligencePage = React.lazy(() => import("@/pages/reviewer-standards-intelligence"));
const EntitiesPage = React.lazy(() => import("@/pages/entities-contextual").then((module) => ({ default: module.ContextualEntitiesPage })));
const CompetitorsPage = React.lazy(() => import("@/pages/core-intelligence").then((module) => ({ default: module.CompetitorsPage })));
const FederalAgenciesPage = React.lazy(() => import("@/pages/federal-agencies-v2"));
const StateAgenciesPage = React.lazy(() => import("@/pages/core-intelligence").then((module) => ({ default: module.StateAgenciesPage })));
const FecFilingsPage = React.lazy(() => import("@/pages/entity-public-intelligence").then((module) => ({ default: module.EntityFecFilingsPage })));
const FederalAwardsPage = React.lazy(() => import("@/pages/entity-public-intelligence").then((module) => ({ default: module.EntityFederalAwardsPage })));
const LegalReferencesPage = React.lazy(() => import("@/pages/entity-public-intelligence").then((module) => ({ default: module.EntityLegalReferencesPage })));
const OnetMasterTool = React.lazy(() => import("@/pages/onet-master-tool"));
const OccupationalDataExplorer = React.lazy(() => import("@/pages/occupational-data-explorer"));
const IndustryImpactCalculator = React.lazy(() => import("@/pages/industry-impact-calculator-v2"));
const OccupationalCalculators = React.lazy(() => import("@/pages/occupational-calculators-v2"));

const queryClient = new QueryClient();

function RouteLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#020817] px-6 text-white">
      <div role="status" aria-live="polite" className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-cyan-100/18 border-t-cyan-100/80" />
        <p className="mt-4 text-sm font-semibold text-cyan-50/66">Loading workspace…</p>
      </div>
    </main>
  );
}

function TranslucentToolPage({ page, children }: { page: string; children: React.ReactNode }) {
  return <div className="translucent-tool-page" data-tool-page={page}>{children}</div>;
}

function EntitiesRoute() { return <EntitiesPage defaultTab="prospects" />; }
function ClientsRoute() { return <EntitiesPage defaultTab="clients" />; }
function CompetitorsRoute() { return <TranslucentToolPage page="competitors"><CompetitorsPage /></TranslucentToolPage>; }
function FederalAgenciesRoute() { return <TranslucentToolPage page="federal-agencies"><FederalAgenciesPage /></TranslucentToolPage>; }
function StateAgenciesRoute() { return <TranslucentToolPage page="state-agencies"><StateAgenciesPage /></TranslucentToolPage>; }
function DbaRoute() { return <div className="dba-hub-route"><DbaIntelligence /></div>; }
function SecFilingsRoute() { return <TranslucentToolPage page="sec"><SecFilings /></TranslucentToolPage>; }
function LeadershipMapRoute() { return <TranslucentToolPage page="organizational-chart"><LeadershipMap /></TranslucentToolPage>; }
function FecFilingsRoute() { return <TranslucentToolPage page="fec"><FecFilingsPage /></TranslucentToolPage>; }
function OnetMasterToolRoute() { return <TranslucentToolPage page="onet-master"><OnetMasterTool /></TranslucentToolPage>; }
function OccupationalDataExplorerRoute() { return <TranslucentToolPage page="occupational-data-explorer"><OccupationalDataExplorer /></TranslucentToolPage>; }
function IndustryImpactCalculatorRoute() { return <TranslucentToolPage page="industry-impact-calculator"><IndustryImpactCalculator /></TranslucentToolPage>; }
function OccupationalCalculatorsRoute() { return <TranslucentToolPage page="occupational-calculators"><OccupationalCalculators /></TranslucentToolPage>; }
function FederalAwardsRoute() { return <TranslucentToolPage page="federal-awards"><FederalAwardsPage /></TranslucentToolPage>; }
function LegalReferencesRoute() { return <TranslucentToolPage page="legal"><LegalReferencesPage /></TranslucentToolPage>; }
function WarCostsRoute() { return <TranslucentToolPage page="war-costs"><WarCostsIntelligence /></TranslucentToolPage>; }
function WarCostsSiteEvidenceRoute() { return <TranslucentToolPage page="war-costs-site-evidence"><WarCostsSiteEvidence /></TranslucentToolPage>; }

function StandaloneMapPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="standalone-map-page">
      <Link href="/" aria-label="Back to the Insight Hub landing page" className="fixed left-4 top-4 z-[850] inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-100/18 bg-[#06101d]/78 px-4 text-xs font-bold text-cyan-50/76 shadow-[0_16px_48px_rgba(0,0,0,.42),0_0_28px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-2xl transition hover:border-cyan-200/34 hover:bg-cyan-300/[0.12] hover:text-white">
        <ArrowLeft size={15} />Back
      </Link>
      {children}
    </div>
  );
}

function GlobalLocationsRoute() { return <StandaloneMapPage><GeographicData /></StandaloneMapPage>; }
function GlobalLocationOverlapRoute() { return <StandaloneMapPage><LocationOverlap /></StandaloneMapPage>; }

function Router() {
  return (
    <React.Suspense fallback={<RouteLoading />}>
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

        <Route path="/injuries-medical-conditions" component={ReviewerInjuriesMedicalPage} />
        <Route path="/job-intelligence" component={ReviewerJobIntelligencePage} />
        <Route path="/aor-factors" component={ReviewerAorFactorsPage} />
        <Route path="/aor-risk-intelligence" component={ReviewerAorFactorsPage} />
        <Route path="/drug-checker" component={ReviewerDrugCheckerPage} />
        <Route path="/clinical-calculators" component={ReviewerClinicalCalculatorsPage} />
        <Route path="/standards-intelligence" component={ReviewerStandardsIntelligencePage} />

        <Route path="/industry-injury-benchmarks" component={IndustryImpactCalculatorRoute} />
        <Route path="/occupational-demands" component={ReviewerJobIntelligencePage} />
        <Route path="/onet-master-tool" component={OnetMasterToolRoute} />
        <Route path="/occupational-data-explorer" component={OccupationalDataExplorerRoute} />
        <Route path="/industry-impact-calculator" component={IndustryImpactCalculatorRoute} />
        <Route path="/occupational-calculators" component={OccupationalCalculatorsRoute} />
        <Route path="/war-costs-intelligence" component={WarCostsRoute} />
        <Route path="/war-costs" component={WarCostsRoute} />
        <Route path="/war-costs-site-evidence" component={WarCostsSiteEvidenceRoute} />
        <Route path="/federal-awards" component={FederalAwardsRoute} />
        <Route path="/public-legal-references" component={LegalReferencesRoute} />

        <Route path="/geographic-footprint" component={GlobalLocationsRoute} />
        <Route path="/geographic-data" component={GlobalLocationsRoute} />
        <Route path="/location-overlap" component={GlobalLocationOverlapRoute} />
        <Route path="/geographic-overlap" component={GlobalLocationOverlapRoute} />

        <Route path="/data-visualization" component={DataVisualization} />
        <Route path="/quantifiable-data" component={QuantifiableData} />
        <Route path="/hiring-intelligence" component={HiringIntelligence} />
        <Route path="/corporate-structure" component={CorporateStructure} />
        <Route path="/legacy-job-intelligence" component={LegacyJobIntelligence} />
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
    </React.Suspense>
  );
}

function App() {
  React.useEffect(() => { document.documentElement.classList.add("dark"); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <EmployerWorkflowProvider><Router /></EmployerWorkflowProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;