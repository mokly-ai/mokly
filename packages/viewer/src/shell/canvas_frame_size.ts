/**
 * The nominal size of a component's frame on the canvas. A component frame
 * holds its document at the size that its content needs, which the frame's
 * adapter measures once after each load of the document. Until then, and
 * when the adapter cannot measure the content, it holds the size of a
 * desktop frame.
 */

import type { Box, MountedFrame } from "@mokly/frame";

/** A frame's nominal width and height in CSS pixels. */
export interface CanvasFrameSize {
  height: number;
  width: number;
}

/** The size of a desktop frame on the canvas. */
export const DESKTOP_FRAME_SIZE: CanvasFrameSize = Object.freeze({
  height: 800,
  width: 1280,
});

/** The size of a mobile frame on the canvas. */
export const MOBILE_FRAME_SIZE: CanvasFrameSize = Object.freeze({
  height: 844,
  width: 390,
});

/**
 * A component frame's size from the box of its document's content, in
 * document coordinates: the document's own size, which holds the box with
 * the same margin on its far edges as on its near edges and can hold a
 * fraction of a pixel. The frame's size tag rounds it. Without a box, as
 * from an adapter that cannot measure the content, the frame takes the
 * desktop size.
 */
export function componentFrameSize(box?: Box | null): CanvasFrameSize {
  if (!box) return DESKTOP_FRAME_SIZE;
  return {
    height: Math.max(1, box.y * 2 + box.height),
    width: Math.max(1, box.x * 2 + box.width),
  };
}

/**
 * The size of a component frame from one measurement of its mounted
 * document's content. An adapter without the measurement, a failed
 * measurement, and a document without content give the desktop size.
 */
export async function measuredFrameSize(
  mounted: Pick<MountedFrame, "contentBox">,
): Promise<CanvasFrameSize> {
  try {
    return componentFrameSize(await mounted.contentBox?.());
  } catch {
    return componentFrameSize();
  }
}
