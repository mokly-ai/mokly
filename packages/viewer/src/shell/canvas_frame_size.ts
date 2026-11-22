/**
 * The nominal size of a component's frame on the canvas. A component frame
 * holds its document at the size that its content needs; until a frame
 * adapter measures the content, it holds the size of a desktop frame.
 */

import type { Box } from "@mokly/frame";

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
 * document coordinates. The frame holds the box with the same margin on its
 * far edges as on its near edges, rounded up to whole pixels. Without a box,
 * as from an adapter that cannot measure the content, the frame takes the
 * desktop size.
 */
export function componentFrameSize(box?: Box | null): CanvasFrameSize {
  if (!box) return DESKTOP_FRAME_SIZE;
  return {
    height: Math.max(1, Math.ceil(box.y * 2 + box.height)),
    width: Math.max(1, Math.ceil(box.x * 2 + box.width)),
  };
}
