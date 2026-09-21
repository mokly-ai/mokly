import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { SHELL_CSS } from "../src/shell/css.js";

import { PALETTE_PAIRS } from "./palette_pairs.js";

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
  const blocks = [...SHELL_CSS.matchAll(selector)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
  assert.ok(blocks.length > 0, `${selector} is not in the shell stylesheet`);
  return new Map(
    blocks.flatMap((block) =>
      [...block.matchAll(/(--[a-z0-9_-]+):\s*([^;]+);/g)].map(
        (match) => [match[1]!, match[2]!.trim()] as const,
      ),
    ),
  );
}

const LIGHT = palette(/:root \{([^}]*)\}/g);
const DARK = palette(/:root\[data-mokly-theme="dark"\] \{([^}]*)\}/g);

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
  const referenced = /^var\((--[a-z0-9_-]+)\)$/.exec(value ?? "")?.[1];
  return referenced ? (tokens.get(referenced) ?? LIGHT.get(referenced)) : value;
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function color(value: string): readonly [number, number, number, number] {
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/u.exec(value.trim())?.[1];
  if (hex) {
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((part) => part + part)
            .join("")
        : hex;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16),
      1,
    ];
  }
  const rgba =
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+)\s*)?\)$/u.exec(
      value.trim(),
    );
  assert.ok(rgba, `${value} is not a colour`);
  const [, red, green, blue, alpha] = rgba;
  assert.ok(red && green && blue);
  return [Number(red), Number(green), Number(blue), Number(alpha ?? 1)];
}

function luminance([red, green, blue]: readonly number[]): number {
  return (
    0.2126 * channel(red!) + 0.7152 * channel(green!) + 0.0722 * channel(blue!)
  );
}

function contrast(foreground: string, background: string): number {
  const front = color(foreground);
  const behind = color(background);
  assert.equal(behind[3], 1, `${background} is not an opaque background`);
  const alpha = front[3];
  const painted = front
    .slice(0, 3)
    .map((value, index) => value! * alpha + behind[index]! * (1 - alpha));
  const first = luminance(painted);
  const second = luminance(behind);
  return (
    Math.floor(
      ((Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)) *
        100,
    ) / 100
  );
}

/**
 * The pairs the shell actually paints carry their criteria: normal
 * text needs 4.5:1 and a required control or state graphic needs 3:1. A null
 * minimum records a fixed decorative or disabled role whose value still needs
 * to remain resolvable and paired with the surface it paints on.
 */
test("every painted token pair meets its criterion in both appearances", () => {
  const failures: string[] = [];
  for (const [label, foreground, background, minimum] of PALETTE_PAIRS)
    for (const [appearance, tokens] of [
      ["light", LIGHT],
      ["dark", DARK],
    ] as const) {
      const ink = resolve(foreground, tokens);
      const behind = resolve(background, tokens);
      assert.ok(ink && behind, `${label} is missing a role in ${appearance}`);
      const reached = contrast(ink, behind);
      if (minimum !== null && reached < minimum)
        failures.push(`${label} reaches only ${reached}:1 in ${appearance}`);
    }
  assert.deepEqual(failures, []);
});

test("every status and device token value is covered by a painted pair", () => {
  const paired = new Set(
    PALETTE_PAIRS.flatMap(([, foreground, background]) => [
      foreground,
      background,
    ]),
  );
  const required = [...LIGHT.keys()].filter(
    (role) =>
      role.startsWith("--mbk-device-") ||
      role.startsWith("--mbk-status-") ||
      role.startsWith("--mbk-danger-") ||
      [
        "--mbk-accent-deep",
        "--mbk-accent-edge",
        "--mbk-accent-surface",
      ].includes(role),
  );
  assert.ok(
    required.length > 15,
    `only ${required.length} status/device roles found`,
  );
  assert.deepEqual(
    required.filter((role) => !paired.has(role)),
    [],
  );
});

test("the palette carries the contract's three Light corrections", () => {
  assert.equal(LIGHT.get("--chrome-muted"), "#676e6a");
  assert.equal(LIGHT.get("--chrome-control-edge"), "#868e88");
  assert.equal(LIGHT.get("--mbk-danger-ink"), "#964334");
});
