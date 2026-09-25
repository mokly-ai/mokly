import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import {
  attribute,
  designCatalogue,
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

test("retained Welcome variants follow the single Appearance setting", async () => {
  const { manifest, outputs } = await designCatalogue;
  for (const [id, darkDevice] of [
    ["design-browse-dark-scheme", true],
    ["design-browse-light-only", false],
  ] as const) {
    const entry = manifest.entries.find((candidate) => candidate.id === id);
    assert.ok(entry?.kind === "screen", id);
    assert.equal(entry.variantOf, "design-browse-screen", id);
    assert.ok(entry.darkFragments, `${id}: dark artboard missing`);
    for (const viewport of ["mobile", "desktop"] as const) {
      const light = textOutput(outputs, entry.fragments[viewport]);
      const dark = textOutput(outputs, entry.darkFragments[viewport]!);
      assert.ok(light && dark, `${id}/${viewport}: both schemes generated`);
      assert.equal(appearanceOf(light), "light", `${id}/${viewport}`);
      assert.equal(appearanceOf(dark), "dark", `${id}/${viewport}`);
      assert.equal(countClass(light, "mbk-screen-dark"), 0);
      assert.equal(countClass(dark, "mbk-screen-dark") > 0, darkDevice);
      assert.equal(countClass(dark, "mbk-frame-scheme-note") > 0, !darkDevice);
    }
  }
  assert.equal(
    manifest.entries.find((entry) => entry.id === "design-review-dark-scheme"),
    undefined,
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
