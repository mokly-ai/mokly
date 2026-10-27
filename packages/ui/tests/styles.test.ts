import assert from "node:assert/strict";
import { test } from "node:test";

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
