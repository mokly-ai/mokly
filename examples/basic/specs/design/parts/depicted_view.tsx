import { createContext, useContext, type ReactNode } from "react";

import type { HighlightBox } from "../../../../../packages/ui/src/highlight-mask/highlight-mask.js";
import type { FramesFilterProps } from "../library/inspector/frames-filter.js";

import type { ArtboardViewport } from "./artboards.js";
import type { DesignDestination } from "./destinations.js";

/**
 * One highlighted instance of a depicted preview: its box in the depicted
 * document, which the preview draws it in and the mask cuts out, and the
 * shell's label of it, the component's title and the instance's id.
 */
export interface HighlightRegion {
  box: HighlightBox;
  label: string;
  /** The artboard that shows the instance selected, which the label opens. */
  to?: DesignDestination | undefined;
}

/** The regions of one viewport's preview: at least one. */
export type PreviewRegions = readonly [HighlightRegion, ...HighlightRegion[]];

/** The regions of a depicted view's preview in each viewport. */
export type ViewRegions = Readonly<Record<ArtboardViewport, PreviewRegions>>;

/** Why the shell disables Highlight components for a view. */
export type HighlightReason = NonNullable<FramesFilterProps["unavailable"]>;

/**
 * The record of one depicted view: the Highlight components state that the
 * shell shows for it and, where the shell can highlight the view, the regions
 * that its preview highlights in each viewport. A view that the shell can
 * highlight always has regions.
 */
export type DepictedView =
  | {
      /** `on` depicts the shell while it highlights the view. */
      highlight: "available" | "on";
      regions: ViewRegions;
    }
  | { highlight: HighlightReason };

const View = createContext<DepictedView | undefined>(undefined);

/**
 * Holds the record of the view that a stage depicts, which the highlight
 * layer over each of its previews reads.
 */
export function DepictedViewScope({
  children,
  view,
}: {
  children?: ReactNode;
  view: DepictedView;
}) {
  return <View value={view}>{children}</View>;
}

/**
 * The regions that one viewport's preview of the depicted view highlights:
 * none outside a depicted view's scope, or where the shell cannot highlight
 * the view.
 */
export function useHighlightRegions(
  viewport: ArtboardViewport,
): readonly HighlightRegion[] {
  const view = useContext(View);
  return view !== undefined && "regions" in view ? view.regions[viewport] : [];
}
