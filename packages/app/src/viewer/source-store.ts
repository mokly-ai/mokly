import type {
  CatalogueReadModel,
  DetailSource,
  ViewerError,
} from "@mokly/viewer";

import type { PublicationAccess } from "./access-exchange";

export type SourceAccess =
  | { policy: "public" }
  | {
      policy: "cookie" | "bearer";
      publication: Pick<
        PublicationAccess,
        "currentToken" | "renewCatalogueAccess"
      >;
    };

/** One publication's catalogue, as the stage asks for it. */
export interface SourceRequest {
  /** The API-validated per-publication origin. */
  origin: string;
  access: SourceAccess;
}

/** The identity the package runtime is keyed to: one origin, one policy. */
export interface CatalogueSource {
  readonly origin: string;
  readonly policy: SourceAccess["policy"];
}

/** A version failure latched against one source, with its plain diagnostic. */
export interface SourceVersionFailure {
  details?: string;
}

/** Where one source's index read stands. */
export type IndexRead =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; index: CatalogueReadModel; detail: DetailSource };

/** What the stage shows for one source. */
export interface SourceState {
  read: IndexRead;
  /** The first version failure, of the index or of a detail. */
  failure?: SourceVersionFailure;
}

/** An index read's answer: the index copy or its version failure. */
export type IndexAnswer =
  { index: CatalogueReadModel } | { failure: SourceVersionFailure };

/** What one source reads with; the web document supplies the real reads. */
export interface SourceReads {
  index(request: SourceRequest): Promise<IndexAnswer>;
  detail(request: () => SourceRequest, index: CatalogueReadModel): DetailSource;
}

/** One document's active source, independent of the route that shows it. */
export interface CatalogueSources {
  /** The source for this origin and policy; another pair replaces it. */
  select(request: SourceRequest): CatalogueSource;
  subscribe(listener: () => void): () => void;
  state(source: CatalogueSource): SourceState;
  /** Read the index unless it is read, being read or failed on its version. */
  load(source: CatalogueSource): void;
  /** Latch the package's first version error; ignore every other report. */
  report(source: CatalogueSource, error: ViewerError): void;
}

interface Entry {
  source: CatalogueSource;
  request: SourceRequest;
  state: SourceState;
}

const idle: SourceState = { read: { status: "idle" } };

/** The state one index read settles in: ready with its sources, or failed. */
async function settle(reads: SourceReads, entry: Entry): Promise<SourceState> {
  try {
    const answer = await reads.index(entry.request);
    if ("failure" in answer) {
      return { read: { status: "failed" }, failure: answer.failure };
    }
    const detail = reads.detail(() => entry.request, answer.index);
    return { read: { status: "ready", index: answer.index, detail } };
  } catch {
    return { read: { status: "failed" } };
  }
}

/**
 * Keep one source in memory: the index it read, its `detail` function and
 * its version failure. A traversal that rebuilds the route finds them again;
 * another origin or policy, or a new document, starts empty.
 */
export function createCatalogueSources(reads: SourceReads): CatalogueSources {
  let active: Entry | undefined;
  const listeners = new Set<() => void>();
  const update = (entry: Entry, state: SourceState) => {
    // A replaced source's late answer changes nothing.
    if (active !== entry) return;
    entry.state = state;
    for (const listener of listeners) listener();
  };
  return {
    select(request) {
      const {
        origin,
        access: { policy },
      } = request;
      if (active?.source.origin !== origin || active.source.policy !== policy) {
        active = { source: { origin, policy }, request, state: idle };
      } else {
        // A rebuilt route can confirm a new attempt for the same source.
        active.request = request;
      }
      return active.source;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    state(source) {
      return active?.source === source ? active.state : idle;
    },
    load(source) {
      const entry = active;
      if (entry?.source !== source) return;
      const { read, failure } = entry.state;
      if (failure || read.status === "loading" || read.status === "ready") {
        return;
      }
      update(entry, { read: { status: "loading" } });
      void settle(reads, entry).then((state) => update(entry, state));
    },
    report(source, error) {
      const entry = active;
      if (entry?.source !== source || error.code !== "version") return;
      if (entry.state.failure) return;
      const failure =
        error.details === undefined ? {} : { details: error.details };
      update(entry, { ...entry.state, failure });
    },
  };
}
