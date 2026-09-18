import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { catalogueNavigation } from "../examples/basic/entries/design/library/chrome/catalogue-navigation.js";
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
  assert.equal(baseline.length, 56);
  for (const original of baseline) {
    const entry = manifest.entries.find((entry) => entry.id === original.id);
    assert.ok(entry?.kind === "screen", original.id);
    assert.equal(entry.route, original.route);
    assert.deepEqual(entry.fragments, original.fragments);
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
      assert.equal(variant.darkFragments, undefined);
      assert.deepEqual(
        variant.componentViews.map((view) => view.viewport).sort(),
        ["desktop", "mobile"],
      );
      for (const route of Object.values(variant.fragments))
        assert.ok(outputs.has(route), route);
    }
  }
});
