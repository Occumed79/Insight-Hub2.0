import type { ResolverDependencies } from "./geospatial-types";

export class ProviderHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

type ProviderName = "geocodio" | "locationiq";
type SlotState = { disabled: boolean; cooldownUntil: number };
type ProviderState = { cursor: number; slots: SlotState[] };

const providerState: Record<ProviderName, ProviderState> = {
  geocodio: { cursor: 0, slots: [] },
  locationiq: { cursor: 0, slots: [] },
};

function keyNames(provider: ProviderName): string[] {
  const base = provider === "geocodio" ? "GEOCODIO_API_KEY" : "LOCATIONIQ_API_KEY";
  return [base, `${base}_2`, `${base}_3`, `${base}_4`, `${base}_5`];
}

export function configuredKeys(provider: ProviderName): string[] {
  return keyNames(provider).map((name) => process.env[name]?.trim() || "").filter(Boolean);
}

function ensureState(provider: ProviderName, count: number): ProviderState {
  const state = providerState[provider];
  while (state.slots.length < count) state.slots.push({ disabled: false, cooldownUntil: 0 });
  if (state.slots.length > count) state.slots.length = count;
  if (state.cursor >= Math.max(1, count)) state.cursor = 0;
  return state;
}

export async function withProviderKey<T>(
  provider: ProviderName,
  deps: ResolverDependencies,
  task: (key: string, slot: number) => Promise<T | null>,
): Promise<T | null> {
  const keys = configuredKeys(provider);
  if (!keys.length) return null;

  const state = ensureState(provider, keys.length);
  const now = deps.now?.() ?? Date.now();
  const start = state.cursor % keys.length;

  for (let offset = 0; offset < keys.length; offset += 1) {
    const index = (start + offset) % keys.length;
    const slot = state.slots[index];
    if (slot.disabled || slot.cooldownUntil > now) continue;

    try {
      const value = await task(keys[index], index + 1);
      state.cursor = (index + 1) % keys.length;
      if (value !== null) return value;
    } catch (error) {
      const status = error instanceof ProviderHttpError ? error.status : 0;
      if (status === 401 || status === 403) slot.disabled = true;
      else if (status === 429) slot.cooldownUntil = now + 15 * 60_000;
      else slot.cooldownUntil = now + 2 * 60_000;
    }
  }

  return null;
}

export function describeProviderPool(provider: ProviderName, deps: ResolverDependencies = {}) {
  const keys = configuredKeys(provider);
  const state = ensureState(provider, keys.length);
  const now = deps.now?.() ?? Date.now();
  return {
    configured: keys.length,
    healthy: state.slots.filter((slot) => !slot.disabled && slot.cooldownUntil <= now).length,
    cooldown: state.slots.filter((slot) => !slot.disabled && slot.cooldownUntil > now).length,
    disabled: state.slots.filter((slot) => slot.disabled).length,
  };
}

export function resetProviderPoolsForTests() {
  providerState.geocodio = { cursor: 0, slots: [] };
  providerState.locationiq = { cursor: 0, slots: [] };
}
