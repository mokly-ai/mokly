/** The site contrast contract, measured from the workspace token source. */
import assert from "node:assert/strict";
import test from "node:test";

import { paletteColors } from "@mokly-cloud/tokens/palettes";
import { tokens } from "@mokly-cloud/tokens/tokens";

type ColorName = keyof typeof tokens.color.light;

/** Foreground, background and the ratio the pair must reach. */
const PAIRS: ReadonlyArray<readonly [ColorName, ColorName, number]> = [
  ["text", "background", 4.5],
  ["text", "surface", 4.5],
  ["text", "surfaceMuted", 4.5],
  ["textMuted", "background", 4.5],
  ["textMuted", "surface", 4.5],
  ["textMuted", "surfaceMuted", 4.5],
  ["onAccent", "accentSolid", 4.5],
  ["onAccent", "accentHover", 4.5],
  ["onAccent", "accentActive", 4.5],
  ["accent", "background", 4.5],
  ["accent", "surface", 4.5],
  ["accent", "accentSoft", 4.5],
  ["success", "successSoft", 4.5],
  ["warning", "warningSoft", 4.5],
  ["danger", "dangerSoft", 4.5],
  ["info", "infoSoft", 4.5],
  ["focus", "background", 3],
  ["focus", "surface", 3],
  ["borderStrong", "background", 3],
  ["borderStrong", "surface", 3],
  ["borderStrong", "surfaceMuted", 3],
];

function luminance(color: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(color.slice(start, start + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

function contrast(one: string, other: string): number {
  const first = luminance(one);
  const second = luminance(other);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

test("every documented site token pair meets its contrast ratio", () => {
  for (const scheme of ["light", "dark"] as const) {
    const values: Record<string, string> = {
      ...tokens.color[scheme],
      ...paletteColors(scheme, "folio"),
    };
    for (const [ink, behind, minimum] of PAIRS) {
      const foreground = values[ink];
      const background = values[behind];
      assert.ok(foreground, `${scheme} is missing ${ink}`);
      assert.ok(background, `${scheme} is missing ${behind}`);
      const ratio = contrast(foreground, background);
      assert.ok(
        ratio >= minimum,
        `${scheme}: ${ink} on ${behind} is ${ratio.toFixed(2)}:1, below ${minimum}:1`,
      );
    }
  }
});
