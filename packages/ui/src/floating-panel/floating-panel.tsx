/**
 * A panel that floats over the canvas: the catalogue at the canvas's left
 * edge, or the right panel at its right edge, 8px from the canvas's top,
 * bottom and outer edge, with a 12px radius, a hairline and a soft shadow.
 * Below the layout breakpoint the panel is a bottom sheet instead, which
 * shows only while it is open. The sheet spans the area that it covers and
 * opens at its compact height. Its grabber, the accessible size toggle,
 * switches it to its expanded height and back, also with a drag, and its
 * close control closes it. The grabber and the close control stand outside
 * the panel's body. An optional head, such as the right panel's tabs, stands
 * above the body and stays in place while the body scrolls. The sheet is not
 * modal, and a closed sheet stays mounted, so its content keeps its state.
 * In a static depiction that runs no script, the grabber and the close
 * control are pictures of themselves.
 */

import { useState, type CSSProperties, type ReactNode, type Ref } from "react";

import { CanvasIcon } from "../icons/canvas-icons.js";

import { SheetGrab, SheetGrabPicture } from "./sheet-grab.js";

/** The state of the sheet that the panel is below the layout breakpoint. */
export interface FloatingPanelSheet {
  /** Whether the open sheet takes its expanded height. */
  expanded: boolean;
  /** Receives each press of the close control. */
  onClose(): void;
  /** Receives the height that the grabber asks for. */
  onExpandedChange(expanded: boolean): void;
  /** Whether the sheet is open. */
  open: boolean;
}

/** The edge of the canvas at which a panel floats. */
export type FloatingPanelSide = "left" | "right";

/** The close control of the sheet, or a picture of it. */
function SheetClose({
  interactive,
  noun,
  onClose,
}: {
  interactive: boolean;
  noun: string;
  onClose(): void;
}) {
  const label = `Close ${noun}`;
  const glyph = <CanvasIcon name="close" size={18} />;
  if (!interactive)
    return (
      <span
        aria-label={label}
        className="mbk-float-close mbk-reset"
        data-sheet-close=""
        role="img"
        title={label}
      >
        {glyph}
      </span>
    );
  return (
    <button
      aria-label={label}
      className="mbk-float-close mbk-reset"
      data-sheet-close=""
      onClick={onClose}
      title={label}
      type="button"
    >
      {glyph}
    </button>
  );
}

export function FloatingPanel({
  children,
  head,
  interactive = true,
  label,
  noun,
  ref,
  scroll = false,
  sheet,
  side,
}: {
  /** The panel's content. */
  children?: ReactNode;
  /**
   * A strip above the body, such as the right panel's tabs, which stays in
   * place while the body scrolls.
   */
  head?: ReactNode;
  /**
   * Whether the sheet's grabber and close control are buttons, as they are
   * by default. A static depiction that runs no script sets `false`, which
   * draws each as a picture of itself, named by what it would do.
   */
  interactive?: boolean;
  /**
   * The panel's accessible name, which makes it a region. A panel whose
   * content names itself, such as the catalogue's navigation, leaves it out.
   */
  label?: string | undefined;
  /**
   * What the panel holds, in lower case, such as `catalogue` or `panel`. It
   * names the sheet's controls: `Close catalogue`, `Expand catalogue`, and
   * `Make catalogue compact`.
   */
  noun: string;
  /** Receives the panel. */
  ref?: Ref<HTMLElement> | undefined;
  /**
   * Whether the panel's body scrolls its content. Without it, the content
   * fills the body and scrolls its own parts, as the catalogue does.
   */
  scroll?: boolean;
  sheet: FloatingPanelSheet;
  side: FloatingPanelSide;
}) {
  const [dragHeight, setDragHeight] = useState<number>();
  const style: CSSProperties | undefined =
    dragHeight === undefined ? undefined : { height: `${dragHeight}px` };
  return (
    <section
      aria-label={label}
      className="mbk-float mbk-reset"
      data-floating-panel={side}
      data-sheet-dragging={dragHeight === undefined ? undefined : ""}
      data-sheet-expanded={sheet.expanded ? "" : undefined}
      data-sheet-open={sheet.open ? "" : undefined}
      ref={ref}
      style={style}
    >
      {interactive ? (
        <SheetGrab
          expanded={sheet.expanded}
          noun={noun}
          onDrag={setDragHeight}
          onExpandedChange={sheet.onExpandedChange}
        />
      ) : (
        <SheetGrabPicture expanded={sheet.expanded} noun={noun} />
      )}
      <SheetClose
        interactive={interactive}
        noun={noun}
        onClose={sheet.onClose}
      />
      {head === undefined ? null : (
        <div className="mbk-float-head mbk-reset">{head}</div>
      )}
      <div
        className="mbk-float-body mbk-reset"
        data-floating-scroll={scroll ? "" : undefined}
      >
        {children}
      </div>
    </section>
  );
}
