/**
 * The zoom pill at the end of the design file's status bar: − 100% +. Every
 * page but the home draws it as a depiction inside the hidden status bar.
 * On the home it is a control: a group named Zoom with the Zoom out and Zoom
 * in buttons, the product's names, and the zoom between them as a whole
 * percentage. The home's zoom applies CSS `zoom` to its `main` and its
 * footer frame, so the tool bar and the status bar keep their size.
 */

import type { CSSProperties } from "react";

/** The zoom as the pill shows it: a whole percentage, such as `41%`. */
export function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/**
 * The inline style that draws a part at `zoom`, where 1 is 100%. A part at
 * 100% takes no style, as the site's page does before the first press.
 */
export function zoomStyle(zoom: number): CSSProperties | undefined {
  return zoom === 1 ? undefined : { zoom };
}

/** The depicted pill of every page but the home. */
export function SiteZoomDepiction() {
  return (
    <span className="site-statusbar-zoom">
      <span>−</span>
      100%
      <span>+</span>
    </span>
  );
}

/**
 * The home's pill: Zoom out, the zoom and Zoom in, in the box of the
 * depicted pill. The zoom is a polite live region. `zoom` is the home's
 * zoom, where 1 is 100%.
 */
export function SiteZoomControl({ zoom }: { zoom: number }) {
  return (
    <div
      aria-label="Zoom"
      className="site-statusbar-zoom site-statusbar-zoom--control"
      role="group"
    >
      <button
        aria-label="Zoom out"
        className="site-statusbar-zoom-step"
        type="button"
      >
        −
      </button>
      <span aria-live="polite" className="site-statusbar-zoom-value">
        {zoomPercent(zoom)}
      </span>
      <button
        aria-label="Zoom in"
        className="site-statusbar-zoom-step"
        type="button"
      >
        +
      </button>
    </div>
  );
}
