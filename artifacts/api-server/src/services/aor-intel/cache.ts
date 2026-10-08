export interface CacheEntry<T = unknown> {
  payload: T;
  retrievedAt: string;
  expiresAt: string;
}

export interface CacheStore {
  get<T = unknown>(key: string): Promise<CacheEntry<T> | null>;
  set(key: string, payload: unknown, ttlMs: number, now?: Date): Promise<void>;
}

export function createMemoryStore(): CacheStore {
  const map = new Map<string, CacheEntry>();
  return {
    async get<T>(key: string) {
      return (map.get(key) as CacheEntry<T> | undefined) ?? null;
    },
    async set(key, payload, ttlMs, now = new Date()) {
      map.set(key, { payload, retrievedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttlMs).toISOString() });
    },
  };
}

/**
 * Neon-backed store with an in-process layer in front of it. If the database is not
 * configured or a query fails, the memory layer keeps working so the API still
 * answers; the failure is logged by the caller via the returned flag.
 */
export function createNeonBackedStore(onError?: (error: unknown) => void): CacheStore {
  const memory = createMemoryStore();
  let dbModule: Promise<typeof import("@workspace/db") | null> | null = null;
  const load = () => {
    dbModule ??= import("@workspace/db").catch((error) => {
      onError?.(error);
      return null;
    });
    return dbModule;
  };
  return {
    async get<T>(key: string) {
      const local = await memory.get<T>(key);
      if (local) return local;
      try {
        const mod = await load();
        if (!mod) return null;
        const { eq } = await import("drizzle-orm");
        const rows = await mod.db.select().from(mod.aorIntelCacheTable).where(eq(mod.aorIntelCacheTable.key, key)).limit(1);
        const found = rows[0];
        if (!found) return null;
        const entry: CacheEntry<T> = { payload: found.payload as T, retrievedAt: found.retrievedAt.toISOString(), expiresAt: found.expiresAt.toISOString() };
        return entry;
      } catch (error) {
        onError?.(error);
        return null;
      }
    },
    async set(key, payload, ttlMs, now = new Date()) {
      await memory.set(key, payload, ttlMs, now);
      try {
        const mod = await load();
        if (!mod) return;
        const expiresAt = new Date(now.getTime() + ttlMs);
        await mod.db
          .insert(mod.aorIntelCacheTable)
          .values({ key, payload: payload as never, retrievedAt: now, expiresAt })
          .onConflictDoUpdate({ target: mod.aorIntelCacheTable.key, set: { payload: payload as never, retrievedAt: now, expiresAt } });
      } catch (error) {
        onError?.(error);
      }
    },
  };
}
