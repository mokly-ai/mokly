/** Resolve and fetch one removed entry's previous version. */

import { historicalSnapshotId } from "../catalogue/snapshot_identity.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";
import { encodeUrlPath } from "../data/paths.js";
import { previewMetadataPath, snapshotSidePath } from "../navigation/routes.js";
import type { RemovedPreviewData } from "../shell/previews.js";

import { pageContent, screenContent } from "./content.js";

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
  | {
      kind: "document";
      views: readonly { colorScheme: ColorScheme; url: string }[];
    }
  | { kind: "screen"; views: readonly PreviewScreenView[] };

/** A parsed preview and the immutable address its documents resolve against. */
export interface LoadedPreview {
  /** Validated page or screen documents named by the preview metadata. */
  content: PreviewContent;
  /** Absolute generation root that owns every historical document. */
  generation: string;
  /** Final metadata response URL used to renew a live generation. */
  url: string;
}

/** One address to request and the generation its documents belong to. */
export interface PreviewRequest {
  endpoint: URL;
  /**
   * Generation root the historical documents resolve against. A packaged page
   * descriptor sits under `previews/<path>/`, so its documents resolve against the
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

/** Exact files and directory prefixes in the documented embedded fetch set. */
export interface AdvertisedPreviewPaths {
  /** Metadata files that catalogue descriptors advertise. */
  files: readonly string[];
  /** Snapshot prefixes advertised by the comparison generation. */
  prefixes: readonly string[];
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
      data.kind === "screen" ? "path" : "page",
      data.path,
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
  const path = `${prefix}${previewMetadataPath(data.path)}`;
  return {
    endpoint: new URL(`/${encodeUrlPath(path)}`, base),
    generation,
  };
}

/**
 * The documented embedded fetch set for one catalogue, relative to the
 * artifact root. Tests verify this description; presentation loaders enforce
 * their own generation and snapshot-side boundaries at runtime.
 */
export function advertisedPreviewPaths(
  model: CatalogueReadModel,
): AdvertisedPreviewPaths {
  const comparison = model.comparisonUrl;
  return {
    files: [
      ...(comparison === null ? [] : [comparison]),
      ...model.removedEntries.flatMap((removed) =>
        (removed.preview?.kind === "page" ||
          removed.preview?.kind === "document") &&
        comparison !== null
          ? [
              `${comparison.slice(0, -REVIEW_FILE.length)}${previewMetadataPath(removed.entry.path)}`,
            ]
          : [],
      ),
    ],
    prefixes:
      comparison === null
        ? []
        : (["before", "after"] as const).map(
            (side) =>
              `${comparison.slice(0, -REVIEW_FILE.length)}${snapshotSidePath(side)}`,
          ),
  };
}

function unavailable(): never {
  throw new Error("The previous version is unavailable.");
}

function generationFromUrl(value: string | URL): string | undefined {
  const path = new URL(value).pathname;
  return /^\/__mokly\/diffs\/__generations\/([a-f0-9]{64})\//.exec(path)?.[1];
}

function snapshotMatches(
  data: RemovedPreviewData,
  request: PreviewRequest,
  responseUrl: string,
  baseCommit: string,
): boolean {
  if (data.snapshotId === undefined && data.catalogueIdentity === undefined)
    return true;
  if (!data.snapshotId || !data.catalogueIdentity) return false;
  if (
    historicalSnapshotId(
      data.catalogueIdentity,
      { kind: "baseline", identity: baseCommit },
      data,
    ) === data.snapshotId
  )
    return true;
  const response = new URL(responseUrl);
  if (response.origin !== request.endpoint.origin) return false;
  const requestedGeneration = generationFromUrl(
    request.generation ?? request.endpoint,
  );
  const responseGeneration = generationFromUrl(response);
  if (
    requestedGeneration !== undefined &&
    responseGeneration !== requestedGeneration
  )
    return false;
  const generation = requestedGeneration ?? responseGeneration;
  return (
    generation !== undefined &&
    historicalSnapshotId(
      data.catalogueIdentity,
      { kind: "generation", identity: generation },
      data,
    ) === data.snapshotId
  );
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
  const parsed =
    data.kind === "screen"
      ? screenContent(data, payload, base)
      : pageContent(data, payload, base);
  if (!snapshotMatches(data, request, response.url, parsed.baseCommit))
    unavailable();
  return {
    content: parsed.content,
    generation: new URL(".", base).href,
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
