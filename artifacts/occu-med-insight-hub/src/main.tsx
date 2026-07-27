import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/foundation.css";
import "leaflet/dist/leaflet.css";
import "./styles/application.css";
import "./styles/translucent-tool-panels.css";

createRoot(document.getElementById("root")!).render(<App />);
