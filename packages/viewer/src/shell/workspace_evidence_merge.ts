/** Evidence-only workspace updates preserve the entry-owned workspace object. */

import type { WorkspaceData } from "./workspace_data.js";

/** Merge a newer evidence snapshot into the current route workspace. */
export function mergeWorkspaceEvidence(
  current: WorkspaceData,
  next: WorkspaceData,
): void {
  for (const key of [
    "status",
    "change",
    "reasons",
    "comparison",
    "resourceEvidence",
    "usageComplete",
    "viewUsagePending",
  ] as const)
    delete current[key];
  Object.assign(current, next);
}
