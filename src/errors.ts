import type { BaselineErrorCode } from "./baseline/errors.js";

const MOKLY_ERROR = Symbol.for("mokly.error");

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

const knownCodes: Record<MoklyErrorCode, true> = {
  "baseline-history-unavailable": true,
  "baseline-extraction-failed": true,
  "baseline-command-failed": true,
  "baseline-output-invalid": true,
  "baseline-interrupted": true,
  "baseline-lock-timeout": true,
  "build-invalid": true,
  "cli-invalid": true,
  "config-invalid": true,
  "config-missing": true,
  "export-invalid": true,
  "git-failed": true,
  "manifest-invalid": true,
  "review-invalid": true,
  "server-failed": true,
  "upload-failed": true,
  "upload-invalid-bundle": true,
  "upload-too-large": true,
  "upload-unauthorized": true,
  "upload-unsupported-version": true,
};

/** Typed user-facing failure from a Mokly boundary. */
export class MoklyError extends Error {
  readonly [MOKLY_ERROR] = true;
  readonly code: MoklyErrorCode;
  readonly detail: string;

  constructor(code: MoklyErrorCode, message: string, options?: ErrorOptions) {
    super(`[mokly/${code}] ${message}`, options);
    this.name = "MoklyError";
    this.code = code;
    this.detail = message;
  }
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
