import assert from "node:assert/strict";
import test from "node:test";

import { named, region } from "./helpers/design_assertions.js";
import {
  attribute,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { children, openPanel } from "./helpers/design_stacks.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: component tabs distinguish leaves, containers, and screen inspection`, async () => {
    const leaf = (
      await designDocument("design/components/controls/controls", viewport)
    ).document;
    const inspector = region(leaf, "Inspector");
    assert.equal(
      elements(
        inspector,
        (node) => attribute(node, "data-panel") === "components",
      ).length,
      0,
    );
    const toolbar = (
      await designDocument("design/components/pages/toolbar", viewport)
    ).document;
    assert.ok(
      named(region(toolbar, "Inspector"), "Nested components", "summary"),
    );
    assert.match(textContent(region(toolbar, "Nested components")), /Action/u);
    const empty = (
      await designDocument("design/components/states/empty", viewport)
    ).document;
    assert.ok(named(region(empty, "Inspector"), "Components", "summary"));
    const edited = (
      await designDocument(
        "design/components/controls/editing/edited",
        viewport,
      )
    ).document;
    assert.ok(named(region(edited, "Inspector"), "Controls", "summary"));
    assert.ok(named(edited, "Expanded inspector", "input"));
    assert.ok(named(edited, "hint", "input"));
  });

  test(`${viewport}: inspector starts open and its summaries name their matching regions`, async () => {
    const { document } = await designDocument(
      "design/components/pages/toolbar",
      viewport,
    );
    const inspector = region(document, "Inspector");
    const tabs = children(inspector).filter(
      (node) => node.tagName === "details",
    );
    assert.equal(
      tabs.filter((node) => attribute(node, "open") !== undefined).length,
      1,
    );
    assert.ok(openPanel(document));
    const names = tabs.map((node) => attribute(node, "name"));
    assert.ok(names.every(Boolean));
    assert.equal(new Set(names).size, 1);
    for (const [label, panel] of [
      ["Nested components", "Nested components"],
      ["Props", "Props"],
      ["Usage", "Used by"],
      ["Details", "Details"],
    ]) {
      const summary = named(inspector, label!, "summary");
      assert.equal(attribute(summary, "role"), "button");
      const disclosure = summary.parentNode;
      assert.ok(disclosure);
      assert.ok(region(disclosure, panel!));
    }
    const overview = (
      await designDocument("design/components/overview", viewport)
    ).document;
    assert.ok(region(overview, "Used by"));
  });
}
