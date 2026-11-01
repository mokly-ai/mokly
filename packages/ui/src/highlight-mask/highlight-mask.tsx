/**
 * The highlight mask: a dimmed layer over a preview with a cutout and an
 * outline for each highlighted box, drawn as an SVG mask. Boxes that overlap
 * cut out one area, so their shared pixels never dim. The host measures the
 * boxes in the coordinates of the drawn area. A static depiction that cannot
 * measure gives SVG lengths instead, which the drawing resolves against its
 * area.
 */

import { useId } from "react";

/**
 * A length of the drawing: pixels, or, in a static depiction, an SVG length
 * such as `100%` or `calc(100% - 48px)`.
 */
export type HighlightLength = number | string;

/** One highlighted box, from the top left corner of the area. */
export interface HighlightBox {
  x: HighlightLength;
  y: HighlightLength;
  width: HighlightLength;
  height: HighlightLength;
}

/** The host's visible frame box, in viewport or shell-root coordinates. */
export interface HighlightMaskPlacement {
  left: number;
  top: number;
  position: "absolute" | "fixed";
  expanded: boolean;
  hidden?: boolean | undefined;
  viewport?: "desktop" | "mobile" | undefined;
}

/** A mask id from React's id, without the characters that a URL escapes. */
function maskId(generated: string): string {
  return `mbk-highlight-mask-${generated.replace(/[^A-Za-z0-9_-]/gu, "")}`;
}

export function HighlightMask({
  boxes,
  height,
  id,
  placement,
  width,
}: {
  /** The highlighted boxes, in their drawing order. */
  boxes: readonly HighlightBox[];
  /** The height of the dimmed area. */
  height: HighlightLength;
  /**
   * The id of the mask element, which must be unique in the document. Without
   * it, the mask takes an id from React's `useId`.
   */
  id?: string | undefined;
  /** Wrap the mask in a clipped, pointer-transparent frame layer. */
  placement?: HighlightMaskPlacement | undefined;
  /** The width of the dimmed area. */
  width: HighlightLength;
}) {
  const generated = maskId(useId());
  const mask = id ?? generated;
  const drawing = (
    <svg
      aria-hidden="true"
      className="mbk-highlight-mask mbk-reset"
      height={height}
      width={width}
    >
      <mask id={mask} maskUnits="userSpaceOnUse">
        <rect className="mbk-highlight-kept" height={height} width={width} />
        {boxes.map((box, index) => (
          <rect
            className="mbk-highlight-cutout"
            height={box.height}
            key={index}
            width={box.width}
            x={box.x}
            y={box.y}
          />
        ))}
      </mask>
      <rect
        className="mbk-highlight-scrim"
        height={height}
        mask={`url(#${mask})`}
        width={width}
      />
      {boxes.map((box, index) => (
        <rect
          className="mbk-highlight-outline"
          height={box.height}
          key={index}
          rx={3}
          width={box.width}
          x={box.x}
          y={box.y}
        />
      ))}
    </svg>
  );
  if (!placement) return drawing;
  return (
    <div
      className="mbk-highlight-layer mbk-reset"
      data-highlight-viewport={placement.viewport}
      hidden={placement.hidden}
      style={{
        pointerEvents: "none",
        position: placement.position,
        left: placement.left,
        top: placement.top,
        width,
        height,
        zIndex: placement.expanded ? 951 : 4,
      }}
    >
      {drawing}
    </div>
  );
}
