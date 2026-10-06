import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DUAL_SCHEME_SAMPLES } from "../examples/basic/specs/design/library/metadata.js";
import { viewRoute } from "../packages/viewer/dist/data.js";
import { AppearanceSelect } from "../packages/viewer/dist/shell/appearance.js";

import { assertAbsent, entriesAt } from "./helpers/catalogue_selection.js";
import { componentVariants } from "./helpers/component_views.js";
import {
  attribute,
  designCatalogue,
  elements,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

/** Registered samples whose appearance is the subject of the sample itself. */
const dualSchemeComponents = [...DUAL_SCHEME_SAMPLES].map(
  (slug) => `design/library/chrome/${slug}`,
);
const previewScreens = [
  "design/browse/appearance/overview",
  "design/browse/appearance/states/auto",
  "design/browse/appearance/workspaces/props",
  "design/browse/appearance/workspaces/instance",
  "design/browse/appearance/status/loading",
  "design/browse/appearance/status/unavailable",
  "design/browse/appearance/workspaces/side-by-side",
  "design/browse/appearance/workspaces/difference",
  "design/browse/appearance/status/flow",
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
      entry.path.startsWith("design/browse/appearance/"),
  );
  assert.ok(screens.length > 0, "the appearance section exists");
  for (const entry of screens) {
    assert.ok(entry.kind === "screen");
    assert.ok(
      entry.colorSchemes.includes("dark"),
      `${entry.path} has no dark fragment, so the preview toggle cannot switch it`,
    );
    assert.deepEqual(entry.colorSchemes, ["light", "dark"]);
  }
});

test("each generated appearance variant draws the scheme it was rendered for", async () => {
  const { manifest, outputs } = await designCatalogue;
  const screens = manifest.entries.filter(
    (entry) =>
      entry.kind === "screen" &&
      entry.path.startsWith("design/browse/appearance/"),
  );
  for (const entry of screens) {
    assert.ok(entry.kind === "screen");
    for (const viewport of ["mobile", "desktop"] as const) {
      const light = textOutput(
        outputs,
        viewRoute(entry.path, viewport, "light"),
      );
      assert.ok(light, `${entry.path} ${viewport} light output`);
      assert.equal(appearanceOf(light), "light", `${entry.path} ${viewport}`);
      const darkRoute: string | undefined = entry.colorSchemes.includes("dark")
        ? viewRoute(entry.path, viewport, "dark")
        : undefined;
      assert.ok(darkRoute, `${entry.path} ${viewport} dark route`);
      const dark = textOutput(outputs, darkRoute);
      assert.ok(dark, `${entry.path} ${viewport} dark output`);
      assert.equal(appearanceOf(dark), "dark", `${entry.path} ${viewport}`);
    }
  }
});

test("the appearance-related registered samples render in both schemes", async () => {
  const { manifest, outputs } = await designCatalogue;
  for (const id of dualSchemeComponents) {
    const entry = manifest.entries.find((entry) => entry.path === id);
    assert.ok(entry?.kind === "component", id);
    for (const variant of componentVariants(manifest, id)) {
      assert.ok(
        variant.colorSchemes.includes("dark"),
        `${id}/${variant.path} has no dark sample`,
      );
      for (const viewport of ["mobile", "desktop"] as const) {
        const dark = textOutput(
          outputs,
          viewRoute(variant.path, viewport, "dark"),
        );
        assert.ok(dark, `${id}/${variant.path} ${viewport}`);
        assert.equal(appearanceOf(dark), "dark", `${id}/${variant.path}`);
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
    entry.path.startsWith("design/browse/appearance/")
      ? (["mobile", "desktop"] as const).flatMap((viewport) =>
          (["light", "dark"] as const).map((scheme) => ({
            id: entry.path,
            scheme,
            viewport,
            html: textOutput(outputs, viewRoute(entry.path, viewport, scheme))!,
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
    (view) => view.id === "design/browse/appearance/overview",
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

test("the Appearance selector reads Auto, or the scheme it rendered for", async () => {
  for (const view of await appearanceFragments()) {
    const selector = elements(parse(view.html), (node) =>
      (attribute(node, "class") ?? "").split(/\s+/u).includes("mbk-appearance"),
    )[0];
    assert.ok(selector, view.id);
    assert.equal(
      attribute(selector, "data-appearance-value"),
      view.id === "design/browse/appearance/states/auto" ? "auto" : view.scheme,
      `${view.id} ${view.viewport} ${view.scheme}`,
    );
  }
});

test("depicted previews follow the artboard's scheme", async () => {
  const { manifest } = await designCatalogue;
  const screens = entriesAt(manifest, previewScreens, "screen");
  const views = (await appearanceFragments()).filter((view) =>
    screens.some((screen) => screen.path === view.id),
  );
  for (const view of views) {
    const dark = countClass(view.html, "mbk-screen-dark");
    const where = `${view.id} ${view.viewport} ${view.scheme}`;
    if (view.scheme === "dark") assert.ok(dark > 0, `${where}: dark previews`);
    else assert.equal(dark, 0, `${where}: light previews`);
  }
});

test("the light-only subject keeps light frames and names its fallback under Dark", async () => {
  for (const view of await appearanceFragments()) {
    if (view.id !== "design/browse/appearance/states/light-only") continue;
    const where = `${view.viewport} ${view.scheme}`;
    assert.equal(
      countClass(view.html, "mbk-screen-dark"),
      0,
      `${where}: the screen has no dark render`,
    );
    assert.equal(
      countClass(view.html, "mbk-frame-scheme-note") > 0,
      view.scheme === "dark",
      `${where}: fallback caption only under Dark`,
    );
  }
});

test("the removed fixed-theme scenarios are gone", async () => {
  const { manifest } = await designCatalogue;
  for (const id of [
    "design/browse/appearance/states/light-preview",
    "design/browse/appearance/states/dark-preview",
  ])
    assertAbsent(manifest, id);
});

/** Canonical screens that replaced the removed head-band scheme depictions. */
const consolidatedScreens = [
  ["design/browse/views/screen", true],
  ["design/browse/views/details-screen", false],
  ["design/changes/outcomes/changed", true],
] as const;

test("the canonical scheme screens render in both schemes", async () => {
  const { manifest, outputs } = await designCatalogue;
  for (const [id, hasDarkRender] of consolidatedScreens) {
    const entry = manifest.entries.find((entry) => entry.path === id);
    assert.ok(entry?.kind === "screen", id);
    assert.ok(
      entry.colorSchemes.includes("dark"),
      `${id} has no dark fragment`,
    );
    for (const viewport of ["mobile", "desktop"] as const) {
      const light: string = textOutput(
        outputs,
        viewRoute(entry.path, viewport, "light"),
      )!;
      const dark: string = textOutput(
        outputs,
        viewRoute(entry.path, viewport, "dark"),
      )!;
      assert.equal(appearanceOf(light), "light", `${id} ${viewport}`);
      assert.equal(appearanceOf(dark), "dark", `${id} ${viewport}`);
      assert.equal(
        countClass(light, "mbk-screen-dark"),
        0,
        `${id} ${viewport}`,
      );
      assert.equal(
        countClass(dark, "mbk-screen-dark") > 0,
        hasDarkRender,
        `${id} ${viewport}: dark device treatment`,
      );
      assert.equal(
        countClass(dark, "mbk-frame-scheme-note") > 0,
        !hasDarkRender,
        `${id} ${viewport}: light-only caption`,
      );
    }
  }
});
