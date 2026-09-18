/** Lazy comparison snapshots used by the catalogue diff controls. */
import type { ServerResponse } from "node:http";

import type { ResolvedConfig } from "../config/types.js";
import type { ReadOnlyReviewRepository } from "../review/repository.js";
import { runReview } from "../review/run.js";
import { RepositorySelectedReview } from "../review/selected.js";
import type {
  SelectedReviewProvider,
  SelectedReviewSource,
} from "../review/selection_types.js";

import { PublicReviewAliases, type PublicComparison } from "./public_review.js";
import { safeDecodePath, send } from "./respond.js";
import {
  ReviewGenerationStore,
  type ReviewArtifactProvider,
  type ReviewGeneration,
} from "./review_generations.js";
import type { ReviewRepositorySource } from "./review_repository.js";
import {
  redirectReview,
  sendReviewFailure,
  serveReviewArtifactFile,
} from "./review_responses.js";
import {
  DIFF_ROUTE,
  GENERATION_ROUTE,
  generationPath,
  generationUrl,
  isReviewDocument,
  isSnapshot,
  reviewServerClosing,
} from "./review_urls.js";
import { SelectedReviewRoutes } from "./selected_review_routes.js";

/** How Browse obtains the Review artifact it serves under `/__mokly/diffs/`. */
export interface ServedReview extends ReviewArtifactProvider {
  /** Comparison base ref, shown when the comparison cannot be generated. */
  base: string;
  selected?: SelectedReviewProvider;
  repository?(): ReadOnlyReviewRepository;
}

/** Serve the configured Git comparison from the consumer's Review engine. */
export function configuredServedReview(
  config: ResolvedConfig,
  base: string,
  git: ReadOnlyReviewRepository | ReviewRepositorySource,
): ServedReview {
  const repository = () => ("current" in git ? git.current() : git);
  return {
    base,
    repository,
    selected: new RepositorySelectedReview(
      config,
      "current" in git ? undefined : git.reader,
    ),
    async generate(options): Promise<void> {
      await runReview(
        config,
        base,
        config.review.outDir,
        repository(),
        undefined,
        options.changedPathExclusions,
      );
    },
    outDir: config.review.outDir,
  };
}

/** Serialize lazy Review generation and serve the artifact's files. */
export class ReviewRoutes {
  private closed = false;
  private closePromise: Promise<void> | undefined;
  private generation: Promise<ReviewGeneration> | undefined;
  private generationKind: "demand" | "refresh" | undefined;
  private queuedGeneration: Promise<ReviewGeneration> | undefined;
  private readonly generations: ReviewGenerationStore;
  private stale = false;
  private readonly selected: SelectedReviewRoutes | undefined;
  private readonly publicAliases: PublicReviewAliases;
  private epoch = 0;

  constructor(
    private readonly review: ServedReview,
    private readonly source: () => SelectedReviewSource | undefined = () =>
      undefined,
    private readonly onPublicComparison?: (
      comparison: PublicComparison,
    ) => void,
  ) {
    this.generations = new ReviewGenerationStore(review);
    this.publicAliases = new PublicReviewAliases(this.generations);
    this.selected = review.selected
      ? new SelectedReviewRoutes(review.selected, source, review.base)
      : undefined;
  }

  /** Mark the cached artifact stale after an update that reloads browsers. */
  invalidate(): void {
    this.epoch++;
    if (!this.closed) this.stale = true;
    this.selected?.invalidate();
  }

  /** Drain generation work and remove retained artifacts when the server stops. */
  close(): Promise<void> {
    this.closePromise ??= this.finishClose();
    return this.closePromise;
  }

  /** Respond to one `/__mokly/diffs/` or `/__mokly/diffs/<path>` request. */
  async handle(
    url: URL,
    response: ServerResponse,
    method: string,
  ): Promise<void> {
    if (this.publicAliases.handle(url, response, method)) return;
    if (await this.selected?.handle(url, response, method)) return;
    if (url.pathname.startsWith(GENERATION_ROUTE)) {
      const requested = generationPath(url.pathname);
      if (
        !requested ||
        (!isSnapshot(requested.relative) &&
          !isReviewDocument(requested.relative))
      )
        return send(response, 404, "text/plain", "Not found", method);
      await this.handleGeneration(requested, url, response, method);
      return;
    }
    const relative = safeDecodePath(url.pathname.slice(DIFF_ROUTE.length));
    if (relative !== "review.json")
      return send(response, 404, "text/plain", "Not found", method);
    try {
      const generation = await this.ensureGenerated(
        url.searchParams.get("refresh") === "1",
      );
      redirectReview(response, generationUrl(generation, relative));
    } catch (error) {
      return sendReviewFailure(response, error, this.review.base, method);
    }
  }

  /** Reuse a fresh generation; stale and refresh requests queue after it. */
  private ensureGenerated(refresh: boolean): Promise<ReviewGeneration> {
    if (this.closed) return Promise.reject(reviewServerClosing());
    if (this.queuedGeneration) return this.queuedGeneration;
    if (this.generation) {
      if (this.stale || (refresh && this.generationKind === "demand")) {
        return this.queueGeneration(this.generation);
      }
      return this.generation;
    }
    const current = this.generations.current();
    if (current && !refresh && !this.stale) return Promise.resolve(current);
    return this.startGeneration(refresh || this.stale ? "refresh" : "demand");
  }

  private startGeneration(
    kind: "demand" | "refresh",
  ): Promise<ReviewGeneration> {
    if (this.closed) return Promise.reject(reviewServerClosing());
    this.stale = false;
    const epoch = this.epoch,
      source = this.source();
    const generation = this.generations.generate().then(async (generation) => {
      if (
        source &&
        this.onPublicComparison &&
        epoch === this.epoch &&
        !this.closed
      ) {
        const comparison = await this.publicAliases.capture(generation, source);
        if (comparison && epoch === this.epoch && !this.closed)
          this.onPublicComparison(comparison);
      }
      return generation;
    });
    this.trackGeneration(generation, kind);
    return generation;
  }

  private queueGeneration(
    active: Promise<ReviewGeneration>,
  ): Promise<ReviewGeneration> {
    const queued = active
      .catch(() => undefined)
      .then(() => {
        if (this.queuedGeneration === queued) this.queuedGeneration = undefined;
        return this.startGeneration("refresh");
      });
    this.queuedGeneration = queued;
    return queued;
  }

  private trackGeneration(
    generation: Promise<ReviewGeneration>,
    kind: "demand" | "refresh",
  ): void {
    this.generation = generation;
    this.generationKind = kind;
    void generation.then(
      () => {
        if (this.generation === generation) {
          this.generation = undefined;
          this.generationKind = undefined;
        }
      },
      () => {
        if (this.generation === generation) {
          this.generation = undefined;
          this.generationKind = undefined;
          if (!this.closed) this.stale = true;
        }
      },
    );
  }

  private async finishClose(): Promise<void> {
    this.closed = true;
    await this.selected?.close();
    const pending = this.queuedGeneration ?? this.generation;
    if (pending) await Promise.allSettled([pending]);
    await this.generations.close();
  }

  private async handleGeneration(
    requested: { readonly relative: string; readonly version: string },
    url: URL,
    response: ServerResponse,
    method: string,
  ): Promise<void> {
    const generation = this.generations.get(requested.version);
    const current = this.generations.current();
    const refresh =
      isReviewDocument(requested.relative) &&
      url.searchParams.get("refresh") === "1";
    const pending = this.queuedGeneration ?? this.generation;
    const advance =
      refresh ||
      (isReviewDocument(requested.relative) &&
        (this.stale ||
          pending !== undefined ||
          (current !== undefined && current.version !== requested.version)));
    if (advance) {
      try {
        const latest =
          refresh || this.stale || pending
            ? await this.ensureGenerated(refresh)
            : current;
        if (latest)
          return redirectReview(
            response,
            generationUrl(latest, requested.relative),
          );
      } catch (error) {
        return sendReviewFailure(response, error, this.review.base, method);
      }
    }
    if (
      !isSnapshot(requested.relative) &&
      !isReviewDocument(requested.relative)
    )
      return send(response, 404, "text/plain", "Not found", method);
    if (generation) {
      return serveReviewArtifactFile(
        generation.directory,
        requested.relative,
        response,
        method,
      );
    }
    if (!isReviewDocument(requested.relative))
      return send(response, 404, "text/plain", "Not found", method);
    try {
      const latest = await this.ensureGenerated(false);
      return redirectReview(
        response,
        generationUrl(latest, requested.relative),
      );
    } catch (error) {
      return sendReviewFailure(response, error, this.review.base, method);
    }
  }
}
