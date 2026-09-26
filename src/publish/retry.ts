import { MoklyError } from "../errors.js";

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
  for (let attempt = 1; attempt <= 5; attempt++) {
    assertActive(options.signal);
    if (expiresAt !== undefined && dependencies.now().getTime() >= expiresAt)
      throw new ReplanRequired();
    try {
      return await request();
    } catch (error) {
      if (!(error instanceof RetryableRequest)) throw error;
      if (attempt === 5) throw failed();
      const ceiling = Math.min(16_000, 1_000 * 2 ** (attempt - 1));
      const wait = error.retryAfterMs ?? dependencies.random() * ceiling;
      if (
        expiresAt !== undefined &&
        dependencies.now().getTime() + wait >= expiresAt
      )
        throw new ReplanRequired();
      try {
        await dependencies.sleep(wait, options.signal);
      } catch {
        throw failed();
      }
    }
  }
  throw failed();
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw failed();
}

function failed(): MoklyError {
  return new MoklyError(
    "upload-failed",
    "The catalogue could not be uploaded. Check the endpoint and connection, then retry.",
  );
}
