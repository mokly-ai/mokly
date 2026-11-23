/**
 * The framework-free lifecycle of the compared rows: one generation for each
 * row that a comparison demands, with the row's own request, renewal, cancel,
 * retry and failure, under the
 * [selected comparisons contract](../../../../docs/protocol/mokly-selected-comparisons.md).
 */

import { DeploymentChangedError } from "../catalogue/sources.js";

import type { ComparisonEnvironment } from "./comparison_context.js";
import { shareDeploymentCheck } from "./comparison_deployment_check.js";
import type {
  ComparisonDemand,
  ComparisonRowDemand,
} from "./comparison_presentation.js";
import {
  COMPARISON_UNAVAILABLE,
  renewComparison,
  requestComparison,
} from "./comparison_request.js";
import type {
  RowOperation,
  RowSettled,
  RowState,
  RowStates,
} from "./comparison_row_snapshot.js";

/** The compared rows of one comparison owner in one environment. */
export interface ComparisonRows {
  /** Apply the latest demand; `undefined`, as Current, cancels every row. */
  demand(next: ComparisonDemand | undefined): void;
  /** Request every demanded row again with `refresh=1`. */
  refresh(): void;
  /** Abort every operation and discard every row: a late response changes nothing. */
  reset(): void;
  /** Request one demanded row again with `refresh=1`. */
  retry(id: string): void;
  /** The status of every row that the rows hold, which a change replaces. */
  snapshot(): RowStates;
  subscribe(listener: () => void): () => void;
}

/** The status of no row. */
const NO_ROWS: RowStates = new Map();

/** The rows' statuses; the previous ones stay while no row's status changes. */
function rowStates(
  previous: RowStates,
  rows: ReadonlyMap<string, RowState>,
): RowStates {
  const next = new Map(
    [...rows].map(([id, { operation, settled }]) => [
      id,
      { running: operation !== undefined, ...(settled ? { settled } : {}) },
    ]),
  );
  const same =
    next.size === previous.size &&
    [...next].every(([id, status]) => {
      const before = previous.get(id);
      return (
        before?.running === status.running && before.settled === status.settled
      );
    });
  return same ? previous : next;
}

/** Create the rows of one comparison owner in one environment. */
export function createComparisonRows(
  environment: ComparisonEnvironment | undefined,
): ComparisonRows {
  const rows = new Map<string, RowState>();
  const listeners = new Set<() => void>();
  let latest: ComparisonDemand | undefined;
  let snapshot = NO_ROWS;

  function publish(): void {
    const next = rowStates(snapshot, rows);
    if (next === snapshot) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  }

  function rowOf(id: string): RowState {
    const row = rows.get(id) ?? {};
    rows.set(id, row);
    return row;
  }

  /** Apply an outcome unless a cancel or a newer operation replaced it. */
  function finish(
    row: RowState,
    operation: RowOperation,
    settled?: RowSettled,
  ): boolean {
    if (row.operation !== operation || operation.controller.signal.aborted)
      return false;
    delete row.operation;
    if (settled) row.settled = settled;
    publish();
    return true;
  }

  /** Start one operation for each row; the rows share one deployment check. */
  function start(wanted: readonly ComparisonRowDemand[], refresh: boolean) {
    if (!environment || wanted.length === 0) return;
    const check =
      environment.deploymentCheck &&
      shareDeploymentCheck(environment.deploymentCheck);
    for (const { id, key, scope, scopeKey } of wanted) {
      const row = rowOf(id);
      row.operation?.controller.abort();
      const operation = { controller: new AbortController(), key, scopeKey };
      row.operation = operation;
      if (row.settled?.kind === "failed") delete row.settled;
      const { signal } = operation.controller;
      const settled = row.settled;
      const work =
        !refresh && settled?.kind === "loaded" && settled.scopeKey === scopeKey
          ? renewComparison(environment, settled.loaded, scope, signal, check)
          : requestComparison(environment, scope, refresh, signal, check);
      void work.then(
        (loaded) =>
          finish(row, operation, {
            kind: "loaded",
            key: operation.key,
            loaded,
            scopeKey,
          }),
        (error: unknown) => {
          // Another deployment answered: the pass ends with no failure.
          if (error instanceof DeploymentChangedError) {
            finish(row, operation);
            return;
          }
          const failed: RowSettled = {
            kind: "failed",
            key: operation.key,
            message: COMPARISON_UNAVAILABLE,
          };
          if (finish(row, operation, failed)) environment.reportError?.(error);
        },
      );
    }
  }

  /** A row that leaves the demand keeps only its loaded generation. */
  function leave(id: string, row: RowState): void {
    row.operation?.controller.abort();
    delete row.operation;
    if (row.settled?.kind === "loaded")
      row.settled = { ...row.settled, key: undefined };
    else rows.delete(id);
  }

  function reset(): void {
    for (const row of rows.values()) row.operation?.controller.abort();
    rows.clear();
    latest = undefined;
    publish();
  }

  return {
    demand(next) {
      if (!next || !environment) {
        reset();
        return;
      }
      latest = next;
      const held = new Set(next.rows.map((row) => row.id));
      for (const [id, row] of rows) if (!held.has(id)) leave(id, row);
      const starts: ComparisonRowDemand[] = [];
      for (const wanted of next.rows) {
        const { operation, settled } = rowOf(wanted.id);
        // Pending work of the same scope stays and applies the latest key.
        if (operation?.scopeKey === wanted.scopeKey) operation.key = wanted.key;
        else if (operation || settled?.key !== wanted.key) starts.push(wanted);
      }
      start(starts, false);
      publish();
    },
    refresh() {
      start(latest?.rows ?? [], true);
      publish();
    },
    reset,
    retry(id) {
      start(latest?.rows.filter((row) => row.id === id) ?? [], true);
      publish();
    },
    snapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
