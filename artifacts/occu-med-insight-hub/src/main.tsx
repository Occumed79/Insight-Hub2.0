import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/foundation.css";
import "leaflet/dist/leaflet.css";
import "./styles/application.css";
import "./styles/cardless-tools.css";

createRoot(document.getElementById("root")!).render(<App />);
