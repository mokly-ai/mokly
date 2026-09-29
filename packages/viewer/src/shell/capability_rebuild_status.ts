/** Sequence and source-fence adoption for private watched rebuild status. */

import type { RebuildStatus } from "../client/rebuild_status.js";

/** Active and future-fenced status retained by the shell capability store. */
export interface ViewerRebuildStatusState {
  pendingRebuildStatus?: RebuildStatus;
  rebuildStatus?: RebuildStatus;
}

/** Keep the newest sequence and expose it only after its source fence arrives. */
export function adoptViewerRebuildStatus(
  current: ViewerRebuildStatusState,
  updateVersion: number,
  candidate?: RebuildStatus,
): ViewerRebuildStatusState {
  let rebuildStatus = current.rebuildStatus;
  let pendingRebuildStatus = current.pendingRebuildStatus;
  const greatestSequence = Math.max(
    rebuildStatus?.sequence ?? 0,
    pendingRebuildStatus?.sequence ?? 0,
  );
  if (candidate && candidate.sequence > greatestSequence) {
    if (candidate.updateVersion <= updateVersion) {
      rebuildStatus = candidate;
      pendingRebuildStatus = undefined;
    } else {
      pendingRebuildStatus = candidate;
    }
  }
  if (
    pendingRebuildStatus &&
    pendingRebuildStatus.sequence > (rebuildStatus?.sequence ?? 0) &&
    pendingRebuildStatus.updateVersion <= updateVersion
  ) {
    rebuildStatus = pendingRebuildStatus;
    pendingRebuildStatus = undefined;
  }
  if (
    pendingRebuildStatus &&
    rebuildStatus &&
    pendingRebuildStatus.sequence <= rebuildStatus.sequence
  )
    pendingRebuildStatus = undefined;
  return {
    ...(pendingRebuildStatus ? { pendingRebuildStatus } : {}),
    ...(rebuildStatus ? { rebuildStatus } : {}),
  };
}
