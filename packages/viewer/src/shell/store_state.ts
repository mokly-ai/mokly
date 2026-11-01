/** Value state owned by one mounted shell. */

import type { ChangesStatus } from "../catalogue/types.js";
import type { ViewerSelection } from "../viewer/types.js";

import type { ShellRoute } from "./routes.js";

/** Stored browser preferences the standalone bundle reads before its first render. */
export interface ShellInitialState {
  colorScheme?: ViewerSelection["colorScheme"];
  detailsOpen?: boolean;
  disclosures?: Readonly<Record<string, boolean>>;
  navigationMaximum?: number;
  navigationWidth?: number;
}

/** Complete interaction state for one standalone shell mount. */
export interface ShellState {
  announcement: string;
  changesStatus: Exclude<ChangesStatus, "disabled"> | undefined;
  detailsOpen: boolean;
  disclosures: Readonly<Record<string, boolean>>;
  drawerOpen: boolean;
  expandedFrame: string | undefined;
  filterBaseline: Readonly<Record<string, boolean>> | undefined;
  inspectorTab: string | undefined;
  navigationMaximum: number;
  navScroll: number;
  navigationWidth: number;
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
