import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DUAL_SCHEME_SAMPLES } from "../examples/basic/entries/design/library/metadata.js";
import { AppearanceSelect } from "../packages/viewer/dist/shell/appearance.js";

import {
  attribute,
  designCatalogue,
  elements,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

/** Registered samples whose appearance is the subject of the sample itself. */
const dualSchemeComponents = [...DUAL_SCHEME_SAMPLES].map(
  (slug) => `design-ui-${slug}`,
);

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
      const light = textOutput(outputs, entry.fragments[viewport]);
      assert.ok(light, `${entry.id} ${viewport} light output`);
      assert.equal(appearanceOf(light), "light", `${entry.id} ${viewport}`);
      const darkRoute: string | undefined = entry.darkFragments?.[viewport];
      assert.ok(darkRoute, `${entry.id} ${viewport} dark route`);
      const dark = textOutput(outputs, darkRoute);
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
        const dark = textOutput(outputs, variant.darkFragments[viewport]!);
        assert.ok(dark, `${id}/${variant.id} ${viewport}`);
        assert.equal(appearanceOf(dark), "dark", `${id}/${variant.id}`);
      }
    }
  }
});

/** Appearance artboards that place a device preview on their stage. */
async function appearanceFragments(): Promise<
  { id: string; scheme: "light" | "dark"; viewport: string; html: string }[]
> {
  const { manifest, outputs } = await designCatalogue;
  return manifest.entries.flatMap((entry) =>
    entry.kind === "screen" &&
    entry.route.startsWith("design/browse/appearance/")
      ? (["mobile", "desktop"] as const).flatMap((viewport) =>
          (["light", "dark"] as const).map((scheme) => ({
            id: entry.id,
            scheme,
            viewport,
            html: textOutput(
              outputs,
              scheme === "dark"
                ? entry.darkFragments![viewport]!
                : entry.fragments[viewport],
            )!,
          })),
        )
      : [],
  );
}

function countClass(html: string, className: string): number {
  return elements(parse(html), (node) =>
    (attribute(node, "class") ?? "").split(/\s+/u).includes(className),
  ).length;
}

function appearanceDataAttributes(html: string): string[] {
  const control = elements(parse(html), (node) =>
    (attribute(node, "class") ?? "").split(/\s+/u).includes("mbk-appearance"),
  )[0];
  assert.ok(control, "Appearance control");
  return [
    ...new Set(
      elements(control, () => true).flatMap((node) =>
        node.attrs
          .map(({ name }) => name)
          .filter((name) => name.includes("appearance")),
      ),
    ),
  ].sort();
}

test("the depicted and shipped Appearance controls share their data contract", async () => {
  const depicted = (await appearanceFragments()).find(
    (view) => view.id === "design-appearance-overview",
  );
  assert.ok(depicted);
  assert.deepEqual(
    appearanceDataAttributes(depicted.html),
    appearanceDataAttributes(
      renderToStaticMarkup(
        createElement(AppearanceSelect, { ready: true, theme: "auto" }),
      ),
    ),
  );
});

test("an appearance artboard draws exactly one scheme control", async () => {
  for (const view of await appearanceFragments()) {
    const where = `${view.id} ${view.viewport} ${view.scheme}`;
    assert.equal(
      countClass(view.html, "mbk-appearance"),
      1,
      `${where}: one Appearance selector`,
    );
    assert.equal(
      countClass(view.html, "ce-theme-control"),
      0,
      `${where}: no head-band scheme control`,
    );
    assert.equal(
      countClass(view.html, "ce-theme-toggle"),
      0,
      `${where}: no toolbar scheme switch`,
    );
  }
});
