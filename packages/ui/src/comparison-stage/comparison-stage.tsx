/**
 * The grid of a comparison's panes, and the failure of a comparison that
 * could not load, with Try again.
 */

import type { ReactNode } from "react";

import { EmptyAction } from "../empty-state/empty-state.js";

/** The grid of a comparison's panes in one comparison mode. */
export function ComparisonPanes({
  children,
  mode,
}: {
  children?: ReactNode;
  mode: "difference" | "overlay" | "side";
}) {
  return (
    <div className="mb-panes mbk-reset" data-compare-mode={mode}>
      {children}
    </div>
  );
}

/** A comparison that could not load: Try again, and the failure's details. */
export function ComparisonFailure({
  details,
  onRetry,
}: {
  /** What failed, for the reader who opens the details. */
  details: string;
  /** Receives each press of Try again. */
  onRetry?: (() => void) | undefined;
}) {
  return (
    <>
      <p className="mbk-reset">
        The comparison could not be loaded.{" "}
        <EmptyAction
          action={{
            label: "Try again",
            mark: "data-diff-refresh",
            onClick: onRetry,
          }}
        />
      </p>
      <details className="mbk-reset" data-comparison-failure="">
        <summary className="mbk-reset">Comparison details</summary>
        <p className="mbk-reset">{details}</p>
      </details>
    </>
  );
}
