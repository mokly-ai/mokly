import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const styles = path.resolve(import.meta.dirname, "..", "src", "styles");
const TOKENS = "tokens.css";

/** The one file that declares the Folio tokens, shared with the mockups. */
const SOURCE = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "design",
  "folio",
  "tokens.css",
);

const NAMED_COLORS =
  /(?<![\w-])(?:aqua|black|blue|brown|fuchsia|gold|gray|green|grey|lime|maroon|navy|olive|orange|pink|purple|red|silver|teal|violet|white|yellow)(?![\w-])/i;

/**
 * The composition switches: the 768px breakpoint every page shares, and the
 * width at which the documentation hangs its on-this-page rail, both fixed by
 * docs/protocol/site-design.md.
 */
const WIDTH_QUERIES = ["min-width: 768px", "min-width: 1100px"];

/**
 * Controls whose whole boundary must be meaningful rather than decorative.
 * Any rule that reserves the minimum target size is treated as a control too,
 * so a new control cannot take the hairline by staying off this list.
 */
const CONTROLS = [
  ".site-button",
  ".site-code-copy",
  ".site-doc-disclosure",
  ".site-pager-item",
  ".site-search",
  ".site-search-input",
  ".site-skip",
  ".site-version",
];

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

/** Every rule in the site's own sheets, as a selector and its declarations. */
async function siteRules(): Promise<
  Array<{ name: string; selector: string; declarations: string[] }>
> {
  const rules: Array<{
    name: string;
    selector: string;
    declarations: string[];
  }> = [];
  for (const name of await stylesheets()) {
    const source = (await readFile(path.join(styles, name), "utf8")).replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if ((selector ?? "").trim().startsWith("@")) continue;
      rules.push({
        declarations: (body ?? "")
          .split(";")
          .map((line) => line.trim().replace(/\s+/g, " "))
          .filter((line) => line.length > 0),
        name,
        selector: (selector ?? "").trim().replace(/\s+/g, " "),
      });
    }
  }
  return rules;
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
  const source = await readFile(SOURCE, "utf8");
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
  const source = await readFile(SOURCE, "utf8");
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
  const tokens = await readFile(SOURCE, "utf8");
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
  assert.match(
    await readFile(SOURCE, "utf8"),
    /@media \(min-width: 768px\) \{/,
  );
  for (const name of await stylesheets()) {
    const sheet = await readFile(path.join(styles, name), "utf8");
    for (const [, query] of sheet.matchAll(/@media \(([^)]*width[^)]*)\)/g)) {
      assert.ok(WIDTH_QUERIES.includes(query ?? ""), `${name}: ${query ?? ""}`);
    }
  }
});

test("the build inlines the shared tokens into the site stylesheet", async () => {
  const built = path.resolve(import.meta.dirname, "..", "dist", "_astro");
  const sheets = (await readdir(built)).filter((name) => name.endsWith(".css"));
  let bundled = "";
  for (const name of sheets)
    bundled += await readFile(path.join(built, name), "utf8");
  assert.ok(!bundled.includes("@import"), "a token import reached the browser");
  for (const token of REQUIRED_TOKENS) {
    assert.ok(
      new RegExp(`${token}\\s*:\\s*#`).test(bundled),
      `the built stylesheet is missing ${token}`,
    );
  }
  // The minifier may rewrite a width query into range syntax.
  assert.ok(
    /@media \(prefers-color-scheme:\s*dark\)/.test(bundled),
    "the built stylesheet lost the preferred dark scheme",
  );
  assert.ok(
    /@media \((?:min-width:\s*768px|width\s*>=\s*768px)\)/.test(bundled),
    "the built stylesheet lost the desktop composition",
  );
});

test("no stylesheet removes a focus outline", async () => {
  for (const name of await stylesheets()) {
    const sheet = await readFile(path.join(styles, name), "utf8");
    assert.doesNotMatch(sheet, /outline\s*:\s*(?:none|0)\b/, name);
  }
});

test("a control's whole boundary is meaningful, never the hairline", async () => {
  const rules = await siteRules();
  const controls = rules.filter(
    (rule) =>
      rule.declarations.includes("min-height: var(--site-target-min)") ||
      rule.selector
        .split(",")
        .some((part) =>
          CONTROLS.some((control) =>
            new RegExp(`${control}(?:--[\\w-]+)?(?:[:\\s>]|$)`).test(
              part.trim(),
            ),
          ),
        ),
  );
  assert.ok(controls.length >= CONTROLS.length, "no control rule was read");
  for (const control of CONTROLS) {
    assert.ok(
      controls.some((rule) => rule.selector.includes(control)),
      `${control} declares no rule`,
    );
  }
  for (const rule of controls) {
    for (const declaration of rule.declarations) {
      if (!/^border(?:-color)?:/.test(declaration)) continue;
      if (!declaration.includes("--site-folio-line")) continue;
      assert.match(
        declaration,
        /--site-folio-line-strong/,
        `${rule.name}: ${rule.selector} { ${declaration} }`,
      );
    }
  }
});
