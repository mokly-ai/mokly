import type { ReactNode } from "react";

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
 * One version's chrome viewport drawn part-way down its page, with that
 * viewport's own scrollbar. With Scroll together off, each Side by side
 * version keeps the place its reader left it, so the two can differ.
 */
export function ScrolledPage({
  children,
  offset,
}: {
  children: ReactNode;
  offset: PageOffset;
}) {
  return (
    <div className="mbk-page-viewport" data-scrolled={offset}>
      {children}
      <DrawnScrollbar />
    </div>
  );
}
