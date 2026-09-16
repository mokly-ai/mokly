/**
 * The Folio tokens have one source, `design/folio/tokens.css`. The site
 * imports it; the package build copies it into the example catalogue, whose
 * generated site mockups link it by relative path. These tests fail when a
 * copy drifts from that source or when a consumer forks its own tokens.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(repositoryRoot, "design", "folio", "tokens.css");
const COPY = path.join(
  repositoryRoot,
  "examples",
  "basic",
  "generated",
  "site-tokens.css",
);
const SITE = path.join(repositoryRoot, "site", "src", "styles", "tokens.css");

test("the example catalogue's tokens are a copy of the shared source", async () => {
  const [source, copy] = await Promise.all([
    fs.readFile(SOURCE),
    fs.readFile(COPY),
  ]);
  assert.ok(
    source.equals(copy),
    "examples/basic/generated/site-tokens.css is stale; run npm run build",
  );
});

test("the site imports the shared tokens instead of repeating them", async () => {
  const site = await fs.readFile(SITE, "utf8");
  assert.match(site, /@import "\.\.\/\.\.\/\.\.\/design\/folio\/tokens\.css";/);
  assert.doesNotMatch(site, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(site, /--site-[\w-]+:/);
});

/** The text inside the braces `selector` opens, brace matched. */
function body(source: string, selector: string): string {
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
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`unterminated rule: ${selector}`);
}

/** The `--site-*` declarations of the rule `selector` introduces. */
function block(source: string, selector: string): Map<string, string> {
  return new Map(
    body(source, selector)
      .split(";")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("--site-"))
      .map((line) => [
        line.slice(0, line.indexOf(":")),
        line.slice(line.indexOf(":") + 1).trim(),
      ]),
  );
}

test("the shared tokens carry both responsive mechanisms", async () => {
  const source = await fs.readFile(SOURCE, "utf8");
  for (const selector of [
    ":root {",
    ':root[data-color-scheme="dark"] {',
    "@media (prefers-color-scheme: dark) {",
    "@media (min-width: 768px) {",
  ]) {
    assert.ok(source.includes(selector), `missing ${selector}`);
  }

  // A pinned composition must declare exactly what its width resolves to,
  // so a mockup fragment and the site render the same roles.
  const mobile = block(source, ":root {");
  const desktop = block(body(source, "@media (min-width: 768px)"), ":root {");
  const pinnedDesktop = block(source, '[data-site-viewport="desktop"] {');
  for (const [name, expected] of [
    ['[data-site-viewport="mobile"] {', mobile],
    ['[data-site-viewport="desktop"] {', desktop],
  ] as const) {
    const pinned = block(source, name);
    assert.equal(pinned.size, desktop.size, `${name} declares every role`);
    for (const [property, value] of pinned) {
      assert.equal(expected.get(property), value, `${name} ${property}`);
    }
  }
  for (const property of desktop.keys()) {
    assert.ok(
      pinnedDesktop.has(property),
      `the pinned desktop composition is missing ${property}`,
    );
  }
});
