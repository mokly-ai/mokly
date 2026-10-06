import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import {
  accessibleName,
  named,
  namedRole,
} from "./helpers/design_assertions.js";
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

test("named role checks include references and wrapping labels", () => {
  const document =
    parse(`<span id="group-name">Comparison mode</span><div role="group" aria-labelledby="group-name"></div>
    <nav aria-label="Related design pages"></nav>
    <label class="mbk-cmp-sync">Scroll together<input role="switch" type="checkbox"></label>`);
  assert.equal(namedRole(document, "group", "Comparison mode").length, 1);
  assert.equal(
    namedRole(document, "navigation", "Related design pages").length,
    1,
  );
  assert.equal(namedRole(document, "switch", "Scroll together").length, 1);
});

test("named roles can match case-insensitive substrings without weakening exact names", () => {
  const document = parse(
    '<div role="group" aria-label="Selected COMPARISON MODE options"></div><div role="group" aria-label="Other group"></div>',
  );
  assert.equal(namedRole(document, "group", /comparison mode/giu).length, 1);
  assert.equal(namedRole(document, "group", "Comparison mode").length, 0);
});

test("fieldset groups take their name from the direct legend", () => {
  const document = parse(
    '<fieldset title="Fallback"><legend>Preview color scheme options</legend><input></fieldset>',
  );
  assert.equal(
    namedRole(document, "group", /preview color scheme/iu).length,
    1,
  );
  assert.equal(namedRole(document, "group", "Fallback").length, 0);
});

test("titles name otherwise unnamed controls and groups", () => {
  const document = parse(
    '<nav title="Other related DESIGN PAGES"></nav><div role="group" title="Comparison mode"><span>Unrelated content</span></div><button title="Hint">Own name</button><input aria-label="Explicit" title="Fallback">',
  );
  assert.equal(
    namedRole(document, "navigation", /related design pages/iu).length,
    1,
  );
  assert.equal(namedRole(document, "group", /comparison mode/iu).length, 1);
  assert.equal(named(document, "Own name", "button").tagName, "button");
  assert.equal(named(document, "Explicit", "input").tagName, "input");
});
