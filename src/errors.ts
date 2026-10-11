import type { BaselineErrorCode } from "./baseline/errors.js";

const MOKLY_ERROR = Symbol.for("mokly.error");
const MOKLY_CANCELLATION = Symbol.for("mokly.error.cancelled");

/** Stable error codes callers and CLI formatting may branch on. */

export type MoklyErrorCode =
  | BaselineErrorCode
  | "baseline-incompatible-earlier"
  | "build-invalid"
  | "build-stale"
  | "cli-invalid"
  | "config-invalid"
  | "config-missing"
  | "export-invalid"
  | "git-failed"
  | "git-uncommitted"
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

const knownCodes: Record<MoklyErrorCode, true> = {
  "baseline-incompatible-earlier": true,
  "baseline-history-unavailable": true,
  "baseline-extraction-failed": true,
  "baseline-command-failed": true,
  "baseline-output-invalid": true,
  "baseline-interrupted": true,
  "baseline-lock-timeout": true,
  "build-invalid": true,
  "build-stale": true,
  "cli-invalid": true,
  "config-invalid": true,
  "config-missing": true,
  "export-invalid": true,
  "git-failed": true,
  "git-uncommitted": true,
  "manifest-invalid": true,
  "review-invalid": true,
  "server-failed": true,
  "upload-failed": true,
  "upload-invalid-bundle": true,
  "upload-too-large": true,
  "upload-unauthorized": true,
  "upload-unsupported-version": true,
};

interface CancellationCarrier {
  readonly [MOKLY_CANCELLATION]?: boolean;
}

/** Typed user-facing failure from a Mokly boundary. */
export class MoklyError extends Error {
  readonly [MOKLY_ERROR] = true;
  readonly code: MoklyErrorCode;
  readonly detail: string;
  readonly presentation: MoklyErrorPresentation | undefined;

  /** Whether this exact failure was explicitly classified as cancellation. */
  get cancelled(): boolean {
    return (
      cancellationMarks.has(this) ||
      (this as CancellationCarrier)[MOKLY_CANCELLATION] === true
    );
  }

  constructor(
    code: MoklyErrorCode,
    message: string,
    options?: MoklyErrorOptions,
  ) {
    super(`[mokly/${code}] ${message}`, options);
    this.name = "MoklyError";
    this.code = code;
    this.detail = message;
    this.presentation = options?.presentation;
    if (options?.cancelled) markCancellation(this);
  }
}

/** Mark one existing Mokly failure as cancellation without replacing it. */
export function markCancellation<Failure extends MoklyError>(
  error: Failure,
): Failure {
  cancellationMarks.add(error);
  if ((error as CancellationCarrier)[MOKLY_CANCELLATION] !== true)
    Object.defineProperty(error, MOKLY_CANCELLATION, {
      enumerable: false,
      value: true,
    });
  return error;
}

/** Identify only explicitly marked failures and platform AbortError values. */
export function isCancellation(error: unknown): boolean {
  if (isMoklyError(error))
    return (
      error.cancelled === true ||
      (error as CancellationCarrier)[MOKLY_CANCELLATION] === true
    );
  const platformError =
    error instanceof Error ||
    (typeof DOMException !== "undefined" && error instanceof DOMException);
  return platformError && error.name === "AbortError";
}

/** Recognize a typed Mokly error from another copy of the consumer runtime. */
export function isMoklyError(value: unknown): value is MoklyError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<MoklyError>;
  return (
    candidate[MOKLY_ERROR] === true &&
    typeof candidate.code === "string" &&
    Object.hasOwn(knownCodes, candidate.code) &&
    typeof candidate.detail === "string" &&
    candidate.message === `[mokly/${candidate.code}] ${candidate.detail}`
  );
}

/** Convert an unknown caught value into a display-safe message. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
