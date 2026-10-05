import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { SHELL_CSS } from "../packages/viewer/dist/shell/css.js";

import {
  darkTokenSelectors,
  flatCss,
  occurrences,
} from "./helpers/shell_assertions.js";
import {
  context,
  darkManifest,
  embeddedPage,
  homePage,
  manifest,
  notFoundPage,
  routePage,
} from "./helpers/shell_fixture.js";

test("dark scheme paints device screens and leaves the chrome light", () => {
  const css = flatCss(SHELL_CSS);
  const scope = '[data-preview-color-scheme="dark"] ';

  assert.ok(
    css.includes(
      `${scope}.phone-screen { background: var(--mbk-dark-screen-bg); }`,
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.phone-screen::after { content: ""; position: absolute; ` +
        "inset: 0; border-radius: inherit; " +
        "box-shadow: inset 0 0 0 1px color-mix(in srgb, " +
        "var(--mbk-dark-screen-ink) 12%, var(--mbk-dark-screen-bg)); " +
        "pointer-events: none; }",
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.phone-status { color: var(--mbk-dark-screen-ink); }`,
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.phone-home { background: color-mix(in srgb, ` +
        "var(--mbk-dark-screen-ink) 40%, transparent); }",
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.browser-viewport { background: var(--mbk-dark-screen-bg); }`,
    ),
  );
  assert.match(
    css,
    /\[data-preview-color-scheme="dark"\] \.mbk-frag \{[^}]*background: var\(--mbk-dark-screen-bg\);/,
  );

  const selectors = darkTokenSelectors(SHELL_CSS).map(flatCss);
  assert.equal(selectors.length, 9);
  for (const selector of selectors)
    assert.ok(selector.startsWith(scope), selector);
  assert.ok(
    css.includes(
      `${scope}.mb-pane-doc { background-color: var(--mbk-dark-screen-bg); }`,
    ),
  );

  assert.match(
    SHELL_CSS,
    /\.phone-screen \{[^}]*background: var\(--mbk-screen-bg\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.phone-status \{[^}]*color: var\(--mbk-screen-ink\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.phone-home \{[^}]*background: var\(--mbk-device-home\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.browser-viewport \{[^}]*background: var\(--mbk-screen-bg\);/,
  );
});

test("frame labels note a light-only screen only under a dark selection", () => {
  const css = flatCss(SHELL_CSS);
  assert.ok(
    css.includes(".mbk-frame-scheme-note { display: none; font-weight: 500; }"),
  );
  assert.ok(
    css.includes(
      'body[data-mokly-color-scheme="dark"] ' +
        ".mbk-frame-wrap[data-color-scheme-fallback] " +
        ".mbk-frame-scheme-note { display: inline; }",
    ),
  );
});

test("one scheme switch instance shows per side of the breakpoint", () => {
  const css = flatCss(SHELL_CSS);
  assert.ok(
    css.includes(
      ".mbk-screen-head > [data-mokly-schemeswitch] " +
        "{ display: none; margin-left: 0; }",
    ),
  );
  assert.ok(
    css.includes(
      "@media (max-width: 56.25rem) { " +
        ".mbk-topbar > [data-mokly-schemeswitch] { display: none; } " +
        ".mbk-screen-head > [data-mokly-schemeswitch] " +
        "{ display: inline-flex; } }",
    ),
  );
});

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
    routePage(dark, "example/screens/welcome/index.html"),
    routePage(dark, "example/tour/index.html"),
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
