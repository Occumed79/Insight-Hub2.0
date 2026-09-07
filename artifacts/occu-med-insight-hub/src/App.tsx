import React from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmployerWorkflowProvider } from "@/components/insight/EmployerWorkflowContext";
import { CinematicStage, type CinematicVariant } from "@/components/insight/CinematicStage";

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
const WarCostsMap = React.lazy(() => import("@/pages/war-costs-map"));
const WarCostsTools = React.lazy(() => import("@/pages/war-costs-tools"));
const WarCostsSpecialTools = React.lazy(() => import("@/pages/war-costs-special-tools"));
const WarCostsVisualizations = React.lazy(() => import("@/pages/war-costs-visualizations"));
const WarCostsAccountability = React.lazy(() => import("@/pages/war-costs-accountability"));
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
const StateAgenciesPage = React.lazy(() => import("@/pages/state-agencies-v2"));
const FecFilingsPage = React.lazy(() => import("@/pages/entity-public-intelligence").then((module) => ({ default: module.EntityFecFilingsPage })));
const FederalAwardsPage = React.lazy(() => import("@/pages/federal-awards-v2"));
const LegalReferencesPage = React.lazy(() => import("@/pages/legal-injury-intelligence-v2"));
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

function CompetitorsLoading() {
  return (
    <main className="min-h-screen bg-[#020817] px-5 py-8 text-white lg:ml-[210px] lg:px-10">
      <h1 className="text-4xl font-black tracking-[-0.04em]">Competitors</h1>
      <p className="mt-3 text-sm text-cyan-100/58">Loading competitor intelligence…</p>
    </main>
  );
}

function CinematicToolPage({ page, variant, children }: { page: string; variant: CinematicVariant; children: React.ReactNode }) {
  return (
    <CinematicStage page={page} variant={variant}>
      <div className="translucent-tool-page" data-tool-page={page}>{children}</div>
    </CinematicStage>
  );
}

function CinematicDirectPage({ page, variant, children }: { page: string; variant: CinematicVariant; children: React.ReactNode }) {
  return <CinematicStage page={page} variant={variant}>{children}</CinematicStage>;
}

function EntitiesRoute() { return <CinematicDirectPage page="entities" variant="world"><EntitiesPage defaultTab="prospects" /></CinematicDirectPage>; }
function ClientsRoute() { return <CinematicDirectPage page="clients" variant="world"><EntitiesPage defaultTab="clients" /></CinematicDirectPage>; }
function CompetitorsRoute() { return <CinematicToolPage page="competitors" variant="world"><React.Suspense fallback={<CompetitorsLoading />}><CompetitorsPage /></React.Suspense></CinematicToolPage>; }
function FederalAgenciesRoute() { return <CinematicToolPage page="federal-agencies" variant="climate"><FederalAgenciesPage /></CinematicToolPage>; }
function StateAgenciesRoute() { return <CinematicToolPage page="state-agencies" variant="climate"><StateAgenciesPage /></CinematicToolPage>; }
function DbaRoute() { return <CinematicDirectPage page="dba" variant="nasdaq"><div className="dba-hub-route"><DbaIntelligence /></div></CinematicDirectPage>; }
function SecFilingsRoute() { return <CinematicToolPage page="sec" variant="nasdaq"><SecFilings /></CinematicToolPage>; }
function LeadershipMapRoute() { return <CinematicToolPage page="organizational-chart" variant="world"><LeadershipMap /></CinematicToolPage>; }
function FecFilingsRoute() { return <CinematicToolPage page="fec" variant="nasdaq"><FecFilingsPage /></CinematicToolPage>; }
function OnetMasterToolRoute() { return <CinematicToolPage page="onet-master" variant="world"><OnetMasterTool /></CinematicToolPage>; }
function OccupationalDataExplorerRoute() { return <CinematicToolPage page="occupational-data-explorer" variant="climate"><OccupationalDataExplorer /></CinematicToolPage>; }
function IndustryImpactCalculatorRoute() { return <CinematicToolPage page="industry-impact-calculator" variant="zero"><IndustryImpactCalculator /></CinematicToolPage>; }
function OccupationalCalculatorsRoute() { return <CinematicToolPage page="occupational-calculators" variant="zero"><OccupationalCalculators /></CinematicToolPage>; }
function FederalAwardsRoute() { return <CinematicToolPage page="federal-awards" variant="nasdaq"><FederalAwardsPage /></CinematicToolPage>; }
function LegalReferencesRoute() { return <CinematicToolPage page="legal" variant="nasdaq"><LegalReferencesPage /></CinematicToolPage>; }
function WarCostsRoute() { return <CinematicToolPage page="war-costs" variant="corridors"><WarCostsIntelligence /></CinematicToolPage>; }
function WarCostsMapRoute() { return <CinematicToolPage page="war-costs-map" variant="corridors"><WarCostsMap /></CinematicToolPage>; }
function WarCostsToolsRoute() { return <CinematicToolPage page="war-costs-tools" variant="zero"><WarCostsTools /></CinematicToolPage>; }
function WarCostsSpecialToolsRoute() { return <CinematicToolPage page="war-costs-special" variant="zero"><WarCostsSpecialTools /></CinematicToolPage>; }
function WarCostsVisualizationsRoute() { return <CinematicToolPage page="war-costs-visualizations" variant="nasdaq"><WarCostsVisualizations /></CinematicToolPage>; }
function WarCostsAccountabilityRoute() { return <CinematicToolPage page="war-costs-accountability" variant="nasdaq"><WarCostsAccountability /></CinematicToolPage>; }
function WarCostsSiteEvidenceRoute() { return <CinematicToolPage page="war-costs-evidence" variant="nasdaq"><WarCostsSiteEvidence /></CinematicToolPage>; }
function InjuriesMedicalRoute() { return <CinematicDirectPage page="injuries-medical" variant="anima"><ReviewerInjuriesMedicalPage /></CinematicDirectPage>; }
function JobIntelligenceRoute() { return <CinematicDirectPage page="job-intelligence" variant="world"><ReviewerJobIntelligencePage /></CinematicDirectPage>; }
function AorRoute() { return <CinematicDirectPage page="aor" variant="corridors"><ReviewerAorFactorsPage /></CinematicDirectPage>; }
function DrugCheckerRoute() { return <CinematicDirectPage page="drug-checker" variant="anima"><ReviewerDrugCheckerPage /></CinematicDirectPage>; }
function ClinicalCalculatorsRoute() { return <CinematicDirectPage page="clinical-calculators" variant="zero"><ReviewerClinicalCalculatorsPage /></CinematicDirectPage>; }
function StandardsRoute() { return <CinematicDirectPage page="standards" variant="nasdaq"><ReviewerStandardsIntelligencePage /></CinematicDirectPage>; }

function StandaloneMapPage({ children }: { children: React.ReactNode }) {
  return (
    <CinematicStage page="standalone-map" variant="corridors">
      <div className="standalone-map-page">
        <Link href="/" aria-label="Back to the Insight Hub landing page" className="fixed left-4 top-4 z-[850] inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-100/18 bg-[#06101d]/78 px-4 text-xs font-bold text-cyan-50/76 shadow-[0_16px_48px_rgba(0,0,0,.42),0_0_28px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-2xl transition hover:border-cyan-200/34 hover:bg-cyan-300/[0.12] hover:text-white">
          <ArrowLeft size={15} />Back
        </Link>
        {children}
      </div>
    </CinematicStage>
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
        <Route path="/injuries-medical-conditions" component={InjuriesMedicalRoute} />
        <Route path="/job-intelligence" component={JobIntelligenceRoute} />
        <Route path="/aor-factors" component={AorRoute} />
        <Route path="/aor-risk-intelligence" component={AorRoute} />
        <Route path="/drug-checker" component={DrugCheckerRoute} />
        <Route path="/clinical-calculators" component={ClinicalCalculatorsRoute} />
        <Route path="/standards-intelligence" component={StandardsRoute} />
        <Route path="/industry-injury-benchmarks" component={IndustryImpactCalculatorRoute} />
        <Route path="/occupational-demands" component={JobIntelligenceRoute} />
        <Route path="/onet-master-tool" component={OnetMasterToolRoute} />
        <Route path="/occupational-data-explorer" component={OccupationalDataExplorerRoute} />
        <Route path="/industry-impact-calculator" component={IndustryImpactCalculatorRoute} />
        <Route path="/occupational-calculators" component={OccupationalCalculatorsRoute} />
        <Route path="/war-costs-intelligence" component={WarCostsRoute} />
        <Route path="/war-costs" component={WarCostsRoute} />
        <Route path="/war-costs-map" component={WarCostsMapRoute} />
        <Route path="/war-costs-tools" component={WarCostsToolsRoute} />
        <Route path="/war-costs-special-tools" component={WarCostsSpecialToolsRoute} />
        <Route path="/war-costs-visualizations" component={WarCostsVisualizationsRoute} />
        <Route path="/war-costs-accountability" component={WarCostsAccountabilityRoute} />
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