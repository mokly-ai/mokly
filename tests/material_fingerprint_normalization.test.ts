import assert from "node:assert/strict";
import test from "node:test";

import { stripComponentMarkers } from "../dist/components/comparison_material.js";
import type { MaterialRecipe } from "../dist/components/material_recipe.js";
import { normalizeSingleDocument } from "../dist/review/ignore.js";
import {
  normalizationPieces,
  normalizedRecipe,
} from "../dist/review/material_normalization_recipe.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";

const render = (source: string, recipe: MaterialRecipe) =>
  recipe
    .map((piece) =>
      piece.kind === "source"
        ? source.slice(piece.start, piece.end)
        : piece.text,
    )
    .join("");

test("normalization recipes preserve delivered single-document rewrites", () => {
  const region =
    "<!--mokly-review-ignore:start:clock-->value<!--mokly-review-ignore:end:clock-->";
  const signal = `<!--mokly-review-material:clock:${"a".repeat(64)}-->`;
  for (const source of [
    "<main>plain</main>",
    region,
    signal + region,
    "<textarea>mokly-in<!--mokly-component:start:r-99-->line-</textarea>",
    signal + `<main>${region}</main>`,
  ]) {
    const page = new PageAnalysis(source, "test");
    const recipe = [{ kind: "source", start: 0, end: source.length }] as const;
    const pieces = normalizationPieces(page, recipe)!;
    const stripped = stripComponentMarkers(source);
    assert.equal(render(source, pieces), stripped);
    assert.equal(
      render(source, normalizedRecipe(pieces)),
      normalizeSingleDocument(stripped, "test"),
    );
  }
});
