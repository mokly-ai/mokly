// The glyphs of the canvas, on the 16-unit grid of the Canvas design: the
// kinds of frame that a frame's label starts with, and the zoom pill's
// controls. They stroke at 1.5 units in `currentColor`, as the Canvas design
// library draws them, and the icons entry exports them.

import type { ReactNode } from "react";

/** The canvas glyphs: a frame's kind, and the zoom pill's controls. */
export type CanvasIconName =
  | "component"
  | "desktop"
  | "document"
  | "fit"
  | "mobile"
  | "zoom-in"
  | "zoom-out";

/** The strokes of each glyph on its 16-unit grid. */
const STROKES: Record<CanvasIconName, () => ReactNode> = {
  component: () => (
    <path d="M8 1.6 10.1 3.7 8 5.8 5.9 3.7zM8 10.2l2.1 2.1L8 14.4l-2.1-2.1zM3.7 5.9 5.8 8l-2.1 2.1L1.6 8zM12.3 5.9 14.4 8l-2.1 2.1L10.2 8z" />
  ),
  desktop: () => (
    <>
      <rect height={8.6} rx={1.5} width={12.4} x={1.8} y={2.4} />
      <path d="M5.6 13.8h4.8M8 11v2.8" />
    </>
  ),
  document: () => (
    <>
      <path d="M4 1.9h5l3.1 3.1v8c0 .6-.5 1.1-1.1 1.1H4c-.6 0-1.1-.5-1.1-1.1V3c0-.6.5-1.1 1.1-1.1z" />
      <path d="M9 1.9V5h3.1" />
    </>
  ),
  fit: () => (
    <>
      <path d="M2.4 5.6V3.4c0-.6.4-1 1-1h2.2M10.4 2.4h2.2c.6 0 1 .4 1 1v2.2M13.6 10.4v2.2c0 .6-.4 1-1 1h-2.2M5.6 13.6H3.4c-.6 0-1-.4-1-1v-2.2" />
      <rect height={5.2} rx={1} width={5.2} x={5.4} y={5.4} />
    </>
  ),
  mobile: () => (
    <>
      <rect height={12.8} rx={1.8} width={7.4} x={4.3} y={1.6} />
      <path d="M7 12.3h2" />
    </>
  ),
  "zoom-in": () => <path d="M8 3.5v9M3.5 8h9" />,
  "zoom-out": () => <path d="M3.5 8h9" />,
};

/** One canvas glyph, decorative, in the current colour. */
export function CanvasIcon({
  name,
  size = 16,
}: {
  name: CanvasIconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="mbk-reset"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 16 16"
      width={size}
    >
      {STROKES[name]()}
    </svg>
  );
}
