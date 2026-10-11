import type { Buffer } from "node:buffer";

import type {
  AuditBaselineDependencies,
  InheritedAuditIssue,
} from "./dependency-audit-baseline.mjs";
import type {
  AuditCommand,
  AuditCommandResult,
} from "./dependency-audit-command.mjs";
import type { AuditIssue } from "./dependency-audit-evaluation.mjs";

/** Strict summaries contain no inheritance flags or comparison commit. */
export interface StrictAuditSummary {
  mode: "strict";
  ok: boolean;
  issues: AuditIssue[];
}

/** Baseline summaries retain every issue with its explicit inheritance state. */
export interface BaselineAuditSummary {
  mode: "baseline";
  ok: boolean;
  comparisonCommit?: string;
  issues: InheritedAuditIssue[];
}

/** JSON report contract, discriminated by mode and by each issue's kind. */
export type AuditSummary = StrictAuditSummary | BaselineAuditSummary;

/** Human notices accompany the result but are not issues in JSON summaries. */
export type AuditResult = AuditSummary & { notices: string[] };

/** Runtime collaborators for auditing, including raw bytes and optional reports. */
export interface AuditDependencies {
  args?: readonly string[];
  command: AuditCommand;
  runCommand(command: AuditCommand): Promise<AuditCommandResult>;
  readFile(file: string): Promise<Buffer>;
  clock(): Date;
  baseline?: AuditBaselineDependencies;
  writeReport?(file: string, summary: AuditSummary): Promise<void>;
  logger: {
    notice(message: string): void;
    error(message: string): void;
  };
}

/** Run strict or baseline auditing with injected process, bytes, time and logs. */
export function runDependencyAudit(
  dependencies: AuditDependencies,
): Promise<AuditResult>;
