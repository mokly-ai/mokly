/**
 * One version of a comparison: the labelled pane of Side by side, or a layer
 * of the stacked Overlay and Difference modes, with the shared viewport that
 * scrolls its documents, the opaque surface of each document, and the
 * bordered frame of a saved component variant. The host's scroll controller
 * reads the viewport, its range spacer, and each surface through refs; the
 * grid of panes is the comparison stage's.
 */

import type { ReactNode, Ref } from "react";

/** A version of a comparison: Before, or Current. */
export type ComparisonSide = "after" | "before";

/** The label of each version. */
const LABELS = { after: "Current", before: "Before" } as const;

/**
 * The pane of one version in Side by side: its label, then its chrome, or
 * the message of a version that has no document.
 */
export function ComparisonPane({
  children,
  missing,
  side,
}: {
  /** The chrome around the version's viewport. */
  children?: ReactNode;
  /**
   * Why the version has no document, such as "This screen did not exist
   * before." It takes the place of the chrome.
   */
  missing?: string | undefined;
  side: ComparisonSide;
}) {
  return (
    <div className={`mb-pane mb-pane--${side}`}>
      <p className="mb-pane-label">{LABELS[side]}</p>
      {missing === undefined ? (
        children
      ) : (
        <p className="mb-pane-missing">{missing}</p>
      )}
    </div>
  );
}

/**
 * One version's layer in the stacked modes. The Current layer lies above
 * the Before layer, at half opacity in Overlay and blended in Difference.
 */
export function ComparisonLayer({
  children,
  side,
}: {
  children?: ReactNode;
  side: ComparisonSide;
}) {
  return <div className={`mb-pane mb-pane--${side}`}>{children}</div>;
}

/**
 * The only scrollable container of one chrome's versions. A sticky box the
 * size of the viewport holds the device-sized frames, so viewport units and
 * fixed and sticky content render as in Current, and the spacer after it
 * extends the range to the largest document of the section.
 */
export function ComparisonViewport({
  children,
  ref,
  spacerRef,
}: {
  /** The versions: one pane document, or the stacked layers. */
  children?: ReactNode;
  /** Receives the viewport, which the host scrolls. */
  ref?: Ref<HTMLDivElement> | undefined;
  /** Receives the spacer, which the host sizes to the section's range. */
  spacerRef?: Ref<HTMLDivElement> | undefined;
}) {
  return (
    <div className="mb-viewport" data-comparison-viewport="" ref={ref}>
      <div className="mb-viewport-box">{children}</div>
      <div
        aria-hidden="true"
        className="mb-viewport-spacer"
        data-comparison-spacer=""
        ref={spacerRef}
      />
    </div>
  );
}

/**
 * The opaque surface under one version's document, which keeps the
 * document's scheme and the canvas colour that the host paints on it.
 */
export function ComparisonSurface({
  children,
  ref,
}: {
  /** The version's frame. */
  children?: ReactNode;
  /** Receives the surface, which the host shifts and paints. */
  ref?: Ref<HTMLDivElement> | undefined;
}) {
  return (
    <div className="mb-pane-doc" ref={ref}>
      {children}
    </div>
  );
}

/** The bordered frame of a saved component variant in a comparison. */
export function ComponentFrame({ children }: { children?: ReactNode }) {
  return <div className="mb-component-frame">{children}</div>;
}
