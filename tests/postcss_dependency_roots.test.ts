import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { collectPostcssDependencies } from "../dist/build/styles/dependency_inventory.js";
import {
  createDependencyPathCache,
  dependencyOwnership,
} from "../dist/build/styles/dependency_walk.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  assertOperationScaling,
  countOperations,
} from "./helpers/operation_counts.js";

test("physical PostCSS reports reuse symlinked repository and mockups roots at two sizes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = `${fixture.root}-alias`;
  await fs.symlink(fixture.root, alias, "dir");
  context.after(() => fs.rm(alias));
  const config = await loadConfig(path.join(alias, "mokly.config.ts"));
  const source = path.join(fixture.entriesDir, "fixture.css");
  const collect = async (count: number) => {
    const directory = path.join(fixture.root, `reports-${count}`);
    await fs.mkdir(directory);
    const files = Array.from({ length: count }, (_, index) =>
      path.join(directory, `source-${index}.tsx`),
    );
    await Promise.all(files.map((file) => fs.writeFile(file, "x")));
    const reports = [
      ...files.map((file) => ({
        type: "dependency" as const,
        plugin: "physical",
        source,
        file,
        malformed: false,
      })),
      {
        type: "dir-dependency" as const,
        plugin: "physical",
        source,
        directory,
        glob: "*.tsx",
        malformed: false,
      },
    ];
    const counted = countOperations(() =>
      collectPostcssDependencies(config, reports, new Set()),
    );
    const logicalDirectory = path.join(alias, `reports-${count}`);
    assert.deepEqual(
      [...counted.result.sourceFiles].sort(),
      files
        .map((file) => path.join(logicalDirectory, path.basename(file)))
        .sort(),
    );
    assert.deepEqual(counted.result.watchDirectories, [
      { directory: logicalDirectory, glob: "*.tsx" },
    ]);
    context.diagnostic(
      `${count} physical reports: combined repository realpath=${
        (counted.counts.byPath["fs.realpathSync"].get(alias) ?? 0) +
        (counted.counts.byPath["fs.realpathSync.native"].get(alias) ?? 0)
      }`,
    );
    return counted;
  };
  const smaller = await collect(10);
  const larger = await collect(40);
  assertOperationScaling(
    smaller,
    larger,
    [
      { operation: "realpath", path: config.repoRoot },
      { operation: "realpath", path: config.mockupsDir },
    ],
    [],
  );
});

test("ownership of physical candidates reuses a symlinked repository projection", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = `${fixture.root}-alias`;
  await fs.symlink(fixture.root, alias, "dir");
  context.after(() => fs.rm(alias));
  const config = await loadConfig(path.join(alias, "mokly.config.ts"));
  const files = Array.from({ length: 40 }, (_, index) =>
    path.join(fixture.entriesDir, `input-${index}.css`),
  );
  await Promise.all(files.map((file) => fs.writeFile(file, ".input{}")));
  const collect = (count: number) => {
    const counted = countOperations(() => {
      const cache = createDependencyPathCache(config);
      return files
        .slice(0, count)
        .map((file) => dependencyOwnership(file, config, cache));
    });
    assert.deepEqual(
      counted.result,
      Array.from({ length: count }, () => undefined),
    );
    context.diagnostic(
      `${count} physical candidates: combined repository realpath=${
        (counted.counts.byPath["fs.realpathSync"].get(alias) ?? 0) +
        (counted.counts.byPath["fs.realpathSync.native"].get(alias) ?? 0)
      }`,
    );
    return counted;
  };
  const smaller = collect(10);
  const larger = collect(40);
  assertOperationScaling(
    smaller,
    larger,
    [
      { operation: "realpath", path: config.repoRoot },
      { operation: "realpath", path: config.mockupsDir },
    ],
    [],
  );
});

for (const aliased of [false, true]) {
  test(`PostCSS public-source checks reuse fixed roots for ${aliased ? "aliased" : "physical"} graph inputs`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const alias = `${fixture.root}-alias`;
    await fs.symlink(fixture.root, alias, "dir");
    context.after(() => fs.rm(alias));
    const config = await loadConfig(path.join(alias, "mokly.config.ts"));
    const publicAlias = path.join(fixture.entriesDir, "public-inputs");
    if (aliased) await fs.symlink(fixture.mockupsDir, publicAlias, "dir");
    const files = Array.from(
      { length: 40 },
      (_, index) => `input-${index}.css`,
    );
    await Promise.all(
      files.map((file) =>
        fs.writeFile(path.join(fixture.mockupsDir, file), ".input{}"),
      ),
    );
    const graphInputs = new Set(
      files.flatMap((file) => [
        path.join(config.mockupsDir, file),
        path.join(fixture.mockupsDir, file),
      ]),
    );
    const collect = (count: number) => {
      const reports = files.slice(0, count).map((file) => ({
        type: "dependency" as const,
        plugin: "physical",
        source: fixture.entryPath,
        file: path.join(aliased ? publicAlias : fixture.mockupsDir, file),
        malformed: false,
      }));
      const counted = countOperations(() =>
        collectPostcssDependencies(config, reports, graphInputs),
      );
      assert.deepEqual(
        [...counted.result.sourceFiles].sort(),
        files
          .slice(0, count)
          .map((file) =>
            path.join(
              alias,
              aliased ? "entries/public-inputs" : "mockups",
              file,
            ),
          )
          .sort(),
      );
      assert.deepEqual(counted.result.watchDirectories, []);
      context.diagnostic(
        `${count} ${aliased ? "aliased" : "physical"} graph inputs: repository realpath=${
          (counted.counts.byPath["fs.realpathSync"].get(config.repoRoot) ?? 0) +
          (counted.counts.byPath["fs.realpathSync.native"].get(
            config.repoRoot,
          ) ?? 0)
        }; mockups realpath=${
          (counted.counts.byPath["fs.realpathSync"].get(config.mockupsDir) ??
            0) +
          (counted.counts.byPath["fs.realpathSync.native"].get(
            config.mockupsDir,
          ) ?? 0)
        }`,
      );
      return counted;
    };
    const smaller = collect(10);
    const larger = collect(40);
    assertOperationScaling(
      smaller,
      larger,
      [
        { operation: "realpath", path: config.repoRoot },
        { operation: "realpath", path: config.mockupsDir },
      ],
      [],
    );
  });
}
