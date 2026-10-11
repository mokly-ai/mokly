import type { PrGitDependencies } from "./dependency-audit-pr-git.mjs";
import type { PrFetch } from "./dependency-audit-pr-github.mjs";

/** All update-script collaborators; orchestration never reads ambient state. */
export interface DependencyAuditPrDependencies extends PrGitDependencies {
  args: readonly string[];
  readFile(file: string): Promise<string>;
  clock(): Date;
  fetch: PrFetch;
  logger: {
    notice(message: string): void;
    error(message: string): void;
  };
}

/** A handled audit finding succeeds; operational and input failures do not. */
export interface DependencyAuditPrResult {
  ok: boolean;
}

/** Maintain update pull requests using only the supplied IO, metadata and clock. */
export function runDependencyAuditPr(
  dependencies: DependencyAuditPrDependencies,
): Promise<DependencyAuditPrResult>;
