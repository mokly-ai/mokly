/**
 * The states of a preview that has not arrived: the routed stage while the
 * entry's details load or after they failed, and a removed entry's previous
 * version while it loads, when it is unavailable, and for a viewport that was
 * not captured. A failed request offers one retry.
 */

import {
  EmptyState,
  type EmptyStateButton,
} from "../empty-state/empty-state.js";
import { Stage } from "../stage/stage.js";

/** The routed stage while the entry's details load. */
export function StageLoading() {
  return <EmptyState body="Loading preview…" busy stage />;
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

/** A removed entry's stage while its previous version loads. */
export function PreviewLoading() {
  return (
    <Stage>
      <div className="mbk-preview-state mbk-reset">
        <p className="mbk-preview-status mbk-reset" role="status">
          <span aria-hidden="true" className="mbk-preview-spinner mbk-reset" />
          Loading previous version…
        </p>
      </div>
    </Stage>
  );
}

/**
 * A removed entry's stage when its previous version cannot show, with the
 * host's wording. A failed request adds the retry action.
 */
export function PreviewUnavailable({
  body,
  retry,
  title,
}: {
  body: string;
  retry?: EmptyStateButton | undefined;
  title: string;
}) {
  return (
    <Stage>
      <EmptyState action={retry} body={body} title={title} />
    </Stage>
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
