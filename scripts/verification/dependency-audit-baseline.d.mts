import type { Buffer } from "node:buffer";

import type {
  AuditCommand,
  AuditCommandResult,
} from "./dependency-audit-command.mjs";
import type { AuditIssue } from "./dependency-audit-evaluation.mjs";
import type { AuditTreeResult } from "./dependency-audit-execution.mjs";

/** Raw comparison files and lifecycle of a disposable audit directory. */
export interface TemporaryAuditDirectory {
  path: string;
  writeFile(file: string, contents: Buffer): Promise<void>;
  dispose(): Promise<void>;
}

/** Git and temporary-file collaborators supplied by the composition root. */
export interface AuditBaselineDependencies {
  resolveComparisonCommit(): Promise<string>;
  readRevision(commit: string, file: string): Promise<Buffer>;
  makeTemporaryDirectory(): Promise<TemporaryAuditDirectory>;
}

/** Each baseline issue explicitly states whether it is inherited. */
export type InheritedAuditIssue = AuditIssue & { inherited: boolean };

/** A comparison keeps the commit once it has been resolved, even on failure. */
export interface AuditComparison {
  comparisonCommit?: string;
  issues: InheritedAuditIssue[];
}

/** All boundaries needed after the strict head evaluation has findings. */
export interface AuditComparisonDependencies {
  head: AuditTreeResult;
  command: AuditCommand;
  runCommand(command: AuditCommand): Promise<AuditCommandResult>;
  readFile(file: string): Promise<Buffer>;
  baseline: AuditBaselineDependencies;
  now: Date;
}

/** Compare raw input bytes before auditing the comparison tree through IO seams. */
export function compareDependencyAudit(
  dependencies: AuditComparisonDependencies,
): Promise<AuditComparison>;
