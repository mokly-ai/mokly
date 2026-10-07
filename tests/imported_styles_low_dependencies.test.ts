import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { Minimatch } from "minimatch";

import { collectPostcssDependencies } from "../dist/build/styles/dependency_inventory.js";
import { walkDependencyDirectory } from "../dist/build/styles/dependency_walk.js";
import { loadConfig } from "../dist/config/load.js";

import { reportDuration } from "./helpers/durations.js";
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
  "directory dependency walks compile their glob once at any size",
  {
    timeout: 30_000,
  },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const compilation = context.mock.method(Minimatch.prototype, "make");
    for (const count of [1_000, 4_000]) {
      const directory = path.join(fixture.root, `authored-${count}`);
      await fs.mkdir(directory);
      for (let start = 0; start < count; start += 250)
        await Promise.all(
          Array.from({ length: Math.min(250, count - start) }, (_, index) =>
            fs.writeFile(
              path.join(directory, `input-${start + index}.tsx`),
              "x",
            ),
          ),
        );
      const previousCalls = compilation.mock.callCount();
      const matches = await reportDuration(
        `${count}-file directory walk`,
        (text) => context.diagnostic(text),
        () => walkDependencyDirectory(directory, "**/*.tsx", config),
      );
      const compilations = compilation.mock.callCount() - previousCalls;
      assert.equal(matches.length, count);
      context.diagnostic(
        `Directory walk counts: ${JSON.stringify({ files: count, compilations })}`,
      );
      assert.equal(
        compilations,
        1,
        `${count}-file walk must compile its glob once`,
      );
    }
  },
);
