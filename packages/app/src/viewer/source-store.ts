import type {
  CatalogueReadModel,
  DetailSource,
  ViewerError,
} from "@mokly/viewer";

/** One publication's catalogue, as the stage asks for it. */
export interface SourceRequest {
  /** The API-validated per-publication origin. */
  origin: string;
  /** Whether the reads carry the publication host's confirmed cookie. */
  credentialed: boolean;
  /** The publication whose access exchange a private detail read renews. */
  projectId: string;
  publicationId: string;
}

/** The identity the package runtime is keyed to: one origin, one policy. */
export interface CatalogueSource {
  readonly origin: string;
  readonly credentialed: boolean;
}

/** A version failure latched against one source, with its plain diagnostic. */
export interface VersionFailure {
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
  failure?: VersionFailure;
}

/** An index read's answer: the index copy or its version failure. */
export type IndexAnswer =
  { index: CatalogueReadModel } | { failure: VersionFailure };

/** What one source reads with; the web document supplies the real reads. */
export interface SourceReads {
  index(request: SourceRequest): Promise<IndexAnswer>;
  detail(
    request: SourceRequest,
    index: CatalogueReadModel,
    renew: () => Promise<void>,
  ): DetailSource;
  renew(request: SourceRequest): Promise<void>;
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

/** Renewals that arrive together share the one exchange in flight. */
function shared(run: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | undefined;
  return () => {
    running ??= run().finally(() => {
      running = undefined;
    });
    return running;
  };
}

/** The state one index read settles in: ready with its sources, or failed. */
async function settle(
  reads: SourceReads,
  request: SourceRequest,
): Promise<SourceState> {
  try {
    const answer = await reads.index(request);
    if ("failure" in answer) {
      return { read: { status: "failed" }, failure: answer.failure };
    }
    const renew = shared(() => reads.renew(request));
    const detail = reads.detail(request, answer.index, renew);
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
      if (
        active?.source.origin !== request.origin ||
        active.source.credentialed !== request.credentialed
      ) {
        const { origin, credentialed } = request;
        active = { source: { origin, credentialed }, request, state: idle };
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
      void settle(reads, entry.request).then((state) => update(entry, state));
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
