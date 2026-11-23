/**
 * React lifecycle controller for the lazy comparison snapshots of each
 * compared row: one generation for each row that the comparison demands,
 * which `comparison_row_lifecycle.ts` requests, renews and cancels.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

import {
  useComparisonEnvironment,
  type ComparisonEnvironment,
} from "./comparison_context.js";
import { useComparisonIntent } from "./comparison_intent.js";
import { useComparisonModeState } from "./comparison_mode.js";
import {
  comparisonDemand,
  type ComparisonDemand,
  type ComparisonFrameDemand,
  type ComparisonMode,
  type ComparisonPresentation,
} from "./comparison_presentation.js";
import type { LoadedComparison } from "./comparison_request.js";
import {
  createComparisonRows,
  type ComparisonRows,
} from "./comparison_row_lifecycle.js";
import {
  IDLE_ROWS,
  rowsSnapshot,
  type ComparisonGenerations,
  type ComparisonRowsSnapshot,
} from "./comparison_row_snapshot.js";
import { useShellStore } from "./store_context.js";

export type { ComparisonGenerations } from "./comparison_row_snapshot.js";
export type { ComparisonPresentation } from "./comparison_presentation.js";

/** State and actions consumed by the comparison band and the canvas. */
export interface ComparisonController {
  /** Whether a demanded row's request or renewal runs. */
  busy: boolean;
  /** The routed row's request failure, for its current key. */
  failure?: string;
  /**
   * The generation of each demanded row that has one, also while it renews,
   * with the rows that still load and the rows whose request failed.
   */
  generations?: ComparisonGenerations;
  /** The routed row's generation, while the comparison demands that row. */
  loaded?: LoadedComparison;
  mode: ComparisonMode;
  /** The mode and axes that every demanded row has settled into. */
  presentation?: ComparisonPresentation;
  /** Request every demanded row again. */
  refresh(): void;
  /** Request one demanded row again: `entry`, or else the routed row. */
  retry(entry?: string): void;
  selectMode(mode: ComparisonMode): void;
}

/** What a workspace tells its comparison. */
export interface ComparisonOptions {
  /** Side by side: the key of the compared frame among `frames`. */
  comparedFrame?: string;
  effectiveColorScheme?: "dark" | "light";
  eligible: boolean;
  /**
   * Whether `eligible` is final for the routed view, as
   * `comparisonEligibilityKnown` decides. The route's comparison intent waits
   * for it.
   */
  eligibilityKnown: boolean;
  entryId: string;
  /**
   * The shown frames whose rows compare, in canvas order. The comparison
   * requests one generation for each of their rows; Side by side requests only
   * the row of the compared frame. Without `frames`, the comparison holds the
   * routed entry's row alone (`entryId`, with `historical`), keyed on the
   * selection's axes.
   */
  frames?: readonly ComparisonFrameDemand[];
  historical?: boolean;
  /** The workspace that owns the rows: a variant set's parent path. */
  owner?: string;
}

/** The rows of one owner in one environment, and what the last render showed. */
interface RowsHolder {
  environment: ComparisonEnvironment | undefined;
  ownerKey: string;
  rows: ComparisonRows;
  shown: ComparisonRowsSnapshot;
}

/**
 * One rows engine for each owner and environment, fed with the latest demand.
 * Each render shows the rows for its own demand, before the effect applies
 * it. A new owner, a new environment and unmount cancel every row.
 */
function useComparisonRows(
  environment: ComparisonEnvironment | undefined,
  ownerKey: string,
  demand: ComparisonDemand | undefined,
): { rows: ComparisonRows; snapshot: ComparisonRowsSnapshot } {
  const holder = useRef<RowsHolder | undefined>(undefined);
  if (
    !holder.current ||
    holder.current.environment !== environment ||
    holder.current.ownerKey !== ownerKey
  )
    holder.current = {
      environment,
      ownerKey,
      rows: createComparisonRows(environment),
      shown: IDLE_ROWS,
    };
  const current = holder.current;
  const { rows } = current;
  const states = useSyncExternalStore(
    rows.subscribe,
    rows.snapshot,
    rows.snapshot,
  );
  current.shown = rowsSnapshot(current.shown, states, demand);
  const latest = useRef(demand);
  latest.current = demand;
  useEffect(() => {
    rows.demand(latest.current);
  }, [rows, demand?.key]);
  useEffect(() => () => rows.reset(), [rows]);
  return { rows, snapshot: current.shown };
}

/** Keep one request owner across rapid toolbar, viewport, and scheme changes. */
export function useComparison({
  comparedFrame,
  effectiveColorScheme,
  eligible,
  eligibilityKnown,
  entryId,
  frames,
  historical = false,
  owner,
}: ComparisonOptions): ComparisonController {
  const store = useShellStore();
  const environment = useComparisonEnvironment();
  const { colorScheme, viewport } = store.state.selection;
  const model = store.catalogue.publicModel;
  // A publication returns an active comparison to Current.
  const ownerKey = `${owner ?? entryId}\u0000${String(model.revision)}`;
  const [modeState, setModeState] = useComparisonModeState(ownerKey);
  const mode = modeState.ownerKey === ownerKey ? modeState.mode : "current";
  const currentOwner = useRef(ownerKey);
  currentOwner.current = ownerKey;
  const demand =
    environment && eligible && mode !== "current"
      ? comparisonDemand({
          comparedFrame,
          comparisonUrl: model.comparisonUrl,
          entryId,
          frames,
          historical,
          presentation: {
            colorScheme: effectiveColorScheme ?? colorScheme,
            mode,
            requestedColorScheme: colorScheme,
            viewport,
          },
        })
      : undefined;
  const { rows, snapshot } = useComparisonRows(environment, ownerKey, demand);

  // Another comparison environment starts from Current.
  useEffect(() => {
    setModeState({ ownerKey: currentOwner.current, mode: "current" });
  }, [environment]);

  useComparisonIntent(eligible, eligibilityKnown, () =>
    setModeState({ ownerKey: currentOwner.current, mode: "side" }),
  );

  useEffect(() => {
    if (!eligible) setModeState({ ownerKey, mode: "current" });
  }, [eligible, ownerKey]);

  const { busy, generations, presentation } = snapshot;
  const loaded = generations?.get(entryId);
  const failure = generations?.failures?.get(entryId);
  return {
    busy,
    mode,
    ...(failure === undefined ? {} : { failure }),
    ...(generations ? { generations } : {}),
    ...(loaded ? { loaded } : {}),
    ...(presentation ? { presentation } : {}),
    refresh: () => rows.refresh(),
    // The package's failure state passes its click event, which names no row.
    retry: (entry) => rows.retry(typeof entry === "string" ? entry : entryId),
    selectMode: (next) => setModeState({ mode: next, ownerKey }),
  };
}
