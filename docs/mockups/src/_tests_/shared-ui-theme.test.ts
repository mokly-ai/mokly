import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { defaultSharedUiTheme } from "@firna/ui/theme";
import { documentPalettes, paletteColors } from "@mokly-cloud/tokens/palettes";
import {
  paletteUiTheme,
  pillUiTheme,
  primaryActionUiTheme,
  quietOnMutedUiTheme,
  sharedUiColors,
  sharedUiThemes,
  staticUiTheme,
} from "@mokly-cloud/tokens/shared-ui-theme";
import { tokens } from "@mokly-cloud/tokens/tokens";

import { palettes } from "@mokly/ui/palette";

import { contrast } from "./color-metrics";
import { solidBadgeFiles } from "./solid-badge-sources";

const paletteRoles = [
  "default" as const,
  ...Object.values(documentPalettes).map((palette) => palette.roles),
];

const paperSources: Readonly<Record<string, string>> = {
  background: "paper",
  surface: "paperSurface",
  surfaceRaised: "paperSurface",
  surfaceMuted: "paperMuted",
  text: "paperInk",
  textSecondary: "paperInkMuted",
  textMuted: "paperInkMuted",
  border: "paperLine",
  borderStrong: "paperLineStrong",
};

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
    for (const palette of paletteRoles) {
      const colors: Record<string, string> = sharedUiColors(scheme, palette);
      const source: Record<string, unknown> = tokens.color[scheme];
      const checked: string[] = [];
      for (const [, roles, token] of rows) {
        const name =
          palette === "paper" ? (paperSources[token] ?? token) : token;
        for (const role of roles.matchAll(/`(\w+)`/g)) {
          const key = role[1];
          if (!(key in colors)) continue;
          assert.equal(colors[key], source[name], key + " from " + name);
          checked.push(key);
        }
      }
      assert.deepEqual(
        checked.sort(),
        Object.keys(defaultSharedUiTheme.colors).sort(),
      );
      assert.deepEqual(Object.keys(colors).sort(), checked);
    }
  assert.deepEqual(sharedUiColors("light"), sharedUiColors("light", "default"));
});

test("default controls take their surfaces and accent from the Canvas palette", () => {
  for (const scheme of ["light", "dark"] as const) {
    const canvas = palettes.canvas[scheme];
    const shared = tokens.color[scheme];
    assert.deepEqual(sharedUiColors(scheme), {
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
    const c = sharedUiColors(scheme, "paper");
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
      if (scheme === "light") assert.ok(contrast(c.onSolid, ink) >= 4.5);
    }
    // The white label of decision 4 cannot reach 4.5:1 on Firna's light dark-scheme solid fills.
    if (scheme === "dark")
      assert.deepEqual(
        ["packages/app/src", "docs/mockups/src"].flatMap((directory) =>
          solidBadgeFiles(
            resolve(import.meta.dirname, "../../../..", directory),
          ),
        ),
        [],
      );
    assert.ok(contrast(c.onSolid, c.primary) >= 3);
  }
});

test("dark presets, type roles, static focus and header radius survive theme derivation", () => {
  for (const scheme of ["light", "dark"] as const) {
    const theme = sharedUiThemes[scheme];
    assert.equal(theme.scheme, scheme);
    assert.equal(theme.fonts.sans, tokens.font.sans);
    assert.equal(theme.fonts.mono, tokens.font.mono);
    assert.equal(theme.focusIndicator, "ring");
    assert.equal(theme.radii.md, 8);
    assert.equal(theme.radii.avatarRatio, 0.25);
    assert.deepEqual(staticUiTheme(scheme), {
      ...theme,
      focusIndicator: "outline",
    });
    assert.deepEqual(staticUiTheme(scheme, "paper"), {
      ...paletteUiTheme(scheme, "paper"),
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
  const expected = {
    default: { md: 8, lg: 10 },
    paper: { md: 10, lg: 16 },
  };
  for (const scheme of ["light", "dark"] as const)
    for (const palette of paletteRoles) {
      const derived = paletteUiTheme(scheme, palette);
      assert.deepEqual(derived.colors, sharedUiColors(scheme, palette));
      assert.equal(derived.radii.md, expected[palette].md);
      assert.equal(derived.radii.lg, expected[palette].lg);
      assert.equal(derived.fonts.sans, tokens.font.sans);
      assert.equal(derived.scheme, scheme);
    }
});

test("primary action themes keep the resting fill on hover in both families and schemes", () => {
  for (const scheme of ["light", "dark"] as const)
    for (const palette of paletteRoles) {
      const base = paletteUiTheme(scheme, palette);
      const expected = {
        ...base,
        colors: { ...base.colors, primaryDeep: base.colors.primary },
      };
      const action = primaryActionUiTheme(base);
      assert.equal(action.colors.primaryDeep, action.colors.primary);
      assert.ok(contrast(action.colors.onSolid, action.colors.primary) >= 3);
      assert.deepEqual(action, expected);
      assert.equal(base.colors.primaryDeep, tokens.color[scheme].signalDeep);
    }
});

test("a quiet Button on the muted surface hovers on the ink at 5% and presses on it at 7%", () => {
  // The Canvas ink over `surfaceMuted`, mixed by hand in sRGB.
  const washes = {
    light: { soft: "#ebedea", bg2: "#e7e8e5" },
    dark: { soft: "#212123", bg2: "#262627" },
  } as const;
  for (const scheme of ["light", "dark"] as const) {
    const base = sharedUiThemes[scheme];
    const quiet = quietOnMutedUiTheme(base);
    assert.deepEqual(quiet.colors, { ...base.colors, ...washes[scheme] });
    assert.deepEqual(
      [quiet.fonts, quiet.radii, quiet.focusIndicator, quiet.scheme],
      [base.fonts, base.radii, base.focusIndicator, base.scheme],
    );
    // The pill's reference, phrase and short SHA stay readable on each wash.
    const roles = paletteColors(scheme);
    for (const wash of Object.values(washes[scheme]))
      for (const text of [roles.text, roles.textSecondary, roles.textMuted])
        assert.ok(contrast(text, wash) >= 4.5, text + " on " + wash);
  }
});
