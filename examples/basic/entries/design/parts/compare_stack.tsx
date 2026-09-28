import type { ReactNode } from "react";

import { FramedShot, type CompareViewport } from "./compare_page.js";

/** The comparison modes that stack both versions in one chrome. */
export type StackedMode = "difference" | "overlay";

/** Draws the one chrome around the viewport both versions share. */
export type StackChrome = (viewport: ReactNode) => ReactNode;

interface ComparisonStackProps {
  /** The Current version, drawn above the Before version. */
  after: ReactNode;
  before: ReactNode;
  chrome: StackChrome;
  mode: StackedMode;
  /** Depicts the shared viewport part-way down content taller than it. */
  scrolled?: boolean | undefined;
}

/**
 * Overlay and Difference draw one chrome, a device for a screen or the bordered
 * frame for a saved component variant, whose viewport is the only scroll
 * container. Both versions therefore always sit at one scroll position:
 * Current on top at half opacity in Overlay, or blended by difference over the
 * opaque Before layer.
 */
export function ComparisonStack({
  after,
  before,
  chrome,
  mode,
  scrolled,
}: ComparisonStackProps) {
  return (
    <div className="mbk-compare" data-compare-mode={mode}>
      {chrome(
        <div
          className="mbk-stack-viewport"
          data-scrolled={scrolled ? "" : undefined}
        >
          <div className="mbk-stack">
            <div className="mbk-stack-layer mbk-stack-layer--before">
              {before}
            </div>
            <div className="mbk-stack-layer mbk-stack-layer--after">
              {after}
            </div>
          </div>
          {scrolled ? (
            <span className="mbk-stack-scrollbar" aria-hidden="true">
              <span className="mbk-stack-thumb" />
            </span>
          ) : null}
        </div>,
      )}
    </div>
  );
}

/** A screen's browser window or phone, which follows the preview scheme. */
export function deviceChrome({
  address,
  dark,
  viewport,
}: {
  address: string;
  dark: boolean;
  viewport: CompareViewport;
}): StackChrome {
  return (scroller) => (
    <FramedShot address={address} dark={dark} viewport={viewport}>
      {scroller}
    </FramedShot>
  );
}
