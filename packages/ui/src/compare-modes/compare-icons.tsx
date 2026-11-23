// The private glyphs of the compare modes: each mode's icon on a 28 × 20
// grid, and Refresh on the 16-unit grid of the canvas glyphs. They stroke in
// `currentColor`, are hidden from assistive technology, and create no element
// while the module loads, as the canvas glyphs do.

import type { ReactNode } from "react";

import type { CompareMode } from "./compare-modes.js";

/** A translucent fill inside a mode's icon, such as the current layer. */
function Fill({ d }: { d: string }) {
  return <path d={d} fill="currentColor" fillOpacity={0.3} stroke="none" />;
}

/**
 * The strokes of each mode's icon: one frame for Current, two frames for Side
 * by side, a translucent frame over another for Overlay, their shared area
 * for Difference, and a frame split by a divider for Swipe.
 */
const SHAPES: Record<CompareMode, () => ReactNode> = {
  current: () => <rect height={14} rx={2} width={14} x={7} y={3} />,
  side: () => (
    <>
      <rect height={12} rx={2} width={11} x={1.5} y={4} />
      <rect height={12} rx={2} width={11} x={15.5} y={4} />
    </>
  ),
  overlay: () => (
    <>
      <rect height={11} rx={2} width={14} x={3} y={2.5} />
      <rect
        fill="currentColor"
        fillOpacity={0.3}
        height={11}
        rx={2}
        width={14}
        x={11}
        y={6.5}
      />
    </>
  ),
  difference: () => (
    <>
      <rect height={11} rx={2} width={13} x={3} y={2.5} />
      <rect height={11} rx={2} width={13} x={12} y={6.5} />
      <Fill d="M12 6.5h4v7h-4z" />
    </>
  ),
  swipe: () => (
    <>
      <rect height={14} rx={2} width={18} x={5} y={3} />
      <path d="M14 1v18" />
      <Fill d="M14 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7z" />
    </>
  ),
};

/** The icon of one compare mode, which leads its tile. */
export function CompareModeIcon({ mode }: { mode: CompareMode }) {
  return (
    <svg
      aria-hidden="true"
      className="mbk-compare-icon mbk-reset"
      fill="none"
      height={20}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.4}
      viewBox="0 0 28 20"
      width={28}
    >
      {SHAPES[mode]()}
    </svg>
  );
}

/** The refresh glyph: an open circle with its arrow at the top end. */
export function RefreshGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="mbk-reset"
      fill="none"
      height={15}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 16 16"
      width={15}
    >
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M11.8 1.9v2.8H9" />
    </svg>
  );
}
