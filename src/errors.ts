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
  | "interactive-bundle"
  | "manifest-invalid"
  | "review-invalid"
  | "server-failed"
  | "upload-failed"
  | "upload-invalid-bundle"
  | "upload-too-large"
  | "upload-unauthorized"
  | "upload-unsupported-version";

/** Typed user-facing failure from a Mokly boundary. */
export class MoklyError extends Error {
  readonly code: MoklyErrorCode;

  constructor(code: MoklyErrorCode, message: string, options?: ErrorOptions) {
    super(`[mokly/${code}] ${message}`, options);
    this.name = "MoklyError";
    this.code = code;
  }
}

/** Convert an unknown caught value into a display-safe message. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
