import { createContext, useContext, type ReactNode } from "react";

import type { HighlightBox } from "../../../../../packages/ui/src/highlight-mask/highlight-mask.js";
import type { ViewControlsProps } from "../library/controls/view-controls.js";

import type { DesignDestination } from "./destinations.js";
import type { ArtboardViewport } from "./shell.js";

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
export type HighlightReason = NonNullable<ViewControlsProps["unavailable"]>;

/**
 * The record of one depicted view: the Highlight components state that the
 * shell shows for it and, where the shell can highlight the view, the regions
 * that its preview highlights in each viewport. A view that the shell can
 * highlight always has regions, so no header draws an operable switch over a
 * preview that highlights nothing.
 */
export type DepictedView =
  | {
      /** `on` depicts the shell while it highlights the view. */
      highlight: "available" | "on";
      regions: ViewRegions;
    }
  | { highlight: HighlightReason };

/** The Highlight components state of a depicted view. */
export type HighlightState = DepictedView["highlight"];

const View = createContext<DepictedView | undefined>(undefined);

/**
 * Holds the record of the view that a workspace depicts, which its header's
 * view controls and its preview both read.
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

/** The record of the view that the nearest workspace depicts. */
export function useDepictedView(): DepictedView {
  const view = useContext(View);
  if (view === undefined)
    throw new Error(
      "View controls need the record of the view that their workspace depicts.",
    );
  return view;
}

/**
 * The regions that one viewport's preview of the depicted view highlights:
 * none outside a workspace, or where the shell cannot highlight the view.
 */
export function useHighlightRegions(
  viewport: ArtboardViewport,
): readonly HighlightRegion[] {
  const view = useContext(View);
  return view !== undefined && "regions" in view ? view.regions[viewport] : [];
}
