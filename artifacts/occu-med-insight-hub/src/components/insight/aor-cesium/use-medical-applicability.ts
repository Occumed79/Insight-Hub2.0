import { useEffect, useRef, useState } from "react";
import { medicalQueryString, type MedicalApplicability, type MedicalInputs } from "./aor-medical-types";

export type MedicalState = { result: MedicalApplicability | null; loading: boolean; error: string; revision: number };

/**
 * Calls GET /api/aor/medical-applicability for the selected destination and recalculates whenever an input changes.
 * Text inputs are debounced briefly; the previous result stays on screen (marked as recalculating) until the new one arrives,
 * and an older response can never overwrite a newer one.
 */
export function useMedicalApplicability(destination: string | null, destinationIso3: string | null, inputs: MedicalInputs, debounceMs = 250): MedicalState {
  const [state, setState] = useState<MedicalState>({ result: null, loading: false, error: "", revision: 0 });
  const sequence = useRef(0);
  const lastDestination = useRef<string | null>(null);
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
        const response = await fetch(`/api/aor/medical-applicability?${query}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
        const payload = (await response.json().catch(() => ({}))) as MedicalApplicability;
        if (sequence.current !== mine) return;
        if (!response.ok && !payload.status) throw new Error(payload.error || `Medical applicability request failed (${response.status}).`);
        setState((current) => ({ result: payload, loading: false, error: payload.status === "LOCATION_NOT_FOUND" ? payload.error || "This location was not found in the directory." : "", revision: current.revision + 1 }));
      } catch (error) {
        if (controller.signal.aborted || sequence.current !== mine) return;
        setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Medical applicability could not be calculated." }));
      }
    }, changedDestination ? 0 : debounceMs);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [destination, query, debounceMs]);

  return state;
}
