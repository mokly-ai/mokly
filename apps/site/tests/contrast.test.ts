/** The site contrast contract, measured from the workspace token source. */
import assert from "node:assert/strict";
import test from "node:test";

import { tokens } from "@mokly-cloud/tokens/tokens";

type ColorName = {
  [
    Key in keyof typeof tokens.color.light
  ]: (typeof tokens.color.light)[Key] extends string ? Key : never;
}[keyof typeof tokens.color.light];

/** Foreground, background and the ratio the pair must reach. */
const PAIRS: ReadonlyArray<readonly [ColorName, ColorName, number]> = [
  ["text", "background", 4.5],
  ["text", "surface", 4.5],
  ["text", "surfaceMuted", 4.5],
  ["textMuted", "background", 4.5],
  ["textMuted", "surface", 4.5],
  ["textMuted", "surfaceMuted", 4.5],
  ["onAccent", "accentSolid", 3],
  ["accentHover", "background", 4.5],
  ["accentHover", "surface", 4.5],
  ["accentHover", "accentSoft", 4.5],
  ["accentActive", "background", 4.5],
  ["accentActive", "surface", 4.5],
  ["accentActive", "accentSoft", 4.5],
  ["accent", "background", 4.5],
  ["accent", "surface", 4.5],
  ["accent", "accentSoft", 4.5],
  ["success", "successSoft", 4.5],
  ["warning", "warningSoft", 4.5],
  ["danger", "dangerSoft", 4.5],
  ["info", "infoSoft", 4.5],
  ["borderStrong", "background", 3],
  ["borderStrong", "surface", 3],
  ["borderStrong", "surfaceMuted", 3],
];

/** The channels of a `#rrggbb` token value. */
function channels(value: string): number[] {
  return [1, 3, 5].map((at) => Number.parseInt(value.slice(at, at + 2), 16));
}

/** The relative luminance of sRGB channels. */
function luminance(colour: readonly number[]): number {
  const [red = 0, green = 0, blue = 0] = colour.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The contrast ratio of two colours, each as sRGB channels. */
function contrast(one: readonly number[], other: readonly number[]): number {
  const first = luminance(one);
  const second = luminance(other);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

test("every documented site token pair meets its contrast ratio", () => {
  for (const scheme of ["light", "dark"] as const) {
    const values = tokens.color[scheme];
    for (const [ink, behind, minimum] of PAIRS) {
      const foreground = values[ink];
      const background = values[behind];
      assert.ok(foreground, `${scheme} is missing ${ink}`);
      assert.ok(background, `${scheme} is missing ${behind}`);
      const ratio = contrast(channels(foreground), channels(background));
      assert.ok(
        ratio >= minimum,
        `${scheme}: ${ink} on ${behind} is ${ratio.toFixed(2)}:1, below ${minimum}:1`,
      );
    }
  }
});

test("the glow keeps 3:1 against every surface it draws on, in both schemes", () => {
  // Each glow with the surface it sits on in light and in dark: the page
  // glow on the canvas and the page's surfaces, and the code glow on the
  // code panel, which text fills in light and the muted surface in dark.
  const backdrops: ReadonlyArray<readonly [ColorName, ColorName, ColorName]> = [
    ["signalDeep", "background", "background"],
    ["signalDeep", "surface", "surface"],
    ["signalDeep", "surfaceMuted", "surfaceMuted"],
    ["signalDeep", "surfaceRaised", "surfaceRaised"],
    ["signalDeep", "signalSoft", "signalSoft"],
    ["signal", "text", "surfaceMuted"],
  ];
  for (const [glow, light, dark] of backdrops) {
    for (const [scheme, behind] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      // The glow at 75% over an opaque fill, as the browser composites it.
      const fill = channels(tokens.color[scheme][behind]);
      const halo = channels(tokens.color[scheme][glow]).map(
        (channel, at) => channel * 0.75 + (fill[at] ?? 0) * 0.25,
      );
      const ratio = contrast(halo, fill);
      assert.ok(ratio >= 3, `${scheme}: ${glow} on ${behind}, ${ratio}:1`);
    }
  }
});
