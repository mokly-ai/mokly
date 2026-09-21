import fs from "node:fs";
import path from "node:path";

import type { RemovedEntryPreview } from "@mokly/viewer";
import {
  parseRemovedPagePreview,
  type RemovedPagePreviewArtifact,
  type ReviewArtifact,
  type ReviewArtifactContent,
  type ReviewResult,
} from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import { comparisonContentId } from "../export/content_id.js";
import { ownedEntries } from "../export/ownership.js";
import type { RemovedEntrySnapshot } from "../registry/changes.js";
import {
  captureRemovedPagePreviews,
  packageRemovedPagePreviews,
  RepositoryRemovedPagePreview,
} from "../review/page_preview.js";
import type { PreparedReviewRepository } from "../review/prepare.js";
import type { ResolvedCatalogueChanges } from "../server/changed.js";
import type { ServedReview } from "../server/configured_review.js";

/** Complete comparison captured from the publication server. */
export interface CapturedPublicationComparison {
  directory: string;
  redirect: string;
  result: ReviewResult;
}

/** Packaged comparison plus the descriptors its static shells may advertise. */
export interface PublishedPublicationComparison extends CapturedPublicationComparison {
  removedPreviews: ReadonlyMap<string, RemovedEntryPreview>;
}

/** Capture every removed page through the already-pinned publication reader. */
export async function capturePublicationPagePreviews(
  config: ResolvedConfig,
  prepared: PreparedReviewRepository,
  changes: ResolvedCatalogueChanges,
): Promise<ReadonlyMap<string, RemovedPagePreviewArtifact>> {
  if (!changes.componentChanges)
    throw publicationError("Removed-page preview evidence is unavailable.");
  try {
    return await captureRemovedPagePreviews(
      new RepositoryRemovedPagePreview(config, prepared.reader),
      {
        baseline: changes.componentChanges.baseline,
        baseCommit: changes.baseCommit,
        baseRef: changes.baseRef,
        changedRoutes: changes.changedRoutes,
        removedEntries: changes.removedEntries,
        schemaVersion: 1,
      },
      new AbortController().signal,
    );
  } catch (cause) {
    throw typedPublicationError(
      "Could not capture removed-page previews.",
      cause,
    );
  }
}

/**
 * Build descriptors only after validating the complete packaged generation.
 * Consumer export and repository publication share this exact path.
 */
export function staticRemovedPreviews(
  removed: readonly RemovedEntrySnapshot[],
  comparison: Pick<ReviewArtifact, "result"> | undefined,
  files: ReadonlyMap<string, ReviewArtifactContent>,
  prefix: string,
): ReadonlyMap<string, RemovedEntryPreview> | undefined {
  if (!comparison) return;
  try {
    const previews = new Map<string, RemovedEntryPreview>();
    for (const { entry } of removed) {
      if (entry.kind === "screen") {
        const screen = comparison.result.screens.find(
          (candidate) => candidate.route === entry.route,
        );
        if (
          !screen ||
          screen.state !== "removed" ||
          screen.views.length === 0 ||
          screen.views.some((view) => !view.beforePath || view.afterPath)
        )
          throw publicationError(
            `Removed screen preview is incomplete: ${entry.route}`,
          );
        previews.set(entry.route, { kind: "screen" });
      }
      if (entry.kind === "page") {
        const name = `pages/${entry.route}.json`;
        const bytes = files.get(name);
        if (bytes === undefined)
          throw publicationError(
            `Removed page preview is missing: ${entry.route}`,
          );
        const preview = parseRemovedPagePreview(
          JSON.parse(Buffer.from(bytes).toString("utf8")),
        );
        if (
          preview.route !== entry.route ||
          preview.baseCommit !== comparison.result.baseCommit ||
          preview.baseRef !== comparison.result.baseRef
        )
          throw publicationError(
            `Removed page preview does not match the comparison: ${entry.route}`,
          );
        previews.set(entry.route, {
          kind: "page",
          path: `${prefix}/${name}`,
        });
      }
    }
    return previews;
  } catch (cause) {
    throw typedPublicationError(
      "Could not validate removed-content preview descriptors.",
      cause,
    );
  }
}

/** Move a completed comparison and its page previews into the static artifact. */
export async function publishPublicationComparison(
  provider: Pick<ServedReview, "outDir">,
  comparison: CapturedPublicationComparison,
  stage: string,
  removed: readonly RemovedEntrySnapshot[],
  pagePreviews: ReadonlyMap<string, RemovedPagePreviewArtifact>,
): Promise<PublishedPublicationComparison> {
  try {
    const files = new Map<string, ReviewArtifactContent>();
    for (const name of (await ownedEntries(provider.outDir)).files)
      if (![".mokly-review-artifact", "summary.md"].includes(name))
        files.set(
          name,
          await fs.promises.readFile(path.join(provider.outDir, name)),
        );
    const packaged = packageRemovedPagePreviews(files, pagePreviews);
    const directory = `__mokly/diffs/__generations/${comparisonContentId(packaged)}`;
    const removedPreviews = staticRemovedPreviews(
      removed,
      { result: comparison.result },
      packaged,
      directory,
    );
    if (!removedPreviews)
      throw publicationError("Removed-content descriptors are unavailable.");
    for (const [name, bytes] of packaged) {
      const target = path.join(provider.outDir, name);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, bytes);
    }
    const target = path.join(stage, directory);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.rename(provider.outDir, target);
    await fs.promises.rm(path.join(target, ".mokly-review-artifact"));
    await fs.promises.rm(path.join(target, "summary.md"));
    return { ...comparison, directory, removedPreviews };
  } catch (cause) {
    throw typedPublicationError(
      "Could not package removed-content previews.",
      cause,
    );
  }
}

/** Preserve the repository preview's immutable-generation hosting metadata. */
export function publicationComparisonMetadata(comparisonUrl: string): {
  headers: string;
  redirect: string;
} {
  if (
    !/^\/__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/.test(
      comparisonUrl,
    )
  )
    throw publicationError(
      "Preview comparison did not resolve an immutable generation.",
    );
  return {
    redirect: `/__mokly/diffs/review.json ${comparisonUrl} 302`,
    headers:
      "/__mokly/diffs/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n",
  };
}

function typedPublicationError(message: string, cause: unknown): MoklyError {
  return cause instanceof MoklyError ? cause : publicationError(message, cause);
}

function publicationError(message: string, cause?: unknown): MoklyError {
  return new MoklyError("export-invalid", message, { cause });
}
