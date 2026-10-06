import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { catalogueNavigation } from "../examples/basic/specs/design/library/chrome/catalogue-navigation.js";
import { DUAL_SCHEME_SAMPLES } from "../examples/basic/specs/design/library/metadata.js";
import { NAV_TREE } from "../examples/basic/specs/design/parts/nav_data.js";
import {
  analyzeHierarchy,
  entryRoute,
  generatedViews,
  viewRoute,
} from "../packages/viewer/dist/data.js";

import { assertAbsent, entriesUnder } from "./helpers/catalogue_selection.js";
import {
  componentParent,
  componentVariants,
} from "./helpers/component_views.js";
import { designCatalogue } from "./helpers/design_catalogue.js";
import { designLibrary } from "./helpers/design_library.js";

test("catalogue navigation's All example matches its in-screen navigation", () => {
  const all = catalogueNavigation.entries.find(
    (variant) => "variantOf" in variant && variant.slug === "all",
  );
  assert.ok(all);
  if (!all || !("variantOf" in all))
    throw new Error("Missing catalogue-navigation variant");
  assert.deepEqual(all.props.rows, NAV_TREE);
});

/**
 * `screens.json` is a frozen record proving the shared-library refactor never
 * dropped a screen, so an entry may only be removed from it
 * with the user's recorded approval. `plans/screen-variants-follow-up.md`
 * approves six Welcome variant route moves, while `plans/viewer-dark-mode.md`
 * removes the dark-comparison screen. Other disappearances are regressions,
 * not reasons to rewrite this fixture.
 */
/**
 * Baseline screens that have since gained a dark render: the canonical screens
 * that absorbed the removed head-band scheme pairs, and the Welcome comparison
 * family, whose members must publish the same schemes so a dark comparison
 * never links into a light document. Their file-derived paths are recorded by the inventory.
 */
const DUAL_SCHEME_SINCE_BASELINE = new Set([
  "design/browse/views/screen",
  "design/browse/views/details-screen",
  "design/browse/views/screen/dark-scheme",
  "design/browse/views/screen/light-only",
  "design/changes/diff-controls/current",
  "design/changes/diff-controls/overlay",
  "design/changes/outcomes/changed",
  "design/changes/outcomes/difference",
]);

test("the shared library preserves every existing design screen and viewport route", async () => {
  const baseline: {
    path: string;
  }[] = JSON.parse(
    await fs.readFile(
      new URL("./fixtures/design-library/screens.json", import.meta.url),
      "utf8",
    ),
  );
  const { manifest } = await designCatalogue;
  assert.equal(baseline.length, 55);
  for (const original of baseline) {
    const entry = manifest.entries.find(
      (entry) => entry.path === original.path,
    );
    assert.ok(entry?.kind === "screen", original.path);
    assert.equal(entryRoute(entry.path), `${entry.path}/index.html`);
    assert.deepEqual(
      (["mobile", "desktop"] as const).map((viewport) =>
        viewRoute(entry.path, viewport, "light"),
      ),
      [`${entry.path}/index.mobile.html`, `${entry.path}/index.desktop.html`],
    );
    if (!DUAL_SCHEME_SINCE_BASELINE.has(original.path))
      assert.deepEqual(entry.colorSchemes, ["light"]);
  }
});

test("all sixteen shared components have connected pages, controls and saved examples", async () => {
  const { manifest, outputs } = await designCatalogue;
  const components = entriesUnder(manifest, "design/library", {
    kind: "component",
    variants: "exclude",
    min: 16,
  });
  assert.equal(components.length, 16);
  assertAbsent(manifest, "design");
  const hierarchy = analyzeHierarchy(
    manifest.entries,
    manifest.folders,
  ).hierarchy;
  const groupTitles = {
    chrome: "Chrome",
    controls: "Controls",
    inspector: "Inspector",
    preview: "Preview",
  };
  for (const [group, slug, variants] of designLibrary) {
    const id = `design/library/${group}/${slug}`;
    const entry = componentParent(manifest, id);
    const saved = componentVariants(manifest, id);
    assert.equal(entryRoute(entry.path), `${id}/index.html`);
    assert.deepEqual(
      saved.map((variant) => variant.path),
      variants.map((variant) => `${id}/${variant}`),
    );
    assert.ok(Object.keys(entry.controls).length > 0, id);
    assert.deepEqual(hierarchy.ancestorsByPath.get(entry.path), [
      "Design",
      "Shared components",
      groupTitles[group],
    ]);
    assert.ok(
      components.filter((component) =>
        component.path.startsWith(`design/library/${group}/`),
      ).length <= 5,
    );
    for (const variant of saved) {
      // Only the samples whose own subject is appearance render in both schemes.
      assert.equal(
        !variant.colorSchemes.includes("dark"),
        !DUAL_SCHEME_SAMPLES.has(slug),
        `${id}/${variant.path}`,
      );
      const schemes = DUAL_SCHEME_SAMPLES.has(slug) ? 2 : 1;
      assert.deepEqual(
        [
          ...new Set(variant.componentViews.map((view) => view.viewport)),
        ].sort(),
        ["desktop", "mobile"],
      );
      assert.equal(variant.componentViews.length, 2 * schemes, id);
      for (const route of generatedViews(variant).map((view) => view.path))
        assert.ok(outputs.has(route), route);
    }
  }
});
