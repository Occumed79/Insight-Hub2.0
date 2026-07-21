import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import DataProfiles from "@/pages/data-profiles";
import DataVisualization from "@/pages/data-visualization";
import QuantifiableData from "@/pages/quantifiable-data";
import GeographicData from "@/pages/geographic-data";
import JobIntelligence from "@/pages/job-intelligence";
import EmployerIntelligence from "@/pages/employer-intelligence";
import EntityResolution from "@/pages/entity-resolution";
import OccupationalExposure from "@/pages/occupational-exposure";
import CompanyLiveIntelligence from "@/pages/company-live-intelligence";
import WorkersCompCoverage from "@/pages/workers-comp-coverage";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/data-profiles" component={DataProfiles} />
      <Route path="/data-visualization" component={DataVisualization} />
      <Route path="/quantifiable-data" component={QuantifiableData} />
      <Route path="/geographic-data" component={GeographicData} />
      <Route path="/job-intelligence" component={JobIntelligence} />
      <Route path="/employer-intelligence" component={EmployerIntelligence} />
      <Route path="/entity-resolution" component={EntityResolution} />
      <Route path="/occupational-exposure" component={OccupationalExposure} />
      <Route path="/company-live-intelligence" component={CompanyLiveIntelligence} />
      <Route path="/workers-comp-coverage" component={WorkersCompCoverage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Keep the application locked in dark mode.
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
