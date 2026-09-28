/** React owner of the pane documents a loaded comparison presents. */

import { useEffect, useMemo, useReducer } from "react";

import { createSnapshotPresentationLoader } from "../previews/presentation.js";

import {
  snapshotPresentationEnvironment,
  useComparisonEnvironment,
} from "./comparison_context.js";
import {
  createComparisonDocuments,
  type ComparisonDocumentsState,
} from "./comparison_documents.js";
import type { LoadedComparison } from "./comparison_request.js";

/**
 * Present every selected pane document through the shared snapshot loader of
 * the comparison's immutable generation, reporting ready only when all are
 * accepted. Mode, viewport and scheme changes reuse accepted presentations;
 * a replaced comparison, Current, navigation and unmount discard them.
 */
export function useComparisonDocuments(
  loaded: LoadedComparison | undefined,
  addresses: readonly string[],
): ComparisonDocumentsState {
  const environment = useComparisonEnvironment();
  const documents = useMemo(
    () =>
      environment
        ? createComparisonDocuments(
            (comparison) =>
              createSnapshotPresentationLoader(
                new URL(".", comparison.url),
                ["before", "after"],
                environment.delivery(),
                snapshotPresentationEnvironment(environment),
              ),
            (error) => environment.reportError?.(error),
          )
        : undefined,
    [environment],
  );
  const [, settled] = useReducer((version: number) => version + 1, 0);
  const key = JSON.stringify(addresses);
  useEffect(() => {
    if (!loaded || !documents) return;
    const controller = new AbortController();
    void documents
      .present(loaded, JSON.parse(key) as string[], controller.signal)
      .then(() => {
        if (!controller.signal.aborted) settled();
      });
    return () => controller.abort();
  }, [documents, key, loaded]);
  if (!loaded) return { status: "idle" };
  if (!documents) return { status: "loading" };
  return documents.state(loaded, addresses);
}
