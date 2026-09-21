/** Comparison metadata requests shared by the hydrated shell controller. */

import { parseReviewResult } from "../review/result_validation.js";
import type { ReviewResult } from "../review/types.js";

import type {
  ComparisonDelivery,
  ComparisonEnvironment,
} from "./comparison_context.js";

/** One validated result and the immutable URL that owns its snapshots. */
export interface LoadedComparison {
  result: ReviewResult;
  url: string;
}

/** Route and optional saved variant selected for comparison generation. */
export interface ComparisonScope {
  route: string;
  variantId?: string;
}

/** Request current metadata, scoped only for live on-demand generation. */
export async function requestComparison(
  environment: ComparisonEnvironment,
  scope: ComparisonScope,
  refresh: boolean,
  signal: AbortSignal,
): Promise<LoadedComparison> {
  const baseUrl = comparisonBaseUrl(environment.baseUrl);
  const delivery = environment.delivery();
  const endpoint = comparisonEndpoint(baseUrl, delivery, scope, refresh);
  const response = await environment.fetch(endpoint, {
    signal,
    credentials: delivery.kind === "pinned" ? "omit" : "same-origin",
    headers: { accept: "application/json" },
  });
  validateResponse(baseUrl, delivery, endpoint, response.url);
  if (!response.ok) throw new Error(await failureDetails(response));
  return {
    result: parseReviewResult(await response.json()),
    url: response.url,
  };
}

/** Renew a live generation before changing panes; pinned generations persist. */
export async function renewComparison(
  environment: ComparisonEnvironment,
  loaded: LoadedComparison,
  scope: ComparisonScope,
  signal: AbortSignal,
): Promise<LoadedComparison> {
  const baseUrl = comparisonBaseUrl(environment.baseUrl);
  const delivery = environment.delivery();
  if (delivery.kind === "pinned") {
    const expected = comparisonEndpoint(baseUrl, delivery, scope, false);
    const current = safeUrl(loaded.url);
    if (
      !current ||
      current.origin !== expected.origin ||
      current.pathname !== expected.pathname
    )
      throw new Error("The comparison is unavailable.");
    return loaded;
  }
  const current = safeUrl(loaded.url);
  if (!current || !isLiveGeneration(baseUrl, current))
    throw new Error("The comparison is unavailable.");
  const response = await environment.fetch(current, {
    method: "HEAD",
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  const renewed = safeUrl(response.url);
  if (!renewed || !isLiveGeneration(baseUrl, renewed))
    throw new Error("The comparison is unavailable.");
  if (response.ok && renewed.href === current.href) return loaded;
  return requestComparison(environment, scope, false, signal);
}

function comparisonEndpoint(
  baseUrl: URL,
  delivery: ComparisonDelivery,
  scope: ComparisonScope,
  refresh: boolean,
): URL {
  if (delivery.kind === "pinned" && delivery.comparisonUrl === null)
    throw new Error("Comparisons are unavailable in this catalogue.");
  const endpoint = new URL(
    delivery.kind === "live"
      ? "/__mokly/diffs/review.json"
      : `/${delivery.comparisonUrl}`.replace(/^\/\//, "/"),
    baseUrl,
  );
  if (!sameOrigin(baseUrl, endpoint))
    throw new Error("The comparison is unavailable.");
  if (delivery.kind === "live") {
    endpoint.searchParams.set("route", scope.route);
    if (scope.variantId) endpoint.searchParams.set("variant", scope.variantId);
  }
  if (refresh) endpoint.searchParams.set("refresh", "1");
  return endpoint;
}

function validateResponse(
  baseUrl: URL,
  delivery: ComparisonDelivery,
  endpoint: URL,
  responseUrl: string,
): void {
  const response = safeUrl(responseUrl);
  if (!response || !sameOrigin(baseUrl, response))
    throw new Error("The comparison is unavailable.");
  if (delivery.kind === "pinned") {
    if (
      response.pathname !== endpoint.pathname ||
      response.search !== endpoint.search
    )
      throw new Error("The comparison is unavailable.");
  } else if (
    response.pathname !== "/__mokly/diffs/review.json" &&
    !isLiveGeneration(baseUrl, response)
  )
    throw new Error("The comparison is unavailable.");
}

function comparisonBaseUrl(value: string | URL): URL {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("The comparison is unavailable.");
  return new URL("/", url);
}

function isLiveGeneration(baseUrl: URL, value: URL): boolean {
  return (
    sameOrigin(baseUrl, value) &&
    /^\/__mokly\/diffs\/(?:__generations\/[^/]+\/)?review\.json$/.test(
      value.pathname,
    ) &&
    !value.username &&
    !value.password
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

async function failureDetails(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === "object" &&
      "details" in body &&
      typeof body.details === "string"
    )
      return body.details;
  } catch {
    return "Comparison unavailable";
  }
  return "Comparison unavailable";
}
