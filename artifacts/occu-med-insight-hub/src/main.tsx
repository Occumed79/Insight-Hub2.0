import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/foundation.css";
import "leaflet/dist/leaflet.css";
import "./styles/application.css";

const routePath = window.location.pathname.replace(/\/$/, "");

if (routePath.endsWith("/data-profiles")) {
  sessionStorage.removeItem("insight-hub.company-library.selected");
}

if (routePath.endsWith("/dba-intelligence")) {
  document.documentElement.classList.add("dba-hub-route");
  const cleanupStyle = document.createElement("style");
  cleanupStyle.dataset.insightHubRouteCleanup = "dba-warning";
  cleanupStyle.textContent = `
    .dba-hub-route main > section > .glass-card.border-amber-200\\/14 {
      display: none !important;
    }
  `;
  document.head.appendChild(cleanupStyle);
}

createRoot(document.getElementById("root")!).render(<App />);
