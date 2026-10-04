/** Preserve text materials when any delivered recipe can create the reserved prefix. */
import type { ComponentInlineMaterial } from "../components/comparison_projection.js";
import type { MaterialRecipe } from "../components/material_recipe.js";
import { documentWorkSync } from "../diagnostics/timings.js";

import { fingerprintAtSeam } from "./fingerprint_seams.js";
import {
  normalizationIdentity,
  normalizationPieces,
  normalizedRecipe,
} from "./material_normalization_recipe.js";
import type { PageAnalysis } from "./page_analysis.js";
import { pageMaterialRecipes } from "./page_material_recipes.js";
import type { PageAnalysisPair } from "./page_pair.js";
import { StyleSeamOffsets } from "./style_seam_offsets.js";

export function hasFingerprintSeam(
  pages: PageAnalysisPair,
  inline: ComponentInlineMaterial,
  skipped = false,
): boolean {
  return documentWorkSync("normalizationMs", () =>
    inspectRecipes(pages, inline, skipped),
  );
}

function inspectRecipes(
  pages: PageAnalysisPair,
  inline: ComponentInlineMaterial,
  skipped: boolean,
): boolean {
  const recipes = pageMaterialRecipes(pages, inline);
  const styleOffsets = new Map<PageAnalysis, StyleSeamOffsets>();
  // Inserts are complete tokens/wrappers; skipped materials have no style appendix.
  const inspect = (page: PageAnalysis, recipe: MaterialRecipe) => {
    if (skipped && !styleOffsets.has(page))
      styleOffsets.set(
        page,
        new StyleSeamOffsets(
          page.source,
          page.inlineStyles(pages.pairedIgnoreIds).map(({ source }) => source),
        ),
      );
    return fingerprintAtSeam(
      page.source,
      recipe,
      page.markerOffsets,
      styleOffsets.get(page),
    );
  };
  for (const kind of ["actual", "projected"] as const) {
    const base = normalizationPieces(
      pages.beforeAnalysis,
      recipes.before[kind],
    );
    const head = normalizationPieces(pages.afterAnalysis, recipes.after[kind]);
    if (!base || !head) return true;
    for (const [page, pieces] of [
      [pages.beforeAnalysis, base],
      [pages.afterAnalysis, head],
    ] as const) {
      if (inspect(page, pieces)) return true;
      if (kind === "actual" && inspect(page, normalizedRecipe(pieces)))
        return true;
    }
    const before = normalizationIdentity(base);
    const after = normalizationIdentity(head);
    // Unprovable derived marker structure must retain the delivered validation/error.
    if (!before || !after) return true;
    const signals = new Set([...before.signals, ...after.signals]);
    const oneSided = new Set(
      [...signals].filter(
        (id) => before.signals.has(id) !== after.signals.has(id),
      ),
    );
    const paired = new Set(
      [...before.regions].filter(
        (id) => after.regions.has(id) && !oneSided.has(id),
      ),
    );
    const baseOnly = [...before.regions]
      .filter((id) => !after.regions.has(id))
      .sort();
    const headOnly = [...after.regions]
      .filter((id) => !before.regions.has(id))
      .sort();
    if (
      inspect(
        pages.beforeAnalysis,
        normalizedRecipe(
          base,
          paired,
          oneSided,
          headOnly.length ? baseOnly : [],
        ),
      ) ||
      inspect(
        pages.afterAnalysis,
        normalizedRecipe(
          head,
          paired,
          oneSided,
          baseOnly.length ? headOnly : [],
        ),
      )
    )
      return true;
  }
  return false;
}
