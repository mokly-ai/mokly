import assert from "node:assert/strict";
import test from "node:test";

import { fieldValue, named, region } from "./helpers/design_assertions.js";
import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { children } from "./helpers/design_stacks.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: missing inspection, empty usage, invisible instances, and removal stay distinct`, async () => {
    for (const [path, copy] of [
      [
        "design/components/states/empty",
        "No registered components are used in this view.",
      ],
      [
        "design/components/states/unavailable",
        "Component inspection is unavailable for this screen.",
      ],
      [
        "design/components/states/unused",
        "No screens or components use Badge yet.",
      ],
      ["design/components/states/removed", "This variant has been removed."],
    ] as const) {
      const { document } = await designDocument(path, viewport);
      assert.ok(textContent(document).includes(copy), path);
      if (path.endsWith("unavailable"))
        assert.ok(
          attribute(
            named(document, "Highlight components", "input"),
            "disabled",
          ) !== undefined,
        );
    }
    const inspection = (
      await designDocument(
        "design/components/inspection/inspection-details",
        viewport,
      )
    ).document;
    const invisible = elements(
      inspection,
      (node) =>
        node.tagName === "details" &&
        children(node).filter(
          (item) =>
            item.tagName === "summary" &&
            textContent(item).includes("Help hint"),
        ).length > 0,
    );
    assert.equal(invisible.length, 1);
    assert.ok(textContent(invisible[0]!).includes("No visible region"));
    const removed = (
      await designDocument("design/components/states/removed", viewport)
    ).document;
    assert.equal(
      attribute(
        named(region(removed, "Affected screens"), /Farewell/iu, "a"),
        "data-mokly-link",
      ),
      "design/components/states/removed-consumer",
    );
    const previous = (
      await designDocument(
        "design/components/states/removed-consumer",
        viewport,
      )
    ).document;
    assert.deepEqual(byClass(previous, "mbk-previous").map(textContent), [
      "Showing previous version",
    ]);
    const set = byClass(previous, "ce-preview-set")[0]!;
    assert.equal(attribute(set, "data-viewport"), viewport);
    for (const view of byClass(previous, "ce-preview-view")) {
      assert.ok(
        textContent(view).includes("Come back whenever you are ready."),
      );
      assert.equal(byClass(view, "ce-action--before").length, 1);
      const frame =
        attribute(view, "data-preview-viewport") === "desktop"
          ? "browser-frame"
          : "phone-frame";
      assert.equal(byClass(view, frame).length, 1);
    }
    assert.equal(
      elements(
        previous,
        (node) => attribute(node, "aria-label") === "Comparison mode",
      ).length,
      0,
    );
    assert.equal(byClass(previous, "mbk-pane-missing").length, 0);
    assert.equal(
      elements(
        previous,
        (node) =>
          attribute(node, "role") === "switch" &&
          attribute(node, "aria-label") === "Dark mode",
      ).length,
      0,
    );
    assert.equal(fieldValue(named(previous, "Appearance", "select")), "light");
    assert.ok(
      attribute(
        named(previous, "Highlight components", "input"),
        "disabled",
      ) !== undefined,
    );
    const nav = byClass(
      previous,
      viewport === "desktop" ? "mbk-nav" : "ce-mobile-location",
    )[0]!;
    const link = elements(
      nav,
      (node) =>
        node.tagName === "a" &&
        textContent(node).includes(
          viewport === "desktop" ? "Action" : "Changes",
        ),
    );
    assert.equal(link.length, 1);
    assert.equal(
      attribute(link[0]!, "data-mokly-link"),
      "design/components/states/removed",
    );
    assert.ok(named(previous, "Details", "summary"));
  });
}
