import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { contrast, designPalette } from "./helpers/design_palette.js";
import { repositoryRoot } from "./helpers/fixture.js";

const CONTRAST_PAIRS: readonly (readonly [string, string, string, number])[] = [
  ["ink on surface", "--chrome-ink", "--chrome-surface", 4.5],
  ["ink on background", "--chrome-ink", "--chrome-bg", 4.5],
  ["secondary ink on surface", "--chrome-ink-2", "--chrome-surface", 4.5],
  ["muted on surface", "--chrome-muted", "--chrome-surface", 4.5],
  ["muted on background", "--chrome-muted", "--chrome-bg", 4.5],
  ["muted on raised (navigation)", "--chrome-muted", "--chrome-raised", 4.5],
  ["muted on hover surface", "--chrome-muted", "--chrome-hover", 4.5],
  ["accent link on surface", "--chrome-accent", "--chrome-surface", 4.5],
  ["brand mark on surface", "--chrome-brand", "--chrome-surface", 3],
  ["sage on surface", "--mbk-sage", "--chrome-surface", 4.5],
  ["deep sage on surface", "--mbk-sage-deep", "--chrome-surface", 4.5],
  [
    "deep sage on accent surface",
    "--mbk-sage-deep",
    "--mbk-accent-surface",
    4.5,
  ],
  [
    "accent contrast on sage (active row)",
    "--mbk-accent-contrast",
    "--mbk-sage",
    4.5,
  ],
  ["control edge on surface", "--chrome-control-edge", "--chrome-surface", 3],
  ["control edge on background", "--chrome-control-edge", "--chrome-bg", 3],
  [
    "control edge on raised (navigation)",
    "--chrome-control-edge",
    "--chrome-raised",
    3,
  ],
  [
    "focus outline (deep sage) on background",
    "--mbk-sage-deep",
    "--chrome-bg",
    3,
  ],
  [
    "state boundary (deep sage) on accent surface",
    "--mbk-sage-deep",
    "--mbk-accent-surface",
    3,
  ],
  [
    "validation ink on validation surface",
    "--mbk-danger-ink",
    "--mbk-danger-bg",
    4.5,
  ],
  // WCAG exempts disabled controls, so this pair is recorded, not required.
  [
    "disabled ink on disabled surface",
    "--chrome-disabled-ink",
    "--chrome-disabled-bg",
    0,
  ],
  [
    "changed status ink on its surface",
    "--mbk-status-changed-ink",
    "--mbk-status-changed-bg",
    4.5,
  ],
  [
    "removed status ink on its surface",
    "--mbk-status-removed-ink",
    "--mbk-status-removed-bg",
    4.5,
  ],
  [
    "added status ink on its surface",
    "--mbk-sage-deep",
    "--mbk-accent-surface",
    4.5,
  ],
  [
    "validation message on surface",
    "--mbk-danger-ink",
    "--chrome-surface",
    4.5,
  ],
];

/** Font stacks share the palette block but are not appearance roles. */
const FONT_STACKS = new Set(["--sans", "--serif", "--mono"]);

async function paletteContract(): Promise<string> {
  return await fs.readFile(
    path.join(repositoryRoot, "docs/protocol/mokly-viewer-palette.md"),
    "utf8",
  );
}

test("both palettes define exactly the same semantic roles", async () => {
  const palette = await designPalette();
  const light = [...palette.light.keys()].filter(
    (name) => !FONT_STACKS.has(name),
  );
  assert.deepEqual([...palette.dark.keys()].sort(), light.sort());
  for (const [name, value] of palette.dark)
    assert.notEqual(value, palette.light.get(name), `${name} is not themed`);
});

test("every recorded contrast pair meets its criterion in both appearances", async () => {
  const palette = await designPalette();
  for (const [label, foreground, background, minimum] of CONTRAST_PAIRS)
    for (const appearance of ["light", "dark"] as const) {
      const tokens = palette[appearance];
      const first = tokens.get(foreground);
      const second = tokens.get(background);
      assert.ok(first && second, `${label}: ${appearance} tokens are missing`);
      assert.ok(
        contrast(first, second) >= minimum,
        `${label} (${appearance}): ${contrast(first, second)} < ${minimum}`,
      );
    }
});

test("the palette contract records the implemented swatches", async () => {
  const palette = await designPalette();
  const contract = await paletteContract();
  const rows = [
    ...contract.matchAll(
      /^\|\s*`(--[a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/gm,
    ),
  ];
  assert.ok(rows.length >= palette.light.size - FONT_STACKS.size);
  for (const [, name, light, dark] of rows) {
    if (!palette.light.has(name!)) continue;
    assert.equal(palette.light.get(name!), light, `${name} light`);
    assert.equal(palette.dark.get(name!), dark, `${name} dark`);
  }
});

test("the palette contract records the computed contrast ratios", async () => {
  const palette = await designPalette();
  const contract = await paletteContract();
  for (const [label, foreground, background] of CONTRAST_PAIRS) {
    const row = new RegExp(
      `^\\|\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|`,
      "m",
    ).exec(contract);
    assert.ok(row, `${label} is not recorded`);
    for (const [index, appearance] of (["light", "dark"] as const).entries()) {
      const tokens = palette[appearance];
      assert.equal(
        Number(row[index + 1]),
        contrast(tokens.get(foreground)!, tokens.get(background)!),
        `${label} (${appearance})`,
      );
    }
  }
});

test("preview tokens stay independent of the interface appearance", async () => {
  const palette = await designPalette();
  for (const name of palette.light.keys())
    assert.ok(
      !name.startsWith("--mbk-screen"),
      `${name} belongs with the preview tokens, not the interface palette`,
    );
  const stage = await fs.readFile(
    path.join(repositoryRoot, "examples/basic/generated/design-stage.css"),
    "utf8",
  );
  for (const name of [
    "--mbk-screen-bg",
    "--mbk-screen-ink",
    "--mbk-screen-ink-2",
    "--mbk-screen-muted",
    "--mbk-screen-border",
    "--mbk-screen-link",
    "--mbk-screen-link-strong",
  ])
    assert.match(stage, new RegExp(`${name}:`), name);
});
