import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { generatedViews, viewRoute } from "../packages/viewer/dist/data.js";

import {
  attribute,
  designCatalogue,
  designEntries,
  elements,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

function appearanceOf(html: string): string | undefined {
  const roots = elements(
    parse(html),
    (node) => attribute(node, "data-mbk-appearance") !== undefined,
  );
  assert.equal(roots.length, 1, "one artboard root states its appearance");
  return attribute(roots[0]!, "data-mbk-appearance");
}

function countClass(html: string, className: string): number {
  return elements(parse(html), (node) =>
    (attribute(node, "class") ?? "").split(/\s+/u).includes(className),
  ).length;
}

test("no design artboard depicts a scheme control", async () => {
  const { outputs } = await designCatalogue;
  for (const entry of await designEntries(
    (entry) => entry.kind === "screen" && entry.path.startsWith("design/"),
    "appearance control artboards",
  )) {
    if (entry.kind !== "screen" || !entry.path.startsWith("design/")) continue;
    for (const route of generatedViews(entry).map((view) => view.path)) {
      const html = textOutput(outputs, route)!;
      assert.equal(countClass(html, "ce-theme-control"), 0, route);
      assert.equal(countClass(html, "ce-theme-toggle"), 0, route);
    }
  }
});

test("retained Welcome variants follow the single Appearance setting", async () => {
  const { manifest, outputs } = await designCatalogue;
  for (const [id, darkDevice] of [
    ["design/browse/views/screen/dark-scheme", true],
    ["design/browse/views/screen/light-only", false],
  ] as const) {
    const entry = manifest.entries.find((candidate) => candidate.path === id);
    assert.ok(entry?.kind === "screen", id);
    assert.equal(entry.variantOf, "design/browse/views/screen", id);
    assert.ok(
      entry.colorSchemes.includes("dark"),
      `${id}: dark artboard missing`,
    );
    for (const viewport of ["mobile", "desktop"] as const) {
      const light = textOutput(
        outputs,
        viewRoute(entry.path, viewport, "light"),
      );
      const dark = textOutput(outputs, viewRoute(entry.path, viewport, "dark"));
      assert.ok(light && dark, `${id}/${viewport}: both schemes generated`);
      assert.equal(appearanceOf(light), "light", `${id}/${viewport}`);
      assert.equal(appearanceOf(dark), "dark", `${id}/${viewport}`);
      assert.equal(countClass(light, "mbk-screen-dark"), 0);
      assert.equal(countClass(dark, "mbk-screen-dark") > 0, darkDevice);
      assert.equal(countClass(dark, "mbk-frame-scheme-note") > 0, !darkDevice);
    }
  }
});

test("every artboard with a top bar draws one Appearance control", async () => {
  const { outputs } = await designCatalogue;
  let checked = 0;
  for (const entry of await designEntries(
    (entry) => entry.kind === "screen" && entry.path.startsWith("design/"),
    "appearance control artboards",
  )) {
    if (entry.kind !== "screen" || !entry.path.startsWith("design/")) continue;
    for (const route of generatedViews(entry).map((view) => view.path)) {
      const html = textOutput(outputs, route)!;
      if (countClass(html, "mbk-topbar") === 0) continue;
      checked += 1;
      assert.equal(countClass(html, "mbk-appearance"), 1, route);
    }
  }
  assert.ok(checked > 100, `only ${checked} artboards drew a top bar`);
});

test("the depicted Appearance control names the scheme it rendered for", async () => {
  const { outputs } = await designCatalogue;
  for (const entry of await designEntries(
    (entry) => entry.kind === "screen" && entry.path.startsWith("design/"),
    "appearance control artboards",
  )) {
    if (entry.kind !== "screen" || !entry.path.startsWith("design/")) continue;
    if (entry.path === "design/browse/appearance/states/auto") continue;
    for (const scheme of entry.colorSchemes) {
      const routes: string[] = generatedViews(entry)
        .filter((view) => view.colorScheme === scheme)
        .map((view) => view.path);
      for (const route of routes) {
        const html: string = textOutput(outputs, route)!;
        if (countClass(html, "mbk-topbar") === 0) continue;
        const selector = elements(parse(html), (node) =>
          (attribute(node, "class") ?? "")
            .split(/\s+/u)
            .includes("mbk-appearance"),
        )[0];
        assert.ok(selector, route);
        assert.equal(
          attribute(selector, "data-appearance-value"),
          scheme,
          route,
        );
      }
    }
  }
});
