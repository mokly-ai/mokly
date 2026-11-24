/**
 * The zoom pill at the end of the design file's status bar: − 100% +. Every
 * page but the home draws it as a depiction inside the hidden status bar.
 * On the home it is a control: a group named Zoom with the Zoom out and Zoom
 * in buttons, the product's names, and the zoom between them as a whole
 * percentage. The home's zoom scales the hero, the workspace and the footer
 * frame, each in its layout of 100%, so nothing reflows, and the tool bar,
 * the Specs panel and the status bar keep their size. Below 100% the scaled
 * parts sit at the centre of the window's width. Above 100% the page grows
 * sideways by the zoom, as `home-zoom.css` draws it.
 */

import type { CSSProperties } from "react";

/** The ends of the home's zoom range, 8% and 200%, where 1 is 100%. */
export const ZOOM_RANGE = { min: 0.08, max: 2 } as const;

/** The zoom as the pill shows it: a whole percentage, such as `41%`. */
export function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/**
 * The inline style that draws a scaled part at `zoom`, where 1 is 100%. A
 * part at 100% takes no style, as the site's page does before the first
 * press.
 *
 * The site scales each part with a transform and a script that sets the
 * height the part takes. A static drawing runs no script, so it draws the
 * same scale with CSS `zoom`, which also scales the height. Under CSS
 * `zoom` a part's percentages resolve against its parent's width divided by
 * the zoom, so below 100% the part takes the zoom times its parent's width:
 * its own width is then its width of 100%, and it sits at the centre. Above
 * 100% the page root grows by the zoom, as `home-zoom.css` draws it, and a
 * part's own width of 100% is again the window's width.
 *
 * CSS `zoom` also sets the text at the zoomed size, where hinted glyphs do
 * not scale exactly and a line can break elsewhere. Geometric precision
 * keeps the glyphs' widths in scale, so the lines break as at 100%.
 */
export function zoomStyle(zoom: number): CSSProperties | undefined {
  if (zoom === 1) return undefined;
  const scaled = { textRendering: "geometricPrecision", zoom } as const;
  return zoom > 1
    ? scaled
    : { ...scaled, marginInline: "auto", width: `calc(100% * ${zoom})` };
}

/** The style of a page root zoomed in: the zoom that `home-zoom.css` reads. */
type ZoomedInStyle = CSSProperties & Record<"--home-zoom", number>;

/**
 * The page root's class and style at `zoom`. Above 100% the root takes the
 * zoomed-in class and carries the zoom as `--home-zoom`, so the page grows
 * sideways by the zoom and scrolls. At 100% and below it takes neither.
 */
export function zoomRoot(zoom: number): {
  className: string;
  style?: ZoomedInStyle;
} {
  return zoom > 1
    ? {
        className: "site-root site-root--zoomed-in",
        style: { "--home-zoom": zoom },
      }
    : { className: "site-root" };
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

/** The two buttons of the home's pill: the product's names and the glyphs. */
const ZOOM_STEPS = {
  out: { glyph: "−", label: "Zoom out" },
  in: { glyph: "+", label: "Zoom in" },
} as const;

/**
 * One button of the home's pill. At its end of the range the button takes
 * `aria-disabled`, so it keeps focus, and a press does nothing.
 */
function ZoomStep({
  atEnd,
  step,
}: {
  atEnd: boolean;
  step: keyof typeof ZOOM_STEPS;
}) {
  const { glyph, label } = ZOOM_STEPS[step];
  return (
    <button
      aria-disabled={atEnd ? "true" : undefined}
      aria-label={label}
      className="site-statusbar-zoom-step"
      type="button"
    >
      {glyph}
    </button>
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
      <ZoomStep atEnd={zoom <= ZOOM_RANGE.min} step="out" />
      <span aria-live="polite" className="site-statusbar-zoom-value">
        {zoomPercent(zoom)}
      </span>
      <ZoomStep atEnd={zoom >= ZOOM_RANGE.max} step="in" />
    </div>
  );
}
