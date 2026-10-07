import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { Metafile } from "esbuild";

import { createMetafilePathMapper } from "../dist/build/metafile_paths.js";
import { graphSourceFiles } from "../dist/build/source_inventory.js";
import { orderedStyles } from "../dist/build/styles/order.js";

import { reportDuration } from "./helpers/durations.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  assertOperationScaling,
  countOperations,
  type Operation,
} from "./helpers/operation_counts.js";

test("one metafile mapper keeps a symlinked working directory's logical paths", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = `${fixture.root}-alias`;
  await fs.symlink(fixture.root, alias, "dir");
  context.after(() => fs.rm(alias));
  const mapper = createMetafilePathMapper(alias);
  const logical = path.join(alias, "entries/fixture.mockup.tsx");
  assert.equal(mapper.path(mapper.key(logical)), logical);
});

test("large ordered CSS inventory reads shared inputs once and maps one working directory", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const root = "entries/fixture.mockup.tsx";
  const collect = (count: number) => {
    const files = Array.from(
      { length: count },
      (_, index) => `entries/css-${index}.css`,
    );
    const modules = ["entries/first.ts", "entries/second.ts"];
    const imports = (paths: readonly string[]) =>
      paths.map((file) => ({ path: file, kind: "import-statement" as const }));
    const reads = new Map<string, number>();
    const metafile: Metafile = {
      inputs: new Proxy(
        {
          [root]: { bytes: 1, imports: imports(modules) },
          ...Object.fromEntries(
            modules.map((file) => [
              file,
              { bytes: 1, imports: imports(files) },
            ]),
          ),
          ...Object.fromEntries(
            files.map((file) => [file, { bytes: 1, imports: [] }]),
          ),
        },
        {
          get(target, key, receiver) {
            if (typeof key === "string")
              reads.set(key, (reads.get(key) ?? 0) + 1);
            return Reflect.get(target, key, receiver);
          },
        },
      ),
      outputs: {},
    };
    const counted = countOperations(() =>
      orderedStyles(metafile, path.join(fixture.root, root), fixture.root),
    );
    assert.equal(counted.result.length, files.length);
    assert.ok(reads.size > 0, "metafile input reads must be observed");
    for (const [file, total] of reads)
      assert.equal(total, 1, `${file} must be read once at size ${count}`);
    assert.equal(reads.size, files.length + modules.length + 1);
    assert.equal(
      counted.counts.byPath["fs.realpathSync"].get(fixture.root),
      1,
      `working directory must be resolved once at size ${count}`,
    );
    context.diagnostic(
      `${count} CSS files: ${reads.size} input reads; ${JSON.stringify(counted.counts.totals)}`,
    );
    return counted;
  };
  const smaller = collect(2_500);
  const larger = collect(10_000);
  assertOperationScaling(
    smaller,
    larger,
    [{ operation: "fs.realpathSync", path: fixture.root }],
    [],
  );
});

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
      counted.counts.byPath["fs.realpathSync"].get(workingDir),
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
      { operation: "fs.realpathSync", path: workingDir },
      { operation: "Array.prototype.sort" },
    ],
    scaledTotals,
  );
});
