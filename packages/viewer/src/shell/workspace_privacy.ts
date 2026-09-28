/** Private Live workspace fields and their static evidence projection. */

import type { WorkspaceData } from "./workspace_data.js";

/** Remove private live-index metadata from the entry nested in evidence. */
export function workspaceEntryWithoutInteractive(
  entry: WorkspaceData["entry"],
): WorkspaceData["entry"] {
  const candidate = entry as WorkspaceData["entry"] & {
    interactive?: unknown;
  };
  if (!("interactive" in candidate)) return entry;
  const { interactive: _interactive, ...value } = candidate;
  return value;
}

/** Exclude Serve-only eligibility from the inert static workspace script. */
export function staticWorkspaceEvidence(data: WorkspaceData): WorkspaceData {
  const { interactive: _interactive, ...evidence } = data;
  return evidence;
}
