/** npm's recognized advisory severity levels. */
export type AuditSeverity = "info" | "low" | "moderate" | "high" | "critical";

/** Fields retained from each live npm advisory object. */
export interface AuditAdvisory {
  name: string;
  dependency: string;
  title: string;
  url: string;
  severity: AuditSeverity;
}

/** Direct advisory findings or package-name-only effect entries. */
export interface AuditEntry {
  name: string;
  severity: AuditSeverity;
  via: Array<string | AuditAdvisory>;
  nodes: string[];
  effects?: string[];
}

/** The version-two report fields required by the evaluator. */
export interface AuditReport {
  auditReportVersion: 2;
  vulnerabilities: Record<string, AuditEntry>;
}

/** Exact reviewed scope and inclusive UTC expiry for one risk. */
export interface AuditException {
  advisory: string;
  package: string;
  path: string[];
  until: string;
  reason: string;
  tracking: string;
}

/** Dependency edges and development flags from a lockfile package entry. */
export interface AuditLockfileEntry {
  dev?: boolean;
  devOptional?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/** Lockfile inventory, including root and workspace entries. */
export interface AuditLockfile {
  packages: Record<string, AuditLockfileEntry>;
}

/** An uncovered advisory with its exact dependency locations. */
export interface AuditFindingIssue {
  kind: "finding";
  message: string;
  package: string;
  advisoryUrl: string;
  advisoryId?: string;
  severity: AuditSeverity;
  title: string;
  installLocations: string[];
}

/** An issue with one reviewed exception record. */
export interface AuditExceptionIssue {
  kind: "exception";
  message: string;
}

/** Invalid registry output or an inconsistent npm status. */
export interface AuditReportIssue {
  kind: "report";
  message: string;
}

/** Input, clock, process, Git, or filesystem failure. */
export interface AuditInputIssue {
  kind: "input";
  message: string;
}

/** Each issue retains its kind; only findings have advisory fields. */
export type AuditIssue =
  AuditFindingIssue | AuditExceptionIssue | AuditReportIssue | AuditInputIssue;

/** All failures and every risk accepted by the strict evaluator. */
export interface AuditEvaluation {
  ok: boolean;
  issues: AuditIssue[];
  notices: string[];
}

/** Evaluate untrusted audit and file data without IO or ambient time. */
export function evaluateDependencyAudit(
  report: unknown,
  lockfile: unknown,
  exceptions: unknown,
  now: Date,
): AuditEvaluation;
