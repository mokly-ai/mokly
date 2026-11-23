/** React owner of the pane documents that a loaded comparison presents. */

import { useEffect, useReducer, useRef } from "react";

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
import type { ComparisonGenerations } from "./use_comparison.js";

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

/**
 * Present every selected pane document of each row through the shared
 * snapshot loader of the row's immutable generation, and report each row
 * ready only when all of its documents are accepted. Each row keeps its own
 * presentations across mode, frame, viewport and scheme changes; a replaced
 * generation, Current, navigation and unmount discard them.
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
  const [, settled] = useReducer((version: number) => version + 1, 0);
  const key = JSON.stringify(rows);
  useEffect(() => {
    if (!generations) return;
    const controller = new AbortController();
    for (const row of JSON.parse(key) as ComparisonRowDocuments[]) {
      const loaded = generations.get(row.entry);
      const documents = loaded && documentsOf(owners.current, row.entry);
      if (!loaded || !documents) continue;
      void documents
        .present(loaded, row.addresses, controller.signal)
        .then(() => {
          if (!controller.signal.aborted) settled();
        });
    }
    return () => controller.abort();
  }, [environment, generations, key]);
  const states = new Map<string, ComparisonDocumentsState>();
  for (const row of rows) {
    const loaded = generations?.get(row.entry);
    const documents = loaded && documentsOf(owners.current, row.entry);
    states.set(
      row.entry,
      !generations
        ? { status: "idle" }
        : !loaded || !documents
          ? { status: "loading" }
          : documents.state(loaded, row.addresses),
    );
  }
  return states;
}
