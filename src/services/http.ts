export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`Request failed with HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export interface FetchJsonOptions {
  signal?: AbortSignal;
  /** Give up after this long (default 10 s). */
  timeoutMs?: number;
}

/** Combine the caller's abort signal with a timeout. */
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, timeout]);
  return signal; // very old browsers: no timeout, but user aborts still work
}

/** GET a URL and parse JSON. Throws HttpError on non-2xx, AbortError/TimeoutError on cancel. */
export async function fetchJson(url: string, { signal, timeoutMs = 10_000 }: FetchJsonOptions = {}): Promise<unknown> {
  const res = await fetch(url, { signal: withTimeout(signal, timeoutMs), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new HttpError(res.status, url);
  return res.json();
}

/** True for errors caused by the user cancelling (clicking elsewhere), which shouldn't be shown. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** A short, user-facing explanation of why a request failed. */
export function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'TimeoutError') return 'The service took too long to respond.';
  if (err instanceof HttpError) {
    if (err.status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (err.status >= 500) return 'The service is temporarily unavailable.';
    return `The service returned an error (HTTP ${err.status}).`;
  }
  if (err instanceof TypeError) return 'Network error. Check your internet connection.';
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/** Small TTL cache keyed by rounded coordinates, so re-clicking nearby doesn't refetch. */
export class TtlCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 100,
  ) {}

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
    if (this.entries.size > this.maxEntries) {
      // Maps iterate in insertion order: the first key is the oldest.
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }
}

/** ~1 km grid: points this close share cached data. */
export const coordKey = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;
