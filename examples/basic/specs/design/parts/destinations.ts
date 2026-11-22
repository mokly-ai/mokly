import type { CanvasDestination } from "../canvas/parts/destinations.js";
import type { ComponentDesignDestination } from "../components/parts/destinations.js";

/**
 * Stable catalogue destinations of the older Browse and Changes artboards,
 * independent of the depicted product ids. Only the artboards that wait for
 * an open decision stay: a use case and a removed entry's previous version,
 * and the tag picker that the library runtime test opens. Every other link
 * opens a Canvas artboard.
 */
export const DESTINATIONS = {
  pageRemoved: "design/browse/pages/removed",
  pageRemovedLong: "design/browse/pages/previous-version/long",
  pageRemovedLoading: "design/browse/pages/previous-version/loading",
  pageRemovedUnavailable: "design/browse/pages/previous-version/unavailable",
  tour: "design/browse/views/use-case",
  variantRemoved: "design/browse/variants/variant-removed",
  tagPicker: "design/browse/views/screen/tag-picker",
  appearanceLightOnlyDocument:
    "design/browse/appearance/states/light-only-document",
  appearanceFlow: "design/browse/appearance/status/flow",
  removed: "design/changes/outcomes/removed",
  removedLong: "design/changes/outcomes/previous-version/long",
  removedLoading: "design/changes/outcomes/previous-version/loading",
  removedUnavailable: "design/changes/outcomes/previous-version/unavailable",
  removedNoView: "design/changes/outcomes/previous-version/no-view",
} as const;

export type DesignDestination =
  | (typeof DESTINATIONS)[keyof typeof DESTINATIONS]
  | ComponentDesignDestination
  | CanvasDestination;
export type ComparisonMode =
  "current" | "side-by-side" | "overlay" | "difference";
