/** Resolve and fetch one removed entry's previous version. */

import type { CatalogueReadModel } from "../catalogue/types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";
import { encodeUrlPath } from "../data/paths.js";
import { parseRemovedPagePreview } from "../review/page_preview.js";
import { parseReviewResult } from "../review/result_validation.js";
import type { RemovedPreviewData } from "../shell/previews.js";

const STABLE_ENDPOINT = "/__mokly/diffs/review.json";
const REVIEW_FILE = "review.json";

/** One historical screen view rendered in its own device frame. */
export interface PreviewScreenView {
  colorScheme: ColorScheme;
  url: string;
  viewport: Viewport;
}

/** The historical documents one loaded preview renders. */
export type PreviewContent =
  | { kind: "page"; url: string }
  | { kind: "screen"; views: readonly PreviewScreenView[] };

/** A parsed preview and the immutable address its documents resolve against. */
export interface LoadedPreview {
  content: PreviewContent;
  url: string;
}

/** One address to request and the generation its documents belong to. */
export interface PreviewRequest {
  endpoint: URL;
  /**
   * Generation root the historical documents resolve against. A packaged page
   * descriptor sits under `pages/`, so its documents resolve against the
   * comparison's generation rather than the descriptor's own directory.
   */
  generation?: URL;
}

/** Static metadata needed to resolve an advertised previous version. */
export interface PreviewDelivery {
  comparisonUrl: string | null;
}

/** Fetch boundary supplied by the shell that owns the preview. */
export interface PreviewRequestEnvironment {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

/**
 * The address to request, or `undefined` when the delivery advertises nothing
 * for this entry. Static delivery loads only advertised addresses, so an older
 * catalogue without the descriptor reports unavailable without any request.
 */
export function previewEndpoint(
  data: RemovedPreviewData,
  delivery: PreviewDelivery | undefined,
  base: string,
  refresh: boolean,
): PreviewRequest | undefined {
  if (!delivery) {
    const endpoint = new URL(STABLE_ENDPOINT, base);
    endpoint.searchParams.set(
      data.kind === "page" ? "page" : "route",
      data.route,
    );
    if (refresh) endpoint.searchParams.set("refresh", "1");
    return { endpoint };
  }
  const comparisonUrl = delivery.comparisonUrl;
  const advertised = data.published;
  if (comparisonUrl === null || !advertised) return undefined;
  if (advertised.kind !== data.kind) return undefined;
  const comparisonPath = comparisonUrl.replace(/^\/+/, "");
  const generation = new URL(`/${comparisonPath}`, base);
  if (advertised.kind === "screen") return { endpoint: generation };
  const prefix = comparisonPath.slice(0, -REVIEW_FILE.length);
  return advertised.path === `${prefix}pages/${data.route}.json`
    ? {
        endpoint: new URL(`/${encodeUrlPath(advertised.path)}`, base),
        generation,
      }
    : undefined;
}

/**
 * Every address a catalogue advertises for historical content, relative to the
 * artifact root. An embedded viewer requests nothing outside this set.
 */
export function advertisedPreviewPaths(
  model: CatalogueReadModel,
): readonly string[] {
  return [
    ...(model.comparisonUrl === null ? [] : [model.comparisonUrl]),
    ...model.removedEntries.flatMap((removed) =>
      removed.preview?.kind === "page" ? [removed.preview.path] : [],
    ),
  ];
}

function unavailable(): never {
  throw new Error("The previous version is unavailable.");
}

function screenContent(
  data: RemovedPreviewData,
  payload: unknown,
  base: string,
): PreviewContent {
  const result = parseReviewResult(payload);
  const screen = result.screens.find(
    (candidate) => candidate.route === data.route,
  );
  if (!screen || screen.views.some((view) => view.afterPath)) unavailable();
  const views = screen.views.flatMap((view) =>
    view.state === "removed" && view.beforePath
      ? [
          {
            colorScheme: view.colorScheme,
            url: new URL(encodeUrlPath(view.beforePath), base).href,
            viewport: view.viewport,
          },
        ]
      : [],
  );
  if (!views.length) unavailable();
  return { kind: "screen", views };
}

function pageContent(
  data: RemovedPreviewData,
  payload: unknown,
  base: string,
): PreviewContent {
  const preview = parseRemovedPagePreview(payload);
  if (preview.route !== data.route) unavailable();
  return {
    kind: "page",
    url: new URL(encodeUrlPath(preview.documentPath), base).href,
  };
}

/** Request one preview and validate it against the entry that asked for it. */
export async function requestPreview(
  data: RemovedPreviewData,
  request: PreviewRequest,
  environment: PreviewRequestEnvironment,
  signal: AbortSignal,
): Promise<LoadedPreview> {
  const response = await environment.fetch(request.endpoint.href, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) unavailable();
  const payload: unknown = await response.json();
  const base = request.generation?.href ?? response.url;
  return {
    content:
      data.kind === "screen"
        ? screenContent(data, payload, base)
        : pageContent(data, payload, base),
    url: response.url,
  };
}

/**
 * Extend a development generation's retention before reusing its documents.
 * A generation that expired while the entry stayed open resolves elsewhere, so
 * its documents are requested again rather than rendered from stale addresses.
 */
export async function renewPreview(
  loaded: LoadedPreview,
  environment: PreviewRequestEnvironment,
  signal: AbortSignal,
): Promise<boolean> {
  const renewal = await environment.fetch(loaded.url, {
    cache: "no-store",
    method: "HEAD",
    signal,
  });
  return renewal.ok && renewal.url === loaded.url;
}
