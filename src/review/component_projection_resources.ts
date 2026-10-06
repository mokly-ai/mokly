/** Shared ownership-projected resource policy for fast and complete comparisons. */

import {
  canonicalJson,
  isStylesheetPath,
  type GeneratedComponentView,
} from "@mokly/viewer/data";

import { stripMarkers } from "../components/comparison_material.js";
import {
  projectComponentPair,
  type ComponentProjection,
} from "../components/comparison_projection.js";
import { comparisonStylesheetMaterial } from "../components/comparison_stylesheets.js";
import {
  validateComponentRanges,
  type RenderedRange,
} from "../components/ranges.js";

import type { ReviewLinkNormalization } from "./ignore.js";
import { normalizeSingleDocument, normalizeReviewPair } from "./ignore.js";

/** Projection material prepared once and shared by fast and complete comparison. */
export interface PreparedComponentComparison {
  baseRanges?: readonly RenderedRange[];
  headRanges?: readonly RenderedRange[];
  projected: ComponentProjection;
  excluded: (path: string) => boolean;
}

/** Validate ranges, project ownership, and bind the matching resource policy. */
export function prepareComponentProjection(
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  base: string,
  head: string,
  root?: string,
  links?: ReviewLinkNormalization,
): PreparedComponentComparison {
  const baseRanges = before.usage
    ? validateComponentRanges(base, before.usage.ranges)
    : undefined;
  const headRanges = after.usage
    ? validateComponentRanges(head, after.usage.ranges)
    : undefined;
  const baseMaterial = comparisonStylesheetMaterial(base, before.usage, root);
  const headMaterial = comparisonStylesheetMaterial(head, after.usage, root);
  const projected = projectComponentPair(
    baseMaterial.html,
    headMaterial.html,
    baseMaterial.usage,
    headMaterial.usage,
    after.path,
    root,
    baseMaterial.html === base ? baseRanges : undefined,
    headMaterial.html === head ? headRanges : undefined,
    links,
  );
  return {
    ...(baseRanges ? { baseRanges } : {}),
    ...(headRanges ? { headRanges } : {}),
    projected,
    excluded: projectedResourceExclusion(
      before,
      after,
      projected.pairedComponentIds,
      root,
    ),
  };
}

/** Build the exact projected-resource exclusion used by complete comparison. */
function projectedResourceExclusion(
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  pairedComponentIds: ReadonlySet<string>,
  root: string | undefined,
): (path: string) => boolean {
  return (path: string) =>
    suppressOwnedResource(path, pairedComponentIds, before, after, root);
}

function suppressOwnedResource(
  path: string,
  paired: ReadonlySet<string>,
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  root?: string,
): boolean {
  if (isStylesheetPath(path)) return false;
  if (!before.usage || !after.usage) return false;
  const left = before.usage.resources.find((item) => item.path === path);
  const right = after.usage.resources.find((item) => item.path === path);
  return Boolean(
    left &&
    right &&
    canonicalJson(left.componentIds) === canonicalJson(right.componentIds) &&
    left.componentIds.every((id) => id !== root && paired.has(id)),
  );
}

/** Normalize one-sided resource material after validating original ranges. */
export function normalizeOneSidedView(
  html: string,
  view: GeneratedComponentView,
): string {
  const ranges = view.usage
    ? validateComponentRanges(html, view.usage.ranges)
    : undefined;
  const original = stripMarkers(html, view.usage, ranges);
  return normalizeSingleDocument(original, view.path);
}

/** Compare page material while keeping only the saved root's inserted stylesheet links. */
export function componentPageMaterial(
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  base: string,
  head: string,
  prepared: PreparedComponentComparison,
  root?: string,
  links?: ReviewLinkNormalization,
): ReturnType<typeof normalizeReviewPair> {
  const baseMaterial = comparisonStylesheetMaterial(base, before.usage, root);
  const headMaterial = comparisonStylesheetMaterial(head, after.usage, root);
  return normalizeReviewPair(
    stripMarkers(
      baseMaterial.html,
      baseMaterial.usage,
      baseMaterial.html === base ? prepared.baseRanges : undefined,
    ),
    stripMarkers(
      headMaterial.html,
      headMaterial.usage,
      headMaterial.html === head ? prepared.headRanges : undefined,
    ),
    after.path,
    links,
  );
}
