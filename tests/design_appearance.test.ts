import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  canvasScopeTokens,
  contrast,
  designPalette,
  designPreviewTokens,
  designThemeTokens,
  SHIPPED_THEME,
} from "./helpers/design_palette.js";
import { designStyleRules } from "./helpers/design_styles.js";
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

/**
 * The pairs that a Canvas root draws through its palette scope: the Canvas
 * roles of the Canvas parts, and the shell tokens that the package
 * components read, each on the surface it sits on.
 */
const CANVAS_PAIRS: readonly (readonly [string, string, string, number])[] = [
  ["Canvas ink on surface", "--cv-text", "--cv-surface", 4.5],
  ["Canvas ink on canvas", "--cv-text", "--cv-background", 4.5],
  ["Canvas secondary on surface", "--cv-text-secondary", "--cv-surface", 4.5],
  ["Canvas muted on surface", "--cv-text-muted", "--cv-surface", 4.5],
  ["Canvas muted on canvas", "--cv-text-muted", "--cv-background", 4.5],
  ["Canvas edge on surface", "--cv-border-strong", "--cv-surface", 3],
  ["Canvas edge on canvas", "--cv-border-strong", "--cv-background", 3],
  ["signal text on surface", "--cv-signal-deep", "--cv-surface", 4.5],
  ["signal text on soft signal", "--cv-signal-deep", "--cv-signal-soft", 4.5],
  ["Canvas ink on soft signal", "--cv-text", "--cv-signal-soft", 4.5],
  [
    "Canvas muted on muted surface",
    "--cv-text-muted",
    "--cv-surface-muted",
    4.5,
  ],
  ["selection tag text on the signal", "--cv-on-signal", "--cv-signal", 4.5],
  ["shell ink on surface", "--chrome-ink", "--chrome-surface", 4.5],
  ["shell ink on canvas", "--chrome-ink", "--chrome-bg", 4.5],
  ["shell secondary on surface", "--chrome-ink-2", "--chrome-surface", 4.5],
  ["shell secondary on canvas", "--chrome-ink-2", "--chrome-bg", 4.5],
  ["shell muted on surface", "--chrome-muted", "--chrome-surface", 4.5],
  ["shell muted on canvas", "--chrome-muted", "--chrome-bg", 4.5],
  ["shell muted on catalogue", "--chrome-muted", "--chrome-raised", 4.5],
  ["control edge on surface", "--chrome-control-edge", "--chrome-surface", 3],
  ["control edge on canvas", "--chrome-control-edge", "--chrome-bg", 3],
  ["shell link on surface", "--chrome-accent", "--chrome-surface", 4.5],
  ["accent text on surface", "--mbk-accent-deep", "--chrome-surface", 4.5],
  [
    "accent text on accent surface",
    "--mbk-accent-deep",
    "--mbk-accent-surface",
    4.5,
  ],
  ["label on the accent", "--mokly-accent-contrast", "--mokly-accent", 4.5],
  [
    "label on the deep accent",
    "--_mokly-private-on-accent-deep",
    "--mbk-accent-deep",
    4.5,
  ],
  ["added text on its surface", "--mb-added", "--mb-added-soft", 4.5],
];

test("every Canvas scope pair meets its criterion in both appearances", () => {
  for (const [label, foreground, background, minimum] of CANVAS_PAIRS)
    for (const appearance of ["light", "dark"] as const) {
      const tokens = canvasScopeTokens(appearance);
      const first = tokens.get(foreground);
      const second = tokens.get(background);
      assert.ok(first && second, `${label}: ${appearance} tokens are missing`);
      assert.ok(
        contrast(first, second) >= minimum,
        `${label} (${appearance}): ${contrast(first, second)} < ${minimum}`,
      );
    }
});

/** Font stacks share the palette block but are not appearance roles. */
const FONT_STACKS = new Set(["--sans", "--serif", "--mono"]);

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

test("preview tokens stay independent of the interface appearance", async () => {
  const palette = await designPalette();
  for (const name of palette.light.keys())
    assert.ok(
      !name.startsWith("--mbk-screen"),
      `${name} belongs with the preview tokens, not the interface palette`,
    );
  const stage = await fs.readFile(
    path.join(repositoryRoot, "examples/basic/design-stage.css"),
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

/**
 * Custom properties that a @mokly/ui component sets on its own element and
 * reads with a fallback, each with the reason, so a palette token cannot join
 * the list unnoticed.
 */
const COMPONENT_PARAMETERS = new Map([
  ["--mbk-indent", "each catalogue row sets its own indent"],
  ["--mbk-nav-width", "a resizable catalogue column sets its own width"],
  ["--inspector-height", "a resizable inspector sets its own height"],
  ["--inspector-tabs", "a static inspector sets the number of its tabs"],
  ["--inspector-tab", "each tab of a static inspector sets its own column"],
  [
    "--mbk-comparison-canvas",
    "a comparison's host paints the canvas colour of each version",
  ],
]);

test("the design stylesheets import the shipped theme and the reset class that every @mokly/ui component reads", async () => {
  const imported = new Set((await designStyleRules()).map((rule) => rule.file));
  for (const file of [SHIPPED_THEME, "packages/ui/src/reset/reset.css"])
    assert.ok(imported.has(file), `no design stylesheet imports ${file}`);
});

test("the design palettes declare every token that a @mokly/ui stylesheet reads", async () => {
  // The root block of the interface palette declares each of its tokens, and
  // the same-roles test above holds the dark block to the same roles. The
  // preview tokens of the stage stylesheet declare the device colours, and
  // the shipped theme declares its own tokens on every artboard's root.
  const declared = new Map([
    ...(await designPalette()).light,
    ...(await designPreviewTokens()),
    ...(await designThemeTokens()),
  ]);
  const files = new Set<string>();
  const missing: string[] = [];
  const parameters = new Set<string>();
  for (const rule of await designStyleRules()) {
    if (!rule.file.startsWith("packages/ui/src/")) continue;
    files.add(rule.file);
    for (const [, token, fallback] of rule.body.matchAll(
      /var\((--[\w-]+)\s*(,)?/gu,
    )) {
      if (COMPONENT_PARAMETERS.has(token!) && fallback) parameters.add(token!);
      else if (!declared.has(token!))
        missing.push(`${rule.file} ${rule.selector}: ${token}`);
    }
  }
  assert.ok(files.size > 0, "no @mokly/ui stylesheet was read");
  assert.deepEqual(missing, []);
  for (const [parameter, reason] of COMPONENT_PARAMETERS)
    assert.ok(
      parameters.has(parameter),
      `the component parameter ${parameter} (${reason}) is not read with a fallback`,
    );
});
