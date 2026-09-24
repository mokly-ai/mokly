/** Shared ownership-projected resource policy for fast and complete comparisons. */

import { canonicalJson, type GeneratedComponentView } from "@mokly/viewer/data";

import {
  projectComponentPair,
  type ComponentProjection,
} from "../components/comparison_projection.js";
import {
  validateComponentRanges,
  type RenderedRange,
} from "../components/ranges.js";

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
): PreparedComponentComparison {
  const baseRanges = before.usage
    ? validateComponentRanges(base, before.usage.ranges, "historical")
    : undefined;
  const headRanges = after.usage
    ? validateComponentRanges(head, after.usage.ranges)
    : undefined;
  const projected = projectComponentPair(
    base,
    head,
    before.usage,
    after.usage,
    after.path,
    root,
    baseRanges,
    headRanges,
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
export function projectedResourceExclusion(
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
