/**
 * The highlight mask: a dimmed layer over a preview with a cutout and an
 * outline for each highlighted box, drawn as an SVG mask. Boxes that overlap
 * cut out one area, so their shared pixels never dim. The host measures the
 * boxes in the coordinates of the drawn area.
 */

import { useId } from "react";

/** One highlighted box, in pixels from the top left corner of the area. */
export interface HighlightBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A mask id from React's id, without the characters that a URL escapes. */
function maskId(generated: string): string {
  return `mbk-highlight-mask-${generated.replace(/[^A-Za-z0-9_-]/gu, "")}`;
}

export function HighlightMask({
  boxes,
  height,
  id,
  width,
}: {
  /** The highlighted boxes, in their drawing order. */
  boxes: readonly HighlightBox[];
  /** The height of the dimmed area, in pixels. */
  height: number;
  /**
   * The id of the mask element, which must be unique in the document. Without
   * it, the mask takes an id from React's `useId`.
   */
  id?: string | undefined;
  /** The width of the dimmed area, in pixels. */
  width: number;
}) {
  const generated = maskId(useId());
  const mask = id ?? generated;
  return (
    <svg
      aria-hidden="true"
      className="mbk-highlight-mask"
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
}
