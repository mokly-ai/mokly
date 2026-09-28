import assert from "node:assert/strict";
import test from "node:test";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";
import {
  assertHighlightWaitsForStatic,
  noticePanels,
  previewMode,
  STATIC_NOTICE,
} from "./helpers/design_interactive.js";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the live workspace points inspection and highlighting back to Static`, async () => {
    const { document } = await designDocument(
      "design-interactive-component",
      viewport,
    );
    assert.deepEqual(noticePanels(document), ["Props", "Usage"]);
    assert.match(textContent(document), /About Action/);
    assertHighlightWaitsForStatic(document);
  });

  test(`${viewport}: a screen in Live opens its Components tab on the Static notice`, async () => {
    const { document } = await designDocument(
      "design-interactive-screen",
      viewport,
    );
    const tabs = elements(
      document,
      (node) =>
        node.tagName === "details" &&
        attribute(node, "data-panel") !== undefined,
    );
    assert.deepEqual(
      tabs.map((tab) => [
        attribute(tab, "data-panel"),
        attribute(tab, "open") !== undefined,
      ]),
      [
        ["info", false],
        ["components", true],
        ["props", false],
        ["usage", false],
      ],
    );
    const components = byClass(tabs[1]!, "ce-inspector-panel")[0];
    assert.ok(components);
    assert.equal(attribute(components, "aria-label"), "Components");
    assert.equal(textContent(components), STATIC_NOTICE);
    assert.deepEqual(noticePanels(document), ["Components", "Props", "Usage"]);
    const details = byClass(tabs[0]!, "ce-inspector-panel")[0];
    assert.ok(details);
    assert.match(textContent(details), /About Welcome/);
    assert.doesNotMatch(textContent(details), /Switch to Static/);
    assertHighlightWaitsForStatic(document);
  });

  test(`${viewport}: a catalogue without Live keeps its toolbar unchanged`, async () => {
    const { document } = await designDocument(
      "design-interactive-static-catalogue",
      viewport,
    );
    assert.equal(previewMode(document), undefined);
    assert.equal(byClass(document, "ce-preview-mode-off").length, 0);
    const toolbar = elements(
      document,
      (node) => attribute(node, "aria-label") === "Preview options",
    )[0];
    assert.ok(toolbar);
    assert.equal(byClass(toolbar, "mbk-seg").length, 0);
    assert.doesNotMatch(textContent(toolbar), /Static|Live/);
    assert.deepEqual(
      toolbar.childNodes
        .filter((node): node is Element => "tagName" in node)
        .map((node) => attribute(node, "class")?.split(/\s+/)[1]),
      ["ce-viewport-control", "ce-highlight-control"],
    );
    const highlight = byClass(document, "ce-highlight-toggle")[0];
    assert.ok(highlight);
    assert.equal(attribute(highlight, "disabled"), undefined);
  });
}
