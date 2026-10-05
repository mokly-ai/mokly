import type { InternalExportModule } from "../repository-ratchets.mjs";

import type { GitWorkspace } from "./git.mjs";

/** Compare unused names with a shrink-only, rename-aware baseline. */
export function internalExportAudit(input: {
  modules: readonly InternalExportModule[];
  publicEntrypoints: readonly string[];
  baseline: readonly string[];
  baselineAtComparison?: readonly string[];
  aliases?: Readonly<Record<string, string>>;
  predecessors?: Readonly<Record<string, string>>;
}): { findings: string[]; unused: string[] };

/** Read and audit the current workspace's internal exports. */
export function auditInternalExports(
  repositoryRoot: string,
  git: GitWorkspace,
): {
  findings: string[];
  summary: string;
};
