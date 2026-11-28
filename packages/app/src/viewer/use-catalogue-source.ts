import { useContext, useEffect, useSyncExternalStore } from "react";

import { CatalogueSourceContext } from "./source-context";
import type {
  CatalogueSource,
  SourceRequest,
  SourceState,
} from "./source-store";

const closed: SourceState = { read: { status: "idle" } };
const noSubscription = () => () => undefined;

/** The document's catalogue source for one publication, and its index read. */
export interface CatalogueRead {
  source?: CatalogueSource;
  state: SourceState;
}

/**
 * The document's one source for this publication origin and access policy.
 *
 * A request exists once access is open and carries the credential that confirmed.
 * The stage's Try again opens access again, then the hook repeats the failed index
 * read. A native tree has no document source and stays closed.
 */
export function useCatalogueSource(
  request: SourceRequest | undefined,
): CatalogueRead {
  const sources = useContext(CatalogueSourceContext);
  // Selecting is idempotent for one origin and policy, so a rebuilt route
  // finds the source, its index and its version failure again.
  const source =
    request === undefined || sources === undefined
      ? undefined
      : sources.select(request);
  const state = useSyncExternalStore(
    sources?.subscribe ?? noSubscription,
    () =>
      source === undefined || sources === undefined
        ? closed
        : sources.state(source),
  );
  useEffect(() => {
    if (source !== undefined) sources?.load(source);
  }, [source, sources]);
  return { source, state };
}
