import { useRenderedAppearance } from "../../parts/appearance.js";

import type { CanvasFrameSpec, FrameScheme } from "./frames.js";

/** A frame as the compact frame picker lists it. */
type ListedFrame = Pick<CanvasFrameSpec, "id" | "kind" | "scheme">;

/** The viewports in the order of the shell's picker: Mobile before Desktop. */
const VIEWPORTS: readonly ListedFrame["kind"][] = ["mobile", "desktop"];

/**
 * A frame's place in the shell's picker: Mobile before Desktop, and Light
 * before Dark in each viewport.
 */
function listedPlace({ kind, scheme }: ListedFrame): number {
  const viewport = VIEWPORTS.indexOf(kind);
  return (
    (viewport < 0 ? VIEWPORTS.length : viewport) * 2 +
    (scheme === "light" ? 0 : 1)
  );
}

/**
 * The frame that the compact form opens a screen on, by its id, of the
 * frames that the picker lists: the Mobile frame of the preview scheme, or,
 * while the picker does not list that frame, because the Frames filter hides
 * it or the screen has no dark view, the first frame that the shell's picker
 * lists. Standalone Browse takes the preview scheme from the appearance, so
 * a Dark artboard opens on Mobile · Dark.
 */
export function openingFrame(
  frames: readonly ListedFrame[],
  scheme: FrameScheme,
): string {
  const [first] = [...frames].sort(
    (one, other) => listedPlace(one) - listedPlace(other),
  );
  const opening =
    frames.find(
      (frame) => frame.kind === "mobile" && frame.scheme === scheme,
    ) ?? first;
  if (opening === undefined)
    throw new Error("A screen opens on a frame that its picker lists.");
  return opening.id;
}

/**
 * The frame that the compact form opens a screen on, in the scheme that the
 * artboard renders in.
 */
export function useOpeningFrame(frames: readonly ListedFrame[]): string {
  return openingFrame(frames, useRenderedAppearance());
}
