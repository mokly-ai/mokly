import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import {
  attribute,
  designCatalogue,
  elements,
} from "./helpers/design_catalogue.js";

/** Registered samples whose appearance is the subject of the sample itself. */
const dualSchemeComponents = [
  "design-ui-appearance-selector",
  "design-ui-top-bar",
];

function appearanceOf(html: string): string | undefined {
  const roots = elements(
    parse(html),
    (node) => attribute(node, "data-mbk-appearance") !== undefined,
  );
  assert.equal(roots.length, 1, "one artboard root states its appearance");
  return attribute(roots[0]!, "data-mbk-appearance");
}

test("appearance screens publish both schemes for both viewports", async () => {
  const { manifest } = await designCatalogue;
  const screens = manifest.entries.filter(
    (entry) =>
      entry.kind === "screen" &&
      entry.route.startsWith("design/browse/appearance/"),
  );
  assert.ok(screens.length > 0, "the appearance section exists");
  for (const entry of screens) {
    assert.ok(entry.kind === "screen");
    assert.ok(
      entry.darkFragments,
      `${entry.id} has no dark fragment, so the preview toggle cannot switch it`,
    );
    assert.deepEqual(Object.keys(entry.darkFragments).sort(), [
      "desktop",
      "mobile",
    ]);
  }
});

test("each generated appearance variant draws the scheme it was rendered for", async () => {
  const { manifest, outputs } = await designCatalogue;
  const screens = manifest.entries.filter(
    (entry) =>
      entry.kind === "screen" &&
      entry.route.startsWith("design/browse/appearance/"),
  );
  for (const entry of screens) {
    assert.ok(entry.kind === "screen");
    for (const viewport of ["mobile", "desktop"] as const) {
      const light = outputs.get(entry.fragments[viewport]);
      assert.ok(light, `${entry.id} ${viewport} light output`);
      assert.equal(appearanceOf(light), "light", `${entry.id} ${viewport}`);
      const darkRoute: string | undefined = entry.darkFragments?.[viewport];
      assert.ok(darkRoute, `${entry.id} ${viewport} dark route`);
      const dark = outputs.get(darkRoute);
      assert.ok(dark, `${entry.id} ${viewport} dark output`);
      assert.equal(appearanceOf(dark), "dark", `${entry.id} ${viewport}`);
    }
  }
});

test("the appearance-related registered samples render in both schemes", async () => {
  const { manifest, outputs } = await designCatalogue;
  for (const id of dualSchemeComponents) {
    const entry = manifest.entries.find((entry) => entry.id === id);
    assert.ok(entry?.kind === "component", id);
    for (const variant of entry.variants) {
      assert.ok(
        variant.darkFragments,
        `${id}/${variant.id} has no dark sample`,
      );
      for (const viewport of ["mobile", "desktop"] as const) {
        const dark = outputs.get(variant.darkFragments[viewport]!);
        assert.ok(dark, `${id}/${variant.id} ${viewport}`);
        assert.equal(appearanceOf(dark), "dark", `${id}/${variant.id}`);
      }
    }
  }
});
