import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { Metafile } from "esbuild";

import { createMetafilePathMapper } from "../dist/build/metafile_paths.js";
import { orderedStyles } from "../dist/build/styles/order.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  assertOperationScaling,
  countOperations,
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
      (counted.counts.byPath["fs.realpathSync"].get(fixture.root) ?? 0) +
        (counted.counts.byPath["fs.realpathSync.native"].get(fixture.root) ??
          0),
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
    [{ operation: "realpath", path: fixture.root }],
    [],
  );
});

test("ordered styles reuse a symlinked working directory projection at two sizes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = `${fixture.root}-alias`;
  await fs.symlink(fixture.root, alias, "dir");
  context.after(() => fs.rm(alias));
  for (const workingDir of [fixture.root, alias]) {
    await context.test(
      workingDir === alias ? "symlinked root" : "physical root",
      () => {
        const collect = (count: number) => {
          const files = Array.from(
            { length: count },
            (_, index) => `entries/css-${index}.css`,
          );
          const root = "entries/fixture.mockup.tsx";
          const metafile: Metafile = {
            inputs: {
              [root]: {
                bytes: 1,
                imports: files.map((file) => ({
                  path: file,
                  kind: "import-statement" as const,
                })),
              },
              ...Object.fromEntries(
                files.map((file) => [file, { bytes: 1, imports: [] }]),
              ),
            },
            outputs: {},
          };
          const counted = countOperations(() =>
            orderedStyles(metafile, fixture.entryPath, workingDir),
          );
          assert.deepEqual(
            counted.result,
            files.map((file) => path.join(workingDir, file)),
          );
          context.diagnostic(
            `${count} CSS edges under ${workingDir}: combined realpath=${
              (counted.counts.byPath["fs.realpathSync"].get(workingDir) ?? 0) +
              (counted.counts.byPath["fs.realpathSync.native"].get(
                workingDir,
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
          [{ operation: "realpath", path: workingDir }],
          [],
        );
      },
    );
  }
});
