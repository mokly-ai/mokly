import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

const pages = [
  "ci-verification-evidence.md",
  "mokly-changes-controls.md",
  "mokly-changes-engine.md",
  "mokly-configuration-discovery.md",
  "mokly-css-attribution-rules.md",
  "mokly-css-attribution-evidence.md",
  "mokly-export-boundary.md",
  "mokly-imported-styles-assets.md",
  "mokly-publication-changes.md",
  "mokly-rendering-generated.md",
  "mokly-source-inventory.md",
  "mokly-watch-lifecycle.md",
  "npm-release-management.md",
] as const;

test("every split protocol page is indexed and its relative links resolve", async () => {
  const directory = path.join(repositoryRoot, "docs/protocol");
  const index = await fs.readFile(path.join(directory, "README.md"), "utf8");
  for (const page of pages) {
    assert.ok(index.includes(`./${page}`), page);
    const source = await fs.readFile(path.join(directory, page), "utf8");
    for (const match of source.matchAll(
      /\]\(\.\/([^#)]+\.md)(?:#[^)]+)?\)/gu,
    )) {
      assert.ok(
        await fs.stat(path.join(directory, match[1]!)).then(
          (stat) => stat.isFile(),
          () => false,
        ),
        `${page}: ${match[1]}`,
      );
    }
  }
});
