import { publishCancelled, uploadTransportFailed } from "./errors.js";

/** Maximum request attempts, including the initial request. */
export const MAX_REQUEST_ATTEMPTS = 5;

/** Initial full-jitter ceiling before the second request attempt. */
export const RETRY_BASE_DELAY_MS = 1_000;

/** Largest accepted integer Retry-After value in seconds. */
export const MAX_RETRY_AFTER_SECONDS = 60;

/** Injectable clock and wait boundaries for deterministic retry behavior. */
export interface RetryDependencies {
  now(): Date;
  random(): number;
  sleep(milliseconds: number, signal?: AbortSignal): Promise<void>;
}

/** Internal signal that the complete exchange must begin a fresh plan. */
export class ReplanRequired extends Error {
  constructor() {
    super("Upload plan must be renewed");
    this.name = "ReplanRequired";
  }
}

/** Internal signal for a retryable response or transport interruption. */
export class RetryableRequest extends Error {
  constructor(readonly retryAfterMs?: number) {
    super("Upload request may be retried");
    this.name = "RetryableRequest";
  }
}

/** Run one request up to five times with full jitter and optional expiry. */
export async function retryRequest<Result>(
  dependencies: RetryDependencies,
  request: () => Promise<Result>,
  options: { signal?: AbortSignal; expiresAt?: string } = {},
): Promise<Result> {
  const expiresAt = options.expiresAt
    ? Date.parse(options.expiresAt)
    : undefined;
  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt++) {
    assertActive(options.signal);
    if (expiresAt !== undefined && dependencies.now().getTime() >= expiresAt)
      throw new ReplanRequired();
    try {
      return await request();
    } catch (error) {
      if (!(error instanceof RetryableRequest)) throw error;
      if (attempt === MAX_REQUEST_ATTEMPTS) throw uploadTransportFailed();
      const ceiling = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      const wait = error.retryAfterMs ?? dependencies.random() * ceiling;
      if (
        expiresAt !== undefined &&
        dependencies.now().getTime() + wait >= expiresAt
      )
        throw new ReplanRequired();
      try {
        await dependencies.sleep(wait, options.signal);
      } catch {
        if (options.signal?.aborted) throw publishCancelled();
        throw uploadTransportFailed();
      }
    }
  }
  throw uploadTransportFailed();
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw publishCancelled();
}
