import type { CanvasDestination } from "../canvas/parts/destinations.js";

/**
 * Stable catalogue destinations of the older Browse artboards, independent
 * of the depicted product ids. Only the tag picker that the library runtime
 * test opens stays. Every other link opens a Canvas artboard.
 */
export const DESTINATIONS = {
  tagPicker: "design/browse/views/screen/tag-picker",
} as const;

export type DesignDestination =
  (typeof DESTINATIONS)[keyof typeof DESTINATIONS] | CanvasDestination;
