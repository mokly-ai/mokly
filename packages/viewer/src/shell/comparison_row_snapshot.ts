/**
 * The state of each compared row, and what the comparison controller shows
 * of the demanded rows: the generation of each row, the rows that still load
 * and the rows that failed, and the presentation that the rows settled into.
 */

import type {
  ComparisonDemand,
  ComparisonPresentation,
} from "./comparison_presentation.js";
import type { LoadedComparison } from "./comparison_request.js";

/**
 * The generation that holds each compared row's documents, by the row's
 * entry id. A screen has one row; a variant set has a row for its own example
 * and one for each saved variant. `pending` names the rows whose request or
 * renewal still runs, and `failures` the rows whose request failed, with the
 * failure copy; a plain map names neither.
 */
export interface ComparisonGenerations extends ReadonlyMap<
  string,
  LoadedComparison
> {
  readonly failures?: ReadonlyMap<string, string>;
  readonly pending?: ReadonlySet<string>;
}

/** What the controller shows of its rows. */
export interface ComparisonRowsSnapshot {
  /** Whether a demanded row's request or renewal runs. */
  busy: boolean;
  /** Each demanded row that is loaded, loading or failed. */
  generations?: ComparisonGenerations;
  /** The latest demand's presentation, once every demanded row settled for its key. */
  presentation?: ComparisonPresentation;
}

/** A row's settled request, for one key: its loaded generation or its failure. */
export type RowSettled =
  | { kind: "failed"; key: string; message: string }
  | {
      kind: "loaded";
      /** None after the row left the demand, so that its return renews it. */
      key: string | undefined;
      loaded: LoadedComparison;
      scopeKey: string;
    };

/** A row's running request or renewal; it applies the row's latest key. */
export interface RowOperation {
  controller: AbortController;
  key: string;
  scopeKey: string;
}

/** One row's state: its settled request and its running operation. */
export interface RowState {
  operation?: RowOperation;
  settled?: RowSettled;
}

/** What the controller reads of one row: whether its work runs, and what settled. */
export interface RowStatus {
  /** Whether the row's request or renewal runs. */
  running: boolean;
  settled?: RowSettled;
}

/** The status of each row that the engine holds, by entry id; it never changes in place. */
export type RowStates = ReadonlyMap<string, RowStatus>;

/** The snapshot without a demand: Current, or before the first demand. */
export const IDLE_ROWS: ComparisonRowsSnapshot = { busy: false };

function sameMap<Value>(
  left: ReadonlyMap<string, Value>,
  right: ReadonlyMap<string, Value>,
): boolean {
  return (
    left.size === right.size &&
    [...left].every(([key, value]) => right.get(key) === value)
  );
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return left.size === right.size && [...left].every((key) => right.has(key));
}

/** The previous presentation while the next one shows the same mode and axes. */
function samePresentation(
  previous: ComparisonPresentation | undefined,
  next: ComparisonPresentation,
): ComparisonPresentation {
  return previous &&
    previous.colorScheme === next.colorScheme &&
    previous.mode === next.mode &&
    previous.requestedColorScheme === next.requestedColorScheme &&
    previous.viewport === next.viewport
    ? previous
    : next;
}

/** The previous generations while they hold the same rows and states. */
function sameGenerations(
  previous: ComparisonGenerations | undefined,
  loaded: ReadonlyMap<string, LoadedComparison>,
  failures: ReadonlyMap<string, string>,
  pending: ReadonlySet<string>,
): ComparisonGenerations | undefined {
  if (loaded.size === 0 && failures.size === 0 && pending.size === 0)
    return undefined;
  if (
    previous &&
    sameMap(previous, loaded) &&
    sameMap(previous.failures ?? new Map<string, string>(), failures) &&
    sameSet(previous.pending ?? new Set<string>(), pending)
  )
    return previous;
  return Object.assign(new Map(loaded), { failures, pending });
}

/**
 * The snapshot of the rows that `demand` holds, in its order, for the render
 * that makes the demand. A row whose key the demand changes reads as pending
 * at once, before the work for that key starts, so nothing loads documents
 * of its new frames from a generation that it has not renewed. A row's
 * failure shows for its latest key and its generation for its scope; a row
 * that left the demand shows nothing. The presentation takes the demand's
 * mode and axes once every demanded row has settled for its latest key, and
 * keeps the earlier value meanwhile. `previous` stays while nothing in it
 * changes, because the documents of each row depend on the identity of
 * `generations`.
 */
export function rowsSnapshot(
  previous: ComparisonRowsSnapshot,
  rows: RowStates,
  demand: ComparisonDemand | undefined,
): ComparisonRowsSnapshot {
  if (!demand) return IDLE_ROWS;
  const loaded = new Map<string, LoadedComparison>();
  const failures = new Map<string, string>();
  const pending = new Set<string>();
  let settled = true;
  for (const { id, key, scopeKey } of demand.rows) {
    const row = rows.get(id);
    const state = row?.settled;
    const current = state?.key === key;
    if (row?.running === true || !current) pending.add(id);
    if (state?.kind === "loaded" && state.scopeKey === scopeKey)
      loaded.set(id, state.loaded);
    if (state?.kind === "failed" && current) failures.set(id, state.message);
    if (!current) settled = false;
  }
  const generations = sameGenerations(
    previous.generations,
    loaded,
    failures,
    pending,
  );
  const presentation = settled
    ? samePresentation(previous.presentation, demand.presentation)
    : previous.presentation;
  const busy = pending.size > 0;
  if (
    busy === previous.busy &&
    generations === previous.generations &&
    presentation === previous.presentation
  )
    return previous;
  return {
    busy,
    ...(generations ? { generations } : {}),
    ...(presentation ? { presentation } : {}),
  };
}
