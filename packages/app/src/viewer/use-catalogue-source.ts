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
 * The index is read only once access is open, so a private catalogue is read
 * with the credential that confirmed, the cookie or the bearer token. A failed
 * read is read again the next time access opens, which is what the stage's
 * Try again does: it repeats the access exchange and then the index read. A
 * native tree has no document source and stays closed, because it never
 * mounts the package.
 */
export function useCatalogueSource(
  request: SourceRequest | undefined,
  open: boolean,
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
    if (open && source !== undefined) sources?.load(source);
  }, [open, source, sources]);
  return { source, state };
}
