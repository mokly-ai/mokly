/** Load the detail set for one shell route and track its failures. */

import { detailKey, type DetailRequest } from "../catalogue/detail_fences.js";

import type { ShellDataSnapshot } from "./data_commit.js";
import {
  loadFencedDetail,
  startDeploymentCheck,
  type DetailOutcome,
} from "./data_requests.js";
import type { ShellDataSource } from "./data_source.js";

interface DetailLoaderHost {
  snapshot(): ShellDataSnapshot;
  replaced(): boolean;
  adopt(
    request: DetailRequest,
    outcome: Exclude<DetailOutcome, { kind: "failed" }>,
  ): void;
  replace(): void;
  changed(): void;
}

/** Own detail requests, deployment checks, and route-level failures. */
export class DetailLoader {
  readonly #source: ShellDataSource | undefined;
  readonly #host: DetailLoaderHost;
  readonly #loading = new Map<string, AbortController>();
  #deploymentLoading: AbortController | undefined;
  #wanted: readonly DetailRequest[] = [];
  #failed: ReadonlySet<string> = new Set();

  constructor(source: ShellDataSource | undefined, host: DetailLoaderHost) {
    this.#source = source;
    this.#host = host;
  }

  get failed(): ReadonlySet<string> {
    return this.#failed;
  }

  request(requests: readonly DetailRequest[], checkDeployment = true): void {
    const sameRequest = this.#wanted === requests;
    this.#wanted = requests;
    const source = this.#source;
    if (!source || this.#host.replaced()) return;
    this.#deploymentLoading?.abort();
    const deploymentRequest =
      checkDeployment && !sameRequest
        ? startDeploymentCheck(source, requests)
        : undefined;
    this.#deploymentLoading = deploymentRequest?.controller;
    if (deploymentRequest)
      void deploymentRequest.promise.then((deployment) => {
        if (
          deployment !== undefined &&
          deployment.deploymentId !== this.#host.snapshot().index.deploymentId
        )
          this.#host.replace();
      });
    const wanted = new Set(requests.map(detailKey));
    for (const [key, controller] of this.#loading)
      if (!wanted.has(key)) {
        controller.abort();
        this.#loading.delete(key);
      }
    for (const request of requests) {
      const key = detailKey(request);
      if (
        this.#host.snapshot().details.has(key) ||
        this.#failed.has(key) ||
        this.#loading.has(key)
      )
        continue;
      const controller = new AbortController();
      this.#loading.set(key, controller);
      void loadFencedDetail(
        source,
        this.#host.snapshot().index,
        request,
        controller.signal,
        deploymentRequest?.promise,
      ).then((outcome) => {
        if (controller.signal.aborted) return;
        this.#loading.delete(key);
        if (outcome.kind === "failed") {
          source.detailFailed?.(request);
          this.#failed = new Set(this.#failed).add(key);
          this.#host.changed();
        } else this.#host.adopt(request, outcome);
      });
    }
  }

  retry(keys: readonly string[]): void {
    const failed = new Set(this.#failed);
    for (const key of keys) failed.delete(key);
    this.#failed = failed;
    this.#host.changed();
    this.request(this.#wanted);
  }

  abort(): void {
    this.#deploymentLoading?.abort();
    this.#deploymentLoading = undefined;
    for (const controller of this.#loading.values()) controller.abort();
    this.#loading.clear();
  }
}
