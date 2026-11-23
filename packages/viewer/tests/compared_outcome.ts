/** The outcome line of one compared frame, as the comparison band lists it. */

import type { ComparedEntry } from "../src/review/types.js";
import { viewportFrameLabel } from "../src/shell/canvas_frames.js";
import { comparedFrameOutcome } from "../src/shell/comparison_outcome.js";
import { comparedFrames } from "../src/shell/comparison_selection.js";

const GENERATION = `https://example.test/mokly-viewer/diffs/generations/${"b".repeat(64)}/`;

/**
 * The outcome line of an entry's frame of one viewport and scheme, named by
 * its viewport and scheme, or `undefined` when the frame does not compare.
 */
export function frameOutcome(
  entry: ComparedEntry,
  kind: "component" | "screen",
  {
    scheme = "light",
    usingChanged = new Set(),
    viewport = "mobile",
  }: {
    scheme?: "dark" | "light";
    usingChanged?: ReadonlySet<string>;
    viewport?: "desktop" | "mobile";
  } = {},
): string | undefined {
  const [frame] = comparedFrames(
    [{ entry: { path: entry.path }, key: "frame", scheme, viewport }],
    new Map([[entry.path, { url: GENERATION }]]),
    () => ({ compared: entry, usingChanged }),
  );
  return frame
    ? comparedFrameOutcome(
        frame,
        viewportFrameLabel(viewport, scheme),
        kind === "component",
      )
    : undefined;
}
