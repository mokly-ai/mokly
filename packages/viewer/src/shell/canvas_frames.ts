/**
 * The frames that an entry shows on the canvas. A screen shows Desktop
 * beside Mobile, its Light row above its Dark row, and the viewport choice
 * keeps one column. A component shows its variant set: a row for its own
 * example, then a row for each saved variant, each with its Light frame
 * beside its Dark frame, and each frame shows the row's desktop view. A
 * page or a Markdown document shows one reading frame, named by its source
 * file.
 */

import type {
  ShellCatalogueComponent,
  ShellCatalogueScreen,
  ShellCatalogueView,
} from "../catalogue/scoped_types.js";
import { isComponentVariant } from "../catalogue/variants.js";
import type { GeneratedComponentView } from "../components/views.js";
import type { ViewerSelection } from "../host/types.js";

import { generatedView } from "./stage_sources.js";
import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** A frame's own colour scheme, whatever the interface appearance. */
export type CanvasScheme = "dark" | "light";

/** One frame of a screen's section or of a component's variant set. */
export interface CanvasFramePlan {
  column: number;
  /** The entry whose view the frame shows: the screen, or the set's row. */
  entry: ShellCatalogueComponent | ShellCatalogueScreen;
  /**
   * Whether the viewport choice hides the frame: it stays mounted, with its
   * document, but takes no room on the canvas.
   */
  hidden?: boolean;
  /** Names the frame among its section's frames. */
  key: string;
  kind: "component" | "desktop" | "mobile";
  /** The frame's name, such as `Desktop · Light` or `Disabled · Light`. */
  label: string;
  /** A live edit's render of the view, which the frame shows in its place. */
  preview?: GeneratedComponentView;
  row: number;
  scheme: CanvasScheme;
  /** Whether the frame holds the selection, which lights its label. */
  selected: boolean;
  /** The use-case step that a step frame shows. */
  step?: CanvasStepPlan;
  /** A variant set's row, by the path of its entry. */
  variantPath?: string;
  view: ShellCatalogueView | undefined;
  viewport: "desktop" | "mobile";
}

/** The step of a use case that a step frame shows, with its screen. */
export interface CanvasStepPlan {
  /** The step's description, or its screen's when the step has none. */
  description: string | undefined;
  /** The step's place in the use case, from 0. */
  index: number;
  /**
   * Whether the step keeps its screen's Light view while Dark is chosen,
   * because the screen has no dark view of the chosen viewport.
   */
  lightOnly: boolean;
  /** The step's number, from 1. */
  number: number;
  /** The step's title, or its screen's when the step has none. */
  title: string;
}

const SCHEMES: Readonly<Record<CanvasScheme, string>> = {
  dark: "Dark",
  light: "Light",
};

const VIEWPORTS = { desktop: "Desktop", mobile: "Mobile" } as const;

/** The rows or columns of an entry's schemes: Light, and Dark if it has one. */
function schemes(views: readonly ShellCatalogueView[]): CanvasScheme[] {
  return views.some((view) => view.colorScheme === "dark")
    ? ["light", "dark"]
    : ["light"];
}

function viewOf(
  entry: { views: readonly ShellCatalogueView[] },
  viewport: "desktop" | "mobile",
  scheme: CanvasScheme,
): ShellCatalogueView | undefined {
  return entry.views.find(
    (view) => view.viewport === viewport && view.colorScheme === scheme,
  );
}

/**
 * A screen's frames: Desktop beside Mobile, the Light row above the Dark
 * row, and only the Light row without a dark view. A viewport choice of
 * `desktop` or `mobile` keeps that column alone on the canvas; the other
 * column's frames stay mounted, so a later choice shows them at once.
 */
export function screenFrames(
  screen: ShellCatalogueScreen,
  viewport: ViewerSelection["viewport"],
): CanvasFramePlan[] {
  const sizes = ["desktop", "mobile"] as const;
  const shown = sizes.filter(
    (size) => viewport === "both" || viewport === size,
  );
  return schemes(screen.views).flatMap((scheme, row) =>
    sizes.map((size) => ({
      column: Math.max(0, shown.indexOf(size)),
      entry: screen,
      ...(shown.includes(size) ? {} : { hidden: true }),
      key: `${size}-${scheme}`,
      kind: size,
      label: `${VIEWPORTS[size]} · ${SCHEMES[scheme]}`,
      row,
      scheme,
      selected: false,
      view: viewOf(screen, size, scheme),
      viewport: size,
    })),
  );
}

/**
 * A component's variant set: one row for each current row of its variant
 * bar, in order, with its Light frame beside its Dark frame. The saved
 * variant that `selectedPath` names holds the selection on its Light frame.
 * A row's live edit shows in both of its frames.
 */
export function variantSetFrames(
  rows: readonly WorkspaceVariant[],
  selectedPath: string | undefined,
  previewViews: readonly GeneratedComponentView[] | undefined,
): CanvasFramePlan[] {
  return rows
    .filter((row) => !row.removed)
    .flatMap(({ value: entry }, row) =>
      schemes(entry.views).map((scheme, column) => {
        const preview = generatedView(
          previewViews,
          entry.path,
          "desktop",
          scheme,
        );
        return {
          column,
          entry,
          key: `${entry.path}:${scheme}`,
          kind: "component" as const,
          label: `${entry.title} · ${SCHEMES[scheme]}`,
          ...(preview ? { preview } : {}),
          row,
          scheme,
          selected: scheme === "light" && entry.path === selectedPath,
          variantPath: entry.path,
          view: viewOf(entry, "desktop", scheme),
          viewport: "desktop" as const,
        };
      }),
    );
}

/** The frames of a workspace's entry: a screen's frames or a variant set. */
export function workspaceFrames(
  data: WorkspaceData,
  viewport: ViewerSelection["viewport"],
  previewViews: readonly GeneratedComponentView[],
): CanvasFramePlan[] {
  const entry = data.entry;
  if (entry.kind === "screen") return screenFrames(entry, viewport);
  return variantSetFrames(
    data.variants,
    isComponentVariant(entry) ? entry.path : undefined,
    previewViews,
  );
}

/**
 * The saved views that a live edit of a component's row renders on the
 * canvas: the row's desktop views in both schemes, so the edit shows in both
 * of its frames. Without a desktop view the edit keeps `views`, the views
 * that the one-frame stage renders.
 */
export function canvasEditContexts(
  saved: readonly GeneratedComponentView[],
  rowPath: string,
  views: readonly GeneratedComponentView[],
): readonly GeneratedComponentView[] {
  const row = saved.filter(
    (view) => view.variantPath === rowPath && view.viewport === "desktop",
  );
  return row.length ? row : views;
}

/**
 * The workspace views that the shown frames show, so inspection draws on
 * every shown frame.
 */
export function framesViews(
  views: readonly GeneratedComponentView[],
  frames: readonly CanvasFramePlan[],
): readonly GeneratedComponentView[] {
  return frames.flatMap((frame) => {
    if (frame.hidden) return [];
    const view = views.find(
      (candidate) =>
        candidate.viewport === frame.viewport &&
        candidate.colorScheme === frame.scheme &&
        candidate.variantPath === frame.variantPath,
    );
    return view ? [view] : [];
  });
}

/**
 * The name of a screen's frame of one viewport and one scheme, such as
 * `Desktop · Light`, also for the historical views of a removed screen.
 */
export function viewportFrameLabel(
  viewport: "desktop" | "mobile",
  scheme: CanvasScheme,
): string {
  return `${VIEWPORTS[viewport]} · ${SCHEMES[scheme]}`;
}

/**
 * A reading frame's name: the file name of the entry's source, such as
 * `payment-terms.md`, or the last segment of its path without one.
 */
export function readingFrameLabel(entry: {
  details: { sourcePath: string };
  path: string;
}): string {
  const file = entry.details.sourcePath.split("/").at(-1);
  return file || (entry.path.split("/").at(-1) ?? entry.path);
}
