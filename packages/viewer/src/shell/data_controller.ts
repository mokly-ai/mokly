/**
 * One shell root's data outside React: the installed index, the details its
 * fences accepted, the publications of the event stream and of stale renders,
 * and the live descriptor. The shell store renders from it; tests drive it
 * with fakes.
 */

import type { DetailRequest } from "../catalogue/detail_fences.js";
import type { LiveDescriptorV3 } from "../catalogue/types.js";
import type { MoklyVersionError } from "../catalogue/version_error.js";

import {
  withDetails,
  withIndex,
  type ShellDataSnapshot,
} from "./data_commit.js";
import { LiveDescriptor, type LiveEditingStatus } from "./data_descriptor.js";
import { DetailLoader } from "./data_detail_loader.js";
import { staleAwareLiveSource } from "./data_live_transport.js";
import { PublicationRefresh } from "./data_refresh.js";
import type { DetailOutcome } from "./data_requests.js";
import type { ShellDataSource, ShellLiveSource } from "./data_source.js";
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
  readonly #details: DetailLoader;
  #replaced = false;
  #connected = false;
  #closeStream: (() => void) | undefined;
  #streamWarned = false;
  readonly #descriptor: LiveDescriptor;
  readonly #live: ShellLiveSource | undefined;
  readonly #refresh: PublicationRefresh;

  constructor(
    initial: ShellDataSnapshot,
    source: ShellDataSource | undefined,
    host: ShellDataHost,
  ) {
    this.#snapshot = initial;
    this.#source = source;
    this.#host = host;
    this.#details = new DetailLoader(source, {
      snapshot: () => this.#snapshot,
      replaced: () => this.#replaced,
      adopt: (request, outcome) => this.#adopt(request, outcome),
      replace: () => this.#replace(),
      changed: () => this.#changed(),
    });
    this.#live =
      source?.live &&
      staleAwareLiveSource(source.live, (revision) =>
        this.#refreshStale(revision),
      );
    this.#descriptor = new LiveDescriptor(source?.live, {
      generation: () => this.#snapshot.index.live?.generation,
      changed: () => this.#changed(),
      versionError: (error) => host.versionError(error),
      warn: (message, cause) => host.warn(message, cause),
    });
    this.#refresh = new PublicationRefresh(source, {
      index: () => this.#snapshot.index,
      route: () => host.route(),
      adopt: (index, details) =>
        this.#commit(withIndex(this.#snapshot, index, details)),
      deploymentChanged: () => this.#replace(),
      versionError: (error) => host.versionError(error),
      changed: () => this.#changed(),
    });
  }

  get snapshot(): ShellDataSnapshot {
    return this.#snapshot;
  }

  /** The keys of the requested details whose last load failed. */
  get failed(): ReadonlySet<string> {
    return this.#details.failed;
  }

  /** Another deployment replaced the catalogue; no detail loads after it. */
  get replaced(): boolean {
    return this.#replaced;
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
    return this.#refresh.failed;
  }

  /** The live transport, present while a descriptor is installed. */
  get live(): ShellLiveSource | undefined {
    return this.#descriptor.installed ? this.#live : undefined;
  }

  /** A counter that changes with every observable change. */
  readonly version = (): number => this.#version;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Load each missing detail of a route; abort the loads it no longer wants. */
  request(requests: readonly DetailRequest[]): void {
    this.#details.request(requests);
  }

  /** Forget the failures of these keys and load the wanted details again. */
  retry(keys: readonly string[]): void {
    this.#details.retry(keys);
  }

  /** Follow the event stream and load the descriptor while the index is live. */
  connect(): () => void {
    const live = this.#source?.live;
    if (
      this.#connected ||
      this.#replaced ||
      !live ||
      !this.#snapshot.index.live
    )
      return () => {};
    this.#connected = true;
    this.#descriptor.load();
    this.#closeStream = live.subscribe({
      message: (revision, deploymentId) => {
        const installed = this.#snapshot.index;
        if (deploymentId !== installed.deploymentId) {
          this.#replace();
          return;
        }
        if (this.#descriptor.failed) this.#descriptor.load();
        if (revision > installed.revision) this.#refresh.load(revision);
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
    if (this.#replaced) return;
    this.#refresh.load(this.#snapshot.index.revision);
  };

  /** Abort every load; a later request starts them again. */
  abortLoads(): void {
    this.#details.abort();
  }

  #adopt(
    request: DetailRequest,
    outcome: Exclude<DetailOutcome, { kind: "failed" }>,
  ): void {
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
    if (outcome.kind === "deployment") {
      this.#replace();
      return;
    }
  }

  /**
   * Another deployment answered. Stop every load, end the live connection as
   * a disconnect does, and tell the source once; a full page load or the
   * host's new index brings the new data, and a route that still waits for a
   * detail shows the catalogue replaced until then.
   */
  #replace(): void {
    if (this.#replaced) return;
    this.#replaced = true;
    this.abortLoads();
    this.#disconnect();
    this.#source?.deploymentChanged();
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

  /**
   * Serve answered a render of the installed revision with 409, so a newer
   * publication exists. Refresh once, unless a refresh is loading, so the
   * shell adopts it also while the event stream is down.
   */
  #refreshStale(revision: number): void {
    const installed = this.#snapshot.index.revision;
    if (!this.#connected || this.#refresh.loading || revision !== installed)
      return;
    this.#refresh.load(installed + 1);
  }

  #disconnect(): void {
    this.#connected = false;
    this.#closeStream?.();
    this.#closeStream = undefined;
    this.#refresh.stop();
    this.#descriptor.stop();
  }

  #changed(): void {
    this.#version += 1;
    for (const listener of [...this.#listeners]) listener();
  }
}
