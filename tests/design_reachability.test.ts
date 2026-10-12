import assert from "node:assert/strict";
import { test } from "node:test";

import { parse } from "parse5";

import { viewRoute } from "../packages/viewer/dist/data.js";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

const treeOnly = [
  "design/browse/appearance/states/auto",
  // The removed Payment terms branch is opened from its owning catalogue page.
  "design/browse/appearance/states/light-only-document",
  "design/browse/appearance/workspaces/drawer",
  "design/browse/appearance/status/error",
  "design/browse/appearance/status/flow",
  "design/browse/appearance/status/home",
  "design/browse/appearance/workspaces/instance",
  "design/browse/appearance/status/loading",
  "design/browse/appearance/workspaces/props",
  "design/browse/appearance/status/unavailable",
  "design/browse/variants/changed-views",
  "design/browse/views/screen/dark-scheme",
  "design/browse/states/details",
  "design/browse/views/screen/light-only",
  "design/browse/states/missing-route",
  "design/browse/variants/variant-removed",
  "design/browse/variants/variant-reparented",
  "design/changes/diff-controls/overlay-long",
  "design/changes/diff-controls/overlay-panel",
  "design/changes/diff-controls/side-by-side-apart",
  "design/components/states/additions/added",
  "design/components/controls/states/comparison",
  "design/components/controls/editing/edited",
  "design/components/controls/states/error",
  "design/components/controls/states/invalid",
  "design/components/controls/editing/unset",
  "design/components/states/empty",
  "design/components/inspection/inspection-direct-change",
  "design/components/states/loading/inspection-loading",
  "design/components/inspector/inspector-closed",
  "design/components/pages/stacked/overlay-tall",
  "design/components/inspector/screen-inspector-closed",
  "design/components/states/shared-impact/shared-impact",
  "design/components/states/shared-impact/style-outside",
  "design/components/states/unavailable",
  "design/components/states/loading/usage-failed",
  "design/components/states/loading/usage-loading",
  "design/browse/publication/catalogue",
  "design/browse/publication/changes",
  "design/changes/availability/preparing",
  "design/changes/impact/styles/unresolved-unnamed/unnamed",
  "design/changes/impact/styles/unresolved-unnamed/unresolved",
  "design/changes/availability/unavailable",
];

test("every design screen has an inbound design link or opens only from the catalogue tree", async () => {
  const { manifest, outputs } = await designCatalogue;
  const screens = manifest.entries.flatMap((entry) =>
    entry.kind === "screen" && entry.path.startsWith("design/") ? [entry] : [],
  );
  const ids = new Set(screens.map((entry) => entry.path));
  const inbound = new Set<string>();
  for (const source of screens)
    for (const viewport of ["mobile", "desktop"] as const) {
      const html = textOutput(
        outputs,
        viewRoute(source.path, viewport, "light"),
      );
      assert.ok(html, `${source.path}/${viewport}`);
      for (const link of elements(
        parse(html),
        (node) => node.tagName === "a",
      )) {
        const target = attribute(link, "data-mokly-link");
        if (target && target !== source.path && ids.has(target))
          inbound.add(target);
      }
    }
  assert.deepEqual(
    screens
      .filter((entry) => !inbound.has(entry.path))
      .map((entry) => entry.path)
      .sort(),
    [...treeOnly].sort(),
  );
});

test("matched and excluded styles share one changed Welcome; empty Changes keeps its zero-count All state", async () => {
  const excluded = await designDocument(
    "design/changes/impact/styles/matched-excluded/excluded",
    "desktop",
  );
  const matched = await designDocument(
    "design/changes/impact/styles/matched-excluded/matched",
    "desktop",
  );
  const ignored = await designDocument(
    "design/changes/impact/ignored-only",
    "desktop",
  );
  const empty = await designDocument("design/changes/impact/empty", "desktop");

  for (const { document } of [excluded, matched]) {
    assert.equal(
      textContent(byClass(document, "mbk-nav-filter-count")[0]!),
      "1",
    );
    assert.match(
      textContent(byClass(document, "mbk-title-row")[0]!),
      /Welcome/,
    );
  }
  for (const { document } of [excluded, matched]) {
    const evidence = textContent(
      byClass(document, "mbk-comparison-details")[0]!,
    );
    assert.match(evidence, /generated\/styles\.css/);
    assert.match(evidence, /generated\/excluded\.css/);
    assert.doesNotMatch(evidence, /No changes to this screen/);
  }
  for (const { document } of [ignored, empty])
    assert.equal(
      textContent(byClass(document, "mbk-nav-filter-count")[0]!),
      "0",
    );
});

for (const viewport of ["mobile", "desktop"] as const)
  test(`${viewport}: Excluded styles keeps Changed status and Current comparison controls`, async () => {
    const { document } = await designDocument(
      "design/changes/impact/styles/matched-excluded/excluded",
      viewport,
    );
    const status = byClass(document, "ce-change-status");
    assert.deepEqual(status.map(textContent), ["Changed"]);
    assert.equal(attribute(status[0]!, "data-change-status"), "changed");
    const toolbar = byClass(document, "mbk-cmp-toolbar");
    assert.equal(toolbar.length, 1);
    assert.match(
      textContent(toolbar[0]!),
      /Current.*Side by side.*Overlay.*Difference/,
    );
    assert.deepEqual(byClass(toolbar[0]!, "active").map(textContent), [
      "Current",
    ]);
    if (viewport === "desktop") {
      const activeRow = byClass(document, "mbk-nav-row").find(
        (row) => attribute(row, "aria-current") === "page",
      );
      assert.ok(activeRow);
      assert.equal(
        attribute(activeRow, "data-mokly-link"),
        "design/changes/impact/styles/matched-excluded/excluded",
      );
      assert.deepEqual(
        byClass(activeRow, "mbk-nav-changed-text").map(textContent),
        ["Changed"],
      );
    }
  });
