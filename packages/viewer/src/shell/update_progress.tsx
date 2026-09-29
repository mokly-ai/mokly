/** Watched Serve's delayed update progress beside the top bar's search field. */

import type { ReactNode } from "react";

import { useViewerLiveState } from "./capability_context.js";
import { useDelayedProgress } from "./rebuild_progress.js";
import { REBUILD_STATUS_COPY } from "./rebuild_status_view.js";

/**
 * The visible progress text with its supplementary ring. It is ordinary text,
 * not a live region, so saving a change never makes the shell speak.
 */
export function UpdateProgressView() {
  return (
    <span className="mbk-progress">
      <span aria-hidden="true" className="mbk-progress-spinner" />
      {REBUILD_STATUS_COPY.progress}
    </span>
  );
}

/**
 * Give the search field and delayed progress one shared flexible allotment in
 * watched Serve, so showing progress narrows only the field and never moves
 * the brand, menu or Appearance. Every other shell keeps the bare field.
 */
export function SearchSlot({ children }: { children: ReactNode }) {
  const status = useViewerLiveState().rebuildStatus;
  if (!status) return children;
  return (
    <div className="mbk-search-slot">
      {children}
      <DelayedUpdateProgress updating={status.updating} />
    </div>
  );
}

function DelayedUpdateProgress({ updating }: { updating: boolean }) {
  return useDelayedProgress(updating) ? <UpdateProgressView /> : null;
}
