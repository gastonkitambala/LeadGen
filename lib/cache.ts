/**
 * Tiny TTL cache backed by a Map.
 *
 * Deliberately an interface rather than direct Map access at the call sites, so a
 * database-backed store can replace it later without touching the callers.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
}

export function createCache<T>(ttlMs: number, maxEntries = 500): Cache<T> {
  const store = new Map<string, Entry<T>>();

  function evictExpired(now: number) {
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
  }

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key, value) {
      const now = Date.now();
      if (store.size >= maxEntries) {
        evictExpired(now);
        // Still full after dropping expired entries: drop the oldest insertion.
        if (store.size >= maxEntries) {
          const oldest = store.keys().next();
          if (!oldest.done) store.delete(oldest.value);
        }
      }
      store.set(key, { value, expiresAt: now + ttlMs });
    },

    delete(key) {
      store.delete(key);
    },

    clear() {
      store.clear();
    },

    get size() {
      return store.size;
    },
  };
}

/**
 * Wraps a loader so concurrent calls for the same key share one in-flight promise.
 * Without this, ten cards auditing the same domain would fire ten requests.
 */
export function createCachedLoader<T>(
  cache: Cache<T>,
  load: (key: string) => Promise<T>
): (key: string) => Promise<T> {
  const inFlight = new Map<string, Promise<T>>();

  return async function loadCached(key: string): Promise<T> {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = load(key)
      .then((value) => {
        cache.set(key, value);
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  };
}
