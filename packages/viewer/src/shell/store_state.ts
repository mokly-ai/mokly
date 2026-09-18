/** Value state owned by one mounted hydrated shell. */

import type { ViewerSelection } from "../viewer/types.js";

import type { LiveChangesStatus } from "./metadata.js";
import type { ShellRoute } from "./routes.js";

/** Browser state captured for one automatic watched reload. */
export interface ShellRecoverySnapshot {
  changesStatus?: LiveChangesStatus;
  closedCollectionIds: readonly string[];
  colorScheme: ViewerSelection["colorScheme"];
  detailsOpen: boolean;
  drawerOpen: boolean;
  filterBaselineClosedCollectionIds: readonly string[] | null;
  navScroll: number;
  query: string;
  regionScrolls: Readonly<Record<string, number>>;
  view: ViewerSelection["view"];
  viewport: ViewerSelection["viewport"];
}

/** Optional browser values applied before React begins hydration. */
export interface ShellInitialState {
  detailsOpen?: boolean;
  disclosures?: Readonly<Record<string, boolean>>;
  navigationMaximum?: number;
  navigationWidth?: number;
  recovery?: ShellRecoverySnapshot;
}

/** Complete interaction state for one standalone shell mount. */
export interface ShellState {
  announcement: string;
  changesStatus: LiveChangesStatus | undefined;
  detailsOpen: boolean;
  disclosures: Readonly<Record<string, boolean>>;
  drawerOpen: boolean;
  expandedFrame: string | undefined;
  filterBaseline: Readonly<Record<string, boolean>> | undefined;
  inspectorTab: string | undefined;
  navigationMaximum: number;
  navScroll: number;
  navigationWidth: number;
  regionScrolls: Readonly<Record<string, number>>;
  route: ShellRoute;
  selection: ViewerSelection;
  tagPickerIndex: number;
  tagPickerOpen: boolean;
}

/** Convert disclosure values into the persisted closed-key representation. */
export function closedDisclosures(
  disclosures: Readonly<Record<string, boolean>>,
): readonly string[] {
  return Object.entries(disclosures).flatMap(([key, open]) =>
    open ? [] : [key],
  );
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
