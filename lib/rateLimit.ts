/**
 * Serialized queue enforcing a minimum interval between calls.
 *
 * Nominatim's usage policy caps clients at one request per second. Overpass throttles
 * aggressively too. Both are free services run on donated hardware, so being a polite
 * client is a requirement, not an optimization.
 */

export interface Limiter {
  <T>(task: () => Promise<T>): Promise<T>;
}

export function createLimiter(minIntervalMs: number): Limiter {
  let chain: Promise<unknown> = Promise.resolve();
  let lastStart = 0;

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = lastStart + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();
      return task();
    });

    // Keep the chain alive even when a task rejects, or one failure stalls the queue.
    chain = run.catch(() => undefined);
    return run;
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs tasks with at most `limit` in flight. Results keep input order.
 * Rejections are surfaced per-task by the caller's own task wrapper — a task that
 * throws here rejects the whole batch, so callers should catch inside their task.
 */
export async function pool<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
