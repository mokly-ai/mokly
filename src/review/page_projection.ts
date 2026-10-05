/** Compose the delivered string materials and their original-source reference recipes. */
import { componentUsageSignals } from "../components/comparison_material.js";
import type {
  ComponentInlineMaterial,
  ComponentProjection,
} from "../components/comparison_projection.js";
import { renderMaterialRecipe } from "../components/material_recipe.js";
import {
  documentMaterialWork,
  timingMaterialWork,
} from "../diagnostics/material_timings.js";
import { documentWorkSync } from "../diagnostics/timings.js";

import { normalizeSingleDocument } from "./ignore.js";
import { pageMaterialRecipes } from "./page_material_recipes.js";
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
  return documentWorkSync("projectionMs", () =>
    documentMaterialWork(() => {
      const before = pages.beforeAnalysis;
      const after = pages.afterAnalysis;
      const recipes = pageMaterialRecipes(pages, inline);
      const { pairs } = recipes;
      const { actual: actualBefore, projected: projectedBefore } =
        recipes.before;
      const { actual: actualAfter, projected: projectedAfter } = recipes.after;
      const left = renderMaterialRecipe(before.source, actualBefore);
      const right = renderMaterialRecipe(after.source, actualAfter);
      const projectedLeft = renderMaterialRecipe(
        before.source,
        projectedBefore,
      );
      const projectedRight = renderMaterialRecipe(after.source, projectedAfter);
      timingMaterialWork()?.materials([
        left,
        right,
        projectedLeft,
        projectedRight,
      ]);
      const actual = pages.normalize(left, right);
      const projected = pages.normalize(projectedLeft, projectedRight);
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
    }),
  );
}
