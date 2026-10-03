import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { collectPostcssDependencies } from "../dist/build/styles/dependency_inventory.js";
import { walkDependencyDirectory } from "../dist/build/styles/dependency_walk.js";
import { loadConfig } from "../dist/config/load.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const denied = [
  "dist",
  "target",
  "coverage",
  "test-results",
  "playwright-report",
  ".context",
];

for (const name of denied) {
  test(`explicit PostCSS source in ${name} is inventoried and watched, but broad scans prune it`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const directory = path.join(fixture.root, name);
    await fs.mkdir(directory);
    const file = path.join(directory, "tokens.css");
    await fs.writeFile(file, ".token{color:red}");
    const config = await loadConfig(fixture.root);
    const dependency = collectPostcssDependencies(
      config,
      [
        {
          type: "dependency",
          plugin: "fixture",
          source: path.join(fixture.entriesDir, "fixture.css"),
          file,
          malformed: false,
        },
      ],
      new Set(),
    );
    assert.ok(dependency.sourceFiles.has(file));
    const required = {
      ...config,
      sourceFiles: [path.relative(config.repoRoot, file)],
    };
    assert.equal(
      classifyWatchPath({ path: file, kind: "change" }, required),
      "rebuild",
    );
    assert.deepEqual(
      walkDependencyDirectory(fixture.root, "**/*.css", config),
      [],
    );
  });
}
