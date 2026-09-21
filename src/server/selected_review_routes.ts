/** Bounded immutable snapshots for a selected comparison or removed page. */
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";

import { MoklyError } from "../errors.js";

import { contentType, safeDecodePath, send } from "./respond.js";
import { redirectReview, sendReviewFailure } from "./review_responses.js";
import {
  parseSelectedRequest,
  prepareSelectedCapture,
  selectedRequestKey,
  type SelectedRequest,
  type SelectedReviewLimits,
  type SelectedReviewRoutesOptions,
} from "./selected_review_capture.js";

const PREFIX = "/__mokly/diffs/__generations/selected-";
const DEFAULT_LIMITS: SelectedReviewLimits = {
  artifactBytes: 64 * 1024 * 1024,
  capacityBytes: 128 * 1024 * 1024,
  deadlineMs: 10_000,
  generations: 64,
  pending: 32,
  retentionMs: 60_000,
};

interface Generation {
  readonly version: string;
  readonly key: string;
  readonly request: SelectedRequest;
  readonly document: "preview.json" | "review.json";
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly bytes: number;
  expires: number;
}

export class SelectedReviewRoutes {
  private readonly generations = new Map<string, Generation>();
  private readonly pending = new Map<string, Promise<Generation>>();
  private readonly controllers = new Set<AbortController>();
  private readonly limits: SelectedReviewLimits;
  private readonly expiry: NodeJS.Timeout;
  private tail: Promise<unknown> = Promise.resolve();
  private epoch = 0;
  private closed = false;
  private bytes = 0;

  constructor(private readonly options: SelectedReviewRoutesOptions) {
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.expiry = setInterval(
      () => this.prune(),
      this.limits.retentionMs,
    ).unref();
  }

  invalidate(): void {
    this.epoch++;
    for (const controller of this.controllers) controller.abort();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.invalidate();
    clearInterval(this.expiry);
    await this.tail;
    this.generations.clear();
    this.bytes = 0;
  }

  async handle(
    url: URL,
    response: ServerResponse,
    method: string,
  ): Promise<boolean> {
    const stable =
      url.pathname === "/__mokly/diffs/review.json" &&
      ["page", "route", "variant"].some((name) => url.searchParams.has(name));
    if (!stable && !url.pathname.startsWith(PREFIX)) return false;
    try {
      if (stable) {
        const request = parseSelectedRequest(url);
        if (!request) send(response, 404, "text/plain", "Not found", method);
        else
          redirectReview(
            response,
            generationUrl(
              await this.generate(
                request,
                url.searchParams.get("refresh") === "1",
              ),
            ),
          );
      } else {
        await this.handleGeneration(url, response, method);
      }
    } catch (error) {
      sendReviewFailure(response, error, this.options.base, method);
    }
    return true;
  }

  private async handleGeneration(
    url: URL,
    response: ServerResponse,
    method: string,
  ): Promise<void> {
    const relative = safeDecodePath(url.pathname.slice(PREFIX.length));
    const separator = relative?.indexOf("/") ?? -1;
    const generation =
      separator > 0
        ? this.generations.get(relative!.slice(0, separator))
        : undefined;
    const file = relative?.slice(separator + 1);
    if (
      generation &&
      file === generation.document &&
      url.searchParams.get("refresh") === "1"
    ) {
      redirectReview(
        response,
        generationUrl(await this.generate(generation.request, true)),
      );
      return;
    }
    const bytes = file && generation?.files.get(file);
    if (!bytes) return send(response, 404, "text/plain", "Not found", method);
    generation!.expires = Date.now() + this.limits.retentionMs;
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentType(file),
      "x-content-type-options": "nosniff",
    });
    response.end(method === "HEAD" ? undefined : bytes);
  }

  private generate(
    request: SelectedRequest,
    refresh: boolean,
  ): Promise<Generation> {
    if (this.closed)
      return Promise.reject(unavailable("Comparison server is closing"));
    this.prune();
    const epoch = this.epoch;
    const key = selectedRequestKey(epoch, request);
    const active = this.pending.get(key);
    if (active) return active;
    const current = [...this.generations.values()].findLast(
      (generation) => generation.key === key,
    );
    if (current && !refresh) {
      current.expires = Date.now() + this.limits.retentionMs;
      return Promise.resolve(current);
    }
    if (this.pending.size >= this.limits.pending)
      return Promise.reject(unavailable("Comparison queue is full"));
    const capture = prepareSelectedCapture(this.options, request);
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(
      () => controller.abort(),
      this.limits.deadlineMs,
    ).unref();
    const pending = this.tail
      .then(async () => {
        controller.signal.throwIfAborted();
        const { document, artifact } = await capture(controller.signal);
        controller.signal.throwIfAborted();
        if (epoch !== this.epoch || this.closed)
          throw unavailable("Comparison generation was replaced");
        const files = new Map(
          [...artifact].map(([route, bytes]) => [route, Buffer.from(bytes)]),
        );
        const bytes = [...files.values()].reduce(
          (total, file) => total + file.byteLength,
          0,
        );
        if (
          bytes > this.limits.artifactBytes ||
          this.bytes + bytes > this.limits.capacityBytes ||
          this.generations.size >= this.limits.generations
        )
          throw unavailable(
            "Comparison snapshot capacity is full; try again shortly",
          );
        const generation = {
          version: randomUUID(),
          key,
          request,
          document,
          files,
          bytes,
          expires: Date.now() + this.limits.retentionMs,
        };
        this.generations.set(generation.version, generation);
        this.bytes += bytes;
        return generation;
      })
      .finally(() => {
        clearTimeout(timer);
        this.controllers.delete(controller);
        if (this.pending.get(key) === pending) this.pending.delete(key);
      });
    this.pending.set(key, pending);
    this.tail = pending.catch(() => {});
    return pending;
  }

  private prune(): void {
    for (const [version, generation] of this.generations)
      if (generation.expires <= Date.now()) {
        this.generations.delete(version);
        this.bytes -= generation.bytes;
      }
  }
}

function generationUrl(generation: Generation): string {
  return `${PREFIX}${generation.version}/${generation.document}`;
}

function unavailable(message: string): MoklyError {
  return new MoklyError("review-invalid", message);
}
