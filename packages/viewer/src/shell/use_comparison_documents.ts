/** React owner of the pane documents that each compared row presents. */

import { useEffect, useReducer, useRef, useState } from "react";

import { createSnapshotPresentationLoader } from "../previews/presentation.js";

import {
  snapshotPresentationEnvironment,
  useComparisonEnvironment,
  type ComparisonEnvironment,
} from "./comparison_context.js";
import {
  createComparisonDocuments,
  type ComparisonDocuments,
  type ComparisonDocumentsState,
} from "./comparison_documents.js";
import type { LoadedComparison } from "./comparison_request.js";
import type { ComparisonGenerations } from "./comparison_row_snapshot.js";

/** The pane documents of one compared row, under the row's generation. */
export interface ComparisonRowDocuments {
  /** The row's entry id, which names its generation. */
  entry: string;
  /** The absolute snapshot addresses of the row's documents, in display order. */
  addresses: readonly string[];
}

/** The state of each compared row's documents, by the row's entry id. */
export type ComparisonRowsState = ReadonlyMap<string, ComparisonDocumentsState>;

/** The documents of one row, from its generation's loader. */
function rowDocuments(environment: ComparisonEnvironment): ComparisonDocuments {
  return createComparisonDocuments(
    (comparison) =>
      createSnapshotPresentationLoader(
        new URL(".", comparison.url),
        ["before", "after"],
        environment.delivery(),
        snapshotPresentationEnvironment(environment),
      ),
    (error) => environment.reportError?.(error),
  );
}

/** The documents of each row in one comparison environment. */
interface RowOwners {
  environment: ComparisonEnvironment | undefined;
  rows: Map<string, ComparisonDocuments>;
}

/** The documents of a row, created on first use. */
function documentsOf(
  owners: RowOwners,
  entry: string,
): ComparisonDocuments | undefined {
  if (!owners.environment) return undefined;
  let documents = owners.rows.get(entry);
  if (!documents) {
    documents = rowDocuments(owners.environment);
    owners.rows.set(entry, documents);
  }
  return documents;
}

/** One row's selection under the row's documents and generation. */
interface RowSelection {
  /** The selection's addresses, as one key. */
  key: string;
  addresses: readonly string[];
  documents: ComparisonDocuments;
  loaded: LoadedComparison;
}

/** One row's running or finished presentation of one selection. */
interface RowWork extends RowSelection {
  controller: AbortController;
}

/**
 * Present each row's selection under its confirmed generation. A change to
 * one row's generation or addresses aborts only that row's work, a row that
 * renews starts nothing new until its renewal ends, and without generations
 * every row's work stops while its accepted presentations stay.
 */
function presentRows(
  work: Map<string, RowWork>,
  owners: RowOwners,
  generations: ComparisonGenerations | undefined,
  rows: readonly ComparisonRowDocuments[],
  settled: () => void,
): void {
  const wanted = new Map<string, RowSelection>();
  if (generations)
    for (const { addresses, entry } of rows) {
      const loaded = generations.get(entry);
      const documents = loaded && documentsOf(owners, entry);
      if (loaded && documents)
        wanted.set(entry, {
          addresses,
          documents,
          key: JSON.stringify(addresses),
          loaded,
        });
    }
  for (const [entry, running] of work) {
    const next = wanted.get(entry);
    if (
      next?.key === running.key &&
      next.documents === running.documents &&
      next.loaded === running.loaded
    )
      continue;
    running.controller.abort();
    work.delete(entry);
  }
  for (const [entry, next] of wanted) {
    if (work.has(entry) || generations?.pending?.has(entry)) continue;
    const controller = new AbortController();
    work.set(entry, { ...next, controller });
    void next.documents
      .present(next.loaded, next.addresses, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) settled();
      });
  }
}

/** A row's state: its request's failure, or its documents once confirmed. */
function rowState(
  owners: RowOwners,
  generations: ComparisonGenerations | undefined,
  row: ComparisonRowDocuments,
): ComparisonDocumentsState {
  if (!generations) return { status: "idle" };
  const failure = generations.failures?.get(row.entry);
  if (failure !== undefined) return { status: "failed", message: failure };
  const loaded = generations.get(row.entry);
  const documents = loaded && documentsOf(owners, row.entry);
  if (!loaded || !documents) return { status: "loading" };
  const state = documents.state(loaded, row.addresses);
  // A renewing row shows what it accepted and loads nothing new.
  return generations.pending?.has(row.entry) && state.status !== "ready"
    ? { status: "loading" }
    : state;
}

/**
 * Present every selected pane document of each row through the shared
 * snapshot loader of the row's immutable generation, and report each row
 * ready only when all of its documents are accepted. Each row keeps its own
 * presentations across mode, frame, viewport and scheme changes, and while
 * `generations` is absent, as Inspect makes it; a replaced generation and
 * another environment discard them.
 */
export function useComparisonDocuments(
  generations: ComparisonGenerations | undefined,
  rows: readonly ComparisonRowDocuments[],
): ComparisonRowsState {
  const environment = useComparisonEnvironment();
  const owners = useRef<RowOwners>({ environment, rows: new Map() });
  // Another comparison environment starts every row anew.
  if (owners.current.environment !== environment)
    owners.current = { environment, rows: new Map() };
  const [work] = useState(() => new Map<string, RowWork>());
  const [, settled] = useReducer((version: number) => version + 1, 0);
  const latestRows = useRef(rows);
  latestRows.current = rows;
  const key = JSON.stringify(rows);
  useEffect(() => {
    presentRows(work, owners.current, generations, latestRows.current, settled);
  }, [environment, generations, key, work]);
  useEffect(
    () => () => {
      for (const running of work.values()) running.controller.abort();
      work.clear();
    },
    [work],
  );
  const states = new Map<string, ComparisonDocumentsState>();
  for (const row of rows)
    states.set(row.entry, rowState(owners.current, generations, row));
  // A row whose request failed has no documents to list.
  for (const [entry, message] of generations?.failures ?? [])
    if (!states.has(entry)) states.set(entry, { status: "failed", message });
  return states;
}
