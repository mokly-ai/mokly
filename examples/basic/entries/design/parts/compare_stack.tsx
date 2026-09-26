import type { ReactNode } from "react";

import { FramedShot, type CompareViewport } from "./compare_page.js";

/** The comparison modes that stack both versions in one device chrome. */
export type StackedMode = "difference" | "overlay";

interface ComparisonStackProps {
  address: string;
  /** The Current version, drawn above the Before version. */
  after: ReactNode;
  before: ReactNode;
  /** Both versions follow the depicted preview scheme together. */
  dark: boolean;
  mode: StackedMode;
  /** Depicts the shared viewport part-way down a screen taller than it. */
  scrolled?: boolean | undefined;
  viewport: CompareViewport;
}

/**
 * Overlay and Difference draw one device chrome whose viewport is the only
 * scroll container. Both versions fill it at the taller of their two heights,
 * so they always share one offset: Current sits on top at half opacity in
 * Overlay, or blends by difference over the opaque Before layer.
 */
export function ComparisonStack({
  address,
  after,
  before,
  dark,
  mode,
  scrolled,
  viewport,
}: ComparisonStackProps) {
  return (
    <div className="mbk-compare" data-compare-mode={mode}>
      <FramedShot address={address} dark={dark} viewport={viewport}>
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
        </div>
      </FramedShot>
    </div>
  );
}
