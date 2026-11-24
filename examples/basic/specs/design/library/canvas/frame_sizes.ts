/**
 * The nominal size of each viewport's frame on the canvas, in CSS pixels: a
 * frame holds its screen at this size and scales it by the stage's zoom.
 */
export const FRAME_SIZES = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;
