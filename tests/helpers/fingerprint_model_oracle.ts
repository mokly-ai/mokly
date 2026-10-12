import assert from "node:assert/strict";

import type { ComponentInlineMaterial } from "../../dist/components/comparison_projection.js";
import type { MaterialRecipe } from "../../dist/components/material_recipe.js";
import { renderMaterialRecipe } from "../../dist/components/material_recipe.js";
import {
  normalizeReviewPair,
  normalizeSingleDocument,
} from "../../dist/review/ignore.js";
import {
  normalizationIdentity,
  normalizationPieces,
  normalizedRecipe,
} from "../../dist/review/material_normalization_recipe.js";
import { pageMaterialRecipes } from "../../dist/review/page_material_recipes.js";
import type { PageAnalysisPair } from "../../dist/review/page_pair.js";

function material(source: string, recipe: MaterialRecipe) {
  return recipe
    .map((piece) =>
      piece.kind === "source"
        ? source.slice(piece.start, piece.end)
        : piece.text,
    )
    .join("");
}

/** Deliberately materialize/scan every byte: independent of the bounded production algorithm. */
export function assertNoStructuralSeam(
  source: string,
  recipe: MaterialRecipe,
  label: string,
) {
  const pieces = recipe.filter((piece) =>
    piece.kind === "source" ? piece.end > piece.start : piece.text.length > 0,
  );
  const seams: number[] = [];
  let length = 0;
  for (let index = 0; index < pieces.length; index++) {
    const piece = pieces[index]!;
    const previous = pieces[index - 1];
    if (
      previous &&
      !(
        previous.kind === "source" &&
        piece.kind === "source" &&
        previous.end === piece.start
      )
    )
      seams.push(length);
    length +=
      piece.kind === "source" ? piece.end - piece.start : piece.text.length;
  }
  const text = material(source, pieces);
  for (const match of text.matchAll(/mokly-inline-|<!--mokly-/g))
    assert.ok(
      !seams.some(
        (seam) => match.index < seam && seam < match.index + match[0].length,
      ),
      `${label}: created prefix at ${match.index}`,
    );
  for (const match of text.matchAll(/<!--mokly-(?:review-|component:)/g)) {
    const close = text.indexOf("-->", match.index + match[0].length);
    assert.ok(
      !seams.some(
        (seam) => match.index < seam && (close === -1 || seam < close + 3),
      ),
      `${label}: completed opener at ${match.index}`,
    );
  }
}

export function assertGuardModel(
  pages: PageAnalysisPair,
  inline: ComponentInlineMaterial,
  label: string,
) {
  const recipes = pageMaterialRecipes(pages, inline);
  for (const kind of ["actual", "projected"] as const) {
    const base = normalizationPieces(
      pages.beforeAnalysis,
      recipes.before[kind],
    )!;
    const head = normalizationPieces(pages.afterAnalysis, recipes.after[kind])!;
    assert.ok(base && head, label);
    const before = normalizationIdentity(base)!;
    const after = normalizationIdentity(head)!;
    assert.ok(before && after, label);
    const oneSided = new Set(
      [...before.signals, ...after.signals].filter(
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
    const expectedBase = normalizedRecipe(
      base,
      paired,
      oneSided,
      headOnly.length ? baseOnly : [],
    );
    const expectedHead = normalizedRecipe(
      head,
      paired,
      oneSided,
      baseOnly.length ? headOnly : [],
    );
    const left = renderMaterialRecipe(pages.baseText, recipes.before[kind]);
    const right = renderMaterialRecipe(pages.headText, recipes.after[kind]);
    assert.equal(material(pages.baseText, base), left, label);
    assert.equal(material(pages.headText, head), right, label);
    assertNoStructuralSeam(pages.baseText, base, label);
    assertNoStructuralSeam(pages.headText, head, label);
    assertNoStructuralSeam(pages.baseText, expectedBase, label);
    assertNoStructuralSeam(pages.headText, expectedHead, label);
    const pair = normalizeReviewPair(left, right, "model");
    assert.equal(material(pages.baseText, expectedBase), pair.base, label);
    assert.equal(material(pages.headText, expectedHead), pair.head, label);
    if (kind === "actual")
      for (const [source, pieces, raw] of [
        [pages.baseText, base, left],
        [pages.headText, head, right],
      ] as const) {
        const single = normalizedRecipe(pieces);
        assertNoStructuralSeam(source, single, label);
        assert.equal(
          material(source, single),
          normalizeSingleDocument(raw, "model"),
          label,
        );
      }
  }
}
