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
      for (const foreground of [colors.text, colors.textMuted, colors.accent]) {
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
      colors.accentSolid,
    ])
      assert.ok(contrast(colors.onAccent, accent) >= 4.5);
    assert.ok(contrast(colors.accentSolid, colors.accentSoft) >= 3);
    for (const background of [colors.surface, colors.surfaceRaised])
      assert.ok(contrast(colors.accent, background) >= 4.5);
    for (const status of ["success", "warning", "danger", "info"] as const)
      assert.ok(
        contrast(
          colors[status],
          colors[(status + "Soft") as keyof typeof colors],
        ) >= 4.5,
      );
  }
});

test("CSS is derived from canonical tokens without stylesheet color copies", () => {
  for (const scheme of ["light", "dark"] as const)
    for (const viewport of ["mobile", "desktop"] as const) {
      const css = tokenCss(scheme, viewport);
      for (const [scope, base] of [
        ["paper", tokens.color[scheme].paper],
        ["folio", tokens.color[scheme].folio],
      ])
        assert.ok(
          css.includes("." + scope + "-scope{--mk-color-background:" + base),
          scope + " scope",
        );
      assert.ok(css.includes("--mk-font-display:" + tokens.font.display));
      for (const [key, value] of Object.entries(tokens.color[scheme])) {
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
    for (const [palette, { roles, scope }] of Object.entries(
      documentPalettes,
    )) {
      const colors = paletteColors(scheme, roles);
      const status = tokens.color[scheme];
      for (const background of [
        colors.background,
        colors.surfaceMuted,
        colors.surface,
      ]) {
        for (const foreground of [colors.text, colors.textMuted, status.accent])
          assert.ok(
            contrast(foreground, background) >= 4.5,
            scope + ": " + foreground + " on " + background,
          );
        for (const foreground of [colors.borderStrong, status.focus])
          assert.ok(
            contrast(foreground, background) >= 3,
            scope + ": " + foreground + " on " + background,
          );
      }
      // Every document carries the paper and Folio scopes; only a canvas
      // document carries the canvas scope.
      const document = palette === "canvas" ? "canvas" : "default";
      assert.ok(
        tokenCss(scheme, "desktop", document).includes(
          "." + scope + "{--mk-color-background:" + colors.background,
        ),
        scope,
      );
    }
});

test("only a canvas document carries the canvas scope, with the Canvas roles and type", () => {
  for (const scheme of ["light", "dark"] as const)
    for (const viewport of ["mobile", "desktop"] as const) {
      const shared = tokenCss(scheme, viewport);
      for (const palette of ["default", "paper", "folio"] as const)
        assert.equal(tokenCss(scheme, viewport, palette), shared, palette);
      assert.ok(!shared.includes(".canvas-scope"), scheme + " " + viewport);
      const document = tokenCss(scheme, viewport, "canvas");
      assert.ok(document.startsWith(shared), scheme + " " + viewport);
      const scope = document.slice(shared.length);
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
          scope.includes(property + ":" + value + ";"),
          scheme + " " + property,
        );
      assert.match(scope, /^\.canvas-scope\{[^{}]*\}$/);
    }
});

test("responsive tokens can be scoped without changing application output", () => {
  const application = responsiveTokenCss("light");
  assert.ok(application.startsWith(tokenCss("light", "desktop")));
  assert.ok(application.includes("@media (max-width:767.98px){:root{"));

  const selector = ':root[data-color-scheme="dark"]';
  const scoped = responsiveTokenCss("dark", selector);
  assert.ok(scoped.startsWith(selector + "{--mk-color-background:"));
  assert.ok(scoped.includes(selector + ".folio-scope,"));
  assert.ok(scoped.includes(selector + " .folio-scope{"));
  assert.ok(scoped.includes("@media (max-width:767.98px){" + selector + "{"));
  assert.ok(!scoped.includes(":root{--mk-color-background:"));
});
