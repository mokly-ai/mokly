/**
 * The comparison of an entry in its workspace: the band of the comparison
 * toolbar, the Current preview, and the comparison stage, which shows one
 * section for each viewport with its panes, the line of a comparison that
 * is not available, or the failure with Try again.
 */

import type { ReactNode } from "react";

import { EmptyAction } from "../empty-state/empty-state.js";

/**
 * The band, the Current preview, and the comparison stage. Current shows the
 * preview and hides the stage; a comparison mode shows the stage, which says
 * that it loads until the host gives its content.
 */
export function ComparisonStage({
  busy = false,
  children,
  component = false,
  current,
  entryId,
  stage,
  toolbar,
}: {
  /** Whether the comparison or its documents load. */
  busy?: boolean;
  /** The Current preview. */
  children?: ReactNode;
  /** Whether the compared entry is a component. */
  component?: boolean;
  /** Whether Current is the shown mode. */
  current: boolean;
  /** The compared entry's path, which the comparison carries. */
  entryId: string;
  /** The sections of the comparison, or its failure. */
  stage?: ReactNode;
  /** The band of the comparison toolbar. */
  toolbar?: ReactNode;
}) {
  return (
    <section
      className="mbk-diff-screen"
      data-diff-component={component ? "" : undefined}
      data-diff-screen={entryId}
    >
      {toolbar}
      <div
        className="mbk-current-screen"
        data-current-screen=""
        hidden={!current}
      >
        {children}
      </div>
      <div
        aria-busy={busy ? true : undefined}
        aria-live="polite"
        className="mbk-diff-stage"
        data-diff-stage=""
        hidden={current}
      >
        {stage ?? "Loading comparison…"}
      </div>
    </section>
  );
}

/**
 * One viewport's section: its heading, which names the viewport, the
 * comparison's state, and a Light-only fallback, then its panes.
 */
export function ComparisonSection({
  children,
  label,
  lightOnly = false,
  viewport,
}: {
  /** The panes. */
  children?: ReactNode;
  /** The state of the comparison, such as "Screen changed". */
  label: string;
  /** Whether the shown view is Light while the reader asked for Dark. */
  lightOnly?: boolean;
  viewport: "desktop" | "mobile";
}) {
  return (
    <section
      className={`mbk-diff-view mbk-diff-${viewport}`}
      data-diff-viewport={viewport}
    >
      <h3>
        {viewport === "mobile" ? "Mobile" : "Desktop"} · {label}
        {lightOnly ? " · Light only" : ""}
      </h3>
      {children}
    </section>
  );
}

/** The grid of a section's panes in one comparison mode. */
export function ComparisonPanes({
  children,
  mode,
}: {
  children?: ReactNode;
  mode: "difference" | "overlay" | "side";
}) {
  return (
    <div className="mb-panes" data-compare-mode={mode}>
      {children}
    </div>
  );
}

/** The line of a comparison that has no record for the entry. */
export function ComparisonUnavailable({ message }: { message: string }) {
  return <p>{message}</p>;
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
      <p>
        The comparison could not be loaded.{" "}
        <EmptyAction
          action={{
            label: "Try again",
            mark: "data-diff-refresh",
            onClick: onRetry,
          }}
        />
      </p>
      <details data-comparison-failure="">
        <summary>Comparison details</summary>
        <p>{details}</p>
      </details>
    </>
  );
}
