/** Comparison generation requests shared by the shell's comparison controller. */

import { VIEWER_DIRECTORY } from "../catalogue/delivery_paths.js";
import { DeploymentChangedError } from "../viewer/sources.js";

import type {
  ComparisonDelivery,
  ComparisonEnvironment,
} from "./comparison_context.js";

/** The immutable generation root that owns a comparison's snapshots. */
export interface LoadedComparison {
  /** The absolute URL of the generation root, ending with `/`. */
  url: string;
}

/** Entry identity selected for comparison generation. */
export interface ComparisonScope {
  id: string;
  /** Removed entries use the advertised classification in every host. */
  comparisonUrl?: string | null;
}

/** The viewer-owned details for every failed comparison. */
export const COMPARISON_UNAVAILABLE = "The comparison is unavailable.";

const SELECTION = `/${VIEWER_DIRECTORY}/diffs/selection`;

/**
 * Establish the generation of one comparison. A pinned catalogue resolves its
 * advertised root without a request; Serve redirects a selection, or confirms
 * an advertised root, before any pane document loads.
 */
export async function requestComparison(
  environment: ComparisonEnvironment,
  scope: ComparisonScope,
  refresh: boolean,
  signal: AbortSignal,
): Promise<LoadedComparison> {
  if (
    environment.deploymentCheck &&
    !(await environment.deploymentCheck(signal))
  )
    throw new DeploymentChangedError();
  const baseUrl = comparisonBaseUrl(environment.baseUrl);
  const delivery = environment.delivery();
  const advertised = advertisedRoot(baseUrl, delivery, scope);
  if (advertised && delivery.kind === "pinned") return { url: advertised.href };
  const endpoint = advertised ?? new URL(SELECTION, baseUrl);
  if (!advertised) {
    endpoint.searchParams.set("path", scope.id);
    if (refresh) endpoint.searchParams.set("refresh", "1");
  }
  const response = await environment.fetch(endpoint, {
    signal,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(COMPARISON_UNAVAILABLE);
  // Read the root's empty body, or the browser aborts the finished request.
  await response.arrayBuffer();
  const root = safeUrl(response.url);
  if (
    !root ||
    !isLiveGeneration(baseUrl, root) ||
    (advertised !== undefined && root.href !== advertised.href)
  )
    throw new Error(COMPARISON_UNAVAILABLE);
  return { url: root.href };
}

/** Renew a live generation before changing panes; pinned generations persist. */
export async function renewComparison(
  environment: ComparisonEnvironment,
  loaded: LoadedComparison,
  scope: ComparisonScope,
  signal: AbortSignal,
): Promise<LoadedComparison> {
  if (
    environment.deploymentCheck &&
    !(await environment.deploymentCheck(signal))
  )
    throw new DeploymentChangedError();
  const baseUrl = comparisonBaseUrl(environment.baseUrl);
  const delivery = environment.delivery();
  const current = safeUrl(loaded.url);
  const advertised = advertisedRoot(baseUrl, delivery, scope);
  if (delivery.kind === "pinned") {
    if (!current || current.href !== advertised?.href)
      throw new Error(COMPARISON_UNAVAILABLE);
    return loaded;
  }
  if (
    !current ||
    !isLiveGeneration(baseUrl, current) ||
    (advertised !== undefined && current.href !== advertised.href)
  )
    throw new Error(COMPARISON_UNAVAILABLE);
  const response = await environment.fetch(current, {
    method: "HEAD",
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  const renewed = safeUrl(response.url);
  if (!renewed || !isLiveGeneration(baseUrl, renewed))
    throw new Error(COMPARISON_UNAVAILABLE);
  if (response.ok && renewed.href === current.href) return loaded;
  return requestComparison(environment, scope, false, signal);
}

/**
 * The generation root that the catalogue advertises for this scope: a removed
 * entry's classification in every host, or a pinned catalogue's comparison.
 * `undefined` asks Serve for a selection.
 */
function advertisedRoot(
  baseUrl: URL,
  delivery: ComparisonDelivery,
  scope: ComparisonScope,
): URL | undefined {
  const advertised =
    scope.comparisonUrl !== undefined
      ? scope.comparisonUrl
      : delivery.kind === "pinned"
        ? delivery.comparisonUrl
        : undefined;
  if (advertised === null) throw new Error(COMPARISON_UNAVAILABLE);
  if (advertised === undefined) return undefined;
  const root = new URL(`/${advertised}`.replace(/^\/\//, "/"), baseUrl);
  if (!sameOrigin(baseUrl, root) || !root.pathname.endsWith("/"))
    throw new Error(COMPARISON_UNAVAILABLE);
  return root;
}

function comparisonBaseUrl(value: string | URL): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(COMPARISON_UNAVAILABLE);
  return new URL("/", url);
}

function isLiveGeneration(baseUrl: URL, value: URL): boolean {
  return (
    sameOrigin(baseUrl, value) &&
    new RegExp(
      `^\\/${VIEWER_DIRECTORY}\\/diffs\\/generations\\/[^/]+\\/$`,
    ).test(value.pathname) &&
    !value.search &&
    !value.hash
  );
}

function sameOrigin(baseUrl: URL, value: URL): boolean {
  return value.origin === baseUrl.origin && !value.username && !value.password;
}

function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return;
  }
}
