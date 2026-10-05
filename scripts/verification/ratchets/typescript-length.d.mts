import type { TypeScriptLengthInput } from "../repository-ratchets.mjs";

import type { GitWorkspace } from "./git.mjs";

/** Report source modules that exceed their predecessor's allowed length. */
export function typeScriptLengthFindings(
  changes: readonly TypeScriptLengthInput[],
): string[];

/** Audit current source candidates after whole-tree rename pairing. */
export function auditTypeScriptLength(
  repositoryRoot: string,
  git: GitWorkspace,
): {
  findings: string[];
  summary: string;
};
