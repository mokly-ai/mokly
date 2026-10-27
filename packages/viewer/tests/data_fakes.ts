/** Deterministic fakes of the shell's index, detail and live transports. */

import type { DetailRequest } from "../src/catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  DeploymentFileV1,
  EntryDetailV3,
  LiveDescriptorV3,
} from "../src/catalogue/types.js";
import type {
  ComponentRenderRequest,
  ComponentRenderSuccess,
} from "../src/components/render_types.js";
import type {
  LiveListener,
  ShellDataSource,
  ShellLiveSource,
} from "../src/shell/data_source.js";

/** A promise the test settles explicitly. */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** Let every settled promise chain run to its next pending await. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** One request a fake transport received and answers on demand. */
export interface Pending<T, Input> extends Deferred<T> {
  input: Input;
  signal: AbortSignal;
}

function pending<T, Input>(
  queue: Pending<T, Input>[],
  input: Input,
  signal: AbortSignal,
): Promise<T> {
  const item = { ...deferred<T>(), input, signal };
  queue.push(item);
  return item.promise;
}

/** A data source whose every request waits for the test to answer it. */
export class FakeDataSource implements ShellDataSource {
  readonly indexes: Pending<CatalogueReadModel, undefined>[] = [];
  readonly details: Pending<EntryDetailV3, DetailRequest>[] = [];
  readonly deployments: Pending<DeploymentFileV1, undefined>[] = [];
  readonly loadDeployment?: NonNullable<ShellDataSource["loadDeployment"]>;
  deploymentChanges = 0;
  readonly detailFailures: DetailRequest[] = [];
  live?: FakeLiveSource;

  constructor(live = false, staticCatalogue = false) {
    if (live) this.live = new FakeLiveSource();
    if (staticCatalogue)
      this.loadDeployment = (signal) =>
        pending(this.deployments, undefined, signal);
  }

  loadIndex(signal: AbortSignal): Promise<CatalogueReadModel> {
    return pending(this.indexes, undefined, signal);
  }

  loadDetail(
    request: DetailRequest,
    _index: CatalogueReadModel,
    signal: AbortSignal,
  ): Promise<EntryDetailV3> {
    return pending(this.details, request, signal);
  }

  deploymentChanged(): void {
    this.deploymentChanges += 1;
  }

  /** The oldest unanswered deployment-file request. */
  deployment() {
    const found = this.deployments.find(
      (item) => !answered.has(item) && !item.signal.aborted,
    );
    if (!found) throw new Error("no pending deployment request");
    answered.add(found);
    return found;
  }

  detailFailed(request: DetailRequest): void {
    this.detailFailures.push(request);
  }

  /** The oldest unanswered detail request for a path. */
  detail(path: string, snapshotId?: string) {
    const found = this.details.find(
      (item) =>
        item.input.path === path &&
        item.input.snapshotId === snapshotId &&
        !item.signal.aborted &&
        !answered.has(item),
    );
    if (!found) throw new Error(`no pending detail request for ${path}`);
    answered.add(found);
    return found;
  }

  /** The oldest unanswered index request. */
  index() {
    const found = this.indexes.find((item) => !answered.has(item));
    if (!found) throw new Error("no pending index request");
    answered.add(found);
    return found;
  }
}

const answered = new WeakSet<object>();

/** A live transport with a captured stream listener. */
class FakeLiveSource implements ShellLiveSource {
  readonly descriptors: Pending<LiveDescriptorV3, undefined>[] = [];
  readonly renders: Pending<
    ComponentRenderSuccess,
    { descriptor: LiveDescriptorV3; request: ComponentRenderRequest }
  >[] = [];
  listener: LiveListener | undefined;
  subscriptions = 0;
  closed = 0;

  loadDescriptor(signal: AbortSignal): Promise<LiveDescriptorV3> {
    return pending(this.descriptors, undefined, signal);
  }

  subscribe(listener: LiveListener): () => void {
    this.listener = listener;
    this.subscriptions += 1;
    return () => {
      this.closed += 1;
      if (this.listener === listener) this.listener = undefined;
    };
  }

  render(
    descriptor: LiveDescriptorV3,
    request: ComponentRenderRequest,
    signal: AbortSignal,
  ): Promise<ComponentRenderSuccess> {
    return pending(this.renders, { descriptor, request }, signal);
  }

  previewExpired(): Promise<boolean> {
    return Promise.resolve(false);
  }

  /** The oldest unanswered descriptor request. */
  descriptor() {
    const found = this.descriptors.find(
      (item) => !answered.has(item) && !item.signal.aborted,
    );
    if (!found) throw new Error("no pending descriptor request");
    answered.add(found);
    return found;
  }
}

/** A live descriptor for one render generation. */
export function liveDescriptor(generation: string): LiveDescriptorV3 {
  return {
    schemaVersion: 3,
    generation,
    render: { url: "/mokly-viewer/components/render", token: "token" },
  };
}
