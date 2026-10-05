import type { AuditException } from "./dependency-audit-evaluation.mjs";

/** Validated record with its review window and evaluation state. */
export interface ReviewedAuditException {
  exception: AuditException;
  label: string;
  daysLeft: number;
  errors: string[];
  matched: boolean;
  used: boolean;
}

/** Recognize an absolute HTTPS URL without embedded credentials. */
export function isHttpsUrl(value: unknown): value is string;

/** Validate every reviewed record and its inclusive UTC review window. */
export function validateAuditExceptions(
  input: unknown,
  now: Date,
): { errors: string[]; records: ReviewedAuditException[] };
