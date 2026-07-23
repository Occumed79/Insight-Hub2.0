import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmployerWorkflowProvider } from "@/components/insight/EmployerWorkflowContext";
import { EmployerWorkflowRail } from "@/components/insight/EmployerWorkflowRail";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import DataProfiles from "@/pages/data-profiles";
import DataVisualization from "@/pages/data-visualization";
import QuantifiableData from "@/pages/quantifiable-data";
import GeographicData from "@/pages/geographic-data";
import JobIntelligence from "@/pages/job-intelligence";
import HiringIntelligence from "@/pages/hiring-intelligence";
import LeadershipMap from "@/pages/leadership-map";
import EmployerWorkflow from "@/pages/employer-workflow";
import EmployerIntelligence from "@/pages/employer-intelligence";
import EntityResolution from "@/pages/entity-resolution";
import OccupationalExposure from "@/pages/occupational-exposure";
import CompanyLiveIntelligence from "@/pages/company-live-intelligence";
import SecFilings from "@/pages/sec-filings";
import WorkersCompCoverage from "@/pages/workers-comp-coverage";
import DbaIntelligence from "@/pages/dba-intelligence";
import SourceGovernance from "@/pages/source-governance";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/data-profiles" component={DataProfiles} />
      <Route path="/data-visualization" component={DataVisualization} />
      <Route path="/quantifiable-data" component={QuantifiableData} />
      <Route path="/geographic-footprint" component={GeographicData} />
      <Route path="/geographic-data" component={GeographicData} />
      <Route path="/hiring-intelligence" component={HiringIntelligence} />
      <Route path="/leadership-map" component={LeadershipMap} />
      <Route path="/job-intelligence" component={JobIntelligence} />
      <Route path="/employer-workflow" component={EmployerWorkflow} />
      <Route path="/employer-intelligence" component={EmployerIntelligence} />
      <Route path="/entity-resolution" component={EntityResolution} />
      <Route path="/occupational-exposure" component={OccupationalExposure} />
      <Route path="/company-live-intelligence" component={CompanyLiveIntelligence} />
      <Route path="/sec-filings" component={SecFilings} />
      <Route path="/workers-comp-coverage" component={WorkersCompCoverage} />
      <Route path="/dba-intelligence" component={DbaIntelligence} />
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
            <EmployerWorkflowRail />
          </EmployerWorkflowProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
