import type {
  AuditCommand,
  AuditCommandResult,
} from "./dependency-audit-command.mjs";
import type { PrEnvironment } from "./dependency-audit-pr-input.mjs";

/** Inspected remote tip; absent branches and empty commit sets qualify as bot-only. */
export interface PrBranch {
  tip: string | null;
  botOnly: boolean;
}

/** Git and npm process boundaries share one checkout and a token-free environment. */
export interface PrGitDependencies {
  cwd: string;
  env: PrEnvironment;
  runCommand(command: AuditCommand): Promise<AuditCommandResult>;
}

/** Branch operations use actual history and leases, including branch deletion. */
export interface PrGit {
  inspectBranch(): Promise<PrBranch>;
  updateBranch(packages: readonly string[], tip: string | null): Promise<void>;
  deleteBranch(tip: string): Promise<void>;
}

/** Inspect actual remote history and write only with a lease on that inspected tip. */
export function createPrGit(dependencies: PrGitDependencies): PrGit;

/** Diagnostics keep the failing operation but never expose API tokens. */
export function prFailureMessage(error: unknown, env: PrEnvironment): string;
