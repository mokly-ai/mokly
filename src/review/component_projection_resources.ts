/** Shared ownership-projected resource policy for fast and complete comparisons. */

import type { GeneratedComponentView } from "@mokly/viewer/data";

import {
  projectComponentPair,
  type ComponentProjection,
} from "../components/comparison_projection.js";
import {
  validateComponentRanges,
  type RenderedRange,
} from "../components/ranges.js";

import type { ComponentViewContext } from "./component_view.js";

/** Projection material prepared once and shared by fast and complete comparison. */
export interface PreparedComponentComparison {
  baseRanges?: readonly RenderedRange[];
  headRanges?: readonly RenderedRange[];
  projected: ComponentProjection;
  excluded: (path: string) => boolean;
}

/** Validate ranges, project ownership, and bind the matching resource policy. */
export function prepareComponentProjection(
  context: ComponentViewContext,
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
      context,
      before,
      after,
      projected.pairedComponentIds,
      root,
    ),
  };
}

/** Build the exact projected-resource exclusion used by complete comparison. */
export function projectedResourceExclusion(
  context: ComponentViewContext,
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  pairedComponentIds: ReadonlySet<string>,
  root: string | undefined,
): (path: string) => boolean {
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  return (path: string) =>
    context.dependencies.suppressResource(
      repoPath(path),
      path,
      pairedComponentIds,
      before.usage,
      after.usage,
      root,
    );
}
