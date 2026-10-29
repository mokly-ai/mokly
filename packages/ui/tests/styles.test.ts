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
