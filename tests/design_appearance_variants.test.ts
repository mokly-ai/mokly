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
const previewScreens = [
  "design-appearance-overview",
  "design-appearance-auto",
  "design-appearance-props",
  "design-appearance-instance",
  "design-appearance-loading",
  "design-appearance-unavailable",
  "design-appearance-side-by-side",
  "design-appearance-difference",
  "design-appearance-flow",
];

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

test("the Appearance selector reads Auto, or the scheme it rendered for", async () => {
  for (const view of await appearanceFragments()) {
    const selector = elements(parse(view.html), (node) =>
      (attribute(node, "class") ?? "").split(/\s+/u).includes("mbk-appearance"),
    )[0];
    assert.ok(selector, view.id);
    assert.equal(
      attribute(selector, "data-appearance-value"),
      view.id === "design-appearance-auto" ? "auto" : view.scheme,
      `${view.id} ${view.viewport} ${view.scheme}`,
    );
  }
});

test("depicted previews follow the artboard's scheme", async () => {
  for (const view of await appearanceFragments()) {
    if (!previewScreens.includes(view.id)) continue;
    const dark = countClass(view.html, "mbk-screen-dark");
    const where = `${view.id} ${view.viewport} ${view.scheme}`;
    if (view.scheme === "dark") assert.ok(dark > 0, `${where}: dark previews`);
    else assert.equal(dark, 0, `${where}: light previews`);
  }
});

test("the light-only subject keeps light frames and names its fallback under Dark", async () => {
  for (const view of await appearanceFragments()) {
    if (view.id !== "design-appearance-light-only") continue;
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
    "design-appearance-light-preview",
    "design-appearance-dark-preview",
  ])
    assert.equal(
      manifest.entries.find((entry) => entry.id === id),
      undefined,
      id,
    );
});

/** Canonical screens that replaced the removed head-band scheme depictions. */
const consolidatedScreens = [
  ["design-browse-screen", true],
  ["design-browse-details-screen", false],
  ["design-review-changed", true],
] as const;

test("the canonical scheme screens render in both schemes", async () => {
  const { manifest, outputs } = await designCatalogue;
  for (const [id, hasDarkRender] of consolidatedScreens) {
    const entry = manifest.entries.find((entry) => entry.id === id);
    assert.ok(entry?.kind === "screen", id);
    assert.ok(entry.darkFragments, `${id} has no dark fragment`);
    for (const viewport of ["mobile", "desktop"] as const) {
      const light: string = textOutput(outputs, entry.fragments[viewport])!;
      const dark: string = textOutput(outputs, entry.darkFragments[viewport]!)!;
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

test("no design artboard depicts a scheme control", async () => {
  const { manifest, outputs } = await designCatalogue;
  for (const entry of manifest.entries) {
    if (entry.kind !== "screen" || !entry.route.startsWith("design/")) continue;
    for (const route of [
      ...Object.values(entry.fragments),
      ...Object.values(entry.darkFragments ?? {}),
    ]) {
      const html = textOutput(outputs, route)!;
      assert.equal(countClass(html, "ce-theme-control"), 0, route);
      assert.equal(countClass(html, "ce-theme-toggle"), 0, route);
    }
  }
});

test("the consolidated head-band scheme screens are gone", async () => {
  const { manifest } = await designCatalogue;
  for (const id of [
    "design-browse-dark-scheme",
    "design-browse-light-only",
    "design-review-dark-scheme",
  ])
    assert.equal(
      manifest.entries.find((entry) => entry.id === id),
      undefined,
      id,
    );
});

test("every artboard with a top bar draws one Appearance control", async () => {
  const { manifest, outputs } = await designCatalogue;
  let checked = 0;
  for (const entry of manifest.entries) {
    if (entry.kind !== "screen" || !entry.route.startsWith("design/")) continue;
    for (const route of [
      ...Object.values(entry.fragments),
      ...Object.values(entry.darkFragments ?? {}),
    ]) {
      const html = textOutput(outputs, route)!;
      if (countClass(html, "mbk-topbar") === 0) continue;
      checked += 1;
      assert.equal(countClass(html, "mbk-appearance"), 1, route);
    }
  }
  assert.ok(checked > 100, `only ${checked} artboards drew a top bar`);
});

test("the depicted Appearance control names the scheme it rendered for", async () => {
  const { manifest, outputs } = await designCatalogue;
  for (const entry of manifest.entries) {
    if (entry.kind !== "screen" || !entry.route.startsWith("design/")) continue;
    if (entry.id === "design-appearance-auto") continue;
    for (const [scheme, routes] of [
      ["light", entry.fragments],
      ["dark", entry.darkFragments ?? {}],
    ] as const) {
      for (const route of Object.values(routes)) {
        const html = textOutput(outputs, route)!;
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
