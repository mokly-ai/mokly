/**
 * One frame on the canvas: a bare rectangle at its nominal size times the
 * canvas's zoom, with a hairline ring and a soft shadow, and no bezel, notch
 * or browser bar. It paints the opaque preview surface of its own scheme
 * and holds its document at the nominal size, scaled by the zoom, so the
 * document lays out at the same size at every zoom. A mono label stands
 * above its left edge, the glyph of its kind and its name, and the size tag
 * above its right edge; a frame too narrow for both keeps the label. A
 * reading frame reflows its document instead, so it has no size tag.
 *
 * A use case's step frame leads its label with the step's number, its name
 * is the link that opens the step's screen, and the step's description reads
 * muted below the label. A frame whose view was never captured keeps its
 * place, its size and its label, and holds a note in its place in place of
 * a document.
 */

import { useId, type CSSProperties, type ReactNode } from "react";

import {
  FrameFailure,
  FrameUnavailable,
  type FrameRetry,
  type FrameScheme,
} from "../preview-frame/preview-frame.js";

import { FrameLabel, type CanvasFrameLink } from "./frame-label.js";

export type { CanvasFrameLink } from "./frame-label.js";

/**
 * What a frame shows: a screen's `desktop` or `mobile` view, a `component`'s
 * view, or the `document` of a page or a Markdown document.
 */
export type CanvasFrameKind = "component" | "desktop" | "document" | "mobile";

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

/** The frame's box: its document, or the line of a missing or failed one. */
function FrameBox({
  children,
  error,
  retry,
}: {
  children: ReactNode;
  error: boolean;
  retry: FrameRetry | undefined;
}) {
  const unavailable = children === undefined || children === null;
  return (
    <div className="mbk-canvas-frame-clip mbk-reset">
      <div className="mbk-canvas-frame-document mbk-reset">{children}</div>
      {unavailable || error ? (
        <div className="mbk-canvas-frame-note mbk-reset">
          {unavailable ? <FrameUnavailable /> : null}
          {error ? <FrameFailure retry={retry} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export function CanvasFrame({
  children,
  description,
  error = false,
  focusVisible = false,
  height,
  kind,
  label,
  lightOnly = false,
  link,
  place,
  retry,
  scheme,
  selected = false,
  step,
  width,
}: {
  /** The frame's document, such as a `PreviewIframe`. Without it, the preview is unavailable. */
  children?: ReactNode;
  /**
   * A line below the label, such as a use-case step's description. It reads
   * muted, and a line too long for the frame ends in an ellipsis.
   */
  description?: string | undefined;
  /** Whether the frame's document failed to load. */
  error?: boolean;
  /**
   * Whether the frame's document shows keyboard focus, as the document
   * reports it, which draws the focus glow on the frame's box.
   */
  focusVisible?: boolean;
  /**
   * The nominal height in CSS pixels, which can hold a fraction of a pixel,
   * as a component's measured document does. A reading frame leaves it out
   * and takes the reading size that its section gives.
   */
  height?: number | undefined;
  kind: CanvasFrameKind;
  /** The frame's name, such as `Desktop · Light` or `payment-terms.md`. */
  label: string;
  /**
   * Whether the frame keeps its light view while Dark is chosen, because its
   * view has no dark render. The label then adds `Light only`.
   */
  lightOnly?: boolean;
  /**
   * The link that the frame's name is, with a chevron, such as the link of a
   * use-case step that opens the step's screen.
   */
  link?: CanvasFrameLink | undefined;
  /**
   * What stands in the frame's place in place of its document, such as the
   * note of a view that was never captured. The place keeps the frame's size
   * and label, but draws no surface, ring, shadow or size tag, and what it
   * holds keeps its size at every zoom.
   */
  place?: ReactNode;
  /** Try again on the line of a document that failed to load. */
  retry?: FrameRetry | undefined;
  /** The scheme of the frame's document, whose preview surface it paints. */
  scheme: FrameScheme;
  /** Whether the frame holds the selection, which lights its label. */
  selected?: boolean;
  /** The number of a use case's step, which leads the label in a dark tag. */
  step?: number | undefined;
  /**
   * The nominal width in CSS pixels, which can hold a fraction of a pixel;
   * a reading frame leaves it out.
   */
  width?: number | undefined;
}) {
  const descriptionId = useId();
  const placed = place !== undefined && place !== null;
  return (
    <figure
      aria-describedby={description ? descriptionId : undefined}
      className="mbk-canvas-frame mbk-reset"
      data-canvas-frame={kind}
      data-canvas-place={placed ? "" : undefined}
      data-focus-visible={focusVisible ? "" : undefined}
      data-preview-color-scheme={scheme}
      data-selected={selected ? "" : undefined}
      style={sizeStyle(width, height)}
    >
      <FrameLabel
        kind={kind}
        label={label}
        lightOnly={lightOnly}
        link={link}
        size={
          kind !== "document" &&
          !placed &&
          width !== undefined &&
          height !== undefined
            ? frameSizeTag(width, height)
            : undefined
        }
        step={step}
      />
      {description ? (
        <p
          className="mbk-canvas-frame-description mbk-reset"
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
      {placed ? (
        <div className="mbk-canvas-frame-place mbk-reset">{place}</div>
      ) : (
        <FrameBox error={error} retry={retry}>
          {children}
        </FrameBox>
      )}
    </figure>
  );
}
