import assert from "node:assert/strict";
import test from "node:test";

import type { MaterialRecipe } from "../dist/components/material_recipe.js";
import { fingerprintAtSeam } from "../dist/review/fingerprint_seams.js";
import { MaterialMarkerOffsets } from "../dist/review/material_marker_offsets.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import { StyleSeamOffsets } from "../dist/review/style_seam_offsets.js";

const inspect = (source: string, recipe: MaterialRecipe, style: string) =>
  fingerprintAtSeam(
    source,
    recipe,
    new MaterialMarkerOffsets(source),
    new StyleSeamOffsets(source, [style]),
  );

test("every seam inside a skipped outer source is unsafe, including closing-tag attributes", () => {
  for (const style of [
    "<style>.entry{color:red}</style>",
    '<style>.entry{color:red}</style data-long="ordinary">',
    "<STYLE>.entry{color:red}</STYLE>",
  ])
    for (let cut = 1; cut < style.length; cut++) {
      const source = style.slice(0, cut) + "|" + style.slice(cut);
      assert.equal(
        inspect(
          source,
          [
            { kind: "source", start: 0, end: cut },
            { kind: "source", start: cut + 1, end: source.length },
          ],
          style,
        ),
        true,
        `${style}/${cut}`,
      );
    }
});

test("indexed style positions distinguish interior joins from whole original styles", () => {
  for (const size of [32, 1024 * 1024]) {
    const source = `<style>${"x".repeat(size)}|${"y".repeat(size)}</style>`;
    const cut = source.indexOf("|");
    const style = source.replace("|", "");
    assert.equal(
      inspect(
        source,
        [
          { kind: "source", start: 0, end: cut },
          { kind: "source", start: cut + 1, end: source.length },
        ],
        style,
      ),
      true,
    );
    assert.equal(
      inspect(
        source,
        [
          { kind: "source", start: 0, end: cut },
          { kind: "source", start: cut, end: source.length },
        ],
        style,
      ),
      false,
      "adjacent pieces remain a single original occurrence",
    );
    assert.equal(
      inspect(
        source,
        [
          { kind: "source", start: 0, end: source.length },
          {
            kind: "insert",
            text: "<!--mokly-owned:action:k1-->",
            references: [],
          },
        ],
        style,
      ),
      false,
      "complete styles before component seams are safe",
    );
  }
});

test("complete inserted wrappers can supply a skipped source's ending bytes", () => {
  const wrapper = '<mokly-caller-slot data-key="k1" data-rendered="true">';
  const style = `<style>.entry{color:red}</style data-copy=${wrapper}`;
  assert.equal(
    new PageAnalysis(style, "test").inlineStyles([])[0]?.source,
    style,
  );
  const source = style.slice(0, -wrapper.length);
  assert.equal(
    inspect(
      source,
      [
        { kind: "source", start: 0, end: source.length },
        { kind: "insert", text: wrapper, references: [] },
      ],
      style,
    ),
    true,
  );
});
