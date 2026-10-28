/** Resolve and fetch one removed entry's previous version. */

import { removedEntryDetailPath } from "../catalogue/delivery_paths.js";
import { historicalSnapshotId } from "../catalogue/snapshot_identity.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";
import { encodeUrlPath } from "../data/paths.js";
import { previewMetadataPath, snapshotSidePath } from "../navigation/routes.js";
import type { RemovedPreviewData } from "../shell/previews.js";

import { pageContent, screenContent, type ParsedPreview } from "./content.js";

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
   * Generation root the historical documents resolve against. A removed
   * screen's detail sits under `entries/` and a page descriptor under
   * `previews/<path>/`, so documents resolve against the comparison's
   * generation rather than the metadata's own directory.
   */
  generation: URL;
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
): PreviewRequest | undefined {
  if (!delivery) return undefined;
  const comparisonUrl = delivery.comparisonUrl;
  const advertised = data.published;
  if (comparisonUrl === null || !advertised) return undefined;
  if (advertised.kind !== data.kind) return undefined;
  const comparisonPath = comparisonUrl.replace(/^\/+/, "");
  const generation = new URL(`/${comparisonPath}`, base);
  const path =
    advertised.kind === "screen"
      ? removedEntryDetailPath(comparisonPath, data.path)
      : `${comparisonPath}${encodeUrlPath(previewMetadataPath(data.path))}`;
  return { endpoint: new URL(`/${path}`, base), generation };
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
  if (comparison === null) return { files: [], prefixes: [] };
  return {
    files: model.removedEntries.flatMap((removed) =>
      removed.preview?.kind === "screen"
        ? [removedEntryDetailPath(comparison, removed.entry.path)]
        : removed.preview?.kind === "page" ||
            removed.preview?.kind === "document"
          ? [`${comparison}${previewMetadataPath(removed.entry.path)}`]
          : [],
    ),
    prefixes: (["before", "after"] as const).map(
      (side) => `${comparison}${snapshotSidePath(side)}`,
    ),
  };
}

function unavailable(): never {
  throw new Error("The previous version is unavailable.");
}

/**
 * Whether the loaded metadata names the requested removed record: a removed
 * screen's detail repeats its snapshot id, and a page descriptor's base commit
 * derives it.
 */
function snapshotMatches(
  data: RemovedPreviewData,
  parsed: ParsedPreview,
): boolean {
  if (data.snapshotId === undefined && data.catalogueIdentity === undefined)
    return true;
  if (!data.snapshotId || !data.catalogueIdentity) return false;
  return parsed.identity.kind === "snapshot"
    ? parsed.identity.snapshotId === data.snapshotId
    : historicalSnapshotId(
        data.catalogueIdentity,
        parsed.identity.baseCommit,
        data,
      ) === data.snapshotId;
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
  const base = request.generation.href;
  const parsed =
    data.kind === "screen"
      ? screenContent(data, payload, base)
      : pageContent(data, payload, base);
  if (!snapshotMatches(data, parsed)) unavailable();
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
