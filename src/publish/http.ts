import { MoklyError } from "../errors.js";

import { publishCancelled } from "./errors.js";
import {
  MAX_RETRY_AFTER_SECONDS,
  ReplanRequired,
  RetryableRequest,
} from "./retry.js";

/** Maximum response body retained by plan and completion readers. */
export const RESPONSE_BODY_LIMIT = 16 * 1024 * 1024;

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Execute one timed fetch attempt, including its response body handling. */
export async function requestAttempt<Result>(
  request: typeof fetch,
  input: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  handle: (response: Response, attemptSignal: AbortSignal) => Promise<Result>,
  onStart?: () => void,
): Promise<Result> {
  const timeout = AbortSignal.timeout(120_000);
  const attemptSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    attemptSignal.throwIfAborted();
    onStart?.();
    const response = await request(input, { ...init, signal: attemptSignal });
    return await handle(response, attemptSignal);
  } catch (error) {
    if (
      error instanceof MoklyError ||
      error instanceof RetryableRequest ||
      error instanceof ReplanRequired
    )
      throw error;
    if (signal?.aborted) throw publishCancelled();
    throw new RetryableRequest();
  }
}

/** Read at most the selected number of bytes; undefined means over limit. */
export async function readBoundedBody(
  response: Response,
  limit = RESPONSE_BODY_LIMIT,
): Promise<Buffer | undefined> {
  const declared = response.headers.get("Content-Length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > limit) {
    await cancelResponse(response);
    return undefined;
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, length);
      const chunk = Buffer.from(value);
      length += chunk.length;
      if (length > limit) {
        await reader.cancel().catch(() => undefined);
        return undefined;
      }
      chunks.push(chunk);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}

/** Cancel a response body that the protocol does not consume. */
export async function cancelResponse(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

/** Return a normalized response Content-Type without parameters. */
export function responseMediaType(response: Response): string | undefined {
  return response.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
}

/** Return the retry signal for a retryable response status. */
export function retryableResponse(
  response: Response,
): RetryableRequest | undefined {
  if (!RETRYABLE_STATUSES.has(response.status)) return undefined;
  const raw = response.headers.get("Retry-After");
  const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
  return new RetryableRequest(
    seconds !== undefined && seconds <= MAX_RETRY_AFTER_SECONDS
      ? seconds * 1_000
      : undefined,
  );
}
