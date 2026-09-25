import assert from "node:assert/strict";
import { test } from "node:test";

import { parse } from "parse5";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

const treeOnly = [
  "design-appearance-auto",
  "design-appearance-drawer",
  "design-appearance-error",
  "design-appearance-flow",
  "design-appearance-home",
  "design-appearance-instance",
  "design-appearance-loading",
  "design-appearance-props",
  "design-appearance-unavailable",
  "design-browse-changed-views",
  "design-browse-dark-scheme",
  "design-browse-details",
  "design-browse-light-only",
  "design-browse-missing-route",
  "design-browse-variant-removed",
  "design-browse-variant-reparented",
  "design-component-added",
  "design-component-comparison",
  "design-component-controls-comparison",
  "design-component-controls-edited",
  "design-component-controls-error",
  "design-component-controls-invalid",
  "design-component-controls-unset",
  "design-component-empty",
  "design-component-inspection-direct-change",
  "design-component-inspector-closed",
  "design-component-screen-inspector-closed",
  "design-component-unavailable",
  "design-publication-catalogue",
  "design-publication-changes",
  "design-review-preparing",
  "design-review-style-unnamed",
  "design-review-style-unresolved",
  "design-review-unavailable",
];

test("every design screen has an inbound design link or opens only from the catalogue tree", async () => {
  const { manifest, outputs } = await designCatalogue;
  const screens = manifest.entries.flatMap((entry) =>
    entry.kind === "screen" && entry.id.startsWith("design-") ? [entry] : [],
  );
  const ids = new Set(screens.map((entry) => entry.id));
  const inbound = new Set<string>();
  for (const source of screens)
    for (const viewport of ["mobile", "desktop"] as const) {
      const html = outputs.get(source.fragments[viewport]);
      assert.ok(html, `${source.id}/${viewport}`);
      for (const link of elements(
        parse(html),
        (node) => node.tagName === "a",
      )) {
        const target = attribute(link, "data-mokly-link");
        if (target && target !== source.id && ids.has(target))
          inbound.add(target);
      }
    }
  assert.deepEqual(
    screens
      .filter((entry) => !inbound.has(entry.id))
      .map((entry) => entry.id)
      .sort(),
    treeOnly,
  );
});

test("matched and excluded styles share one changed Welcome; empty Changes keeps its zero-count All state", async () => {
  const excluded = await designDocument(
    "design-review-style-excluded",
    "desktop",
  );
  const matched = await designDocument(
    "design-review-style-matched",
    "desktop",
  );
  const ignored = await designDocument("design-review-ignored-only", "desktop");
  const empty = await designDocument("design-review-empty", "desktop");

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
  const evidence = textContent(
    byClass(excluded.document, "mbk-comparison-details")[0]!,
  );
  assert.match(evidence, /generated\/styles\.css/);
  assert.match(evidence, /generated\/excluded\.css/);
  assert.doesNotMatch(evidence, /No changes to this screen/);
  for (const { document } of [ignored, empty])
    assert.equal(
      textContent(byClass(document, "mbk-nav-filter-count")[0]!),
      "0",
    );
});
