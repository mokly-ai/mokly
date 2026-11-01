import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  componentStylesheets,
  orderedStylesheets,
  packageStylesheet,
} from "../scripts/styles.mjs";

test("only a stylesheet named after its component directory is a component stylesheet", () => {
  assert.deepEqual(
    componentStylesheets([
      "toolbar/toolbar.css",
      "toolbar/toolbar.tsx",
      "toolbar/parts.css",
      "appearance-selector/appearance-selector.css",
      "styles.css",
      "icons/nested/nested.css",
    ]),
    [
      {
        name: "appearance-selector",
        file: "appearance-selector/appearance-selector.css",
      },
      { name: "toolbar", file: "toolbar/toolbar.css" },
    ],
  );
});

test("the package stylesheet keeps the given order and final newlines", () => {
  const styles = packageStylesheet([
    { name: "toolbar", css: ".toolbar {}" },
    { name: "ab", css: ".ab {}\n" },
    { name: "a-b", css: ".a-b {}\n" },
  ]);
  const rules = styles.split("\n").slice(1);
  assert.deepEqual(rules, [".toolbar {}", ".ab {}", ".a-b {}", ""]);
  assert.match(styles, /^\/\* @mokly\/ui: .* \*\/\n/u);
});

const sheets = componentStylesheets(["a/a.css", "b/b.css", "c/c.css"]);

test("the component order follows the import list", () => {
  const warnings: string[] = [];
  const ordered = orderedStylesheets(
    sheets,
    '/* @import "./unknown/unknown.css"; */\n@import "./c/c.css";\n@import "./a/a.css";\n@import "./b/b.css";',
    (warning) => warnings.push(warning),
  );
  assert.deepEqual(
    ordered.map(({ name }) => name),
    ["c", "a", "b"],
  );
  assert.deepEqual(warnings, []);
});

test("omitted stylesheets join the end in name order with a warning", () => {
  const warnings: string[] = [];
  const ordered = orderedStylesheets(
    [...sheets].reverse(),
    '@import "./b/b.css";',
    (warning) => warnings.push(warning),
  );
  assert.deepEqual(
    ordered.map(({ name }) => name),
    ["b", "a", "c"],
  );
  assert.equal(warnings.length, 2);
  assert.match(warnings.join(""), /omits src\/a\/a\.css.*end/u);
  assert.match(warnings.join(""), /omits src\/c\/c\.css.*end/u);
});

test("unknown entries are skipped with a warning", () => {
  const warnings: string[] = [];
  const ordered = orderedStylesheets(
    sheets.slice(0, 1),
    '@import "./missing/missing.css";\n@import "./a/a.css";',
    (warning) => warnings.push(warning),
  );
  assert.deepEqual(ordered, sheets.slice(0, 1));
  assert.equal(warnings.length, 1);
  assert.match(warnings.join(""), /src\/missing\/missing\.css.*skips it/u);
});

test("the build writes every component stylesheet once, in the order of src/styles.css", async () => {
  const warnings: string[] = [];
  const list = await fs.readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const ordered = orderedStylesheets(
    componentStylesheets(await sourceFiles()),
    list,
    (warning) => warnings.push(warning),
  );
  // The list names each component stylesheet, so none joins the end.
  assert.deepEqual(
    ordered.map(({ file }) => file),
    [...list.matchAll(/@import "\.\/([^"]+)";/gu)].map((match) => match[1]),
  );
  const components = await Promise.all(
    ordered.map(async ({ name, file }) => ({
      name,
      css: await fs.readFile(
        new URL(`../src/${file}`, import.meta.url),
        "utf8",
      ),
    })),
  );
  const expected =
    "/* @mokly/ui: the rules of every component, in the order of src/styles.css. */\n" +
    components
      .map(({ css }) => (css.endsWith("\n") ? css : `${css}\n`))
      .join("");
  assert.equal(packageStylesheet(components), expected);
  assert.equal(
    await fs.readFile(new URL("../dist/styles.css", import.meta.url), "utf8"),
    expected,
  );
  assert.deepEqual(warnings, []);
});

test("the theme and the reset class come first, so every component rule follows them", async () => {
  const list = await fs.readFile(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const imports = [...list.matchAll(/@import "\.\/([^"]+)";/gu)].map(
    (match) => match[1],
  );
  // A reset rule weighs one class, so a later component rule of equal weight
  // wins over it, and the tokens are in place before any rule reads them.
  assert.deepEqual(imports.slice(0, 2), ["theme/theme.css", "reset/reset.css"]);
});

test("a package without a component still has a stylesheet", () => {
  const styles = packageStylesheet([]);
  assert.match(styles, /^\/\*[^]*\*\/\n$/u);
});

/** Every file below `src`, as a POSIX path relative to it. */
async function sourceFiles(): Promise<string[]> {
  const source = fileURLToPath(new URL("../src/", import.meta.url));
  const entries = await fs.readdir(source, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(source, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    );
}

/** Whether a stylesheet declares a cascade layer outside its comments. */
function declaresLayer(css: string): boolean {
  return /@layer\b/u.test(css.replace(/\/\*[^]*?\*\//gu, ""));
}

// A host reset outside every layer, or in a layer that the host declares
// later, would beat each layered rule whatever its specificity.
test("no component stylesheet declares a cascade layer", async () => {
  const stylesheets = componentStylesheets(await sourceFiles());
  assert.ok(
    stylesheets.length >= 3,
    `only ${stylesheets.length} component stylesheets scanned`,
  );
  for (const { file } of stylesheets) {
    const css = await fs.readFile(
      new URL(`../src/${file}`, import.meta.url),
      "utf8",
    );
    assert.equal(declaresLayer(css), false, file);
  }
  assert.equal(declaresLayer("@layer mokly.components { .a {} }"), true);
  assert.equal(declaresLayer(".a {}\n@layer reset, mokly;"), true);
  assert.equal(declaresLayer("/* no @layer */\n.mbk-x { color: red }"), false);
});
