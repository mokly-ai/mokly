import assert from "node:assert/strict";
import { test } from "node:test";

import postcss from "postcss";

import {
  documentPaletteStylesheet,
  themeStylesheet,
} from "../scripts/palette-styles.mjs";
import { palettes } from "../src/palette/palette.js";

/** The selector of the theme's Light block and of its preview-token block. */
const ROOT = ".mbk, .mbk-document";

/** The selector of the Dark block that Auto takes under a dark system. */
const AUTO_DARK =
  '.mbk[data-mokly-theme="auto"], .mbk-document[data-mokly-theme="auto"], .mbk-document:not([data-mokly-theme])';

/** The selector of the Dark block that an explicit choice takes. */
const EXPLICIT_DARK =
  '.mbk[data-mokly-theme="dark"], .mbk-document[data-mokly-theme="dark"]';

const GEIST =
  '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const GEIST_MONO =
  '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';

/**
 * The declarations of one rule of a stylesheet, by property, with each value
 * on one line: the rule with the given selector list, counted from the first.
 * A missing rule has no declarations.
 */
function declared(
  css: string,
  selector: string,
  index = 0,
): Map<string, string> {
  const blocks: Map<string, string>[] = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.selectors.join(", ") !== selector) return;
    const values = new Map<string, string>();
    rule.each((node) => {
      if (node.type === "decl")
        values.set(node.prop, node.value.replace(/\s+/gu, " "));
    });
    blocks.push(values);
  });
  return blocks[index] ?? new Map();
}

/**
 * Theme roles with their Light and Dark values: the Canvas values of the
 * viewer palette page, mixed and made translucent by hand where the page
 * says so.
 */
const ROLES: readonly (readonly [role: string, light: string, dark: string])[] =
  [
    // A Canvas role under its kebab-case name, and a person's colour.
    ["--cv-surface-raised", "#ffffff", "#232326"],
    ["--cv-signal-deep", "#067a45", "#5be3a0"],
    ["--cv-people-orange-ink", "#1f0e02", "#111113"],
    // Shell roles that take a Canvas role.
    ["--chrome-ink", "#0d1410", "#f4f4f5"],
    ["--chrome-raised", "#ffffff", "#1b1b1e"],
    ["--chrome-control-edge", "#626a64", "#71717a"],
    ["--_mokly-private-accent-default", "#067a45", "#5be3a0"],
    ["--_mokly-private-accent-contrast-default", "#ffffff", "#1b1b1e"],
    // text at 5% and textMuted at 32% over surface, mixed in sRGB.
    ["--chrome-hover", "#f3f3f3", "#262629"],
    ["--chrome-border-strong", "#cdcfcd", "#46464b"],
    // A role at an opacity, and the shade: text in Light, background in Dark.
    [
      "--chrome-count-bg",
      "rgba(13, 20, 16, 0.08)",
      "rgba(244, 244, 245, 0.08)",
    ],
    [
      "--mbk-accent-edge",
      "rgba(18, 183, 106, 0.45)",
      "rgba(34, 201, 125, 0.45)",
    ],
    ["--chrome-scrim", "rgba(13, 20, 16, 0.4)", "rgba(17, 17, 19, 0.4)"],
    // Shadows in the shade, where Dark adds a 1px ring in text.
    [
      "--chrome-shadow-soft",
      "0 1px 0 rgba(13, 20, 16, 0.03), 0 1px 2px rgba(13, 20, 16, 0.06)",
      "0 0 0 1px rgba(244, 244, 245, 0.03), 0 1px 2px rgba(17, 17, 19, 0.5)",
    ],
    [
      "--chrome-shadow-sheet",
      "0 -18px 40px -18px rgba(13, 20, 16, 0.28)",
      "0 -18px 40px -18px rgba(17, 17, 19, 0.6)",
    ],
    // Fixed roles without a Canvas source.
    ["--chrome-disabled-ink", "#5d6f63", "#a1a1aa"],
    [
      "--chrome-shadow-press",
      "inset 0 1px 2px rgba(20, 28, 22, 0.14)",
      "inset 0 1px 2px rgba(0, 0, 0, 0.55)",
    ],
    ["--mbk-status-removed-ink", "#9b433c", "#f1a99c"],
  ];

test("the theme takes each role of both appearances from the Canvas palette", () => {
  const theme = themeStylesheet(palettes.canvas);
  const light = declared(theme, ROOT);
  const darks = [
    ["Auto", declared(theme, AUTO_DARK)],
    ["explicit", declared(theme, EXPLICIT_DARK)],
  ] as const;
  for (const [role, lightValue, darkValue] of ROLES) {
    assert.equal(light.get(role), lightValue, `${role} in Light`);
    for (const [name, dark] of darks)
      assert.equal(dark.get(role), darkValue, `${role} in ${name} Dark`);
  }
});

test("the theme names Geist and Geist Mono once, in its Light block", () => {
  const theme = themeStylesheet(palettes.canvas);
  const light = declared(theme, ROOT);
  for (const role of ["--sans", "--cv-sans"])
    assert.equal(light.get(role), GEIST, role);
  for (const role of ["--mono", "--cv-mono"])
    assert.equal(light.get(role), GEIST_MONO, role);
  for (const selector of [AUTO_DARK, EXPLICIT_DARK])
    assert.deepEqual(
      [...declared(theme, selector).keys()].filter((role) =>
        /-(?:sans|mono)$/u.test(role),
      ),
      [],
      selector,
    );
});

test("the preview tokens keep their fixed values in a block that no appearance changes", () => {
  const theme = themeStylesheet(palettes.canvas);
  const preview = declared(theme, ROOT, 1);
  assert.equal(preview.get("--mbk-screen-bg"), "#ffffff");
  assert.equal(preview.get("--mbk-dark-screen-bg"), "#121514");
  assert.equal(preview.get("--mbk-device-home"), "rgba(20, 24, 20, 0.4)");
  for (const selector of [AUTO_DARK, EXPLICIT_DARK])
    assert.deepEqual(
      [...declared(theme, selector).keys()].filter((role) =>
        /^--mbk-(?:screen|dark-screen|device|highlight)-/u.test(role),
      ),
      [],
      selector,
    );
});

test("the document palette declares the colours and fonts of the Markdown documents", () => {
  const css = documentPaletteStylesheet(palettes.canvas);
  const light = declared(css, "html");
  const dark = declared(css, 'html[style*="dark"]');
  const colours = [
    ["--document-bg", "#f1f2ee", "#111113"],
    ["--document-surface", "#ffffff", "#1b1b1e"],
    ["--document-ink", "#0d1410", "#f4f4f5"],
    ["--document-border", "#e1e4de", "#2c2c31"],
    ["--document-accent", "#067a45", "#5be3a0"],
  ] as const;
  for (const [role, lightValue, darkValue] of colours) {
    assert.equal(light.get(role), lightValue, `${role} in Light`);
    assert.equal(dark.get(role), darkValue, `${role} in Dark`);
  }
  assert.equal(light.get("--document-sans"), GEIST);
  assert.equal(light.get("--document-mono"), GEIST_MONO);
  // The part declares custom properties only, and Dark restates the colours.
  assert.deepEqual(
    [...light.keys()].sort(),
    [
      ...colours.map(([role]) => role),
      "--document-mono",
      "--document-sans",
    ].sort(),
  );
  assert.deepEqual(
    [...dark.keys()].sort(),
    colours.map(([role]) => role).sort(),
  );
});
