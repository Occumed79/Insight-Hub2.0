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
const HiringIntelligence = React.lazy(() => import("@/pages/hiring-intelligence"));
const CorporateStructure = React.lazy(() => import("@/pages/corporate-structure"));
const EmployerWorkflow = React.lazy(() => import("@/pages/employer-workflow"));
const EmployerIntelligence = React.lazy(() => import("@/pages/employer-intelligence"));
const EntityResolution = React.lazy(() => import("@/pages/entity-resolution"));
const OccupationalExposure = React.lazy(() => import("@/pages/occupational-exposure"));
const CorporateSignals = React.lazy(() => import("@/pages/company-live-intelligence"));
const WorkersCompCoverage = React.lazy(() => import("@/pages/workers-comp-coverage"));
const SourceGovernance = React.lazy(() => import("@/pages/source-governance"));
const ReviewerInjuriesMedicalPage = React.lazy(() => import("@/pages/reviewer-injuries-medical"));
const ReviewerAorFactorsPage = React.lazy(() => import("@/pages/reviewer-aor-factors-experience"));
const EntitiesPage = React.lazy(() => import("@/pages/entities-contextual").then((module) => ({ default: module.ContextualEntitiesPage })));
const CompetitorsPage = React.lazy(() => import("@/pages/core-intelligence").then((module) => ({ default: module.CompetitorsPage })));
const FecFilingsPage = React.lazy(() => import("@/pages/entity-public-intelligence").then((module) => ({ default: module.EntityFecFilingsPage })));
const OnetMasterTool = React.lazy(() => import("@/pages/onet-master-tool"));
const OccupationalDataExplorer = React.lazy(() => import("@/pages/occupational-data-explorer"));

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

function EntitiesRoute() { return <EntitiesPage defaultTab="prospects" />; }
function ClientsRoute() { return <EntitiesPage defaultTab="clients" />; }
function CompetitorsRoute() { return <React.Suspense fallback={<CompetitorsLoading />}><CompetitorsPage /></React.Suspense>; }

// Protected tools mount without alteration; their own components retain the
// reviewed presentation while App contributes no visible workspace system.
function OnetMasterToolRoute() { return <OnetMasterTool />; }
function OccupationalDataExplorerRoute() { return <OccupationalDataExplorer />; }

function FecFilingsRoute() { return <FecFilingsPage />; }
function InjuriesMedicalRoute() { return <ReviewerInjuriesMedicalPage />; }
function AorRoute() { return <ReviewerAorFactorsPage />; }

function StandaloneMapPage({ children }: { children: React.ReactNode }) {
  return (
      <div className="standalone-map-page min-h-screen bg-[#030b12] text-white">
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
        <Route path="/fec-filings" component={FecFilingsRoute} />
        <Route path="/injuries-medical-conditions" component={InjuriesMedicalRoute} />
        <Route path="/aor-factors" component={AorRoute} />
        <Route path="/aor-risk-intelligence" component={AorRoute} />
        <Route path="/onet-master-tool" component={OnetMasterToolRoute} />
        <Route path="/occupational-data-explorer" component={OccupationalDataExplorerRoute} />
        <Route path="/geographic-footprint" component={GlobalLocationsRoute} />
        <Route path="/geographic-data" component={GlobalLocationsRoute} />
        <Route path="/location-overlap" component={GlobalLocationOverlapRoute} />
        <Route path="/geographic-overlap" component={GlobalLocationOverlapRoute} />
        <Route path="/data-visualization" component={DataVisualization} />
        <Route path="/quantifiable-data" component={QuantifiableData} />
        <Route path="/hiring-intelligence" component={HiringIntelligence} />
        <Route path="/corporate-structure" component={CorporateStructure} />
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
