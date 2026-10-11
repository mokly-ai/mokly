import type {
  AuditEvaluation,
  AuditExceptionIssue,
  AuditInputIssue,
  AuditIssue,
  AuditReportIssue,
} from "./dependency-audit-evaluation.mjs";

/** Construct a message issue at the boundary that knows its cause. */
export function auditIssue(kind: "input", message: string): AuditInputIssue;
export function auditIssue(
  kind: "exception",
  message: string,
): AuditExceptionIssue;
export function auditIssue(kind: "report", message: string): AuditReportIssue;

/** Assemble a strict evaluation without discarding any issue or notice. */
export function auditEvaluation(
  issues?: AuditIssue[],
  notices?: string[],
): AuditEvaluation;

/** Retain nested Git/process diagnostics without losing the audit action. */
export function auditCause(error: unknown): string;
