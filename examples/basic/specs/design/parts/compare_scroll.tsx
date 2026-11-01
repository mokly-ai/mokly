import type { ReactNode } from "react";

import {
  ComparisonSurface,
  ComparisonViewport,
} from "../../../../../packages/ui/src/comparison-pane/comparison-pane.js";

/**
 * A scrollbar drawn where a static artboard cannot scroll. It spans the region
 * it belongs to; its thumb's position and size come from the scroll position
 * that region declares in CSS, so the drawn thumb always matches the drawn
 * offset and the share of content in view.
 */
export function DrawnScrollbar() {
  return (
    <span className="mbk-scrollbar" aria-hidden="true">
      <span className="mbk-scrollbar-thumb" />
    </span>
  );
}

/** How far down its page a Side by side version is drawn. */
export type PageOffset = "short" | "long";

/**
 * One version's page in the shipped viewport of its chrome, drawn part-way
 * down on its opaque surface, with that viewport's own scrollbar. With Scroll
 * together off, each Side by side version keeps the place its reader left
 * it, so the two can differ.
 */
export function ScrolledPage({
  children,
  offset,
}: {
  children: ReactNode;
  offset: PageOffset;
}) {
  return (
    <ComparisonViewport>
      <ComparisonSurface>
        <div className="mbk-page-viewport" data-scrolled={offset}>
          {children}
          <DrawnScrollbar />
        </div>
      </ComparisonSurface>
    </ComparisonViewport>
  );
}
