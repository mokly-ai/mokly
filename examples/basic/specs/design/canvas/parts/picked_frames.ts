import { useRenderedAppearance } from "../../parts/appearance.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import type { CanvasFrameSpec, FrameScheme } from "./frames.js";
import { frameOf } from "./set_sketches.js";

/** A frame as the compact frame picker lists it. */
type ListedFrame = Pick<CanvasFrameSpec, "id" | "kind" | "scheme">;

/** The viewports in the order of the shell's picker: Mobile before Desktop. */
const VIEWPORTS: readonly ListedFrame["kind"][] = ["mobile", "desktop"];

/** Whether a frame is a screen's frame, which a viewport names. */
function screenFrame({ kind }: ListedFrame): boolean {
  return VIEWPORTS.includes(kind);
}

/**
 * A screen frame's place in the shell's picker: Mobile before Desktop, and
 * Light before Dark in each viewport.
 */
function listedPlace({ kind, scheme }: ListedFrame): number {
  return VIEWPORTS.indexOf(kind) * 2 + (scheme === "light" ? 0 : 1);
}

/**
 * The frames in the order that the shell's frame picker lists them: a
 * screen's Mobile frames before its Desktop frames, and Light before Dark in
 * each viewport. A variant set's frames keep the set's order.
 */
export function pickerFrames<Frame extends ListedFrame>(
  frames: readonly Frame[],
): Frame[] {
  return frames.every(screenFrame)
    ? [...frames].sort((one, other) => listedPlace(one) - listedPlace(other))
    : [...frames];
}

/**
 * The frame that the compact form opens a screen on, by its id, of the
 * frames that the picker lists: the Mobile frame of the preview scheme, or,
 * while the picker does not list that frame, because the Frames filter hides
 * it or the screen has no dark view, the first frame that the picker lists.
 * Standalone Browse takes the preview scheme from the appearance, so a Dark
 * artboard opens on Mobile · Dark.
 */
export function openingFrame(
  frames: readonly ListedFrame[],
  scheme: FrameScheme,
): string {
  const listed = pickerFrames(frames);
  const opening =
    listed.find(
      (frame) => frame.kind === "mobile" && frame.scheme === scheme,
    ) ?? listed[0];
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

/**
 * The frame that a saved variant's choice selects, as the Variants list of
 * Inspect or the variant's own route chooses it: its row's Light frame on
 * the wide canvas, and on a phone its row's frame of the selection's scheme,
 * which standalone Browse takes from the appearance that the artboard
 * renders in. A row without a frame of that scheme keeps its Light frame.
 */
export function useChosenFrame(
  frames: readonly CanvasFrameSpec[],
  variant: string,
  viewport: ArtboardViewport,
): CanvasFrameSpec {
  const scheme = useRenderedAppearance();
  const compact =
    viewport === "mobile"
      ? frames.find(
          (frame) => frame.variant === variant && frame.scheme === scheme,
        )
      : undefined;
  return compact ?? frameOf(frames, `${variant}-light`);
}
