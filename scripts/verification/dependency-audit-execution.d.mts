import type { Buffer } from "node:buffer";

import type {
  AuditCommand,
  AuditCommandResult,
} from "./dependency-audit-command.mjs";
import type { AuditEvaluation } from "./dependency-audit-evaluation.mjs";

/** Inputs needed to prove equality or evaluate a comparison tree. */
export const AUDIT_INPUT_FILES: readonly [
  "package.json",
  "package-lock.json",
  "scripts/verification/dependency-audit-exceptions.json",
];

/** Runtime boundaries for one audit, with a caller-owned clock snapshot. */
export interface AuditTreeDependencies {
  command: AuditCommand;
  runCommand(command: AuditCommand): Promise<AuditCommandResult>;
  readFile(file: string): Promise<Buffer>;
  now: Date;
}

/** The strict evaluation and raw inputs actually used by it. */
export interface AuditTreeResult {
  files: ReadonlyMap<string, Buffer>;
  evaluation: AuditEvaluation;
}

/** Run one live audit and strictly evaluate its output with these exact bytes. */
export function runAuditTree(
  dependencies: AuditTreeDependencies,
): Promise<AuditTreeResult>;
