import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/foundation.css";
import "leaflet/dist/leaflet.css";
import "./styles/app-entry.css";

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Insight Hub 2 render failure", { error, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-[#020817] px-6 py-12 text-white">
        <section
          role="alert"
          className="w-full max-w-xl rounded-[28px] border border-cyan-100/18 bg-[#071321]/92 p-7 shadow-[0_28px_90px_rgba(0,0,0,.52)] backdrop-blur-2xl"
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/46">Insight Hub 2</p>
          <h1 className="mt-3 text-2xl font-black">This view could not be displayed.</h1>
          <p className="mt-3 text-sm leading-6 text-cyan-50/66">
            The application hit an unexpected interface error. Reload the current view to recover.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-cyan-200/24 bg-cyan-300/12 px-4 text-sm font-semibold text-white transition hover:bg-cyan-300/18"
          >
            Reload view
          </button>
        </section>
      </main>
    );
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Insight Hub 2 root element is missing");

createRoot(root).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
