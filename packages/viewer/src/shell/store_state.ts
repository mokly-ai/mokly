/** Value state owned by one mounted shell. */

import type { ChangesStatus } from "@mokly/model";
import type { PanelTab } from "@mokly/ui/panel-tabs";

import type { ViewerSelection } from "../host/types.js";

import type { FramesChoice } from "./frames_filter.js";
import type { ShellRoute } from "./routes.js";

/** Stored browser preferences the standalone bundle reads before its first render. */
export interface ShellInitialState {
  colorScheme?: ViewerSelection["colorScheme"];
  disclosures?: Readonly<Record<string, boolean>>;
  navigationMaximum?: number;
  navigationWidth?: number;
}

/**
 * A sheet of the compact layout: the catalogue's, or the right panel's. One
 * sheet is open at a time.
 */
export type ShellSheet = "catalogue" | "panel";

/** Complete interaction state for one standalone shell mount. */
export interface ShellState {
  announcement: string;
  changesStatus: Exclude<ChangesStatus, "disabled"> | undefined;
  disclosures: Readonly<Record<string, boolean>>;
  filterBaseline: Readonly<Record<string, boolean>> | undefined;
  /**
   * The screens' Frames filter: the viewports and schemes that the canvas
   * shows. It stays the same across in-shell navigation.
   */
  frames: FramesChoice;
  navigationMaximum: number;
  navScroll: number;
  /**
   * The catalogue's width that the reader chose, in pixels. Without it the
   * catalogue takes its starting width.
   */
  navigationWidth: number | undefined;
  /**
   * The right panel's selected tab, which survives in-shell navigation to an
   * entry that has it.
   */
  panelTab: PanelTab;
  query: string;
  regionScrolls: Readonly<Record<string, number>>;
  /**
   * The folder disclosure a breadcrumb last revealed, with the selection when
   * it was requested. Each request stores a fresh object so the tree focuses
   * that folder even when it repeats. The tree waits for the folder row to
   * show; a selection commit that leaves it hidden ends the wait.
   */
  revealedFolder: { key: string; selection: ViewerSelection } | undefined;
  route: ShellRoute;
  /**
   * Counts route installations: the first route, each navigation, and each
   * history step. A publication that rebinds the route keeps the count.
   */
  routeInstallation: number;
  /**
   * The installed route still holds its comparison intent, a shell-owned
   * link's request for Side by side. The routed workspace settles it once;
   * only a new route installation sets it again.
   */
  comparisonIntent: boolean;
  selection: ViewerSelection;
  /** The sheet that the compact layout shows open, if any. */
  sheet: ShellSheet | undefined;
  /** Whether the open sheet takes its expanded height. */
  sheetExpanded: boolean;
  tagPickerIndex: number;
  tagPickerOpen: boolean;
}

/** Apply open values to a copy without mutating state supplied by React. */
export function openDisclosures(
  disclosures: Readonly<Record<string, boolean>>,
  keys: readonly string[],
): Record<string, boolean> {
  const next = { ...disclosures };
  for (const key of keys) next[key] = true;
  return next;
}
