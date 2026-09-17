import { encodeUrlPath } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import { safeDecodePath } from "./respond.js";
import type { ReviewGeneration } from "./review_generations.js";

export const DIFF_ROUTE = "/__mokly/diffs/";
export const GENERATION_ROUTE = `${DIFF_ROUTE}__generations/`;

export function generationPath(
  pathname: string,
): { readonly relative: string; readonly version: string } | undefined {
  const remainder = pathname.slice(GENERATION_ROUTE.length);
  const separator = remainder.indexOf("/");
  if (separator < 1) return undefined;
  const version = remainder.slice(0, separator);
  const relative = safeDecodePath(remainder.slice(separator + 1));
  return /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(version) && relative
    ? { relative, version }
    : undefined;
}

export function isReviewDocument(relative: string): boolean {
  return relative === "review.json";
}

export function isSnapshot(relative: string): boolean {
  return relative.startsWith("snapshots/");
}

export function generationUrl(
  generation: ReviewGeneration,
  relative: string,
): string {
  return `${GENERATION_ROUTE}${generation.version}/${encodeUrlPath(relative)}`;
}

export function reviewServerClosing(): MoklyError {
  return new MoklyError("server-failed", "Comparison server is closing");
}
