import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { SHELL_CSS } from "../src/shell/css.js";

const SOURCE = new URL("../src/", import.meta.url).pathname;

/**
 * The two modules that define a palette, where a literal is the definition:
 * `css_tokens.ts` declares the Light half and the fixed preview and device
 * colours, and `css_theme.ts` declares the Dark half.
 */
const PALETTE_SOURCES = new Set(["css_tokens.ts", "css_theme.ts"]);

const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g;

async function styleModules(): Promise<{ file: string; text: string }[]> {
  const entries = await fs.readdir(SOURCE, {
    recursive: true,
    withFileTypes: true,
  });
  const modules: { file: string; text: string }[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!/^css.*\.ts$/.test(name) && name !== "styles.ts") continue;
    modules.push({
      file: name,
      text: await fs.readFile(path.join(entry.parentPath, name), "utf8"),
    });
  }
  return modules;
}

test("no shell stylesheet names a colour outside a palette source", async () => {
  const failures: string[] = [];
  for (const { file, text } of await styleModules()) {
    if (PALETTE_SOURCES.has(file)) continue;
    for (const [literal] of text.matchAll(LITERAL))
      failures.push(
        `${file}: ${literal} is a fixed colour; use a palette role so it follows the appearance`,
      );
  }
  assert.deepEqual(failures, []);
});

test("the shell stylesheets were actually scanned", async () => {
  const modules = await styleModules();
  assert.ok(modules.length > 15, `only ${modules.length} modules scanned`);
  for (const source of PALETTE_SOURCES)
    assert.ok(
      modules.some((module) => module.file === source),
      `${source} is missing`,
    );
});

function palette(selector: RegExp): Map<string, string> {
  const block = selector.exec(SHELL_CSS)?.[1];
  assert.ok(block, `${selector} is not in the shell stylesheet`);
  return new Map(
    [...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [
      match[1]!,
      match[2]!.trim(),
    ]),
  );
}

const LIGHT = palette(/:root \{([^}]*)\}/);
const DARK = palette(/:root\[data-mokly-theme="dark"\] \{([^}]*)\}/);

/**
 * The colour a role paints. A role a theme does not restate keeps its Light
 * value, and a public role that defers to an overridable default is followed
 * one step, so the pair compared is the one the shell actually paints.
 */
function resolve(
  role: string,
  tokens: Map<string, string>,
): string | undefined {
  const value = tokens.get(role) ?? LIGHT.get(role);
  const referenced = /^var\((--[a-z0-9-]+)\)$/.exec(value ?? "")?.[1];
  return referenced ? (tokens.get(referenced) ?? LIGHT.get(referenced)) : value;
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const hex = color.trim().replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => part + part)
          .join("")
      : hex;
  assert.match(full, /^[0-9a-fA-F]{6}$/u, `${color} is not an opaque colour`);
  return (
    0.2126 * channel(Number.parseInt(full.slice(0, 2), 16)) +
    0.7152 * channel(Number.parseInt(full.slice(2, 4), 16)) +
    0.0722 * channel(Number.parseInt(full.slice(4, 6), 16))
  );
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (
    Math.floor(
      ((Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)) *
        100,
    ) / 100
  );
}

/**
 * The pairs the shell actually paints, with the criterion each carries: normal
 * text needs 4.5:1 and a required control or state graphic needs 3:1.
 */
const PAIRS: readonly (readonly [string, string, string, number])[] = [
  ["ink on surface", "--chrome-ink", "--chrome-surface", 4.5],
  ["ink on background", "--chrome-ink", "--chrome-bg", 4.5],
  ["secondary ink on surface", "--chrome-ink-2", "--chrome-surface", 4.5],
  ["muted on surface", "--chrome-muted", "--chrome-surface", 4.5],
  ["muted on background", "--chrome-muted", "--chrome-bg", 4.5],
  ["muted on raised", "--chrome-muted", "--chrome-raised", 4.5],
  ["muted on hover", "--chrome-muted", "--chrome-hover", 4.5],
  ["accent link on surface", "--chrome-accent", "--chrome-surface", 4.5],
  ["accent on surface", "--mokly-accent", "--chrome-surface", 4.5],
  ["deep accent on surface", "--mbk-accent-deep", "--chrome-surface", 4.5],
  [
    "deep accent on accent surface",
    "--mbk-accent-deep",
    "--mbk-accent-surface",
    4.5,
  ],
  [
    "accent contrast on accent",
    "--mokly-accent-contrast",
    "--mokly-accent",
    4.5,
  ],
  [
    "changed ink on its surface",
    "--mbk-status-changed-ink",
    "--mbk-status-changed-bg",
    4.5,
  ],
  [
    "removed ink on its surface",
    "--mbk-status-removed-ink",
    "--mbk-status-removed-bg",
    4.5,
  ],
  ["validation ink on its surface", "--mbk-danger-ink", "--mbk-danger-bg", 4.5],
  ["control edge on surface", "--chrome-control-edge", "--chrome-surface", 3],
  ["control edge on background", "--chrome-control-edge", "--chrome-bg", 3],
];

test("every painted token pair meets its criterion in both appearances", () => {
  const failures: string[] = [];
  for (const [label, foreground, background, minimum] of PAIRS)
    for (const [appearance, tokens] of [
      ["light", LIGHT],
      ["dark", DARK],
    ] as const) {
      const ink = resolve(foreground, tokens);
      const behind = resolve(background, tokens);
      assert.ok(ink && behind, `${label} is missing a role in ${appearance}`);
      const reached = contrast(ink, behind);
      if (reached < minimum)
        failures.push(`${label} reaches only ${reached}:1 in ${appearance}`);
    }
  assert.deepEqual(failures, []);
});

test("the palette carries the contract's three Light corrections", () => {
  assert.equal(LIGHT.get("--chrome-muted"), "#676e6a");
  assert.equal(LIGHT.get("--chrome-control-edge"), "#868e88");
  assert.equal(LIGHT.get("--mbk-danger-ink"), "#964334");
});
