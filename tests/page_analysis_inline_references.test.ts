import assert from "node:assert/strict";
import test from "node:test";

import { extractHtmlReferences } from "../dist/html_references.js";
import { attributeInlineRules } from "../src/review/css/inline_attribution.js";
import {
  inlineMaterialReferences,
  inlineMaterialReplacements,
} from "../src/review/css/inline_rendering.js";

import { html, inlineInput } from "./helpers/inline_styles.js";

test("canonical appendices keep their delivered shape and seed stored references, including string imports", () => {
  const styles =
    '<style>@import "theme.css";@supports (background:url("condition.svg")){.a{background:url("a.svg")}}.a{background:url("b.svg")}</style>';
  const input = inlineInput({
    before: html(styles, '<main class="a"></main>'),
    after: html(styles.replace("b.svg", "c.svg"), '<main class="a"></main>'),
  });
  const analysis = attributeInlineRules(input);
  assert.equal(analysis.status, "resolved");
  for (const side of ["before", "after"] as const)
    for (const material of Object.values(
      inlineMaterialReplacements(analysis, side),
    )) {
      assert.deepEqual(Object.keys(material).sort(), [
        "appendix",
        "replacements",
      ]);
      assert.deepEqual(
        new Set(inlineMaterialReferences(material)),
        new Set(extractHtmlReferences(material.appendix).resources),
      );
      assert.ok(inlineMaterialReferences(material).includes("theme.css"));
    }
});
