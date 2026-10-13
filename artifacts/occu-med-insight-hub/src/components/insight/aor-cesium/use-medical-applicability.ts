import { useCallback, useEffect, useRef, useState } from "react";
import { intelligenceJson } from "@/lib/intelligence-request";
import { medicalQueryString, type MedicalApplicability, type MedicalInputs } from "./aor-medical-types";

/** `retry` re-runs the request for the current destination and inputs (used by the error state). */
export type MedicalState = { result: MedicalApplicability | null; loading: boolean; error: string; revision: number; retry?: () => void };

/**
 * Calls GET /api/aor/medical-applicability for the selected destination and recalculates whenever an input changes.
 * Text inputs are debounced briefly; the previous result stays on screen (marked as recalculating) until the new one arrives,
 * and an older response can never overwrite a newer one.
 */
export function useMedicalApplicability(destination: string | null, destinationIso3: string | null, inputs: MedicalInputs, debounceMs = 250): MedicalState {
  const [state, setState] = useState<MedicalState>({ result: null, loading: false, error: "", revision: 0 });
  const sequence = useRef(0);
  const lastDestination = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const query = destination ? medicalQueryString(destination, inputs, destinationIso3) : "";

  useEffect(() => {
    if (!destination) {
      lastDestination.current = null;
      setState({ result: null, loading: false, error: "", revision: 0 });
      return;
    }
    const mine = ++sequence.current;
    const controller = new AbortController();
    const changedDestination = lastDestination.current !== destination;
    lastDestination.current = destination;
    // A different destination must never show the previous destination's requirements.
    setState((current) => ({ result: changedDestination ? null : current.result, loading: true, error: "", revision: current.revision }));
    const timer = window.setTimeout(async () => {
      try {
        const payload = await intelligenceJson<MedicalApplicability>(`/api/aor/medical-applicability?${query}`, { signal: controller.signal });
        if (sequence.current !== mine) return;
        setState((current) => ({ result: payload, loading: false, error: payload.status === "LOCATION_NOT_FOUND" ? payload.error || "This location was not found in the directory." : "", revision: current.revision + 1 }));
      } catch (error) {
        if (controller.signal.aborted || sequence.current !== mine) return;
        setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Medical applicability could not be calculated." }));
      }
    }, changedDestination ? 0 : debounceMs);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [destination, query, debounceMs, attempt]);

  return { ...state, retry };
}
