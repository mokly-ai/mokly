/** Parse and capture one selection without owning its generation lifetime. */
import { isSafeCatalogueRoute } from "@mokly/viewer/data";
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
  const pages = url.searchParams.getAll("page");
  const routes = url.searchParams.getAll("route");
  const variants = url.searchParams.getAll("variant");
  if (pages.length === 1 && routes.length === 0 && variants.length === 0) {
    const route = pages[0]!;
    return isSafeCatalogueRoute(route)
      ? { kind: "page", selection: { kind: "page", route } }
      : undefined;
  }
  if (pages.length > 0 || routes.length !== 1 || variants.length > 1)
    return undefined;
  const route = routes[0]!;
  const variantId = variants[0];
  if (
    !isSafeCatalogueRoute(route) ||
    (variantId !== undefined &&
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(variantId))
  )
    return undefined;
  return {
    kind: "comparison",
    selection: { route, ...(variantId !== undefined ? { variantId } : {}) },
  };
}

export function selectedRequestKey(
  epoch: number,
  request: SelectedRequest,
): string {
  return JSON.stringify([
    epoch,
    request.kind,
    request.selection.route,
    request.kind === "comparison" ? request.selection.variantId : undefined,
  ]);
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
        artifact.preview.route !== request.selection.route ||
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
