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

test("Changes artboards have named comparison modes and no separate modes navigation", async () => {
  for (const mode of [
    "current",
    "overlay",
    "overlay-long",
    "overlay-panel",
    "side-by-side-apart",
  ]) {
    for (const viewport of ["desktop", "mobile"] as const) {
      const { document } = await designDocument(
        `design/changes/diff-controls/${mode}`,
        viewport,
      );
      const groups = elements(
        document,
        (node) =>
          attribute(node, "role") === "group" &&
          attribute(node, "aria-label") === "Comparison mode",
      );
      assert.equal(groups.length, 1);
      assert.match(textContent(groups[0]!), /Current/u);
      if (mode === "current") {
        assert.deepEqual(byClass(groups[0]!, "active").map(textContent), [
          "Current",
        ]);
      }
      assert.equal(
        elements(
          document,
          (node) =>
            node.tagName === "nav" &&
            attribute(node, "aria-label") === "Mokly modes",
        ).length,
        0,
      );
    }
  }
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the consolidated screens keep a navigation-free toolbar`, async () => {
    for (const source of [
      "design/browse/views/screen",
      "design/browse/views/details-screen",
      "design/changes/outcomes/changed",
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
      ["Current", "design/changes/diff-controls/current"],
      ["Side by side", "design/changes/outcomes/changed"],
      ["Overlay", "design/changes/diff-controls/overlay"],
      ["Difference", "design/changes/outcomes/difference"],
    ];
    for (const [source, active] of [
      ["design/changes/diff-controls/current", "Current"],
      ["design/changes/outcomes/changed", "Side by side"],
      ["design/changes/diff-controls/overlay", "Overlay"],
      ["design/changes/diff-controls/overlay-long", "Overlay"],
      ["design/changes/diff-controls/overlay-panel", "Overlay"],
      ["design/changes/diff-controls/side-by-side-apart", "Side by side"],
      ["design/changes/outcomes/difference", "Difference"],
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
      "design/browse/views/screen",
      "design/changes/impact/shared-impact",
      "design/changes/impact/ignored-only",
      "design/changes/impact/empty",
      "design/browse/views/details-screen",
      "design/changes/outcomes/added",
      "design/changes/outcomes/removed",
      "design/changes/impact/styles/excluded",
    ]) {
      const { document } = await designDocument(source, viewport);
      assert.equal(byClass(document, "mbk-cmp-toolbar").length, 0, source);
    }
    const actionModes = [
      ["Current", "design/components/pages/affected"],
      ["Side by side", "design/components/pages/comparison"],
      ["Overlay", "design/components/pages/stacked/overlay"],
      ["Difference", "design/components/pages/stacked/difference"],
    ] as const;
    for (const [active, source] of actionModes) {
      const { document } = await designDocument(source, viewport);
      const toolbar = byClass(document, "mbk-cmp-toolbar")[0];
      assert.ok(toolbar, source);
      assert.deepEqual(
        destinations(elements(toolbar, (node) => node.tagName === "a")),
        actionModes.filter(([label]) => label !== active),
        source,
      );
    }
    for (const [source, active] of [
      ["design/changes/impact/styles/matched", "Side by side"],
      ["design/changes/impact/styles/unresolved", "Side by side"],
      ["design/changes/impact/styles/unnamed", "Side by side"],
      ["design/components/pages/stacked/overlay-tall", "Overlay"],
    ] as const) {
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
        [active],
        source,
      );
    }
  });

  test(`${viewport}: picker round trips preserve queries and active chips clear them`, async () => {
    for (const [source, toggle, active] of [
      [
        "design/browse/views/screen",
        "design/browse/views/screen/tag-picker",
        undefined,
      ],
      [
        "design/browse/states/details",
        "design/browse/views/screen/tag-picker",
        undefined,
      ],
      [
        "design/browse/views/screen/tag-picker",
        "design/browse/views/screen",
        undefined,
      ],
      [
        "design/browse/views/screen/tag-forms",
        "design/browse/states/tag-filter",
        "forms",
      ],
      [
        "design/browse/states/tag-filter",
        "design/browse/views/screen/tag-forms",
        "forms",
      ],
      [
        "design/browse/views/screen/tag-onboarding",
        "design/browse/views/screen/tag-onboarding-picker",
        "onboarding",
      ],
      [
        "design/browse/views/screen/tag-onboarding-picker",
        "design/browse/views/screen/tag-onboarding",
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
          active === tag
            ? "design/browse/views/screen"
            : `design/browse/views/screen/tag-${tag}`,
          `${source}: ${tag}`,
        );
      }
      if (
        source.includes("picker") ||
        source === "design/browse/states/tag-filter"
      )
        assert.ok(chips.length >= 2);
    }
  });
}

test("Changes leaves and All escapes retain their subject", async () => {
  for (const [source, all] of [
    ["design/changes/diff-controls/current", "design/browse/views/screen"],
    ["design/changes/diff-controls/overlay-long", "design/browse/views/screen"],
    [
      "design/changes/diff-controls/overlay-panel",
      "design/browse/views/screen",
    ],
    [
      "design/changes/diff-controls/side-by-side-apart",
      "design/browse/views/screen",
    ],
    ["design/changes/outcomes/added", "design/browse/views/details-screen"],
    ["design/changes/outcomes/removed", "design/browse/views/home"],
    ["design/changes/impact/empty", "design/browse/views/screen"],
  ] as const) {
    const { document } = await designDocument(source, "desktop");
    assert.deepEqual(destinations(byClass(document, "mbk-nav-filter-opt")), [
      ["All", all],
    ]);
    assert.deepEqual(
      destinations(byClass(document, "mbk-nav-row")),
      source === "design/changes/impact/empty"
        ? []
        : [
            ["Welcome", "design/changes/diff-controls/current"],
            ["Details", "design/changes/outcomes/added"],
            ["Invoice · Moved", "design/changes/outcomes/moved"],
            ["Farewell · Removed", "design/changes/outcomes/removed"],
            [
              "Survey · Removed",
              "design/changes/outcomes/previous-version/long",
            ],
            [
              "Invite · Removed",
              "design/changes/outcomes/previous-version/loading",
            ],
            [
              "Archive · Removed",
              "design/changes/outcomes/previous-version/unavailable",
            ],
            [
              "Timeline · Removed",
              "design/changes/outcomes/previous-version/no-view",
            ],
          ],
    );
  }
  for (const [source, changes] of [
    ["design/browse/views/screen", "design/changes/diff-controls/current"],
    ["design/browse/views/details-screen", "design/changes/outcomes/added"],
  ] as const) {
    const { document } = await designDocument(source, "desktop");
    assert.deepEqual(destinations(byClass(document, "mbk-nav-filter-opt")), [
      ["Changes10", changes],
    ]);
  }
});
