import type { CommandId } from "./aor-directory";

export type GlobeView = {
  level: "world" | "aor" | "country";
  aorId: CommandId | null;
  /** Directory location id (e.g. "KEN", "GEO:UNITED_STATES_HAWAII"). */
  locationId: string | null;
  /** A split ISO entity (USA, UMI, ATF) is selected: it has no AOR of its own. */
  splitIso3: string | null;
  nonce: number;
};
export type GlobeStatus = { state: "loading" | "ready" | "error"; message?: string; fatal?: boolean; retryable?: boolean };
