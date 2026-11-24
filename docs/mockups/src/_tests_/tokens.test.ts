import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { documentPalettes, paletteColors } from "@mokly-cloud/tokens/palettes";
import { responsiveTokenCss, tokenCss } from "@mokly-cloud/tokens/token-css";
import { tokens } from "@mokly-cloud/tokens/tokens";

import { palettes } from "@mokly/ui/palette";

import { contrast } from "./color-metrics";

test("prescribed text, status, control and focus combinations meet contrast requirements", () => {
  assert.equal(contrast("#ffffff", "#ffffff"), 1);
  assert.ok(contrast("#ffffff", "#000000") >= 21);
  for (const colors of Object.values(tokens.color)) {
    for (const background of [
      colors.background,
      colors.surface,
      colors.surfaceRaised,
      colors.surfaceMuted,
    ]) {
      for (const foreground of [
        colors.text,
        colors.textSecondary,
        colors.textMuted,
        colors.accent,
        colors.accentHover,
        colors.accentActive,
      ]) {
        assert.ok(
          contrast(foreground, background) >= 4.5,
          foreground + " on " + background,
        );
      }
    }
    for (const background of [
      colors.paper,
      colors.paperMuted,
      colors.paperSurface,
      colors.accentSoft,
    ]) {
      for (const foreground of [
        colors.paperInk,
        colors.paperInkMuted,
        colors.accent,
      ]) {
        assert.ok(
          contrast(foreground, background) >= 4.5,
          foreground + " on " + background,
        );
      }
    }
    for (const background of [
      colors.artSage,
      colors.artMint,
      colors.artOlive,
    ]) {
      for (const foreground of [colors.paperInk, colors.paperInkMuted]) {
        assert.ok(
          contrast(foreground, background) >= 4.5,
          foreground + " on " + background,
        );
      }
    }
    for (const background of [
      colors.paper,
      colors.paperMuted,
      colors.paperSurface,
    ]) {
      for (const foreground of [colors.paperLineStrong, colors.focus]) {
        assert.ok(
          contrast(foreground, background) >= 3,
          foreground + " on " + background,
        );
      }
    }
    for (const background of [colors.background, colors.surface]) {
      for (const foreground of [colors.borderStrong, colors.focus])
        assert.ok(contrast(foreground, background) >= 3);
    }
    for (const accent of [
      colors.accent,
      colors.accentHover,
      colors.accentActive,
    ])
      for (const background of [
        colors.background,
        colors.surface,
        colors.accentSoft,
      ])
        assert.ok(contrast(accent, background) >= 4.5);
    assert.ok(contrast(colors.onAccent, colors.accentSolid) >= 3);
    assert.ok(contrast(colors.accentSolid, colors.accentSoft) >= 3);
    for (const background of [colors.surface, colors.surfaceRaised])
      assert.ok(contrast(colors.accent, background) >= 4.5);
    for (const [status, soft] of [
      ["success", "successSoft"],
      ["warning", "warningSoft"],
      ["danger", "dangerSoft"],
      ["info", "infoSoft"],
    ] as const)
      assert.ok(contrast(colors[status], colors[soft]) >= 4.5);
  }
});

test("CSS is derived from canonical tokens without stylesheet color copies", () => {
  for (const scheme of ["light", "dark"] as const)
    for (const viewport of ["mobile", "desktop"] as const) {
      const css = tokenCss(scheme, viewport);
      assert.ok(
        css.includes(
          ".paper-scope{--mk-color-background:" + tokens.color[scheme].paper,
        ),
      );
      assert.ok(css.includes("--mk-font-display:" + tokens.font.display));
      const colors = Object.entries(tokens.color[scheme]).flatMap(
        ([key, value]) =>
          typeof value === "string"
            ? [[key, value]]
            : Object.entries(value).flatMap(([person, roles]) =>
                Object.entries(roles).map(([role, color]) => [
                  key + "-" + person + "-" + role,
                  color,
                ]),
              ),
      );
      for (const [key, value] of colors) {
        const variable =
          "--mk-color-" +
          key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
        assert.ok(css.includes(variable + ":" + value + ";"));
      }
      assert.ok(
        css.includes(
          "--mk-type-display-size:" + tokens.type.display[viewport][0],
        ),
      );
    }
  const directory = resolve(import.meta.dirname, "../../styles");
  for (const file of readdirSync(directory, {
    recursive: true,
    encoding: "utf8",
  }).filter((path) => path.endsWith(".css"))) {
    const css = readFileSync(resolve(directory, file), "utf8");
    assert.ok(
      !/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/i.test(css),
      file + " duplicates a color value",
    );
    assert.ok(
      !/--mk-[\w-]+\s*:/.test(css),
      file + " duplicates a token definition",
    );
  }
});

test("every document family keeps text, focus and boundaries legible", () => {
  for (const scheme of ["light", "dark"] as const)
    for (const palette of ["default", "paper"] as const) {
      const colors = paletteColors(scheme, palette);
      const status = tokens.color[scheme];
      for (const background of [
        colors.background,
        colors.surfaceMuted,
        colors.surface,
      ]) {
        for (const foreground of [colors.text, colors.textMuted, status.accent])
          assert.ok(
            contrast(foreground, background) >= 4.5,
            palette + ": " + foreground + " on " + background,
          );
        for (const foreground of [colors.borderStrong, status.focus])
          assert.ok(
            contrast(foreground, background) >= 3,
            palette + ": " + foreground + " on " + background,
          );
      }
      const selector =
        palette === "default" ? ":root" : "." + documentPalettes.paper.scope;
      assert.ok(
        tokenCss(scheme, "desktop").includes(
          selector + "{--mk-color-background:" + colors.background,
        ),
        palette,
      );
    }
});

test("all documents carry Canvas roles and fonts on the root with only a paper scope", () => {
  for (const scheme of ["light", "dark"] as const)
    for (const viewport of ["mobile", "desktop"] as const) {
      const document = tokenCss(scheme, viewport);
      const root = document.slice(0, document.indexOf("}") + 1);
      const canvas = palettes.canvas[scheme];
      for (const [property, value] of [
        ["--mk-color-background", canvas.background],
        ["--mk-color-surface-muted", canvas.surfaceMuted],
        ["--mk-color-border-strong", canvas.borderStrong],
        ["--mk-color-accent", canvas.signalDeep],
        ["--mk-color-accent-solid", canvas.signalFill],
        ["--mk-color-on-accent", canvas.onSignalFill],
        ["--mk-color-dot", canvas.dot],
        ["--mk-color-signal", canvas.signal],
        ["--mk-color-text-secondary", canvas.textSecondary],
        ["--mk-color-people-orange-ink", canvas.people.orange.ink],
        ["--mk-font-sans", palettes.canvas.fonts.sans],
        ["--mk-font-mono", palettes.canvas.fonts.mono],
      ])
        assert.ok(
          root.includes(property + ":" + value + ";"),
          scheme + " " + property,
        );
      assert.match(root, /^:root\{[^{}]*\}$/);
      assert.match(document.slice(root.length), /^\.paper-scope\{[^{}]*\}$/);
      assert.doesNotMatch(document, /\.(?:folio|canvas)-scope/);
    }
});

test("responsive tokens can be scoped without changing application output", () => {
  const application = responsiveTokenCss("light");
  assert.ok(application.startsWith(tokenCss("light", "desktop")));
  assert.ok(application.includes("@media (max-width:767.98px){:root{"));

  const selector = ':root[data-color-scheme="dark"]';
  const scoped = responsiveTokenCss("dark", selector);
  assert.ok(scoped.startsWith(selector + "{--mk-color-background:"));
  assert.ok(scoped.includes(selector + ".paper-scope,"));
  assert.ok(scoped.includes(selector + " .paper-scope{"));
  assert.doesNotMatch(scoped, /\.(?:folio|canvas)-scope/);
  assert.ok(scoped.includes("@media (max-width:767.98px){" + selector + "{"));
  assert.ok(!scoped.includes(":root{--mk-color-background:"));
});
