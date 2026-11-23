/**
 * The frames of a removed screen's previous version on the canvas: one frame
 * for each historical view, as a current screen's section holds its views.
 * Desktop stands beside Mobile, and the Light row above the Dark row, or the
 * Light row alone without a historical dark view. In the Dark row, a
 * viewport without a dark view keeps its Light view and says so. A viewport
 * without any historical view has the place of each of its frames, which
 * holds the note that no previous version was captured. A viewport choice
 * keeps one column, as it does for a current screen. A removed page or
 * document has one reading frame instead.
 */

import type { ViewerSelection } from "../host/types.js";
import type { PreviewContent } from "../previews/request.js";

import { viewportFrameLabel, type CanvasScheme } from "./canvas_frames.js";
import { schemeValue } from "./scheme_fallback.js";

/** The axes of one historical view. */
export interface RemovedViewAxes {
  colorScheme: CanvasScheme;
  viewport: "desktop" | "mobile";
}

/** One frame of a removed screen's section, or the place of a missing view. */
export interface RemovedFramePlan<View extends RemovedViewAxes> {
  column: number;
  /** Whether the viewport choice hides the frame. */
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
  shown: { compact: boolean; viewport: ViewerSelection["viewport"] },
): RemovedFramePlan<View>[] {
  const schemes: readonly CanvasScheme[] = views.some(
    (view) => view.colorScheme === "dark",
  )
    ? ["light", "dark"]
    : ["light"];
  const columns = VIEWPORTS.filter(
    (size) => shown.viewport === "both" || shown.viewport === size,
  );
  const of = (size: "desktop" | "mobile", scheme: CanvasScheme) =>
    views.find((view) => view.viewport === size && view.colorScheme === scheme);
  return schemes.flatMap((scheme, row) =>
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
          hidden: !columns.includes(size),
          key: `${size}-${scheme}`,
          label: viewportFrameLabel(size, scheme),
          lightOnly: view !== undefined && !exact,
          otherShown: !shown.compact && columns.includes(other),
          row,
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
