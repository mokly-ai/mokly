import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { Metafile } from "esbuild";

import { createMetafilePathMapper } from "../dist/build/metafile_paths.js";
import { graphSourceFiles } from "../dist/build/source_inventory.js";

import { reportDuration } from "./helpers/durations.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  assertOperationScaling,
  countOperations,
  type Operation,
} from "./helpers/operation_counts.js";

test("large graph source inventory reuses one mapped working directory", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const workingDir = fixture.entriesDir;
  const collect = async (count: number) => {
    const directory = `sources-${count}`;
    await fs.mkdir(path.join(workingDir, directory));
    const files = Array.from(
      { length: count },
      (_, index) => `${directory}/input-${index}.ts`,
    );
    for (let start = 0; start < files.length; start += 250)
      await Promise.all(
        files
          .slice(start, start + 250)
          .map((file) =>
            fs.writeFile(path.join(workingDir, file), "export default null;"),
          ),
      );
    const metafile: Metafile = {
      inputs: Object.fromEntries(
        files.map((file) => [file, { bytes: 20, imports: [] }]),
      ),
      outputs: {},
    };
    const counted = await reportDuration(
      `${count} graph inputs`,
      (text) => context.diagnostic(text),
      () =>
        countOperations(() =>
          graphSourceFiles(
            metafile,
            workingDir,
            fixture.root,
            fixture.mockupsDir,
          ),
        ),
    );
    assert.equal(counted.result.length, files.length);
    assert.equal(
      (counted.counts.byPath["fs.realpathSync"].get(workingDir) ?? 0) +
        (counted.counts.byPath["fs.realpathSync.native"].get(workingDir) ?? 0),
      1,
      `working directory must be resolved once at size ${count}`,
    );
    for (const file of files) {
      const total =
        counted.counts.byPath["fs.realpathSync"].get(
          path.join(workingDir, file),
        ) ?? 0;
      assert.ok(total > 0, `${file} realpath calls must be observed`);
      assert.ok(total <= 1, `${file} must be resolved at most once`);
    }
    context.diagnostic(
      `${count} graph inputs: ${JSON.stringify(counted.counts.totals)}`,
    );
    return counted;
  };
  const smaller = await collect(750);
  const larger = await collect(3_000);
  const scaledTotals = (
    Object.keys(smaller.counts.totals) as Operation[]
  ).filter((operation) => smaller.counts.totals[operation] > 0);
  assertOperationScaling(
    smaller,
    larger,
    [
      { operation: "realpath", path: workingDir },
      { operation: "Array.prototype.sort" },
    ],
    scaledTotals,
  );
});

for (const symlinked of [false, true]) {
  test(`graph source inventory fixes root resolutions when the working directory ${symlinked ? "is symlinked" : "equals repoRoot"}`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const root = symlinked ? `${fixture.root}-alias` : fixture.root;
    if (symlinked) {
      await fs.symlink(fixture.root, root, "dir");
      context.after(() => fs.rm(root));
    }
    const files = Array.from(
      { length: 40 },
      (_, index) => `entries/input-${index}.ts`,
    );
    await Promise.all(
      files.map((file) =>
        fs.writeFile(path.join(fixture.root, file), "export default null;"),
      ),
    );
    const collect = (count: number) => {
      const inputs = files.slice(0, count);
      const metafile: Metafile = {
        inputs: Object.fromEntries(
          inputs.map((file) => [file, { bytes: 20, imports: [] }]),
        ),
        outputs: {},
      };
      const counted = countOperations(() => {
        const mapper = createMetafilePathMapper(root);
        return graphSourceFiles(
          metafile,
          root,
          root,
          path.join(root, "mockups"),
          mapper,
        );
      });
      assert.deepEqual(counted.result, [...inputs].sort());
      context.diagnostic(
        `${count} graph inputs under ${root}: combined realpath=${
          (counted.counts.byPath["fs.realpathSync"].get(root) ?? 0) +
          (counted.counts.byPath["fs.realpathSync.native"].get(root) ?? 0)
        }`,
      );
      return counted;
    };
    const smaller = collect(10);
    const larger = collect(40);
    assertOperationScaling(
      smaller,
      larger,
      [{ operation: "realpath", path: root }],
      [],
    );
  });
}
