import { useCallback, useRef, useState } from "react";
import type { AnyRecord, OshaCaseProfile } from "./signals";

export type LookupStatus = "idle" | "resolving" | "correlating" | "mapping" | "ready" | "error";

export interface LookupState {
  status: LookupStatus;
  query: string;
  onet: AnyRecord | null;
  osha: (OshaCaseProfile & AnyRecord) | null;
  oshaError: string;
  error: string;
}

const INITIAL: LookupState = { status: "idle", query: "", onet: null, osha: null, oshaError: "", error: "" };

/** Shortest time the "analysis" choreography stays up, so fast responses still read as analysis. */
const MIN_ANALYSIS_MS = 1500;

async function loadJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Occupation -> O*NET profile -> OSHA occupation case profile, using the same endpoints as the
 * preserved legacy workbench. Exposes granular status so the stage can narrate each step.
 */
export function useOccupationLookup() {
  const [state, setState] = useState<LookupState>(INITIAL);
  const run = useRef(0);

  const lookup = useCallback(async (raw: string) => {
    const query = raw.trim();
    if (!query) return;
    const token = ++run.current;
    const started = performance.now();
    const alive = () => token === run.current;
    setState({ ...INITIAL, status: "resolving", query });

    try {
      const onetPayload = await loadJson(`/api/occupational-discovery/onet/profile?keyword=${encodeURIComponent(query)}`);
      if (!alive()) return;
      const profile = onetPayload?.profile ?? null;
      const resolved = profile?.occupation;
      setState((current) => ({ ...current, onet: onetPayload, status: "correlating" }));

      let osha: LookupState["osha"] = null;
      let oshaError = "";
      if (resolved?.code || resolved?.title) {
        try {
          const params = new URLSearchParams();
          if (resolved.code) params.set("soc", resolved.code);
          if (resolved.title) params.set("title", resolved.title);
          const payload = await loadJson(`/api/occupational-discovery/osha-occupation-profile?${params.toString()}`);
          osha = payload?.profile ?? null;
        } catch (error) {
          oshaError = error instanceof Error ? error.message : "OSHA occupation case profile failed.";
        }
      }
      if (!alive()) return;
      setState((current) => ({ ...current, osha, oshaError, status: "mapping" }));
      await sleep(Math.max(500, MIN_ANALYSIS_MS - (performance.now() - started)));
      if (!alive()) return;
      setState((current) => ({
        ...current,
        status: profile ? "ready" : "error",
        error: profile ? "" : "No occupation profile matched that search.",
      }));
    } catch (error) {
      if (!alive()) return;
      setState({ ...INITIAL, status: "error", query, error: error instanceof Error ? error.message : "O*NET request failed." });
    }
  }, []);

  const reset = useCallback(() => {
    run.current += 1;
    setState(INITIAL);
  }, []);

  return { state, lookup, reset };
}
