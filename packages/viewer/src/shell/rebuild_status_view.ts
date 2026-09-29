/** Product copy, timing and pure decisions for watched Serve's update status. */

import type { RebuildStatus } from "../client/rebuild_status.js";

/**
 * The approved notice, disclosure and progress copy. The failure detail is
 * developer text: it only ever appears inside the disclosed detail region.
 */
export const REBUILD_STATUS_COPY = {
  headline: "Your latest changes couldn’t be loaded.",
  explanation: "You’re seeing the last working version.",
  show: "Show details",
  hide: "Hide details",
  detailRegion: "Error details",
  progress: "Updating…",
} as const;

/** What `#mb-status` says, once, when a mounted document adopts a new failure. */
export const REBUILD_FAILURE_ANNOUNCEMENT = `${REBUILD_STATUS_COPY.headline} ${REBUILD_STATUS_COPY.explanation}`;

/** Uninterrupted `updating` time one client observes before it shows progress. */
export const REBUILD_PROGRESS_DELAY_MS = 1_000;

/**
 * The failure a document already accounts for when it mounts. A failure
 * present at first paint is ordinary document content, never announced.
 */
export function initialAccountedFailure(
  status: RebuildStatus | undefined,
): number {
  return status?.failure?.id ?? 0;
}

/**
 * Whether an adopted failure id is newer than every failure this document
 * has shown at first paint or already announced. Progress changes, replays of
 * the same id and a cleared failure never qualify.
 */
export function announcesFailure(
  accounted: number,
  failureId: number | undefined,
): failureId is number {
  return failureId !== undefined && failureId > accounted;
}
