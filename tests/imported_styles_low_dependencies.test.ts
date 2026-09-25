import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { collectPostcssDependencies } from "../dist/build/styles/dependency_inventory.js";
import { walkDependencyDirectory } from "../dist/build/styles/dependency_walk.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("directory reports compare candidate paths in code-unit order", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  for (const name of ["z.txt", "ä.txt"])
    await fs.writeFile(path.join(fixture.mockupsDir, name), "public");
  const config = await loadConfig(fixture.root);
  assert.throws(
    () =>
      collectPostcssDependencies(
        config,
        [
          {
            type: "dir-dependency",
            plugin: "fixture",
            source: path.join(fixture.entriesDir, "fixture.css"),
            directory: fixture.mockupsDir,
            glob: "*.txt",
            malformed: false,
          },
        ],
        new Set(),
      ),
    /directory dependency scans a public mockups file in entries\/fixture\.css: mockups\/z\.txt;/,
  );
});

test(
  "large directory dependencies compile their glob rather than matching anew for every file",
  {
    timeout: 30_000,
  },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const directory = path.join(fixture.root, "authored");
    await fs.mkdir(directory);
    const count = 8_000;
    for (let start = 0; start < count; start += 250)
      await Promise.all(
        Array.from({ length: Math.min(250, count - start) }, (_, index) =>
          fs.writeFile(path.join(directory, `input-${start + index}.tsx`), "x"),
        ),
      );
    const config = await loadConfig(fixture.root);
    const started = performance.now();
    const matches = walkDependencyDirectory(directory, "**/*.tsx", config);
    const duration = performance.now() - started;
    assert.equal(matches.length, count);
    assert.ok(
      duration < 1_500,
      `directory walk took ${duration.toFixed(1)} ms`,
    );
  },
);
