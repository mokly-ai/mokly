/** Resolve and fetch one removed entry's previous version. */

import { encodeUrlPath } from "@mokly/model";
import type { ColorScheme, EntryDetailV4, Viewport } from "@mokly/model";

import { removedEntryDetailPath } from "../catalogue/delivery_paths.js";
import { historicalSnapshotId } from "../catalogue/snapshot_identity.js";
import {
  DeploymentChangedError,
  fetchJson,
  type DeploymentCheck,
} from "../catalogue/sources.js";
import { previewMetadataPath } from "../navigation/routes.js";
import type { RemovedPreviewData } from "../shell/previews.js";

import { pageContent, screenContent } from "./content.js";

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
  /** Route detail or preview metadata address used for live renewal. */
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
  deploymentCheck?: DeploymentCheck;
}

/**
 * The address to request, or `undefined` when the delivery advertises nothing
 * for this entry. Static delivery loads only advertised addresses, so an older
 * catalogue without the descriptor reports unavailable without any request.
 */
export function previewEndpoint(
  data: RemovedPreviewData,
  delivery: PreviewDelivery,
  base: string,
): PreviewRequest | undefined {
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

function unavailable(): never {
  throw new Error("The previous version is unavailable.");
}

/**
 * Whether a page descriptor's base commit derives the selected snapshot id, so
 * a late response or Retry cannot replace an open historical record after the
 * baseline changes.
 */
function baseMatches(data: RemovedPreviewData, baseCommit: string): boolean {
  if (data.snapshotId === undefined && data.catalogueIdentity === undefined)
    return true;
  if (!data.snapshotId || !data.catalogueIdentity) return false;
  return (
    historicalSnapshotId(data.catalogueIdentity, baseCommit, data) ===
    data.snapshotId
  );
}

/**
 * Request one preview. A removed screen reads the route's held detail, which
 * the route's fences accepted; a page or document reads its metadata, which
 * must derive the selected snapshot.
 */
export async function requestPreview(
  data: RemovedPreviewData,
  request: PreviewRequest,
  environment: PreviewRequestEnvironment,
  signal: AbortSignal,
  detail?: EntryDetailV4,
): Promise<LoadedPreview> {
  if (
    environment.deploymentCheck &&
    !(await environment.deploymentCheck(signal))
  )
    throw new DeploymentChangedError();
  const base = request.generation.href;
  return {
    content:
      data.kind === "screen"
        ? screenContent(data, detail, base)
        : await pageRequest(data, request, environment, signal),
    generation: new URL(".", base).href,
    url: request.endpoint.href,
  };
}

async function pageRequest(
  data: RemovedPreviewData,
  request: PreviewRequest,
  environment: PreviewRequestEnvironment,
  signal: AbortSignal,
): Promise<PreviewContent> {
  const { value } = await fetchJson(request.endpoint, signal, (input, init) =>
    environment.fetch(input, init),
  );
  const parsed = pageContent(data, value, request.generation.href);
  if (!baseMatches(data, parsed.baseCommit)) unavailable();
  return parsed.content;
}

/**
 * Renew the loaded detail or metadata address before reusing its documents.
 * A failed renewal makes the shell reacquire before it loads another view.
 */
export async function renewPreview(
  loaded: LoadedPreview,
  environment: PreviewRequestEnvironment,
  signal: AbortSignal,
): Promise<boolean> {
  const renewal = await environment.fetch(loaded.url, {
    cache: "no-store",
    credentials: "omit",
    method: "HEAD",
    signal,
  });
  return renewal.ok && renewal.url === loaded.url;
}
