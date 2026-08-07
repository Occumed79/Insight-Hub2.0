import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const app = read("artifacts/occu-med-insight-hub/src/App.tsx");
const appEntry = read("artifacts/occu-med-insight-hub/src/styles/app-entry.css");
const hardeningCss = read("artifacts/occu-med-insight-hub/src/styles/ui-hardening.css");
const sidebar = read("artifacts/occu-med-insight-hub/src/components/insight/Sidebar.tsx");
const main = read("artifacts/occu-med-insight-hub/src/main.tsx");
const landing = read("artifacts/occu-med-insight-hub/src/pages/landing.tsx");
const entities = read("artifacts/occu-med-insight-hub/src/pages/entities.tsx");

const checks = [
  [appEntry.includes('@import "./ui-hardening.css"'), "shared UI hardening stylesheet is imported"],
  [hardeningCss.includes("min-width: 320px"), "320px minimum viewport guard exists"],
  [hardeningCss.includes(":focus-visible"), "keyboard focus visibility guard exists"],
  [hardeningCss.includes("min-height: 44px"), "mobile touch target floor exists"],
  [hardeningCss.includes("prefers-reduced-motion: reduce"), "reduced-motion guard exists"],
  [hardeningCss.includes('[role="dialog"]'), "dialog overflow containment exists"],
  [sidebar.includes("insight-mobile-nav"), "mobile intelligence navigation exists"],
  [sidebar.includes('aria-current={active ? "page" : undefined}'), "active navigation exposes aria-current"],
  [sidebar.includes('["/prospects", "/clients"].includes(currentPath)'), "Entities route aliases retain active navigation state"],
  [sidebar.includes('aria-label="Insight Hub intelligence tools"'), "navigation has an accessible label"],
  [main.includes("class AppErrorBoundary"), "global UI error boundary exists"],
  [main.includes('role="alert"'), "crash recovery surface is announced accessibly"],
  [landing.includes('role="dialog"') && landing.includes('aria-modal="true"'), "landing link manager remains a semantic modal"],
  [app.includes("React.lazy") && app.includes("React.Suspense"), "workspace routes remain code-split behind a suspense boundary"],
  [app.includes('role="status"') && app.includes("Loading workspace"), "route loading state remains accessible"],
  [entities.includes('import * as DialogPrimitive from "@radix-ui/react-dialog"'), "Entities details use managed modal primitives"],
  [entities.includes('role="tablist"') && entities.includes('role="tabpanel"'), "Entities tabs retain semantic tab structure"],
  [entities.includes("function EmptyCard") && entities.includes("filteredProspects.length === 0") && entities.includes("filteredClients.length === 0"), "Entities datasets and searches retain explicit empty states"],
  [entities.includes('aria-label={`Open details for ${item.name}`}'), "Entity record actions remain keyboard-operable semantic controls"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error("Insight Hub 2 UI hardening audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Insight Hub 2 UI hardening audit passed (${checks.length} checks).`);
