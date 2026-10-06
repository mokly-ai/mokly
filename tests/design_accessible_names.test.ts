import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { accessibleName, named } from "./helpers/design_assertions.js";
import { elements } from "./helpers/design_catalogue.js";

test("mockup control names use labels, references, and explicit names", () => {
  const document =
    parse(`<label for="hint">hint <span aria-hidden="true">Optional</span></label>
    <input id="hint"><label>Set hint<input type="checkbox"></label>
    <span id="name">Dark preview</span><input role="switch" aria-labelledby="name">
    <input role="switch" aria-label="Appearance">`);
  const controls = elements(document, (node) => node.tagName === "input");
  assert.deepEqual(
    controls.map((node) => accessibleName(node, document)),
    ["hint", "Set hint", "Dark preview", "Appearance"],
  );
  assert.equal(named(document, "hint", "input"), controls[0]);
  assert.equal(named(document, /dark preview/giu, "input"), controls[2]);
});
