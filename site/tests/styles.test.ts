import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const styles = path.resolve(import.meta.dirname, "..", "src", "styles");
const TOKENS = "tokens.css";

const NAMED_COLORS =
  /(?<![\w-])(?:aqua|black|blue|brown|fuchsia|gold|gray|green|grey|lime|maroon|navy|olive|orange|pink|purple|red|silver|teal|violet|white|yellow)(?![\w-])/i;

/**
 * The composition switches: the 768px breakpoint every page shares, and the
 * width at which the documentation hangs its on-this-page rail, both fixed by
 * docs/protocol/site-design.md.
 */
const WIDTH_QUERIES = ["min-width: 768px", "min-width: 1100px"];

const REQUIRED_TOKENS = [
  "--site-folio",
  "--site-folio-muted",
  "--site-folio-surface",
  "--site-folio-ink",
  "--site-folio-ink-muted",
  "--site-folio-line",
  "--site-folio-line-strong",
  "--site-accent",
  "--site-accent-hover",
  "--site-accent-active",
  "--site-on-accent",
  "--site-accent-soft",
  "--site-focus",
  "--site-success",
  "--site-success-soft",
  "--site-warning",
  "--site-warning-soft",
  "--site-danger",
  "--site-danger-soft",
  "--site-info",
  "--site-info-soft",
];

/** The declarations of the rule introduced by `selector`, brace matched. */
function block(source: string, selector: string): string[] {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, `missing rule: ${selector}`);
  let depth = 0;
  let open = -1;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
      if (depth === 1) open = index;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source
          .slice(open + 1, index)
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
      }
    }
  }
  throw new Error(`unterminated rule: ${selector}`);
}

async function stylesheets(): Promise<string[]> {
  const entries = await readdir(styles);
  return entries.filter((name) => name.endsWith(".css")).sort();
}

test("only the token stylesheet declares a literal color", async () => {
  const sheets = await stylesheets();
  assert.ok(sheets.includes(TOKENS));
  assert.ok(sheets.length > 1, "the site has stylesheets beside the tokens");
  for (const name of sheets.filter((sheet) => sheet !== TOKENS)) {
    const source = await readFile(path.join(styles, name), "utf8");
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, name);
    assert.doesNotMatch(source, /\b(?:rgba?|hsla?|color-mix|oklch)\(/, name);
    for (const [, value] of source.matchAll(/^\s*[\w-]+:\s*([^;]+);/gm)) {
      const literal = (value ?? "")
        .replace(/(?<![\w-])(?:transparent|currentColor)(?![\w-])/gi, "")
        .replace(/var\([^)]*\)/g, "");
      assert.doesNotMatch(literal, NAMED_COLORS, `${name}: ${value ?? ""}`);
    }
  }
});

test("the tokens define every Folio color for light and dark", async () => {
  const source = await readFile(path.join(styles, TOKENS), "utf8");
  const light = block(source, ":root {");
  for (const token of REQUIRED_TOKENS) {
    assert.ok(
      light.some((line) => line.startsWith(`${token}:`)),
      `light is missing ${token}`,
    );
  }
  assert.ok(light.includes("color-scheme: light dark;"));
});

test("both dark blocks declare the same values", async () => {
  const source = await readFile(path.join(styles, TOKENS), "utf8");
  const pinned = block(source, ':root[data-color-scheme="dark"] {');
  const preferred = block(source, ':root:not([data-color-scheme="light"]) {');
  assert.deepEqual(preferred, pinned);
  for (const token of REQUIRED_TOKENS) {
    assert.ok(
      pinned.some((line) => line.startsWith(`${token}:`)),
      `dark is missing ${token}`,
    );
  }
  assert.match(source, /@media \(prefers-color-scheme: dark\) \{/);
});

test("the favicon draws the mark in the token colors", async () => {
  const tokens = await readFile(path.join(styles, TOKENS), "utf8");
  const favicon = await readFile(
    path.resolve(import.meta.dirname, "..", "public", "favicon.svg"),
    "utf8",
  );
  const light = block(tokens, ":root {");
  const dark = block(tokens, ':root[data-color-scheme="dark"] {');
  const scheme = block(favicon, ":root {");
  const darkScheme = block(favicon, "@media (prefers-color-scheme: dark)");
  for (const token of ["--site-accent", "--site-folio-surface"]) {
    const value = (name: string, declarations: string[]): string =>
      declarations.find((line) => line.startsWith(`${name}:`)) ?? "";
    assert.equal(value(token, scheme), value(token, light), token);
    assert.ok(darkScheme.includes(value(token, dark)), token);
    assert.match(favicon, new RegExp(`var\\(${token}\\)`), token);
  }
});

test("the desktop composition resolves at the 768px breakpoint", async () => {
  const source = await readFile(path.join(styles, TOKENS), "utf8");
  assert.match(source, /@media \(min-width: 768px\) \{/);
  for (const name of await stylesheets()) {
    const sheet = await readFile(path.join(styles, name), "utf8");
    for (const [, query] of sheet.matchAll(/@media \(([^)]*width[^)]*)\)/g)) {
      assert.ok(WIDTH_QUERIES.includes(query ?? ""), `${name}: ${query ?? ""}`);
    }
  }
});
