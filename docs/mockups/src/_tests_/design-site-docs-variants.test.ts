/**
 * The two variants of the documentation screen: Your first screen, whose
 * first code block is the HTML sample fence, and the mobile tree sheet.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { one, tags } from "./design-site-docs-helpers";
import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
  siteDocument,
  siteEntry,
  type Element,
} from "./design-site-test-helpers";

test("the documentation variants keep the shared landmarks in both schemes", () => {
  for (const id of [
    "design/site/docs/first-screen",
    "design/site/docs/layers",
  ]) {
    const entry = siteEntry(id);
    assert.equal(entry.kind, "screen", id);
    assert.equal(
      entry.kind === "screen" && entry.variantOf,
      "design/site/docs",
    );
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const) {
        const { document } = siteDocument(id, viewport, scheme);
        const at = `${id} ${viewport} ${scheme}`;
        assert.equal(tags(document, "h1").length, 1, at);
        assert.deepEqual(
          tags(document, "main").map((node) => attribute(node, "id")),
          ["main"],
          at,
        );
        assert.equal(tags(document, "a")[0], one(document, "site-skip"), at);
        assert.equal(byClass(document, "site-footer").length, 1, at);
        const docs = tags(one(document, "site-header"), "a").filter(
          (node) => attribute(node, "aria-current") === "page",
        );
        assert.deepEqual(docs.map(label), ["Docs"], at);
      }
  }
});

/** Each radio of a control: its value, whether it is chosen, and its name. */
function radios(control: Element) {
  return byClass(control, "site-docs-sample-option").map((option) => [
    attribute(tags(option, "input")[0]!, "value"),
    attribute(tags(option, "input")[0]!, "checked") !== undefined,
    label(option),
  ]);
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: Your first screen renders its HTML sample beside its code`, () => {
    const { document } = siteDocument(
      "design/site/docs/first-screen",
      viewport,
    );
    const sample = one(document, "site-docs-sample");
    const section = tags(one(document, "site-document-body"), "section")[0]!;
    assert.equal(attribute(tags(section, "h2")[0]!, "id"), "add-one-html-file");
    assert.equal(
      childElements(section).indexOf(sample),
      3,
      "after the first paragraph",
    );
    const head = one(sample, "site-docs-sample-head");
    assert.equal(attribute(head, "aria-hidden"), "true");
    assert.deepEqual(childElements(head).map(label), ["Welcome", "welcome"]);
    const code = one(sample, "site-code");
    assert.deepEqual(byClass(code, "site-code-tab").map(label), [
      "welcome.screen.html",
    ]);
    assert.equal(label(one(code, "site-code-language")), "html");
    const lines = byClass(code, "site-code-line");
    const marked = (kind: string) =>
      lines.flatMap((line, index) =>
        attribute(line, "class")?.split(" ").includes(kind) ? [index + 1] : [],
      );
    // The drawing shows Mobile and Welcome: the heading's line is wired, and
    // the desktop paragraph, which the mobile view leaves out, is dimmed.
    assert.deepEqual(marked("site-code-line--lit"), [12]);
    assert.deepEqual(marked("site-code-line--dim"), [15]);
    const controls = byClass(sample, "site-docs-sample-control");
    assert.deepEqual(
      controls.map((node) => [node.tagName, attribute(node, "aria-label")]),
      [
        ["fieldset", "Viewport"],
        ["fieldset", "Saved state"],
      ],
    );
    assert.deepEqual(controls.map(radios), [
      [
        ["mobile", true, "Mobile"],
        ["desktop", false, "Desktop"],
      ],
      [
        ["welcome", true, "Welcome"],
        ["first-visit", false, "First visit"],
      ],
    ]);
    const stage = one(sample, "site-docs-sample-stage");
    assert.equal(attribute(stage, "aria-hidden"), "true");
    assert.equal(
      elements(stage, (node) => ["a", "button", "input"].includes(node.tagName))
        .length,
      0,
    );
    assert.equal(label(one(stage, "site-frame-name")), "Mobile");
    assert.equal(label(one(stage, "site-sel-size")), "390 × 844");
    assert.equal(label(one(stage, "site-docs-sample-pick")), "Welcome, Adah1");
    assert.deepEqual(byClass(stage, "site-docs-sample-text").map(label), [
      "Your workspace is ready.",
      "Compact navigation",
    ]);
    assert.equal(
      byClass(stage, "site-docs-sample-wire").length,
      viewport === "desktop" ? 1 : 0,
    );
  });
}
