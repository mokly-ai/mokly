import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { defaultSharedUiTheme } from "@firna/ui/theme";
import type { SharedUiColors } from "@firna/ui/theme";
import { documentPalettes } from "@mokly-cloud/tokens/palettes";
import type { PaletteRoles } from "@mokly-cloud/tokens/palettes";
import {
  paletteUiTheme,
  pillUiTheme,
  sharedUiColors,
  sharedUiThemes,
  staticUiTheme,
} from "@mokly-cloud/tokens/shared-ui-theme";
import { tokens } from "@mokly-cloud/tokens/tokens";

import { palettes } from "@mokly/ui/palette";

import { contrast } from "./color-metrics";

const paletteRoles = [
  ...new Set(Object.values(documentPalettes).map((palette) => palette.roles)),
];

/**
 * The surface families whose values the token table holds. The canvas
 * family reads the Canvas palette of `@mokly/ui` instead, so its own test
 * below holds its mapping.
 */
const tokenFamilies = paletteRoles.filter((roles) => roles !== "canvas");

test("all Firna color roles follow the documented mapping in both schemes", () => {
  // The mapping table lives in the tokens README, the home of the theme's
  // code references; the protocol doc states only which roles feed the fill
  // and the ink.
  const mapping = readFileSync(
    new URL("../../../../packages/tokens/README.md", import.meta.url),
    "utf8",
  );
  const rows = [
    ...mapping.matchAll(/\| (`(?:\w+)`(?:, `\w+`)*)\s*\| `(\w+)`\s*\|/g),
  ];
  for (const scheme of ["light", "dark"] as const)
    for (const palette of tokenFamilies) {
      const colors = sharedUiColors(scheme, palette);
      const checked: string[] = [];
      for (const [, roles, token] of rows) {
        const source = token.startsWith("paper")
          ? palette + token.slice("paper".length)
          : token;
        for (const role of roles.matchAll(/`(\w+)`/g)) {
          const key = role[1] as keyof SharedUiColors;
          if (!(key in colors)) continue;
          assert.equal(
            colors[key],
            tokens.color[scheme][source as keyof typeof tokens.color.light],
            key + " from " + source,
          );
          checked.push(key);
        }
      }
      assert.deepEqual(
        checked.sort(),
        Object.keys(defaultSharedUiTheme.colors).sort(),
      );
      assert.deepEqual(Object.keys(colors).sort(), checked);
    }
  assert.deepEqual(sharedUiColors("light"), sharedUiColors("light", "paper"));
});

test("canvas controls take their surfaces and accent from the Canvas palette", () => {
  for (const scheme of ["light", "dark"] as const) {
    const canvas = palettes.canvas[scheme];
    const shared = tokens.color[scheme];
    assert.deepEqual(sharedUiColors(scheme, "canvas"), {
      amber: shared.warning,
      amberDeep: shared.warning,
      amberSoft: shared.warningSoft,
      bg: canvas.background,
      bg2: canvas.surfaceMuted,
      border: canvas.border,
      border2: canvas.border,
      controlBorder: canvas.borderStrong,
      faint: canvas.textMuted,
      ink: canvas.text,
      ink2: canvas.text,
      muted: canvas.textMuted,
      onSolid: canvas.onSignalFill,
      placeholder: canvas.textMuted,
      primary: canvas.signalFill,
      primaryBorder: canvas.signalSoft,
      primaryDeep: canvas.signalDeep,
      primarySoft: canvas.signalSoft,
      rose: shared.danger,
      roseDeep: shared.danger,
      roseSoft: shared.dangerSoft,
      soft: canvas.surfaceMuted,
      surface: canvas.surface,
    });
  }
});

test("every palette's controls retain readable text, state colors and boundaries", () => {
  for (const scheme of ["light", "dark"] as const)
    for (const palette of paletteRoles) {
      const c = sharedUiColors(scheme, palette);
      for (const bg of [c.bg, c.bg2, c.surface, c.soft]) {
        for (const text of [c.ink, c.muted, c.placeholder, c.primaryDeep])
          assert.ok(contrast(text, bg) >= 4.5, text + " on " + bg);
        assert.ok(contrast(c.controlBorder, bg) >= 3);
      }
    }
});

test("paper controls retain readable state pairs on solid fills", () => {
  for (const scheme of ["light", "dark"] as const) {
    const c = sharedUiColors(scheme);
    for (const bg of [c.bg, c.bg2, c.surface, c.soft]) {
      for (const text of [c.ink, c.muted, c.placeholder, c.primaryDeep])
        assert.ok(contrast(text, bg) >= 4.5, text + " on " + bg);
      assert.ok(contrast(c.controlBorder, bg) >= 3);
    }
    for (const [ink, soft] of [
      [c.primaryDeep, c.primarySoft],
      [c.amberDeep, c.amberSoft],
      [c.roseDeep, c.roseSoft],
      [c.ink2, c.soft],
    ]) {
      assert.ok(contrast(ink, soft) >= 4.5);
      assert.ok(contrast(c.onSolid, ink) >= 4.5);
    }
    assert.ok(contrast(c.onSolid, c.primary) >= 4.5);
  }
});

test("dark presets, type roles, static focus and header radius survive theme derivation", () => {
  for (const scheme of ["light", "dark"] as const) {
    const theme = sharedUiThemes[scheme];
    assert.equal(theme.scheme, scheme);
    assert.equal(theme.fonts.sans, tokens.font.sans);
    assert.equal(theme.fonts.mono, tokens.font.mono);
    assert.equal(theme.focusIndicator, "ring");
    assert.equal(theme.radii.md, 10);
    assert.equal(theme.radii.avatarRatio, 0.25);
    assert.deepEqual(staticUiTheme(scheme), {
      ...theme,
      focusIndicator: "outline",
    });
    assert.deepEqual(staticUiTheme(scheme, "paper"), {
      ...theme,
      focusIndicator: "outline",
    });
    assert.deepEqual(pillUiTheme(staticUiTheme(scheme)), {
      ...theme,
      focusIndicator: "outline",
      radii: { ...theme.radii, md: 999 },
    });
  }
  assert.notDeepEqual(sharedUiThemes.dark.charts, sharedUiThemes.light.charts);
});

test("each retained palette derives its surfaces and control geometry", () => {
  const expected = { paper: 10, folio: 8, canvas: 8 };
  const sans = {
    paper: tokens.font.sans,
    folio: tokens.font.sans,
    canvas: palettes.canvas.fonts.sans,
  };
  for (const scheme of ["light", "dark"] as const)
    for (const [palette, { roles }] of Object.entries(documentPalettes)) {
      const derived = paletteUiTheme(scheme, palette as "paper");
      assert.deepEqual(
        derived.colors,
        sharedUiColors(scheme, roles as PaletteRoles),
      );
      assert.equal(
        derived.radii.md,
        expected[palette as keyof typeof expected] ?? 10,
      );
      assert.equal(derived.fonts.sans, sans[palette as keyof typeof sans]);
      assert.equal(derived.scheme, scheme);
    }
});
