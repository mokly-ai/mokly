/** Parse and capture one selection without owning its generation lifetime. */
import { isEntryPath } from "@mokly/viewer/data";
import type { ReviewArtifactContent } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";
import { renderRemovedPagePreviewArtifact } from "../review/page_preview.js";
import type {
  RemovedPagePreviewProvider,
  RemovedPagePreviewSource,
  RemovedPageSelection,
  ReviewSelection,
  SelectedReviewProvider,
  SelectedReviewSource,
} from "../review/selection_types.js";

export interface SelectedReviewLimits {
  readonly artifactBytes: number;
  readonly capacityBytes: number;
  readonly deadlineMs: number;
  readonly generations: number;
  readonly pending: number;
  readonly retentionMs: number;
}

export interface SelectedReviewRoutesOptions {
  readonly base: string;
  readonly comparison?: {
    readonly provider: SelectedReviewProvider;
    readonly source: () => SelectedReviewSource | undefined;
  };
  readonly page?: {
    readonly provider: RemovedPagePreviewProvider;
    readonly source: () => RemovedPagePreviewSource | undefined;
  };
  readonly limits?: Partial<SelectedReviewLimits>;
}

export type SelectedRequest =
  | { readonly kind: "comparison"; readonly selection: ReviewSelection }
  | { readonly kind: "page"; readonly selection: RemovedPageSelection };

export interface SelectedCapture {
  readonly document: "preview.json" | "review.json";
  readonly artifact: ReadonlyMap<string, ReviewArtifactContent>;
}

export function parseSelectedRequest(url: URL): SelectedRequest | undefined {
  if (
    [...url.searchParams.keys()].some(
      (key) => !["path", "page", "refresh"].includes(key),
    )
  )
    return undefined;
  const pages = url.searchParams.getAll("page");
  const ids = url.searchParams.getAll("path");
  if (pages.length === 1 && ids.length === 0) {
    const id = pages[0]!;
    return isEntryPath(id)
      ? { kind: "page", selection: { kind: "page", path: id } }
      : undefined;
  }
  if (pages.length > 0 || ids.length !== 1) return undefined;
  const id = ids[0]!;
  if (!isEntryPath(id)) return undefined;
  return {
    kind: "comparison",
    selection: { path: id },
  };
}

export function selectedRequestKey(
  epoch: number,
  request: SelectedRequest,
): string {
  return JSON.stringify([epoch, request.kind, request.selection.path]);
}

export function prepareSelectedCapture(
  options: SelectedReviewRoutesOptions,
  request: SelectedRequest,
): (signal: AbortSignal) => Promise<SelectedCapture> {
  if (request.kind === "page") {
    const service = options.page;
    const source = service?.source();
    if (!service || !source) throw selectedUnavailable();
    return async (signal) => {
      const artifact = await service.provider.generate(
        source,
        request.selection,
        signal,
      );
      if (
        artifact.preview.path !== request.selection.path ||
        artifact.preview.baseCommit !== source.baseCommit ||
        artifact.preview.baseRef !== source.baseRef
      )
        throw new MoklyError(
          "review-invalid",
          "The page preview does not match its accepted selection",
        );
      return {
        document: "preview.json",
        artifact: renderRemovedPagePreviewArtifact(artifact),
      };
    };
  }
  const service = options.comparison;
  const source = service?.source();
  if (!service || !source) throw selectedUnavailable();
  return async (signal) => {
    const artifact = await service.provider.generate(
      source,
      request.selection,
      signal,
    );
    return {
      document: "review.json",
      artifact: new Map([
        ...artifact.files,
        ["review.json", Buffer.from(JSON.stringify(artifact.result))],
      ]),
    };
  };
}

function selectedUnavailable(): MoklyError {
  return new MoklyError(
    "review-invalid",
    "The catalogue comparison is not ready",
  );
}
