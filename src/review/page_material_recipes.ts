/** The shared original-coordinate recipes used by rendering and fingerprint admission. */
import type { ComponentInlineMaterial } from "../components/comparison_projection.js";
import { materialRecipe } from "../components/material_recipe.js";

import { withInlineReplacements } from "./css/inline_rendering.js";
import type { PageAnalysisPair } from "./page_pair.js";

export function pageMaterialRecipes(
  pages: PageAnalysisPair,
  inline: ComponentInlineMaterial,
) {
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
  const side = (which: "before" | "after") => {
    const page = which === "before" ? before : after;
    const includeLinks = (material: typeof inline.before.actual) =>
      withInlineReplacements(material, [
        ...material.replacements,
        ...page.stylesheetEdits(pages.root),
      ]);
    return {
      actual: materialRecipe(page.source, includeLinks(inline[which].actual)),
      projected: materialRecipe(
        page.source,
        includeLinks(inline[which].projected),
        page.usage,
        page.ranges,
        before.usage && after.usage ? pairs : undefined,
      ),
    };
  };
  return { before: side("before"), after: side("after"), pairs };
}
