import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import DataProfiles from "@/pages/data-profiles";
import QuantifiableData from "@/pages/quantifiable-data";
import GeographicData from "@/pages/geographic-data";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/data-profiles" component={DataProfiles} />
      <Route path="/quantifiable-data" component={QuantifiableData} />
      <Route path="/geographic-data" component={GeographicData} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Force dark mode on body
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
