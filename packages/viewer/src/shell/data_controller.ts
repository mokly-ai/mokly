/**
 * One shell root's data outside React: the installed index, the details its
 * fences accepted, the publications of the event stream, and the live
 * descriptor. The shell store renders from it; tests drive it with fakes.
 */

import { detailKey, type DetailRequest } from "../catalogue/detail_fences.js";
import type { LiveDescriptorV3 } from "../catalogue/types.js";
import type { MoklyVersionError } from "../catalogue/version_error.js";

import {
  withDetails,
  withIndex,
  type ShellDataSnapshot,
} from "./data_commit.js";
import { LiveDescriptor, type LiveEditingStatus } from "./data_descriptor.js";
import {
  loadFencedDetail,
  loadRefresh,
  routeKey,
  type DetailOutcome,
} from "./data_requests.js";
import type { ShellDataSource } from "./data_source.js";
import type { ShellRoute } from "./routes.js";

/** What the controller asks of the shell that owns it. */
export interface ShellDataHost {
  /** Adopt one snapshot in one store commit. */
  commit(next: ShellDataSnapshot): void;
  /** The route on screen now. */
  route(): ShellRoute;
  versionError(error: MoklyVersionError): void;
  /** A browser warning: live editing or live updates are unavailable. */
  warn(message: string, cause?: unknown): void;
}

/** Fetch details under their fences and follow the publications of Serve. */
export class ShellDataController {
  readonly #host: ShellDataHost;
  readonly #source: ShellDataSource | undefined;
  readonly #listeners = new Set<() => void>();
  #snapshot: ShellDataSnapshot;
  #version = 0;
  #wanted: readonly DetailRequest[] = [];
  #failed: ReadonlySet<string> = new Set();
  readonly #loading = new Map<string, AbortController>();
  #connected = false;
  #closeStream: (() => void) | undefined;
  #streamWarned = false;
  readonly #descriptor: LiveDescriptor;
  #refreshing: AbortController | undefined;
  #refreshFailed: string | undefined;

  constructor(
    initial: ShellDataSnapshot,
    source: ShellDataSource | undefined,
    host: ShellDataHost,
  ) {
    this.#snapshot = initial;
    this.#source = source;
    this.#host = host;
    this.#descriptor = new LiveDescriptor(source?.live, {
      generation: () => this.#snapshot.index.live?.generation,
      changed: () => this.#changed(),
      versionError: (error) => host.versionError(error),
      warn: (message, cause) => host.warn(message, cause),
    });
  }

  get snapshot(): ShellDataSnapshot {
    return this.#snapshot;
  }

  /** The keys of the requested details whose last load failed. */
  get failed(): ReadonlySet<string> {
    return this.#failed;
  }

  /** The descriptor of the installed render generation, while connected. */
  get descriptor(): LiveDescriptorV3 | undefined {
    return this.#descriptor.installed;
  }

  /** Live prop editing while the index is live; absent elsewhere. */
  get editing(): LiveEditingStatus | undefined {
    return this.#source?.live && this.#snapshot.index.live
      ? this.#descriptor.status
      : undefined;
  }

  /** The route whose last publication refresh failed. */
  get refreshFailed(): string | undefined {
    return this.#refreshFailed;
  }

  /** The live transport, present while a descriptor is installed. */
  get live(): ShellDataSource["live"] {
    return this.#descriptor.installed ? this.#source?.live : undefined;
  }

  /** A counter that changes with every observable change. */
  readonly version = (): number => this.#version;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Load each missing detail of a route; abort the loads it no longer wants. */
  request(requests: readonly DetailRequest[]): void {
    this.#wanted = requests;
    const source = this.#source;
    if (!source) return;
    const wanted = new Set(requests.map(detailKey));
    for (const [key, controller] of this.#loading)
      if (!wanted.has(key)) {
        controller.abort();
        this.#loading.delete(key);
      }
    for (const request of requests) {
      const key = detailKey(request);
      if (
        this.#snapshot.details.has(key) ||
        this.#failed.has(key) ||
        this.#loading.has(key)
      )
        continue;
      const controller = new AbortController();
      this.#loading.set(key, controller);
      void loadFencedDetail(
        source,
        this.#snapshot.index,
        request,
        controller.signal,
      ).then((outcome) => {
        if (controller.signal.aborted) return;
        this.#loading.delete(key);
        this.#adopt(request, outcome);
      });
    }
  }

  /** Forget the failures of these keys and load the wanted details again. */
  retry(keys: readonly string[]): void {
    const failed = new Set(this.#failed);
    for (const key of keys) failed.delete(key);
    this.#failed = failed;
    this.#changed();
    this.request(this.#wanted);
  }

  /** Follow the event stream and load the descriptor while the index is live. */
  connect(): () => void {
    const live = this.#source?.live;
    if (this.#connected || !live || !this.#snapshot.index.live) return () => {};
    this.#connected = true;
    this.#descriptor.load();
    this.#closeStream = live.subscribe({
      message: (revision, deploymentId) => {
        const installed = this.#snapshot.index;
        if (deploymentId !== installed.deploymentId) {
          this.#source?.deploymentChanged();
          return;
        }
        if (this.#descriptor.failed) this.#descriptor.load();
        if (revision > installed.revision) this.#refresh(revision);
      },
      unavailable: () => {
        if (this.#streamWarned) return;
        this.#streamWarned = true;
        this.#host.warn("Live catalogue updates are unavailable.");
      },
    });
    return () => this.#disconnect();
  }

  /** Load the live descriptor again after its load failed. */
  readonly retryDescriptor = (): void => {
    if (this.#connected) this.#descriptor.retry();
  };

  /** Refresh the installed revision again after a failed refresh. */
  readonly retryRefresh = (): void => {
    this.#refresh(this.#snapshot.index.revision);
  };

  /** Abort every load; a later request starts them again. */
  abortLoads(): void {
    for (const controller of this.#loading.values()) controller.abort();
    this.#loading.clear();
  }

  #adopt(request: DetailRequest, outcome: DetailOutcome): void {
    if (outcome.kind === "accepted") {
      const current = this.#snapshot;
      this.#commit(
        outcome.index === current.index
          ? withDetails(current, [[request, outcome.detail]])
          : withIndex(current, outcome.index, [[request, outcome.detail]]),
      );
      return;
    }
    if (outcome.kind === "version") {
      this.#host.versionError(outcome.error);
      return;
    }
    if (outcome.kind === "deployment") this.#source?.deploymentChanged();
    else this.#source?.detailFailed?.(request);
    this.#failed = new Set(this.#failed).add(detailKey(request));
    this.#changed();
  }

  #commit(next: ShellDataSnapshot): void {
    const previous = this.#snapshot.index;
    this.#snapshot = next;
    if (next.index !== previous) this.abortLoads();
    if (
      this.#connected &&
      next.index.live?.generation !== previous.live?.generation
    )
      this.#descriptor.load();
    this.#host.commit(next);
    this.#changed();
  }

  #refresh(revision: number): void {
    const source = this.#source;
    if (!source) return;
    this.#refreshing?.abort();
    const controller = new AbortController();
    this.#refreshing = controller;
    void loadRefresh(
      source,
      this.#snapshot.index,
      () => this.#host.route(),
      revision,
      controller.signal,
    ).then((outcome) => {
      if (controller.signal.aborted) return;
      this.#refreshing = undefined;
      if (outcome.kind === "accepted") {
        this.#refreshFailed = undefined;
        this.#commit(withIndex(this.#snapshot, outcome.index, outcome.details));
      } else if (outcome.kind === "deployment") source.deploymentChanged();
      else if (outcome.kind === "version")
        this.#host.versionError(outcome.error);
      else {
        this.#refreshFailed = routeKey(this.#host.route());
        this.#changed();
      }
    });
  }

  #disconnect(): void {
    this.#connected = false;
    this.#closeStream?.();
    this.#closeStream = undefined;
    this.#refreshing?.abort();
    this.#refreshing = undefined;
    this.#descriptor.stop();
  }

  #changed(): void {
    this.#version += 1;
    for (const listener of [...this.#listeners]) listener();
  }
}
