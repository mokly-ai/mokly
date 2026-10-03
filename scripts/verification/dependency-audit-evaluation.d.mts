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

/** All failures and every risk accepted by the evaluator. */
export interface AuditEvaluation {
  ok: boolean;
  errors: string[];
  notices: string[];
}

/** Evaluate untrusted audit and file data without IO or ambient time. */
export function evaluateDependencyAudit(
  report: unknown,
  lockfile: unknown,
  exceptions: unknown,
  now: Date,
): AuditEvaluation;
