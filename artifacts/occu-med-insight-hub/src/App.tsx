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
  FecFilingsPage,
  FederalAwardsPage,
  IndustryBenchmarksPage,
  LegalReferencesPage,
  OccupationalDemandsPage,
} from "@/pages/standalone-public-tools";

const queryClient = new QueryClient();

const translucentToolCss = String.raw`
  .translucent-tool-page {
    --tool-glass-border: rgba(224, 247, 255, 0.28);
    --tool-glass-inner-border: rgba(255, 255, 255, 0.12);
    --tool-glass-surface: linear-gradient(135deg, rgba(4,12,23,.94), rgba(7,18,32,.90) 44%, rgba(8,25,40,.88) 72%, rgba(22,18,48,.86));
    --tool-glass-surface-soft: linear-gradient(135deg, rgba(3,10,20,.92), rgba(7,18,31,.88) 48%, rgba(10,27,42,.84));
    --tool-glass-shadow: 0 28px 82px rgba(0,0,0,.42), 0 0 34px rgba(34,211,238,.07), inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px var(--tool-glass-inner-border);
  }

  .translucent-tool-page .glass-card {
    border: 1px solid var(--tool-glass-border) !important;
    background: var(--tool-glass-surface) !important;
    box-shadow: var(--tool-glass-shadow) !important;
    backdrop-filter: blur(28px) saturate(1.16) !important;
    -webkit-backdrop-filter: blur(28px) saturate(1.16) !important;
  }

  .translucent-tool-page .glass-card::before {
    background: linear-gradient(122deg, rgba(255,255,255,.16), rgba(255,255,255,.055) 15%, transparent 34%), radial-gradient(circle at 12% 0%, rgba(165,243,252,.11), transparent 34%), radial-gradient(circle at 100% 12%, rgba(196,181,253,.09), transparent 30%) !important;
    opacity: .52 !important;
  }

  .translucent-tool-page .glass-card::after { opacity: .14 !important; }

  .translucent-tool-page[data-tool-page="sec"] main div.relative[class*="p-"],
  .translucent-tool-page[data-tool-page="sec"] main div.relative[class*="overflow-hidden"] {
    overflow: hidden;
    border: 1px solid var(--tool-glass-border) !important;
    border-radius: 28px !important;
    background: var(--tool-glass-surface) !important;
    box-shadow: var(--tool-glass-shadow) !important;
    backdrop-filter: blur(28px) saturate(1.16) !important;
    -webkit-backdrop-filter: blur(28px) saturate(1.16) !important;
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
    background-color: rgba(3,10,20,.90) !important;
    background-image: var(--tool-glass-surface-soft) !important;
    border-color: rgba(224,247,255,.20) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.13), inset 0 0 0 1px rgba(255,255,255,.06) !important;
    backdrop-filter: blur(22px) saturate(1.12) !important;
    -webkit-backdrop-filter: blur(22px) saturate(1.12) !important;
  }

  .translucent-tool-page main input,
  .translucent-tool-page main textarea,
  .translucent-tool-page main select {
    color: rgba(255,255,255,.96) !important;
    border-color: rgba(207,250,254,.24) !important;
    background: linear-gradient(135deg, rgba(2,8,16,.94), rgba(6,17,29,.90)) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.05), 0 10px 30px rgba(0,0,0,.24) !important;
    backdrop-filter: blur(18px) saturate(1.08) !important;
    -webkit-backdrop-filter: blur(18px) saturate(1.08) !important;
  }

  .translucent-tool-page main input::placeholder,
  .translucent-tool-page main textarea::placeholder {
    color: rgba(207,250,254,.48) !important;
  }

  .translucent-tool-page main input:focus,
  .translucent-tool-page main textarea:focus,
  .translucent-tool-page main select:focus {
    border-color: rgba(165,243,252,.48) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px rgba(255,255,255,.07), 0 0 0 3px rgba(34,211,238,.08), 0 16px 36px rgba(0,0,0,.28) !important;
  }

  .translucent-tool-page main div[class*="rounded-[27px]"][class*="border"],
  .translucent-tool-page main div[class*="rounded-[26px]"][class*="border"],
  .translucent-tool-page main div[class*="rounded-[25px]"][class*="border"],
  .translucent-tool-page main div[class*="rounded-[23px]"][class*="border"] {
    background-color: rgba(3,10,20,.88) !important;
    background-image: var(--tool-glass-surface-soft) !important;
    border-color: rgba(255,255,255,.12) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.05) !important;
  }

  .translucent-tool-page main [class*="text-cyan-100/"],
  .translucent-tool-page main [class*="text-cyan-50/"] {
    color: rgba(224,247,255,.78) !important;
  }

  .translucent-tool-page main [class*="bg-rose-"],
  .translucent-tool-page main [class*="bg-amber-"],
  .translucent-tool-page main [class*="bg-emerald-"],
  .translucent-tool-page main [class*="bg-violet-"],
  .translucent-tool-page main [class*="bg-cyan-"] {
    backdrop-filter: blur(18px) saturate(1.12);
    -webkit-backdrop-filter: blur(18px) saturate(1.12);
  }

  .translucent-tool-page[data-tool-page="company-library"] .glass-card {
    background: linear-gradient(135deg, rgba(4,12,23,.96), rgba(7,20,34,.92) 42%, rgba(6,31,38,.90) 68%, rgba(24,20,50,.88)) !important;
  }

  .translucent-tool-page[data-tool-page="sec"] aside[role="dialog"] {
    border-color: rgba(224,247,255,.26) !important;
    background: linear-gradient(145deg, rgba(7,18,32,.96), rgba(8,20,34,.94) 48%, rgba(24,20,54,.92)) !important;
    box-shadow: -30px 0 90px rgba(0,0,0,.52), inset 1px 0 0 rgba(255,255,255,.13) !important;
    backdrop-filter: blur(30px) saturate(1.18) !important;
    -webkit-backdrop-filter: blur(30px) saturate(1.18) !important;
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
