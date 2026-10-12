import { useCallback, useEffect, useRef, useState } from "react";
import type { CommandId } from "./aor-directory";
import type { CommandNewsResponse } from "./aor-news-types";

export type CommandNewsState = { state: "loading" } | { state: "ready"; data: CommandNewsResponse } | { state: "error"; message: string };

/** Loads one command's official news on demand (only when the News tab is opened). */
export function useCommandNews(command: CommandId, enabled: boolean) {
  const [result, setResult] = useState<CommandNewsState>({ state: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);

  const load = useCallback(async (refresh: boolean) => {
    const id = ++request.current;
    if (refresh) setRefreshing(true); else setResult({ state: "loading" });
    try {
      const response = await fetch(`/api/aor/command-news?command=${command}${refresh ? "&refresh=1" : ""}`, { headers: { Accept: "application/json" } });
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("json")) throw new Error(`The news service returned an unexpected response (HTTP ${response.status}).`);
      const body = await response.json();
      if (!response.ok || !body?.ok) throw new Error(String(body?.error ?? `The news service returned HTTP ${response.status}.`));
      if (id === request.current) setResult({ state: "ready", data: body as CommandNewsResponse });
    } catch (error) {
      if (id === request.current) setResult({ state: "error", message: error instanceof Error ? error.message : "The news service could not be reached." });
    } finally {
      if (id === request.current) setRefreshing(false);
    }
  }, [command]);

  useEffect(() => {
    if (!enabled) return;
    void load(false);
    return () => { request.current += 1; };
  }, [command, enabled, load]);

  return { result, refreshing, reload: () => load(true) };
}
