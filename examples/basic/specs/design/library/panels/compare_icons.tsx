import type { ReactNode } from "react";

import type { CompareModesProps } from "./compare-modes.js";

/** A translucent fill inside a mode's icon, such as the current layer. */
function Fill({ d }: { d: string }) {
  return <path d={d} fill="currentColor" fillOpacity={0.3} stroke="none" />;
}

/**
 * The strokes of each mode's icon, on a 28 × 20 grid: one frame for Current,
 * two frames for Side by side, a translucent frame over another for Overlay,
 * their shared area for Difference, and a frame split by a divider for
 * Swipe. The module creates no element while it loads, as the Canvas glyphs.
 */
const SHAPES: Record<CompareModesProps["mode"], () => ReactNode> = {
  current: () => <rect x="7" y="3" width="14" height="14" rx="2" />,
  "side-by-side": () => (
    <>
      <rect x="1.5" y="4" width="11" height="12" rx="2" />
      <rect x="15.5" y="4" width="11" height="12" rx="2" />
    </>
  ),
  overlay: () => (
    <>
      <rect x="3" y="2.5" width="14" height="11" rx="2" />
      <rect
        x="11"
        y="6.5"
        width="14"
        height="11"
        rx="2"
        fill="currentColor"
        fillOpacity={0.3}
      />
    </>
  ),
  difference: () => (
    <>
      <rect x="3" y="2.5" width="13" height="11" rx="2" />
      <rect x="12" y="6.5" width="13" height="11" rx="2" />
      <Fill d="M12 6.5h4v7h-4z" />
    </>
  ),
  swipe: () => (
    <>
      <rect x="5" y="3" width="18" height="14" rx="2" />
      <path d="M14 1v18" />
      <Fill d="M14 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7z" />
    </>
  ),
};

/** The icon of one compare mode, in `currentColor`, hidden from assistive technology. */
export function CompareIcon({ mode }: { mode: CompareModesProps["mode"] }) {
  return (
    <svg
      aria-hidden="true"
      className="cv-mode-icon"
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
