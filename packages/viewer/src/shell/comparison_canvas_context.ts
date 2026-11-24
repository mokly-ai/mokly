/**
 * What a compare gives the canvas of its workspace: the section's frames
 * during the compare, the name of the shown section, and whether a state of
 * the comparison covers the canvas. A canvas outside a compare reads
 * nothing and shows its live frames.
 */

import { createContext, useContext } from "react";

import type { CanvasSectionFrame } from "@mokly/ui/canvas-section";

/** The compare on a workspace's canvas. */
export interface CanvasComparison {
  /**
   * Whether a state of the comparison covers the canvas, such as while it
   * loads, so the canvas leaves the dock's Fit alone.
   */
  covered: boolean;
  /** Names the shown section during the compare; a new name fits it again. */
  fitKey(live: string): string;
  /** The section's frames during the compare, from the live frames. */
  frames(live: readonly CanvasSectionFrame[]): readonly CanvasSectionFrame[];
}

export const CanvasComparisonContext = createContext<
  CanvasComparison | undefined
>(undefined);

/** The compare on the canvas of the workspace that renders it, if any. */
export function useCanvasComparison(): CanvasComparison | undefined {
  return useContext(CanvasComparisonContext);
}
