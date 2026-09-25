import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { catalogueNavigation } from "../examples/basic/entries/design/library/chrome/catalogue-navigation.js";
import { DUAL_SCHEME_SAMPLES } from "../examples/basic/entries/design/library/metadata.js";
import { NAV_TREE } from "../examples/basic/entries/design/parts/nav_data.js";

import { designCatalogue } from "./helpers/design_catalogue.js";
import { designLibrary } from "./helpers/design_library.js";

test("catalogue navigation's All example matches its in-screen navigation", () => {
  const all = catalogueNavigation.entry.variants.find(
    (variant) => variant.id === "all",
  );
  assert.ok(all);
  assert.deepEqual(all.props.rows, NAV_TREE);
});

/**
 * `screens.json` is a frozen record proving the shared-library refactor never
 * dropped a screen or changed a route, so an entry may only be removed from it
 * with the user's recorded approval. `plans/screen-variants-follow-up.md`
 * approves six Welcome variant route moves, while `plans/viewer-dark-mode.md`
 * removes the dark-comparison screen. Other disappearances are regressions,
 * not reasons to rewrite this fixture.
 */
/**
 * Baseline screens that have since gained a dark render: the canonical screens
 * that absorbed the removed head-band scheme pairs, and the Welcome comparison
 * family, whose members must publish the same schemes so a dark comparison
 * never links into a light document. Their routes and light fragments are
 * unchanged, which is what the baseline records.
 */
const DUAL_SCHEME_SINCE_BASELINE = new Set([
  "design-browse-screen",
  "design-browse-details-screen",
  "design-browse-dark-scheme",
  "design-browse-light-only",
  "design-changes-current",
  "design-changes-overlay",
  "design-review-changed",
  "design-review-difference",
]);

test("the shared library preserves every existing design screen and viewport route", async () => {
  const baseline: {
    id: string;
    route: string;
    fragments: Record<string, string>;
  }[] = JSON.parse(
    await fs.readFile(
      new URL("./fixtures/design-library/screens.json", import.meta.url),
      "utf8",
    ),
  );
  const { manifest } = await designCatalogue;
  assert.equal(baseline.length, 55);
  for (const original of baseline) {
    const entry = manifest.entries.find((entry) => entry.id === original.id);
    assert.ok(entry?.kind === "screen", original.id);
    assert.equal(entry.route, original.route);
    assert.deepEqual(entry.fragments, original.fragments);
    if (!DUAL_SCHEME_SINCE_BASELINE.has(original.id))
      assert.equal(entry.darkFragments, undefined);
  }
});

test("all sixteen shared components have connected pages, controls and saved examples", async () => {
  const { manifest, outputs } = await designCatalogue;
  const components = manifest.entries.filter(
    (entry) => entry.kind === "component" && entry.id.startsWith("design-ui-"),
  );
  assert.equal(components.length, 16);
  const root = manifest.entries.find((entry) => entry.id === "design-root");
  assert.ok(root?.kind === "collection");
  assert.ok(root.childIds.includes("design-library"));
  for (const [group, slug, variants] of designLibrary) {
    const id = `design-ui-${slug}`;
    const entry = components.find((entry) => entry.id === id);
    assert.ok(entry?.kind === "component", id);
    assert.equal(entry.route, `design/library/${group}/${slug}.html`);
    assert.deepEqual(
      entry.variants.map((variant) => variant.id),
      variants,
    );
    assert.ok(Object.keys(entry.controls).length > 0, id);
    const collection = manifest.entries.find(
      (entry) => entry.id === `design-library-${group}`,
    );
    assert.ok(collection?.kind === "collection");
    assert.ok(collection.childIds.includes(id));
    assert.ok(collection.childIds.length <= 5);
    for (const variant of entry.variants) {
      // Only the samples whose own subject is appearance render in both schemes.
      assert.equal(
        variant.darkFragments === undefined,
        !DUAL_SCHEME_SAMPLES.has(slug),
        `${id}/${variant.id}`,
      );
      const schemes = DUAL_SCHEME_SAMPLES.has(slug) ? 2 : 1;
      assert.deepEqual(
        [
          ...new Set(variant.componentViews.map((view) => view.viewport)),
        ].sort(),
        ["desktop", "mobile"],
      );
      assert.equal(variant.componentViews.length, 2 * schemes, id);
      for (const route of [
        ...Object.values(variant.fragments),
        ...Object.values(variant.darkFragments ?? {}),
      ])
        assert.ok(outputs.has(route), route);
    }
  }
});
