/** Bounded immutable snapshots for the selected live screen or saved variant. */
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";

import { isSafeCatalogueRoute } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";
import type {
  ReviewSelection,
  SelectedReviewProvider,
  SelectedReviewSource,
} from "../review/selection_types.js";

import { contentType, safeDecodePath, send } from "./respond.js";
import { redirectReview, sendReviewFailure } from "./review_responses.js";

const PREFIX = "/__mokly/diffs/__generations/selected-";
const RETENTION_MS = 60_000;
const CAPACITY_BYTES = 128 * 1024 * 1024;

interface Generation {
  readonly version: string;
  readonly key: string;
  readonly selection: ReviewSelection;
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly bytes: number;
  expires: number;
}

export class SelectedReviewRoutes {
  private readonly generations = new Map<string, Generation>();
  private readonly pending = new Map<string, Promise<Generation>>();
  private readonly controllers = new Set<AbortController>();
  private tail: Promise<unknown> = Promise.resolve();
  private epoch = 0;
  private closed = false;
  private bytes = 0;
  private readonly expiry = setInterval(
    () => this.prune(),
    RETENTION_MS,
  ).unref();

  constructor(
    private readonly provider: SelectedReviewProvider,
    private readonly source: () => SelectedReviewSource | undefined,
    private readonly base: string,
  ) {}

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
      (url.searchParams.has("route") || url.searchParams.has("variant"));
    if (!stable && !url.pathname.startsWith(PREFIX)) return false;
    try {
      if (stable) {
        const selection = parseSelection(url);
        if (!selection) send(response, 404, "text/plain", "Not found", method);
        else
          redirectReview(
            response,
            generationUrl(
              await this.generate(
                selection,
                url.searchParams.get("refresh") === "1",
              ),
            ),
          );
      } else {
        const relative = safeDecodePath(url.pathname.slice(PREFIX.length));
        const separator = relative?.indexOf("/") ?? -1;
        const generation =
          separator > 0
            ? this.generations.get(relative!.slice(0, separator))
            : undefined;
        const file = relative?.slice(separator + 1);
        if (
          generation &&
          file === "review.json" &&
          url.searchParams.get("refresh") === "1"
        )
          redirectReview(
            response,
            generationUrl(await this.generate(generation.selection, true)),
          );
        else {
          const bytes = file && generation?.files.get(file);
          if (!bytes) send(response, 404, "text/plain", "Not found", method);
          else {
            generation!.expires = Date.now() + RETENTION_MS;
            response.writeHead(200, {
              "cache-control": "no-store",
              "content-type": contentType(file),
              "x-content-type-options": "nosniff",
            });
            response.end(method === "HEAD" ? undefined : bytes);
          }
        }
      }
    } catch (error) {
      sendReviewFailure(response, error, this.base, method);
    }
    return true;
  }

  private generate(
    selection: ReviewSelection,
    refresh: boolean,
  ): Promise<Generation> {
    if (this.closed)
      return Promise.reject(unavailable("Comparison server is closing"));
    const source = this.source();
    if (!source)
      return Promise.reject(
        unavailable("The catalogue comparison is not ready"),
      );
    this.prune();
    const epoch = this.epoch;
    const key = JSON.stringify([epoch, selection.route, selection.variantId]);
    const active = this.pending.get(key);
    if (active) return active;
    const current = [...this.generations.values()].findLast(
      (generation) => generation.key === key,
    );
    if (current && !refresh) {
      current.expires = Date.now() + RETENTION_MS;
      return Promise.resolve(current);
    }
    if (this.pending.size >= 32)
      return Promise.reject(unavailable("Comparison queue is full"));
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 10_000).unref();
    const pending = this.tail
      .then(async () => {
        controller.signal.throwIfAborted();
        const artifact = await this.provider.generate(
          source,
          selection,
          controller.signal,
        );
        controller.signal.throwIfAborted();
        if (epoch !== this.epoch || this.closed)
          throw unavailable("Comparison generation was replaced");
        const files = new Map(
          [...artifact.files].map(([route, bytes]) => [
            route,
            Buffer.from(bytes),
          ]),
        );
        files.set("review.json", Buffer.from(JSON.stringify(artifact.result)));
        const bytes = [...files.values()].reduce(
          (total, file) => total + file.byteLength,
          0,
        );
        if (
          bytes > 64 * 1024 * 1024 ||
          this.bytes + bytes > CAPACITY_BYTES ||
          this.generations.size >= 64
        )
          throw unavailable(
            "Comparison snapshot capacity is full; try again shortly",
          );
        const generation = {
          version: randomUUID(),
          key,
          selection,
          files,
          bytes,
          expires: Date.now() + RETENTION_MS,
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

function parseSelection(url: URL): ReviewSelection | undefined {
  const route = url.searchParams.get("route");
  const variantId = url.searchParams.get("variant");
  if (
    !route ||
    !isSafeCatalogueRoute(route) ||
    url.searchParams.getAll("route").length !== 1 ||
    url.searchParams.getAll("variant").length > 1 ||
    (variantId !== null && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(variantId))
  )
    return undefined;
  return { route, ...(variantId !== null ? { variantId } : {}) };
}

function generationUrl(generation: Generation): string {
  return `${PREFIX}${generation.version}/review.json`;
}

function unavailable(message: string): MoklyError {
  return new MoklyError("review-invalid", message);
}
