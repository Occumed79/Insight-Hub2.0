import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/foundation.css";
import "leaflet/dist/leaflet.css";
import "./styles/application.css";

if (window.location.pathname.replace(/\/$/, "").endsWith("/data-profiles")) {
  sessionStorage.removeItem("insight-hub.company-library.selected");
}

createRoot(document.getElementById("root")!).render(<App />);
