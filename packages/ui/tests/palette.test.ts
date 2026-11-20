import assert from "node:assert/strict";
import { test } from "node:test";

import { contrast } from "../../../tests/helpers/design_palette.js";
import { palettes } from "../src/palette/palette.js";
import type { PaletteColors } from "../src/palette/palette.js";

/** Each scheme of each named palette, with its name for the failure output. */
const schemes = Object.entries(palettes).flatMap(([name, palette]) =>
  (["light", "dark"] as const).map(
    (scheme) => [`${name} ${scheme}`, palette[scheme]] as const,
  ),
);

/** The surfaces that text, boundaries and selected rows sit on. */
function surfaces(colors: PaletteColors): [string, string][] {
  return [
    ["background", colors.background],
    ["surface", colors.surface],
    ["surfaceRaised", colors.surfaceRaised],
    ["surfaceMuted", colors.surfaceMuted],
    ["signalSoft", colors.signalSoft],
  ];
}

/** Every pair that reaches less than its minimum, as failure lines. */
function below(
  minimum: number,
  pairs: readonly (readonly [string, string, string])[],
): string[] {
  assert.ok(pairs.length > 0, "no colour pair was checked");
  return pairs.flatMap(([label, foreground, background]) => {
    const reached = contrast(foreground, background);
    return reached < minimum ? [`${label} reaches only ${reached}:1`] : [];
  });
}

test("every colour of every palette is an opaque six-digit hex value", () => {
  assert.ok(schemes.length > 0, "no palette was checked");
  for (const [name, colors] of schemes) {
    const { people, ...roles } = colors;
    const values: [string, string][] = [
      ...Object.entries(roles),
      ...Object.entries(people).flatMap(
        ([person, { fill, ink }]): [string, string][] => [
          [`${person} fill`, fill],
          [`${person} ink`, ink],
        ],
      ),
    ];
    for (const [role, value] of values)
      assert.match(value, /^#[0-9a-f]{6}$/u, `${name} ${role}`);
  }
});

test("text, secondary text, labels and signal text read at 4.5:1 on every surface", () => {
  const roles = ["text", "textSecondary", "textMuted", "signalDeep"] as const;
  const pairs = schemes.flatMap(([name, colors]) =>
    surfaces(colors).flatMap(([surface, behind]) =>
      roles.map(
        (role) =>
          [`${name} ${role} on ${surface}`, colors[role], behind] as const,
      ),
    ),
  );
  assert.deepEqual(below(4.5, pairs), []);
});

test("control boundaries reach 3:1 on every surface", () => {
  const pairs = schemes.flatMap(([name, colors]) =>
    surfaces(colors).map(
      ([surface, behind]) =>
        [
          `${name} borderStrong on ${surface}`,
          colors.borderStrong,
          behind,
        ] as const,
    ),
  );
  assert.deepEqual(below(3, pairs), []);
});

test("labels on the signal colour and on each person's colour read at 4.5:1", () => {
  const pairs = schemes.flatMap(([name, colors]) => [
    [`${name} onSignal on signal`, colors.onSignal, colors.signal] as const,
    ...Object.entries(colors.people).map(
      ([person, { fill, ink }]) =>
        [`${name} ink on the ${person} person`, ink, fill] as const,
    ),
  ]);
  assert.deepEqual(below(4.5, pairs), []);
});

test("the label of a filled button keeps 3:1 on the button fill", () => {
  const pairs = schemes.map(
    ([name, colors]) =>
      [
        `${name} onSignalFill on signalFill`,
        colors.onSignalFill,
        colors.signalFill,
      ] as const,
  );
  assert.deepEqual(below(3, pairs), []);
});
