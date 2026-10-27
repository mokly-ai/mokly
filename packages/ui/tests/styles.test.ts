import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { componentStylesheets, packageStylesheet } from "../scripts/styles.mjs";

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

test("the package stylesheet holds every component's rules in name order", () => {
  const styles = packageStylesheet([
    { name: "toolbar", css: ".toolbar {}" },
    { name: "ab", css: ".ab {}\n" },
    { name: "a-b", css: ".a-b {}\n" },
  ]);
  const rules = styles.split("\n").slice(1);
  assert.deepEqual(rules, [".a-b {}", ".ab {}", ".toolbar {}", ""]);
  assert.match(styles, /^\/\* @mokly\/ui: .* \*\/\n/u);
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

/**
 * The text after the stylesheet's one top-level `@layer mokly.components`
 * block, or null when the stylesheet does not start with that block.
 */
function afterLayerBlock(css: string): string | null {
  const rules = css.replace(/\/\*[^]*?\*\//gu, "").trim();
  const opening = "@layer mokly.components {";
  if (!rules.startsWith(opening)) return null;
  let depth = 0;
  for (let index = opening.length - 1; index < rules.length; index += 1) {
    if (rules[index] === "{") depth += 1;
    if (rules[index] === "}") depth -= 1;
    if (depth === 0) return rules.slice(index + 1).trim();
  }
  return null;
}

test("every component stylesheet keeps its rules in the mokly.components layer", async () => {
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
    assert.equal(afterLayerBlock(css), "", file);
  }
  assert.equal(afterLayerBlock(".mbk-x { color: red }"), null);
  assert.equal(
    afterLayerBlock("@layer mokly.components { .a { color: red } }\n.b {}"),
    ".b {}",
  );
});
