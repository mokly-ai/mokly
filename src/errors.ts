import type { BaselineErrorCode } from "./baseline/errors.js";

/** Stable error codes callers and CLI formatting may branch on. */

export type MoklyErrorCode =
  | BaselineErrorCode
  | "build-invalid"
  | "cli-invalid"
  | "config-invalid"
  | "config-missing"
  | "export-invalid"
  | "git-failed"
  | "manifest-invalid"
  | "review-invalid"
  | "server-failed"
  | "upload-failed"
  | "upload-invalid-bundle"
  | "upload-too-large"
  | "upload-unauthorized"
  | "upload-unsupported-version";

/** Optional rich-presentation variant carried by a typed Mokly failure. */
export type MoklyErrorPresentation =
  "publish-cancelled" | "publish-transport-failed";

/** Standard Error options plus a typed rich-presentation variant. */
export interface MoklyErrorOptions extends ErrorOptions {
  readonly cancelled?: boolean;
  readonly presentation?: MoklyErrorPresentation;
}

const cancellationMarks = new WeakSet<MoklyError>();

/** Typed user-facing failure from a Mokly boundary. */
export class MoklyError extends Error {
  readonly code: MoklyErrorCode;
  readonly presentation: MoklyErrorPresentation | undefined;

  /** Whether this exact failure was explicitly classified as cancellation. */
  get cancelled(): boolean {
    return cancellationMarks.has(this);
  }

  constructor(
    code: MoklyErrorCode,
    message: string,
    options?: MoklyErrorOptions,
  ) {
    super(`[mokly/${code}] ${message}`, options);
    this.name = "MoklyError";
    this.code = code;
    this.presentation = options?.presentation;
    if (options?.cancelled) cancellationMarks.add(this);
  }
}

/** Mark one existing Mokly failure as cancellation without replacing it. */
export function markCancellation<Failure extends MoklyError>(
  error: Failure,
): Failure {
  cancellationMarks.add(error);
  return error;
}

/** Identify only explicitly marked failures and platform AbortError values. */
export function isCancellation(error: unknown): boolean {
  if (error instanceof MoklyError) return error.cancelled;
  const platformError =
    error instanceof Error ||
    (typeof DOMException !== "undefined" && error instanceof DOMException);
  return platformError && error.name === "AbortError";
}

/** Convert an unknown caught value into a display-safe message. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
