/** Present every pane document a comparison selection shows before it is ready. */

import type {
  SnapshotPresentation,
  SnapshotPresentationLoader,
} from "../previews/presentation.js";

import type { LoadedComparison } from "./comparison_request.js";

/** The copy a presentation failure shows when its error carries none. */
const COMPARISON_UNAVAILABLE = "The comparison is unavailable.";

/** Display state of the pane documents one selection needs. */
export type ComparisonDocumentsState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      /** Accepted presentations of the selection, by snapshot address. */
      presentations: ReadonlyMap<string, SnapshotPresentation>;
    }
  | { status: "failed"; message: string };

/** Pane documents owned by one loaded comparison, whatever it shows. */
export interface ComparisonDocuments {
  /** The state of a selection, from accepted work only; starts nothing. */
  state(
    loaded: LoadedComparison,
    addresses: readonly string[],
  ): ComparisonDocumentsState;
  /** Present a selection's missing documents; resolves once state settles. */
  present(
    loaded: LoadedComparison,
    addresses: readonly string[],
    signal: AbortSignal,
  ): Promise<void>;
}

/** Create the generation-confined loader of one loaded comparison. */
export type ComparisonLoaderFactory = (
  loaded: LoadedComparison,
) => SnapshotPresentationLoader;

interface Owner {
  failures: Map<string, string>;
  loaded: LoadedComparison;
  loader?: SnapshotPresentationLoader;
  presented: Map<string, SnapshotPresentation>;
  unavailable?: string;
}

function selectionKey(addresses: readonly string[]): string {
  return JSON.stringify(addresses);
}

function failureMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : COMPARISON_UNAVAILABLE;
}

/**
 * Keep one loaded comparison's presentations across mode, viewport and scheme
 * selections, and discard them when another loaded comparison replaces it:
 * a refresh, a retry, a renewal that found a new generation, or a new route.
 */
export function createComparisonDocuments(
  createLoader: ComparisonLoaderFactory,
  report?: (error: unknown) => void,
): ComparisonDocuments {
  let owner: Owner | undefined;
  const own = (loaded: LoadedComparison): Owner => {
    if (owner?.loaded === loaded) return owner;
    owner = { failures: new Map(), loaded, presented: new Map() };
    try {
      owner.loader = createLoader(loaded);
    } catch (error) {
      owner.unavailable = failureMessage(error);
    }
    return owner;
  };
  return {
    state(loaded, addresses) {
      if (owner?.loaded !== loaded) return { status: "loading" };
      if (owner.unavailable)
        return { status: "failed", message: owner.unavailable };
      const failure = owner.failures.get(selectionKey(addresses));
      if (failure) return { status: "failed", message: failure };
      const presentations = new Map<string, SnapshotPresentation>();
      for (const address of addresses) {
        const presentation = owner.presented.get(address);
        if (!presentation) return { status: "loading" };
        presentations.set(address, presentation);
      }
      return { status: "ready", presentations };
    },
    async present(loaded, addresses, signal) {
      const current = own(loaded);
      const loader = current.loader;
      if (!loader) return;
      const key = selectionKey(addresses);
      const missing = addresses.filter(
        (address) => !current.presented.has(address),
      );
      if (missing.length === 0) return;
      current.failures.delete(key);
      try {
        const presentations = await Promise.all(
          missing.map((address) => loader.load(address, signal)),
        );
        signal.throwIfAborted();
        missing.forEach((address, index) =>
          current.presented.set(address, presentations[index]!),
        );
      } catch (error) {
        if (signal.aborted || owner !== current) return;
        current.failures.set(key, failureMessage(error));
        report?.(error);
      }
    },
  };
}
