/**
 * The refresh of one Serve publication: the index of a newer revision and the
 * routed details, adopted together. One refresh loads at a time.
 */

import type { DetailRequest } from "../catalogue/detail_fences.js";
import type { CatalogueReadModel, EntryDetailV3 } from "../catalogue/types.js";
import type { MoklyVersionError } from "../catalogue/version_error.js";

import { loadRefresh, routeKey } from "./data_requests.js";
import type { ShellDataSource } from "./data_source.js";
import type { ShellRoute } from "./routes.js";

/** What a refresh asks of the controller that owns it. */
export interface PublicationRefreshHost {
  /** The installed index. */
  index(): CatalogueReadModel;
  /** The route on screen now. */
  route(): ShellRoute;
  /** Adopt the refreshed index and the route's details in one commit. */
  adopt(
    index: CatalogueReadModel,
    details: readonly (readonly [DetailRequest, EntryDetailV3])[],
  ): void;
  /** Another deployment answered the refresh. */
  deploymentChanged(): void;
  versionError(error: MoklyVersionError): void;
  /** The route whose last refresh failed changed. */
  changed(): void;
}

/** Load one publication at a time, and keep the route whose refresh failed. */
export class PublicationRefresh {
  readonly #source: ShellDataSource | undefined;
  readonly #host: PublicationRefreshHost;
  #loading: AbortController | undefined;
  #failed: string | undefined;

  constructor(
    source: ShellDataSource | undefined,
    host: PublicationRefreshHost,
  ) {
    this.#source = source;
    this.#host = host;
  }

  /** The route whose last refresh failed. */
  get failed(): string | undefined {
    return this.#failed;
  }

  /** Whether a refresh is loading. */
  get loading(): boolean {
    return this.#loading !== undefined;
  }

  /** Load the publication of this revision; abort an older load. */
  load(revision: number): void {
    const source = this.#source;
    if (!source) return;
    this.#loading?.abort();
    const controller = new AbortController();
    this.#loading = controller;
    void loadRefresh(
      source,
      this.#host.index(),
      () => this.#host.route(),
      revision,
      controller.signal,
    ).then((outcome) => {
      if (controller.signal.aborted) return;
      this.#loading = undefined;
      if (outcome.kind === "accepted") {
        this.#failed = undefined;
        this.#host.adopt(outcome.index, outcome.details);
      } else if (outcome.kind === "deployment") this.#host.deploymentChanged();
      else if (outcome.kind === "version")
        this.#host.versionError(outcome.error);
      else {
        this.#failed = routeKey(this.#host.route());
        this.#host.changed();
      }
    });
  }

  /** Abort the refresh that loads. */
  stop(): void {
    this.#loading?.abort();
    this.#loading = undefined;
  }
}
