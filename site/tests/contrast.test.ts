/**
 * The contrast contract in docs/protocol/site-design.md, measured from the
 * tokens themselves: normal text needs 4.5:1, and meaningful boundaries and
 * the focus ring need 3:1, in both schemes.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const SOURCE = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "design",
  "folio",
  "tokens.css",
);

/** Foreground, background and the ratio the pair must reach. */
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ["--site-folio-ink", "--site-folio", 4.5],
  ["--site-folio-ink", "--site-folio-surface", 4.5],
  ["--site-folio-ink", "--site-folio-muted", 4.5],
  ["--site-folio-ink-muted", "--site-folio", 4.5],
  ["--site-folio-ink-muted", "--site-folio-surface", 4.5],
  ["--site-folio-ink-muted", "--site-folio-muted", 4.5],
  ["--site-on-accent", "--site-accent", 4.5],
  ["--site-accent", "--site-folio", 4.5],
  ["--site-accent", "--site-folio-surface", 4.5],
  ["--site-accent", "--site-accent-soft", 4.5],
  ["--site-success", "--site-success-soft", 4.5],
  ["--site-warning", "--site-warning-soft", 4.5],
  ["--site-danger", "--site-danger-soft", 4.5],
  ["--site-info", "--site-info-soft", 4.5],
  ["--site-focus", "--site-folio", 3],
  ["--site-focus", "--site-folio-surface", 3],
  ["--site-folio-line-strong", "--site-folio", 3],
  ["--site-folio-line-strong", "--site-folio-surface", 3],
  ["--site-folio-line-strong", "--site-folio-muted", 3],
];

/** The relative luminance of an `#rrggbb` color, per WCAG 2.2. */
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

/** The WCAG contrast ratio between two `#rrggbb` colors. */
function contrast(one: string, other: string): number {
  const first = luminance(one);
  const second = luminance(other);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** The `#rrggbb` values declared between `selector` and its closing brace. */
function scheme(source: string, selector: string): Map<string, string> {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, `missing rule: ${selector}`);
  const end = source.indexOf("}", start);
  assert.notEqual(end, -1, `unterminated rule: ${selector}`);
  return new Map(
    [
      ...source
        .slice(start, end)
        .matchAll(/(--site-[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g),
    ].map(([, property, value]) => [
      property ?? "",
      (value ?? "").toLowerCase(),
    ]),
  );
}

test("every documented token pair meets its contrast ratio", async () => {
  const source = await readFile(SOURCE, "utf8");
  const light = scheme(source, ":root {");
  const dark = scheme(source, ':root[data-color-scheme="dark"] {');
  const schemes = [
    ["light", light],
    ["dark", new Map([...light, ...dark])],
  ] as const;
  assert.ok(light.size >= 20, "the light scheme was not read");
  assert.ok(dark.size >= 15, "the dark scheme was not read");
  for (const [name, values] of schemes) {
    for (const [ink, behind, minimum] of PAIRS) {
      const foreground = values.get(ink);
      const background = values.get(behind);
      assert.ok(foreground, `${name} is missing ${ink}`);
      assert.ok(background, `${name} is missing ${behind}`);
      const ratio = contrast(foreground, background);
      assert.ok(
        ratio >= minimum,
        `${name}: ${ink} on ${behind} is ${ratio.toFixed(2)}:1, below ${minimum}:1`,
      );
    }
  }
});

test("the preferred dark scheme measures the same as the pinned one", async () => {
  const source = await readFile(SOURCE, "utf8");
  const pinned = scheme(source, ':root[data-color-scheme="dark"] {');
  const preferred = scheme(source, ':root:not([data-color-scheme="light"]) {');
  assert.deepEqual([...preferred].sort(), [...pinned].sort());
});
