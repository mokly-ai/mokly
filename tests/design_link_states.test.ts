import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";

function destinations(nodes: Element[]) {
  return nodes
    .filter((node) => node.tagName === "a")
    .map((node) => [
      textContent(node).trim(),
      attribute(node, "data-mokly-link"),
    ]);
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the consolidated screens keep a navigation-free toolbar`, async () => {
    for (const source of [
      "design-browse-screen",
      "design-browse-details-screen",
      "design-review-changed",
    ]) {
      const { document } = await designDocument(source, viewport);
      const group = elements(
        document,
        (node) => attribute(node, "aria-label") === "Preview options",
      )[0];
      assert.ok(group, source);
      assert.deepEqual(
        elements(group, (node) => node.tagName === "a"),
        [],
        source,
      );
    }
  });

  test(`${viewport}: comparison transitions respect the exact authored scenario`, async () => {
    const welcomeModes = [
      ["Current", "design-changes-current"],
      ["Side by side", "design-review-changed"],
      ["Overlay", "design-changes-overlay"],
      ["Difference", "design-review-difference"],
    ];
    for (const [source, active] of [
      ["design-changes-current", "Current"],
      ["design-review-changed", "Side by side"],
      ["design-changes-overlay", "Overlay"],
      ["design-review-difference", "Difference"],
    ]) {
      const { document } = await designDocument(source!, viewport);
      const toolbar = byClass(document, "mbk-cmp-toolbar")[0];
      assert.ok(toolbar);
      assert.deepEqual(
        destinations(elements(toolbar, (node) => node.tagName === "a")),
        welcomeModes.filter(([label]) => label !== active),
      );
    }
    for (const source of [
      "design-browse-screen",
      "design-review-shared-impact",
      "design-review-ignored-only",
      "design-review-empty",
      "design-browse-details-screen",
      "design-review-added",
      "design-review-removed",
      "design-review-style-excluded",
    ]) {
      const { document } = await designDocument(source, viewport);
      assert.equal(byClass(document, "mbk-cmp-toolbar").length, 0, source);
    }
    for (const source of [
      "design-review-style-matched",
      "design-review-style-unresolved",
      "design-review-style-unnamed",
    ]) {
      const { document } = await designDocument(source, viewport);
      const toolbar = byClass(document, "mbk-cmp-toolbar")[0];
      assert.ok(toolbar, source);
      assert.deepEqual(
        destinations(elements(toolbar, (node) => node.tagName === "a")),
        [],
        source,
      );
      assert.deepEqual(
        byClass(toolbar, "active").map((node) => textContent(node).trim()),
        ["Side by side"],
        source,
      );
    }
  });

  test(`${viewport}: picker round trips preserve queries and active chips clear them`, async () => {
    for (const [source, toggle, active] of [
      ["design-browse-screen", "design-browse-tag-picker", undefined],
      ["design-browse-details", "design-browse-tag-picker", undefined],
      ["design-browse-tag-picker", "design-browse-screen", undefined],
      ["design-browse-tag-forms", "design-browse-tag-filter", "forms"],
      ["design-browse-tag-filter", "design-browse-tag-forms", "forms"],
      [
        "design-browse-tag-onboarding",
        "design-browse-tag-onboarding-picker",
        "onboarding",
      ],
      [
        "design-browse-tag-onboarding-picker",
        "design-browse-tag-onboarding",
        "onboarding",
      ],
    ] as const) {
      const { document } = await designDocument(source, viewport);
      assert.equal(
        attribute(byClass(document, "mbk-search-tag")[0]!, "data-mokly-link"),
        toggle,
        source,
      );
      const chips = byClass(document, "tag");
      for (const chip of chips) {
        const tag = textContent(chip).trim();
        assert.equal(
          attribute(chip, "data-mokly-link"),
          active === tag ? "design-browse-screen" : `design-browse-tag-${tag}`,
          `${source}: ${tag}`,
        );
      }
      if (source.includes("picker") || source === "design-browse-tag-filter")
        assert.ok(chips.length >= 2);
    }
  });
}

test("Changes leaves and All escapes retain their subject", async () => {
  for (const [source, all] of [
    ["design-changes-current", "design-browse-screen"],
    ["design-review-added", "design-browse-details-screen"],
    ["design-review-removed", "design-browse-home"],
    ["design-review-empty", "design-browse-screen"],
  ] as const) {
    const { document } = await designDocument(source, "desktop");
    assert.deepEqual(destinations(byClass(document, "mbk-nav-filter-opt")), [
      ["All", all],
    ]);
    assert.deepEqual(
      destinations(byClass(document, "mbk-nav-row")),
      source === "design-review-empty"
        ? []
        : [
            ["Welcome", "design-changes-current"],
            ["Details", "design-review-added"],
            ["Farewell · Removed", "design-review-removed"],
            ["Survey · Removed", "design-review-removed-long"],
            ["Invite · Removed", "design-review-removed-loading"],
            ["Archive · Removed", "design-review-removed-unavailable"],
            ["Timeline · Removed", "design-review-removed-no-view"],
          ],
    );
  }
  for (const [source, changes] of [
    ["design-browse-screen", "design-changes-current"],
    ["design-browse-details-screen", "design-review-added"],
  ] as const) {
    const { document } = await designDocument(source, "desktop");
    assert.deepEqual(destinations(byClass(document, "mbk-nav-filter-opt")), [
      ["Changes7", changes],
    ]);
  }
});
