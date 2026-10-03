import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { SHELL_CSS } from "../packages/viewer/dist/shell/css.js";

import {
  context,
  darkManifest,
  embeddedPage,
  homePage,
  manifest,
  notFoundPage,
  occurrences,
  routePage,
} from "./helpers/shell_fixture.js";

test("a full document states its appearance and starts it before styles", () => {
  const catalogue = createCatalogue(manifest);
  for (const theme of ["light", "dark", "auto"] as const) {
    const html = homePage(catalogue, { ...context, theme });
    assert.match(
      html,
      new RegExp(`<html[^>]*data-mokly-theme="${theme}"`),
      theme,
    );
    assert.match(html, /<html[^>]*data-mokly-appearance=""/);
    assert.ok(
      html.indexOf("appearance-startup.js") < html.indexOf('rel="stylesheet"'),
      "the startup asset is requested after the stylesheet",
    );
  }
});

test("an omitted or unusable standalone theme renders Auto", () => {
  const catalogue = createCatalogue(manifest);
  for (const theme of [undefined, "sideways" as never])
    assert.match(
      homePage(catalogue, { ...context, ...(theme ? { theme } : {}) }),
      /<html[^>]*data-mokly-theme="auto"/,
      String(theme),
    );
});

test("standalone documents offer Appearance instead of preview switches", () => {
  const light = createCatalogue(manifest);
  const dark = createCatalogue(darkManifest);
  for (const [name, catalogue] of [
    ["light-only", light],
    ["dual-scheme", dark],
  ] as const) {
    const html = homePage(catalogue, context);
    assert.equal(occurrences(html, "data-mokly-appearance-select"), 1, name);
    assert.match(html, /aria-label="Appearance"/, name);
    for (const option of ["Auto", "Light", "Dark"])
      assert.match(
        html,
        new RegExp(`<option value="${option.toLowerCase()}"`),
        `${name} ${option}`,
      );
    assert.equal(html.includes("data-mokly-schemeswitch"), false, name);
    assert.equal(html.includes("data-workspace-scheme"), false, name);
  }
  for (const html of [
    notFoundPage("view/unknown.html", light, context),
    routePage(dark, "screens/welcome.html"),
    routePage(dark, "user-flows/tour.html"),
  ])
    assert.equal(occurrences(html, "data-mokly-appearance-select"), 1);
});

test("the Appearance selector carries every face and starts hidden", () => {
  const html = homePage(createCatalogue(manifest), context);
  for (const option of ["auto", "light", "dark"])
    assert.equal(
      occurrences(html, `data-appearance-option="${option}"`),
      1,
      option,
    );
  assert.match(html, /class="mbk-appearance"[^>]*data-appearance-value="auto"/);
  assert.match(html, /class="mbk-appearance"[^>]*hidden=""/);
  assert.match(SHELL_CSS, /\.mbk-appearance-option \{\s*display: none;/);
  assert.match(
    SHELL_CSS,
    /\.mbk-appearance\[data-appearance-value="dark"\] > \[data-appearance-option="dark"\]/,
  );
  assert.match(SHELL_CSS, /\.mbk-appearance\[hidden\] \{[^}]*display: none;/);
});

test("an embedded root keeps independent preview controls", () => {
  const html = embeddedPage(createCatalogue(darkManifest), null);
  assert.equal(html.includes("data-mokly-appearance-select"), false);
  assert.equal(occurrences(html, "data-mokly-schemeswitch"), 1);
});
