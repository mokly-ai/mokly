/**
 * The frames that an entry shows on the canvas. A screen shows Desktop
 * beside Mobile, its Light row above its Dark row, and the Frames filter
 * hides the columns and the rows that it turns off. A component shows its
 * variant set: a row for its own example, then a row for each saved
 * variant, each with its Light frame beside its Dark frame, of the schemes
 * that the filter shows, and each frame shows the row's desktop view. A
 * page or a Markdown document shows one reading frame, named by its source
 * file. A use case's step frames, from `canvas_use_case_frames.ts`, carry
 * the step that each shows. A live edit renders the view of each shown frame
 * of the edited screen or row, and those frames show its renders.
 */

import type {
  ShellCatalogueComponent,
  ShellCatalogueScreen,
  ShellCatalogueView,
} from "../catalogue/scoped_types.js";
import type { GeneratedComponentView } from "../components/views.js";

import { generatedView, temporaryView } from "./stage_sources.js";
import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** A frame's own colour scheme, whatever the interface appearance. */
export type CanvasScheme = "dark" | "light";

/** One frame of a screen's section or of a component's variant set. */
export interface CanvasFramePlan {
  column: number;
  /** The entry whose view the frame shows: the screen, or the set's row. */
  entry: ShellCatalogueComponent | ShellCatalogueScreen;
  /**
   * Whether the Frames filter hides the frame: it stays mounted, with its
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

/** The viewports and the schemes whose frames the canvas shows. */
export interface CanvasShown {
  schemes: readonly CanvasScheme[];
  viewports: readonly ("desktop" | "mobile")[];
}

/** Every frame of an entry shown, as the compact layout's picker lists them. */
export const EVERY_FRAME: CanvasShown = {
  schemes: ["light", "dark"],
  viewports: ["desktop", "mobile"],
};

/** Whether any view or row of an entry has a dark view. */
export function hasDarkView(
  entries: readonly { views: readonly ShellCatalogueView[] }[],
): boolean {
  return entries.some((entry) =>
    entry.views.some((view) => view.colorScheme === "dark"),
  );
}

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
 * row, and only the Light row without a dark view. The shown viewports form
 * the columns and the shown schemes the rows; the other frames stay
 * mounted, so a later choice shows them at once.
 */
function screenFrames(
  screen: ShellCatalogueScreen,
  shown: CanvasShown,
): CanvasFramePlan[] {
  const sizes = ["desktop", "mobile"] as const;
  const columns = sizes.filter((size) => shown.viewports.includes(size));
  const all = schemes(screen.views);
  const rows = all.filter((scheme) => shown.schemes.includes(scheme));
  return all.flatMap((scheme) =>
    sizes.map((size) => ({
      column: Math.max(0, columns.indexOf(size)),
      entry: screen,
      ...(columns.includes(size) && rows.includes(scheme)
        ? {}
        : { hidden: true }),
      key: `${size}-${scheme}`,
      kind: size,
      label: `${VIEWPORTS[size]} · ${SCHEMES[scheme]}`,
      row: Math.max(0, rows.indexOf(scheme)),
      scheme,
      selected: false,
      view: viewOf(screen, size, scheme),
      viewport: size,
    })),
  );
}

/**
 * A component's variant set: one row for each current row of its variant
 * bar, in order, with its Light frame beside its Dark frame. The shown
 * schemes form the columns; a hidden scheme's frames stay mounted.
 */
function variantSetFrames(
  rows: readonly WorkspaceVariant[],
  shown: CanvasShown,
): CanvasFramePlan[] {
  return rows
    .filter((row) => !row.removed)
    .flatMap(({ value: entry }, row) =>
      schemes(entry.views).map((scheme) => {
        const column = shown.schemes.indexOf(scheme);
        return {
          column: Math.max(0, column),
          entry,
          ...(column < 0 ? { hidden: true } : {}),
          key: `${entry.path}:${scheme}`,
          kind: "component" as const,
          label: `${entry.title} · ${SCHEMES[scheme]}`,
          row,
          scheme,
          selected: false,
          variantPath: entry.path,
          view: viewOf(entry, "desktop", scheme),
          viewport: "desktop" as const,
        };
      }),
    );
}

/**
 * The frames of a workspace's entry: a screen's frames or a variant set,
 * of the viewports and schemes that `shown` names, with the views of
 * `previewViews` when it is given.
 */
export function workspaceFrames(
  data: WorkspaceData,
  shown: CanvasShown,
  previewViews?: readonly GeneratedComponentView[],
): CanvasFramePlan[] {
  const entry = data.entry;
  const frames =
    entry.kind === "screen"
      ? screenFrames(entry, shown)
      : variantSetFrames(data.variants, shown);
  return previewViews ? withEditPreviews(frames, previewViews) : frames;
}

/**
 * The frames with the views of a live edit: a variant set's frame shows its
 * row's view of `previewViews`, saved or edited, so a row's edit shows in
 * both of its frames. A screen's frame shows its view's temporary render
 * while the edit holds one, and else its saved document.
 */
export function withEditPreviews(
  frames: readonly CanvasFramePlan[],
  previewViews: readonly GeneratedComponentView[],
): CanvasFramePlan[] {
  return frames.map((frame) => {
    const view = generatedView(
      previewViews,
      frame.variantPath,
      frame.viewport,
      frame.scheme,
    );
    const preview =
      frame.kind === "component" || temporaryView(view) ? view : undefined;
    return preview ? { ...frame, preview } : frame;
  });
}

/**
 * The saved views that a live edit renders: the view of each shown frame of
 * the edited entry, one context for each viewport and scheme. `rowPath`
 * names a variant set's edited row; a screen's frames name no row. The wide
 * canvas shows every frame of the viewport choice, and the compact layout
 * its picked frame, or a variant set's whole set. Without a shown frame of
 * a saved view the edit keeps `views`, the selection's views.
 */
export function canvasEditContexts(
  saved: readonly GeneratedComponentView[],
  frames: readonly CanvasFramePlan[],
  rowPath: string | undefined,
  views: readonly GeneratedComponentView[],
): readonly GeneratedComponentView[] {
  const shown = framesViews(
    saved,
    frames.filter((frame) => frame.variantPath === rowPath),
  );
  return shown.length ? shown : views;
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
