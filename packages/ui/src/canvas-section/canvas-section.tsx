/**
 * The selected entry on the canvas: a section that holds its frames in a
 * grid, with a head at its top left. A screen's or a document's section is a
 * box with a faint fill and a hairline ring; a component's section, its
 * variant set, is a dashed outline. The head names the entry: its title in a
 * dark tag, a `Component` kind tag for a component, the path chip that
 * copies the entry's path, and its change status.
 */

import type { CSSProperties, ReactNode } from "react";

import { CanvasIcon } from "../icons/icons.js";

import {
  SECTION_GAPS,
  SECTION_PADDING,
  type CanvasCell,
  type CanvasSectionKind,
  type CanvasSize,
} from "./section-layout.js";

export {
  READING_MAX_WIDTH,
  readingSize,
  sectionExtent,
  type CanvasCell,
  type CanvasSectionKind,
  type CanvasSize,
} from "./section-layout.js";

/** One frame of a section: its cell, its nominal size, and the frame itself. */
export interface CanvasSectionFrame extends CanvasCell {
  /** Names the frame among the section's frames. */
  key: string;
  /** The frame, such as a `CanvasFrame` that holds the view's document. */
  node: ReactNode;
}

/** A cell's place in the grid, and the reading size of a reading frame. */
function cellStyle(
  frame: CanvasSectionFrame,
  reading: CanvasSize | undefined,
): CSSProperties {
  return {
    gridColumn: frame.column + 1,
    gridRow: frame.row + 1,
    ...(reading
      ? {
          "--mbk-canvas-frame-height": reading.height,
          "--mbk-canvas-frame-width": reading.width,
        }
      : {}),
  } as CSSProperties;
}

/**
 * The path chip of the head: it copies the path without navigating, or, in
 * a static depiction, is a picture of itself.
 */
function PathChip({
  interactive,
  onCopyPath,
  path,
}: {
  interactive: boolean;
  onCopyPath: ((path: string) => void) | undefined;
  path: string;
}) {
  return interactive ? (
    <button
      aria-label={`Copy path ${path}`}
      className="mbk-canvas-path-chip mbk-reset"
      data-copy-path={path}
      onClick={() => onCopyPath?.(path)}
      type="button"
    >
      {path}
    </button>
  ) : (
    <span className="mbk-canvas-path-chip mbk-reset" data-copy-path={path}>
      {path}
    </span>
  );
}

export function CanvasSection({
  frames,
  interactive = true,
  kind,
  onCopyPath,
  path,
  reading,
  status,
  title,
}: {
  frames: readonly CanvasSectionFrame[];
  /**
   * Whether the path chip is a button, as it is by default. A static
   * depiction that runs no script sets `false`.
   */
  interactive?: boolean;
  kind: CanvasSectionKind;
  /** Receives the path when the reader presses the path chip. */
  onCopyPath?: ((path: string) => void) | undefined;
  /** The entry's path as written, which the path chip shows. */
  path: string;
  /**
   * The nominal size of a document's reading frame, which the canvas sets
   * from its stage, so the document reflows to the room on the stage.
   */
  reading?: CanvasSize | undefined;
  /** The entry's change status, such as a `ChangeStatus`. */
  status?: ReactNode;
  title: string;
}) {
  const gaps = SECTION_GAPS[kind];
  return (
    <section
      className="mbk-canvas-section mbk-reset"
      data-canvas-section={kind}
      style={{
        padding: `${SECTION_PADDING.top}px ${SECTION_PADDING.right}px ${SECTION_PADDING.bottom}px ${SECTION_PADDING.left}px`,
      }}
    >
      <div className="mbk-canvas-section-head mbk-reset">
        <span className="mbk-canvas-title-tag mbk-reset">{title}</span>
        {kind === "component" ? (
          <span className="mbk-canvas-kind-tag mbk-reset">
            <CanvasIcon name="component" size={13} />
            Component
          </span>
        ) : null}
        <PathChip
          interactive={interactive}
          onCopyPath={onCopyPath}
          path={path}
        />
        {status}
      </div>
      <div
        className="mbk-canvas-frames mbk-reset"
        style={{ columnGap: gaps.column, rowGap: gaps.row }}
      >
        {frames.map((frame) => (
          <div
            className="mbk-canvas-cell mbk-reset"
            hidden={frame.hidden === true}
            key={frame.key}
            style={cellStyle(frame, kind === "document" ? reading : undefined)}
          >
            {frame.node}
          </div>
        ))}
      </div>
    </section>
  );
}
