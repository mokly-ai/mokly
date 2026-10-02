/** Compose the delivered string materials and their original-source reference recipes. */
import { componentUsageSignals } from "../components/comparison_material.js";
import type {
  ComponentInlineMaterial,
  ComponentProjection,
} from "../components/comparison_projection.js";
import {
  materialRecipe,
  renderMaterialRecipe,
} from "../components/material_recipe.js";
import { documentWorkSync } from "../diagnostics/timings.js";

import { normalizeReviewPair, normalizeSingleDocument } from "./ignore.js";
import type { PageAnalysisPair } from "./page_pair.js";

export interface ProjectedReferences {
  before: readonly string[];
  after: readonly string[];
  actualBefore: readonly string[];
  actualAfter: readonly string[];
}

export function projectAnalyzedPair(
  pages: PageAnalysisPair,
  inline: ComponentInlineMaterial,
): { projected: ComponentProjection; references: ProjectedReferences } {
  return documentWorkSync("projectionMs", () => {
    const before = pages.beforeAnalysis;
    const after = pages.afterAnalysis;
    const pairs = new Map<string, string>();
    if (before.usage && after.usage) {
      const current = new Map(
        after.usage.instances.map((instance) => [instance.key, instance]),
      );
      for (const instance of before.usage.instances)
        if (current.get(instance.key)?.componentId === instance.componentId)
          pairs.set(instance.key, instance.componentId);
    }
    const actualBefore = materialRecipe(before.source, inline.before.actual);
    const actualAfter = materialRecipe(after.source, inline.after.actual);
    const projectedBefore = materialRecipe(
      before.source,
      inline.before.projected,
      before.usage,
      before.ranges,
      before.usage && after.usage ? pairs : undefined,
    );
    const projectedAfter = materialRecipe(
      after.source,
      inline.after.projected,
      after.usage,
      after.ranges,
      before.usage && after.usage ? pairs : undefined,
    );
    const left = renderMaterialRecipe(before.source, actualBefore);
    const right = renderMaterialRecipe(after.source, actualAfter);
    const actual = normalizeReviewPair(left, right, after.route);
    const projected = normalizeReviewPair(
      renderMaterialRecipe(before.source, projectedBefore),
      renderMaterialRecipe(after.source, projectedAfter),
      after.route,
    );
    const paired = pages.pairedIgnoreIds;
    return {
      projected: {
        actual,
        before: projected.base,
        after: projected.head,
        ...componentUsageSignals(before.usage, after.usage),
        rawEqual:
          normalizeSingleDocument(left, after.route) ===
          normalizeSingleDocument(right, after.route),
        ignoredIds: projected.ignoredIds,
        pairedComponentIds: new Set(pairs.values()),
      },
      references: {
        before: before.materialReferences(projectedBefore, paired),
        after: after.materialReferences(projectedAfter, paired),
        actualBefore: before.materialReferences(actualBefore, paired),
        actualAfter: after.materialReferences(actualAfter, paired),
      },
    };
  });
}
