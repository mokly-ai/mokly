/**
 * The states of a preview that has not arrived: the routed stage while the
 * entry's details load or after they failed, and a viewport of a removed
 * screen that has no captured previous version. A failed request offers one
 * retry.
 */

import type { Ref } from "react";

import { EmptyState } from "../empty-state/empty-state.js";

/** The routed stage while the entry's details load. */
export function StageLoading({
  focusRef,
}: {
  /** Receives the state, which the host focuses after Try again. */
  focusRef?: Ref<HTMLDivElement> | undefined;
} = {}) {
  return <EmptyState body="Loading preview…" busy focusRef={focusRef} stage />;
}

/**
 * The routed stage after the entry's details failed to load. The catalogue
 * stays available, and Try again asks for the details once more.
 */
export function StageFailure({
  noun,
  onRetry,
}: {
  /** What the entry is, such as "screen" or "user flow". */
  noun: string;
  /** Receives each press of Try again. */
  onRetry?: (() => void) | undefined;
}) {
  return (
    <EmptyState
      action={{ label: "Try again", onClick: onRetry }}
      body="The catalogue is still available while you try again."
      role="alert"
      title={`This ${noun} could not be shown`}
    />
  );
}

/**
 * A viewport of a removed screen that has no captured version, with the
 * other viewport to switch to, which a stage of both viewports hides.
 */
export function PreviewNotCaptured({
  viewport,
}: {
  viewport: "desktop" | "mobile";
}) {
  const other = viewport === "desktop" ? "Mobile" : "Desktop";
  return (
    <div className="mbk-preview-state mbk-reset">
      <p className="mbk-preview-note mbk-reset" role="status">
        No previous {viewport} version was captured.{" "}
        <span className="mbk-preview-switch mbk-reset">
          Switch to {other} to see it.
        </span>
      </p>
    </div>
  );
}
