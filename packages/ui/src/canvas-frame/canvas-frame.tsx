/**
 * One frame on the canvas: a bare rectangle at its nominal size times the
 * canvas's zoom, with a hairline ring and a soft shadow, and no bezel, notch
 * or browser bar. It paints the opaque preview surface of its own scheme
 * and holds its document at the nominal size, scaled by the zoom, so the
 * document lays out at the same size at every zoom. A mono label stands
 * above its left edge, the glyph of its kind and its name, and the size tag
 * above its right edge; a frame too narrow for both keeps the label. A
 * reading frame reflows its document instead, so it has no size tag.
 */

import type { CSSProperties, ReactNode } from "react";

import { CanvasIcon, type CanvasIconName } from "../icons/icons.js";
import {
  FrameFailure,
  FrameUnavailable,
  type FrameRetry,
  type FrameScheme,
} from "../preview-frame/preview-frame.js";

/**
 * What a frame shows: a screen's `desktop` or `mobile` view, a `component`'s
 * view, or the `document` of a page or a Markdown document.
 */
export type CanvasFrameKind = "component" | "desktop" | "document" | "mobile";

/** The glyph that each kind of frame shows in its label. */
const GLYPHS: Readonly<Record<CanvasFrameKind, CanvasIconName>> = {
  component: "component",
  desktop: "desktop",
  document: "document",
  mobile: "mobile",
};

/**
 * A frame's size tag: its nominal width and height in whole CSS pixels,
 * rounded, such as `1280 × 800`, or `148 × 86` for a component's document of
 * 147.73 × 86.
 */
export function frameSizeTag(width: number, height: number): string {
  return `${Math.round(width)} × ${Math.round(height)}`;
}

/**
 * The frame's nominal size, which its box reads, and the box of its
 * document: the nominal size rounded up to whole pixels, so a document
 * whose measured size holds a fraction of a pixel fits without a scrollbar.
 * The frame's box clips that fraction.
 */
function sizeStyle(
  width: number | undefined,
  height: number | undefined,
): CSSProperties | undefined {
  if (width === undefined || height === undefined) return undefined;
  return {
    "--mbk-canvas-frame-document-height": Math.ceil(height),
    "--mbk-canvas-frame-document-width": Math.ceil(width),
    "--mbk-canvas-frame-height": height,
    "--mbk-canvas-frame-width": width,
  } as CSSProperties;
}

export function CanvasFrame({
  children,
  error = false,
  height,
  kind,
  label,
  retry,
  scheme,
  selected = false,
  width,
}: {
  /** The frame's document, such as a `PreviewIframe`. Without it, the preview is unavailable. */
  children?: ReactNode;
  /** Whether the frame's document failed to load. */
  error?: boolean;
  /**
   * The nominal height in CSS pixels, which can hold a fraction of a pixel,
   * as a component's measured document does. A reading frame leaves it out
   * and takes the reading size that its section gives.
   */
  height?: number | undefined;
  kind: CanvasFrameKind;
  /** The frame's name, such as `Desktop · Light` or `payment-terms.md`. */
  label: string;
  /** Try again on the line of a document that failed to load. */
  retry?: FrameRetry | undefined;
  /** The scheme of the frame's document, whose preview surface it paints. */
  scheme: FrameScheme;
  /** Whether the frame holds the selection, which lights its label. */
  selected?: boolean;
  /**
   * The nominal width in CSS pixels, which can hold a fraction of a pixel;
   * a reading frame leaves it out.
   */
  width?: number | undefined;
}) {
  const unavailable = children === undefined || children === null;
  return (
    <figure
      className="mbk-canvas-frame mbk-reset"
      data-canvas-frame={kind}
      data-preview-color-scheme={scheme}
      data-selected={selected ? "" : undefined}
      style={sizeStyle(width, height)}
    >
      <figcaption className="mbk-canvas-frame-label mbk-reset">
        <span className="mbk-canvas-frame-title mbk-reset">
          <CanvasIcon name={GLYPHS[kind]} size={12} />
          <span className="mbk-canvas-frame-name mbk-reset">{label}</span>
        </span>
        {kind !== "document" && width !== undefined && height !== undefined ? (
          <span className="mbk-canvas-frame-size mbk-reset">
            {frameSizeTag(width, height)}
          </span>
        ) : null}
      </figcaption>
      <div className="mbk-canvas-frame-clip mbk-reset">
        <div className="mbk-canvas-frame-document mbk-reset">{children}</div>
        {unavailable || error ? (
          <div className="mbk-canvas-frame-note mbk-reset">
            {unavailable ? <FrameUnavailable /> : null}
            {error ? <FrameFailure retry={retry} /> : null}
          </div>
        ) : null}
      </div>
    </figure>
  );
}
