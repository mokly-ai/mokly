/**
 * The controls through which a host sizes the inspector: the separator above
 * an open inspector on a desktop, and the grab of the narrow sheet. The host
 * attaches its drag and its keys to them through refs, and it passes the
 * height, the bounds, and the sheet's state back as props. Without them, the
 * inspector takes the stylesheet's sizes.
 */

import type { CSSProperties, Ref } from "react";

/** The size of the inspector, which the host holds. */
export interface InspectorSize {
  /**
   * Whether the narrow sheet is expanded. The inspector carries the state as
   * `data-expanded`, and the grab reports it and names what it does. Without
   * it, the sheet is compact and carries no mark. A static depiction's sheet
   * starts in this state, and its grab switches it without a script.
   */
  expanded?: boolean | undefined;
  /** Receives the grab of the narrow sheet, for the host's drag and press. */
  grabRef?: Ref<HTMLButtonElement> | undefined;
  /**
   * The height of the open inspector on a desktop, in pixels, which
   * `--inspector-height` carries and the separator reports, rounded. Without
   * it, the stylesheet's 260px apply.
   */
  height?: number | undefined;
  /** The greatest height that the separator offers, in pixels: 600 by default. */
  maximumHeight?: number | undefined;
  /** The least height that the separator offers, in pixels: 160 by default. */
  minimumHeight?: number | undefined;
  /** Receives the separator above the open inspector, for the host's drag and keys. */
  resizeRef?: Ref<HTMLDivElement> | undefined;
  /**
   * The height of the narrow sheet while the reader drags its grab, in
   * pixels. Without it, the sheet takes the height of its state.
   */
  sheetHeight?: number | undefined;
}

/** The height that the stylesheet gives an open inspector, in pixels. */
const STYLESHEET_HEIGHT = 260;

/** The inline style of the inspector for the host's heights, if any. */
export function sizeStyle({
  height,
  sheetHeight,
}: InspectorSize): CSSProperties | undefined {
  if (height === undefined && sheetHeight === undefined) return undefined;
  const style: CSSProperties & { "--inspector-height"?: string } = {};
  if (height !== undefined) style["--inspector-height"] = `${height}px`;
  if (sheetHeight !== undefined) style.height = `${sheetHeight}px`;
  return style;
}

/** The separator and the sheet's grab of an interactive inspector. */
export function InspectorSizer({
  contentId,
  expanded,
  grabRef,
  height,
  maximumHeight = 600,
  minimumHeight = 160,
  resizeRef,
}: InspectorSize & {
  /** The id of the panels' region, which the separator resizes. */
  contentId: string;
}) {
  return (
    <>
      <div
        aria-controls={contentId}
        aria-label="Resize inspector"
        aria-orientation="horizontal"
        aria-valuemax={maximumHeight}
        aria-valuemin={minimumHeight}
        aria-valuenow={
          height === undefined ? STYLESHEET_HEIGHT : Math.round(height)
        }
        className="mbk-inspector-resize mbk-reset"
        data-inspector-resize=""
        ref={resizeRef}
        role="separator"
        tabIndex={0}
      />
      <button
        aria-expanded={expanded ?? false}
        aria-label={expanded ? "Make inspector compact" : "Expand inspector"}
        className="mbk-sheet-grab mbk-reset"
        data-inspector-size=""
        ref={grabRef}
        type="button"
      >
        <span className="mbk-reset" />
      </button>
    </>
  );
}
