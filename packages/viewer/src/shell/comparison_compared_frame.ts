/**
 * The frame that Side by side compares. It starts on the first compared
 * frame, which in the compact layout is the picked frame, because the
 * compact canvas shows that frame alone; the frame chips of the Changes tab
 * choose another frame through `setComparedFrame`.
 */

import { useCallback, useState } from "react";

import type { ComparisonController } from "./use_comparison.js";

/**
 * A workspace's comparison controller with the frame that Side by side
 * compares, and the setter that the frame chips call.
 */
export type CanvasComparisonController = ComparisonController & {
  /** The key of the frame that Side by side compares. */
  comparedFrame: string | undefined;
  /** Choose the compared frame by its key, as a frame chip does. */
  setComparedFrame(key: string): void;
};

/** The reader's choice of the frame that Side by side compares. */
export interface ComparedFrameChoice {
  /** The key of the frame that the reader chose, if any. */
  chosen: string | undefined;
  /** Choose the compared frame by its key, as a frame chip does. */
  setComparedFrame(key: string): void;
}

/** Keep the reader's choice of the compared frame. */
export function useComparedFrameChoice(): ComparedFrameChoice {
  const [chosen, setChosen] = useState<string>();
  const setComparedFrame = useCallback((key: string) => setChosen(key), []);
  return { chosen, setComparedFrame };
}

/**
 * The key of the compared frame among the frames that compare: the chosen
 * frame while it compares, and else the first frame.
 */
export function comparedFrameKey(
  frames: readonly { key: string }[],
  chosen: string | undefined,
): string | undefined {
  return (frames.find((frame) => frame.key === chosen) ?? frames[0])?.key;
}
