/** Bounded, cancellable requests for the immersive intelligence workspaces. */
export async function intelligenceJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
  try {
    const response = await fetch(url, {
      ...options, cache: "no-store", headers: { Accept: "application/json", ...options.headers }, signal: controller.signal,
    });
    const payload = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("The service returned an invalid response. Please try again.");
    // Cesium configuration intentionally returns 503 with a usable unconfigured response.
    if (!response.ok && !(url === "/api/aor/cesium-config" && typeof payload.configured === "boolean")) {
      throw new Error(payload.error || `Request failed (${response.status}).`);
    }
    return payload as T;
  } catch (error) {
    if (timedOut) throw new Error("The request timed out. Please try again.");
    throw error;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
