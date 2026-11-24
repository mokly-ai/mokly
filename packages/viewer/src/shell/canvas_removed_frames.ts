/**
 * The frames of a removed screen's previous version on the canvas: one frame
 * for each historical view, as a current screen's section holds its views.
 * Desktop stands beside Mobile, and the Light row above the Dark row, or the
 * Light row alone without a historical dark view. In the Dark row, a
 * viewport without a dark view keeps its Light view and says so. A viewport
 * without any historical view has the place of each of its frames, which
 * holds the note that no previous version was captured. The Frames filter
 * keeps the columns of its viewports and the rows of its schemes, as it does
 * for a current screen, and the compact layout shows the picked frame of the
 * selection's viewport in a scheme that the filter shows. A removed page or
 * document has one reading frame instead.
 */

import type { ViewerSelection } from "../host/types.js";
import type { PreviewContent } from "../previews/request.js";

import { viewportFrameLabel, type CanvasScheme } from "./canvas_frames.js";
import { workspaceShownAxes, type FramesSchemes } from "./frames_filter.js";
import { schemeValue } from "./scheme_fallback.js";

/**
 * The viewport and the scheme of a removed screen's section: on the wide
 * canvas, the selection's viewport, which the Frames filter's viewport
 * toggles show, and the selection's scheme; in the compact layout, the
 * picked frame in a scheme that the filter shows, as a current screen's.
 */
export function removedSectionAxes(
  schemes: FramesSchemes,
  selection: Pick<ViewerSelection, "colorScheme" | "viewport">,
  wide: boolean,
): { colorScheme: CanvasScheme; viewport: ViewerSelection["viewport"] } {
  const axes = workspaceShownAxes(false, schemes, true, wide, selection);
  return {
    colorScheme: wide
      ? selection.colorScheme
      : (axes.schemes[0] ?? selection.colorScheme),
    viewport: axes.viewport,
  };
}

/** The axes of one historical view. */
export interface RemovedViewAxes {
  colorScheme: CanvasScheme;
  viewport: "desktop" | "mobile";
}

/** One frame of a removed screen's section, or the place of a missing view. */
export interface RemovedFramePlan<View extends RemovedViewAxes> {
  column: number;
  /** Whether the Frames filter hides the frame. */
  hidden: boolean;
  /** Names the frame among the section's frames, such as `mobile-light`. */
  key: string;
  /** The frame's name, such as `Desktop · Light`. */
  label: string;
  /** Whether the frame keeps its viewport's Light view in the Dark row. */
  lightOnly: boolean;
  /**
   * Whether a frame of the other viewport shows on the canvas, which hides
   * the second sentence of the note in a missing view's place.
   */
  otherShown: boolean;
  row: number;
  /** The scheme of the shown view, or of the row in a missing view's place. */
  scheme: CanvasScheme;
  /** The historical view; none in the place of a viewport never captured. */
  view: View | undefined;
  viewport: "desktop" | "mobile";
}

const VIEWPORTS = ["desktop", "mobile"] as const;

/**
 * A removed screen's frames from its historical views. In the compact layout
 * one frame shows at a time, so no frame of the other viewport stands beside
 * a missing view's place.
 */
export function removedScreenFrames<View extends RemovedViewAxes>(
  views: readonly View[],
  shown: {
    compact: boolean;
    /** The schemes whose rows show; every row without it. */
    schemes?: readonly CanvasScheme[] | undefined;
    viewport: ViewerSelection["viewport"];
  },
): RemovedFramePlan<View>[] {
  const schemes: readonly CanvasScheme[] = views.some(
    (view) => view.colorScheme === "dark",
  )
    ? ["light", "dark"]
    : ["light"];
  const columns = VIEWPORTS.filter(
    (size) => shown.viewport === "both" || shown.viewport === size,
  );
  const rows = schemes.filter(
    (scheme) => shown.schemes?.includes(scheme) ?? true,
  );
  const of = (size: "desktop" | "mobile", scheme: CanvasScheme) =>
    views.find((view) => view.viewport === size && view.colorScheme === scheme);
  return schemes.flatMap((scheme) =>
    VIEWPORTS.flatMap((size) => {
      const captured = views.some((view) => view.viewport === size);
      const exact = of(size, scheme);
      const view = exact ?? (scheme === "dark" ? of(size, "light") : undefined);
      // A viewport with views, but none for this row, has no frame here.
      if (captured && !view) return [];
      const other = size === "desktop" ? "mobile" : "desktop";
      return [
        {
          column: Math.max(0, columns.indexOf(size)),
          hidden: !columns.includes(size) || !rows.includes(scheme),
          key: `${size}-${scheme}`,
          label: viewportFrameLabel(size, scheme),
          lightOnly: view !== undefined && !exact,
          otherShown: !shown.compact && columns.includes(other),
          row: Math.max(0, rows.indexOf(scheme)),
          scheme: view?.colorScheme ?? scheme,
          view,
          viewport: size,
        },
      ];
    }),
  );
}

/**
 * The document that a removed page's or document's reading frame shows: a
 * document's historical version of the preview scheme, or its Light version
 * without a dark one, and a page's one document.
 */
export function removedReadingView(
  content: Extract<PreviewContent, { kind: "document" | "page" }>,
  colorScheme: CanvasScheme,
): { colorScheme: CanvasScheme; url: string } {
  if (content.kind === "page")
    return { colorScheme: "light", url: content.url };
  const light =
    content.views.find((view) => view.colorScheme === "light") ??
    content.views[0]!;
  return schemeValue(
    colorScheme,
    light,
    content.views.find((view) => view.colorScheme === "dark"),
  );
}

/**
 * The historical documents that the shown frames of a removed screen need,
 * once each, before its preview reports ready.
 */
export function removedScreenAddresses(
  views: readonly (RemovedViewAxes & { url: string })[],
  viewport: ViewerSelection["viewport"],
): readonly string[] {
  return [
    ...new Set(
      removedScreenFrames(views, { compact: false, viewport }).flatMap(
        (frame) => (!frame.hidden && frame.view ? [frame.view.url] : []),
      ),
    ),
  ];
}
