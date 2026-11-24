import assert from "node:assert/strict";
import { test } from "node:test";

import { responsiveTokenCss, tokenCss } from "@mokly-cloud/tokens/token-css";
import { tokens } from "@mokly-cloud/tokens/tokens";

import { siteStyles } from "./design-site-test-helpers";

test("site-specific type and layout roles are canonical workspace tokens", () => {
  assert.deepEqual(tokens.type.nano, {
    mobile: ["0.625rem", "0.875rem"],
    desktop: ["0.625rem", "0.875rem"],
    weight: 500,
  });
  assert.deepEqual(tokens.type.hero, {
    mobile: ["2.75rem", "3rem"],
    desktop: ["4rem", "4.25rem"],
    weight: 600,
  });
  assert.deepEqual(
    {
      siteDocument: tokens.layout.siteDocument,
      siteOnPage: tokens.layout.siteOnPage,
      sitePolicy: tokens.layout.sitePolicy,
      siteRailBreakpoint: tokens.layout.siteRailBreakpoint,
      siteSidebar: tokens.layout.siteSidebar,
      siteStageDesktop: tokens.layout.siteStageDesktop,
      siteStageMobile: tokens.layout.siteStageMobile,
      siteWide: tokens.layout.siteWide,
    },
    {
      siteDocument: "768px",
      siteOnPage: "240px",
      sitePolicy: "840px",
      siteRailBreakpoint: "1100px",
      siteSidebar: "272px",
      siteStageDesktop: "624px",
      siteStageMobile: "520px",
      siteWide: "1360px",
    },
  );
});

test("every token consumed by site mockups is emitted by the workspace", () => {
  const css = siteStyles();
  const used = new Set(
    [...css.matchAll(/var\((--mk-[\w-]+)/g)].map((match) => match[1]!),
  );
  assert.ok(used.size > 40, "site policy stopped covering the token surface");
  for (const scheme of ["light", "dark"] as const)
    for (const viewport of ["mobile", "desktop"] as const) {
      const emitted = tokenCss(scheme, viewport);
      for (const property of used)
        assert.ok(
          emitted.includes(property + ":"),
          `${scheme}/${viewport}: ${property}`,
        );
    }
});

test("the responsive emitter keeps legacy root output and scopes complete themes", () => {
  for (const scheme of ["light", "dark"] as const) {
    const legacy = responsiveTokenCss(scheme);
    assert.ok(legacy.startsWith(tokenCss(scheme, "desktop")));
    const selector = `:root[data-color-scheme="${scheme}"]`;
    const scoped = responsiveTokenCss(scheme, selector);
    for (const role of [
      "--mk-color-background",
      "--mk-color-surface",
      "--mk-type-hero-size",
      "--mk-layout-site-wide",
    ])
      assert.ok(scoped.includes(role + ":"), `${scheme}: ${role}`);
    assert.ok(scoped.includes(selector + ".paper-scope,"));
    assert.ok(scoped.includes(selector + " .paper-scope{"));
    assert.ok(scoped.includes("@media (max-width:767.98px){" + selector));
  }
});

test("site mockup CSS contains no parallel tokens or literal colors", () => {
  const css = siteStyles();
  assert.doesNotMatch(css, /--site-/);
  assert.doesNotMatch(css, /--mk-[\w-]+\s*:/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/i);
  for (const value of css.matchAll(/^\s*[\w-]+:\s*([^;]+);/gm))
    assert.doesNotMatch(
      value[1] ?? "",
      /(?<![\w-])(?:aqua|black|blue|brown|fuchsia|gold|gray|green|grey|lime|maroon|navy|olive|orange|pink|purple|red|silver|teal|violet|white|yellow)(?![\w-])/i,
    );
});

test("site styles use semantic mk roles without aliases", () => {
  const css = siteStyles();
  assert.doesNotMatch(css, /--site-/);
  assert.doesNotMatch(css, /--mk-[\w-]+\s*:/);
  // Roles of the shared sheets: the canvas, the surfaces, the control
  // boundary, the filled button pair, the signal and a person's colour.
  for (const role of [
    "--mk-color-background",
    "--mk-color-surface-muted",
    "--mk-color-border-strong",
    "--mk-color-signal-fill",
    "--mk-color-on-signal-fill",
    "--mk-color-dot",
    "--mk-color-signal",
    "--mk-color-people-pink-fill",
    "--mk-layout-site-policy",
  ])
    assert.ok(css.includes(`var(${role})`), role);
});
