import { describe, expect, it, vi, afterEach } from "vitest";
import { createCache, createCachedLoader } from "./cache";
import { pool, createLimiter } from "./rateLimit";

afterEach(() => {
  vi.useRealTimers();
});

describe("createCache", () => {
  it("returns what was stored", () => {
    const cache = createCache<string>(1000);
    cache.set("a", "value");

    expect(cache.get("a")).toBe("value");
  });

  it("returns undefined for a key it never saw", () => {
    expect(createCache<string>(1000).get("missing")).toBeUndefined();
  });

  it("expires entries once the TTL passes", () => {
    vi.useFakeTimers();
    const cache = createCache<string>(1000);
    cache.set("a", "value");

    vi.advanceTimersByTime(1001);

    expect(cache.get("a")).toBeUndefined();
  });

  it("keeps entries until the TTL passes", () => {
    vi.useFakeTimers();
    const cache = createCache<string>(1000);
    cache.set("a", "value");

    vi.advanceTimersByTime(999);

    expect(cache.get("a")).toBe("value");
  });

  it("evicts to stay within its size limit", () => {
    const cache = createCache<number>(60_000, 3);
    for (let i = 0; i < 10; i++) cache.set(`key${i}`, i);

    expect(cache.size).toBeLessThanOrEqual(3);
  });

  it("clears everything on demand", () => {
    const cache = createCache<string>(1000);
    cache.set("a", "value");
    cache.clear();

    expect(cache.size).toBe(0);
  });
});

describe("createCachedLoader", () => {
  it("calls the loader once and caches the result", async () => {
    const load = vi.fn(async (key: string) => `loaded:${key}`);
    const loader = createCachedLoader(createCache<string>(60_000), load);

    expect(await loader("a")).toBe("loaded:a");
    expect(await loader("a")).toBe("loaded:a");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight promise between concurrent callers", async () => {
    const load = vi.fn(
      (key: string) =>
        new Promise<string>((resolve) => setTimeout(() => resolve(key), 10))
    );
    const loader = createCachedLoader(createCache<string>(60_000), load);

    await Promise.all([loader("a"), loader("a"), loader("a")]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure, so the next call retries", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("recovered");
    const loader = createCachedLoader(createCache<string>(60_000), load);

    await expect(loader("a")).rejects.toThrow("boom");
    await expect(loader("a")).resolves.toBe("recovered");
  });
});

describe("pool", () => {
  it("returns results in input order", async () => {
    const tasks = [30, 10, 20].map(
      (ms, i) => () =>
        new Promise<number>((resolve) => setTimeout(() => resolve(i), ms))
    );

    expect(await pool(tasks, 2)).toEqual([0, 1, 2]);
  });

  it("never exceeds the concurrency limit", async () => {
    let running = 0;
    let peak = 0;

    const tasks = Array.from({ length: 12 }, () => async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return true;
    });

    await pool(tasks, 3);

    expect(peak).toBeLessThanOrEqual(3);
  });

  it("handles an empty task list", async () => {
    expect(await pool([], 4)).toEqual([]);
  });
});

describe("createLimiter", () => {
  it("runs tasks in the order they were scheduled", async () => {
    const limiter = createLimiter(0);
    const order: number[] = [];

    await Promise.all(
      [1, 2, 3].map((n) =>
        limiter(async () => {
          order.push(n);
        })
      )
    );

    expect(order).toEqual([1, 2, 3]);
  });

  it("keeps running later tasks after one rejects", async () => {
    const limiter = createLimiter(0);

    await expect(
      limiter(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    await expect(limiter(async () => "fine")).resolves.toBe("fine");
  });

  it("spaces out consecutive calls", async () => {
    const limiter = createLimiter(50);
    const started = Date.now();

    await limiter(async () => undefined);
    await limiter(async () => undefined);

    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });
});
