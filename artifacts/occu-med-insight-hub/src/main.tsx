import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./visual-restore.css";
import "./logo-override.css";
import "leaflet/dist/leaflet.css";
import "./map-polish.css";

createRoot(document.getElementById("root")!).render(<App />);
