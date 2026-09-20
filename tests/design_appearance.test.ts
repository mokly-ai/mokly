import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { contrast, designPalette } from "./helpers/design_palette.js";
import {
  boundaryOf,
  designStyleRules,
  fillOf,
  type ColorReference,
} from "./helpers/design_styles.js";
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

async function paletteContract(): Promise<string> {
  return await fs.readFile(
    path.join(repositoryRoot, "docs/protocol/mokly-viewer-palette.md"),
    "utf8",
  );
}

test("both palettes define exactly the same semantic roles", async () => {
  const palette = await designPalette();
  const light = [...palette.light.keys()].filter(
    (name) => name !== "--sans" && name !== "--mono",
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
  assert.ok(rows.length >= palette.light.size - 2);
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

/**
 * Selectors that mark a control state. A boundary drawn only in one of these
 * states is the state's own indicator, so it carries the 3:1 requirement.
 */
const STATE_SELECTOR =
  /:hover|:focus|:checked|:has\(input:checked\)|\[open\]|\.active|aria-pressed|aria-current/u;

/** Fills that mark a selected, active or status surface. */
const MARKED_FILLS = [
  "--mbk-accent-surface",
  "--mbk-accent-soft",
  "--mbk-status-changed-bg",
  "--mbk-status-removed-bg",
];

/**
 * Boundaries that are decoration rather than a state or control indicator, so
 * the palette contract exempts them. Each names its own state in 5.62:1 or
 * better text inside a distinct tinted fill, so the outline adds nothing.
 */
const DECORATIVE_BOUNDARIES = new Set([
  ".ce-added",
  ".ce-changed",
  ".ce-removed",
]);

/**
 * Hairline tokens the palette contract classifies as decoration separating
 * adjacent surfaces rather than control boundaries. A surface that happens to
 * sit inside a state selector, such as the mobile sheet around an open panel,
 * still draws one of these rather than a control edge.
 */
const DECORATIVE_TOKENS = new Set([
  "--chrome-border",
  "--chrome-border-strong",
  "--mbk-guide",
]);

/** Resolves a reference to the colour it paints in one appearance. */
function resolve(
  reference: ColorReference,
  tokens: Map<string, string>,
): string | undefined {
  return reference.token ? tokens.get(reference.token) : reference.literal;
}

function describe(reference: ColorReference): string {
  return reference.token ?? reference.literal ?? "?";
}

/**
 * Rules whose boundary is a control or state indicator: either the selector
 * names a state, or the rule fills itself with a marked surface.
 */
async function markedBoundaryRules() {
  const palette = await designPalette();
  const marked = new Set(
    MARKED_FILLS.flatMap((token) => [
      token,
      palette.light.get(token)?.toLowerCase() ?? token,
      palette.dark.get(token)?.toLowerCase() ?? token,
    ]),
  );
  return (await designStyleRules()).flatMap((rule) => {
    const boundary = boundaryOf(rule.body);
    if (!boundary) return [];
    const fill = fillOf(rule.body);
    const fillMark = fill?.token ?? fill?.literal?.toLowerCase();
    if (
      !STATE_SELECTOR.test(rule.selector) &&
      !(fillMark && marked.has(fillMark))
    )
      return [];
    return [{ ...rule, boundary, fill }];
  });
}

test("every marked boundary is visible against an adjacent colour", async () => {
  const palette = await designPalette();
  const rules = await markedBoundaryRules();
  assert.ok(rules.length >= 8, `only ${rules.length} boundaries were audited`);
  assert.ok(
    rules.some((rule) => DECORATIVE_BOUNDARIES.has(rule.selector)),
    "the recorded decorative exception is not reached by the audit",
  );
  const failures: string[] = [];
  for (const rule of rules) {
    if (DECORATIVE_BOUNDARIES.has(rule.selector)) continue;
    if (rule.boundary.token && DECORATIVE_TOKENS.has(rule.boundary.token))
      continue;
    for (const appearance of ["light", "dark"] as const) {
      const tokens = palette[appearance];
      const edge = resolve(rule.boundary, tokens);
      assert.ok(
        edge,
        `${rule.file} ${rule.selector}: ${describe(rule.boundary)} is not in the ${appearance} palette`,
      );
      // A boundary sits between its own fill and the surface around it, so it
      // only has to reach 3:1 against one of them to read as an edge.
      const fill = rule.fill ? resolve(rule.fill, tokens) : undefined;
      const own = fill ? contrast(edge, fill) : 0;
      const reached = Math.max(
        own,
        contrast(edge, tokens.get("--chrome-surface")!),
      );
      if (reached < 3)
        failures.push(
          `${rule.file} ${rule.selector}: ${describe(rule.boundary)} reaches only ${reached}:1 in ${appearance}`,
        );
    }
  }
  assert.deepEqual(failures, []);
});

/** The two sheets that define a palette, where a literal is the definition. */
const PALETTE_SOURCES = new Set(["design.css", "design-stage.css"]);

test("no design stylesheet hardcodes an interface palette colour", async () => {
  const palette = await designPalette();
  const named = new Map<string, string>();
  for (const appearance of ["light", "dark"] as const)
    for (const [token, value] of palette[appearance])
      if (!named.has(value.toLowerCase()))
        named.set(value.toLowerCase(), `${token} (${appearance})`);
  const failures: string[] = [];
  for (const rule of await designStyleRules()) {
    if (PALETTE_SOURCES.has(rule.file)) continue;
    for (const [, literal] of rule.body.matchAll(
      /(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b)/gu,
    )) {
      const token = named.get(literal!.toLowerCase());
      if (token)
        failures.push(
          `${rule.file} ${rule.selector}: ${literal} is ${token}; use the token so it follows the appearance`,
        );
    }
  }
  assert.deepEqual(failures, []);
});
